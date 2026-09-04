import { MySignatureForm } from "@/app/dashboard/mi-perfil/my-signature-form";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { getCurrentProfile } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";

export default async function MiPerfilPage() {
  const configured = isSupabaseConfigured();
  const profile = configured ? await getCurrentProfile() : null;
  const operatorName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : "Operador";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mi perfil"
        description="Nombre y firma digital que se usan en contratos y documentos."
        breadcrumbs={[{ label: "Mi perfil" }]}
      />

      {!configured ? (
        <SetupBanner />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-6 text-sm">
            <p>
              <span className="text-muted">Nombre:</span> {operatorName}
            </p>
            <p>
              <span className="text-muted">Correo:</span>{" "}
              {profile?.email ?? "—"}
            </p>
          </div>
          <MySignatureForm
            operatorName={operatorName}
            currentSignatureUrl={profile?.signature_url ?? null}
          />
        </div>
      )}
    </div>
  );
}
