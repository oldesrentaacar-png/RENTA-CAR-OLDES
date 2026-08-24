"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createIncomeTransaction } from "@/app/dashboard/ingresos/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DEPOSIT_STATUS_LABELS,
  INCOME_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/labels";
import type { IncomeTransaction, IncomeType } from "@/types/database";

type FinanceOptions = {
  vehicles: Array<{ id: string; label: string }>;
  customers: Array<{ id: string; label: string }>;
  reservations: Array<{ id: string; label: string }>;
};

type IncomeFormProps = {
  income?: IncomeTransaction;
  options: FinanceOptions;
  redirectTo?: string;
};

const INCOME_TYPES = Object.entries(INCOME_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const PAYMENT_METHODS = Object.entries(PAYMENT_METHOD_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const DEPOSIT_STATUSES = Object.entries(DEPOSIT_STATUS_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export function IncomeForm({ income, options, redirectTo }: IncomeFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<IncomeType>(income?.type ?? "RENTAL");
  const today = new Date().toISOString().slice(0, 10);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await createIncomeTransaction(formData);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push(redirectTo ?? "/dashboard/ingresos");
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          name="type"
          label="Tipo *"
          value={type}
          onChange={(event) => setType(event.target.value as IncomeType)}
          options={INCOME_TYPES}
          required
        />
        <Input
          name="amount"
          label="Monto *"
          type="number"
          step="0.01"
          min="0"
          defaultValue={income?.amount}
          required
        />
        <Input
          name="transactionDate"
          label="Fecha *"
          type="date"
          defaultValue={income?.transaction_date ?? today}
          required
        />
        <Select
          name="paymentMethod"
          label="Método de pago"
          defaultValue={income?.payment_method ?? "CASH"}
          options={PAYMENT_METHODS}
        />
        {type === "DEPOSIT" ? (
          <Select
            name="depositStatus"
            label="Estado del depósito *"
            defaultValue={income?.deposit_status ?? "RECEIVED"}
            options={[{ value: "", label: "Seleccione…" }, ...DEPOSIT_STATUSES]}
            required
          />
        ) : null}
        <Select
          name="vehicleId"
          label="Vehículo"
          defaultValue={income?.vehicle_id ?? ""}
          options={[
            { value: "", label: "Ninguno" },
            ...options.vehicles.map((v) => ({ value: v.id, label: v.label })),
          ]}
        />
        <Select
          name="customerId"
          label="Cliente"
          defaultValue={income?.customer_id ?? ""}
          options={[
            { value: "", label: "Ninguno" },
            ...options.customers.map((c) => ({ value: c.id, label: c.label })),
          ]}
        />
        <Select
          name="reservationId"
          label="Reserva"
          defaultValue={income?.reservation_id ?? ""}
          options={[
            { value: "", label: "Ninguna" },
            ...options.reservations.map((r) => ({ value: r.id, label: r.label })),
          ]}
        />
        <Input
          name="contractId"
          label="ID contrato (UUID)"
          defaultValue={income?.contract_id ?? ""}
        />
        <Input
          name="reference"
          label="Referencia"
          defaultValue={income?.reference ?? ""}
        />
      </div>

      <Textarea
        name="notes"
        label="Notas"
        rows={3}
        defaultValue={income?.notes ?? ""}
      />

      <div className="flex gap-3">
        <SubmitButton>{income ? "Guardar cambios" : "Registrar ingreso"}</SubmitButton>
        <Link
          href="/dashboard/ingresos"
          className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-muted"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
