"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

import {
  forgotPasswordAction,
  loginAction,
  type AuthActionState,
} from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAND } from "@/lib/brand";

const initialState: AuthActionState = {};

type LoginPageClientProps = {
  supabaseConfigured: boolean;
};

export function LoginPageClient({ supabaseConfigured }: LoginPageClientProps) {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";
  const inactiveAccountMessage =
    searchParams.get("error") === "inactive"
      ? "Su cuenta está inactiva o no tiene acceso al panel. Contacte al administrador."
      : null;
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const [loginState, loginFormAction, loginPending] = useActionState(
    loginAction,
    initialState,
  );

  const [forgotState, forgotFormAction, forgotPending] = useActionState(
    forgotPasswordAction,
    initialState,
  );

  if (!supabaseConfigured) {
    return (
      <div className="mx-auto w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex justify-center">
          <Image
            src={BRAND.logoPath}
            alt={BRAND.fullName}
            width={220}
            height={88}
            className="h-16 w-auto rounded-lg shadow-md"
            priority
          />
        </div>
        <h1 className="text-xl font-bold text-foreground">
          Configuración pendiente
        </h1>
        <p className="mt-3 text-sm text-muted">
          Supabase no está configurado. Defina{" "}
          <code className="rounded bg-white px-1 py-0.5 text-xs">
            NEXT_PUBLIC_SUPABASE_URL
          </code>{" "}
          y{" "}
          <code className="rounded bg-white px-1 py-0.5 text-xs">
            NEXT_PUBLIC_SUPABASE_ANON_KEY
          </code>{" "}
          en las variables de entorno para habilitar el inicio de sesión.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex justify-center">
          <Image
            src={BRAND.logoPath}
            alt={BRAND.fullName}
            width={260}
            height={104}
            className="h-20 w-auto rounded-xl shadow-xl"
            priority
          />
        </div>
        <h1 className="text-2xl font-bold text-white">{BRAND.fullName}</h1>
        <p className="mt-2 text-sm text-slate-400">
          Acceda al panel administrativo
        </p>
      </div>

      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/80 p-8 shadow-2xl backdrop-blur">
        {!showForgot ? (
          <form action={loginFormAction} className="space-y-5">
            <input type="hidden" name="redirect" value={redirectTo} />

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">
                Correo electrónico
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="usuario@empresa.com"
                className="border-slate-600 bg-slate-800/80 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="border-slate-600 bg-slate-800/80 pr-10 text-white placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-400 hover:text-white"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {(inactiveAccountMessage || loginState.error) ? (
              <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300" role="alert">
                {inactiveAccountMessage ?? loginState.error}
              </p>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              loading={loginPending}
            >
              Iniciar sesión
            </Button>

            <button
              type="button"
              onClick={() => setShowForgot(true)}
              className="w-full text-center text-sm text-slate-400 hover:text-white"
            >
              ¿Olvidó su contraseña?
            </button>
          </form>
        ) : (
          <form action={forgotFormAction} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="forgot-email" className="text-slate-200">
                Correo electrónico
              </Label>
              <Input
                id="forgot-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="usuario@empresa.com"
                className="border-slate-600 bg-slate-800/80 text-white placeholder:text-slate-500"
              />
            </div>

            {forgotState.error ? (
              <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300" role="alert">
                {forgotState.error}
              </p>
            ) : null}

            {forgotState.success ? (
              <p className="rounded-lg bg-green-950/50 px-3 py-2 text-sm text-green-300" role="status">
                {forgotState.success}
              </p>
            ) : null}

            <Button type="submit" className="w-full" loading={forgotPending}>
              Enviar enlace
            </Button>

            <button
              type="button"
              onClick={() => setShowForgot(false)}
              className="w-full text-center text-sm text-slate-400 hover:text-white"
            >
              Volver al inicio de sesión
            </button>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-slate-500">
        Sistema de gestión — {BRAND.fullName}
      </p>
    </div>
  );
}

export function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#061438] px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand/40 via-transparent to-transparent"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
