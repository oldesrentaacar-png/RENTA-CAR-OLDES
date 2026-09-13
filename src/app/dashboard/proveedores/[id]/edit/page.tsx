import { notFound } from "next/navigation";

import { getVendor } from "@/app/dashboard/proveedores/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { VendorForm } from "@/components/forms/vendor-form";
import { PageHeader } from "@/components/shared/page-header";
import { isSupabaseConfigured } from "@/lib/env";

export default async function EditarProveedorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const configured = isSupabaseConfigured();
  const result = configured ? await getVendor(id) : null;

  if (configured && result && !result.success) notFound();

  const vendor = result?.success ? result.data : null;

  return (
    <PermissionGuard permission="finance.edit">
      <div className="space-y-6">
        <PageHeader
          title={vendor ? `Editar proveedor: ${vendor.name}` : "Editar proveedor"}
          breadcrumbs={[
            { label: "Proveedores", href: "/dashboard/proveedores" },
            { label: "Editar" },
          ]}
        />
        {!configured ? (
          <SetupBanner />
        ) : vendor ? (
          <VendorForm vendor={vendor} redirectTo={`/dashboard/proveedores/${vendor.id}`} />
        ) : null}
      </div>
    </PermissionGuard>
  );
}
