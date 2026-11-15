import type { ReactNode } from 'react';

import type { LucideIcon } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';

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
  <section aria-labelledby="auth-heading" className="flex w-full flex-1 items-center py-2 sm:py-6 lg:py-10">
    <div className="mx-auto grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(340px,440px)] lg:gap-16">
      <div className="min-w-0">
        <h1
          id="auth-heading"
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
      <Card className="min-w-0 gap-0 py-0 shadow-none">
        <CardHeader className="px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
          <CardTitle
            id={AUTH_PANEL_HEADING_ID}
            role="heading"
            aria-level={2}
            tabIndex={-1}
            className="text-xl tracking-tight"
          >
            {panel.title}
          </CardTitle>
          {panel.description ? <CardDescription>{panel.description}</CardDescription> : null}
        </CardHeader>
        <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">{children}</CardContent>
      </Card>
    </div>
  </section>
);
