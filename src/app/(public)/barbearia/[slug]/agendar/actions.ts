"use server";

import { z } from "zod";

import { BOOKING_HORIZON_DAYS } from "@/server/data/public-booking";
import { BookingError, type BookingErrorCode } from "@/server/services/booking";
import { readServiceIds, type BookingServiceItem } from "@/server/services/booking-services";
import { createPublicBooking } from "@/server/services/public-booking";

export type BookingActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string[]>;
  booking?: {
    appointmentId: string;
    services: BookingServiceItem[];
    staffName: string;
    startsAt: string;
    endsAt: string;
    durationMinutes: number;
    currency: string;
    totalCents: number;
    cancellationNoticeHours: number;
  };
};

const schema = z.object({
  slug: z.string().min(1),
  serviceIds: z.array(z.string().min(1)).min(1, "Escolha pelo menos um serviço."),
  staffId: z.string().min(1),
  date: z.iso.date(),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  firstName: z.string().trim().min(2, "Informe seu nome."),
  lastName: z.string().trim().min(2, "Informe seu sobrenome."),
  email: z.union([z.literal(""), z.email("Informe um e-mail válido.")]),
  phone: z.string().trim().min(7, "Informe seu telefone."),
  policy: z.literal("on", { error: "Aceite a política de cancelamento." }),
});

const messages: Record<BookingErrorCode, string> = {
  SLOT_CONFLICT: "Este horário acabou de ser ocupado. Escolha outro horário.",
  RESOURCE_NOT_FOUND: "Serviço ou barbearia não está mais disponível.",
  INVALID_SERVICES: "Escolha pelo menos um serviço, sem repetir.",
  OUTSIDE_WINDOW: `Escolha um dia entre hoje e os próximos ${BOOKING_HORIZON_DAYS} dias.`,
};

export async function createPublicBookingAction(_state: BookingActionState, formData: FormData): Promise<BookingActionState> {
  // `serviceIds` vem repetido, um campo por serviço: `Object.fromEntries()` ficaria só com o último.
  const parsed = schema.safeParse({ ...Object.fromEntries(formData), serviceIds: readServiceIds(formData) });
  if (!parsed.success) return { status: "error", errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  try {
    const booking = await createPublicBooking(parsed.data);
    return { status: "success", message: "Reserva confirmada.", booking: { ...booking, startsAt: booking.startsAt.toISOString(), endsAt: booking.endsAt.toISOString() } };
  } catch (error) {
    if (error instanceof BookingError) return { status: "error", message: messages[error.code] };
    console.error("PUBLIC_BOOKING_FAILED", error);
    return { status: "error", message: "Não foi possível confirmar a reserva. Tente novamente." };
  }
}
