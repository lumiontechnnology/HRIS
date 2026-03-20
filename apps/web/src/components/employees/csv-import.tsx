'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@lumion/ui';
import { useCurrentUser } from '@/lib/client-auth';

interface CsvImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  success: boolean;
  created?: number;
  errors?: string[];
}

function parsePreviewRows(fileText: string): Array<Record<string, string>> {
  const lines = fileText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) return [];

  const headers = lines[0].split(',').map((item) => item.trim());
  return lines.slice(1, 6).map((line) => {
    const values = line.split(',').map((item) => item.trim().replace(/^"|"$/g, ''));    return headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = values[index] || '';
      return acc;
    }, {});
  });
}

function toErrorCsv(errors: ValidationError[]): string {
  const header = 'row,field,error';
  const rows = errors.map((item) => `${item.row},${item.field},"${item.message.replace(/"/g, '""')}"`);
  return [header, ...rows].join('\n');
}

export function CsvImportDialog({ open, onOpenChange, onImported }: CsvImportProps): JSX.Element {
  const { user } = useCurrentUser();
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<Array<Record<string, string>>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);

  const firstColumns = useMemo(() => {
    const first = previewRows[0];
    if (!first) return [];
    return Object.keys(first).slice(0, 6);
  }, [previewRows]);

  const handleFileChange = async (nextFile: File | null) => {
    setFile(nextFile);
    setValidationErrors([]);
    setResult(null);

    if (!nextFile) {
      setPreviewRows([]);
      return;
    }

    const text = await nextFile.text();
    setPreviewRows(parsePreviewRows(text));
  };

  const startImport = async () => {
    if (!file || !user?.id || !user?.tenantId) return;

    setIsUploading(true);
    setValidationErrors([]);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('csv', file);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/employees/import`, {
        method: 'POST',
        headers: {
          'x-user-id': user.id,
          'x-tenant-id': user.tenantId,
        },
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 422 && Array.isArray(payload.errors)) {
          setValidationErrors(payload.errors as ValidationError[]);
          return;
        }
        throw new Error(payload?.error?.message || payload?.error || 'Import failed');
      }

      setResult(payload as ImportResult);
      if (payload.success) {
        onImported?.();
      }
    } catch (error) {
      setResult({ success: false, errors: [error instanceof Error ? error.message : 'Import failed'] });
    } finally {
      setIsUploading(false);
    }
  };

  const downloadErrors = () => {
    const blob = new Blob([toErrorCsv(validationErrors)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'employee-import-errors.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Employees via CSV</DialogTitle>
          <DialogDescription>
            Download the template, fill in employee records, then upload for validation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border p-4">
            <p className="text-sm text-foreground">1. Download the template file</p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={async () => {
                if (!user?.id || !user?.tenantId) return;
                try {
                  const res = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/employees/template`,
                    { headers: { 'x-user-id': user.id, 'x-tenant-id': user.tenantId } }
                  );
                  if (!res.ok) throw new Error('Download failed');
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'lumion-employees-template.csv';
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  // silently fail – user can retry
                }
              }}
            >
              Download Template CSV
            </Button>
          </div>

          <div className="rounded-md border border-border p-4">
            <p className="mb-3 text-sm text-foreground">2. Upload and validate all rows</p>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </div>

          {previewRows.length > 0 && (
            <div className="rounded-md border border-border p-4">
              <p className="mb-3 text-sm font-medium text-foreground">Preview (first 5 rows)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left">
                      {firstColumns.map((column) => (
                        <th key={column} className="py-2 pr-3">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, index) => (
                      <tr key={index} className="border-b border-border/50">
                        {firstColumns.map((column) => (
                          <td key={column} className="py-2 pr-3 text-muted-foreground">{row[column]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {validationErrors.length > 0 && (
            <div className="rounded-md border border-border p-4">
              <p className="mb-3 text-sm font-medium text-foreground">3. Errors found</p>
              <div className="max-h-56 overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-2 pr-3">Row</th>
                      <th className="py-2 pr-3">Field</th>
                      <th className="py-2 pr-3">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationErrors.map((error, index) => (
                      <tr key={`${error.row}-${error.field}-${index}`} className="border-b border-border/40">
                        <td className="py-2 pr-3 font-mono">{error.row}</td>
                        <td className="py-2 pr-3">{error.field}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{error.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Button onClick={downloadErrors} variant="outline">Download Error Report</Button>
                <Button variant="outline" onClick={() => setValidationErrors([])}>Try Again</Button>
              </div>
            </div>
          )}

          {result?.success && (
            <div className="rounded-md border border-border p-4 text-sm text-foreground">
              <p className="font-medium">3. Success</p>
              <p className="mt-1">{result.created || 0} employees imported successfully.</p>
              <div className="mt-3">
                <Link href="/employees" className="text-sm underline underline-offset-4">
                  View Employees
                </Link>
              </div>
            </div>
          )}

          {!result?.success && result?.errors?.length ? (
            <div className="rounded-md border border-border p-4 text-sm text-destructive">{result.errors.join(', ')}</div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={startImport} disabled={!file || isUploading}>
            {isUploading ? 'Validating rows...' : 'Validate and Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
