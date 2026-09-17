-- Confirmação real por e-mail (Bloco 1 / ticket 3): a notificação vira fila persistida.
-- A reserva grava a linha como QUEUED na mesma transação do agendamento; o envio acontece
-- depois do commit e a retentativa manual (endpoint interno) lê o que ficou pendente.
-- Os grants do papel barber_app são por tabela (migração 20260913200000), então as colunas
-- novas já ficam cobertas; a política tenant_isolation da tabela continua valendo.
ALTER TABLE "Notification"
  ADD COLUMN "recipient" TEXT,
  ADD COLUMN "templateKey" TEXT,
  ADD COLUMN "eventKey" TEXT,
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "providerMessageId" TEXT,
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextAttemptAt" TIMESTAMPTZ(3),
  ADD COLUMN "lastError" TEXT;

-- Um evento gera no máximo uma linha por canal e barbearia. NULL não colide: as linhas
-- antigas (envio simulado, sem eventKey) continuam válidas e nunca entram na fila.
CREATE UNIQUE INDEX "Notification_tenantId_eventKey_channel_key" ON "Notification"("tenantId", "eventKey", "channel");
-- Leitura da fila: pendentes cuja retentativa já venceu. Compromisso deliberado: o ideal seria
-- um índice parcial (WHERE status = 'QUEUED' AND "eventKey" IS NOT NULL), que o Prisma não
-- consegue expressar no schema; o composto cobre a mesma consulta com um pouco mais de espaço.
CREATE INDEX "Notification_status_nextAttemptAt_idx" ON "Notification"("status", "nextAttemptAt");
