"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  acceptQuote,
  deleteQuote,
  getQuoteShareDefaults,
  getQuoteWhatsAppLink,
  sendQuoteEmail,
  updateQuoteStatus,
} from "@/app/dashboard/cotizaciones/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { quotePdfHref } from "@/lib/pdf/pdf-cache";
import type { Quote } from "@/types/database";

async function downloadPdfFile(pdfUrl: string, filename: string): Promise<File> {
  const response = await fetch(pdfUrl, {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `No se pudo descargar el PDF de la cotización (${response.status}).`,
    );
  }
  const blob = await response.blob();
  if (!blob.size) {
    throw new Error("El PDF descargado está vacío.");
  }
  return new File([blob], filename, { type: "application/pdf" });
}

function triggerBrowserDownload(file: File) {
  const objectUrl = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = file.name;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}

export function QuoteDetailActions({ quote }: { quote: Quote }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [openingWhatsApp, setOpeningWhatsApp] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailHint, setEmailHint] = useState<string | null>(null);

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

  async function openEmailDialog() {
    setError(null);
    setMessage(null);
    setEmailHint(null);
    setEmailDialogOpen(true);
    const defaults = await getQuoteShareDefaults(quote.id);
    if (defaults.success) {
      setEmailTo(defaults.data.customerEmail);
      setEmailHint(
        defaults.data.customerEmail
          ? `Sugerido: correo de ${defaults.data.customerName}`
          : "Escriba el correo al que desea enviar el PDF.",
      );
    } else {
      setEmailTo("");
      setEmailHint("Escriba el correo al que desea enviar el PDF.");
    }
  }

  async function confirmSendEmail() {
    setSendingEmail(true);
    setError(null);
    setMessage(null);
    const result = await sendQuoteEmail(quote.id, emailTo);
    setSendingEmail(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setEmailDialogOpen(false);
    setMessage(result.data.message);
    router.refresh();
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    setError(null);
    setMessage(null);
    try {
      const filename = `cotizacion-${quote.code}.pdf`;
      const pdfHref = quotePdfHref(quote.id, quote.updated_at);
      const pdfFile = await downloadPdfFile(pdfHref, filename);
      triggerBrowserDownload(pdfFile);
      setMessage(`PDF descargado: ${filename}`);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "No se pudo descargar el PDF. Revise su conexión e intente de nuevo.",
      );
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function handleWhatsAppMessage() {
    setOpeningWhatsApp(true);
    setError(null);
    setMessage(null);
    try {
      const result = await getQuoteWhatsAppLink(
        quote.id,
        window.location.origin,
      );
      if (!result.success) {
        setError(result.error);
        return;
      }
      window.open(result.data.url, "_blank", "noopener,noreferrer");
      setMessage(
        "WhatsApp abierto con el mensaje de texto. Si necesita el PDF, use Descargar y adjúntelo con el clip 📎.",
      );
      router.refresh();
    } finally {
      setOpeningWhatsApp(false);
    }
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
          <PermissionGuard permission="quotes.edit" fallback={null}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleStatus("SENT")}
            >
              Marcar enviada
            </Button>
          </PermissionGuard>
        ) : null}
        {quote.status !== "REJECTED" && quote.status !== "ACCEPTED" ? (
          <PermissionGuard permission="quotes.edit" fallback={null}>
            <Button
              type="button"
              variant="danger"
              onClick={() => handleStatus("REJECTED")}
            >
              Rechazar
            </Button>
          </PermissionGuard>
        ) : null}
        {quote.status !== "ACCEPTED" ? (
          <PermissionGuard permission="quotes.accept" fallback={null}>
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
          </PermissionGuard>
        ) : (
          <PermissionGuard permission="reservations.create" fallback={null}>
            <Link
              href={`/dashboard/reservas/nuevo?quoteId=${quote.id}`}
              className="inline-flex items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Crear reserva desde cotización
            </Link>
          </PermissionGuard>
        )}
        <PermissionGuard permission="quotes.send" fallback={null}>
          <Button
            type="button"
            variant="secondary"
            disabled={sendingEmail}
            onClick={() => void openEmailDialog()}
          >
            Enviar correo
          </Button>
        </PermissionGuard>
        <PermissionGuard permission="quotes.send" fallback={null}>
          <Button
            type="button"
            variant="secondary"
            disabled={downloadingPdf}
            onClick={() => void handleDownloadPdf()}
          >
            {downloadingPdf ? "Descargando…" : "Descargar"}
          </Button>
        </PermissionGuard>
        <PermissionGuard permission="quotes.send" fallback={null}>
          <Button
            type="button"
            variant="secondary"
            disabled={openingWhatsApp}
            onClick={() => void handleWhatsAppMessage()}
          >
            {openingWhatsApp ? "Abriendo…" : "Enviar mensaje"}
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

      <Dialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        title="Enviar cotización por correo"
        description="Escriba el correo al que desea enviar el PDF. Puede usar el del cliente o el suyo."
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Correo destinatario"
            type="email"
            autoComplete="email"
            placeholder="correo@ejemplo.com"
            value={emailTo}
            onChange={(event) => setEmailTo(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void confirmSendEmail();
              }
            }}
          />
          {emailHint ? (
            <p className="text-xs text-muted">{emailHint}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEmailDialogOpen(false)}
              disabled={sendingEmail}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={sendingEmail || !emailTo.trim()}
              onClick={() => void confirmSendEmail()}
            >
              {sendingEmail ? "Enviando PDF…" : "Enviar PDF"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
