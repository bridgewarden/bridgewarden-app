import { useSyncExternalStore } from 'react';

import { ClockIcon } from 'lucide-react';

import { Checkbox } from '~/components/ui/checkbox';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { t } from '~/lib/i18n/en';
import {
  AUTO_LOCK_OPTIONS,
  autoLockServerSnapshot,
  getAutoLockPreferences,
  parseAutoLockMinutes,
  setAutoLockMinutes,
  setLockOnHide,
  subscribeAutoLock,
  type AutoLockMinutes,
} from '~/lib/vault/auto-lock';

const labelFor = (minutes: AutoLockMinutes): string =>
  minutes === 'never' ? t('settings.autoLock.never') : t(`settings.autoLock.minutes.${minutes}`);

export const AutoLockCard = () => {
  const preferences = useSyncExternalStore(subscribeAutoLock, getAutoLockPreferences, autoLockServerSnapshot);

  return (
    <section className="space-y-4 rounded-lg border p-5">
      <div className="flex items-center gap-2">
        <ClockIcon className="size-5" aria-hidden="true" />
        <h2 className="text-lg font-medium">{t('settings.autoLock.title')}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t('settings.autoLock.description')}</p>

      <div className="space-y-2">
        <Label htmlFor="auto-lock-minutes">{t('settings.autoLock.minutes')}</Label>
        <Select
          value={String(preferences.minutes)}
          onValueChange={(value) => setAutoLockMinutes(parseAutoLockMinutes(value))}
        >
          <SelectTrigger id="auto-lock-minutes" className="min-h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AUTO_LOCK_OPTIONS.map((minutes) => (
              <SelectItem key={minutes} value={String(minutes)}>
                {labelFor(minutes)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id="lock-on-hide"
          className="mt-0.5 size-6"
          checked={preferences.lockOnHide}
          aria-describedby="lock-on-hide-description"
          onCheckedChange={(checked) => setLockOnHide(checked === true)}
        />
        <div className="space-y-1">
          <Label htmlFor="lock-on-hide">{t('settings.autoLock.hide')}</Label>
          <p id="lock-on-hide-description" className="text-sm text-muted-foreground">
            {t('settings.autoLock.hideDescription')}
          </p>
        </div>
      </div>
    </section>
  );
};
