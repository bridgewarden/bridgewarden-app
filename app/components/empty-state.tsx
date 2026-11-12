import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';

type EmptyStateProps = {
  title: string;
  description: string;
  action?: React.ReactNode;
};

export const EmptyState = ({ title, description, action }: EmptyStateProps) => (
  <Card>
    <CardHeader>
      <CardTitle role="heading" aria-level={2}>
        {title}
      </CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    {action ? <CardContent>{action}</CardContent> : null}
  </Card>
);
