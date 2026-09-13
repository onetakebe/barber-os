import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type StaffFace = { imageUrl?: string | null; initials: string; color?: string | null };

/**
 * O rosto do profissional, igual em toda tela onde ele aparece.
 * `AvatarImage` do Radix é um <img> comum, então URL de qualquer host funciona sem
 * configurar `images.remotePatterns` — foto de profissional é dado do tenant.
 * Sem foto, cai nas iniciais com a cor do profissional como anel: a cor nunca é o
 * único portador da identidade, o nome vem sempre ao lado.
 */
export function StaffAvatar({ imageUrl, initials, color, className }: StaffFace & { className?: string }) {
  // O `rounded-none` do contêiner não basta: o AvatarImage do shadcn traz `rounded-full`
  // próprio e o contêiner ainda desenha um anel `after:rounded-full`. Sem zerar os três,
  // a classe fica no DOM e a foto continua redonda — a armadilha de sempre com shadcn.
  return (
    <Avatar className={cn("size-8 shrink-0 overflow-hidden rounded-none after:rounded-none", className)}>
      <AvatarImage src={imageUrl ?? undefined} alt="" className="rounded-none object-cover" />
      <AvatarFallback
        className="rounded-none text-[10px] font-medium"
        style={color ? { boxShadow: `inset 0 0 0 1px ${color}` } : undefined}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

export function staffInitials(name: string) {
  return name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}
