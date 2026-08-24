import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import {
  getVehicle,
  getVehicleRelated,
  type VehicleProfileRelated,
} from "@/app/dashboard/vehiculos/actions";
import { VehicleDetailActions } from "@/app/dashboard/vehiculos/[id]/vehicle-actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatAppDate, formatAppDateTime } from "@/lib/dates";
import {
  EXPENSE_CATEGORY_LABELS,
  INCOME_TYPE_LABELS,
  MAINTENANCE_TYPE_LABELS,
} from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { isSupabaseConfigured } from "@/lib/env";
import type {
  Contract,
  ExpenseTransaction,
  IncomeTransaction,
  Inspection,
  MaintenanceRecord,
  Reservation,
  Vehicle,
  VehicleMileageHistory,
} from "@/types/database";

function EmptyTab({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-8 text-center text-sm text-muted">
        {message}
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <p>
      <span className="text-muted">{label}:</span> {value || "—"}
    </p>
  );
}

function TechnicalTab({
  vehicle,
  vehicleTypeName,
}: {
  vehicle: Vehicle;
  vehicleTypeName: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Datos técnicos</CardTitle>
          <StatusBadge status={vehicle.status} />
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <InfoRow label="Placa" value={vehicle.plate} />
        <InfoRow label="Marca / modelo" value={`${vehicle.brand} ${vehicle.model}`} />
        <InfoRow label="Año" value={vehicle.year} />
        <InfoRow label="Categoría" value={vehicle.category} />
        <InfoRow label="Tipo catálogo" value={vehicleTypeName} />
        <InfoRow label="Color" value={vehicle.color} />
        <InfoRow label="VIN" value={vehicle.vin} />
        <InfoRow label="Chasis" value={vehicle.chassis} />
        <InfoRow label="Motor" value={vehicle.engine} />
        <InfoRow label="Aceite de motor" value={vehicle.engine_oil} />
        <InfoRow label="Llantas" value={vehicle.tire_info} />
        <InfoRow
          label="Kilometraje actual"
          value={
            vehicle.current_mileage != null
              ? `${vehicle.current_mileage.toLocaleString("es-SV")} km`
              : null
          }
        />
        <InfoRow label="Transmisión" value={vehicle.transmission} />
        <InfoRow label="Combustible" value={vehicle.fuel_type} />
        <InfoRow label="Pasajeros" value={vehicle.passengers} />
        <InfoRow label="Puertas" value={vehicle.doors} />
        <InfoRow label="Equipaje" value={vehicle.luggage} />
        <InfoRow
          label="A/C"
          value={vehicle.air_conditioning ? "Sí" : "No"}
        />
        <InfoRow label="Tarifa/día" value={formatMoney(vehicle.daily_rate)} />
        <InfoRow
          label="Tarifa/semana"
          value={
            vehicle.weekly_rate != null ? formatMoney(vehicle.weekly_rate) : null
          }
        />
        <InfoRow label="Depósito" value={formatMoney(vehicle.deposit)} />
        <InfoRow
          label="Web"
          value={
            vehicle.published_on_web
              ? `Publicado como tipo${vehicle.category ? ` (${vehicle.category})` : ""} — no se muestra la placa`
              : "No publicado"
          }
        />
        {vehicle.public_description ? (
          <p className="sm:col-span-2 lg:col-span-3">
            <span className="text-muted">Descripción:</span>{" "}
            {vehicle.public_description}
          </p>
        ) : null}
        {vehicle.internal_notes ? (
          <p className="sm:col-span-2 lg:col-span-3">
            <span className="text-muted">Notas internas:</span>{" "}
            {vehicle.internal_notes}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReservationsTab({ reservations }: { reservations: Reservation[] }) {
  if (reservations.length === 0) {
    return <EmptyTab message="No hay reservas vinculadas a este vehículo." />;
  }
  return (
    <Card>
      <CardContent className="divide-y divide-border p-0">
        {reservations.map((reservation) => (
          <Link
            key={reservation.id}
            href={`/dashboard/reservas/${reservation.id}`}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-surface-muted"
          >
            <div>
              <p className="font-medium">{reservation.code}</p>
              <p className="text-muted">
                {formatAppDate(reservation.start_at)} –{" "}
                {formatAppDate(reservation.end_at)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-medium">{formatMoney(reservation.total)}</span>
              <StatusBadge status={reservation.status} />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function ContractsTab({ contracts }: { contracts: Contract[] }) {
  if (contracts.length === 0) {
    return <EmptyTab message="No hay contratos vinculados a este vehículo." />;
  }
  return (
    <Card>
      <CardContent className="divide-y divide-border p-0">
        {contracts.map((contract) => (
          <Link
            key={contract.id}
            href={`/dashboard/contratos/${contract.id}`}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-surface-muted"
          >
            <div>
              <p className="font-medium">{contract.code}</p>
              <p className="text-muted">
                {formatAppDate(contract.start_at)} –{" "}
                {formatAppDate(contract.end_at)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-medium">{formatMoney(contract.total)}</span>
              <StatusBadge status={contract.status} />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function InspectionsTab({ inspections }: { inspections: Inspection[] }) {
  if (inspections.length === 0) {
    return (
      <EmptyTab message="No hay inspecciones registradas para este vehículo." />
    );
  }
  return (
    <Card>
      <CardContent className="divide-y divide-border p-0">
        {inspections.map((inspection) => (
          <Link
            key={inspection.id}
            href={`/dashboard/inspecciones/${inspection.id}`}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-surface-muted"
          >
            <div>
              <p className="font-medium">{inspection.code}</p>
              <p className="text-muted">
                {inspection.type === "CHECK_OUT" ? "Salida" : "Entrada"} ·{" "}
                {formatAppDateTime(inspection.inspection_date)}
              </p>
            </div>
            <span className="text-muted">
              {inspection.mileage != null
                ? `${inspection.mileage.toLocaleString("es-SV")} km`
                : "—"}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

const MILEAGE_SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  CHECK_OUT: "Salida",
  CHECK_IN: "Entrada",
  MAINTENANCE: "Mantenimiento",
  OTHER: "Otro",
};

function MileageTab({
  currentMileage,
  history,
  catalogReady,
}: {
  currentMileage: number | null;
  history: VehicleMileageHistory[];
  catalogReady: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Kilometraje actual</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">
          {currentMileage != null
            ? `${currentMileage.toLocaleString("es-SV")} km`
            : "—"}
        </CardContent>
      </Card>
      {!catalogReady && history.length === 0 ? (
        <EmptyTab message="El historial de kilometraje aún no está disponible (migración pendiente)." />
      ) : history.length === 0 ? (
        <EmptyTab message="Sin lecturas de kilometraje registradas." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {history.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {row.mileage.toLocaleString("es-SV")} km
                  </p>
                  <p className="text-muted">
                    {MILEAGE_SOURCE_LABELS[row.source] ?? row.source}
                    {row.notes ? ` · ${row.notes}` : ""}
                  </p>
                </div>
                <span className="text-muted">
                  {formatAppDateTime(row.recorded_at)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MaintenanceTab({ records }: { records: MaintenanceRecord[] }) {
  if (records.length === 0) {
    return (
      <EmptyTab message="No hay mantenimientos registrados para este vehículo." />
    );
  }
  return (
    <Card>
      <CardContent className="divide-y divide-border p-0">
        {records.map((record) => (
          <Link
            key={record.id}
            href={`/dashboard/mantenimiento/${record.id}`}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-surface-muted"
          >
            <div>
              <p className="font-medium">
                {MAINTENANCE_TYPE_LABELS[record.type] ?? record.type}
              </p>
              <p className="text-muted">
                {formatAppDate(record.maintenance_date)} · {record.description}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-medium">{formatMoney(record.cost)}</span>
              <StatusBadge status={record.status} />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function ExpensesTab({ expenses }: { expenses: ExpenseTransaction[] }) {
  if (expenses.length === 0) {
    return <EmptyTab message="No hay gastos vinculados a este vehículo." />;
  }
  return (
    <Card>
      <CardContent className="divide-y divide-border p-0">
        {expenses.map((expense) => (
          <div
            key={expense.id}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
          >
            <div>
              <p className="font-medium">{expense.concept}</p>
              <p className="text-muted">
                {EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category} ·{" "}
                {formatAppDate(expense.expense_date)}
              </p>
            </div>
            <span className="font-medium">{formatMoney(expense.amount)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function IncomesTab({ incomes }: { incomes: IncomeTransaction[] }) {
  if (incomes.length === 0) {
    return <EmptyTab message="No hay ingresos vinculados a este vehículo." />;
  }
  return (
    <Card>
      <CardContent className="divide-y divide-border p-0">
        {incomes.map((income) => (
          <div
            key={income.id}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
          >
            <div>
              <p className="font-medium">
                {INCOME_TYPE_LABELS[income.type] ?? income.type}
              </p>
              <p className="text-muted">
                {formatAppDate(income.transaction_date)}
                {income.reference ? ` · ${income.reference}` : ""}
              </p>
            </div>
            <span className="font-medium">{formatMoney(income.amount)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function BalanceTab({ related }: { related: VehicleProfileRelated }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Balance de rentabilidad</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-sm text-muted">Ingresos</p>
          <p className="text-xl font-semibold text-emerald-700">
            {formatMoney(related.incomeTotal)}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted">Gastos</p>
          <p className="text-xl font-semibold text-red-700">
            {formatMoney(related.expenseTotal)}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted">Balance</p>
          <p
            className={`text-xl font-semibold ${
              related.balance >= 0 ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {formatMoney(related.balance)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function VehiculoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const configured = isSupabaseConfigured();
  const result = configured ? await getVehicle(id) : null;

  if (configured && result && !result.success) notFound();
  const vehicle = result?.success ? result.data : null;

  const relatedResult =
    configured && vehicle ? await getVehicleRelated(id) : null;
  const related: VehicleProfileRelated = relatedResult?.success
    ? relatedResult.data
    : {
        reservations: [],
        contracts: [],
        inspections: [],
        maintenance: [],
        expenses: [],
        incomes: [],
        mileageHistory: [],
        vehicleTypeName: null,
        incomeTotal: 0,
        expenseTotal: 0,
        balance: 0,
        catalogReady: true,
      };

  return (
    <PermissionGuard permission="vehicles.view">
      <div className="space-y-6">
        <PageHeader
          title={
            vehicle
              ? `${vehicle.brand} ${vehicle.model} ${vehicle.year}`
              : "Vehículo"
          }
          description={
            vehicle
              ? `Perfil de flota · ${vehicle.plate}`
              : "Perfil de flota del vehículo"
          }
          breadcrumbs={[
            { label: "Vehículos", href: "/dashboard/vehiculos" },
            { label: vehicle?.plate ?? "Detalle" },
          ]}
          actions={
            vehicle ? (
              <Link
                href={`/dashboard/vehiculos/${id}/edit`}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
              >
                Editar
              </Link>
            ) : null
          }
        />

        {!configured ? (
          <SetupBanner />
        ) : vehicle ? (
          <Tabs defaultValue="tech">
            <TabsList className="flex h-auto flex-wrap">
              <TabsTrigger value="tech">Datos técnicos</TabsTrigger>
              <TabsTrigger value="photos">
                Fotografías ({vehicle.images.length})
              </TabsTrigger>
              <TabsTrigger value="reservations">
                Reservas ({related.reservations.length})
              </TabsTrigger>
              <TabsTrigger value="contracts">
                Contratos ({related.contracts.length})
              </TabsTrigger>
              <TabsTrigger value="inspections">
                Inspecciones ({related.inspections.length})
              </TabsTrigger>
              <TabsTrigger value="mileage">Kilometraje</TabsTrigger>
              <TabsTrigger value="maintenance">
                Mantenimientos ({related.maintenance.length})
              </TabsTrigger>
              <TabsTrigger value="expenses">
                Gastos ({related.expenses.length})
              </TabsTrigger>
              <TabsTrigger value="incomes">
                Ingresos ({related.incomes.length})
              </TabsTrigger>
              <TabsTrigger value="balance">Balance</TabsTrigger>
            </TabsList>

            <TabsContent value="tech">
              <TechnicalTab
                vehicle={vehicle}
                vehicleTypeName={related.vehicleTypeName}
              />
            </TabsContent>
            <TabsContent value="photos">
              <VehicleDetailActions vehicle={vehicle} />
            </TabsContent>
            <TabsContent value="reservations">
              <ReservationsTab reservations={related.reservations} />
            </TabsContent>
            <TabsContent value="contracts">
              <ContractsTab contracts={related.contracts} />
            </TabsContent>
            <TabsContent value="inspections">
              <InspectionsTab inspections={related.inspections} />
            </TabsContent>
            <TabsContent value="mileage">
              <MileageTab
                currentMileage={vehicle.current_mileage}
                history={related.mileageHistory}
                catalogReady={related.catalogReady}
              />
            </TabsContent>
            <TabsContent value="maintenance">
              <MaintenanceTab records={related.maintenance} />
            </TabsContent>
            <TabsContent value="expenses">
              <PermissionGuard permission="finance.view">
                <ExpensesTab expenses={related.expenses} />
              </PermissionGuard>
            </TabsContent>
            <TabsContent value="incomes">
              <PermissionGuard permission="finance.view">
                <IncomesTab incomes={related.incomes} />
              </PermissionGuard>
            </TabsContent>
            <TabsContent value="balance">
              <PermissionGuard permission="finance.view">
                <BalanceTab related={related} />
              </PermissionGuard>
            </TabsContent>
          </Tabs>
        ) : null}
      </div>
    </PermissionGuard>
  );
}
