import { useEffect, useRef, useState } from 'react';
import { useFetcher, useNavigate, useSearchParams } from 'react-router';

import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { prepareLogin, unwrapLoginVault } from '~/lib/crypto/login-keys';
import { t } from '~/lib/i18n/en';
import { safeNextPath } from '~/lib/next-path';
import { TOTP_CODE_PATTERN } from '~/lib/totp-code';
import { clearVaultKey, setVaultKey } from '~/lib/vault/key-store';

type PreloginResponse =
  { ok: true; kdfAlg: string; kdfSalt: string; kdfIterations: number } | { ok: false; error: string };

type LoginSuccess = {
  ok: true;
  requires2fa: false;
  kdfAlg: string;
  kdfSalt: string;
  kdfIterations: number;
  vaultKeyWrapped: string;
  vaultKeyWrapIv: string;
};

type LoginChallenge = { ok: true; requires2fa: true; challengeToken: string };

type LoginFailure = { ok: false; error: string; challengeInvalid?: boolean };

type LoginResponse = LoginSuccess | LoginChallenge | LoginFailure;
type ChallengeResponse = LoginSuccess | LoginFailure;

export const Login = () => {
  const [searchParams] = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [challengeCode, setChallengeCode] = useState('');
  const [backupMode, setBackupMode] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [deriving, setDeriving] = useState(false);
  const [flowActive, setFlowActive] = useState(false);
  const prelogin = useFetcher<PreloginResponse>();
  const login = useFetcher<LoginResponse>();
  const challenge = useFetcher<ChallengeResponse>();
  const navigate = useNavigate();
  const passwordRef = useRef('');
  const emailRef = useRef('');
  const wrapKeyRef = useRef<Uint8Array | null>(null);
  const challengeInputRef = useRef<HTMLInputElement>(null);
  const handledPrelogin = useRef<PreloginResponse | null>(null);
  const handledLogin = useRef<LoginResponse | null>(null);
  const handledChallenge = useRef<ChallengeResponse | null>(null);
  const preloginWasSubmitting = useRef(false);
  const loginWasSubmitting = useRef(false);
  const challengeWasSubmitting = useRef(false);

  useEffect(() => {
    const data = prelogin.data;
    if (!data || handledPrelogin.current === data) return;
    handledPrelogin.current = data;

    if (!data.ok) {
      passwordRef.current = '';
      queueMicrotask(() => {
        setFlowActive(false);
        setFormError(t('login.lookupFailed'));
      });
      return;
    }

    void Promise.resolve().then(async () => {
      setDeriving(true);
      const submittedPassword = passwordRef.current;
      passwordRef.current = '';

      try {
        const prepared = await prepareLogin(submittedPassword, data.kdfSalt, data.kdfIterations);
        wrapKeyRef.current?.fill(0);
        wrapKeyRef.current = prepared.wrapKey;
        setPassword('');
        login.submit(
          { email: emailRef.current, authHash: prepared.authHash },
          { method: 'post', action: '/auth/login', encType: 'application/json' },
        );
      } catch {
        clearVaultKey();
        setFlowActive(false);
        setFormError(t('login.lookupFailed'));
      } finally {
        setDeriving(false);
      }
    });
  }, [prelogin.data, login]);

  useEffect(() => {
    const data = login.data;
    if (!data || login.state !== 'idle' || handledLogin.current === data) return;
    handledLogin.current = data;

    if (data.ok && data.requires2fa) {
      queueMicrotask(() => {
        setChallengeToken(data.challengeToken);
        setChallengeCode('');
        setChallengeError(null);
        setFlowActive(false);
      });
      return;
    }

    const wrapKey = wrapKeyRef.current;

    if (!data.ok || !wrapKey) {
      wrapKey?.fill(0);
      wrapKeyRef.current = null;
      clearVaultKey();
      queueMicrotask(() => {
        setFlowActive(false);
        setFormError(data.ok ? t('login.serverError') : t('login.invalidCredentials'));
      });
      return;
    }

    void (async () => {
      try {
        const vaultKey = await unwrapLoginVault(data.vaultKeyWrapped, data.vaultKeyWrapIv, wrapKey);
        setVaultKey(vaultKey);
        navigate(next, { replace: true });
      } catch {
        clearVaultKey();
        setFlowActive(false);
        setFormError(t('login.unlockFailed'));
      } finally {
        wrapKey.fill(0);
        wrapKeyRef.current = null;
      }
    })();
  }, [login.data, login.state, navigate, next]);

  useEffect(() => {
    const data = challenge.data;
    if (!data || challenge.state !== 'idle' || handledChallenge.current === data) return;
    handledChallenge.current = data;

    if (!data.ok) {
      const invalidChallenge = data.challengeInvalid === true;
      queueMicrotask(() => {
        setFlowActive(false);
        if (invalidChallenge) {
          wrapKeyRef.current?.fill(0);
          wrapKeyRef.current = null;
          clearVaultKey();
          setChallengeToken(null);
          setChallengeCode('');
          setChallengeError(null);
          setFormError(t('login.challengeExpired'));
        } else {
          setChallengeError(t('login.invalidChallengeCode'));
        }
      });
      return;
    }

    const wrapKey = wrapKeyRef.current;
    if (!wrapKey) {
      queueMicrotask(() => {
        setFlowActive(false);
        setChallengeToken(null);
        setFormError(t('login.serverError'));
      });
      return;
    }

    void (async () => {
      try {
        const vaultKey = await unwrapLoginVault(data.vaultKeyWrapped, data.vaultKeyWrapIv, wrapKey);
        setVaultKey(vaultKey);
        navigate(next, { replace: true });
      } catch {
        clearVaultKey();
        setFlowActive(false);
        setChallengeError(t('login.unlockFailed'));
      } finally {
        wrapKey.fill(0);
        wrapKeyRef.current = null;
      }
    })();
  }, [challenge.data, challenge.state, navigate, next]);

  useEffect(() => {
    if (prelogin.state !== 'idle') {
      preloginWasSubmitting.current = true;
      return;
    }

    if (preloginWasSubmitting.current && !prelogin.data) {
      passwordRef.current = '';
      queueMicrotask(() => {
        setFlowActive(false);
        setFormError(t('login.lookupFailed'));
      });
    }

    preloginWasSubmitting.current = false;
  }, [prelogin.state, prelogin.data]);

  useEffect(() => {
    if (login.state !== 'idle') {
      loginWasSubmitting.current = true;
      return;
    }

    if (loginWasSubmitting.current && !login.data) {
      wrapKeyRef.current?.fill(0);
      wrapKeyRef.current = null;
      clearVaultKey();
      queueMicrotask(() => {
        setFlowActive(false);
        setFormError(t('login.serverError'));
      });
    }

    loginWasSubmitting.current = false;
  }, [login.state, login.data]);

  useEffect(() => {
    if (challenge.state !== 'idle') {
      challengeWasSubmitting.current = true;
      return;
    }

    if (challengeWasSubmitting.current && !challenge.data) {
      wrapKeyRef.current?.fill(0);
      wrapKeyRef.current = null;
      clearVaultKey();
      queueMicrotask(() => {
        setFlowActive(false);
        setChallengeError(t('login.serverError'));
      });
    }

    challengeWasSubmitting.current = false;
  }, [challenge.state, challenge.data]);

  useEffect(() => {
    if (challengeToken) challengeInputRef.current?.focus();
  }, [challengeToken]);

  const busy =
    flowActive || prelogin.state !== 'idle' || login.state !== 'idle' || challenge.state !== 'idle' || deriving;

  const backToCredentials = () => {
    wrapKeyRef.current?.fill(0);
    wrapKeyRef.current = null;
    clearVaultKey();
    setChallengeToken(null);
    setChallengeCode('');
    setChallengeError(null);
    setBackupMode(false);
    setFormError(null);
    setFlowActive(false);
  };

  return (
    <section className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t('login.title')}</h1>
        <p className="text-muted-foreground">{t('login.description')}</p>
      </div>

      {challengeToken ? (
        <form
          className="space-y-4"
          aria-busy={busy}
          onSubmit={(event) => {
            event.preventDefault();
            if (!challengeCode.trim()) {
              setChallengeError(t('login.challengeCodeRequired'));
              return;
            }
            if (!backupMode && !TOTP_CODE_PATTERN.test(challengeCode)) {
              setChallengeError(t('login.invalidChallengeCode'));
              return;
            }

            setChallengeError(null);
            setFlowActive(true);
            challenge.submit(
              {
                challengeToken,
                ...(backupMode ? { backupCode: challengeCode } : { code: challengeCode }),
              },
              { method: 'post', action: '/auth/2fa', encType: 'application/json' },
            );
          }}
        >
          <div className="space-y-2">
            <h2 className="text-lg font-medium">{t('login.twoFactorTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('login.twoFactorDescription')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-2fa-code">{backupMode ? t('login.backupCode') : t('login.totpCode')}</Label>
            <Input
              ref={challengeInputRef}
              id="login-2fa-code"
              autoComplete="one-time-code"
              spellCheck={false}
              inputMode={backupMode ? 'text' : 'numeric'}
              maxLength={backupMode ? 32 : 6}
              placeholder={backupMode ? 'XXXXX-XXXXX' : '000000'}
              value={challengeCode}
              aria-invalid={challengeError !== null}
              aria-describedby={challengeError ? 'login-2fa-error' : undefined}
              onChange={(event) => {
                setChallengeCode(backupMode ? event.target.value : event.target.value.replace(/\D/g, ''));
                setChallengeError(null);
              }}
            />
          </div>
          <p role="status" aria-live="polite" className="sr-only">
            {busy ? t('login.signingIn') : ''}
          </p>
          {challengeError ? (
            <p id="login-2fa-error" role="alert" className="text-sm text-destructive">
              {challengeError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-11" disabled={busy}>
              {busy ? t('login.signingIn') : t('login.verifyCode')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={() => {
                setBackupMode((value) => !value);
                setChallengeCode('');
                setChallengeError(null);
              }}
            >
              {backupMode ? t('login.useTotp') : t('login.useBackupCode')}
            </Button>
            <Button type="button" variant="ghost" className="min-h-11" disabled={busy} onClick={backToCredentials}>
              {t('login.back')}
            </Button>
          </div>
        </form>
      ) : (
        <form
          className="space-y-4"
          aria-busy={busy}
          onSubmit={(event) => {
            event.preventDefault();
            const normalizedEmail = email.trim().toLowerCase();
            if (!normalizedEmail || !password) {
              setFieldError(t('login.missingFields'));
              setFormError(null);
              return;
            }

            setFieldError(null);
            setFormError(null);
            setFlowActive(true);
            clearVaultKey();
            emailRef.current = normalizedEmail;
            passwordRef.current = password;
            prelogin.submit(
              { email: normalizedEmail },
              { method: 'post', action: '/auth/prelogin', encType: 'application/json' },
            );
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="login-email">{t('login.email')}</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              maxLength={254}
              placeholder={t('login.emailPlaceholder')}
              value={email}
              aria-invalid={fieldError !== null}
              aria-describedby={fieldError ? 'login-field-error' : undefined}
              onChange={(event) => {
                setEmail(event.target.value);
                setFieldError(null);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">{t('login.password')}</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              spellCheck={false}
              placeholder={t('login.passwordPlaceholder')}
              value={password}
              aria-invalid={fieldError !== null}
              aria-describedby={fieldError ? 'login-field-error' : undefined}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldError(null);
              }}
            />
          </div>
          {fieldError ? (
            <p id="login-field-error" role="alert" className="text-sm text-destructive">
              {fieldError}
            </p>
          ) : null}
          {formError ? (
            <p id="login-form-error" role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          {busy ? (
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              {t('login.signingIn')}
            </p>
          ) : null}
          <Button type="submit" className="min-h-11" disabled={busy}>
            {t('login.submit')}
          </Button>
        </form>
      )}
    </section>
  );
};
