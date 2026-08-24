import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type DeliveryStepStatus = "done" | "pending" | "partial";

export type DeliveryStep = {
  id: string;
  title: string;
  description: string;
  status: DeliveryStepStatus;
  href?: string;
  linkLabel?: string;
};

type DeliveryChecklistProps = {
  steps: DeliveryStep[];
  title?: string;
  description?: string;
};

const STATUS_LABEL: Record<DeliveryStepStatus, string> = {
  done: "Listo",
  pending: "Pendiente",
  partial: "Parcial",
};

const STATUS_VARIANT: Record<
  DeliveryStepStatus,
  "success" | "warning" | "default"
> = {
  done: "success",
  pending: "default",
  partial: "warning",
};

export function DeliveryChecklist({
  steps,
  title = "Entrega del vehículo",
  description = "Complete estos pasos para finalizar la entrega según el flujo OLDES.",
}: DeliveryChecklistProps) {
  const doneCount = steps.filter((s) => s.status === "done").length;

  return (
    <Card id="entrega">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="mt-1 text-sm text-muted">{description}</p>
          </div>
          <Badge variant={doneCount === steps.length ? "success" : "brand"}>
            {doneCount}/{steps.length} completados
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {steps.map((step, index) => (
            <li
              key={step.id}
              className={cn(
                "flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3",
                step.status === "done" && "border-green-200 bg-green-50/40",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      step.status === "done"
                        ? "bg-green-600 text-white"
                        : "bg-surface-muted text-muted",
                    )}
                  >
                    {step.status === "done" ? "✓" : index + 1}
                  </span>
                  <p className="font-medium text-sm">{step.title}</p>
                  <Badge variant={STATUS_VARIANT[step.status]}>
                    {STATUS_LABEL[step.status]}
                  </Badge>
                </div>
                <p className="mt-1 pl-8 text-sm text-muted">{step.description}</p>
              </div>
              {step.href && step.linkLabel ? (
                <Link
                  href={step.href}
                  className="shrink-0 text-sm font-medium text-brand hover:underline"
                >
                  {step.linkLabel}
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
