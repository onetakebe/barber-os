# Etapa 2 do Supabase — login no Supabase e trava no banco

Data: 13/09/2026. Status: decisões fechadas em entrevista; implementação não iniciada.
Antecedente: etapa 1 (banco no Supabase) concluída em 13/09 (`a902d39`). Substitui de vez a direção Laravel (removida no PR #2).

## O que entra e o que não entra

| Entra | Não entra (decidido) |
|---|---|
| Login gerido pelo **Supabase Auth**: e-mail+senha e Google | Trocar o Prisma pelo supabase-js — o Prisma continua em todos os 114 pontos de acesso |
| Redefinição de senha **real** por e-mail | Conta de cliente ("minha conta") — fica para uma etapa 3 |
| Confirmação de e-mail obrigatória para conta nova com senha | Link mágico por e-mail |
| **Convite de equipe** por e-mail, pelo painel | Apple e Facebook ligados (ficam prontos no Supabase, desligados) |
| **Trava no banco** (RLS): cada barbearia só enxerga o que é dela, mesmo se o código errar | Seletor de barbearia para quem tem várias |
| Contas demo mantidas; Gmail do Guilherme vira dono da AS Barber Club; barbearia vazia apagada | Remetente de e-mail com domínio próprio (fica para produção) |

## Decisões de produto (o que o usuário vive)

1. **Formas de entrar**: e-mail+senha e "Entrar com Google". Telas atuais (layout de referência) permanecem; muda só o que acontece por trás.
2. **Esqueci a senha**: e-mail de verdade com link; a pessoa define a senha nova numa tela do sistema e já entra.
3. **Criar conta (novo dono)**: nome, sobrenome, nome da barbearia, e-mail, senha, confirmar senha, termos. Recebe e-mail de confirmação; **só entra no painel depois de confirmar**. Quem cria conta com Google não precisa confirmar.
4. **Convite de equipe**: dono e admin, na tela Equipe, convidam por e-mail escolhendo o perfil (admin, gerente, recepção ou profissional — **nunca dono**). Gerente não convida. O convidado recebe "X te convidou para Y", clica, cria a senha (ou entra com o Google do mesmo e-mail) e cai no painel da barbearia certa com o perfil certo. Sem aceite de termos para funcionário. Convite vale **7 dias**; expirado, o dono reenvia. Convite pendente aparece na tela Equipe com opção de reenviar ou cancelar.
5. **Sessão**: fica logado até clicar em **Sair** (na prática, semanas); "Sair" visível no menu do usuário e na navegação móvel.
6. **Várias barbearias por pessoa**: continua possível; o painel abre na primeira barbearia ativa da pessoa. Sem seletor.
7. **E-mails**: remetente padrão do Supabase por enquanto. Quando for para clientes reais, configurar domínio próprio (Resend ou SMTP) só no painel do Supabase.
8. **Contas existentes**: as 5 contas demo da AS Barber Club continuam, com senha redefinida (recebem "definir senha" como um convite). O Gmail `guilhermeverdonck3` passa a ser **dono da AS Barber Club**; a barbearia vazia criada por ele em 13/09 é apagada.
9. **Agendamento público** (cliente sem login) continua exatamente igual.

## Decisões técnicas (por conta de Claude; não mudam o que o usuário vê)

- **Identidade**: `auth.users` do Supabase é a fonte de quem está logado. A tabela `User` do app continua com perfil e vínculos (`Membership`), ganhando `authUserId` (único). Sessão via cookies do `@supabase/ssr`; a tabela `Session` própria e o `AUTH_SECRET`/`arctic` saem.
- **Google**: configurado no painel do Supabase com o mesmo cliente OAuth já criado; a URI de redirecionamento no Google Cloud passa a ser a do Supabase (`https://<ref>.supabase.co/auth/v1/callback`). Rotas `/api/auth/*` próprias saem.
- **Convites**: tabela `Invitation` (barbearia, e-mail, perfil, quem convidou, expira em, aceito em). Envio por `auth.admin.inviteUserByEmail` com a chave de serviço, só no servidor. Aceitar = criar `User` (se não existir) + `Membership`.
- **Confirmação de e-mail**: o painel exige `email_confirmed_at`; a barbearia é criada no cadastro, mas fica inacessível até confirmar.
- **Trava no banco (RLS)**: ativada em todas as tabelas com `tenantId`. Política: `tenantId = current_setting('app.tenant_id')`. O Prisma conecta com um papel **sem** bypass e todo acesso do app passa por um cliente **por barbearia** (`db.forTenant(tenantId)`, extensão do Prisma que abre transação e faz `set_config`). Operações que precisam ver tudo (criar barbearia no cadastro, aceitar convite, resolver slug público) usam um cliente administrativo explícito. O agendamento público resolve o slug com o cliente administrativo e depois usa `forTenant`.
- **Migração de dados**: script cria os 6 usuários em `auth.users` (demo com senha temporária + convite para redefinir; o do Google só pelo e-mail, o próximo login liga sozinho), grava `authUserId`, cria a `Membership` do Guilherme na AS Barber Club e apaga a barbearia vazia.
- **Corte**: tudo num rascunho (`feat/supabase-auth`), testado de ponta a ponta com contas reais, e só então juntado. O login antigo funciona até o merge.

## Como saber que ficou pronto
- Entrar com e-mail+senha e com Google na AS Barber Club (conta demo e Gmail do Guilherme) → painel.
- Esqueci a senha → e-mail → senha nova → painel.
- Criar conta nova → e-mail de confirmação → sem confirmar não entra; confirmando, entra e cai em Configurações.
- Dono convida um e-mail como profissional → e-mail chega → define senha → painel com perfil Profissional; convite some da lista de pendentes.
- Com duas barbearias no banco, um usuário logado na A não consegue ler nem alterar dados da B — verificado por teste automatizado no banco, não só pelo código.
- Agendamento público de ponta a ponta continua funcionando sem login.
