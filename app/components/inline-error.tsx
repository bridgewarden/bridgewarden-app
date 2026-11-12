import { Alert, AlertDescription } from '~/components/ui/alert';

type InlineErrorProps = {
  message: string;
  action?: React.ReactNode;
};

export const InlineError = ({ message, action }: InlineErrorProps) => (
  <Alert variant="destructive">
    <AlertDescription className="flex flex-wrap items-center gap-3">
      <span>{message}</span>
      {action}
    </AlertDescription>
  </Alert>
);
