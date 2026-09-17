import { Bell } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Notification } from "@/generated/prisma/client";
import { requirePermission } from "@/server/auth/authorization";
import { tenantDb } from "@/server/db";

const channelLabel: Record<Notification["channel"], string> = { IN_APP: "Interna", EMAIL: "E-mail", WHATSAPP: "WhatsApp", SMS: "SMS", PUSH: "Push" };

/** Estado real da fila (Bloco 1 / ticket 3): pendente aguarda envio ou retentativa, enviado
 *  tem id do provedor, falhou esgotou as tentativas ou bateu em erro definitivo. Linhas sem
 *  `eventKey` com `metadata.simulated` (confirmações antigas, oferta da fila de espera) nunca
 *  passaram por um provedor e ficam marcadas como simuladas. */
function statusBadge(item: Notification) {
  const simulated = item.eventKey === null && typeof item.metadata === "object" && item.metadata !== null && "simulated" in item.metadata && item.metadata.simulated === true;
  if (simulated) return <Badge variant="outline">simulado</Badge>;
  switch (item.status) {
    case "SENT": return <Badge>enviado</Badge>;
    case "FAILED": return <Badge variant="destructive">falhou</Badge>;
    case "READ": return <Badge variant="secondary">lida</Badge>;
    default: return <Badge variant="secondary">pendente</Badge>;
  }
}

/** Uma linha de detalhe técnico: tentativas, próximo envio, id no provedor ou último erro. */
function details(item: Notification) {
  const parts: string[] = [];
  if (item.recipient) parts.push(`para ${item.recipient}`);
  if (item.attempts > 0) parts.push(`${item.attempts} ${item.attempts === 1 ? "tentativa" : "tentativas"}`);
  if (item.status === "QUEUED" && item.nextAttemptAt) parts.push(`próxima às ${item.nextAttemptAt.toLocaleString("pt-BR")}`);
  if (item.status === "SENT" && item.provider) parts.push(`via ${item.provider}${item.providerMessageId ? ` · ${item.providerMessageId}` : ""}`);
  return parts.join(" · ");
}

export default async function NotificationsPage() {
  const session = await requirePermission("customers:edit");
  const db = tenantDb(session.tenantId);
  const notifications = await db.notification.findMany({ where: { tenantId: session.tenantId }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div className="flex flex-col gap-6">
      <section>
        <p className="mb-2 text-xs uppercase tracking-[.18em] text-primary">Central persistida</p>
        <h1 className="font-heading text-3xl font-semibold">Notificações</h1>
        <p className="mt-2 text-sm text-muted-foreground">Confirmações por e-mail enviadas aos clientes e avisos internos. Pendentes saem na próxima retentativa.</p>
      </section>
      <div className="grid gap-3">
        {notifications.map((item) => {
          const detail = details(item);
          return (
            <Card key={item.id}>
              <CardContent className="flex gap-4 p-5">
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-white/8"><Bell className="size-4" /></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{item.title}</p>
                    <div className="flex items-center gap-2"><Badge variant="outline">{channelLabel[item.channel]}</Badge>{statusBadge(item)}</div>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                  {detail ? <p className="mt-2 text-[11px] text-muted-foreground">{detail}</p> : null}
                  {item.lastError && item.status !== "SENT" ? <p className="mt-1 font-mono text-[11px] text-destructive">{item.lastError}</p> : null}
                  <p className="mt-2 text-[11px] text-muted-foreground">{item.createdAt.toLocaleString("pt-BR")}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {notifications.length === 0 ? <Card><CardContent className="p-12 text-center text-sm text-muted-foreground">Nenhuma notificação registrada.</CardContent></Card> : null}
      </div>
    </div>
  );
}
