import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/* Cliente do Supabase Auth ligado aos cookies do pedido (Server Components,
   Server Actions e Route Handlers). Só autenticação: os dados continuam pelo Prisma. */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Component só lê cookies; o proxy renova a sessão antes de chegar aqui.
        }
      },
    },
  });
}

/* Cliente administrativo (chave secreta): criar/convidar/apagar usuários. Nunca no navegador. */
export function createSupabaseAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY ausente — necessária para operações administrativas de auth.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
