import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value));

const optionalDate = (message: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, message)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value));

const optionalUrl = optionalText(2000);

export const customerSchema = z
  .object({
    customerType: z.enum(["PERSON", "COMPANY"]).default("PERSON"),
    firstName: z
      .string()
      .trim()
      .max(100)
      .optional()
      .or(z.literal(""))
      .transform((value) => (value === "" ? undefined : value)),
    lastName: z
      .string()
      .trim()
      .max(100)
      .optional()
      .or(z.literal(""))
      .transform((value) => (value === "" ? undefined : value)),
    companyName: optionalText(200),
    nit: optionalText(50),
    nrc: optionalText(50),
    contactPerson: optionalText(200),
    identification: optionalText(50),
    dui: optionalText(20),
    passport: optionalText(30),
    licenseNumber: optionalText(50),
    licenseExpiry: optionalDate("Fecha de vencimiento inválida."),
    birthDate: optionalDate("Fecha de nacimiento inválida."),
    phone: z.string().trim().min(7, "Teléfono requerido.").max(20),
    whatsapp: optionalText(20),
    email: z
      .email("Correo inválido.")
      .optional()
      .or(z.literal(""))
      .transform((value) => (value === "" ? undefined : value)),
    address: optionalText(500),
    country: optionalText(100),
    additionalDriverName: optionalText(200),
    additionalDriverLicense: optionalText(50),
    documentImageUrl: optionalUrl,
    licenseImageUrl: optionalUrl,
    receiverName: optionalText(200),
    delivererName: optionalText(200),
    notes: optionalText(2000),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  })
  .superRefine((data, ctx) => {
    if (data.customerType === "PERSON") {
      if (!data.firstName) {
        ctx.addIssue({
          code: "custom",
          path: ["firstName"],
          message: "Nombre requerido.",
        });
      }
      if (!data.lastName) {
        ctx.addIssue({
          code: "custom",
          path: ["lastName"],
          message: "Apellido requerido.",
        });
      }
    } else if (!data.companyName) {
      ctx.addIssue({
        code: "custom",
        path: ["companyName"],
        message: "Razón social requerida.",
      });
    }
  })
  .transform((data) => {
    if (data.customerType === "COMPANY") {
      return {
        ...data,
        firstName: data.firstName ?? data.companyName ?? "Empresa",
        lastName: data.lastName ?? data.contactPerson ?? "-",
      };
    }
    return {
      ...data,
      firstName: data.firstName!,
      lastName: data.lastName!,
    };
  });

export const customerUpdateSchema = z
  .object({
    customerType: z.enum(["PERSON", "COMPANY"]).optional(),
    firstName: z
      .string()
      .trim()
      .max(100)
      .optional()
      .or(z.literal(""))
      .transform((value) => (value === "" ? undefined : value)),
    lastName: z
      .string()
      .trim()
      .max(100)
      .optional()
      .or(z.literal(""))
      .transform((value) => (value === "" ? undefined : value)),
    companyName: optionalText(200),
    nit: optionalText(50),
    nrc: optionalText(50),
    contactPerson: optionalText(200),
    identification: optionalText(50),
    dui: optionalText(20),
    passport: optionalText(30),
    licenseNumber: optionalText(50),
    licenseExpiry: optionalDate("Fecha de vencimiento inválida."),
    birthDate: optionalDate("Fecha de nacimiento inválida."),
    phone: z
      .string()
      .trim()
      .min(7, "Teléfono requerido.")
      .max(20)
      .optional(),
    whatsapp: optionalText(20),
    email: z
      .email("Correo inválido.")
      .optional()
      .or(z.literal(""))
      .transform((value) => (value === "" ? undefined : value)),
    address: optionalText(500),
    country: optionalText(100),
    additionalDriverName: optionalText(200),
    additionalDriverLicense: optionalText(50),
    documentImageUrl: optionalUrl,
    licenseImageUrl: optionalUrl,
    receiverName: optionalText(200),
    delivererName: optionalText(200),
    notes: optionalText(2000),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.customerType === "PERSON") {
      if (data.firstName !== undefined && !data.firstName) {
        ctx.addIssue({
          code: "custom",
          path: ["firstName"],
          message: "Nombre requerido.",
        });
      }
      if (data.lastName !== undefined && !data.lastName) {
        ctx.addIssue({
          code: "custom",
          path: ["lastName"],
          message: "Apellido requerido.",
        });
      }
    }
    if (data.customerType === "COMPANY" && data.companyName !== undefined && !data.companyName) {
      ctx.addIssue({
        code: "custom",
        path: ["companyName"],
        message: "Razón social requerida.",
      });
    }
  })
  .transform((data) => {
    if (data.customerType !== "COMPANY") return data;
    return {
      ...data,
      firstName: data.firstName ?? data.companyName,
      lastName: data.lastName ?? data.contactPerson ?? data.lastName,
    };
  });

export type CustomerInput = z.infer<typeof customerSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;

export const customerSearchSchema = z.object({
  query: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CustomerSearchInput = z.infer<typeof customerSearchSchema>;
