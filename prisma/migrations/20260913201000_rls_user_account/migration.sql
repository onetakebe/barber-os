-- User e Account estavam com RLS ligado (o Supabase liga por padrão nas tabelas públicas)
-- e sem política → invisíveis para barber_app. Regra: a barbearia atual vê os usuários
-- que têm vínculo com ela; contexto administrativo vê todos.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "User";
CREATE POLICY tenant_isolation ON "User"
  USING ((SELECT app.bypass()) OR EXISTS (SELECT 1 FROM "Membership" m WHERE m."userId" = "User".id AND m."tenantId" = (SELECT app.current_tenant())))
  WITH CHECK ((SELECT app.bypass()));

ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Account";
CREATE POLICY tenant_isolation ON "Account"
  USING ((SELECT app.bypass()) OR EXISTS (SELECT 1 FROM "Membership" m WHERE m."userId" = "Account"."userId" AND m."tenantId" = (SELECT app.current_tenant())))
  WITH CHECK ((SELECT app.bypass()));
