"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";

import {
  createCustomerFromRequest,
  markRequestContacted,
  rejectRequest,
} from "@/app/dashboard/solicitudes/actions";
import { Button } from "@/components/ui/button";
import type { WebRequest } from "@/types/database";

function Step({
  done,
  active,
  title,
  description,
}: {
  done: boolean;
  active?: boolean;
  title: string;
  description: string;
}) {
  return (
    <div
      className={`flex gap-3 rounded-xl border px-4 py-3 ${
        done
          ? "border-emerald-200 bg-emerald-50/60"
          : active
            ? "border-blue-200 bg-blue-50/70"
            : "border-border bg-surface"
      }`}
    >
      {done ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      ) : (
        <Circle
          className={`mt-0.5 h-5 w-5 shrink-0 ${active ? "text-blue-600" : "text-muted"}`}
        />
      )}
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>
    </div>
  );
}

export function RequestActions({ request }: { request: WebRequest }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const closed = ["REJECTED", "CONVERTED", "CANCELLED"].includes(request.status);
  const contacted = request.status !== "PENDING";
  const hasCustomer = Boolean(request.customer_id);
  const converted = request.status === "CONVERTED";

  async function run(
    action: () => Promise<{ success: boolean; error?: string }>,
    key: string,
  ) {
    setLoading(key);
    setError(null);
    const result = await action();
    setLoading(null);
    if (!result.success) {
      setError(result.error ?? "Error");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          Flujo recomendado (siga el orden)
        </p>
        <div className="grid gap-2">
          <Step
            done={contacted || converted}
            active={request.status === "PENDING"}
            title="1. Contactar al cliente"
            description="Confirme disponibilidad por WhatsApp o llamada."
          />
          <Step
            done={hasCustomer}
            active={contacted && !hasCustomer && !closed}
            title="2. Crear / vincular cliente"
            description="Guarde los datos del cliente en el sistema."
          />
          <Step
            done={converted}
            active={hasCustomer && !converted && !closed}
            title="3. Crear cotización"
            description="El total se calcula solo con fechas y tarifa del vehículo."
          />
          <Step
            done={converted}
            active={false}
            title="4. Aceptar cotización → reserva manual"
            description="Acepte la cotización (sin crear reserva). Luego use “Crear reserva manualmente”. Después contrato e inspección."
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {request.status === "PENDING" ? (
          <Button
            type="button"
            variant="secondary"
            disabled={loading !== null}
            onClick={() => run(() => markRequestContacted(request.id), "contact")}
          >
            {loading === "contact" ? "Guardando…" : "1. Marcar contactado"}
          </Button>
        ) : null}

        {!hasCustomer && !closed ? (
          <Button
            type="button"
            disabled={loading !== null}
            onClick={async () => {
              setLoading("customer");
              setError(null);
              const result = await createCustomerFromRequest(request.id);
              setLoading(null);
              if (!result.success) setError(result.error);
              else router.refresh();
            }}
          >
            {loading === "customer" ? "Creando…" : "2. Crear cliente"}
          </Button>
        ) : null}

        {hasCustomer ? (
          <Link
            href={`/dashboard/clientes/${request.customer_id}`}
            className="inline-flex items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            Ver cliente
          </Link>
        ) : null}

        {!closed ? (
          hasCustomer ? (
            <Link
              href={`/dashboard/cotizaciones/nuevo?requestId=${request.id}&customerId=${request.customer_id}`}
              className="inline-flex items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              3. Crear cotización
            </Link>
          ) : (
            <Button type="button" disabled title="Primero cree el cliente">
              3. Crear cotización
            </Button>
          )
        ) : null}

        {!closed ? (
          <Button
            type="button"
            variant="danger"
            disabled={loading !== null}
            onClick={() => {
              if (!confirm("¿Rechazar esta solicitud? No se creará reserva.")) return;
              void run(() => rejectRequest(request.id), "reject");
            }}
          >
            Rechazar solicitud
          </Button>
        ) : null}
      </div>

      {!hasCustomer && !closed ? (
        <p className="text-xs text-muted">
          Para cotizar primero debe crear el cliente (paso 2). Así evita
          cotizaciones sin ficha.
        </p>
      ) : null}
    </div>
  );
}
