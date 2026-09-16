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
import { quotePdfHref } from "@/lib/pdf/pdf-cache";
import type { Quote } from "@/types/database";

export function QuoteDetailActions({ quote }: { quote: Quote }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [openingWhatsApp, setOpeningWhatsApp] = useState(false);

  async function handleStatus(status: Quote["status"]) {
    setError(null);
    setMessage(null);
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
    setMessage(null);
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
        <PermissionGuard permission="quotes.edit" fallback={null}>
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
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleStatus("SENT")}
          >
            Marcar enviada
          </Button>
        ) : null}
        {quote.status !== "REJECTED" && quote.status !== "ACCEPTED" ? (
          <Button
            type="button"
            variant="danger"
            onClick={() => handleStatus("REJECTED")}
          >
            Rechazar
          </Button>
        ) : null}
        {quote.status !== "ACCEPTED" ? (
          <Button
            type="button"
            onClick={async () => {
              setError(null);
              setMessage(null);
              const result = await acceptQuote(quote.id);
              if (!result.success) setError(result.error);
              else {
                setMessage(
                  "Cotización aceptada. Cree la reserva manualmente cuando corresponda.",
                );
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
            Crear reserva desde cotización
          </Link>
        )}
        <PermissionGuard permission="quotes.send" fallback={null}>
          <Button
            type="button"
            variant="secondary"
            disabled={sendingEmail}
            onClick={async () => {
              setSendingEmail(true);
              setError(null);
              setMessage(null);
              const result = await sendQuoteEmail(quote.id);
              setSendingEmail(false);
              if (!result.success) {
                setError(result.error);
                return;
              }
              setMessage(result.data.message);
              router.refresh();
            }}
          >
            {sendingEmail ? "Enviando PDF…" : "Enviar correo"}
          </Button>
        </PermissionGuard>
        <PermissionGuard permission="quotes.send" fallback={null}>
          <Button
            type="button"
            variant="secondary"
            disabled={openingWhatsApp}
            onClick={async () => {
              setOpeningWhatsApp(true);
              setError(null);
              setMessage(null);
              const result = await getQuoteWhatsAppLink(quote.id);
              setOpeningWhatsApp(false);
              if (!result.success) {
                setError(result.error);
                return;
              }
              window.open(result.data.url, "_blank");
            }}
          >
            {openingWhatsApp ? "Preparando…" : "WhatsApp"}
          </Button>
        </PermissionGuard>
        <Link
          href={quotePdfHref(quote.id, quote.updated_at)}
          target="_blank"
          className="inline-flex items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          Ver PDF
        </Link>
      </div>
    </div>
  );
}
