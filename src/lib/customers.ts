import type { Customer } from "@/types/database";

export function getCustomerDisplayName(
  customer: Pick<
    Customer,
    "customer_type" | "first_name" | "last_name" | "company_name"
  >,
): string {
  if (customer.customer_type === "COMPANY") {
    const company = customer.company_name?.trim();
    if (company) return company;
  }
  return `${customer.first_name} ${customer.last_name}`.trim();
}

export function getCustomerTypeLabel(
  customerType: Customer["customer_type"],
): string {
  return customerType === "COMPANY" ? "Empresa" : "Persona";
}

/** Option shape for searchable customer selectors. */
export function toCustomerSelectOption(
  customer: Pick<
    Customer,
    | "id"
    | "customer_type"
    | "first_name"
    | "last_name"
    | "company_name"
    | "phone"
    | "email"
    | "dui"
    | "passport"
    | "identification"
  >,
): { id: string; label: string; searchText: string } {
  const name = getCustomerDisplayName(customer);
  const phone = customer.phone?.trim() || "";
  const label = phone ? `${name} · ${phone}` : name;
  const searchText = [
    name,
    phone,
    customer.email,
    customer.dui,
    customer.passport,
    customer.identification,
    customer.company_name,
  ]
    .filter(Boolean)
    .join(" ");
  return { id: customer.id, label, searchText };
}
