'use client';

import { useCurrentUser } from '@/lib/client-auth';
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
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@lumion/ui';
import { signOut } from 'next-auth/react';
import { cn } from '@lumion/ui';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/employees', label: 'Employees', icon: Users },
  { href: '/dashboard/leave', label: 'Leave', icon: Calendar },
  { href: '/dashboard/attendance', label: 'Attendance', icon: Clock },
  { href: '/dashboard/payroll', label: 'Payroll', icon: DollarSign },
  { href: '/dashboard/recruitment', label: 'Recruitment', icon: Briefcase },
  { href: '/dashboard/performance', label: 'Performance', icon: Target },
  { href: '/dashboard/training', label: 'Training', icon: BookOpen },
  { href: '/dashboard/assets', label: 'Assets', icon: Package },
  { href: '/dashboard/reports', label: 'Reports', icon: FileText },
];

export function Sidebar(): JSX.Element {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { user } = useCurrentUser();

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed right-4 top-4 z-50 inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden"
      >
        {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-screen w-64 border-r border-slate-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-950 md:relative md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
                <span className="text-lg font-bold text-white">L</span>
              </div>
              <span className="text-lg font-bold text-slate-900 dark:text-white">
                Lumion HRIS
              </span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-100'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Settings & Logout */}
          <div className="space-y-2 border-t border-slate-200 p-3 dark:border-slate-800">
            <Link
              href="/settings"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <Settings className="h-5 w-5" />
              Settings
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
