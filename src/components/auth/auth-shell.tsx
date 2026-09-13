import Link from "next/link";
import { ArrowLeft, Scissors } from "lucide-react";

/* Casca das telas de acesso (13/09/2026), a partir da referência do usuário:
   cabeçalho escuro com padrão geométrico e o logo em squircle, folha clara
   com canto superior esquerdo arredondado por cima do cabeçalho, campos em
   caixas. Reutilizada por login, cadastro e recuperação. */
export function AuthShell({ title, back, children }: { title: string; back?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <section className="w-full max-w-[400px] overflow-hidden rounded-[28px] bg-[#0f0e0d] shadow-[0_40px_120px_-40px_rgb(0_0_0/.9)] ring-1 ring-white/10">
      <div className="auth-pattern relative flex h-40 items-center justify-center">
        {back ? (
          <Link href={back.href} aria-label={back.label} className="absolute left-5 top-5 grid size-10 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white">
            <ArrowLeft className="size-5" />
          </Link>
        ) : null}
        {back ? (
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-white">{title}</h1>
        ) : (
          <Link href="/" aria-label="AS Barber Club — início" className="grid size-16 place-items-center rounded-[20px] bg-white text-black shadow-lg">
            <Scissors className="size-7" aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="light-panel -mt-7 rounded-t-[36px] px-6 pb-8 pt-8 sm:px-8">
        {back ? null : <h1 className="font-heading mb-7 text-center text-[26px] font-semibold tracking-tight">{title}</h1>}
        {children}
      </div>
    </section>
  );
}
