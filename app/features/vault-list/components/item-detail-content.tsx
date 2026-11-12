import { useCallback, useEffect, useRef, useState } from 'react';

import {
  FileTextIcon,
  KeyRoundIcon,
  LinkIcon,
  LockKeyholeIcon,
  PencilIcon,
  StarIcon,
  StickyNoteIcon,
  UserIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { DialogDescription, DialogTitle } from '~/components/ui/dialog';
import { Separator } from '~/components/ui/separator';
import { useSecretReveal } from '~/hooks/use-secret-reveal';
import { copySecret } from '~/lib/clipboard';
import { t } from '~/lib/i18n/en';
import type { DecryptedItem } from '~/lib/vault/projection';

import { CopyButton, Field, PasswordField, Section } from './item-detail-fields';
import { ItemTotpPanel } from './item-totp-panel';

type ItemDetailContentProps = {
  item: DecryptedItem;
  onClose: () => void;
  onLoadSecrets: (id: string) => Promise<{ password: string | null; totpSecret: string | null }>;
};

export const ItemDetailContent = ({ item, onClose, onLoadSecrets }: ItemDetailContentProps) => {
  const [secrets, setSecrets] = useState<{ password: string | null; totpSecret: string | null }>({
    password: null,
    totpSecret: null,
  });
  const [secretsLoaded, setSecretsLoaded] = useState(false);
  const { revealed, reveal, hide } = useSecretReveal();
  const secretsRef = useRef<{ password: string | null; totpSecret: string | null } | null>(null);

  const loadSecrets = useCallback(async () => {
    if (secretsRef.current) return secretsRef.current;
    const next = await onLoadSecrets(item.id);
    secretsRef.current = next;
    setSecrets(next);
    setSecretsLoaded(true);
    return next;
  }, [item.id, onLoadSecrets]);

  useEffect(() => {
    void loadSecrets();
  }, [loadSecrets]);

  const revealPassword = async () => {
    if (revealed) {
      hide();
      return;
    }
    const next = await loadSecrets();
    if (next.password) reveal();
  };

  const copyPassword = async () => {
    const next = await loadSecrets();
    if (!next.password) return;
    if (await copySecret(next.password)) toast.success(t('vault.detail.copied', { label: t('vaultItem.password') }));
    else toast.error(t('vault.detail.copyFailed'));
  };

  const updated = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(item.updatedAt));
  const showPasswordRow = item.type === 'login' && (!secretsLoaded || secrets.password !== null);

  return (
    <div className="grid sm:grid-cols-[220px_1fr]">
      <aside className="space-y-4 border-b bg-muted/30 p-5 sm:border-r sm:border-b-0">
        <div className="flex size-14 items-center justify-center rounded-2xl border bg-background text-muted-foreground shadow-sm">
          {item.type === 'login' ? (
            <KeyRoundIcon className="size-6" aria-hidden="true" />
          ) : (
            <FileTextIcon className="size-6" aria-hidden="true" />
          )}
        </div>

        <div className="space-y-2 pr-8">
          <DialogTitle className="text-xl leading-tight">{item.name}</DialogTitle>
          <DialogDescription className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{t(item.type === 'login' ? 'vault.type.login' : 'vault.type.note')}</Badge>
            {item.favorite ? (
              <Badge variant="outline" className="gap-1">
                <StarIcon className="size-3 fill-current" aria-hidden="true" />
                {t('vault.favorite')}
              </Badge>
            ) : null}
            {item.folderName ? <Badge variant="outline">{item.folderName}</Badge> : null}
          </DialogDescription>
        </div>

        <Separator />
        <p className="text-xs text-muted-foreground">{t('vault.detail.updated', { date: updated })}</p>

        <Button className="min-h-11 w-full" asChild onClick={onClose}>
          <Link to={`/app/edit/${item.id}`}>
            <PencilIcon aria-hidden="true" />
            {t('vault.edit')}
          </Link>
        </Button>
      </aside>

      <div className="space-y-6 p-5 sm:p-6">
        {item.type === 'login' ? (
          <>
            <Section
              icon={<LockKeyholeIcon className="size-4" aria-hidden="true" />}
              title={t('vaultItem.credentials')}
            >
              <dl>
                <Field
                  label={t('vault.detail.username')}
                  actions={
                    item.username ? <CopyButton value={item.username} noun={t('vault.detail.username')} /> : null
                  }
                >
                  {item.username ?? t('vault.detail.none')}
                </Field>
                {showPasswordRow ? (
                  <PasswordField
                    password={secrets.password}
                    revealed={revealed}
                    onReveal={() => void revealPassword()}
                    onCopy={() => void copyPassword()}
                  />
                ) : null}
              </dl>
            </Section>

            {secretsLoaded && secrets.totpSecret ? <ItemTotpPanel secret={secrets.totpSecret} /> : null}

            {item.urls.length > 0 ? (
              <Section icon={<LinkIcon className="size-4" aria-hidden="true" />} title={t('vault.detail.urls')}>
                <dl>
                  {item.urls.map((url) => (
                    <Field key={url} label={url} actions={<CopyButton value={url} noun={t('vault.detail.urls')} />}>
                      <span className="text-muted-foreground">{t('vault.detail.urlOpen')}</span>
                    </Field>
                  ))}
                </dl>
              </Section>
            ) : null}

            {item.notes ? (
              <Section icon={<StickyNoteIcon className="size-4" aria-hidden="true" />} title={t('vault.detail.notes')}>
                <p className="px-3 py-2.5 text-sm whitespace-pre-wrap">{item.notes}</p>
              </Section>
            ) : null}
          </>
        ) : item.body ? (
          <Section icon={<StickyNoteIcon className="size-4" aria-hidden="true" />} title={t('vault.detail.body')}>
            <p className="px-3 py-2.5 text-sm whitespace-pre-wrap">{item.body}</p>
          </Section>
        ) : null}

        {item.type === 'login' ? (
          <Section icon={<UserIcon className="size-4" aria-hidden="true" />} title={t('vault.detail.account')}>
            <dl>
              <Field label={t('vault.detail.created')}>{new Date(item.createdAt).toLocaleDateString()}</Field>
            </dl>
          </Section>
        ) : null}
      </div>
    </div>
  );
};
