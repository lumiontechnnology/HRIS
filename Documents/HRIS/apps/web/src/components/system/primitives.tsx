import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@lumion/ui';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}

const badgeToneClasses: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'border-transparent bg-muted text-muted-foreground',
  success: 'border-transparent bg-[hsl(var(--success)/0.10)] text-[hsl(var(--success))]',
  warning: 'border-transparent bg-[hsl(var(--warning)/0.10)] text-[hsl(var(--warning))]',
  danger: 'border-transparent bg-[hsl(var(--destructive)/0.10)] text-[hsl(var(--destructive))]',
  info: 'border-transparent bg-[hsl(var(--info)/0.10)] text-[hsl(var(--info))]',
};

export function Badge({ children, tone = 'neutral' }: BadgeProps): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold',
        badgeToneClasses[tone]
      )}
    >
      {children}
    </span>
  );
}

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

const avatarSizes: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-xl',
};

export function Avatar({ name, size = 'md' }: AvatarProps): JSX.Element {
  const initials = name
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-slate-800 font-bold text-white',
        avatarSizes[size]
      )}
    >
      {initials}
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function SectionHeader({
  title,
  description,
  actions,
}: SectionHeaderProps): JSX.Element {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-4 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 className="font-display text-2xl font-normal tracking-tight text-foreground">{title}</h1>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
}

export function KpiCard({ label, value, hint }: KpiCardProps): JSX.Element {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-label">{label}</p>
        <p className="mt-2 font-mono text-3xl font-medium tracking-tight text-foreground tabular-nums">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function CardSkeleton(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-24 animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  tone?: 'default' | 'friendly';
}

export function EmptyState({
  title,
  description,
  action,
  tone = 'default',
}: EmptyStateProps): JSX.Element {
  return (
    <Card className={cn(tone === 'friendly' ? 'border-border' : '')}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {action ? <CardContent>{action}</CardContent> : null}
    </Card>
  );
}
