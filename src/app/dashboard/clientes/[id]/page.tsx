import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import {
  getCustomer,
  getCustomerRelated,
} from "@/app/dashboard/clientes/actions";
import { DeleteCustomerButton } from "@/components/forms/delete-customer-button";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  getCustomerDisplayName,
  getCustomerTypeLabel,
} from "@/lib/customers";
import { formatAppDate, formatAppDateTime } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import type {
  Contract,
  Customer,
  PaymentReceipt,
  Quote,
  Reservation,
} from "@/types/database";

function EmptyTab({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-8 text-center text-sm text-muted">
        {message}
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <p>
      <span className="text-muted">{label}:</span> {value || "—"}
    </p>
  );
}

function CustomerInfoPanel({ customer }: { customer: Customer }) {
  const isCompany = customer.customer_type === "COMPANY";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Datos generales</CardTitle>
          <StatusBadge status={customer.status} />
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
        {isCompany ? (
          <>
            <InfoRow label="Razón social" value={customer.company_name} />
            <InfoRow label="NIT" value={customer.nit} />
            <InfoRow label="NRC" value={customer.nrc} />
            <InfoRow label="Contacto" value={customer.contact_person} />
            <InfoRow label="Teléfono" value={customer.phone} />
            <InfoRow label="Correo" value={customer.email} />
            <InfoRow label="Quien recibe" value={customer.receiver_name} />
            <InfoRow label="Quien entrega" value={customer.deliverer_name} />
            <p className="sm:col-span-2">
              <span className="text-muted">Dirección:</span>{" "}
              {customer.address ?? "—"}
            </p>
          </>
        ) : (
          <>
            <InfoRow label="Nombre" value={`${customer.first_name} ${customer.last_name}`} />
            <InfoRow label="Teléfono" value={customer.phone} />
            <InfoRow label="WhatsApp" value={customer.whatsapp} />
            <InfoRow label="Correo" value={customer.email} />
            <InfoRow label="DUI" value={customer.dui} />
            <InfoRow label="Pasaporte" value={customer.passport} />
            <InfoRow label="Identificación" value={customer.identification} />
            <InfoRow label="Licencia" value={customer.license_number} />
            <InfoRow
              label="Vence licencia"
              value={
                customer.license_expiry
                  ? formatAppDate(customer.license_expiry)
                  : null
              }
            />
            <InfoRow
              label="Nacimiento"
              value={
                customer.date_of_birth
                  ? formatAppDate(customer.date_of_birth)
                  : null
              }
            />
            <InfoRow label="País" value={customer.country} />
            <InfoRow
              label="Conductor adicional"
              value={customer.additional_driver_name}
            />
            <InfoRow
              label="Licencia adicional"
              value={customer.additional_driver_license}
            />
            <p className="sm:col-span-2">
              <span className="text-muted">Dirección:</span>{" "}
              {customer.address ?? "—"}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function QuotesTab({ quotes }: { quotes: Quote[] }) {
  if (quotes.length === 0) {
    return <EmptyTab message="No hay cotizaciones vinculadas a este cliente." />;
  }

  return (
    <Card>
      <CardContent className="divide-y divide-border p-0">
        {quotes.map((quote) => (
          <Link
            key={quote.id}
            href={`/dashboard/cotizaciones/${quote.id}`}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-surface-muted"
          >
            <div>
              <p className="font-medium">{quote.code}</p>
              <p className="text-muted">
                {formatAppDate(quote.start_at)} – {formatAppDate(quote.end_at)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-medium">{formatMoney(quote.total)}</span>
              <StatusBadge status={quote.status} />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function ReservationsTab({ reservations }: { reservations: Reservation[] }) {
  if (reservations.length === 0) {
    return <EmptyTab message="No hay reservas vinculadas a este cliente." />;
  }

  return (
    <Card>
      <CardContent className="divide-y divide-border p-0">
        {reservations.map((reservation) => (
          <Link
            key={reservation.id}
            href={`/dashboard/reservas/${reservation.id}`}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-surface-muted"
          >
            <div>
              <p className="font-medium">{reservation.code}</p>
              <p className="text-muted">
                {formatAppDate(reservation.start_at)} –{" "}
                {formatAppDate(reservation.end_at)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-medium">{formatMoney(reservation.total)}</span>
              <StatusBadge status={reservation.status} />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function ContractsTab({ contracts }: { contracts: Contract[] }) {
  if (contracts.length === 0) {
    return <EmptyTab message="No hay contratos vinculados a este cliente." />;
  }

  return (
    <Card>
      <CardContent className="divide-y divide-border p-0">
        {contracts.map((contract) => (
          <Link
            key={contract.id}
            href={`/dashboard/contratos/${contract.id}`}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-surface-muted"
          >
            <div>
              <p className="font-medium">{contract.code}</p>
              <p className="text-muted">
                {formatAppDate(contract.start_at)} –{" "}
                {formatAppDate(contract.end_at)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-medium">{formatMoney(contract.total)}</span>
              <StatusBadge status={contract.status} />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function ReceiptsTab({ receipts }: { receipts: PaymentReceipt[] }) {
  if (receipts.length === 0) {
    return (
      <EmptyTab message="No hay abonos o recibos registrados para este cliente." />
    );
  }

  return (
    <Card>
      <CardContent className="divide-y divide-border p-0">
        {receipts.map((receipt) => {
          const href = receipt.contract_id
            ? `/dashboard/contratos/${receipt.contract_id}`
            : receipt.reservation_id
              ? `/dashboard/reservas/${receipt.reservation_id}`
              : null;

          const content = (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{receipt.code}</p>
                <p className="text-muted">
                  {receipt.concept} · {formatAppDateTime(receipt.issued_at)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatMoney(receipt.amount)}</p>
                <p className="text-xs text-muted">{receipt.payment_method}</p>
              </div>
            </div>
          );

          return href ? (
            <Link
              key={receipt.id}
              href={href}
              className="block hover:bg-surface-muted"
            >
              {content}
            </Link>
          ) : (
            <div key={receipt.id}>{content}</div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function NotesDocsTab({ customer }: { customer: Customer }) {
  const hasDocs =
    customer.document_image_url ||
    customer.license_image_url ||
    customer.notes;

  if (!hasDocs) {
    return (
      <EmptyTab message="Sin notas ni documentos registrados para este cliente." />
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4 text-sm">
        {customer.notes ? (
          <div>
            <p className="mb-1 font-medium">Notas</p>
            <p className="whitespace-pre-wrap text-muted">{customer.notes}</p>
          </div>
        ) : null}
        {customer.document_image_url ? (
          <div>
            <p className="mb-1 font-medium">Documento</p>
            <a
              href={customer.document_image_url}
              target="_blank"
              rel="noreferrer"
              className="text-brand hover:underline break-all"
            >
              {customer.document_image_url}
            </a>
          </div>
        ) : null}
        {customer.license_image_url ? (
          <div>
            <p className="mb-1 font-medium">Licencia</p>
            <a
              href={customer.license_image_url}
              target="_blank"
              rel="noreferrer"
              className="text-brand hover:underline break-all"
            >
              {customer.license_image_url}
            </a>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const configured = isSupabaseConfigured();
  const result = configured ? await getCustomer(id) : null;

  if (configured && result && !result.success) {
    notFound();
  }

  const customer = result?.success ? result.data : null;
  const relatedResult =
    configured && customer ? await getCustomerRelated(id) : null;
  const related = relatedResult?.success
    ? relatedResult.data
    : { quotes: [], reservations: [], contracts: [], receipts: [] };

  const displayName = customer ? getCustomerDisplayName(customer) : "Cliente";

  return (
    <PermissionGuard permission="customers.view">
      <div className="space-y-6">
        <PageHeader
          title={displayName}
          description="Perfil 360° del cliente."
          breadcrumbs={[
            { label: "Clientes", href: "/dashboard/clientes" },
            { label: customer ? displayName : "Detalle" },
          ]}
          actions={
            customer ? (
              <div className="flex gap-2">
                <Link
                  href={`/dashboard/clientes/${id}/edit`}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
                >
                  Editar
                </Link>
                <DeleteCustomerButton id={id} />
              </div>
            ) : null
          }
        />

        {!configured ? (
          <SetupBanner />
        ) : customer ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="brand">
                {getCustomerTypeLabel(customer.customer_type)}
              </Badge>
              <StatusBadge status={customer.status} />
              {customer.phone ? (
                <span className="text-sm text-muted">{customer.phone}</span>
              ) : null}
              {customer.email ? (
                <span className="text-sm text-muted">{customer.email}</span>
              ) : null}
            </div>

            <Tabs defaultValue="info">
              <TabsList className="flex h-auto flex-wrap">
                <TabsTrigger value="info">Información</TabsTrigger>
                <TabsTrigger value="quotes">
                  Cotizaciones ({related.quotes.length})
                </TabsTrigger>
                <TabsTrigger value="reservations">
                  Reservas ({related.reservations.length})
                </TabsTrigger>
                <TabsTrigger value="contracts">
                  Contratos ({related.contracts.length})
                </TabsTrigger>
                <TabsTrigger value="receipts">
                  Abonos ({related.receipts.length})
                </TabsTrigger>
                <TabsTrigger value="notes">Notas / Docs</TabsTrigger>
              </TabsList>

              <TabsContent value="info">
                <CustomerInfoPanel customer={customer} />
              </TabsContent>
              <TabsContent value="quotes">
                <QuotesTab quotes={related.quotes} />
              </TabsContent>
              <TabsContent value="reservations">
                <ReservationsTab reservations={related.reservations} />
              </TabsContent>
              <TabsContent value="contracts">
                <ContractsTab contracts={related.contracts} />
              </TabsContent>
              <TabsContent value="receipts">
                <ReceiptsTab receipts={related.receipts} />
              </TabsContent>
              <TabsContent value="notes">
                <NotesDocsTab customer={customer} />
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </div>
    </PermissionGuard>
  );
}
