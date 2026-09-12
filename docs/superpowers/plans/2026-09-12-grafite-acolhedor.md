# Grafite acolhedor — implementação

Proposta aprovada pelo usuário: `docs/design/2026-09-11-proposta-visual.md`.

**Objetivo:** aplicar contraste grafite/branco quente e fotografia humana à interface existente.
**Arquitetura:** componentes de apresentação consomem os mesmos contratos. Consultas, permissões, ações e schema não mudam. A agenda resumida não inventa duração ou estados ausentes nos dados atuais.
**Stack:** Next.js 16.2, React 19, Tailwind 4, componentes existentes e next/image.

- [x] Preservar baseline em `/private/tmp/barber-design-baseline` e trabalhar em `codex/grafite-acolhedor`.
- [x] Ajustar tokens em `src/app/globals.css`; remover padrão geométrico do shell e coordenar navegação, foco e respiro em `src/components/layout/dashboard-shell.tsx`.
- [x] Reorganizar `src/app/(dashboard)/painel/page.tsx`: agenda primeiro, próximos horários em superfície clara, equipe com retratos, financeiro abaixo, estados vazios honestos; preservar permissões e dados.
- [x] Refinar `src/components/dashboard/agenda-workspace.tsx` apenas na apresentação: painéis, cabeçalhos, bordas e navegação legível.
- [x] Otimizar a foto principal gerada; atualizar composição da página pública e tornar claro o resumo do wizard sem alterar passos ou ações.
- [x] Verificar tipos, lint dos arquivos tocados, testes existentes e build. Revisar desktop/celular, navegação, fotos, estados vazios e passos da reserva sem finalizar uma reserva.
- [x] Revisão independente de regressões e comparação de hashes para comprovar que backend, Prisma e ações não foram alterados. Registrar resultado e memória.

Validação visual é principal para cor/composição; não criar testes que apenas repetem classes CSS. Reservas, autenticação e finanças conservam testes existentes. Usar estados e contratos reais, sem percentuais ou reservas do mockup.

## Resultado da verificação (2026-09-12, sessão Claude Code)
- `tsc --noEmit` limpo · eslint limpo nos 5 arquivos `.tsx` tocados · `vitest run` 26/26 · `next build` ok.
- Hashes vs `/private/tmp/barber-design-baseline/hashes.json`: 146 arquivos, **140 idênticos**; só os 6 de apresentação mudaram
  (`globals.css`, `dashboard-shell`, `painel/page`, `agenda-workspace`, `booking-wizard`, `barbearia/[slug]/page`). `src/server/`, actions e Prisma intactos.
- Revisão no navegador (desktop e 375px): painel com agenda primeiro, `.light-panel` nos próximos horários, retratos da equipe, estados vazios honestos;
  página pública com hero fotográfico e seção clara; wizard mantém 5 passos. Nenhum erro no console. Reserva não finalizada.
- Ressalva: o servidor antigo na porta 3011 (pid de sessão anterior) estava travado; `.claude/launch.json` passou a iniciar `next dev -p 3011`.
