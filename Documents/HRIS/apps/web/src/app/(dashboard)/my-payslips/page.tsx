'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@lumion/ui';
import { useCurrentUser } from '@/lib/client-auth';
import { fetchDashboardApi } from '@/lib/dashboard-api';

interface Payslip {
  id: string;
  period: string;
  gross: number;
  deductions: number;
  net: number;
  pdf_url: string;
}

export default function MyPayslipsPage(): JSX.Element {
  const { user } = useCurrentUser();

  const { data } = useQuery({
    queryKey: ['me-payslips', user?.id, user?.tenantId],
    enabled: !!user?.id && !!user?.tenantId,
    queryFn: () => fetchDashboardApi<{ data: Payslip[] }>('/api/v1/me/payslips', user ? { id: user.id, tenantId: user.tenantId } : undefined),
  });

  const payslips = data?.data || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Payslips</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2">Period</th>
                <th className="py-2 text-right">Gross</th>
                <th className="py-2 text-right">Deductions</th>
                <th className="py-2 text-right">Net</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((slip) => (
                <tr key={slip.id} className="border-b border-border/60">
                  <td className="py-3">{slip.period}</td>
                  <td className="py-3 text-right font-mono tabular-nums">NGN {slip.gross.toLocaleString('en-NG')}</td>
                  <td className="py-3 text-right font-mono tabular-nums">NGN {slip.deductions.toLocaleString('en-NG')}</td>
                  <td className="py-3 text-right font-mono tabular-nums">NGN {slip.net.toLocaleString('en-NG')}</td>
                  <td className="py-3 text-right"><a className="text-foreground underline-offset-2 hover:underline" href={slip.pdf_url} target="_blank" rel="noreferrer">Download</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
