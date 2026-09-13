# Bloco 1 — fluxo de reserva pública: calendário de mês e wizard em 3 passos

Último bloco em aberto do plano de 3 blocos (2026-09-08). Decisões do usuário em 2026-09-13:
**sem sinal online por enquanto** (a reserva confirma sem cobrança; nada de pagamento/depósito
simulado gravado) e **calendário de hoje + 60 dias** (hoje entra se ainda houver horário depois
da hora atual; dias sem horário ficam desabilitados).

**Objetivo:** o cliente escolhe serviço e profissional, vê um mês de verdade, escolhe dia e hora,
preenche os dados e confirma — em 3 passos, sem um pagamento de mentira no caminho.
**Arquitetura:** a regra de disponibilidade continua em `getAvailableSlotsFromRecords`; ganha um
corte por "agora" e uma leitura por mês que reaproveita os mesmos registros. A reserva pública
deixa de chamar o gateway simulado. Schema, RLS e painel não mudam.
**Stack:** Next.js 16.2, React 19, date-fns (já instalado), componentes existentes. Sem
react-day-picker: a grade de mês é um componente próprio, pequeno, no padrão Grafite Acolhedor.

Cada ticket termina com a funcionalidade inteira funcionando (servidor + tela + teste), revisável
sozinho. Critério de sucesso (teste) escrito antes do código. Code-review em sessão nova entre
tickets. Branch: `feat/bloco-1-reserva`.

---

## T1 — Reserva confirma sem sinal online

**Por quê primeiro:** é o menor corte e destrava o passo 3 do wizard; tudo o que vem depois
já nasce sem o pagamento falso.

**Servidor**
- [x] Teste em `tests/server/booking-service.test.ts` (ou novo `public-booking.test.ts` com
      repositório falso): reserva pública de serviço com `depositRequired: true` cria
      agendamento `CONFIRMED` com `depositCents: 0`, **nenhum** `Payment`/`Deposit`, e a
      notificação continua marcada como simulada.
- [x] `src/server/services/public-booking.ts`: remover `MockPaymentGateway`,
      `calculateDeposit` e a criação de `Payment`/`Deposit`; `depositCents: 0`; remover
      `PAYMENT_FAILED` do fluxo público. `MockPaymentGateway` fica no repo (agenda interna
      e testes de política de cancelamento ainda o referenciam) — só sai do caminho público.
- [x] `src/app/(public)/barbearia/[slug]/agendar/actions.ts`: mensagem de sucesso sem
      "sinal simulado pago"; retorno sem `depositCents` (ou sempre 0 — escolher um e tipar).

**Tela (só o necessário para não mentir)**
- [x] Tela de confirmação do wizard: tirar "Sinal simulado pago" e "Saldo no local"; mostrar
      total e a política de cancelamento em horas. Resumo lateral: tirar "Sinal agora" /
      "No local" e o aviso "Confirmação imediata após o sinal simulado".
- [x] `tests/e2e/main.spec.ts`: o teste "customer completes a persisted booking and simulated
      deposit flow" passa a validar confirmação sem sinal (o teste de cancelamento pelo painel
      continua usando o seed, que ainda tem depósitos — não mexer).

**Pronto quando:** reserva pública real no navegador termina sem cobrar nada, o banco não tem
`Payment`/`Deposit` novos para aquele agendamento, vitest e o e2e de reserva passam.

