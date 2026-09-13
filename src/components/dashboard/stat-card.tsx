import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Card de indicador do painel, na mesma linguagem dos cards de escolha do wizard
 * (`.choice-card` em globals.css): ícone em contêiner, número grande e uma linha de
 * contexto real — nunca um número solto num bloco vazio.
 *
 * `tone` segue a regra de três níveis: `plain` para a maioria, `featured` (degradê
 * escuro-quente) para o mais relevante quando a tela já tem hero, `accent` (degradê do
 * acento) para o mais relevante quando a tela não tem outro bloco saturado.
 */
export function StatCard({ icon: Icon, label, value, hint, tone = "plain", signal, className }: { icon: LucideIcon; label: string; value: string; hint?: string; tone?: "plain" | "featured" | "accent"; signal?: ReactNode; className?: string }) {
  return (
    <div className={cn("choice-card flex min-w-0 flex-col gap-4 p-5", tone === "featured" && "choice-card--featured", tone === "accent" && "choice-card--accent", className)}>
      <div className="flex items-center gap-3">
        <span className="icon-tile size-9 shrink-0"><Icon className="size-4" aria-hidden="true" /></span>
        <p className="choice-muted truncate text-xs font-medium">{label}</p>
      </div>
      <div>
        <p className="font-heading text-[30px] font-semibold leading-none tracking-[-.045em]">{value}</p>
        {hint ? <p className="choice-muted mt-2 text-xs leading-5">{hint}</p> : null}
      </div>
      {signal ? <div className="mt-auto">{signal}</div> : null}
    </div>
  );
}
