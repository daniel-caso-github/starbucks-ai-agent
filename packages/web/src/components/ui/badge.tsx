import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
  {
    variants: {
      variant: {
        hot: 'bg-hot-bg text-hot-500',
        cold: 'bg-cold-bg text-cold-500',
        pending: 'bg-warn-bg text-warn-500',
        confirmed: 'bg-brand-100 text-brand-500',
        completed: 'bg-brand-100 text-brand-700',
        cancelled: 'bg-red-50 text-danger-600',
        empty: 'bg-surface-100 text-muted-400',
      },
    },
    defaultVariants: {
      variant: 'empty',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps): JSX.Element {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
