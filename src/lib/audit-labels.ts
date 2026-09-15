const AUDIT_ACTION_LABELS: Record<string, string> = {
  "vehicle_type.create": "Tipo de vehículo creado",
  "vehicle_type.update": "Tipo de vehículo actualizado",
  "vehicle_type.deactivate": "Tipo de vehículo desactivado",
  "vehicle.create": "Vehículo creado",
  "vehicle.update": "Vehículo actualizado",
  "reservation.create": "Reserva creada",
  "reservation.update": "Reserva actualizada",
  "contract.create": "Contrato creado",
  "contract.update": "Contrato actualizado",
  "customer.create": "Cliente creado",
  "customer.update": "Cliente actualizado",
};

const AUDIT_ENTITY_LABELS: Record<string, string> = {
  vehicle_type: "Tipo de vehículo",
  vehicle: "Vehículo",
  reservation: "Reserva",
  contract: "Contrato",
  customer: "Cliente",
  quote: "Cotización",
  user: "Usuario",
};

export function formatAuditAction(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function formatAuditEntity(entityType: string): string {
  return AUDIT_ENTITY_LABELS[entityType] ?? entityType;
}
