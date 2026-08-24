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
