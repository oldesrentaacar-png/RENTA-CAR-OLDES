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
  const [additionalCosts, setAdditionalCosts] = useState(
    String(reservation?.additional_costs ?? defaults?.additionalCosts ?? 0),
  );

  const quoteExtraLines = defaults?.quoteExtraLines ?? [];

  const preview = useMemo(() => {
    if (!startAt || !endAt || agreedRate === "") return null;
    try {
      return calculateReservationTotal({
        startAt,
        endAt,
        agreedRate: parseMoneyInput(agreedRate),
        insurance: 0,
        additionalCosts: parseMoneyInput(additionalCosts || 0),
      });
    } catch {
      return null;
    }
  }, [startAt, endAt, agreedRate, additionalCosts]);

  const extrasAmount = parseMoneyInput(additionalCosts || 0);
  const linesSum = quoteExtraLines.reduce((sum, line) => sum + line.amount, 0);
  const adjustment = Math.round((extrasAmount - linesSum) * 100) / 100;

  async function handleSubmit(formData: FormData) {
    setError(null);
    const computed = preview
      ? preview
      : calculateReservationTotal({
          startAt,
          endAt,
          agreedRate: parseMoneyInput(agreedRate),
          insurance: 0,
          additionalCosts: parseMoneyInput(additionalCosts || 0),
        });

    formData.set("total", String(computed.total));
    formData.set("agreedRate", String(parseMoneyInput(agreedRate)));
    formData.set("deposit", String(parseMoneyInput(deposit)));
    formData.set("insurance", "0");
    formData.set("cashAmount", String(parseMoneyInput(cashAmount || 0)));
    formData.set("cardAmount", String(parseMoneyInput(cardAmount || 0)));
    formData.set(
      "additionalCosts",
      String(parseMoneyInput(additionalCosts || 0)),
    );

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
          <strong>{defaults?.quoteCode ?? ""}</strong>. El total incluye renta +
          extras para que cuadre antes del contrato. El seguro diario no se
          cobra aparte (va incluido en la tarifa); use extras solo para cargos
          reales (silla, entrega fuera de horario, seguro internacional, etc.).
        </div>
      ) : (
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-950">
          Elija vehículo y fechas: la tarifa y el{" "}
          <strong>total se calculan automáticamente</strong> (días × tarifa +
          extras). El seguro diario no aplica: va incluido en el precio.
        </div>
      )}

      {defaults?.quoteId && !isEdit ? (
        <input type="hidden" name="quoteId" value={defaults.quoteId} />
      ) : null}
      <input type="hidden" name="insurance" value="0" />

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
          searchPlaceholder="Buscar vehículo o placa…"
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
            name="additionalCosts"
            label="Extras (USD)"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={additionalCosts}
            onChange={(e) => setAdditionalCosts(e.target.value)}
          />
          <p className="text-xs text-muted">
            Silla, entrega fuera de horario, motorista, seguro internacional,
            etc.
          </p>
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
          <input type="hidden" name="total" value={preview.total} />
          <PricingBreakdown
            rentalDays={preview.rentalDays}
            dailyRate={parseMoneyInput(agreedRate)}
            subtotal={preview.rentalSubtotal}
            insurance={0}
            extras={
              quoteExtraLines.length > 0
                ? Math.max(0, adjustment)
                : preview.additionalCosts
            }
            extrasLabel={
              quoteExtraLines.length > 0
                ? "Otros / ajustes de cotización"
                : "Extras"
            }
            discount={
              quoteExtraLines.length > 0 && adjustment < 0
                ? Math.abs(adjustment)
                : 0
            }
            deposit={parseMoneyInput(deposit)}
            total={preview.total}
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
