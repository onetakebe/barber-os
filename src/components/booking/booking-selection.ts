/* Regras puras da seleção do wizard público — sem React, para testar com objetos simples. */

export type BookingSelection = { serviceIds: string[]; staffId: string };

type SelectionCatalog = {
  services: { id: string }[];
  staff: { id: string; serviceIds: string[] }[];
  /** Entrada `?servico=id` da página pública: pré-seleciona um serviço. */
  initialServiceId?: string;
  initialStaffId?: string;
};

/** Um barbeiro só faz a reserva inteira: precisa estar habilitado em todos os serviços escolhidos. */
export function doesAll(member: { serviceIds: string[] }, serviceIds: string[]) {
  return serviceIds.every((id) => member.serviceIds.includes(id));
}

/** `?servico=` pré-seleciona um serviço; sem ele (ou com id fora do catálogo público, que só
 *  tem serviços ativos) a seleção começa vazia. O profissional da URL só vale se fizer esse serviço. */
export function initialSelection(catalog: SelectionCatalog): BookingSelection {
  const serviceIds = catalog.services.some((item) => item.id === catalog.initialServiceId) ? [catalog.initialServiceId!] : [];
  const staff = catalog.staff.find((item) => item.id === catalog.initialStaffId);
  return { serviceIds, staffId: staff && doesAll(staff, serviceIds) ? staff.id : "any" };
}

/** Alterna um card. O profissional já escolhido pode não fazer o serviço recém-incluído: volta
 *  para "qualquer". */
export function toggleSelection(current: BookingSelection, id: string, catalog: Pick<SelectionCatalog, "staff">): BookingSelection {
  const serviceIds = current.serviceIds.includes(id) ? current.serviceIds.filter((item) => item !== id) : [...current.serviceIds, id];
  const keepsStaff = current.staffId === "any" || catalog.staff.some((member) => member.id === current.staffId && doesAll(member, serviceIds));
  return { serviceIds, staffId: keepsStaff ? current.staffId : "any" };
}
