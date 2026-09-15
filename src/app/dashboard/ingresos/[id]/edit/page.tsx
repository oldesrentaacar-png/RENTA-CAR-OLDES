import { notFound } from "next/navigation";

import {
  getIncomeTransaction,
  listFinanceOptions,
} from "@/app/dashboard/ingresos/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { IncomeForm } from "@/components/forms/income-form";
import { IncomeRowActions } from "@/components/ingresos/income-row-actions";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/env";

export default async function EditarIngresoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const configured = isSupabaseConfigured();
  const [incomeResult, optionsResult] = configured
    ? await Promise.all([getIncomeTransaction(id), listFinanceOptions()])
    : [null, null];

  if (configured && incomeResult && !incomeResult.success) notFound();

  const income = incomeResult?.success ? incomeResult.data : null;
  const options = optionsResult?.success
    ? optionsResult.data
    : { vehicles: [], customers: [], reservations: [] };

  const user = configured ? await getCurrentUser() : null;
  const canDelete = user
    ? await hasPermission(user.id, "finance.delete")
    : false;

  return (
    <PermissionGuard permission="finance.edit">
      <div className="space-y-6">
        <PageHeader
          title={
            income
              ? `Editar ingreso · ${income.reference ?? income.type}`
              : "Editar ingreso"
          }
          breadcrumbs={[
            { label: "Ingresos", href: "/dashboard/ingresos" },
            { label: "Editar" },
          ]}
        />
        {!configured ? (
          <SetupBanner />
        ) : income ? (
          <>
            {income.receipt_id ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Este ingreso está ligado a un recibo. Si el monto es incorrecto,
                anule el recibo en Recibos y registre uno nuevo. Aquí puede
                corregir datos no fiscales (notas, referencia, método).
              </div>
            ) : null}
            <IncomeForm
              income={income}
              options={options}
              redirectTo="/dashboard/ingresos"
            />
            <IncomeRowActions
              incomeId={income.id}
              canEdit={false}
              canDelete={canDelete}
              linkedToReceipt={Boolean(income.receipt_id)}
            />
          </>
        ) : null}
      </div>
    </PermissionGuard>
  );
}
