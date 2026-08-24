import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value));

export const accessoryCatalogSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Código requerido.")
    .max(50)
    .regex(/^[A-Z0-9_]+$/i, "Use solo letras, números y guión bajo."),
  nameEs: z.string().trim().min(1, "Nombre en español requerido.").max(200),
  nameEn: optionalText(200),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

export const accessoryCatalogUpdateSchema = accessoryCatalogSchema.partial();

export type AccessoryCatalogInput = z.infer<typeof accessoryCatalogSchema>;
