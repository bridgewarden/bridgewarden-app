import { GeneratorPanel } from '~/components/generator-panel';
import { t } from '~/lib/i18n/en';

export const Generator = () => (
  <section className="mx-auto w-full max-w-2xl space-y-6">
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold">{t('generator.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('generator.description')}</p>
    </div>
    <GeneratorPanel />
  </section>
);
