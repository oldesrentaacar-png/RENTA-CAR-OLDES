"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  acceptQuote,
  deleteQuote,
  getQuoteWhatsAppLink,
  sendQuoteEmail,
  updateQuoteStatus,
} from "@/app/dashboard/cotizaciones/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { Button } from "@/components/ui/button";
import type { Quote } from "@/types/database";

export function QuoteDetailActions({ quote }: { quote: Quote }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleStatus(status: Quote["status"]) {
    const result = await updateQuoteStatus(quote.id, status);
    if (!result.success) setError(result.error);
    else router.refresh();
  }

  async function handleDelete() {
    const ok = window.confirm(
      `¿Borrar la cotización ${quote.code}? Esta acción la oculta del listado (no se puede deshacer desde la app).`,
    );
    if (!ok) return;
    setDeleting(true);
    setError(null);
    const result = await deleteQuote(quote.id);
    setDeleting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push("/dashboard/cotizaciones");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <PermissionGuard permission="quotes.delete" fallback={null}>
          <Link
            href={`/dashboard/cotizaciones/${quote.id}/editar`}
            className="inline-flex items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            Editar
          </Link>
        </PermissionGuard>

        <PermissionGuard permission="quotes.delete" fallback={null}>
          <Button
            type="button"
            variant="danger"
            disabled={deleting}
            onClick={() => void handleDelete()}
          >
            {deleting ? "Borrando…" : "Borrar"}
          </Button>
        </PermissionGuard>

        {quote.status === "DRAFT" ? (
          <Button type="button" variant="secondary" onClick={() => handleStatus("SENT")}>
            Marcar enviada
          </Button>
        ) : null}
        {quote.status !== "REJECTED" && quote.status !== "ACCEPTED" ? (
          <Button type="button" variant="danger" onClick={() => handleStatus("REJECTED")}>
            Rechazar
          </Button>
        ) : null}
        {quote.status !== "ACCEPTED" ? (
          <Button
            type="button"
            onClick={async () => {
              const result = await acceptQuote(quote.id);
              if (!result.success) setError(result.error);
              else {
                setMessage("Cotización aceptada. Cree la reserva manualmente cuando corresponda.");
                router.refresh();
              }
            }}
          >
            Aceptar cotización
          </Button>
        ) : (
          <Link
            href={`/dashboard/reservas/nuevo?quoteId=${quote.id}`}
            className="inline-flex items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Crear reserva manualmente
          </Link>
        )}
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            const result = await sendQuoteEmail(quote.id);
            if (!result.success) setError(result.error);
            else setMessage(result.data.message);
            router.refresh();
          }}
        >
          Enviar correo
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            const result = await getQuoteWhatsAppLink(quote.id);
            if (!result.success) setError(result.error);
            else window.open(result.data.url, "_blank");
          }}
        >
          WhatsApp
        </Button>
        <Link
          href={`/api/quotes/${quote.id}/pdf`}
          target="_blank"
          className="inline-flex items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          Ver PDF
        </Link>
      </div>
    </div>
  );
}
