"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  createReservation,
  updateReservation,
} from "@/app/dashboard/reservas/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { PricingBreakdown } from "@/components/shared/pricing-breakdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { calculateReservationTotal } from "@/lib/calculations/quote";
import { toDatetimeLocalValue } from "@/lib/dates";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import type { Reservation } from "@/types/database";

type VehicleOption = {
  id: string;
  label: string;
  primary?: string;
  secondary?: string;
  searchText?: string;
  dailyRate: number;
  deposit: number;
  category?: string | null;
};

export type ReservationQuoteLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

type ReservationFormProps = {
  customers: Array<{ id: string; label: string; searchText?: string }>;
  vehicles: VehicleOption[];
  reservation?: Reservation;
  canManageCourtesy?: boolean;
  defaults?: {
    customerId?: string;
    vehicleId?: string;
    quoteId?: string;
    quoteCode?: string;
    startAt?: string;
    endAt?: string;
    agreedRate?: number;
    deposit?: number;
    cashAmount?: number;
    cardAmount?: number;
    additionalCosts?: number;
    vehicleType?: string;
    total?: number;
    pickupLocation?: string;
    returnLocation?: string;
    notes?: string;
    quoteExtraLines?: ReservationQuoteLine[];
  };
};

export function ReservationForm({
  customers,
  vehicles,
  reservation,
  canManageCourtesy = false,
  defaults,
}: ReservationFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(reservation);
  const fromQuote = Boolean(defaults?.quoteId && !isEdit);

  const initialVehicleId =
    reservation?.vehicle_id ?? defaults?.vehicleId ?? "";
  const initialVehicle = vehicles.find((v) => v.id === initialVehicleId);

  const [startAt, setStartAt] = useState(
    reservation
      ? toDatetimeLocalValue(reservation.start_at)
      : defaults?.startAt
        ? toDatetimeLocalValue(defaults.startAt)
        : "",
  );
  const [endAt, setEndAt] = useState(
    reservation
      ? toDatetimeLocalValue(reservation.end_at)
      : defaults?.endAt
        ? toDatetimeLocalValue(defaults.endAt)
        : "",
  );
  const [agreedRate, setAgreedRate] = useState(
    String(
      reservation?.agreed_rate ??
        defaults?.agreedRate ??
        initialVehicle?.dailyRate ??
        "",
    ),
  );
  const [deposit, setDeposit] = useState(
    String(
      reservation?.deposit ??
        defaults?.deposit ??
        initialVehicle?.deposit ??
        0,
    ),
  );
  const [vehicleType, setVehicleType] = useState(
    reservation?.vehicle_type ??
      defaults?.vehicleType ??
      initialVehicle?.category ??
      "",
  );
  const [cashAmount, setCashAmount] = useState(
    String(
      reservation?.cash_amount ??
        defaults?.cashAmount ??
        defaults?.total ??
        "",
    ),
  );
  const [cardAmount, setCardAmount] = useState(
    String(reservation?.card_amount ?? defaults?.cardAmount ?? 0),
  );
  const [insurance, setInsurance] = useState(
    String(reservation?.insurance ?? 0),
  );
  const initialExtraLines = (() => {
    const fromReservation = (reservation?.extra_line_items ?? []).filter(
      (line) => line.label && line.amount > 0,
    );
    if (fromReservation.length > 0) {
      return fromReservation.map((line) => ({
        label: line.label,
        amount: String(line.amount),
      }));
    }
    const fromQuote = defaults?.quoteExtraLines ?? [];
    if (fromQuote.length > 0) {
      return fromQuote.map((line) => ({
        label: line.description,
        amount: String(line.amount),
      }));
    }
    const lump = Number(
      reservation?.additional_costs ?? defaults?.additionalCosts ?? 0,
    );
    if (lump > 0) {
      return [{ label: "Costos adicionales", amount: String(lump) }];
    }
    return [{ label: "", amount: "" }];
  })();
  const [extraLines, setExtraLines] = useState(initialExtraLines);
  const additionalCosts = String(
    extraLines.reduce((sum, line) => {
      const amount = Number(parseMoneyInput(line.amount || "0"));
      return sum + (line.label.trim() && amount > 0 ? amount : 0);
    }, 0),
  );
  const [courtesyAmount, setCourtesyAmount] = useState(
    String(reservation?.courtesy_amount ?? 0),
  );
  const [courtesyDetail, setCourtesyDetail] = useState(
    reservation?.courtesy_detail ?? "",
  );
  const [applyIva, setApplyIva] = useState(
    Boolean(reservation?.apply_iva),
  );
  const taxRate = 0.13;

  const quoteExtraLines = extraLines
    .map((line) => {
      const amount = parseMoneyInput(line.amount || "0");
      const label = line.label.trim();
      if (!label || amount <= 0) return null;
      return {
        description: label,
        quantity: 1,
        unitPrice: amount,
        amount,
      };
    })
    .filter(Boolean) as ReservationQuoteLine[];

  const preview = useMemo(() => {
    if (!startAt || !endAt || agreedRate === "") return null;
    try {
      const base = calculateReservationTotal({
        startAt,
        endAt,
        agreedRate: parseMoneyInput(agreedRate),
        insurance: parseMoneyInput(insurance || 0),
        additionalCosts: parseMoneyInput(additionalCosts || 0),
        courtesyAmount: canManageCourtesy
          ? parseMoneyInput(courtesyAmount || 0)
          : 0,
      });
      const taxAmount = applyIva
        ? Math.round(base.total * taxRate * 100) / 100
        : 0;
      return {
        ...base,
        pretaxTotal: base.total,
        taxAmount,
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
    applyIva,
  ]);

  const extrasAmount = parseMoneyInput(additionalCosts || 0);
  const linesSum = quoteExtraLines.reduce((sum, line) => sum + line.amount, 0);
  const adjustment = Math.round((extrasAmount - linesSum) * 100) / 100;

  function updateExtraLine(
    index: number,
    patch: Partial<{ label: string; amount: string }>,
  ) {
    setExtraLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    const computed = preview
      ? preview
      : (() => {
          const base = calculateReservationTotal({
            startAt,
            endAt,
            agreedRate: parseMoneyInput(agreedRate),
            insurance: parseMoneyInput(insurance || 0),
            additionalCosts: parseMoneyInput(additionalCosts || 0),
            courtesyAmount: canManageCourtesy
              ? parseMoneyInput(courtesyAmount || 0)
              : 0,
          });
          const taxAmount = applyIva
            ? Math.round(base.total * taxRate * 100) / 100
            : 0;
          return {
            ...base,
            pretaxTotal: base.total,
            taxAmount,
            totalWithIva: Math.round((base.total + taxAmount) * 100) / 100,
          };
        })();

    formData.set("total", String(computed.totalWithIva));
    formData.set("agreedRate", String(parseMoneyInput(agreedRate)));
    formData.set("deposit", String(parseMoneyInput(deposit)));
    formData.set("insurance", String(parseMoneyInput(insurance || 0)));
    formData.set("cashAmount", String(parseMoneyInput(cashAmount || 0)));
    formData.set("cardAmount", String(parseMoneyInput(cardAmount || 0)));
    formData.set(
      "additionalCosts",
      String(parseMoneyInput(additionalCosts || 0)),
    );
    formData.set(
      "extraLineItems",
      JSON.stringify(
        extraLines
          .map((line) => ({
            label: line.label.trim(),
            amount: parseMoneyInput(line.amount || "0"),
          }))
          .filter((line) => line.label && line.amount > 0),
      ),
    );
    if (canManageCourtesy) {
      formData.set(
        "courtesyAmount",
        String(parseMoneyInput(courtesyAmount || 0)),
      );
      formData.set("courtesyDetail", courtesyDetail.trim());
    }
    formData.set("applyIva", applyIva ? "true" : "false");
    formData.set("taxRate", "13");
    formData.set("taxAmount", String(computed.taxAmount));

    const result = isEdit
      ? await updateReservation(reservation!.id, formData)
      : await createReservation(formData);

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.push(`/dashboard/reservas/${result.data.id}`);
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {fromQuote ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950">
          Datos heredados de la cotización{" "}
          <strong>{defaults?.quoteCode ?? ""}</strong>. Complete o ajuste{" "}
          <strong>Seguro</strong>, <strong>Costos adicionales</strong> e{" "}
          <strong>IVA</strong> si aplica. El total se recalcula solo.
        </div>
      ) : (
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-950">
          <strong>No requiere cotización.</strong> Capture tarifa,{" "}
          <strong>Seguro</strong> (si se cobra aparte),{" "}
          <strong>Costos adicionales</strong> (silla, entrega, etc.) e{" "}
          <strong>IVA</strong> opcional. El depósito es garantía y no suma al
          total.
        </div>
      )}

      {defaults?.quoteId && !isEdit ? (
        <input type="hidden" name="quoteId" value={defaults.quoteId} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <SearchableSelect
          name="customerId"
          label="Cliente *"
          required
          defaultValue={reservation?.customer_id ?? defaults?.customerId ?? ""}
          placeholder="Seleccionar…"
          searchPlaceholder="Buscar cliente…"
          options={customers.map((c) => ({
            value: c.id,
            label: c.label,
            searchText: c.searchText,
          }))}
        />
        <SearchableSelect
          name="vehicleId"
          label="Vehículo *"
          required
          defaultValue={initialVehicleId}
          placeholder="Seleccionar…"
          searchPlaceholder="Buscar por placa, marca o modelo…"
          onChange={(next) => {
            const v = vehicles.find((item) => item.id === next);
            if (v) {
              // From a quote, keep the quoted rate unless user changes it manually later.
              if (!fromQuote) {
                setAgreedRate(String(v.dailyRate));
                setDeposit(String(v.deposit ?? 0));
              }
              if (v.category) setVehicleType(v.category);
            }
          }}
          options={vehicles.map((v) => ({
            value: v.id,
            label: v.label,
            primary: v.primary,
            secondary: v.secondary,
            searchText: v.searchText,
          }))}
        />
        <Input
          name="vehicleType"
          label="Tipo de vehículo"
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value)}
          placeholder="Ej. Sedán, SUV…"
        />
        {isEdit ? (
          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-700">
              Estado
            </label>
            <select
              name="status"
              defaultValue={reservation?.status}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="CONFIRMED">Confirmada</option>
              <option value="ACTIVE">Activa</option>
              <option value="COMPLETED">Completada</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
          </div>
        ) : null}
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
        <div className="space-y-1">
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
          <p className="text-xs text-muted">
            Monto de seguro cobrado en esta reserva (aparte de la tarifa).
          </p>
        </div>
        <div className="sm:col-span-2 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
          <div>
            <p className="text-sm font-semibold text-zinc-900">
              Cobros extras (con nombre)
            </p>
            <p className="mt-1 text-xs text-muted">
              Especifique cada cobro (silla bebé, entrega, GPS…). Estos mismos
              conceptos pasan al contrato (sección 1) y al PDF.
            </p>
          </div>
          <input type="hidden" name="additionalCosts" value={additionalCosts} />
          {extraLines.map((line, index) => (
            <div
              key={`res-extra-${index}`}
              className="grid gap-2 sm:grid-cols-[1fr_140px_auto]"
            >
              <Input
                label={index === 0 ? "Concepto" : undefined}
                value={line.label}
                placeholder="Ej. Silla bebé"
                onChange={(e) =>
                  updateExtraLine(index, { label: e.target.value })
                }
              />
              <Input
                label={index === 0 ? "Monto USD" : undefined}
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={line.amount}
                placeholder="0.00"
                onChange={(e) =>
                  updateExtraLine(index, { amount: e.target.value })
                }
              />
              <Button
                type="button"
                variant="outline"
                className="sm:mt-6"
                onClick={() =>
                  setExtraLines((prev) => {
                    const next = prev.filter((_, i) => i !== index);
                    return next.length > 0 ? next : [{ label: "", amount: "" }];
                  })
                }
              >
                Quitar
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setExtraLines((prev) => [...prev, { label: "", amount: "" }])
              }
            >
              Agregar cobro
            </Button>
            <span className="text-sm text-muted">
              Suma extras: <strong>{formatMoney(parseMoneyInput(additionalCosts || 0))}</strong>
            </span>
          </div>
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
        {canManageCourtesy ? (
          <div className="sm:col-span-2 space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
            <p className="text-sm font-medium text-amber-950">
              Cortesía manual (solo administrador)
            </p>
            <p className="text-xs text-amber-900/80">
              Descuento en USD cuando horas o días extras no cuadran con el
              cobro automático. Indique el monto y el detalle (ej. “2 h de
              retraso”, “1 día extra por cortesía”).
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
              <div className="sm:col-span-1">
                <Textarea
                  name="courtesyDetail"
                  label="Detalle de la cortesía"
                  rows={3}
                  value={courtesyDetail}
                  onChange={(e) => setCourtesyDetail(e.target.value)}
                  placeholder="Ej. 3 h de retraso no cobradas · día extra por lluvia"
                />
              </div>
            </div>
          </div>
        ) : null}
        <div className="sm:col-span-2 space-y-2 rounded-xl border border-border bg-surface p-4">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-zinc-300"
              checked={applyIva}
              onChange={(e) => setApplyIva(e.target.checked)}
            />
            <span>
              <span className="font-medium text-zinc-900">
                Aplicar IVA 13% a esta reserva
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                Si está activo, el total incluye IVA (igual que en contratos).
                Recomendado para clientes empresa.
              </span>
            </span>
          </label>
        </div>
        <Input
          name="pickupLocation"
          label="Lugar recogida"
          defaultValue={
            reservation?.pickup_location ?? defaults?.pickupLocation ?? ""
          }
        />
        <Input
          name="returnLocation"
          label="Lugar devolución"
          defaultValue={
            reservation?.return_location ?? defaults?.returnLocation ?? ""
          }
        />
      </div>

      {preview ? (
        <>
          <input type="hidden" name="total" value={preview.totalWithIva} />
          <PricingBreakdown
            rentalDays={preview.rentalDays}
            dailyRate={parseMoneyInput(agreedRate)}
            subtotal={preview.rentalSubtotal}
            insurance={preview.insurance}
            extras={
              quoteExtraLines.length > 0
                ? Math.max(0, adjustment)
                : preview.additionalCosts
            }
            extrasLabel={
              quoteExtraLines.length > 0
                ? "Otros / ajustes de cotización"
                : "Costos adicionales"
            }
            discount={
              quoteExtraLines.length > 0 && adjustment < 0
                ? Math.abs(adjustment)
                : 0
            }
            courtesy={preview.courtesyAmount}
            courtesyDetail={
              canManageCourtesy ? courtesyDetail.trim() || null : null
            }
            tax={preview.taxAmount}
            deposit={parseMoneyInput(deposit)}
            total={preview.totalWithIva}
            lines={
              quoteExtraLines.length > 0
                ? quoteExtraLines.map((line) => ({
                    description: line.description,
                    amount: line.amount,
                    detail:
                      line.quantity > 1
                        ? `${line.quantity} × ${formatMoney(line.unitPrice)}`
                        : undefined,
                  }))
                : undefined
            }
          />
        </>
      ) : (
        <p className="text-sm text-muted">
          Complete fechas y tarifa para ver el total.
        </p>
      )}

      <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
        <h3 className="text-sm font-semibold text-zinc-900">Forma de pago</h3>
        <p className="text-xs text-amber-800">
          Nota: los pagos con tarjeta tienen un recargo del 10% (informativo).
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            name="cashAmount"
            label="Monto en efectivo (USD)"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={cashAmount}
            onChange={(e) => setCashAmount(e.target.value)}
          />
          <Input
            name="cardAmount"
            label="Monto con tarjeta (USD)"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={cardAmount}
            onChange={(e) => setCardAmount(e.target.value)}
          />
        </div>
      </div>

      <Textarea
        name="notes"
        label="Notas"
        defaultValue={reservation?.notes ?? defaults?.notes ?? ""}
      />
      {!isEdit ? <input type="hidden" name="status" value="CONFIRMED" /> : null}

      <div className="flex gap-3">
        <SubmitButton>
          {isEdit ? "Guardar cambios" : "Crear reserva"}
        </SubmitButton>
        <Link
          href={
            reservation
              ? `/dashboard/reservas/${reservation.id}`
              : "/dashboard/reservas"
          }
          className="inline-flex items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
