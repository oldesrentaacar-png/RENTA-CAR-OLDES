"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { deleteExpenseTransaction } from "@/app/dashboard/gastos/actions";
import { Button } from "@/components/ui/button";

type ExpenseRowActionsProps = {
  expenseId: string;
  canEdit: boolean;
  canDelete: boolean;
};

export function ExpenseRowActions({
  expenseId,
  canEdit,
  canDelete,
}: ExpenseRowActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!canEdit && !canDelete) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
      <div className="flex gap-1">
        {canEdit ? (
          <Link href={`/dashboard/gastos/${expenseId}/edit`}>
            <Button type="button" variant="outline" size="sm" title="Editar">
              <Pencil className="h-4 w-4" />
            </Button>
          </Link>
        ) : null}
        {canDelete ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            title="Eliminar"
            disabled={pending}
            onClick={async () => {
              if (!confirm("¿Eliminar este gasto?")) return;
              setPending(true);
              setError(null);
              const result = await deleteExpenseTransaction(expenseId);
              setPending(false);
              if (!result.success) {
                setError(result.error);
                return;
              }
              router.refresh();
            }}
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
