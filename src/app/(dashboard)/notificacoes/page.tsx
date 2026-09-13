import { Bell } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/server/auth/authorization";
import { tenantDb } from "@/server/db";

export default async function NotificationsPage() {
  const session = await requirePermission("customers:edit");
  const db = tenantDb(session.tenantId);
  const notifications = await db.notification.findMany({ where: { tenantId: session.tenantId }, orderBy: { createdAt: "desc" }, take: 100 });
  return <div className="flex flex-col gap-6"><section><p className="mb-2 text-xs uppercase tracking-[.18em] text-primary">Central persistida</p><h1 className="font-heading text-3xl font-semibold">Notificações</h1><p className="mt-2 text-sm text-muted-foreground">Histórico de mensagens internas e envios simulados.</p></section><div className="grid gap-3">{notifications.map((item) => <Card key={item.id}><CardContent className="flex gap-4 p-5"><div className="grid size-10 shrink-0 place-items-center rounded-full bg-white/8"><Bell className="size-4" /></div><div className="flex-1"><div className="flex items-center justify-between gap-3"><p className="font-medium">{item.title}</p><Badge variant="secondary">{item.channel} · {item.status}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{item.body}</p><p className="mt-2 text-[11px] text-muted-foreground">{item.createdAt.toLocaleString("pt-BR")}</p></div></CardContent></Card>)}{notifications.length === 0 ? <Card><CardContent className="p-12 text-center text-sm text-muted-foreground">Nenhuma notificação registrada.</CardContent></Card> : null}</div></div>;
}
