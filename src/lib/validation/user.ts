import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value));

export const createUserSchema = z.object({
  email: z.email("Correo inválido."),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres.")
    .max(128),
  firstName: z.string().trim().min(1, "Nombre requerido.").max(100),
  lastName: z.string().trim().min(1, "Apellido requerido.").max(100),
  phone: optionalText(20),
  /** URL or data:image base64 signature captured from pad. */
  signatureUrl: optionalText(2_000_000),
  roleId: z.uuid("Rol inválido."),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).default("ACTIVE"),
});

export const updateUserSchema = createUserSchema
  .omit({ password: true, email: true })
  .partial()
  .extend({
    email: z.email("Correo inválido.").optional(),
  });

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres.")
    .max(128),
});

export const loginSchema = z.object({
  email: z.email("Correo inválido."),
  password: z.string().min(1, "Contraseña requerida."),
});

export const roleSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido.").max(100),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_]+$/, "Slug inválido."),
  description: optionalText(500),
  permissionIds: z.array(z.uuid()).default([]),
});

export const roleUpdateSchema = roleSchema.partial();

export const userPermissionOverrideSchema = z.object({
  userId: z.uuid(),
  permissionId: z.uuid(),
  granted: z.boolean(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RoleInput = z.infer<typeof roleSchema>;
export type UserPermissionOverrideInput = z.infer<
  typeof userPermissionOverrideSchema
>;

export const userSearchSchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
  roleId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type UserSearchInput = z.infer<typeof userSearchSchema>;
