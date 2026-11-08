import { useEffect, useReducer, useRef, useState } from 'react';
import { CopyIcon, DownloadIcon } from 'lucide-react';
import { useBlocker, useFetcher, useNavigate } from 'react-router';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { t, type MessageKey } from '~/lib/i18n/en';
import { clearVaultKey, setVaultKey } from '~/lib/vault/key-store';

import { generateSetupKeyMaterial, toSetupPayload } from './setup-keys';
import {
  initialSetupState,
  isMasterPasswordValid,
  passwordsMatch,
  recoveryConfirmationMatches,
  setupReducer,
  type SetupActionResponse,
  type SetupError,
  type SetupStep,
} from './setup-state';

const STEPS = ['account', 'password', 'recovery', 'two-factor'] as const;
const STRENGTH_WIDTH = ['w-0', 'w-1/4', 'w-1/2', 'w-3/4', 'w-full'] as const;
const STRENGTH_KEYS: MessageKey[] = [
  'setup.password.strength.weak',
  'setup.password.strength.weak',
  'setup.password.strength.fair',
  'setup.password.strength.good',
  'setup.password.strength.strong',
];

const ERROR_KEY: Record<SetupError, MessageKey> = {
  forbidden: 'setup.error.serverError',
  'invalid-input': 'setup.error.invalidInput',
  'already-configured': 'setup.error.alreadyConfigured',
  'server-error': 'setup.error.serverError',
  network: 'setup.error.network',
  'recovery-mismatch': 'setup.recovery.mismatch',
};

