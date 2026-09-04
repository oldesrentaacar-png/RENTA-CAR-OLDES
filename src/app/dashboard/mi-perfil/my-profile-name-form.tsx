"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { saveMyProfileName } from "@/app/dashboard/mi-perfil/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MyProfileNameFormProps = {
  firstName: string;
  lastName: string;
  email: string;
};

export function MyProfileNameForm({
  firstName,
  lastName,
  email,
}: MyProfileNameFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await saveMyProfileName(formData);
    setPending(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setMessage("Nombre actualizado. Se usará en contratos y documentos.");
    router.refresh();
  }

  return (
    <form
      action={(fd) => void handleSubmit(fd)}
      className="space-y-4 rounded-xl border border-border bg-surface p-6"
    >
      <div>
        <h2 className="text-base font-semibold">Datos del operador</h2>
        <p className="text-sm text-muted">
          Este nombre aparece en contratos, actas y recibos que usted gestiona.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          name="firstName"
          label="Nombre"
          defaultValue={firstName}
          required
          autoComplete="given-name"
        />
        <Input
          name="lastName"
          label="Apellido"
          defaultValue={lastName}
          required
          autoComplete="family-name"
        />
      </div>

      <p className="text-sm">
        <span className="text-muted">Correo:</span> {email || "—"}
      </p>

      <Button type="submit" loading={pending}>
        Guardar nombre
      </Button>
    </form>
  );
}
