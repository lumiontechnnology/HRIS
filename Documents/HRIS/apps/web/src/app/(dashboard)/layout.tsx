import { DashboardLayout } from '@/components/layout/dashboard-layout';

export const metadata = {
  title: 'Dashboard | Lumion HRIS',
};

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return <DashboardLayout>{children}</DashboardLayout>;
}
