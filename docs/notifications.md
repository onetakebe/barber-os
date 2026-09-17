# Notificações: confirmação por e-mail e fila de envio

A reserva pública grava, na mesma transação do agendamento, uma linha em `Notification` com
`status = QUEUED`, `channel = EMAIL`, `recipient` = e-mail do cliente, `eventKey =
booking:<appointmentId>:confirmed`, `templateKey = booking_confirmation_v1` e, em `metadata`, o
snapshot versionado do evento (`BookingConfirmedV1`: cliente, barbearia, profissional
efetivamente atribuído, serviços com preço e duração, total, início/fim em UTC, fuso, política
de cancelamento). Quem envia lê só esse snapshot — nunca reconsulta o agendamento.

## Fluxo

1. `createPublicBooking` cria agendamento + notificação `QUEUED`. Se a transação cair (conflito
   de horário, por exemplo), não sobra nem agendamento nem notificação.
2. A Server Action responde ao cliente e agenda `dispatchNotification(notificationId)` com
   `after()` do Next: o envio acontece depois da resposta, fora do caminho da reserva. O
   `after()` roda dentro do `maxDuration` da rota; se for cortado no meio, a transição não
   acontece e a linha simplesmente continua `QUEUED` para a próxima passada.
3. `dispatchNotification` resolve o provedor pelo canal (`buildChannelRegistry`), renderiza
   assunto/HTML/texto a partir do snapshot (texto do cliente escapado no HTML, hora local no fuso
   da barbearia) e envia com `idempotencyKey = eventKey` — reenviar a mesma linha nunca duplica
   a mensagem no provedor.
4. Estados persistidos na própria linha:
   - **SENT**: `sentAt`, `provider` (`resend`), `providerMessageId`.
   - **QUEUED** com `lastError`: ainda vai sair. Ou o provedor não está configurado
     (`EMAIL_PROVIDER_NOT_CONFIGURED`, sem gastar tentativa), ou a falha foi transitória (429,
     5xx, rede): `attempts + 1` e `nextAttemptAt` com backoff de 1, 5, 15 e 60 minutos.
   - **FAILED**: erro permanente (4xx que não seja 429 — chave inválida, remetente não
     verificado, destinatário malformado, snapshot inválido) ou quinta tentativa esgotada.
5. Linhas antigas com `metadata.simulated` (sem `eventKey`) nunca entram na fila; a central
   `/notificacoes` as marca como "simulado (antigo)".

Não há webhook de entrega, cron nem lock: é a versão enxuta decidida em 17/09. Duas execuções
simultâneas na mesma linha (o `after()` e o endpoint) não se atropelam porque a transição só
vale se a linha ainda estiver `QUEUED` com o mesmo número de tentativas; quem perde a corrida
registra `NOTIFICATION_TRANSITION_LOST` e conta como `skipped`. No provedor, a mesma chave de
idempotência em paralelo devolve 409 (`concurrent_idempotent_requests`), tratado como
transitório — nunca marca FAILED um e-mail que está saindo pela outra execução.

## Variáveis de ambiente

| Variável | Uso |
| --- | --- |
| `RESEND_API_KEY` | Chave da API do Resend. Sem ela o e-mail fica `QUEUED` com `EMAIL_PROVIDER_NOT_CONFIGURED`. |
| `EMAIL_FROM` | Remetente, de domínio verificado no Resend: `Barber OS <reservas@seu-dominio.com>`. Também obrigatório. |
| `NOTIFICATIONS_DISPATCH_SECRET` | Bearer do endpoint interno de retentativa. Sem valor, o endpoint responde 401 para todos. |

O `replyTo` do e-mail é o `Tenant.email` da barbearia, quando existe.

## Retentativa manual

O que ficou pendente (chave ausente na hora da reserva, falha transitória com `nextAttemptAt`
vencido) sai com uma chamada ao endpoint interno. Ele atravessa barbearias (`adminDb`), por
isso fica fora do proxy de sessão e só aceita o segredo:

```sh
curl -X POST "$NEXT_PUBLIC_APP_URL/api/internal/notifications/dispatch" \
  -H "Authorization: Bearer $NOTIFICATIONS_DISPATCH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"limit": 100}'
# → {"processed":3,"sent":2,"retried":0,"failed":0,"notConfigured":1,"skipped":0}
```

`limit` é opcional (1–500, padrão 100). Sem bearer, ou com bearer errado: `401`.

O repositório não agenda essa chamada. **Em produção alguém precisa chamar o endpoint a cada
5–15 minutos** (Vercel Cron, um pinger externo, o que houver na hospedagem); sem isso, uma
reserva feita com o provedor fora do ar ou com `RESEND_API_KEY` ausente fica pendente até uma
chamada manual.

## Preparação para WhatsApp

O canal `WHATSAPP` já existe no registro, **explicitamente desabilitado**
(`WHATSAPP_CHANNEL_DISABLED`): nenhuma linha de WhatsApp é enviada, nenhuma chamada externa
acontece e nada é marcado como enviado. O que já serve é o contrato: `BookingConfirmedV1` tem
os campos que um template aprovado da WhatsApp Business API costuma pedir.

| Campo do evento | Variável do template |
| --- | --- |
| `customer.name` | `{{1}}` nome do cliente |
| `business.name` | `{{2}}` nome da barbearia |
| `startsAt` + `timezone` | `{{3}}` data e hora local (formatadas antes de enviar) |
| `staffName` | `{{4}}` profissional |
| `services[].name` | `{{5}}` lista de serviços (juntar com " + ") |
| `totalCents` + `currency` | `{{6}}` total formatado |
| `business.address` | `{{7}}` endereço |
| `cancellationNoticeHours` | `{{8}}` antecedência para remarcar |

O que ainda falta para ligar o canal — e não é "só colocar um token":

- **Número em formato internacional (E.164)**: `Customer.phone` hoje é texto livre; o
  `recipient` do WhatsApp precisa de normalização e validação antes de entrar na fila.
- **Consentimento explícito para transacional no WhatsApp**, distinto de
  `Customer.marketingConsent`: um campo próprio (e o momento em que o cliente aceita, no
  formulário de reserva) — sem ele a linha não deve ser criada.
- **Template aprovado** pela Meta para a mensagem de confirmação, com as variáveis acima, por
  idioma.
- **Número/conta da WhatsApp Business API** (direto ou via BSP como Twilio/360dialog) e o
  **adaptador de transporte** implementando `NotificationChannelProvider` para `WHATSAPP`,
  com a mesma classificação transitório/permanente do e-mail.
- Regras de janela de 24h e de custo por conversa, que mudam o que pode ser enviado e quando.

O `MockWhatsAppProvider` em `src/server/integrations/messaging.ts` continua existindo só para
a oferta da fila de espera (envio simulado, marcado como tal). Ele não é o transporte real.
