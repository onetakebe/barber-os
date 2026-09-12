"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Download, Pencil, Plus } from "lucide-react";

import { createModuleRecordAction, updateModuleRecordAction, type ModuleActionState } from "@/app/(dashboard)/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ModuleSlug } from "@/server/data/module-data";

const initialState: ModuleActionState = { status: "idle" };

function ErrorText({ messages }: { messages?: string[] }) {
  return messages?.[0] ? <p className="text-xs text-destructive">{messages[0]}</p> : null;
}

function FormFields({ module, errors, defaults = {} }: { module: ModuleSlug; errors?: Record<string, string[]>; defaults?: Record<string, string | number> }) {
  if (module === "clientes") return <><div className="grid grid-cols-2 gap-3"><Field><FieldLabel htmlFor="firstName">Nome</FieldLabel><Input id="firstName" name="firstName" defaultValue={defaults.firstName} required /><ErrorText messages={errors?.firstName} /></Field><Field><FieldLabel htmlFor="lastName">Sobrenome</FieldLabel><Input id="lastName" name="lastName" defaultValue={defaults.lastName} required /><ErrorText messages={errors?.lastName} /></Field></div><Field><FieldLabel htmlFor="customerEmail">E-mail</FieldLabel><Input id="customerEmail" name="email" type="email" defaultValue={defaults.email} /><ErrorText messages={errors?.email} /></Field><Field><FieldLabel htmlFor="phone">Telefone</FieldLabel><Input id="phone" name="phone" defaultValue={defaults.phone} required /><ErrorText messages={errors?.phone} /></Field></>;
  if (module === "equipe") return <><Field><FieldLabel htmlFor="displayName">Nome profissional</FieldLabel><Input id="displayName" name="displayName" defaultValue={defaults.displayName} required /><ErrorText messages={errors?.displayName} /></Field><Field><FieldLabel htmlFor="title">Função</FieldLabel><Input id="title" name="title" defaultValue={defaults.title ?? "Barbeiro"} required /><ErrorText messages={errors?.title} /></Field><Field><FieldLabel htmlFor="commissionPercent">Comissão (%)</FieldLabel><Input id="commissionPercent" name="commissionPercent" type="number" min="0" max="100" defaultValue={defaults.commissionPercent ?? 45} required /></Field><Field><FieldLabel htmlFor="imageUrl">Foto</FieldLabel><Input id="imageUrl" name="imageUrl" defaultValue={defaults.imageUrl} placeholder="https://... ou /images/staff/nome.png" /><p className="mt-1 text-xs text-muted-foreground">Sem foto, aparecem as iniciais.</p><ErrorText messages={errors?.imageUrl} /></Field></>;
  if (module === "servicos") return <><Field><FieldLabel htmlFor="serviceName">Nome</FieldLabel><Input id="serviceName" name="name" defaultValue={defaults.name} required /><ErrorText messages={errors?.name} /></Field><Field><FieldLabel htmlFor="description">Descrição</FieldLabel><Input id="description" name="description" defaultValue={defaults.description} /></Field><div className="grid grid-cols-2 gap-3"><Field><FieldLabel htmlFor="price">Preço (€)</FieldLabel><Input id="price" name="price" type="number" min="0.01" step="0.01" defaultValue={defaults.price} required /></Field><Field><FieldLabel htmlFor="durationMinutes">Duração (min)</FieldLabel><Input id="durationMinutes" name="durationMinutes" type="number" min="10" step="5" defaultValue={defaults.durationMinutes ?? 30} required /></Field></div></>;
  if (module === "produtos") return <><Field><FieldLabel htmlFor="productName">Produto</FieldLabel><Input id="productName" name="name" defaultValue={defaults.name} required /></Field><div className="grid grid-cols-2 gap-3"><Field><FieldLabel htmlFor="sku">SKU</FieldLabel><Input id="sku" name="sku" defaultValue={defaults.sku} required /></Field><Field><FieldLabel htmlFor="category">Categoria</FieldLabel><Input id="category" name="category" defaultValue={defaults.category ?? "Retail"} required /></Field></div><div className="grid grid-cols-2 gap-3"><Field><FieldLabel htmlFor="productPrice">Preço (€)</FieldLabel><Input id="productPrice" name="price" type="number" step="0.01" defaultValue={defaults.price} required /></Field><Field><FieldLabel htmlFor="cost">Custo (€)</FieldLabel><Input id="cost" name="cost" type="number" step="0.01" defaultValue={defaults.cost ?? 0} required /></Field></div><div className="grid grid-cols-2 gap-3"><Field><FieldLabel htmlFor="stock">Estoque atual</FieldLabel><Input id="stock" name="stock" type="number" defaultValue={defaults.stock ?? 0} required /></Field><Field><FieldLabel htmlFor="minimumStock">Estoque mínimo</FieldLabel><Input id="minimumStock" name="minimumStock" type="number" defaultValue={defaults.minimumStock ?? 3} required /></Field></div></>;
  if (module === "campanhas") return <><Field><FieldLabel htmlFor="campaignName">Nome</FieldLabel><Input id="campaignName" name="name" required /></Field><Field><FieldLabel htmlFor="audienceSegment">Público</FieldLabel><Input id="audienceSegment" name="audienceSegment" placeholder="Clientes sem visita há 30 dias" required /></Field><Field><FieldLabel htmlFor="message">Mensagem</FieldLabel><Input id="message" name="message" required /></Field></>;
  if (module === "fidelidade") return <><Field><FieldLabel htmlFor="rewardName">Recompensa</FieldLabel><Input id="rewardName" name="name" required /></Field><Field><FieldLabel htmlFor="pointsCost">Custo em pontos</FieldLabel><Input id="pointsCost" name="pointsCost" type="number" min="1" required /></Field><Field><FieldLabel htmlFor="benefitType">Benefício</FieldLabel><Input id="benefitType" name="benefitType" placeholder="Crédito, serviço ou upgrade" required /></Field></>;
  if (module === "financeiro") return <><Field><FieldLabel htmlFor="expenseCategory">Categoria</FieldLabel><Input id="expenseCategory" name="category" required /></Field><Field><FieldLabel htmlFor="expenseDescription">Descrição</FieldLabel><Input id="expenseDescription" name="description" required /></Field><div className="grid grid-cols-2 gap-3"><Field><FieldLabel htmlFor="amount">Valor (€)</FieldLabel><Input id="amount" name="amount" type="number" step="0.01" required /></Field><Field><FieldLabel htmlFor="dueAt">Vencimento</FieldLabel><Input id="dueAt" name="dueAt" type="date" required /></Field></div></>;
  return null;
}

