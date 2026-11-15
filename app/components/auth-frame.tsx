import type { ReactNode } from 'react';

import type { LucideIcon } from 'lucide-react';

import { FramedPanel } from '~/components/framed-panel';

export const AUTH_TITLE_ID = 'auth-heading';
export const AUTH_PANEL_HEADING_ID = 'auth-panel-heading';

type AuthFrameProps = {
  title: string;
  description: string;
  points?: { icon: LucideIcon; text: string }[];
  panel: {
    title: string;
    description?: string;
  };
  children: ReactNode;
};

export const AuthFrame = ({ title, description, points, panel, children }: AuthFrameProps) => (
  <section aria-labelledby={AUTH_TITLE_ID} className="flex w-full flex-1 items-center py-2 sm:py-6 lg:py-10">
    <div className="mx-auto grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(340px,440px)] lg:gap-16">
      <div className="min-w-0">
        <h1
          id={AUTH_TITLE_ID}
          className="max-w-[12ch] text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl"
        >
          {title}
        </h1>
        <p className="mt-4 max-w-[46ch] text-sm text-muted-foreground sm:text-base">{description}</p>
        {points?.length ? (
          <ul className="mt-8 max-w-md border-t">
            {points.map((point) => {
              const Icon = point.icon;

              return (
                <li key={point.text} className="flex gap-3 border-b py-3 text-sm text-muted-foreground">
                  <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{point.text}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      <FramedPanel headingId={AUTH_PANEL_HEADING_ID} title={panel.title} description={panel.description}>
        {children}
      </FramedPanel>
    </div>
  </section>
);
