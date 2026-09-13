import { signInWithGoogleAction } from "@/app/(auth)/actions";

/* Único provedor desta etapa: Google, pelo Supabase Auth. Apple/Facebook viram
   configuração no painel do Supabase quando houver credencial. */
export function SocialButtons({ intent }: { intent: "entrar" | "criar" }) {
  const verb = intent === "entrar" ? "Entrar" : "Criar conta";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-[.18em] text-muted-foreground">
        <span className="h-px flex-1 bg-black/10" />ou<span className="h-px flex-1 bg-black/10" />
      </div>
      <form action={signInWithGoogleAction}>
        <button type="submit" className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl bg-white text-sm font-medium text-black shadow-[0_2px_12px_rgb(0_0_0/.05)] ring-1 ring-black/5 transition-colors hover:bg-black hover:text-white">
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="currentColor">
            <path d="M21.6 12.23c0-.68-.06-1.33-.17-1.96H12v3.7h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.98-4.32 2.98-7.26Z" />
            <path d="M12 21.6c2.7 0 4.96-.9 6.62-2.42l-3.24-2.5c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.75-5.59-4.11H3.06v2.58A9.99 9.99 0 0 0 12 21.6Z" />
            <path d="M6.41 13.52a6 6 0 0 1 0-3.84V7.1H3.06a10 10 0 0 0 0 8.98l3.35-2.57Z" />
            <path d="M12 6.38c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.98 9.98 0 0 0 12 2.4a9.99 9.99 0 0 0-8.94 5.5l3.35 2.57C7.2 8.13 9.4 6.38 12 6.38Z" />
          </svg>
          {verb} com Google
        </button>
      </form>
    </div>
  );
}
