import { SettingsForm } from "@/components/dashboard/settings-form";
import { requirePermission } from "@/server/auth/authorization";
import { tenantDb } from "@/server/db";

export default async function SettingsPage() { const session = await requirePermission("settings:edit"); const db = tenantDb(session.tenantId); const settings = await db.tenant.findUniqueOrThrow({ where: { id: session.tenantId }, select: { name: true, address: true, phone: true, defaultDepositCents: true, cancellationNoticeHours: true } }); return <div className="flex flex-col gap-6"><section><p className="mb-2 text-xs font-medium uppercase tracking-[.18em] text-primary">Preferências do tenant</p><h1 className="font-heading text-3xl font-semibold tracking-[-.035em]">Configurações</h1><p className="mt-2 text-sm text-muted-foreground">Personalização, políticas e integrações do estabelecimento.</p></section><SettingsForm settings={settings} /></div>; }