const passwordScore = (password: string): number => {
  if (!password) return 0;

  return [
    password.length >= 12,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
};

const stepNumber = (step: SetupStep): number | null => {
  if (step === 'configured' || step === 'done') return null;

  return STEPS.indexOf(step as (typeof STEPS)[number]) + 1;
};

export const Setup = () => {
  const [state, dispatch] = useReducer(setupReducer, initialSetupState);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [fieldError, setFieldError] = useState<MessageKey | null>(null);
  const [deriving, setDeriving] = useState(false);
  const fetcher = useFetcher<SetupActionResponse>();
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const blocker = useBlocker(state.keys !== null && state.step !== 'done' && state.step !== 'configured');

  useEffect(() => {
    headingRef.current?.focus();
  }, [state.step]);

  useEffect(() => {
    if (state.keys === null) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state.keys]);

  useEffect(() => {
    if (!fetcher.data) return;

    if (fetcher.data.ok) {
      dispatch({ type: 'succeeded' });
      return;
    }

    if (fetcher.data.error === 'forbidden' || fetcher.data.error === 'already-configured') {
      clearVaultKey();
    }

    dispatch({ type: 'failed', error: fetcher.data.error });
  }, [fetcher.data]);

  useEffect(() => {
    if (state.step === 'configured') {
      navigate('/login', { replace: true });
      return;
    }

    if (state.step === 'done' && fetcher.state === 'idle') {
      navigate('/app', { replace: true });
    }
  }, [state.step, fetcher.state, navigate]);

  const wasSubmitting = useRef(false);

  useEffect(() => {
    if (fetcher.state !== 'idle') {
      wasSubmitting.current = true;
      return;
    }

    if (wasSubmitting.current && state.step === 'submitting' && !fetcher.data) {
      dispatch({ type: 'failed', error: 'network' });
    }

    wasSubmitting.current = false;
  }, [fetcher.state, state.step, fetcher.data]);

  const submitSetup = () => {
    if (!state.keys) return;

    fetcher.submit(toSetupPayload(state.keys, { email: state.email, displayName: state.displayName }), {
      method: 'post',
      encType: 'application/json',
    });
  };

  const currentStep = stepNumber(state.step);
  const busy = fetcher.state !== 'idle' || state.step === 'submitting';
  const errorMessage = state.error ? t(ERROR_KEY[state.error]) : null;
  const score = passwordScore(password);

  return (
    <section className="mx-auto w-full max-w-xl space-y-6" aria-labelledby="setup-heading">
      <div className="space-y-2">
        <h1 id="setup-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-semibold">
          {t('setup.title')}
        </h1>
        <p className="text-muted-foreground">{t('setup.description')}</p>
        {currentStep !== null ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {t('setup.step', { current: currentStep, total: STEPS.length })}
          </p>
        ) : null}
      </div>

      {state.step === 'account' ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const nextEmail = email.trim().toLowerCase();
            const nextDisplayName = displayName.trim();
            if (
              !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nextEmail) ||
              nextDisplayName.length === 0 ||
              nextDisplayName.length > 100
            ) {
              setFieldError('setup.account.invalid');
              return;
            }
            setFieldError(null);
            dispatch({ type: 'account-accepted', email: nextEmail, displayName: nextDisplayName });
          }}
        >
          <div className="space-y-2">
            <h2 className="text-lg font-medium">{t('setup.account.heading')}</h2>
            <p className="text-sm text-muted-foreground">{t('setup.account.description')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="setup-email">{t('setup.account.email')}</Label>
            <Input
              id="setup-email"
              type="email"
              autoComplete="email"
              maxLength={254}
              value={email}
              aria-invalid={fieldError !== null}
              aria-describedby={fieldError ? 'setup-account-error' : undefined}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="setup-display-name">{t('setup.account.displayName')}</Label>
            <Input
              id="setup-display-name"
              autoComplete="name"
              maxLength={100}
              value={displayName}
              aria-invalid={fieldError !== null}
              aria-describedby={fieldError ? 'setup-account-error' : undefined}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>
          {fieldError ? (
            <p id="setup-account-error" role="alert" className="text-sm text-destructive">
              {t(fieldError)}
            </p>
          ) : null}
          {(state.error === 'invalid-input' || state.error === 'forbidden') && errorMessage ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
          <Button type="submit" className="min-h-11">
            {t('setup.account.continue')}
          </Button>
        </form>
      ) : null}

      {state.step === 'password' ? (
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!isMasterPasswordValid(password)) {
              setFieldError('setup.password.tooShort');
              return;
            }

            if (!passwordsMatch(password, confirmPassword)) {
              setFieldError('setup.password.mismatch');
              return;
            }

            setFieldError(null);
            setDeriving(true);
            try {
              const generated = await generateSetupKeyMaterial(password);
              const { vaultKey, recoveryKey, ...transport } = generated;
              setVaultKey(vaultKey);
              vaultKey.fill(0);
              setPassword('');
              setConfirmPassword('');
              setCopyStatus('idle');
              dispatch({ type: 'keys-generated', keys: transport, recoveryKey });
            } catch {
              setFieldError('setup.error.serverError');
            } finally {
              setDeriving(false);
            }
          }}
        >
          <div className="space-y-2">
            <h2 className="text-lg font-medium">{t('setup.password.heading')}</h2>
            <p className="text-sm text-muted-foreground">{t('setup.password.description')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="setup-password">{t('setup.password.label')}</Label>
            <Input
              id="setup-password"
              type="password"
              autoComplete="new-password"
              spellCheck={false}
              value={password}
              aria-invalid={fieldError !== null}
              aria-describedby="setup-password-hint"
              onChange={(event) => setPassword(event.target.value)}
            />
            <p id="setup-password-hint" className="text-sm text-muted-foreground">
              {t('setup.password.hint')}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="setup-password-confirm">{t('setup.password.confirmLabel')}</Label>
            <Input
              id="setup-password-confirm"
              type="password"
              autoComplete="new-password"
              spellCheck={false}
              value={confirmPassword}
              aria-invalid={fieldError !== null}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <div
              role="progressbar"
              aria-label={t('setup.password.strength')}
              aria-valuemin={0}
              aria-valuemax={4}
              aria-valuenow={score}
              aria-valuetext={t(STRENGTH_KEYS[score])}
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
            >
              <div className={`h-full bg-primary transition-all ${STRENGTH_WIDTH[score]}`} />
            </div>
            <p className="text-sm text-muted-foreground">{t(STRENGTH_KEYS[score])}</p>
          </div>
          {fieldError ? (
            <p role="alert" className="text-sm text-destructive">
              {t(fieldError)}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={deriving}
              onClick={() => {
                setFieldError(null);
                dispatch({ type: 'account-accepted', email: state.email, displayName: state.displayName });
              }}
            >
              {t('setup.back')}
            </Button>
            <Button type="submit" className="min-h-11" disabled={deriving}>
              {deriving ? t('setup.password.generating') : t('setup.password.continue')}
            </Button>
          </div>
        </form>
      ) : null}

      {state.step === 'recovery' && state.keys ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!recoveryConfirmationMatches(state.recoveryKey, confirmation)) {
              setFieldError('setup.recovery.mismatch');
              return;
            }
            setFieldError(null);
            setConfirmation('');
            dispatch({ type: 'recovery-confirmed' });
          }}
        >
          <div className="space-y-2">
            <h2 className="text-lg font-medium">{t('setup.recovery.heading')}</h2>
            <p className="text-sm text-muted-foreground">{t('setup.recovery.description')}</p>
          </div>
          <div className="space-y-2">
            <p id="setup-recovery-label" className="text-sm font-medium">
              {t('setup.recovery.label')}
            </p>
            <div role="group" aria-labelledby="setup-recovery-label" className="rounded-md border bg-muted">
              <div className="flex items-start gap-2 p-3">
                <code id="setup-recovery-key" className="min-w-0 flex-1 font-mono text-sm break-all select-all">
                  {state.recoveryKey}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(state.recoveryKey);
                      setCopyStatus('copied');
                    } catch {
                      setCopyStatus('failed');
                    }
                  }}
                >
                  <CopyIcon aria-hidden="true" />
                  {copyStatus === 'copied' ? t('setup.recovery.copied') : t('setup.recovery.copy')}
                </Button>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                const content = `${t('setup.recovery.fileTitle')}: ${state.recoveryKey}\n\n${t('setup.recovery.fileWarning')}\n`;
                const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
                const link = document.createElement('a');
                link.href = url;
                link.download = 'bridgewarden-recovery-key.txt';
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              <DownloadIcon aria-hidden="true" />
              {t('setup.recovery.download')}
            </Button>
            {copyStatus === 'failed' ? (
              <p role="status" className="text-sm text-destructive">
                {t('setup.recovery.copyFailed')}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="setup-recovery-confirm">{t('setup.recovery.confirmLabel')}</Label>
            <Input
              id="setup-recovery-confirm"
              autoComplete="off"
              spellCheck={false}
              value={confirmation}
              aria-invalid={fieldError !== null}
              aria-describedby="setup-recovery-hint"
              onChange={(event) => setConfirmation(event.target.value)}
            />
            <p id="setup-recovery-hint" className="text-sm text-muted-foreground">
              {t('setup.recovery.confirmHint')}
            </p>
          </div>
          {fieldError ? (
            <p role="alert" className="text-sm text-destructive">
              {t(fieldError)}
            </p>
          ) : null}
          <Button type="submit" className="min-h-11">
            {t('setup.recovery.continue')}
          </Button>
        </form>
      ) : null}

      {state.step === 'two-factor' || state.step === 'submitting' ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-lg font-medium">{t('setup.twoFactor.heading')}</h2>
            <p className="text-sm text-muted-foreground">{t('setup.twoFactor.description')}</p>
          </div>
          <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            {t('setup.twoFactor.warning')}
          </p>
          <p className="text-sm text-muted-foreground">{t('setup.twoFactor.enrollLater')}</p>
          {errorMessage ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
          <div className="flex gap-2">
            {state.error && state.keys ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={busy}
                onClick={() => {
                  dispatch({ type: 'retry' });
                  submitSetup();
                }}
              >
                {t('setup.retry')}
              </Button>
            ) : null}
            <Button
              type="button"
              className="min-h-11"
              disabled={busy}
              onClick={() => {
                dispatch({ type: 'two-factor-continued' });
                submitSetup();
              }}
            >
              {busy ? t('setup.submitting') : t('setup.twoFactor.continue')}
            </Button>
          </div>
        </div>
      ) : null}

      {state.step === 'done' ? (
        <div className="space-y-2">
          <h2 className="text-lg font-medium">{t('setup.done.heading')}</h2>
          <p className="text-muted-foreground">{t('setup.done.description')}</p>
        </div>
      ) : null}

      <AlertDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('setup.leave.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('setup.leave.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('setup.leave.stay')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearVaultKey();
                if (blocker.state === 'blocked') blocker.proceed();
              }}
            >
              {t('setup.leave.leave')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
