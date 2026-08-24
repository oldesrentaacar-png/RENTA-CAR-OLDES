"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  createExpenseTransaction,
  updateExpenseTransaction,
} from "@/app/dashboard/gastos/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/labels";
import type { ExpenseTransaction } from "@/types/database";

type ExpenseFormProps = {
  expense?: ExpenseTransaction;
  vehicles: Array<{ id: string; label: string }>;
  redirectTo?: string;
};

const EXPENSE_CATEGORIES = Object.entries(EXPENSE_CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export function ExpenseForm({ expense, vehicles, redirectTo }: ExpenseFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = expense
      ? await updateExpenseTransaction(expense.id, formData)
      : await createExpenseTransaction(formData);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push(redirectTo ?? "/dashboard/gastos");
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
        <Input
          name="concept"
          label="Concepto *"
          defaultValue={expense?.concept}
          required
          className="sm:col-span-2"
        />
        <Select
          name="category"
          label="Categoría *"
          defaultValue={expense?.category ?? "OTHER"}
          options={EXPENSE_CATEGORIES}
          required
        />
        <Input
          name="amount"
          label="Monto *"
          type="number"
          step="0.01"
          min="0"
          defaultValue={expense?.amount}
          required
        />
        <Input
          name="expenseDate"
          label="Fecha *"
          type="date"
          defaultValue={expense?.expense_date ?? today}
          required
        />
        <Select
          name="vehicleId"
          label="Vehículo"
          defaultValue={expense?.vehicle_id ?? ""}
          options={[
            { value: "", label: "Ninguno" },
            ...vehicles.map((v) => ({ value: v.id, label: v.label })),
          ]}
        />
        <Input
          name="provider"
          label="Proveedor"
          defaultValue={expense?.provider ?? ""}
        />
        <Input
          name="receiptPath"
          label="Recibo / comprobante (URL o ruta)"
          defaultValue={expense?.receipt_path ?? ""}
          placeholder="https://… o /uploads/recibo.jpg"
          className="sm:col-span-2"
        />
      </div>

      <Textarea
        name="notes"
        label="Notas"
        rows={3}
        defaultValue={expense?.notes ?? ""}
      />

      <div className="flex gap-3">
        <SubmitButton>{expense ? "Guardar cambios" : "Registrar gasto"}</SubmitButton>
        <Link
          href="/dashboard/gastos"
          className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-muted"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
