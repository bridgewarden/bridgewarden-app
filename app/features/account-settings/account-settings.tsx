import { useEffect, useRef, useState } from 'react';
import { ShieldCheckIcon } from 'lucide-react';
import { useFetcher } from 'react-router';

import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { prepareLogin } from '~/lib/crypto/login-keys';
import { t } from '~/lib/i18n/en';

import { BackupCodesPanel } from './backup-codes-panel';
import { EnabledActions } from './enabled-actions';
import { EnrollmentPanel } from './enrollment-panel';

type TwoFactorState = {
  enabled: boolean;
  remaining: number;
};

export type AccountSettingsProps = {
  email: string;
  displayName: string | null;
  twoFactor: TwoFactorState;
};

type EnrollResponse = { ok: true; secret: string; uri: string } | { ok: false; error: string };
type CodesResponse = { ok: true; backupCodes: string[] } | { ok: false; error: string };
type DisableResponse = { ok: true } | { ok: false; error: string };
type PreloginResponse =
  { ok: true; kdfAlg: string; kdfSalt: string; kdfIterations: number } | { ok: false; error: string };

export const AccountSettings = ({ email, displayName, twoFactor }: AccountSettingsProps) => {
  const [enrollment, setEnrollment] = useState<{ secret: string; uri: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [disableError, setDisableError] = useState<string | null>(null);
  const [deriving, setDeriving] = useState(false);
  const passwordRef = useRef('');
  const handledPrelogin = useRef<PreloginResponse | null>(null);
  const pendingAction = useRef<'enroll' | 'regenerate' | 'disable' | null>(null);
  const enrollmentFetcher = useFetcher<EnrollResponse>();
  const verifyFetcher = useFetcher<CodesResponse>();
  const regenerateFetcher = useFetcher<CodesResponse>();
  const disableFetcher = useFetcher<DisableResponse>();
  const preloginFetcher = useFetcher<PreloginResponse>();

  useEffect(() => {
    const data = enrollmentFetcher.data;
    if (!data) return;
    queueMicrotask(() => {
      if (data.ok) {
        setEnrollment({ secret: data.secret, uri: data.uri });
        setError(null);
      } else {
        setError(t('settings.twoFactor.loadFailed'));
      }
    });
  }, [enrollmentFetcher.data]);

  useEffect(() => {
    const data = verifyFetcher.data;
    if (!data) return;
    queueMicrotask(() => {
      if (data.ok) {
        setCodes(data.backupCodes);
        setEnrollment(null);
        setCode('');
        setError(null);
      } else {
        setError(t('settings.twoFactor.invalidCode'));
      }
    });
  }, [verifyFetcher.data]);

  useEffect(() => {
    const data = regenerateFetcher.data;
    if (!data) return;
    queueMicrotask(() => {
      if (data.ok) {
        setCodes(data.backupCodes);
        setError(null);
      } else {
        setError(t('settings.twoFactor.regenerateFailed'));
      }
    });
  }, [regenerateFetcher.data]);

  useEffect(() => {
    const data = disableFetcher.data;
    if (!data) return;
    queueMicrotask(() => {
      if (data.ok) {
        setCodes(null);
        setEnrollment(null);
        setDisableError(null);
        setPassword('');
      } else {
        setDisableError(t('settings.twoFactor.disableFailed'));
      }
    });
  }, [disableFetcher.data]);

  useEffect(() => {
    const data = preloginFetcher.data;
    if (!data || handledPrelogin.current === data) return;
    handledPrelogin.current = data;
    const action = pendingAction.current;
    pendingAction.current = null;

    queueMicrotask(() => {
      if (!data.ok) {
        if (action === 'enroll') setError(t('settings.twoFactor.disableFailed'));
        else setDisableError(t('settings.twoFactor.disableFailed'));
        return;
      }

      const submittedPassword = passwordRef.current;
      passwordRef.current = '';
      setDeriving(true);

      void Promise.resolve().then(async () => {
        try {
          const prepared = await prepareLogin(submittedPassword, data.kdfSalt, data.kdfIterations);
          prepared.wrapKey.fill(0);
          const target =
            action === 'enroll' ? enrollmentFetcher : action === 'regenerate' ? regenerateFetcher : disableFetcher;
          const endpoint =
            action === 'enroll'
              ? '/api/account/2fa/enroll'
              : action === 'regenerate'
                ? '/api/account/2fa/backup-codes/regenerate'
                : '/api/account/2fa/disable';
          target.submit(
            { authHash: prepared.authHash },
            { method: 'post', action: endpoint, encType: 'application/json' },
          );
          setPassword('');
        } catch {
          if (action === 'enroll') setError(t('settings.twoFactor.disableFailed'));
          else setDisableError(t('settings.twoFactor.disableFailed'));
        } finally {
          setDeriving(false);
        }
      });
    });
  }, [preloginFetcher.data, disableFetcher, enrollmentFetcher, regenerateFetcher]);

  const startStepUp = (action: 'enroll' | 'regenerate' | 'disable') => {
    if (!password) {
      if (action === 'enroll') setError(t('settings.twoFactor.passwordRequired'));
      else setDisableError(t('settings.twoFactor.passwordRequired'));
      return;
    }
    if (action === 'enroll') setError(null);
    else setDisableError(null);
    passwordRef.current = password;
    pendingAction.current = action;
    preloginFetcher.submit({ email }, { method: 'post', action: '/auth/prelogin', encType: 'application/json' });
  };

  const busy =
    enrollmentFetcher.state !== 'idle' ||
    verifyFetcher.state !== 'idle' ||
    regenerateFetcher.state !== 'idle' ||
    disableFetcher.state !== 'idle' ||
    preloginFetcher.state !== 'idle' ||
    deriving;

  return (
    <section className="mx-auto w-full max-w-2xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.description')}</p>
        <p className="text-sm text-muted-foreground">
          {displayName ?? email} · {email}
        </p>
      </div>

      <div className="space-y-4 rounded-lg border p-5">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="size-5" aria-hidden="true" />
          <h2 className="text-lg font-medium">{t('settings.twoFactor.title')}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{t('settings.twoFactor.description')}</p>

        {twoFactor.enabled ? (
          <div className="space-y-4">
            <p className="text-sm">
              {t('settings.twoFactor.enabled')} · {t('settings.twoFactor.remaining', { count: twoFactor.remaining })}
            </p>
            <EnabledActions
              password={password}
              error={disableError}
              busy={busy}
              onPasswordChange={(value) => {
                setPassword(value);
                setDisableError(null);
              }}
              onRegenerate={() => startStepUp('regenerate')}
              onDisable={() => startStepUp('disable')}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('settings.twoFactor.disabled')}</p>
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                startStepUp('enroll');
              }}
            >
              <Label htmlFor="enable-password">{t('settings.twoFactor.password')}</Label>
              <Input
                id="enable-password"
                type="password"
                autoComplete="current-password"
                spellCheck={false}
                value={password}
                disabled={busy || enrollment !== null}
                aria-invalid={error !== null}
                aria-describedby={error ? 'settings-2fa-error' : undefined}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError(null);
                }}
              />
              <Button type="submit" className="min-h-11" disabled={busy || enrollment !== null}>
                {t('settings.twoFactor.enable')}
              </Button>
            </form>

            {enrollment ? (
              <EnrollmentPanel
                secret={enrollment.secret}
                uri={enrollment.uri}
                code={code}
                error={error}
                busy={busy}
                onCodeChange={(value) => {
                  setCode(value);
                  setError(null);
                }}
                onInvalidCode={() => setError(t('settings.twoFactor.invalidCode'))}
                onVerify={() => {
                  setError(null);
                  verifyFetcher.submit(
                    { code },
                    { method: 'post', action: '/api/account/2fa/verify', encType: 'application/json' },
                  );
                }}
                onQrError={() => setError(t('settings.twoFactor.qrFailed'))}
              />
            ) : null}
          </div>
        )}

        {error ? (
          <p id="settings-2fa-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      {codes ? <BackupCodesPanel codes={codes} /> : null}
    </section>
  );
};
