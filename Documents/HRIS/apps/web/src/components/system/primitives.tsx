import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@lumion/ui';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}

const badgeToneClasses: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  danger: 'bg-rose-100 text-rose-700 border-rose-200',
  info: 'bg-sky-100 text-sky-700 border-sky-200',
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
    <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
}

export function KpiCard({ label, value, hint, icon }: KpiCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center justify-between text-xs uppercase tracking-wide">
          <span>{label}</span>
          {icon ? <span className="text-slate-500">{icon}</span> : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
        {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function CardSkeleton(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
      </CardHeader>
      <CardContent>
        <div className="h-7 w-16 animate-pulse rounded bg-slate-200" />
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
    <Card className={cn(tone === 'friendly' ? 'border-sky-200 bg-sky-50' : '')}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {action ? <CardContent>{action}</CardContent> : null}
    </Card>
  );
}
