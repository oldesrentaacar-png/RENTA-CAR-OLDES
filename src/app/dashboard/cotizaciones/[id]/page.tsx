import { notFound } from "next/navigation";

import { getQuote } from "@/app/dashboard/cotizaciones/actions";
import { QuoteDetailActions } from "@/app/dashboard/cotizaciones/[id]/quote-actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatAppDate, formatAppDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { isSupabaseConfigured } from "@/lib/env";

export default async function CotizacionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const configured = isSupabaseConfigured();
  const result = configured ? await getQuote(id) : null;

  if (configured && result && !result.success) notFound();
  const quote = result?.success ? result.data : null;

  return (
    <PermissionGuard permission="quotes.view">
      <div className="space-y-6">
        <PageHeader
          title={quote ? `Cotización ${quote.code}` : "Cotización"}
          breadcrumbs={[
            { label: "Cotizaciones", href: "/dashboard/cotizaciones" },
            { label: quote?.code ?? "Detalle" },
          ]}
        />

        {!configured ? (
          <SetupBanner />
        ) : quote ? (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Resumen</CardTitle>
                  <StatusBadge status={quote.status} />
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-muted">Idioma:</span>{" "}
                  {quote.language === "en" ? "English" : "Español"}
                </p>
                <p><span className="text-muted">Periodo:</span> {formatAppDateTime(quote.start_at)} – {formatAppDateTime(quote.end_at)}</p>
                <p><span className="text-muted">Días:</span> {quote.rental_days}</p>
                <p><span className="text-muted">Tarifa/día:</span> {formatMoney(quote.daily_rate)}</p>
                <p><span className="text-muted">Subtotal:</span> {formatMoney(quote.subtotal)}</p>
                <p><span className="text-muted">Seguro:</span> {formatMoney(quote.insurance_amount)}</p>
                <p><span className="text-muted">Depósito:</span> {formatMoney(quote.deposit_amount)}</p>
                <p><span className="text-muted">Impuesto:</span> {formatMoney(quote.tax_amount)}</p>
                <p className="font-semibold"><span className="text-muted">Total:</span> {formatMoney(quote.total)}</p>
                {quote.valid_until ? (
                  <p><span className="text-muted">Válida hasta:</span> {formatAppDate(quote.valid_until)}</p>
                ) : null}
                {quote.notes ? (
                  <p className="sm:col-span-2"><span className="text-muted">Notas:</span> {quote.notes}</p>
                ) : null}
              </CardContent>
            </Card>
            <QuoteDetailActions quote={quote} />
          </>
        ) : null}
      </div>
    </PermissionGuard>
  );
}
