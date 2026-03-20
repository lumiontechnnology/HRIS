'use client';

import { createClient } from '@/lib/supabase/client';
import { useCurrentUser } from '@/lib/client-auth';
import { cn } from '@/lib/utils';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';

function navigationForRole(role: string) {
  if (role === 'EMPLOYEE') {
    return [
      {
        label: 'My Workspace',
        items: [
          { href: '/my-dashboard', label: 'Dashboard' },
          { href: '/my-profile', label: 'My Profile' },
          { href: '/my-payslips', label: 'My Payslips' },
          { href: '/my-leave', label: 'My Leave' },
        ],
      },
      {
        label: 'My Team',
        items: [
          { href: '/employees', label: 'Team Directory' },
          { href: '/org-chart', label: 'Org Chart' },
        ],
      },
      {
        label: 'Help',
        items: [
          { href: '/reports', label: 'Company Policies' },
          { href: '/notifications', label: 'Contact HR' },
        ],
      },
    ];
  }

  if (role === 'MANAGER') {
    return [
      {
        label: 'My Team',
        items: [
          { href: '/manager-dashboard', label: 'Team Overview' },
          { href: '/employees', label: 'Team Members' },
          { href: '/leave/approvals', label: 'Leave Approvals' },
          { href: '/org-chart', label: 'Team Calendar' },
          { href: '/reports', label: 'Team Reports' },
        ],
      },
      {
        label: 'My Profile',
        items: [
          { href: '/my-dashboard', label: 'Dashboard' },
          { href: '/my-payslips', label: 'My Payslips' },
          { href: '/my-leave', label: 'My Leave' },
        ],
      },
    ];
  }

  return [
    {
      label: 'Workspace',
      items: [
        { href: '/', label: 'Dashboard' },
        { href: '/employees', label: 'All Employees' },
        { href: '/employees/exited', label: 'Exited Staff' },
        { href: '/employees?status=NOTICE_PERIOD', label: 'On Notice Period' },
        { href: '/org-chart', label: 'Org Chart' },
        { href: '/employees/import-export', label: 'Import / Export' },
        { href: '/onboarding', label: 'Onboarding' },
      ],
    },
    {
      label: 'Operations',
      items: [
        { href: '/leave', label: 'Leave' },
        { href: '/attendance', label: 'Attendance' },
        { href: '/payroll', label: 'Payroll' },
        { href: '/recruitment', label: 'Recruitment' },
        { href: '/performance', label: 'Performance' },
        { href: '/training', label: 'Training' },
        { href: '/assets', label: 'Assets' },
        { href: '/reports', label: 'Reports' },
        { href: '/settings', label: 'Settings' },
      ],
    },
  ];
}

export function Sidebar(): JSX.Element {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { user, isRoleResolved } = useCurrentUser();
  const supabase = createClient();
  const navigation = useMemo(() => navigationForRole(user?.role || 'EMPLOYEE'), [user?.role]);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed right-4 top-4 z-50 inline-flex items-center justify-center rounded-md border border-border bg-background p-2 text-foreground md:hidden"
      >
        {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-[240px] border-r border-sidebar-border bg-sidebar transition-transform duration-200 md:relative md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-sidebar-border px-5 py-5">
            <Link href="/" className="block">
              <p className="text-label">Lumion</p>
              <p className="font-display text-2xl font-normal tracking-tight text-foreground">HRIS</p>
            </Link>
          </div>

          <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
            {navigation.map((section) => (
              <div key={section.label} className="space-y-1">
                <p className="px-3 pb-1 text-label">{section.label}</p>
                {section.items.map((item) => {
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'block rounded-md border-l-2 px-3 py-2 text-sm transition-colors duration-150',
                        isActive
                          ? 'border-l-foreground bg-sidebar-active pl-[10px] font-medium text-sidebar-foreground'
                          : 'border-l-transparent text-muted-foreground hover:bg-sidebar-active hover:text-foreground'
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="space-y-3 border-t border-sidebar-border px-5 py-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-muted-foreground">{user?.email || 'Signed in'}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/90">{user?.role || 'EMPLOYEE'}</p>
            </div>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-sidebar-active hover:text-foreground"
            >
              Settings
            </Link>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.assign('/sign-in');
              }}
              className="w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors duration-150 hover:bg-sidebar-active hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
