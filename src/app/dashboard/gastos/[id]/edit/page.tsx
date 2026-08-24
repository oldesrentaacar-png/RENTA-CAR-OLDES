import { notFound } from "next/navigation";

import {
  getExpenseTransaction,
} from "@/app/dashboard/gastos/actions";
import { listFinanceOptions } from "@/app/dashboard/ingresos/actions";
import { ExpenseForm } from "@/components/forms/expense-form";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { ExpenseRowActions } from "@/components/gastos/expense-row-actions";
import { isSupabaseConfigured } from "@/lib/env";

export default async function EditarGastoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const configured = isSupabaseConfigured();
  const [expenseResult, optionsResult] = configured
    ? await Promise.all([getExpenseTransaction(id), listFinanceOptions()])
    : [null, null];

  if (configured && expenseResult && !expenseResult.success) notFound();

  const expense = expenseResult?.success ? expenseResult.data : null;
  const vehicles = optionsResult?.success ? optionsResult.data.vehicles : [];

  return (
    <PermissionGuard permission="finance.edit">
      <div className="space-y-6">
        <PageHeader
          title={expense ? `Editar gasto: ${expense.concept}` : "Editar gasto"}
          breadcrumbs={[
            { label: "Gastos", href: "/dashboard/gastos" },
            { label: "Editar" },
          ]}
        />
        {!configured ? (
          <SetupBanner />
        ) : expense ? (
          <>
            <ExpenseForm
              expense={expense}
              vehicles={vehicles}
              redirectTo="/dashboard/gastos"
            />
            <ExpenseRowActions
              expenseId={expense.id}
              canEdit={false}
              canDelete
            />
          </>
        ) : null}
      </div>
    </PermissionGuard>
  );
}
