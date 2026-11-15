import type { ReactNode } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';

type FramedPanelProps = {
  headingId: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export const FramedPanel = ({ headingId, title, description, children }: FramedPanelProps) => (
  <Card className="min-w-0">
    <CardHeader>
      <CardTitle id={headingId} role="heading" aria-level={2} tabIndex={-1} className="text-xl tracking-tight">
        {title}
      </CardTitle>
      {description ? <CardDescription>{description}</CardDescription> : null}
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);