export function ModuleAction({ module, label, canMutate }: { module: ModuleSlug; label: string; canMutate: boolean }) {
  if (module === "relatorios") return <Button asChild><Link href="/financeiro/exportar"><Download data-icon="inline-start" />{label}</Link></Button>;
  if (module === "agendamentos") return canMutate ? <Button asChild><Link href="/agenda"><Plus data-icon="inline-start" />{label}</Link></Button> : null;
  if (!canMutate) return null;
  return <ModuleDialog module={module} label={label} />;
}

function ModuleDialog({ module, label }: { module: ModuleSlug; label: string }) {
  const [state, action, pending] = useActionState(createModuleRecordAction, initialState);

  return (
    <Dialog>
      <DialogTrigger asChild><Button><Plus data-icon="inline-start" />{label}</Button></DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{label}</DialogTitle><DialogDescription>Os dados serão salvos no ambiente ativo e continuarão disponíveis após recarregar.</DialogDescription></DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="module" value={module} />
          {state.message && state.status === "error" ? <p className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{state.message}</p> : null}
          {state.message && state.status === "success" ? <p className="rounded-lg bg-primary/10 p-3 text-xs text-primary">{state.message}</p> : null}
          <FieldGroup><FormFields module={module} errors={state.errors} /></FieldGroup>
          <DialogFooter><Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type EditableModule = "clientes" | "equipe" | "servicos" | "produtos";

export function EditModuleRecordDialog({
  module,
  id,
  defaults,
}: {
  module: EditableModule;
  id: string;
  defaults: Record<string, string | number>;
}) {
  const [state, action, pending] = useActionState(updateModuleRecordAction, initialState);

  return (
    <Dialog>
      <DialogTrigger asChild><Button type="button" size="sm" variant="outline"><Pencil data-icon="inline-start" />Editar</Button></DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Editar registro</DialogTitle><DialogDescription>Atualize os campos e salve as alterações no ambiente atual.</DialogDescription></DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="module" value={module} />
          {state.message ? <p className={state.status === "success" ? "rounded-lg bg-primary/10 p-3 text-xs text-primary" : "rounded-lg bg-destructive/10 p-3 text-xs text-destructive"}>{state.message}</p> : null}
          <FieldGroup><FormFields module={module} errors={state.errors} defaults={defaults} /></FieldGroup>
          <DialogFooter><Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar alterações"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
