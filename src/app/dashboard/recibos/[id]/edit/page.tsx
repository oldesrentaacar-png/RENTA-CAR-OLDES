import { notFound } from "next/navigation";

import { getPaymentReceipt } from "@/app/dashboard/recibos/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { ReceiptCorrectForm } from "@/components/recibos/receipt-correct-form";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/env";

export default async function CorregirReciboPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const configured = isSupabaseConfigured();
  const result = configured ? await getPaymentReceipt(id) : null;
  if (configured && result && !result.success) notFound();
  const receipt = result?.success ? result.data : null;

  const user = configured ? await getCurrentUser() : null;
  const canVoid = user
    ? await hasPermission(user.id, "finance.delete")
    : false;

  return (
    <PermissionGuard permission="finance.edit">
      <div className="space-y-6">
        <PageHeader
          title={
            receipt ? `Corregir recibo ${receipt.code}` : "Corregir recibo"
          }
          description="Actualice concepto, método o notas. Para cambiar el monto, anule y cree uno nuevo."
          breadcrumbs={[
            { label: "Recibos", href: "/dashboard/recibos" },
            { label: receipt?.code ?? "Corregir" },
          ]}
        />
        {!configured ? (
          <SetupBanner />
        ) : receipt ? (
          <ReceiptCorrectForm receipt={receipt} canVoid={canVoid} />
        ) : null}
      </div>
    </PermissionGuard>
  );
}
