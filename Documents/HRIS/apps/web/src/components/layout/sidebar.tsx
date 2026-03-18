'use client';

import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Clock,
  DollarSign,
  Briefcase,
  Target,
  BookOpen,
  Package,
  FileText,
  Building2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bell,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navigation = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employees', label: 'Employees', icon: Users },
  { href: '/org-chart', label: 'Org Chart', icon: Building2 },
  { href: '/leave', label: 'Leave', icon: Calendar },
  { href: '/attendance', label: 'Attendance', icon: Clock },
  { href: '/payroll', label: 'Payroll', icon: DollarSign },
  { href: '/recruitment', label: 'Recruitment', icon: Briefcase },
  { href: '/performance', label: 'Performance', icon: Target },
  { href: '/training', label: 'Training', icon: BookOpen },
  { href: '/assets', label: 'Assets', icon: Package },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar(): JSX.Element {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const supabase = createClient();

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed right-4 top-4 z-50 inline-flex items-center justify-center rounded-md border border-slate-300 bg-white p-2 text-slate-700 shadow-sm md:hidden"
      >
        {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen border-r border-slate-200 bg-white transition-all duration-200 md:relative md:translate-x-0',
          collapsed ? 'w-[86px]' : 'w-[260px]',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-900">
                <span className="text-sm font-bold text-white">LH</span>
              </div>
              {!collapsed ? <span className="text-sm font-semibold text-slate-900">Lumion HRIS</span> : null}
            </Link>
            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              className="hidden rounded border border-slate-300 p-1 text-slate-600 hover:bg-slate-50 md:inline-flex"
              aria-label="Toggle Sidebar"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {!collapsed ? (
              <p className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Workspace
              </p>
            ) : null}
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100',
                    collapsed ? 'justify-center' : 'gap-3'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {!collapsed ? item.label : null}
                </Link>
              );
            })}
          </nav>

          <div className="space-y-1 border-t border-slate-200 p-3">
            <button
              type="button"
              className={cn(
                'flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100',
                collapsed ? 'justify-center' : 'gap-3'
              )}
            >
              <Bell className="h-5 w-5" />
              {!collapsed ? 'Notifications' : null}
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.assign('/sign-in');
              }}
              className={cn(
                'flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100',
                collapsed ? 'justify-center' : 'gap-3'
              )}
            >
              <LogOut className="h-5 w-5" />
              {!collapsed ? 'Sign Out' : null}
            </button>
          </div>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
