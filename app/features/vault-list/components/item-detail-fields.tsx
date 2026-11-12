import { CopyIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '~/components/ui/button';
import { copySecret } from '~/lib/clipboard';
import { t } from '~/lib/i18n/en';

const copyValue = async (value: string, noun: string) => {
  if (await copySecret(value)) toast.success(t('vault.detail.copied', { label: noun }));
  else toast.error(t('vault.detail.copyFailed'));
};

export const CopyButton = ({ value, noun }: { value: string; noun: string }) => (
  <Button
    type="button"
    variant="ghost"
    size="icon"
    className="size-8 shrink-0 text-muted-foreground"
    aria-label={t('vault.detail.copyField', { field: noun })}
    onClick={() => void copyValue(value, noun)}
  >
    <CopyIcon className="size-4" aria-hidden="true" />
  </Button>
);

export const Section = ({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-2">
    <h3 className="flex items-center gap-2 text-sm font-semibold">
      <span className="text-muted-foreground">{icon}</span>
      {title}
    </h3>
    <div className="divide-y overflow-hidden rounded-lg border bg-background">{children}</div>
  </section>
);

export const Field = ({
  label,
  children,
  actions,
}: {
  label: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) => (
  <div className="flex items-start justify-between gap-3 px-3 py-2.5">
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm break-all">{children}</dd>
    </div>
    {actions ? <div className="flex shrink-0 items-center">{actions}</div> : null}
  </div>
);

export const PasswordField = ({
  password,
  revealed,
  onReveal,
  onCopy,
}: {
  password: string | null;
  revealed: boolean;
  onReveal: () => void;
  onCopy: () => void;
}) => (
  <Field
    label={t('vaultItem.password')}
    actions={
      <>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground"
          aria-label={t(revealed ? 'vaultItem.hidePassword' : 'vaultItem.showPassword')}
          onClick={onReveal}
        >
          {revealed ? (
            <EyeOffIcon className="size-4" aria-hidden="true" />
          ) : (
            <EyeIcon className="size-4" aria-hidden="true" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground"
          aria-label={t('vault.detail.copyField', { field: t('vaultItem.password') })}
          onClick={onCopy}
        >
          <CopyIcon className="size-4" aria-hidden="true" />
        </Button>
      </>
    }
  >
    <span className="font-mono">{revealed && password ? password : '••••••••'}</span>
  </Field>
);
