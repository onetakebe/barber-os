import type { AvailableSlot } from "@/server/services/availability";

export class BookingError extends Error {
  constructor(public readonly code: "SLOT_CONFLICT" | "RESOURCE_NOT_FOUND") {
    super(code);
  }
}

export function selectBookingSlot(slots: AvailableSlot[], time: string, requestedStaffId: string) {
  const slot = slots.find((item) => item.time === time && item.staffIds.length > 0);
  if (!slot) throw new BookingError("SLOT_CONFLICT");

  const staffId = requestedStaffId === "any" ? slot.staffIds[0] : requestedStaffId;
  if (!slot.staffIds.includes(staffId)) throw new BookingError("SLOT_CONFLICT");
  return { ...slot, staffId };
}
