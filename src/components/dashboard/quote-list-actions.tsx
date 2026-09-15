"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteQuote } from "@/app/dashboard/cotizaciones/actions";
import { usePermissions } from "@/components/auth/permission-provider";
import { Button } from "@/components/ui/button";

export function QuoteListActions({
  quoteId,
  quoteCode,
}: {
  quoteId: string;
  quoteCode: string;
}) {
  const router = useRouter();
  const { has } = usePermissions();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canEdit = has("quotes.edit");
  const canDelete = has("quotes.delete");

  if (!canEdit && !canDelete) return null;

  function handleDelete() {
    const ok = window.confirm(
      `¿Borrar la cotización ${quoteCode}?\n\nSe ocultará del listado (soft-delete).`,
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteQuote(quoteId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        {canEdit ? (
          <Link
            href={`/dashboard/cotizaciones/${quoteId}/editar`}
            className="inline-flex min-h-9 items-center rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50"
          >
            Editar
          </Link>
        ) : null}
        {canDelete ? (
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={pending}
            onClick={handleDelete}
          >
            {pending ? "Borrando…" : "Borrar"}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="max-w-[16rem] text-right text-xs text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
