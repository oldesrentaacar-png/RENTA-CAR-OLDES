import { Resend } from "resend";

import { env, isResendConfigured } from "@/lib/env";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!isResendConfigured()) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY!);
  }

  return resendClient;
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  if (!isResendConfigured()) {
    return {
      ok: false,
      message: "Servicio de correo no configurado.",
    };
  }

  const client = getResendClient();
  if (!client) {
    return {
      ok: false,
      message: "Servicio de correo no configurado.",
    };
  }

  try {
    const { data, error } = await client.emails.send({
      from: env.EMAIL_FROM!,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
    });

    if (error) {
      return {
        ok: false,
        message: error.message || "No se pudo enviar el correo.",
      };
    }

    return {
      ok: true,
      id: data?.id ?? "unknown",
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Error inesperado al enviar correo.";
    return { ok: false, message };
  }
}
