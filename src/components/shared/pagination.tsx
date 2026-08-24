"use client";

import Link from "next/link";

type PaginationProps = {
  page: number;
  totalPages: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
};

export function Pagination({
  page,
  totalPages,
  basePath,
  searchParams = {},
}: PaginationProps) {
  if (totalPages <= 1) return null;

  function hrefFor(targetPage: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value);
    }
    params.set("page", String(targetPage));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="flex items-center justify-between gap-4 pt-4">
      <p className="text-sm text-muted">
        Página {page} de {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={hrefFor(page - 1)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-muted"
          >
            Anterior
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link
            href={hrefFor(page + 1)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-muted"
          >
            Siguiente
          </Link>
        ) : null}
      </div>
    </div>
  );
}
