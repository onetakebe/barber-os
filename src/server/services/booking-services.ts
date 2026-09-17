import type { ScopedDb } from "@/server/db";
import { BookingError } from "@/server/services/booking";

export type BookingServiceItem = { id: string; name: string; priceCents: number; durationMinutes: number };
export type BookingServices = { items: BookingServiceItem[]; durationMinutes: number; totalCents: number };

/** Entrada de quem escolhe serviços: a reserva pública manda a lista; a agenda interna, a fila
 *  de espera e o próximo horário da página pública continuam mandando um `serviceId` só. */
export type ServiceSelection = { serviceIds: string[]; serviceId?: never } | { serviceId: string; serviceIds?: never };

export function normalizeServiceIds(input: ServiceSelection): string[] {
  return input.serviceIds ?? [input.serviceId];
}

/** Campo repetido `serviceIds` de um formulário ou query string. `Object.fromEntries()` sozinho
 *  fica só com o último valor. O `serviceId` único dos consumidores internos segue valendo. */
export function readServiceIds(source: { getAll(name: string): (string | File)[] }): string[] {
  const values = (name: string) => source.getAll(name).filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter((value) => value.length > 0);
  const repeated = values("serviceIds");
  return repeated.length ? repeated : values("serviceId");
}

/** Um barbeiro faz todos os serviços em sequência: cada card é um item indivisível, com o preço e
 *  a duração do cadastro. Rejeita lista vazia, id repetido e serviço inativo, excluído ou de outra
 *  barbearia (a trava do banco já esconde o alheio: ele simplesmente não aparece). */
export async function resolveBookingServices(db: ScopedDb, tenantId: string, serviceIds: string[]): Promise<BookingServices> {
  if (serviceIds.length === 0 || new Set(serviceIds).size !== serviceIds.length) throw new BookingError("INVALID_SERVICES");

  const records = await db.service.findMany({
    where: { id: { in: serviceIds }, tenantId, isActive: true, deletedAt: null },
    select: { id: true, name: true, priceCents: true, durationMinutes: true },
  });
  const byId = new Map(records.map((service) => [service.id, service]));
  const items = serviceIds.map((id) => byId.get(id)).filter((item): item is BookingServiceItem => item !== undefined);
  if (items.length !== serviceIds.length) throw new BookingError("RESOURCE_NOT_FOUND");

  return {
    items,
    durationMinutes: items.reduce((sum, item) => sum + item.durationMinutes, 0),
    totalCents: items.reduce((sum, item) => sum + item.priceCents, 0),
  };
}
