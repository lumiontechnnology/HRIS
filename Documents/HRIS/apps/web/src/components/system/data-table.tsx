'use client';

import { Button, Input } from '@lumion/ui';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { EmptyState } from './primitives';

export interface ColumnDef<T extends { id: string }> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T extends { id: string }> {
  rows: T[];
  columns: ColumnDef<T>[];
  searchKeys: Array<keyof T>;
  searchPlaceholder?: string;
  pageSize?: number;
  emptyTitle: string;
  emptyDescription: string;
  onRowClick?: (row: T) => void;
}

type SortDirection = 'asc' | 'desc';

function getComparableValue(value: unknown): string | number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value.toLowerCase();
  if (value instanceof Date) return value.getTime();
  return String(value ?? '').toLowerCase();
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  searchKeys,
  searchPlaceholder = 'Search...',
  pageSize = 10,
  emptyTitle,
  emptyDescription,
  onRowClick,
}: DataTableProps<T>): JSX.Element {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;

    return rows.filter((row) =>
      searchKeys.some((key) => String(row[key] ?? '').toLowerCase().includes(normalized))
    );
  }, [query, rows, searchKeys]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return filteredRows;
    const sorted = [...filteredRows].sort((a, b) => {
      const left = getComparableValue(a[sortKey]);
      const right = getComparableValue(b[sortKey]);

      if (left < right) return sortDirection === 'asc' ? -1 : 1;
      if (left > right) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredRows, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = sortedRows.slice(start, start + pageSize);

  const setSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          className="pl-9"
          placeholder={searchPlaceholder}
        />
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              {columns.map((column) => (
                <th key={String(column.key)} className="px-4 py-3 font-semibold">
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => setSort(column.key)}
                      className="inline-flex items-center gap-1"
                    >
                      {column.label}
                      {sortKey === column.key ? (
                        sortDirection === 'asc' ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )
                      ) : null}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? 'cursor-pointer border-t border-slate-100 hover:bg-slate-50' : 'border-t border-slate-100'}
              >
                {columns.map((column) => (
                  <td key={String(column.key)} className="px-4 py-3 text-slate-800">
                    {column.render ? column.render(row) : String(row[column.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedRows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Showing {pageRows.length} of {sortedRows.length} results
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={safePage === 1}
          >
            Previous
          </Button>
          <span className="text-xs text-slate-600">
            Page {safePage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={safePage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
