"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { createContract } from "@/app/dashboard/contratos/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import {
  BillingExtrasEditor,
  draftsFromExtraItems,
  draftsToExtraItems,
  type BillingCatalogItem,
} from "@/components/shared/billing-extras-editor";
import { PricingBreakdown } from "@/components/shared/pricing-breakdown";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  formatExtraLineDetail,
  sumExtraLineItems,
} from "@/lib/billing/extra-lines";
import { calculateReservationTotal } from "@/lib/calculations/quote";
import { toDatetimeLocalValue } from "@/lib/dates";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import { formatVehicleLabel } from "@/lib/vehicles/label";
import type { Customer, Reservation, Vehicle } from "@/types/database";

type ContractFormProps = {
  reservation: Reservation;
  customer: Customer;
  vehicle: Vehicle;
  defaultTerms?: string | null;
  canManageCourtesy?: boolean;
  catalogItems?: BillingCatalogItem[];
};

export function ContractForm({
  reservation,
  customer,
  vehicle,
  defaultTerms,
  canManageCourtesy = false,
  catalogItems = [],
}: ContractFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [startAt, setStartAt] = useState(toDatetimeLocalValue(reservation.start_at));
  const [endAt, setEndAt] = useState(toDatetimeLocalValue(reservation.end_at));
  const [agreedRate, setAgreedRate] = useState(String(reservation.agreed_rate));
  const [deposit, setDeposit] = useState(String(reservation.deposit ?? 0));
  const [insurance, setInsurance] = useState(String(reservation.insurance ?? 0));
  const [extraLines, setExtraLines] = useState(() => {
    const named = draftsFromExtraItems(reservation.extra_line_items);
    if (named.length > 0) return named;
    const lump = Number(reservation.additional_costs ?? 0);
    if (lump > 0) {
      return draftsFromExtraItems([
        {
          label: "Costos adicionales (desde reserva)",
          amount: lump,
          quantity: 1,
          unitPrice: lump,
        },
      ]);
    }
    return [];
  });
  const namedExtras = draftsToExtraItems(extraLines);
  const additionalCosts = String(sumExtraLineItems(namedExtras));
  const [courtesyAmount, setCourtesyAmount] = useState(
    String(reservation.courtesy_amount ?? 0),
  );
  const [courtesyDetail, setCourtesyDetail] = useState(
    reservation.courtesy_detail ?? "",
  );
  const [applyIva, setApplyIva] = useState(
    Boolean(reservation.apply_iva) || customer.customer_type === "COMPANY",
  );
  const taxRate = 0.13;

  const preview = useMemo(() => {
    if (!startAt || !endAt || agreedRate === "") return null;
    try {
      const base = calculateReservationTotal({
        startAt,
        endAt,
        agreedRate: parseMoneyInput(agreedRate),
        insurance: parseMoneyInput(insurance),
        additionalCosts: parseMoneyInput(additionalCosts || 0),
        courtesyAmount: canManageCourtesy
          ? parseMoneyInput(courtesyAmount || 0)
          : Number(reservation.courtesy_amount ?? 0),
      });
      const taxAmount = applyIva
        ? Math.round(base.total * taxRate * 100) / 100
        : 0;
      return {
        ...base,
        taxAmount,
        pretaxTotal: base.total,
        totalWithIva: Math.round((base.total + taxAmount) * 100) / 100,
      };
    } catch {
      return null;
    }
  }, [
    startAt,
    endAt,
    agreedRate,
    insurance,
    additionalCosts,
    courtesyAmount,
    canManageCourtesy,
    reservation.courtesy_amount,
    applyIva,
  ]);

  async function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("reservationId", reservation.id);
    formData.set("agreedRate", String(parseMoneyInput(agreedRate)));
    formData.set("deposit", String(parseMoneyInput(deposit)));
    formData.set("insurance", String(parseMoneyInput(insurance)));
    formData.set(
      "additionalCosts",
      String(parseMoneyInput(additionalCosts || 0)),
    );
    formData.set("extraLineItems", JSON.stringify(namedExtras));
    if (canManageCourtesy) {
      formData.set(
        "courtesyAmount",
        String(parseMoneyInput(courtesyAmount || 0)),
      );
      formData.set("courtesyDetail", courtesyDetail.trim());
    }
    formData.set("applyIva", applyIva ? "true" : "false");
    formData.set("taxRate", "13");
    if (preview) {
      formData.set("total", String(preview.totalWithIva));
    }

    const result = await createContract(formData);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push(`/dashboard/contratos/${result.data.id}`);
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-surface p-4 text-sm">
        <p><span className="text-muted">Reserva:</span> {reservation.code}</p>
        <p><span className="text-muted">Cliente:</span> {customer.first_name} {customer.last_name}</p>
        <p>
          <span className="text-muted">Vehículo:</span>{" "}
          {formatVehicleLabel(vehicle)}
        </p>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-950">
        Los montos y extras nombrados vienen de la reserva (misma lógica que la
        cotización). Tras crear, ajústelos en la sección 1 del contrato antes de
        firmar.
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 text-sm">
        <p className="font-medium">Flujo de entrega (después de crear)</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
          <li>Cliente, vehículo y cobros (sección 1)</li>
          <li>Inspección de salida</li>
          <li>Accesorios y mapa de daños</li>
          <li>Términos y firma digital</li>
          <li>Abonos</li>
          <li>PDF del contrato</li>
        </ol>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          name="startAt"
          label="Inicio *"
          type="datetime-local"
          value={startAt}
          onChange={(e) => setStartAt(e.target.value)}
          required
        />
        <Input
          name="endAt"
          label="Fin *"
          type="datetime-local"
          value={endAt}
          onChange={(e) => setEndAt(e.target.value)}
          required
        />
        <Input
          name="agreedRate"
          label="Tarifa diaria (USD) *"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={agreedRate}
          onChange={(e) => setAgreedRate(e.target.value)}
          required
        />
        <Input
          name="insurance"
          label="Seguro (USD)"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={insurance}
          onChange={(e) => setInsurance(e.target.value)}
        />
        <div className="sm:col-span-2">
          <BillingExtrasEditor
            catalogItems={catalogItems}
            lines={extraLines}
            onChange={setExtraLines}
            hiddenFieldName="extraLineItems"
            title="Catálogo (extras / servicios)"
            hint="Igual que cotización/reserva: silla, motorista, permiso, seguro internacional… con cantidad. Quedan en sección 1 y PDF."
          />
        </div>
        <Input
          name="deposit"
          label="Depósito / garantía (USD)"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={deposit}
          onChange={(e) => setDeposit(e.target.value)}
        />
      </div>

      {canManageCourtesy ? (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <p className="text-sm font-medium text-amber-950">
            Cortesía manual (solo administrador)
          </p>
          <p className="text-xs text-amber-900/80">
            Descuento en USD por horas o días extras que no cuadran con el
            cobro automático. Incluya el detalle.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="courtesyAmount"
              label="Monto de cortesía / descuento (USD)"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={courtesyAmount}
              onChange={(e) => setCourtesyAmount(e.target.value)}
            />
            <Textarea
              name="courtesyDetail"
              label="Detalle de la cortesía"
              rows={3}
              value={courtesyDetail}
              onChange={(e) => setCourtesyDetail(e.target.value)}
              placeholder="Ej. 2 h de retraso · 1 día extra por cortesía"
            />
          </div>
        </div>
      ) : Number(reservation.courtesy_amount ?? 0) > 0 ? (
        <div className="rounded-xl border border-border bg-surface p-4 text-sm">
          <p>
            <span className="text-muted">Cortesía aplicada:</span>{" "}
            ${Number(reservation.courtesy_amount ?? 0).toFixed(2)}
          </p>
          {reservation.courtesy_detail ? (
            <p className="mt-1 text-xs text-muted">
              {reservation.courtesy_detail}
            </p>
          ) : null}
        </div>
      ) : null}

      {preview ? (
        <>
          <input type="hidden" name="total" value={preview.totalWithIva} />
          <PricingBreakdown
            rentalDays={preview.rentalDays}
            dailyRate={parseMoneyInput(agreedRate)}
            subtotal={preview.rentalSubtotal}
            insurance={preview.insurance}
            extras={namedExtras.length > 0 ? 0 : preview.additionalCosts}
            extrasLabel="Cobros extras"
            courtesy={preview.courtesyAmount}
            courtesyDetail={
              canManageCourtesy
                ? courtesyDetail.trim() || null
                : reservation.courtesy_detail
            }
            tax={preview.taxAmount}
            deposit={parseMoneyInput(deposit)}
            total={preview.totalWithIva}
            lines={
              namedExtras.length > 0
                ? namedExtras.map((line) => ({
                    description: line.label,
                    amount: line.amount,
                    detail: formatExtraLineDetail(line),
                  }))
                : undefined
            }
          />
          {applyIva ? (
            <p className="text-sm text-muted">
              IVA 13%: {preview.taxAmount.toFixed(2)} · Subtotal{" "}
              {preview.pretaxTotal.toFixed(2)} · Total con IVA{" "}
              {preview.totalWithIva.toFixed(2)}
            </p>
          ) : null}
        </>
      ) : null}

      <label className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-sm">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-brand"
          checked={applyIva}
          onChange={(e) => setApplyIva(e.target.checked)}
        />
        <span>
          <strong>Aplicar IVA (13%) en este contrato</strong>
          <span className="mt-1 block text-xs text-muted">
            Opcional. Útil para empresas. Si está marcado, el PDF muestra
            Subtotal + IVA + Total. Por defecto se sugiere para clientes tipo
            empresa.
          </span>
        </span>
      </label>

      <Textarea
        name="terms"
        label="Términos del contrato"
        rows={6}
        defaultValue={defaultTerms ?? ""}
      />
      <Textarea name="clauses" label="Cláusulas adicionales" rows={4} />
      <Textarea name="notes" label="Notas" rows={3} />

      <div className="flex flex-wrap gap-3">
        <SubmitButton>Crear contrato</SubmitButton>
        <Link
          href={`/dashboard/reservas/${reservation.id}`}
          className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-muted"
        >
          Volver a reserva
        </Link>
      </div>
    </form>
  );
}
