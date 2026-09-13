// Etapa 2 (T1): leva os usuários do app para o Supabase Auth. Idempotente.
// Uso: node --experimental-strip-types scripts/migrate-users-to-supabase-auth.mts   (ou npx tsx)
// - cria cada usuário em auth.users (e-mail já confirmado) e grava User.authUserId
// - contas demo (@asbarber.be) recebem a senha demo123 — dados de demonstração, não caixas reais
// - contas reais ficam sem senha: entram por Google ou por "esqueci a senha"
// - o Gmail do Guilherme vira dono da AS Barber Club e a barbearia vazia dele é apagada
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";

import { PrismaClient } from "../src/generated/prisma/client";

const DEMO_DOMAIN = "@asbarber.be";
const DEMO_PASSWORD = "demo123";
const DEMO_TENANT_SLUG = "as-barber-club";
const OWNER_EMAIL = "guilhermeverdonck3@gmail.com";

const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw new Error("SUPABASE_SECRET_KEY ausente no .env");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, { auth: { autoRefreshToken: false, persistSession: false } });
// Escreve em várias barbearias: papel postgres (DIRECT_URL), fora da trava.
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL! }) });

async function findAuthUserByEmail(email: string) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

const users = await db.user.findMany({ where: { deletedAt: null }, select: { id: true, email: true, firstName: true, lastName: true, authUserId: true } });
for (const user of users) {
  const email = user.email.toLowerCase();
  const isDemo = email.endsWith(DEMO_DOMAIN);
  let authUser = await findAuthUserByEmail(email);
  if (!authUser) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: isDemo ? DEMO_PASSWORD : undefined,
      user_metadata: { first_name: user.firstName, last_name: user.lastName },
    });
    if (error) throw new Error(`${email}: ${error.message}`);
    authUser = data.user;
    console.log("criado em auth.users:", email, isDemo ? "(demo, senha demo123)" : "(sem senha)");
  } else {
    console.log("já existia em auth.users:", email);
  }
  if (user.authUserId !== authUser.id) await db.user.update({ where: { id: user.id }, data: { authUserId: authUser.id } });
}

// Guilherme: dono da AS Barber Club; barbearia vazia criada pelo Google sai.
const owner = await db.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true, memberships: { select: { tenantId: true, role: true, tenant: { select: { slug: true, _count: { select: { customers: true, appointments: true, staff: true } } } } } } } });
const demoTenant = await db.tenant.findUnique({ where: { slug: DEMO_TENANT_SLUG }, select: { id: true } });
if (owner && demoTenant) {
  await db.membership.upsert({
    where: { tenantId_userId: { tenantId: demoTenant.id, userId: owner.id } },
    update: { role: "OWNER", isActive: true },
    create: { tenantId: demoTenant.id, userId: owner.id, role: "OWNER" },
  });
  console.log("Guilherme é OWNER da", DEMO_TENANT_SLUG);
  for (const m of owner.memberships) {
    const c = m.tenant._count;
    if (m.tenant.slug !== DEMO_TENANT_SLUG && m.role === "OWNER" && c.customers === 0 && c.appointments === 0 && c.staff === 0) {
      await db.tenant.delete({ where: { id: m.tenantId } });
      console.log("barbearia vazia apagada:", m.tenant.slug);
    }
  }
} else {
  console.log("aviso: usuário do Guilherme ou tenant demo não encontrado; nada alterado nessa parte");
}

await db.$disconnect();
console.log("concluído");
