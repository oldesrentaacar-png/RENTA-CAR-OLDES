"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { deleteIncomeTransaction } from "@/app/dashboard/ingresos/actions";
import { Button } from "@/components/ui/button";

type IncomeRowActionsProps = {
  incomeId: string;
  canEdit: boolean;
  canDelete: boolean;
  linkedToReceipt?: boolean;
};

export function IncomeRowActions({
  incomeId,
  canEdit,
  canDelete,
  linkedToReceipt = false,
}: IncomeRowActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!canEdit && !canDelete) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
      <div className="flex gap-1">
        {canEdit ? (
          <Link href={`/dashboard/ingresos/${incomeId}/edit`}>
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
              if (linkedToReceipt) {
                setError(
                  "Está ligado a un recibo. Anule el recibo en Recibos.",
                );
                return;
              }
              if (!confirm("¿Eliminar este ingreso?\n\nSe ocultará del listado (soft-delete).")) {
                return;
              }
              setPending(true);
              setError(null);
              const result = await deleteIncomeTransaction(incomeId);
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
