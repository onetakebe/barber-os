import { notFound } from "next/navigation";
import { BadgeEuro, Boxes, CalendarCheck, CalendarDays, CheckCircle2, CircleAlert, Coins, Gift, Globe, Layers, Megaphone, Radio, Receipt, Repeat, Scale, Scissors, Sparkles, Tag, TrendingUp, UserCheck, Users, Wallet, type LucideIcon } from "lucide-react";

import { ModuleAction } from "@/components/dashboard/module-action";
import { StatCard } from "@/components/dashboard/stat-card";
import { TeamAccess } from "@/components/dashboard/team-access";
import { listTeamAccess } from "@/server/services/invitations";
import { ModuleTable } from "@/components/dashboard/module-table";
import { authorize, type Permission } from "@/domain/auth/permissions";
import { requirePermission } from "@/server/auth/authorization";
import { tenantDb } from "@/server/db";
import { getModuleData, moduleMeta, type ModuleSlug } from "@/server/data/module-data";

const mutatePermissions: Record<ModuleSlug, Permission> = {
  agendamentos: "appointments:edit",
  clientes: "customers:edit",
  equipe: "team:edit",
  servicos: "services:edit",
  produtos: "products:edit",
  campanhas: "campaigns:create",
  fidelidade: "loyalty:edit",
  financeiro: "finance:edit",
  relatorios: "finance:view",
};

// Um ícone por indicador, na ordem em que getModuleData devolve as estatísticas.
const statIcons: Record<ModuleSlug, [LucideIcon, LucideIcon, LucideIcon]> = {
  agendamentos: [CalendarDays, CalendarCheck, CheckCircle2],
  clientes: [Users, UserCheck, Wallet],
  equipe: [Users, Globe, CalendarCheck],
  servicos: [Scissors, Sparkles, Tag],
  produtos: [Boxes, Layers, CircleAlert],
  campanhas: [Megaphone, Radio, BadgeEuro],
  fidelidade: [Users, Gift, Repeat],
  financeiro: [TrendingUp, Receipt, Scale],
  relatorios: [TrendingUp, Receipt, Coins],
};

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  if (!(module in moduleMeta)) notFound();
  const slug = module as ModuleSlug;
  const session = await requirePermission(moduleMeta[slug].permission);
  const db = tenantDb(session.tenantId);
  const professionalStaff = session.role === "PROFESSIONAL" ? await db.staff.findFirst({ where: { tenantId: session.tenantId, userId: session.userId, deletedAt: null }, select: { id: true } }) : undefined;
  const definition = await getModuleData(slug, session.tenantId, professionalStaff?.id ?? (session.role === "PROFESSIONAL" ? null : undefined));
  const canMutate = authorize(session.role, mutatePermissions[slug]);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.22em] text-white/45">{session.tenantName}</p>
          <h1 className="font-display mt-4 text-4xl uppercase leading-[.85] tracking-[-.05em] sm:text-5xl">{definition.title}</h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-white/50">{definition.description}</p>
        </div>
        <ModuleAction module={slug} label={definition.action} canMutate={canMutate} />
      </section>

      {/* O primeiro indicador é o mais relevante do módulo e leva o degradê do acento:
          esta tela não tem hero, então ele é o único bloco saturado. */}
      <section className="grid gap-4 sm:grid-cols-3">
        {definition.stats.map((stat, index) => <StatCard key={stat.label} icon={statIcons[slug][index] ?? TrendingUp} label={stat.label} value={stat.value} hint={stat.hint} tone={index === 0 ? "accent" : "plain"} />)}
      </section>

      <ModuleTable module={slug} columns={definition.columns} rows={definition.rows} canMutate={canMutate} />
      {slug === "equipe" ? <TeamAccessSection tenantId={session.tenantId} canInvite={authorize(session.role, "team:invite")} /> : null}
    </div>
  );
}

async function TeamAccessSection({ tenantId, canInvite }: { tenantId: string; canInvite: boolean }) {
  const access = await listTeamAccess(tenantId);
  const db = tenantDb(tenantId);
  // Profissionais da agenda ainda sem login, para vincular ao convite.
  const staff = canInvite ? await db.staff.findMany({ where: { tenantId, deletedAt: null, userId: null }, orderBy: { displayName: "asc" }, select: { id: true, displayName: true } }) : [];
  return <TeamAccess data={{ ...access, staffOptions: staff.map((item) => ({ id: item.id, name: item.displayName })) }} canInvite={canInvite} />;
}
