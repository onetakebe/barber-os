import Link from "next/link";
import { notFound } from "next/navigation";

import { BookingWizard } from "@/components/booking/booking-wizard";
import { BrandMark } from "@/components/brand-mark";
import { getBookableDates, getPublicBookingCatalog } from "@/server/data/public-booking";

export default async function BookingPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ servico?: string; profissional?: string }> }) {
  const { slug } = await params;
  const selection = await searchParams;
  const catalog = await getPublicBookingCatalog(slug);
  if (!catalog) notFound();
  const dates = getBookableDates(catalog.timezone);
  const bookingCatalog = {
    business: { name: catalog.name, slug: catalog.slug, timezone: catalog.timezone, defaultDepositCents: catalog.defaultDepositCents, cancellationNoticeHours: catalog.cancellationNoticeHours },
    services: catalog.services,
    staff: catalog.staff.map((member) => ({ id: member.id, displayName: member.displayName, title: member.title, imageUrl: member.imageUrl, rating: member.rating, reviewCount: member.reviewCount, serviceIds: member.services.map((service) => service.serviceId) })),
    dates,
    initialServiceId: selection.servico,
    initialStaffId: selection.profissional,
  };
  return <main className="min-h-screen"><nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><Link href={`/barbearia/${catalog.slug}`}><BrandMark /></Link><p className="text-xs text-muted-foreground">Reserva segura · {catalog.name}</p></nav><section className="px-5 pb-16 pt-4"><BookingWizard catalog={bookingCatalog} /></section></main>;
}
