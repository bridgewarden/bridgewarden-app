import { SunMoonIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { t, type MessageKey } from '~/lib/i18n/en';
import { isTheme, serializeTheme, themeClassName, type Theme } from '~/lib/theme';

const choices: Array<{ value: Theme; label: MessageKey }> = [
  { value: 'light', label: 'common.theme.light' },
  { value: 'dark', label: 'common.theme.dark' },
  { value: 'system', label: 'common.theme.system' },
];

const applyTheme = (theme: Theme) => {
  document.cookie = serializeTheme(theme, { secure: window.location.protocol === 'https:' });

  const root = document.documentElement;
  root.classList.remove('light', 'dark');

  const className = themeClassName(theme);
  if (className) {
    root.classList.add(className);
  }
};

type ThemeControlProps = { theme: Theme };

export const ThemeControl = ({ theme }: ThemeControlProps) => {
  const [current, setCurrent] = useState(theme);

  const onValueChange = (value: string) => {
    if (!isTheme(value)) return;

    setCurrent(value);
    applyTheme(value);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11" aria-label={t('common.theme')}>
          <SunMoonIcon className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={current} onValueChange={onValueChange}>
          {choices.map((choice) => (
            <DropdownMenuRadioItem key={choice.value} value={choice.value} className="min-h-11">
              {t(choice.label)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
