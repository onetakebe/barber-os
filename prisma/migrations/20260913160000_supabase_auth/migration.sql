-- Etapa 2 do Supabase: identidade passa a ser auth.users; sessão própria sai.
ALTER TABLE "User" ADD COLUMN "authUserId" TEXT;
CREATE UNIQUE INDEX "User_authUserId_key" ON "User"("authUserId");
DROP TABLE IF EXISTS "Session";
