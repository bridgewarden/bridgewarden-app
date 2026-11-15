import type { ReactNode } from 'react';

import { CheckIcon } from 'lucide-react';

import { FramedPanel } from '~/components/framed-panel';
import { cn } from '~/lib/class-names';

export const ONBOARDING_TITLE_ID = 'onboarding-title';
export const ONBOARDING_PANEL_HEADING_ID = 'onboarding-panel-heading';

type OnboardingStep = {
  id: string;
  label: string;
};

type OnboardingShellProps = {
  title: string;
  description?: string;
  summary?: ReactNode;
  steps: readonly OnboardingStep[];
  currentStep: string | null;
  panel: {
    title: string;
    description?: string;
  };
  children: ReactNode;
};

export const OnboardingShell = ({
  title,
  description,
  summary,
  steps,
  currentStep,
  panel,
  children,
}: OnboardingShellProps) => {
  const currentIndex = steps.findIndex((step) => step.id === currentStep);

  return (
    <section aria-labelledby={ONBOARDING_TITLE_ID} className="flex w-full flex-1 items-start py-4 sm:py-8 lg:py-12">
      <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-16">
        <aside className="min-w-0 lg:sticky lg:top-20">
          <h1
            id={ONBOARDING_TITLE_ID}
            tabIndex={-1}
            className="max-w-[14ch] text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            {title}
          </h1>
          {description ? <p className="mt-3 max-w-[42ch] text-sm text-muted-foreground">{description}</p> : null}
          {summary ? <div className="mt-5 text-sm text-muted-foreground">{summary}</div> : null}
          {steps.length > 0 ? (
            <ol aria-label={title} className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1 lg:gap-0">
              {steps.map((step, index) => {
                const current = step.id === currentStep;
                const done = currentIndex >= 0 && index < currentIndex;

                return (
                  <li
                    key={step.id}
                    aria-current={current ? 'step' : undefined}
                    className={cn(
                      'flex min-w-0 items-center gap-2 rounded-md border border-border/60 px-2 py-2 text-[11px] leading-tight lg:rounded-none lg:border-0 lg:border-b lg:px-0 lg:py-3',
                      current && 'border-primary/40 bg-accent text-accent-foreground',
                      done && 'text-foreground',
                      !current && !done && 'text-muted-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-6 shrink-0 place-items-center rounded-full border font-mono text-[10px]',
                        current && 'border-primary text-primary',
                        done && 'border-primary/40 bg-primary/10 text-primary',
                      )}
                      aria-hidden="true"
                    >
                      {done ? <CheckIcon className="size-3" /> : String(index + 1).padStart(2, '0')}
                    </span>
                    <span className={cn('min-w-0 truncate font-medium', current && 'text-foreground')}>
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : null}
        </aside>

        <FramedPanel headingId={ONBOARDING_PANEL_HEADING_ID} title={panel.title} description={panel.description}>
          {children}
        </FramedPanel>
      </div>
    </section>
  );
};
