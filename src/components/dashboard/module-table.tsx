"use client";

import { useActionState, useMemo, useState } from "react";
import { Archive, Filter, Gift, PackagePlus, Search } from "lucide-react";

import { adjustInventoryAction, archiveModuleRecordAction, redeemRewardAction, type ModuleActionState } from "@/app/(dashboard)/actions";
import { AppointmentCancelButton } from "@/components/dashboard/appointment-actions";
import { EditModuleRecordDialog } from "@/components/dashboard/module-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { filterRows } from "@/domain/search/filter-rows";
import { StaffAvatar } from "@/components/staff-avatar";
import type { ModuleSlug, RowAvatar } from "@/server/data/module-data";

type Row = { id: string; cells: string[]; avatars?: Record<number, RowAvatar>; edit?: Record<string, string | number> };
const initialState: ModuleActionState = { status: "idle" };
const archiveModules: ModuleSlug[] = ["clientes", "equipe", "servicos", "produtos"];

function ArchiveButton({ id, module }: { id: string; module: "clientes" | "equipe" | "servicos" | "produtos" }) {
  const [state, action, pending] = useActionState(archiveModuleRecordAction, initialState);
  return <form action={action} className="flex flex-col items-end gap-1"><input type="hidden" name="id" value={id} /><input type="hidden" name="module" value={module} /><Button type="submit" size="sm" variant="ghost" disabled={pending}><Archive data-icon="inline-start" />Arquivar</Button>{state.message ? <span className={state.status === "success" ? "text-[10px] text-primary" : "text-[10px] text-destructive"}>{state.message}</span> : null}</form>;
}

function InventoryButton({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState(adjustInventoryAction, initialState);
  return <form action={action} className="flex items-center justify-end gap-1"><input type="hidden" name="productId" value={productId} /><input type="hidden" name="reason" value="Ajuste rápido no módulo de produtos" /><Input aria-label="Quantidade do ajuste" name="quantity" type="number" defaultValue="1" className="h-8 w-16" /><Button type="submit" size="sm" variant="outline" disabled={pending}><PackagePlus /><span className="sr-only">Ajustar estoque</span></Button>{state.message ? <span className={state.status === "success" ? "max-w-28 text-[10px] text-primary" : "max-w-28 text-[10px] text-destructive"}>{state.message}</span> : null}</form>;
}

function RedeemButton({ customerId }: { customerId: string }) {
  const [state, action, pending] = useActionState(redeemRewardAction, initialState);
  return <form action={action} className="flex flex-col items-end gap-1"><input type="hidden" name="customerId" value={customerId} /><Button type="submit" size="sm" variant="outline" disabled={pending}><Gift data-icon="inline-start" />Resgatar</Button>{state.message ? <span className={state.status === "success" ? "max-w-36 text-right text-[10px] text-primary" : "max-w-36 text-right text-[10px] text-destructive"}>{state.message}</span> : null}</form>;
}

function RowActions({ row, module }: { row: Row; module: ModuleSlug }) {
  if (module === "agendamentos") return <AppointmentCancelButton appointmentId={row.id} />;
  if (module === "produtos") return <div className="flex flex-wrap items-start justify-end gap-1">{row.edit ? <EditModuleRecordDialog module="produtos" id={row.id} defaults={row.edit} /> : null}<InventoryButton productId={row.id} /><ArchiveButton id={row.id} module="produtos" /></div>;
  if (module === "fidelidade") return <RedeemButton customerId={row.id} />;
  if (archiveModules.includes(module)) return <div className="flex flex-wrap items-start justify-end gap-1">{row.edit ? <EditModuleRecordDialog module={module as "clientes" | "equipe" | "servicos"} id={row.id} defaults={row.edit} /> : null}<ArchiveButton id={row.id} module={module as "clientes" | "equipe" | "servicos"} /></div>;
  return null;
}

export function ModuleTable({ module, columns, rows, canMutate }: { module: ModuleSlug; columns: readonly string[]; rows: Row[]; canMutate: boolean }) {
  const [query, setQuery] = useState("");
  const [highlightsOnly, setHighlightsOnly] = useState(false);
  const hasActions = canMutate && (["agendamentos", "clientes", "equipe", "servicos", "produtos", "fidelidade"] as ModuleSlug[]).includes(module);
  const visibleRows = useMemo(() => {
    const filtered = rows.filter((row) => filterRows([row.cells], query).length > 0);
    return highlightsOnly ? filtered.slice(0, 3) : filtered;
  }, [rows, query, highlightsOnly]);

  return (
    <section className="overflow-hidden rounded-2xl border border-white/12 bg-surface-panel">
      <div className="flex flex-col gap-4 border-b border-white/12 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[.18em] text-white/45">
          {visibleRows.length} de {rows.length} registros
        </p>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/35" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar..." className="w-full border-white/15 bg-transparent pl-9 dark:bg-transparent sm:w-64" />
          </div>
          <Button type="button" variant={highlightsOnly ? "default" : "outline"} size="icon" aria-pressed={highlightsOnly} onClick={() => setHighlightsOnly((current) => !current)}>
            <Filter />
            <span className="sr-only">Mostrar apenas os primeiros</span>
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-white/15">
              {columns.map((column) => (
                <th key={column} scope="col" className="px-6 py-4 font-mono text-[10px] font-normal uppercase tracking-[.18em] text-white/45">{column}</th>
              ))}
              {hasActions ? <th scope="col" className="px-6 py-4 text-right font-mono text-[10px] font-normal uppercase tracking-[.18em] text-white/45">Ações</th> : null}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id} className="border-b border-white/10 transition-colors last:border-b-0 hover:bg-white/[.055]">
                {row.cells.map((cell, cellIndex) => {
                  const face = row.avatars?.[cellIndex];
                  return (
                    <td key={`${row.id}-${cellIndex}`} className={cellIndex === 0 ? "font-heading px-6 py-5 text-sm font-semibold tracking-[-.02em]" : "px-6 py-5 font-mono text-xs text-white/60"}>
                      {face ? (
                        <span className="flex items-center gap-2.5">
                          <StaffAvatar imageUrl={face.imageUrl} initials={face.initials} color={face.color} className="size-7" />
                          <span className="truncate">{cell}</span>
                        </span>
                      ) : cell}
                    </td>
                  );
                })}
                {hasActions ? <td className="px-6 py-5 text-right">{<RowActions row={row} module={module} />}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visibleRows.length === 0 ? (
        <p className="border-b border-white/10 px-4 py-16 text-center text-sm text-white/45">
          {rows.length === 0 ? "Nada registrado ainda. O primeiro registro aparece aqui." : "Nenhum registro corresponde à busca."}
        </p>
      ) : null}
    </section>
  );
}
