import { useEffect, useRef, useState } from 'react';
import { useFetcher, useNavigate, useSearchParams } from 'react-router';

import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { t } from '~/lib/i18n/en';
import { safeNextPath } from '~/lib/next-path';
import { clearVaultKey, setVaultKey } from '~/lib/vault/key-store';

import { prepareLogin, unwrapLoginVault } from './login-keys';

type PreloginResponse =
  { ok: true; kdfAlg: string; kdfSalt: string; kdfIterations: number } | { ok: false; error: string };

type LoginResponse =
  | {
      ok: true;
      requires2fa: boolean;
      kdfAlg: string;
      kdfSalt: string;
      kdfIterations: number;
      vaultKeyWrapped: string;
      vaultKeyWrapIv: string;
    }
  | { ok: false; error: string };

export const Login = () => {
  const [searchParams] = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deriving, setDeriving] = useState(false);
  const [flowActive, setFlowActive] = useState(false);
  const prelogin = useFetcher<PreloginResponse>();
  const login = useFetcher<LoginResponse>();
  const navigate = useNavigate();
  const passwordRef = useRef('');
  const emailRef = useRef('');
  const wrapKeyRef = useRef<Uint8Array | null>(null);
  const handledPrelogin = useRef<PreloginResponse | null>(null);
  const handledLogin = useRef<LoginResponse | null>(null);
  const preloginWasSubmitting = useRef(false);
  const loginWasSubmitting = useRef(false);

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

    const wrapKey = wrapKeyRef.current;

    if (!data.ok || !wrapKey) {
      wrapKey?.fill(0);
      wrapKeyRef.current = null;
      clearVaultKey();
      queueMicrotask(() => setFormError(data.ok ? t('login.serverError') : t('login.invalidCredentials')));
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

  const busy = flowActive || prelogin.state !== 'idle' || login.state !== 'idle' || deriving;

  return (
    <section className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t('login.title')}</h1>
        <p className="text-muted-foreground">{t('login.description')}</p>
      </div>

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
    </section>
  );
};
