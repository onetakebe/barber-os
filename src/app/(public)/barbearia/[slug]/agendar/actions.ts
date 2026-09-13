"use server";

import { z } from "zod";

import { BookingError } from "@/server/services/booking";
import { createPublicBooking } from "@/server/services/public-booking";

export type BookingActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string[]>;
  booking?: {
    appointmentId: string;
    serviceName: string;
    staffName: string;
    startsAt: string;
    totalCents: number;
    cancellationNoticeHours: number;
  };
};

const schema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().min(1),
  staffId: z.string().min(1),
  date: z.iso.date(),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  firstName: z.string().trim().min(2, "Informe seu nome."),
  lastName: z.string().trim().min(2, "Informe seu sobrenome."),
  email: z.union([z.literal(""), z.email("Informe um e-mail válido.")]),
  phone: z.string().trim().min(7, "Informe seu telefone."),
  policy: z.literal("on", { error: "Aceite a política de cancelamento." }),
});

export async function createPublicBookingAction(_state: BookingActionState, formData: FormData): Promise<BookingActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  try {
    const booking = await createPublicBooking(parsed.data);
    return { status: "success", message: "Reserva confirmada.", booking: { ...booking, startsAt: booking.startsAt.toISOString() } };
  } catch (error) {
    if (error instanceof BookingError && error.code === "SLOT_CONFLICT") return { status: "error", message: "Este horário acabou de ser ocupado. Escolha outro horário." };
    if (error instanceof BookingError && error.code === "RESOURCE_NOT_FOUND") return { status: "error", message: "Serviço ou barbearia não está mais disponível." };
    console.error("PUBLIC_BOOKING_FAILED", error);
    return { status: "error", message: "Não foi possível confirmar a reserva. Tente novamente." };
  }
}
