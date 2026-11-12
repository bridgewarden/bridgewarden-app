import { Skeleton } from '~/components/ui/skeleton';

type SkeletonListProps = {
  label: string;
  rows?: number;
};

export const SkeletonList = ({ label, rows = 5 }: SkeletonListProps) => (
  <div role="status" aria-busy="true" aria-label={label} className="space-y-2">
    {Array.from({ length: rows }, (_, index) => (
      <Skeleton key={index} className="h-16 w-full" />
    ))}
  </div>
);
