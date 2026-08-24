"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { DeliveryStep } from "@/components/contracts/delivery-checklist";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ContractDeliveryNavigatorProps = {
  contractId: string;
  steps: DeliveryStep[];
  currentStepId?: string;
};

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
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="grid gap-2 sm:grid-cols-2">
          {steps.map((step, index) => (
            <li
              key={step.id}
              className={cn(
                "rounded-lg border border-border px-3 py-2 text-sm",
                step.status === "done" && "border-green-200 bg-green-50/40",
                index === currentIndex && "ring-2 ring-brand/30",
              )}
            >
              <span className="font-medium">
                {index + 1}. {step.title}
              </span>
              <p className="mt-1 text-muted">{step.description}</p>
              {step.href && step.linkLabel ? (
                <Link
                  href={step.href}
                  className="mt-2 inline-block text-sm font-medium text-brand hover:underline"
                >
                  {step.linkLabel}
                </Link>
              ) : null}
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted/40 p-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Paso {currentIndex + 1} de {steps.length}
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
