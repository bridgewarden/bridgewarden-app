import { Checkbox } from '~/components/ui/checkbox';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Slider } from '~/components/ui/slider';
import { PASSPHRASE_MAX_WORDS, PASSPHRASE_MIN_WORDS, type GeneratorOptions } from '~/lib/generator';
import { t } from '~/lib/i18n/en';

export const PassphraseControls = ({
  options,
  update,
}: {
  options: Extract<GeneratorOptions, { mode: 'passphrase' }>;
  update: (patch: Partial<GeneratorOptions>) => void;
}) => (
  <div className="space-y-5">
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="generator-words">{t('generator.words')}</Label>
        <span className="text-sm text-muted-foreground">{options.words}</span>
      </div>
      <Slider
        id="generator-words"
        aria-label={t('generator.words')}
        min={PASSPHRASE_MIN_WORDS}
        max={PASSPHRASE_MAX_WORDS}
        step={1}
        value={[options.words]}
        onValueChange={([words]) => words !== undefined && update({ words })}
      />
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="generator-separator">{t('generator.separator')}</Label>
        <Select
          value={options.separator}
          onValueChange={(separator) => update({ separator: separator as typeof options.separator })}
        >
          <SelectTrigger id="generator-separator" className="min-h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="-">{t('generator.separator.hyphen')}</SelectItem>
            <SelectItem value=".">{t('generator.separator.dot')}</SelectItem>
            <SelectItem value="_">{t('generator.separator.underscore')}</SelectItem>
            <SelectItem value=" ">{t('generator.separator.space')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-h-11 items-center gap-2 self-end">
        <Checkbox
          id="generator-capitalize"
          className="size-5"
          checked={options.capitalize}
          onCheckedChange={(checked) => update({ capitalize: checked === true })}
        />
        <Label htmlFor="generator-capitalize">{t('generator.capitalize')}</Label>
      </div>
    </div>
  </div>
);
