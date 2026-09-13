import { notFound } from "next/navigation";

import { getPartnerRental } from "@/app/dashboard/socios/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { PartnerRentalForm } from "@/components/forms/partner-rental-form";
import { PageHeader } from "@/components/shared/page-header";
import { isSupabaseConfigured } from "@/lib/env";

export default async function EditarSubRentaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const configured = isSupabaseConfigured();
  const result = configured ? await getPartnerRental(id) : null;

  if (configured && result && !result.success) notFound();

  const rental = result?.success ? result.data : null;

  return (
    <PermissionGuard permission="finance.edit">
      <div className="space-y-6">
        <PageHeader
          title={rental ? `Editar sub-renta: ${rental.customer_name}` : "Editar sub-renta"}
          breadcrumbs={[
            { label: "Socios", href: "/dashboard/socios" },
            { label: "Editar" },
          ]}
        />
        {!configured ? (
          <SetupBanner />
        ) : rental ? (
          <PartnerRentalForm rental={rental} />
        ) : null}
      </div>
    </PermissionGuard>
  );
}
