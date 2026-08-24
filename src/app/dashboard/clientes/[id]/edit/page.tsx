import { notFound } from "next/navigation";

import { getCustomer } from "@/app/dashboard/clientes/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { CustomerForm } from "@/components/forms/customer-form";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { getCustomerDisplayName } from "@/lib/customers";
import { isSupabaseConfigured } from "@/lib/env";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const configured = isSupabaseConfigured();
  const result = configured ? await getCustomer(id) : null;

  if (configured && result && !result.success) {
    notFound();
  }

  const customer = result?.success ? result.data : undefined;
  const displayName = customer ? getCustomerDisplayName(customer) : "Editar";

  return (
    <PermissionGuard permission="customers.edit">
      <div className="space-y-6">
        <PageHeader
          title="Editar cliente"
          breadcrumbs={[
            { label: "Clientes", href: "/dashboard/clientes" },
            { label: displayName, href: `/dashboard/clientes/${id}` },
            { label: "Editar" },
          ]}
        />
        {!configured ? (
          <SetupBanner />
        ) : customer ? (
          <CustomerForm customer={customer} />
        ) : null}
      </div>
    </PermissionGuard>
  );
}
