import { CopyIcon, RefreshCwIcon } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { InlineError } from '~/components/inline-error';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { useGenerator } from '~/hooks/use-generator';
import { copySecret } from '~/lib/clipboard';
import type { GeneratorOptions, Strength } from '~/lib/generator';
import { t } from '~/lib/i18n/en';

import { PassphraseControls } from './generator-passphrase-controls';
import { PasswordControls } from './generator-password-controls';

const STRENGTH_KEY: Record<
  Strength,
  'generator.strength.weak' | 'generator.strength.fair' | 'generator.strength.strong' | 'generator.strength.very-strong'
> = {
  weak: 'generator.strength.weak',
  fair: 'generator.strength.fair',
  strong: 'generator.strength.strong',
  'very-strong': 'generator.strength.very-strong',
};

const STRENGTH_VALUE: Record<Strength, number> = {
  weak: 25,
  fair: 50,
  strong: 75,
  'very-strong': 100,
};

const STRENGTH_WIDTH: Record<Strength, string> = {
  weak: 'w-1/4',
  fair: 'w-1/2',
  strong: 'w-3/4',
  'very-strong': 'w-full',
};

type GeneratorPanelProps = {
  onApply?: (value: string) => void;
  showStandaloneLink?: boolean;
};

export const GeneratorPanel = ({ onApply, showStandaloneLink = false }: GeneratorPanelProps) => {
  const { options, password, passphrase, result, error, update, setMode, regenerate } = useGenerator();

  const copy = async () => {
    if (await copySecret(result.value)) toast.success(t('generator.copied'));
    else toast.error(t('generator.copyFailed'));
  };

  return (
    <div className="space-y-5">
      <Tabs value={options.mode} onValueChange={(value) => setMode(value as GeneratorOptions['mode'])}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="password">{t('generator.passwordMode')}</TabsTrigger>
          <TabsTrigger value="passphrase">{t('generator.passphraseMode')}</TabsTrigger>
        </TabsList>
        <TabsContent value="password" className="pt-4">
          <PasswordControls options={password} update={update} />
        </TabsContent>
        <TabsContent value="passphrase" className="pt-4">
          <PassphraseControls options={passphrase} update={update} />
        </TabsContent>
      </Tabs>

      <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
        <div className="flex gap-2">
          <Input
            readOnly
            autoComplete="off"
            spellCheck={false}
            aria-label={t('generator.value')}
            className="min-h-11 font-mono"
            value={result.value}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0"
            aria-label={t('generator.copy')}
            onClick={() => void copy()}
          >
            <CopyIcon aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0"
            aria-label={t('generator.regenerate')}
            onClick={regenerate}
          >
            <RefreshCwIcon aria-hidden="true" />
          </Button>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span>{t('generator.strength')}</span>
            <span className="text-muted-foreground">
              {t(STRENGTH_KEY[result.strength])} · {t('generator.entropy', { bits: Math.round(result.entropyBits) })}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={t('generator.strength')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={STRENGTH_VALUE[result.strength]}
            aria-valuetext={t(STRENGTH_KEY[result.strength])}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div className={`h-full bg-primary transition-all ${STRENGTH_WIDTH[result.strength]}`} />
          </div>
        </div>
      </div>

      {error ? <InlineError message={t('generator.error.policy')} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {showStandaloneLink ? (
          <Button variant="link" size="sm" className="h-auto px-0" asChild>
            <Link to="/app/generator">{t('generator.openStandalone')}</Link>
          </Button>
        ) : (
          <span />
        )}
        {onApply ? (
          <Button type="button" className="min-h-11" onClick={() => onApply(result.value)}>
            {t('generator.apply')}
          </Button>
        ) : null}
      </div>
    </div>
  );
};
