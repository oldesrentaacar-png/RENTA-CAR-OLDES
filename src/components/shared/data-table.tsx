import type { ReactNode } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  mobileLabel?: string;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  className?: string;
};

export function DataTable<T>({
  columns,
  data,
  loading,
  emptyTitle = "Sin registros",
  emptyDescription = "No hay datos para mostrar en este momento.",
  getRowKey,
  onRowClick,
  className,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} />
    );
  }

  return (
    <>
      <div className={cn("hidden overflow-x-auto rounded-xl border border-border md:block", className)}>
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted/80">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted",
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-border last:border-0 bg-surface transition-colors",
                  onRowClick && "cursor-pointer hover:bg-surface-muted/60",
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn("px-4 py-3 text-foreground", column.className)}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={cn("space-y-3 md:hidden", className)}>
        {data.map((row) => (
          <div
            key={getRowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(
              "rounded-xl border border-border bg-surface p-4 shadow-sm",
              onRowClick && "cursor-pointer active:bg-surface-muted",
            )}
          >
            <dl className="space-y-2">
              {columns.map((column) => (
                <div key={column.key} className="flex justify-between gap-3 text-sm">
                  <dt className="text-muted">
                    {column.mobileLabel ?? column.header}
                  </dt>
                  <dd className="text-right font-medium text-foreground">
                    {column.cell(row)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}
