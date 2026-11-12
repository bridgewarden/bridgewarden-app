export const FieldHint = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <p id={id} className="text-sm text-muted-foreground">
    {children}
  </p>
);

export const RequiredMark = () => (
  <span className="text-destructive" aria-hidden="true">
    *
  </span>
);
