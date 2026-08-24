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
import { Textarea } from "@/components/ui/textarea";
import { calculateReservationTotal } from "@/lib/calculations/quote";
import { toDatetimeLocalValue } from "@/lib/dates";
import { parseMoneyInput } from "@/lib/money";
import type { Reservation } from "@/types/database";

type VehicleOption = {
  id: string;
  label: string;
  dailyRate: number;
  deposit: number;
  category?: string | null;
};

type ReservationFormProps = {
  customers: Array<{ id: string; label: string }>;
  vehicles: VehicleOption[];
  reservation?: Reservation;
  defaults?: {
    customerId?: string;
    vehicleId?: string;
    quoteId?: string;
    startAt?: string;
    endAt?: string;
    agreedRate?: number;
    deposit?: number;
    insurance?: number;
    cashAmount?: number;
    cardAmount?: number;
    additionalCosts?: number;
    vehicleType?: string;
    total?: number;
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
  const [insurance, setInsurance] = useState(
    String(reservation?.insurance ?? defaults?.insurance ?? 0),
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

  const preview = useMemo(() => {
    if (!startAt || !endAt || agreedRate === "") return null;
    try {
      return calculateReservationTotal({
        startAt,
        endAt,
        agreedRate: parseMoneyInput(agreedRate),
        insurance: parseMoneyInput(insurance),
      });
    } catch {
      return null;
    }
  }, [startAt, endAt, agreedRate, insurance]);

  async function handleSubmit(formData: FormData) {
    setError(null);
    if (preview) {
      formData.set("total", String(preview.total));
    }
    formData.set("agreedRate", String(parseMoneyInput(agreedRate)));
    formData.set("deposit", String(parseMoneyInput(deposit)));
    formData.set("insurance", String(parseMoneyInput(insurance)));
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

      <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-950">
        Elija vehículo y fechas: la tarifa y el <strong>total se calculan
        automáticamente</strong>. No necesita sumar a mano.
      </div>

      {defaults?.quoteId && !isEdit ? (
        <input type="hidden" name="quoteId" value={defaults.quoteId} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-zinc-700">Cliente *</label>
          <select
            name="customerId"
            required
            defaultValue={reservation?.customer_id ?? defaults?.customerId}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Seleccionar…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-zinc-700">Vehículo *</label>
          <select
            name="vehicleId"
            required
            defaultValue={initialVehicleId}
            onChange={(e) => {
              const v = vehicles.find((item) => item.id === e.target.value);
              if (v) {
                setAgreedRate(String(v.dailyRate));
                setDeposit(String(v.deposit ?? 0));
                if (v.category) setVehicleType(v.category);
              }
            }}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Seleccionar…</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <Input
          name="vehicleType"
          label="Tipo de vehículo"
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value)}
          placeholder="Ej. Sedán, SUV…"
        />
        {isEdit ? (
          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-700">Estado</label>
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
          defaultValue={reservation?.pickup_location ?? ""}
        />
        <Input
          name="returnLocation"
          label="Lugar devolución"
          defaultValue={reservation?.return_location ?? ""}
        />
      </div>

      {preview ? (
        <>
          <input type="hidden" name="total" value={preview.total} />
          <PricingBreakdown
            rentalDays={preview.rentalDays}
            dailyRate={parseMoneyInput(agreedRate)}
            subtotal={preview.rentalSubtotal}
            insurance={preview.insurance}
            deposit={parseMoneyInput(deposit)}
            total={preview.total}
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
        <div className="grid gap-4 sm:grid-cols-3">
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
          <Input
            name="additionalCosts"
            label="Costos adicionales (USD)"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={additionalCosts}
            onChange={(e) => setAdditionalCosts(e.target.value)}
          />
        </div>
      </div>

      <Textarea name="notes" label="Notas" defaultValue={reservation?.notes ?? ""} />
      {!isEdit ? <input type="hidden" name="status" value="CONFIRMED" /> : null}

      <div className="flex gap-3">
        <SubmitButton>{isEdit ? "Guardar cambios" : "Crear reserva"}</SubmitButton>
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
