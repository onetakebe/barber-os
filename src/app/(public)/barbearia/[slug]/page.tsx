import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  Clock3,
  LogIn,
  MapPin,
  Scissors,
  Star,
} from "lucide-react";

import { StaffPhoto } from "@/components/staff-photo";
import { getBookableDates, getPublicAvailability, getPublicBookingCatalog } from "@/server/data/public-booking";

const navItems = [
  { href: "#servicos", label: "Serviços" },
  { href: "#trabalhos", label: "Trabalhos" },
  { href: "#equipe", label: "Equipe" },
  { href: "#contato", label: "Contato" },
];

export default async function BusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await getPublicBookingCatalog(slug);
  if (!business) notFound();
  const bookingHref = `/barbearia/${slug}/agendar`;
  const firstDate = getBookableDates(business.timezone)[0]?.value;
  const nextAvailability = business.services[0] && firstDate ? await getPublicAvailability({ slug, date: firstDate, serviceId: business.services[0].id, staffId: "any" }) : null;
  const nextSlot = nextAvailability?.slots[0]?.time;
  const rating = business.reviews.length ? business.reviews.reduce((sum, review) => sum + review.rating, 0) / business.reviews.length : null;

  return (
    <main className="min-h-screen overflow-hidden bg-surface-base text-white">
      <div className="border-b border-white/10 bg-surface-base px-5 py-2.5 text-[10px] uppercase tracking-[.22em] text-white/65 lg:px-10">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
          <p>{business.address ?? "Endereço a configurar"} · {business.city ?? ""}</p>
          <p className="hidden sm:block">Ter — Sáb · 09:00 — 19:00</p>
        </div>
      </div>

      <header className="relative z-20 border-b border-white/10 bg-surface-base/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-[1500px] items-center justify-between px-5 lg:px-10">
          <Link href={`/barbearia/${slug}`} className="flex items-center gap-3" aria-label={`${business.name} — início`}>
            <span className="grid size-9 place-items-center rounded-full border border-white/25">
              <Scissors className="size-4" aria-hidden="true" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[.2em]">{business.name}</span>
          </Link>
          <nav aria-label="Navegação principal" className="hidden items-center gap-8 md:flex">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="text-[11px] uppercase tracking-[.16em] text-white/65 transition-colors hover:text-white">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/login" className="inline-flex h-10 items-center gap-2 px-2 text-[11px] uppercase tracking-[.16em] text-white/65 transition-colors hover:text-white">
              <LogIn className="size-3.5" aria-hidden="true" /> Entrar
            </Link>
            <Link
              href={bookingHref}
              className="group inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-[11px] font-semibold uppercase tracking-[.14em] text-black transition-colors hover:bg-surface-invert-muted"
            >
              Agendar <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 pb-12 pt-6 lg:px-10 lg:pb-16">
        <div className="relative grid overflow-hidden bg-surface-panel lg:grid-cols-[.9fr_1.1fr]">
          <div className="relative z-10 flex flex-col justify-center px-6 py-12 sm:px-10 sm:py-16 lg:min-h-[560px] lg:px-12">
            <p className="mb-8 flex items-center gap-2 text-[10px] uppercase tracking-[.2em] text-white/70"><span className="h-px w-8 bg-white/50" /> {business.city ?? "Seu clube"} · Barbearia</p>
            <h1 className="font-display text-[clamp(2.4rem,5.4vw,5.25rem)] uppercase leading-[.95] tracking-[-.055em]">Bom corte.<br />Boa conversa.</h1>
            <p className="mt-6 text-base text-white/80">Seu tempo. Seu estilo. Sua cadeira.</p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/65">{business.description ?? "Técnica, cuidado e um horário reservado para você."}</p>
            <Link href={bookingHref} className="mt-8 inline-flex min-h-12 w-fit items-center gap-5 rounded-lg bg-surface-invert px-6 text-sm font-medium text-black transition-colors hover:bg-surface-invert-muted">Escolher meu horário <ArrowRight className="size-4" /></Link>
          </div>
          <div className="image-grain relative min-h-[360px] sm:min-h-[440px] lg:min-h-[560px]">
            <Image src="/images/barber-welcome.webp" alt="Barbeiro e cliente compartilhando uma conversa durante o corte — imagem ilustrativa" fill loading="eager" fetchPriority="high" sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover object-[65%_center]" />
            <span className="absolute bottom-5 right-5 z-[3] rounded-full bg-black/60 px-3 py-1.5 text-[10px] text-white/85">Imagem ilustrativa</span>
          </div>
        </div>
        <div className="grid gap-5 border-b border-white/12 px-1 py-6 sm:grid-cols-3 sm:gap-8">
          <div className="flex items-center gap-3"><Star className="size-4" /><div><p className="text-sm">{rating ? `${rating.toFixed(1)} / 5` : "Novas avaliações"}</p><p className="mt-1 text-xs text-white/65">{business.reviews.length} avaliações públicas</p></div></div>
          <div className="flex items-center gap-3"><Clock3 className="size-4" /><div><p className="text-sm">{nextSlot ? `Próximo horário ${nextSlot}` : "Consulte a agenda"}</p><p className="mt-1 text-xs text-white/65">Escolha o melhor momento para você</p></div></div>
          <div className="flex items-center gap-3"><MapPin className="size-4" /><div><p className="text-sm">{business.city ?? "Localização"}</p><p className="mt-1 text-xs text-white/65">{business.address ?? "Endereço a configurar"}</p></div></div>
        </div>
      </section>

      <section id="servicos" className="scroll-mt-20 bg-surface-invert text-[#20201e]">
        <div className="mx-auto max-w-[1500px] px-5 py-14 lg:px-10 lg:py-20">
          <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div><p className="mb-3 text-xs uppercase tracking-[.18em] text-black/65">Serviços</p><h2 className="font-heading text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Encontre seu ritual.</h2></div>
            <p className="max-w-xs text-sm leading-6 text-black/65">Do primeiro detalhe ao acabamento.<br />Um cuidado que tem a sua cara.</p>
          </div>
          <div className="grid gap-8 lg:grid-cols-[1.25fr_.75fr] lg:gap-14">
            <div className="border-t border-black/15">
              {business.services.map((service) => (
                <Link key={service.id} href={`${bookingHref}?servico=${service.id}`} className="group grid grid-cols-[1fr_auto] items-center gap-4 border-b border-black/15 px-2 py-6 transition-colors hover:bg-black/5 sm:grid-cols-[1fr_auto_auto]">
                  <div><h3 className="font-heading text-lg font-semibold tracking-tight sm:text-xl">{service.name}</h3><p className="mt-1 text-xs leading-5 text-black/65">{service.description ?? "Cuidado e atenção em cada detalhe."}</p><p className="mt-2 text-xs text-black/65 sm:hidden">{service.durationMinutes} min</p></div>
                  <span className="hidden text-xs text-black/65 sm:block">{service.durationMinutes} min</span>
                  <span className="flex items-center gap-4 text-base font-semibold">€ {(service.priceCents / 100).toFixed(2)} <ArrowUpRight className="size-4" /></span>
                </Link>
              ))}
            </div>
            <figure className="relative min-h-72 overflow-hidden lg:min-h-full"><Image src="/images/barber-detail.png" alt="Detalhe do acabamento de uma barba com navalha" fill sizes="(max-width: 1024px) 100vw, 40vw" className="object-cover" /><figcaption className="absolute bottom-5 left-5 rounded-md bg-black/65 px-3 py-2 text-xs text-white">O cuidado está nos detalhes.</figcaption></figure>
          </div>
        </div>
      </section>

      <section id="trabalhos" className="surface-ambient scroll-mt-20 bg-surface-base">
        <div className="mx-auto max-w-[1500px] px-5 py-20 lg:px-10 lg:py-28">
          <div className="mb-10 flex items-end justify-between border-b border-white/15 pb-8">
            <div>
              <p className="mb-4 text-[10px] uppercase tracking-[.22em] text-white/65">02 / Trabalhos</p>
              <h2 className="font-display text-5xl uppercase leading-[.85] tracking-[-.055em] sm:text-7xl lg:text-8xl">Detalhe é<br />a diferença.</h2>
            </div>
            <a href="https://www.instagram.com" target="_blank" rel="noreferrer" className="hidden items-center gap-2 text-xs uppercase tracking-[.16em] sm:flex">
              <Camera className="size-4" /> @asbarberclub
            </a>
          </div>

          <div className="grid auto-rows-[220px] gap-3 sm:grid-cols-2 sm:auto-rows-[300px] lg:grid-cols-12 lg:auto-rows-[250px]">
            <figure className="image-grain relative overflow-hidden sm:row-span-2 lg:col-span-7">
              <Image src="/images/barber-detail.png" alt="Acabamento preciso de barba com navalha" fill loading="eager" sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover transition-transform duration-700 hover:scale-[1.02]" />
              <figcaption className="absolute bottom-4 left-4 z-[3] font-mono text-[9px] uppercase tracking-[.18em]">Navalha / acabamento</figcaption>
            </figure>
            <div className="flex flex-col justify-between bg-white p-7 text-black sm:row-span-1 lg:col-span-5">
              <Scissors className="size-6" />
              <p className="font-heading max-w-sm text-2xl font-semibold leading-tight tracking-[-.04em]">“Não existe bom corte sem entender primeiro quem vai usá-lo.”</p>
            </div>
            <figure className="image-grain relative overflow-hidden lg:col-span-5">
              <Image src="/images/barber-hero.png" alt="Atendimento no estúdio AS Barber Club" fill loading="eager" sizes="(max-width: 1024px) 100vw, 40vw" className="object-cover object-right transition-transform duration-700 hover:scale-[1.02]" />
              <figcaption className="absolute bottom-4 left-4 z-[3] font-mono text-[9px] uppercase tracking-[.18em]">Corte / textura</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className="bg-surface-invert text-black">
        <div className="mx-auto grid max-w-[1500px] gap-12 px-5 py-20 lg:grid-cols-[1fr_1fr] lg:px-10 lg:py-28">
          <div className="relative min-h-[520px] overflow-hidden bg-surface-invert-muted">
            <Image src="/images/barber-team.png" alt="Equipe de quatro barbeiros do AS Barber Club" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover object-center grayscale" />
            <span className="absolute bottom-5 left-5 bg-white px-4 py-2 font-mono text-[9px] uppercase tracking-[.18em]">Equipe / 2026</span>
          </div>
          <div className="flex flex-col justify-between lg:py-4">
            <div>
              <p className="mb-5 text-[10px] font-semibold uppercase tracking-[.22em] text-black/65">03 / Sobre o clube</p>
              <h2 className="font-display text-5xl uppercase leading-[.85] tracking-[-.055em] sm:text-7xl">Bom corte.<br />Boa conversa.<br />Sem excessos.</h2>
              <p className="mt-8 max-w-xl text-base leading-7 text-black/60">
                Criamos um lugar para desacelerar e sair melhor do que entrou. Nossa equipe combina repertório clássico, observação e técnica para construir um visual que funciona na sua rotina.
              </p>
            </div>
            <div className="mt-12 grid grid-cols-2 border-y border-black/20">
              <div className="border-r border-black/20 py-6 pr-6"><p className="font-display text-5xl tracking-[-.05em]">{business.staff.length}</p><p className="mt-2 text-[10px] uppercase tracking-[.16em] text-black/65">Profissionais disponíveis</p></div>
              <div className="py-6 pl-6"><p className="font-display text-5xl tracking-[-.05em]">{business.services.length}</p><p className="mt-2 text-[10px] uppercase tracking-[.16em] text-black/65">Serviços online</p></div>
            </div>
          </div>
        </div>
      </section>

      <section id="equipe" className="surface-ambient scroll-mt-20 border-t border-white/10 bg-surface-panel">
        <div className="mx-auto max-w-[1500px] px-5 py-20 lg:px-10 lg:py-28">
          <div className="mb-10 grid gap-6 lg:grid-cols-2">
            <div><p className="mb-4 text-[10px] uppercase tracking-[.22em] text-white/65">04 / Equipe</p><h2 className="font-display text-5xl uppercase leading-[.85] tracking-[-.055em] sm:text-7xl">Escolha<br />sua cadeira.</h2></div>
            <p className="max-w-md self-end text-sm leading-6 text-white/65 lg:justify-self-end">Estilos diferentes. A mesma atenção a você e ao acabamento.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {business.staff.map((member, index) => (
              <Link key={member.id} href={`${bookingHref}?profissional=${member.id}`} className="group flex flex-col overflow-hidden rounded-xl border border-white/12 bg-surface-raised transition-colors hover:bg-surface-invert hover:text-black">
                <div className="image-grain relative aspect-[4/5] overflow-hidden bg-current/[.04]">
                  {member.imageUrl ? (
                    <StaffPhoto
                      src={member.imageUrl}
                      alt={`${member.displayName}, ${member.title ?? "profissional"}`}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.025]"
                    />
                  ) : (
                    <span className="font-display absolute left-5 top-3 text-6xl text-current/15" aria-hidden="true">0{index + 1}</span>
                  )}
                </div>
                <div className="flex items-start justify-between gap-3 p-6">
                  <div>
                    <h3 className="font-heading text-xl font-semibold tracking-[-.035em]">{member.displayName}</h3>
                    <p className="mt-1 text-xs text-current/70">{member.title ?? "Profissional"} · agenda online</p>
                    {member.rating ? (
                      <p className="mt-3 flex items-center gap-1.5 font-mono text-[11px]">
                        <Star className="size-3 fill-current" aria-hidden="true" />
                        {member.rating.toFixed(1)}
                        <span className="text-current/65">· {member.reviewCount} {member.reviewCount === 1 ? "avaliação" : "avaliações"}</span>
                      </p>
                    ) : (
                      <p className="mt-3 font-mono text-[11px] text-current/65">Sem avaliações ainda</p>
                    )}
                  </div>
                  <ArrowUpRight className="size-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="surface-ambient-invert bg-surface-invert text-black">
        <div className="mx-auto max-w-[1500px] px-5 py-20 lg:px-10 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[.55fr_1.45fr]">
            <div>
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-[.22em] text-black/65">05 / Clientes</p>
              <h2 className="font-display text-5xl uppercase leading-[.85] tracking-[-.055em] sm:text-7xl">Quem senta,<br />volta.</h2>
              <div className="mt-8 flex items-center gap-3"><div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, index) => <Star key={index} className="size-3.5 fill-black" />)}</div><span className="font-mono text-xs">{rating ? `${rating.toFixed(1)} · avaliações públicas` : "Ainda sem avaliações"}</span></div>
            </div>
            <div className="grid border-l border-t border-black/20 md:grid-cols-3">
              {business.reviews.map((review, index) => (
                <figure key={review.id} className="flex min-h-64 flex-col justify-between border-b border-r border-black/20 p-6">
                  <span className="font-display text-4xl text-black/15" aria-hidden="true">“</span>
                  <blockquote className="text-sm leading-6 text-black/65">{review.comment ?? "Avaliação verificada após atendimento."}</blockquote>
                  <figcaption className="flex items-center justify-between border-t border-black/15 pt-4 text-[10px] uppercase tracking-[.14em]"><span>{review.customer.firstName} {review.customer.lastName.slice(0, 1)}.</span><span>{review.rating}/5 · 0{index + 1}</span></figcaption>
                </figure>
              ))}
              {business.reviews.length === 0 ? <div className="col-span-full border-b border-r border-black/20 p-10 text-sm text-black/55">As avaliações públicas aparecerão aqui após os atendimentos.</div> : null}
            </div>
          </div>

          <div className="mt-20 grid overflow-hidden bg-black text-white lg:grid-cols-[1fr_auto]">
            <div className="p-8 sm:p-12"><p className="mb-5 text-[10px] uppercase tracking-[.2em] text-white/65">Seu horário</p><h3 className="font-display max-w-4xl text-5xl uppercase leading-[.85] tracking-[-.055em] sm:text-7xl">Seu próximo corte<br />começa por aqui.</h3></div>
            <Link href={bookingHref} className="group flex min-h-48 items-center justify-center gap-3 border-t border-white/20 px-10 text-xs font-semibold uppercase tracking-[.16em] transition-colors hover:bg-white hover:text-black lg:min-h-full lg:border-l lg:border-t-0">
              Agendar agora <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      <section id="contato" className="surface-ambient scroll-mt-20 bg-surface-base">
        <div className="mx-auto max-w-[1500px] px-5 py-20 lg:px-10 lg:py-28">
          <div className="grid gap-12 border-t border-white/15 pt-10 lg:grid-cols-2">
            <div>
              <p className="mb-5 text-[10px] uppercase tracking-[.22em] text-white/65">06 / Contato</p>
              <h2 className="font-display text-6xl uppercase leading-[.82] tracking-[-.06em] sm:text-8xl lg:text-9xl">A cadeira<br />está pronta.</h2>
              <Link href={bookingHref} className="group mt-10 inline-flex h-14 items-center gap-4 rounded-full bg-white px-7 text-xs font-semibold uppercase tracking-[.16em] text-black hover:bg-surface-invert-muted">Escolher horário <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></Link>
            </div>
            <div className="grid gap-8 border-l border-white/15 pl-6 sm:grid-cols-2 sm:pl-10">
              <div><p className="text-[10px] uppercase tracking-[.18em] text-white/65">Endereço</p><p className="mt-4 max-w-xs text-sm leading-6">{business.address ?? "A configurar"}<br />{business.city ?? ""}</p><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${business.address ?? ""} ${business.city ?? ""}`)}`} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 border-b border-white/40 pb-1 text-xs">Abrir no mapa <ArrowUpRight className="size-3" /></a></div>
              <div><p className="text-[10px] uppercase tracking-[.18em] text-white/65">Horários</p><div className="mt-4 space-y-2 text-sm"><p className="flex justify-between gap-8"><span>Ter — Sex</span><span className="text-white/65">09 — 19h</span></p><p className="flex justify-between gap-8"><span>Sábado</span><span className="text-white/65">09 — 18h</span></p><p className="flex justify-between gap-8"><span>Dom — Seg</span><span className="text-white/65">Fechado</span></p></div></div>
              <div><p className="text-[10px] uppercase tracking-[.18em] text-white/65">Telefone</p>{business.phone ? <a href={`tel:${business.phone.replaceAll(" ", "")}`} className="mt-4 block text-sm hover:underline">{business.phone}</a> : <p className="mt-4 text-sm text-white/65">A configurar</p>}</div>
              <div><p className="text-[10px] uppercase tracking-[.18em] text-white/65">Social</p><a href="https://www.instagram.com" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm hover:underline"><Camera className="size-4" /> @asbarberclub</a></div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-5 py-8 lg:px-10">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 text-[9px] uppercase tracking-[.18em] text-white/65 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 {business.name}</p>
          <p>{business.city ?? ""} · Feito para durar</p>
        </div>
      </footer>
    </main>
  );
}
