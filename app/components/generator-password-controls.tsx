import { Checkbox } from '~/components/ui/checkbox';
import { Label } from '~/components/ui/label';
import { Slider } from '~/components/ui/slider';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, type GeneratorOptions, type PasswordOptions } from '~/lib/generator';
import { t } from '~/lib/i18n/en';

const characterSets = [
  ['uppercase', 'generator.uppercase'],
  ['lowercase', 'generator.lowercase'],
  ['digits', 'generator.digits'],
  ['symbols', 'generator.symbols'],
] as const;

export const PasswordControls = ({
  options,
  update,
}: {
  options: PasswordOptions;
  update: (patch: Partial<GeneratorOptions>) => void;
}) => (
  <div className="space-y-5">
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="generator-length">{t('generator.length')}</Label>
        <span className="text-sm text-muted-foreground">{options.length}</span>
      </div>
      <Slider
        id="generator-length"
        aria-label={t('generator.length')}
        min={PASSWORD_MIN_LENGTH}
        max={PASSWORD_MAX_LENGTH}
        step={1}
        value={[options.length]}
        onValueChange={([length]) => length !== undefined && update({ length })}
      />
    </div>

    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{t('generator.characterSets')}</legend>
      <div className="grid grid-cols-2 gap-3">
        {characterSets.map(([key, label]) => {
          const enabled = options[key];
          const onlyEnabled =
            enabled && characterSets.filter(([other]) => other !== key).every(([other]) => !options[other]);
          return (
            <div key={key} className="flex items-center gap-2">
              <Checkbox
                id={`generator-${key}`}
                className="size-5"
                checked={enabled}
                disabled={onlyEnabled}
                onCheckedChange={(checked) => update({ [key]: checked === true })}
              />
              <Label htmlFor={`generator-${key}`}>{t(label)}</Label>
            </div>
          );
        })}
      </div>
    </fieldset>

    <div className="flex items-center gap-2">
      <Checkbox
        id="generator-ambiguous"
        className="size-5"
        checked={options.excludeAmbiguous}
        onCheckedChange={(checked) => update({ excludeAmbiguous: checked === true })}
      />
      <Label htmlFor="generator-ambiguous">{t('generator.excludeAmbiguous')}</Label>
    </div>
  </div>
);
