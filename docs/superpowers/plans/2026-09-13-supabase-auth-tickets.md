# Tickets — Etapa 2 do Supabase (por funcionalidade, não por camada)

Spec: `docs/superpowers/specs/2026-09-13-supabase-auth-e-trava-no-banco.md`. Cada ticket termina com a funcionalidade inteira funcionando (telas + servidor + dados + teste), revisável sozinho. TDD: critério de sucesso antes do código.

## T1 — Entrar com e-mail+senha e Google pelo Supabase
Inclui: `@supabase/ssr`, cookies de sessão, `requirePermission` lendo o usuário do Supabase, `authUserId` na tabela `User`, Google configurado no Supabase (redirect novo no Google Cloud — passo do usuário), botão Sair, script de migração dos 6 usuários + Guilherme dono da AS Barber Club + apagar barbearia vazia. Sai: `Session` própria, `arctic`, rotas `/api/auth/*`, `AUTH_SECRET`.
Pronto quando: as 5 contas demo e o Gmail do Guilherme entram e caem no painel da AS Barber Club; Sair funciona; testes atuais continuam verdes.

## T2 — Esqueci a senha e confirmação de e-mail
Inclui: `/recuperar-senha` mandando e-mail real, tela `/redefinir-senha`, cadastro com `signUp` + e-mail de confirmação, bloqueio do painel enquanto não confirmado (mensagem clara + reenviar e-mail).
Pronto quando: os dois fluxos funcionam com um e-mail real do usuário.

## T3 — Convite de equipe
Inclui: tabela `Invitation` (migração), ação "Convidar" na tela Equipe (dono/admin; perfis sem dono), lista de pendentes com reenviar/cancelar, e-mail via `inviteUserByEmail`, tela de aceitar (definir senha ou Google), criação de `User`+`Membership`, expiração em 7 dias.
Pronto quando: dono convida um e-mail real como profissional e a pessoa entra com o perfil certo.

## T4 — Trava no banco (RLS)
Inclui: migração SQL ativando RLS + políticas por `tenantId` em todas as tabelas, papel de banco sem bypass para o app, `db.forTenant()` via extensão do Prisma, cliente administrativo explícito, refatoração dos 20 arquivos para o cliente por barbearia, agendamento público ajustado.
Pronto quando: teste de integração prova que a barbearia A não lê nem grava na B; suíte inteira verde; fluxos T1–T3 e agendamento público continuam funcionando.

## Ordem
T1 → T2 → T3 → T4. T4 por último porque depende de saber a barbearia do usuário logado (T1) e é o mais mecânico. Revisão de código em sessão nova após cada ticket.
