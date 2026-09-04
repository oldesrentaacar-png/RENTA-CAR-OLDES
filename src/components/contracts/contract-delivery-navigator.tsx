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
}: {
  href: string;
  label: string;
}) {
  const className =
    "mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800";

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

export function ContractDeliveryNavigator({
  contractId,
  steps,
  currentStepId,
}: ContractDeliveryNavigatorProps) {
  const currentIndex = useMemo(() => {
    if (!currentStepId) {
      return steps.findIndex((step) => step.status !== "done");
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
      <CardHeader>
        <CardTitle className="text-base">Flujo de entrega — paso a paso</CardTitle>
        <p className="text-sm text-muted">
          Puede volver a abrir cualquier paso terminado para verlo o corregirlo.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="grid gap-2 sm:grid-cols-2">
          {steps.map((step, index) => (
            <li
              key={step.id}
              className={cn(
                "rounded-lg border border-border px-3 py-3 text-sm",
                step.status === "done" && "border-green-200 bg-green-50/40",
                step.status === "partial" && "border-amber-200 bg-amber-50/40",
                index === currentIndex && "ring-2 ring-brand/30",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">
                  {index + 1}. {step.title}
                </span>
                {step.status === "done" ? (
                  <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-800">
                    Listo
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-muted">{step.description}</p>
              {step.href && step.linkLabel ? (
                <StepAction href={step.href} label={step.linkLabel} />
              ) : null}
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted/40 p-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Paso {Math.max(currentIndex, 0) + 1} de {steps.length}
            </p>
            <p className="font-medium">{current.title}</p>
          </div>
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
              <Link href={`/dashboard/contratos/${contractId}`}>
                <Button type="button" size="sm">
                  Finalizar en contrato
                </Button>
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
