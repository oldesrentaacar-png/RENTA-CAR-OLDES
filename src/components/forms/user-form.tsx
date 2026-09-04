"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createUser, updateUser } from "@/app/dashboard/usuarios/actions";
import { SignaturePad } from "@/components/contracts/signature-pad";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/types/database";

type UserFormProps = {
  user?: Profile;
  roles: Array<{ id: string; name: string }>;
  redirectTo?: string;
};

export function UserForm({ user, roles, redirectTo }: UserFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState(user?.signature_url ?? "");
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const isEdit = Boolean(user);

  async function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("signatureUrl", signatureUrl);
    const result = isEdit
      ? await updateUser(user!.id, formData)
      : await createUser(formData);

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.push(redirectTo ?? "/dashboard/usuarios");
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {!isEdit ? (
          <>
            <Input name="email" label="Correo *" type="email" required />
            <Input name="password" label="Contraseña *" type="password" required />
          </>
        ) : null}
        <Input
          name="firstName"
          label="Nombre *"
          defaultValue={user?.first_name}
          required
        />
        <Input
          name="lastName"
          label="Apellido *"
          defaultValue={user?.last_name}
          required
        />
        <Input name="phone" label="Teléfono" defaultValue={user?.phone ?? ""} />
        <Select
          name="roleId"
          label="Rol *"
          defaultValue={user?.role_id ?? roles[0]?.id}
          options={roles.map((role) => ({ value: role.id, label: role.name }))}
        />
        <Select
          name="status"
          label="Estado"
          defaultValue={user?.status ?? "ACTIVE"}
          options={[
            { value: "ACTIVE", label: "Activo" },
            { value: "INACTIVE", label: "Inactivo" },
            { value: "SUSPENDED", label: "Suspendido" },
          ]}
        />
      </div>

      <div className="space-y-3 rounded-xl border border-border p-4">
        <div>
          <h3 className="text-sm font-semibold">Firma digital del operador</h3>
          <p className="text-sm text-muted">
            Esta firma se usará automáticamente en contratos y documentos cuando
            usted esté en sesión.
          </p>
        </div>

        {(capturedPreview ||
          (signatureUrl && !signatureUrl.startsWith("data:"))) ? (
          <div className="rounded-lg border border-border bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={capturedPreview || signatureUrl}
              alt="Firma actual"
              className="h-16 max-w-full object-contain"
            />
          </div>
        ) : null}

        <SignaturePad
          onConfirm={(dataUrl) => {
            setSignatureUrl(dataUrl);
            setCapturedPreview(dataUrl);
          }}
        />

        {signatureUrl ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setSignatureUrl("");
              setCapturedPreview(null);
            }}
          >
            Quitar firma
          </Button>
        ) : null}

        <input type="hidden" name="signatureUrl" value={signatureUrl} />
      </div>

      <div className="flex flex-wrap gap-3">
        <SubmitButton>{isEdit ? "Guardar cambios" : "Crear usuario"}</SubmitButton>
        <Link
          href="/dashboard/usuarios"
          className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-muted"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
