"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

import type { DeliveryStep } from "@/components/contracts/delivery-checklist";
import { isDocumentHref } from "@/components/contracts/contract-pdf-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ContractDeliveryNavigatorProps = {
  contractId: string;
  steps: DeliveryStep[];
  currentStepId?: string;
};

function StepAction({
  href,
  label,
  primary,
}: {
  href: string;
  label: string;
  primary?: boolean;
}) {
  const className = primary
    ? "inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
    : "inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800";

  if (isDocumentHref(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {label}
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

/**
 * Flujo de entrega enfocado: barra compacta de pasos + solo el paso actual
 * expandido (evita mezclar firmas, abonos, cobros, etc. en la misma vista).
 */
export function ContractDeliveryNavigator({
  contractId,
  steps,
  currentStepId,
}: ContractDeliveryNavigatorProps) {
  const currentIndex = useMemo(() => {
    if (!currentStepId) {
      const pending = steps.findIndex((step) => step.status !== "done");
      if (pending >= 0) return pending;
      return Math.max(steps.length - 1, 0);
    }
    const idx = steps.findIndex((step) => step.id === currentStepId);
    return idx >= 0 ? idx : 0;
  }, [currentStepId, steps]);

  const prev = currentIndex > 0 ? steps[currentIndex - 1] : null;
  const current = steps[currentIndex] ?? steps[0];
  const next =
    currentIndex >= 0 && currentIndex < steps.length - 1
      ? steps[currentIndex + 1]
      : null;

  if (!current) return null;

  return (
    <Card id="entrega">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Flujo de entrega — paso a paso</CardTitle>
        <p className="text-sm text-muted">
          Solo se muestra el paso actual. Toque otro número para saltar; no se
          mezclan firmas, abonos ni cobros en la misma pantalla.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="flex gap-2 overflow-x-auto pb-1">
          {steps.map((step, index) => {
            const active = index === currentIndex;
            return (
              <li key={step.id} className="min-w-[7.5rem] flex-1">
                {step.href ? (
                  <Link
                    href={step.href}
                    className={cn(
                      "block h-full rounded-lg border px-2.5 py-2 text-left text-xs transition",
                      active && "ring-2 ring-brand/35",
                      step.status === "done" &&
                        !active &&
                        "border-green-200 bg-green-50/50",
                      step.status === "partial" &&
                        !active &&
                        "border-amber-200 bg-amber-50/40",
                      step.status === "pending" &&
                        !active &&
                        "border-border bg-white",
                      active && "border-brand/40 bg-white",
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold tabular-nums text-muted">
                        {index + 1}
                      </span>
                      {step.status === "done" ? (
                        <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-green-800">
                          Listo
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 font-medium leading-snug text-foreground">
                      {step.title}
                    </p>
                  </Link>
                ) : (
                  <div className="rounded-lg border border-border px-2.5 py-2 text-xs">
                    <span className="font-semibold text-muted">{index + 1}</span>
                    <p className="mt-1 font-medium">{step.title}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Paso {currentIndex + 1} de {steps.length}
          </p>
          <h3 className="mt-1 text-base font-semibold text-foreground">
            {current.title}
          </h3>
          <p className="mt-1 text-sm text-muted">{current.description}</p>
          {current.href && current.linkLabel ? (
            <div className="mt-4">
              <StepAction
                href={current.href}
                label={current.linkLabel}
                primary
              />
            </div>
          ) : null}
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {current.linkLabel?.startsWith("Ver / Editar")
              ? "Al abrir Ver / Editar, deslice hacia abajo. El kilometraje, las fotos y la firma están más abajo en esa pantalla."
              : next
                ? "Complete este paso y pulse Siguiente. El flujo no vuelve al paso 1."
                : "Último paso de la entrega. Cerrar renta abre el cierre (kilometraje y firma). No reinicia el contrato."}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted/40 p-3">
          <p className="text-sm text-muted">
            {current.status === "done"
              ? "Este paso está listo. Puede avanzar o revisarlo."
              : "Complete solo este paso antes de pasar al siguiente."}
          </p>
          <div className="flex flex-wrap gap-2">
            {prev?.href ? (
              <Link href={prev.href}>
                <Button type="button" variant="outline" size="sm">
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Anterior
                </Button>
              </Link>
            ) : (
              <Button type="button" variant="outline" size="sm" disabled>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Anterior
              </Button>
            )}
            {next?.href ? (
              <Link href={next.href}>
                <Button type="button" size="sm">
                  Siguiente
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Link href={`/dashboard/contratos/${contractId}/cerrar`}>
                <Button type="button" size="sm">
                  Cerrar renta
                </Button>
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
