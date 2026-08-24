"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteCustomer } from "@/app/dashboard/clientes/actions";
import { Button } from "@/components/ui/button";

export function DeleteCustomerButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!confirm("¿Eliminar este cliente?")) return;
    setPending(true);
    const result = await deleteCustomer(id);
    setPending(false);
    if (result.success) {
      router.push("/dashboard/clientes");
      router.refresh();
    } else {
      alert(result.error);
    }
  }

  return (
    <Button type="button" variant="danger" disabled={pending} onClick={handleDelete}>
      {pending ? "Eliminando…" : "Eliminar"}
    </Button>
  );
}
