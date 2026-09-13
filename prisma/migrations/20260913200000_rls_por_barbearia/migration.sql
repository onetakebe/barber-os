-- Trava no banco (etapa 2 / T4): cada barbearia só enxerga o que é dela, garantido pelo Postgres.
-- O app conecta como `barber_app` (sem BYPASSRLS); as migrações continuam como `postgres`.
-- Cada pedido abre transação e faz set_config('app.tenant_id', <id>, true); operações
-- administrativas (cadastro, login, página pública por slug) setam app.bypass_rls = 'on'.

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_tenant() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '') $$;

CREATE OR REPLACE FUNCTION app.bypass() RETURNS boolean
  LANGUAGE sql STABLE AS $$ SELECT COALESCE(current_setting('app.bypass_rls', true), '') = 'on' $$;

-- Papel da aplicação (a senha é definida por ambiente, fora da migração).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'barber_app') THEN
    CREATE ROLE barber_app NOLOGIN NOBYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public, app TO barber_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO barber_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO barber_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO barber_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO barber_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO barber_app;
-- Migrações do Prisma precisam ler a tabela de controle.
GRANT SELECT ON "_prisma_migrations" TO barber_app;

-- Tenant: a própria linha da barbearia.
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Tenant";
CREATE POLICY tenant_isolation ON "Tenant"
  USING ((SELECT app.bypass()) OR id = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR id = (SELECT app.current_tenant()));

ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Appointment";
CREATE POLICY tenant_isolation ON "Appointment"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "AppointmentService" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AppointmentService";
CREATE POLICY tenant_isolation ON "AppointmentService"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "AppointmentStatusHistory" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AppointmentStatusHistory";
CREATE POLICY tenant_isolation ON "AppointmentStatusHistory"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AuditLog";
CREATE POLICY tenant_isolation ON "AuditLog"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "Availability" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Availability";
CREATE POLICY tenant_isolation ON "Availability"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "BusinessUnit" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "BusinessUnit";
CREATE POLICY tenant_isolation ON "BusinessUnit"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "Campaign" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Campaign";
CREATE POLICY tenant_isolation ON "Campaign"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "CampaignDelivery" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "CampaignDelivery";
CREATE POLICY tenant_isolation ON "CampaignDelivery"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "CommissionEntry" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "CommissionEntry";
CREATE POLICY tenant_isolation ON "CommissionEntry"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "CommissionRule" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "CommissionRule";
CREATE POLICY tenant_isolation ON "CommissionRule"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "Credit" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Credit";
CREATE POLICY tenant_isolation ON "Credit"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Customer";
CREATE POLICY tenant_isolation ON "Customer"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "CustomerSubscription" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "CustomerSubscription";
CREATE POLICY tenant_isolation ON "CustomerSubscription"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "Deposit" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Deposit";
CREATE POLICY tenant_isolation ON "Deposit"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Expense";
CREATE POLICY tenant_isolation ON "Expense"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "InventoryMovement" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "InventoryMovement";
CREATE POLICY tenant_isolation ON "InventoryMovement"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "Invitation" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Invitation";
CREATE POLICY tenant_isolation ON "Invitation"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "LoyaltyProgram" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "LoyaltyProgram";
CREATE POLICY tenant_isolation ON "LoyaltyProgram"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "LoyaltyTransaction" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "LoyaltyTransaction";
CREATE POLICY tenant_isolation ON "LoyaltyTransaction"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Membership";
CREATE POLICY tenant_isolation ON "Membership"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Notification";
CREATE POLICY tenant_isolation ON "Notification"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "NotificationTemplate" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "NotificationTemplate";
CREATE POLICY tenant_isolation ON "NotificationTemplate"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Payment";
CREATE POLICY tenant_isolation ON "Payment"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Product";
CREATE POLICY tenant_isolation ON "Product"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "Refund" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Refund";
CREATE POLICY tenant_isolation ON "Refund"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Review";
CREATE POLICY tenant_isolation ON "Review"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "Reward" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Reward";
CREATE POLICY tenant_isolation ON "Reward"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "RewardRedemption" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "RewardRedemption";
CREATE POLICY tenant_isolation ON "RewardRedemption"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "Sale" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Sale";
CREATE POLICY tenant_isolation ON "Sale"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "SaleItem" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "SaleItem";
CREATE POLICY tenant_isolation ON "SaleItem"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Service";
CREATE POLICY tenant_isolation ON "Service"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "ServiceCategory" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ServiceCategory";
CREATE POLICY tenant_isolation ON "ServiceCategory"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "Staff" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Staff";
CREATE POLICY tenant_isolation ON "Staff"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "StaffService" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "StaffService";
CREATE POLICY tenant_isolation ON "StaffService"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "SubscriptionPlan" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "SubscriptionPlan";
CREATE POLICY tenant_isolation ON "SubscriptionPlan"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "TimeOff" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "TimeOff";
CREATE POLICY tenant_isolation ON "TimeOff"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "WaitlistEntry" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "WaitlistEntry";
CREATE POLICY tenant_isolation ON "WaitlistEntry"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));
ALTER TABLE "WaitlistOffer" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "WaitlistOffer";
CREATE POLICY tenant_isolation ON "WaitlistOffer"
  USING ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()))
  WITH CHECK ((SELECT app.bypass()) OR "tenantId" = (SELECT app.current_tenant()));

-- User e Account são identidade global (sem tenantId): sem RLS; o acesso a eles passa pelos
-- vínculos (Membership), que têm RLS.
