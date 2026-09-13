import type { SocialProvider } from "@/server/auth/social";
import { configuredSocialProviders, socialProviderLabels } from "@/server/auth/social";

/* Marcas em traço único, monocromáticas — coerentes com o Grafite. Só aparece
   o provedor que tem credencial no ambiente (pedido de 13/09: sem botão de
   Apple/Facebook enquanto não estiverem configurados). Com um só provedor o
   botão ocupa a largura toda e ganha rótulo; com vários, vira a fileira de ícones. */
const icons: Record<SocialProvider, React.ReactNode> = {
  google: (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="currentColor">
      <path d="M21.6 12.23c0-.68-.06-1.33-.17-1.96H12v3.7h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.98-4.32 2.98-7.26Z" />
      <path d="M12 21.6c2.7 0 4.96-.9 6.62-2.42l-3.24-2.5c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.75-5.59-4.11H3.06v2.58A9.99 9.99 0 0 0 12 21.6Z" />
      <path d="M6.41 13.52a6 6 0 0 1 0-3.84V7.1H3.06a10 10 0 0 0 0 8.98l3.35-2.57Z" />
      <path d="M12 6.38c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.98 9.98 0 0 0 12 2.4a9.99 9.99 0 0 0-8.94 5.5l3.35 2.57C7.2 8.13 9.4 6.38 12 6.38Z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="currentColor">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.5-3.9 3.78-3.9 1.09 0 2.24.19 2.24.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.77l-.44 2.9h-2.33V22C18.34 21.24 22 17.08 22 12.06Z" />
    </svg>
  ),
  apple: (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="currentColor">
      <path d="M16.37 12.7c.02 2.57 2.25 3.42 2.28 3.43-.02.06-.36 1.22-1.18 2.42-.7 1.04-1.44 2.07-2.6 2.09-1.14.02-1.5-.67-2.8-.67-1.3 0-1.7.65-2.78.7-1.12.04-1.97-1.12-2.68-2.15-1.46-2.11-2.57-5.96-1.08-8.56.75-1.3 2.08-2.11 3.52-2.13 1.1-.02 2.13.74 2.8.74.67 0 1.93-.91 3.25-.78.55.02 2.1.22 3.1 1.68-.08.05-1.85 1.08-1.83 3.23ZM14.24 6.4c.59-.72 1-1.72.88-2.72-.86.03-1.9.57-2.51 1.29-.55.63-1.03 1.65-.9 2.63.96.07 1.93-.49 2.53-1.2Z" />
    </svg>
  ),
};

export function SocialButtons({ intent }: { intent: "entrar" | "criar" }) {
  const providers = configuredSocialProviders();
  if (!providers.length) return null;
  const verb = intent === "entrar" ? "Entrar" : "Criar conta";
  const box = "flex h-12 items-center justify-center gap-3 rounded-2xl bg-white text-black shadow-[0_2px_12px_rgb(0_0_0/.05)] ring-1 ring-black/5 transition-colors hover:bg-black hover:text-white";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-[.18em] text-muted-foreground">
        <span className="h-px flex-1 bg-black/10" />ou<span className="h-px flex-1 bg-black/10" />
      </div>
      {providers.length === 1 ? (
        <a href={`/api/auth/${providers[0]}`} className={`${box} text-sm font-medium`}>
          {icons[providers[0]]} {verb} com {socialProviderLabels[providers[0]]}
        </a>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${providers.length}, minmax(0, 1fr))` }}>
          {providers.map((provider) => (
            <a key={provider} href={`/api/auth/${provider}`} aria-label={`${verb} com ${socialProviderLabels[provider]}`} className={box}>
              {icons[provider]}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