**Feito em 13/09:** teste de integração `tests/integration/public-booking.test.ts` (barbearia
temporária, apagada no fim); `createPublicBooking` sem gateway e sem `Payment`/`Deposit`;
`PAYMENT_FAILED` removido; passo 5 do wizard virou "Confirmar" (sem cartão, botão "Confirmar
reserva") — a fusão em 3 passos fica para o T3. Verificado: tsc, eslint, vitest 45/45, reserva
real no navegador (linha no banco com `depositCents 0`, sem pagamento/depósito; apagada depois).
E2E atualizado, não executado nesta sessão.

## T2 — Calendário de mês real

**Servidor**
- [x] Testes em `tests/server/availability-service.test.ts`:
      (a) `getAvailableSlotsFromRecords` com `now` corta horários que já passaram no dia de
      hoje (fuso do tenant) e não corta nada em dias futuros;
      (b) nova função pura `getBookableDaysFromRecords({ month, timezone, now, horizonDays,
      durationMinutes, staff })` devolve, por dia do mês, `{ date, available: boolean }` —
      passado e além de 60 dias = indisponível; dia sem jornada = indisponível; dia com jornada
      mas tomado por bloqueio/agendamentos = indisponível.
- [x] `src/server/services/availability.ts`: parâmetro opcional `now` em
      `getAvailableSlotsFromRecords`; `getBookableDaysFromRecords` reaproveitando a mesma
      regra dia a dia (uma consulta de registros para o mês inteiro, não uma por dia).
- [x] `src/server/data/public-booking.ts`: `getAvailabilityForTenant` passa `now`;
      nova `getBookableDaysForTenant({ tenantId, timezone, month, serviceId, staffId })` que
      carrega jornada, bloqueios e agendamentos do intervalo do mês numa consulta e chama a
      função pura. `getBookableDates` (os 7 chips) sai.
- [x] Rota `src/app/api/public/[slug]/availability/month/route.ts`
      (`?month=YYYY-MM&serviceId&staffId`), mesmo padrão Zod + 404 da rota de dia.

**Tela**
- [x] `src/components/booking/month-calendar.tsx` (client, sem dependência nova): grade
      seg–dom em pt-BR, mês atual e navegação até `hoje + 60 dias`, dia desabilitado quando
      `available: false` ou fora da janela, dia selecionado em brand (`#FF8C42`) como as demais
      seleções do wizard, acessível por teclado (botões, `aria-pressed`, `aria-disabled`).
- [x] Wizard: ao entrar no passo de horário, busca o mês corrente; ao trocar de mês, busca de
      novo; ao clicar num dia, busca os horários daquele dia (rota existente). Primeiro dia
      disponível vem pré-selecionado. Estado de carregamento e erro honestos ("Não foi possível
      carregar o mês").
- [x] `src/app/(public)/barbearia/[slug]/page.tsx`: "próximo horário" do hero passa a usar o
      primeiro dia disponível (hoje incluído) em vez de `getBookableDates(...)[0]`.

**Pronto quando:** no navegador (desktop e 375px) o mês mostra dias cinza onde não há jornada
ou está lotado, hoje aparece só se ainda houver horário, dá para ir até 2 meses à frente e
escolher um dia + hora; vitest cobre corte por "agora" e dias do mês.

**Feito em 13/09:** `getAvailableSlotsFromRecords` ganhou `now` (horário já iniciado nem é
listado); `getBookableDaysFromRecords` + `getBookableDaysForTenant` (uma consulta por mês, via
`loadStaffRecords` compartilhado); rota `/availability/month`; `month-calendar.tsx`;
`getNextPublicSlot` para o hero ("Próximo horário: amanhã às 09:00"). Desvios do plano:
(1) `getBookableDates` **ficou** — a agenda do painel usa os chips de 7 dias; só saiu do fluxo
público. (2) O corte por "agora" é **só público**: o diálogo do painel chama a rota com
`includeStarted=1` e continua podendo registrar atendimento de hoje que já começou; a reserva
pública recalcula com o corte no servidor, então o flag não abre brecha. Verificado: tsc,
vitest 51/51, navegador desktop e 375px (setembro com domingos e passado desabilitados,
novembro cortado no dia 12 = hoje+60, botão de próximo mês desabilita no limite), rota 400/404.
eslint: 2 erros pré-existentes em `appointment-create-dialog.tsx` (`set-state-in-effect`), não
introduzidos aqui.

## T3 — Wizard em 3 passos

Passos: **1 Serviço e profissional** · **2 Dia e horário** · **3 Seus dados e confirmação**.

- [x] `src/components/booking/booking-wizard.tsx`: `steps` vira 3; passo 1 junta a lista de
      serviços e a escolha de profissional (profissional filtra pelo serviço, como hoje;
      "Qualquer profissional" continua padrão); passo 2 = calendário de mês (T2) + horários;
      passo 3 = dados + política de cancelamento + botão **"Confirmar reserva"** (sem cartão,
      sem "Pagar"). `Progress` e "Passo X de 3" acompanham.
- [x] Validação por passo igual à atual (não avança sem serviço/horário/dados), `state.message`
      de erro aparece no passo 3.
- [x] Deep-link `?servico=&profissional=` continua funcionando e cai no passo 1 já preenchido.
- [x] `tests/e2e/main.spec.ts`: fluxo de reserva com 2 cliques em "Continuar" e 1 em
      "Confirmar reserva"; conferir texto de confirmação e que o agendamento aparece na agenda
      do painel (já existe verificação parecida no teste atual).

**Pronto quando:** reserva completa em 3 passos no navegador, desktop e 375px, sem erro de
console; `tsc`, eslint dos arquivos tocados, vitest e e2e verdes.

**Feito em 13/09:** `steps` = ["Serviço e profissional", "Dia e horário", "Seus dados"]; passo 3
traz o resumo (serviço, profissional, dia/hora, total, política) acima dos campos e o botão
"Confirmar reserva" só habilita com dados + política; `aria-pressed` nos cartões de serviço e
profissional; `autoComplete` nos campos. Verificado: tsc, eslint, vitest 51/51, reserva real no
navegador com profissional escolhido (Lucas Moreira, 14/09 10:30 → `2026-09-14T08:30Z` no
banco, sem depósito; apagada depois), deep-link inválido cai em "Qualquer", 375px sem scroll
horizontal, sem erro novo de console. **E2E não rodado**: o `webServer` do Playwright executa
`npm run db:seed` antes, e hoje isso reescreve os dados demo no Supabase — decidir com o
usuário antes de rodar.

---

## Fora deste bloco (registrar, não fazer)
- Sinal online real (adquirente) e o que fazer com `Tenant.defaultDepositCents` /
  `Service.depositRequired` enquanto não existe cobrança — hoje continuam no cadastro sem
  efeito público.
- Reagendar, concluir/faltou e pagamento no atendimento (frente seguinte, item 2 do plano
  geral).
- Bug do fuso do Prisma (`Prisma-grava-instante-deslocado-pelo-offset-local`) — não é deste
  bloco, mas o calendário depende de `startsAt` correto; se aparecer dia errado, é ele.

## Verificação final do bloco
- [ ] `npx tsc --noEmit` · eslint nos arquivos tocados · `npx vitest run` · `npm run build`.
- [ ] Reserva real de ponta a ponta no navegador (uma no seed AS Barber Club), print da
      confirmação e linha do agendamento no banco sem `Payment`/`Deposit`.
- [ ] PR para `main`; registrar no Segundo Cérebro (nota do projeto + sessão).
