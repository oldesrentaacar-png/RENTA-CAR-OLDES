"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  createAccessory,
  deactivateAccessory,
  updateAccessory,
} from "@/app/dashboard/configuracion/accesorios/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AccessoryCatalogItem } from "@/types/database";

type AccessoryCatalogAdminProps = {
  items: AccessoryCatalogItem[];
  tableReady: boolean;
};

export function AccessoryCatalogAdmin({
  items,
  tableReady,
}: AccessoryCatalogAdminProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleCreate(formData: FormData) {
    setError(null);
    const result = await createAccessory(formData);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleUpdate(id: string, formData: FormData) {
    setError(null);
    const result = await updateAccessory(id, formData);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function handleDeactivate(id: string) {
    setError(null);
    const result = await deactivateAccessory(id);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (!tableReady) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        La tabla <code>accessory_catalog</code> aún no está disponible. Aplique
        la migración correspondiente para administrar accesorios.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <form
        action={handleCreate}
        className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <Input name="code" label="Código *" placeholder="SPARE_TIRE" required />
        <Input name="nameEs" label="Nombre ES *" required />
        <Input name="nameEn" label="Nombre EN" />
        <Input name="sortOrder" label="Orden" type="number" defaultValue={0} />
        <div className="flex flex-col justify-end gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked
              className="rounded border-zinc-300"
            />
            Activo
          </label>
          <SubmitButton>Agregar</SubmitButton>
        </div>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-muted">No hay accesorios en el catálogo.</p>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {items.map((item) =>
            editingId === item.id ? (
              <form
                key={item.id}
                action={(fd) => handleUpdate(item.id, fd)}
                className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5"
              >
                <Input name="code" label="Código *" defaultValue={item.code} required />
                <Input
                  name="nameEs"
                  label="Nombre ES *"
                  defaultValue={item.name_es}
                  required
                />
                <Input
                  name="nameEn"
                  label="Nombre EN"
                  defaultValue={item.name_en ?? ""}
                />
                <Input
                  name="sortOrder"
                  label="Orden"
                  type="number"
                  defaultValue={item.sort_order}
                />
                <div className="flex flex-col justify-end gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="isActive"
                      defaultChecked={item.is_active}
                      className="rounded border-zinc-300"
                    />
                    Activo
                  </label>
                  <div className="flex gap-2">
                    <SubmitButton>Guardar</SubmitButton>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEditingId(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {item.name_es}
                    {!item.is_active ? (
                      <span className="ml-2 text-xs text-muted">(inactivo)</span>
                    ) : null}
                  </p>
                  <p className="text-muted">
                    {item.code}
                    {item.name_en ? ` · ${item.name_en}` : ""} · orden{" "}
                    {item.sort_order}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditingId(item.id)}
                  >
                    Editar
                  </Button>
                  {item.is_active ? (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeactivate(item.id)}
                    >
                      Desactivar
                    </Button>
                  ) : null}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
