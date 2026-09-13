"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

import { deleteMonthlySettlement } from "@/app/dashboard/liquidacion/actions";
import {
  deleteVendor,
  deleteVendorLedgerEntry,
} from "@/app/dashboard/proveedores/actions";
import { deletePartnerRental } from "@/app/dashboard/socios/actions";
import { Button } from "@/components/ui/button";

type FinanceDeleteButtonProps = {
  target: "settlement" | "partnerRental" | "vendor" | "vendorLedger";
  id: string;
  vendorId?: string;
  label?: string;
};

export function FinanceDeleteButton(props: FinanceDeleteButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!confirm(props.label ?? "¿Eliminar este registro?")) return;
    setPending(true);
    setError(null);

    let result;
    if (props.target === "settlement") {
      result = await deleteMonthlySettlement(props.id);
    } else if (props.target === "partnerRental") {
      result = await deletePartnerRental(props.id);
    } else if (props.target === "vendor") {
      result = await deleteVendor(props.id);
    } else {
      if (!props.vendorId) {
        setError("Proveedor requerido para eliminar el movimiento.");
        setPending(false);
        return;
      }
      result = await deleteVendorLedgerEntry(props.id, props.vendorId);
    }

    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        title="Eliminar"
        disabled={pending}
        onClick={handleDelete}
      >
        <Trash2 className="h-4 w-4 text-red-600" />
      </Button>
    </div>
  );
}
