# Relatório de arquitetura — API Laravel e banco MySQL

**Projeto:** Barber OS  
**Data:** 27 de julho de 2026  
**Status:** proposta para revisão  
**Escopo:** planejamento da nova API e da migração gradual; nenhuma substituição do sistema atual nesta etapa.

## 1. Resumo executivo

O Barber OS continuará usando o frontend Next.js existente. Uma nova API REST será criada em `api/`, com Laravel 13, PHP 8.3 ou superior e MySQL 8.4 LTS/InnoDB. A mudança será gradual: cada domínio será ativado no Laravel somente depois de atingir paridade funcional e passar por testes de isolamento multiempresa, permissões e concorrência.

A abordagem recomendada é um **monólito modular**, e não um conjunto de microserviços. Ela oferece separação clara dos domínios sem aumentar prematuramente a complexidade operacional. Laravel será responsável por autenticação, autorização, regras de negócio, persistência e eventos assíncronos. Next.js continuará responsável pela interface, navegação e experiência do usuário.

Durante a migração, cada módulo terá um único responsável por gravações. Não haverá escrita simultânea no Prisma/PostgreSQL e no Laravel/MySQL para agendamentos, pagamentos ou estoque. Essa regra evita dados divergentes e torna o retorno à implementação anterior simples.

## 2. Situação atual observada

O projeto atual é uma aplicação Next.js com Prisma e PostgreSQL. O modelo já contempla usuários, empresas, membros, clientes, equipe, serviços, disponibilidade, bloqueios, agendamentos, sinal, créditos, fila de espera, notificações, campanhas, fidelidade, produtos, estoque, vendas, despesas, comissões e avaliações.

Pontos que devem ser preservados:

- sessão em cookie `HttpOnly`;
- empresa ativa derivada da sessão;
- consultas autenticadas limitadas por `tenantId`;
- papéis `OWNER`, `MANAGER`, `RECEPTIONIST` e `PROFESSIONAL`;
- valores monetários representados em centavos;
- dois tenants no ambiente de demonstração;
- prevenção de sobreposição de horários no banco;
- fluxos simulados de sinal, estorno e notificações;
- testes unitários, de integração e de navegador existentes.

O PostgreSQL atual usa uma restrição de exclusão para impedir sobreposição de agendamentos. Como o MySQL não oferece a mesma restrição, a nova solução precisa garantir o conflito por outra estrutura, sem depender apenas de uma consulta prévia.

## 3. Arquitetura proposta

```text
Navegador
   │ cookie seguro + CSRF
   ▼
Next.js (interface existente)
   │ REST JSON /api/v1
   ▼
Laravel (api/)
   ├── autenticação e tenant ativo
   ├── políticas e permissões
   ├── validação e regras de negócio
   ├── transações e eventos
   └── filas e tarefas agendadas
          │
          ├── MySQL 8.4 LTS — fonte de verdade
          └── Redis — cache, limites e filas
```

Estrutura do repositório:

```text
barber/
├── src/                    # frontend Next.js existente
├── public/
├── prisma/                 # mantido durante a transição
├── api/                    # nova aplicação Laravel
├── docker-compose.yml      # MySQL, Redis e Mailpit
├── package.json
└── README.md
```

Em produção, frontend e API devem compartilhar o mesmo domínio principal, por exemplo `app.exemplo.com` e `api.exemplo.com`. Isso permite usar o modo SPA do Laravel Sanctum com sessão em cookie, proteção CSRF e sem guardar token de acesso no navegador.

## 4. Organização interna da API

Os módulos serão organizados por domínio:

1. **Identity:** usuários, login, logout, recuperação de senha e sessões.
2. **Tenancy:** empresas, unidades, membros, convites e seleção da empresa ativa.
3. **Access:** papéis, permissões, Policies e auditoria.
4. **Catalog:** equipe, clientes, serviços, categorias e produtos.
5. **Scheduling:** disponibilidade, bloqueios, agenda, agendamentos e conflitos.
6. **Billing:** sinal, pagamentos, créditos, cancelamentos e estornos.
7. **Waitlist:** fila, ofertas de horário, expiração e notificações.
8. **Loyalty:** pontuação, recompensas e resgates.
9. **Inventory:** estoque, movimentações e vendas.
10. **Finance:** despesas, receitas, comissões e indicadores.
11. **Reporting:** dashboard e agregações.

Cada requisição seguirá o fluxo:

```text
Route → Middleware → Form Request → Controller → Action/Service
      → transação Eloquent → Resource JSON
```

Os controllers serão finos. Validação ficará em Form Requests; autorização em Policies; regras que alteram o negócio em Actions ou Services. Não será adicionada uma camada genérica de repositórios enquanto Eloquent atender ao caso, evitando abstrações sem benefício real.

## 5. Banco de dados e convenções

### 5.1 Tecnologia

- MySQL 8.4 LTS;
- engine InnoDB em todas as tabelas;
- charset `utf8mb4`;
- identificadores ULID armazenados de forma consistente;
- datas operacionais em UTC com precisão de milissegundos;
- fuso horário configurado por tenant e aplicado nas bordas da API;
- valores monetários como inteiros em centavos e código ISO da moeda;
- `created_at`, `updated_at` e, onde fizer sentido, `deleted_at`;
- nomes de índices e restrições explícitos;
- chaves estrangeiras para integridade e índices compostos pelos filtros reais.

### 5.2 Isolamento multiempresa

Será usado banco único com esquema compartilhado. Toda tabela de negócio terá `tenant_id`. O tenant será resolvido a partir da sessão autenticada e de uma membership ativa; nunca será aceito diretamente do corpo enviado pelo navegador.

As proteções serão cumulativas:

- middleware cria um `TenantContext` por requisição;
- consultas de domínio sempre recebem o tenant atual;
- route model binding é limitado ao tenant;
- Policies verificam membership, papel e propriedade do recurso;
- unicidades relevantes começam por `tenant_id`;
- jobs assíncronos carregam e revalidam o `tenant_id`;
- testes tentam acessar e alterar objetos de outra empresa.

Global scopes podem ser usados como proteção adicional, mas não serão a única barreira, pois podem ser removidos acidentalmente em consultas administrativas.

### 5.3 Modelo principal

Ordem das migrations:

1. `users`, `tenants`, `memberships`, `sessions`;
2. `locations`, `staff`, `customers`;
3. `service_categories`, `services`, `staff_services`;
4. `availabilities`, `time_offs`;
5. `appointments`, `appointment_services`, `appointment_slots`, `appointment_status_history`;
6. `payments`, `deposits`, `credits`, `refunds`;
7. `waitlist_entries`, `waitlist_offers`, `notifications`;
8. `loyalty_programs`, `loyalty_transactions`, `rewards`, `reward_redemptions`;
9. `products`, `inventory_movements`, `sales`, `sale_items`;
10. `expenses`, `commissions`;
11. `audit_logs`, `idempotency_keys`, `outbox_events`.

O seed inicial recriará dados equivalentes aos dois tenants de demonstração. A importação de dados reais será um trabalho separado, com mapeamento, validação de contagens, reconciliação e opção de retorno.

## 6. Autenticação, convites e permissões

Para a aplicação web própria será usado Laravel Sanctum em modo SPA:

- sessão no servidor;
- cookie `HttpOnly`, `Secure` em produção e `SameSite=Lax`;
- endpoint CSRF antes do login;
- regeneração da sessão após autenticação;
- invalidação da sessão no logout;
- limite de tentativas no login e nos fluxos públicos;
- senhas com o hasher padrão seguro do Laravel;
- recuperação de senha por link temporário.

Tokens pessoais não serão usados pelo frontend próprio. Eles poderão ser adicionados no futuro para aplicativo móvel ou integrações externas.

Convites terão token aleatório armazenado como hash, tenant, papel, e-mail, emissor, expiração e estado. Aceitar um convite exigirá e-mail compatível, token válido e transação atômica para impedir reutilização.

Para o MVP, as permissões serão implementadas com Policies e uma matriz versionada por papel. O papel pertence à membership, não ao usuário global. Permissões excepcionais poderão ser acrescentadas depois, sem introduzir agora um sistema RBAC excessivamente complexo.

## 7. Disponibilidade e prevenção de conflitos

Disponibilidade será calculada usando:

- horário recorrente do profissional;
- bloqueios e folgas;
- duração total dos serviços;
- intervalo de preparação ou limpeza;
- agendamentos ativos;
- fuso horário do tenant;
- antecedência mínima e limite futuro configuráveis.

### Garantia no MySQL

Uma simples consulta “o horário está livre?” não impede duas requisições simultâneas de reservar o mesmo horário. A garantia será feita por slots discretos:

1. a agenda usa uma granularidade fixa, inicialmente 15 minutos;
2. cada agendamento gera linhas em `appointment_slots`;
3. existe uma restrição única em `(tenant_id, staff_id, slot_datetime)`;
4. agendamento e slots são inseridos na mesma transação;
5. uma colisão de chave única é convertida em HTTP `409 APPOINTMENT_CONFLICT`;
6. cancelamento libera os slots na mesma transação;
7. transações podem ser repetidas após deadlock, com limite controlado.

Esse desenho permite serviços de durações diferentes e garante o conflito no banco, inclusive sob concorrência. Testes dispararão duas reservas simultâneas e exigirão exatamente uma vencedora.

## 8. Contrato REST

Todas as rotas ficarão em `/api/v1`. Exemplos:

```text
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/me
POST   /api/v1/invitations/{token}/accept

GET    /api/v1/staff
POST   /api/v1/staff
GET    /api/v1/customers
POST   /api/v1/customers
GET    /api/v1/services
POST   /api/v1/services

GET    /api/v1/availability
POST   /api/v1/appointments
POST   /api/v1/appointments/{appointment}/cancel
POST   /api/v1/appointments/{appointment}/deposit

GET    /api/v1/waitlist
POST   /api/v1/waitlist
GET    /api/v1/products
POST   /api/v1/inventory/movements
GET    /api/v1/dashboard
```

Listagens terão paginação, filtros permitidos explicitamente e ordenação com lista branca. Respostas serão produzidas por API Resources. Erros seguirão um contrato estável:

```json
{
  "error": {
    "code": "APPOINTMENT_CONFLICT",
    "message": "Este horário acabou de ser reservado.",
    "fields": {},
    "trace_id": "01J..."
  }
}
```

Operações sensíveis a repetição — criar agendamento, pagar sinal, cancelar, estornar e aceitar oferta — aceitarão `Idempotency-Key`. O servidor guardará a assinatura da requisição e a resposta, impedindo cobrança ou reserva duplicada por duplo clique ou repetição de rede.

Uma especificação OpenAPI será mantida junto da API e validada por testes de contrato.

## 9. Pagamento, cancelamento e integrações

No MVP, o sinal continuará simulado. O modelo será desenhado como se existisse um provedor real:

- estados explícitos, como `pending`, `paid`, `failed`, `refunded` e `converted_to_credit`;
- referência externa opcional;
- transição de estado validada;
- webhook preparado para assinatura, repetição e idempotência;
- histórico imutável das operações financeiras.

A política de cancelamento será configurável por tenant: prazo, devolução integral, conversão em crédito ou retenção do sinal. A decisão será registrada com a versão da política usada no momento, evitando que uma mudança futura altere retroativamente cancelamentos antigos.

WhatsApp, e-mail, SMS, mapas e pagamento real permanecerão integrações externas. No desenvolvimento, notificações serão registradas e visualizadas no Mailpit; jobs usarão uma interface de canal para permitir conectar provedores depois.

## 10. Eventos, filas e consistência

Agendamento, cancelamento, oferta de fila e pagamento gravarão um evento em `outbox_events` na mesma transação dos dados principais. Um worker processará notificações e tarefas derivadas. Assim, uma queda entre “salvar agendamento” e “enviar mensagem” não perde o evento.

Redis será recomendado para filas, cache e rate limiting. MySQL continuará sendo a fonte de verdade. Jobs terão:

- tenant explícito;
- chave idempotente;
- número limitado de tentativas;
- backoff;
- timeout;
- fila de falhas;
- logs correlacionados pelo `trace_id`.

## 11. Migração gradual do Next.js

O frontend ganhará uma camada de acesso por domínio. Cada módulo terá um seletor de backend apenas no servidor, por exemplo:

```text
AUTH_BACKEND=laravel
TEAM_BACKEND=laravel
BOOKING_BACKEND=prisma
FINANCE_BACKEND=prisma
```

Regras de transição:

- um único backend grava cada domínio;
- comparações em paralelo serão somente de leitura;
- cada ativação terá checklist, métricas e procedimento de retorno;
- recursos públicos e administrativos do mesmo domínio mudarão juntos quando compartilharem invariantes;
- Prisma/PostgreSQL só serão removidos após paridade integral, estabilização e backup validado.

Ordem de corte:

1. infraestrutura e contrato básico;
2. autenticação;
3. tenant, convites e permissões;
4. equipe, clientes e serviços;
5. disponibilidade;
6. agendamento e prevenção de conflitos;
7. sinal, cancelamento e créditos;
8. fila de espera e notificações;
9. dashboard;
10. fidelidade;
11. produtos e estoque;
12. financeiro básico;
13. retirada definitiva do Prisma/PostgreSQL.

## 12. Segurança

O desenho considera os principais riscos da OWASP para APIs, especialmente autorização por objeto, autenticação, autorização por função, consumo sem limite e fluxos comerciais sensíveis.

Controles mínimos:

- nunca confiar em `tenant_id`, papel, preço ou totais enviados pelo cliente;
- recalcular preços e disponibilidade no servidor;
- validar cada objeto por tenant e Policy;
- limites separados para login, busca de disponibilidade, criação de reserva e endpoints públicos;
- CORS com origens explícitas;
- CSRF em todas as mutações autenticadas;
- segredo e credenciais fora do Git;
- logs sem senha, cookie, token ou dados de pagamento;
- cabeçalhos de segurança no proxy;
- `APP_DEBUG=false` em produção;
- auditoria para permissões, agenda, dinheiro e estoque;
- dependências verificadas no CI.

## 13. Testes e critérios de aceite

A maior parte da suíte Laravel será de Feature Tests, complementada por testes unitários e navegador.

Cobertura obrigatória:

- login, logout, CSRF e recuperação de senha;
- convite válido, expirado e reutilizado;
- isolamento entre dois tenants em todas as operações;
- matriz de permissões por papel;
- CRUD de equipe, clientes e serviços;
- disponibilidade, bloqueios, fuso e virada de horário;
- concorrência de agendamento;
- idempotência;
- política de cancelamento e sinal;
- expiração e aceite da fila de espera;
- fidelidade, estoque, venda, despesa e comissão;
- contratos JSON e códigos HTTP;
- fluxo completo no Next.js com Playwright;
- comparação de resultados com o backend anterior antes de cada corte.

O pipeline deverá executar:

```text
composer validate
Laravel Pint
PHPStan/Larastan
php artisan test
npm run lint
npm run typecheck
npm test
npm run build
```

Testes de integração usarão MySQL real, não SQLite, porque índices, locks e comportamento concorrente fazem parte da regra de negócio.

## 14. Operação e implantação

Ambiente local:

- containers para MySQL 8.4, Redis e Mailpit;
- Laravel executado em container ou com PHP local;
- comandos documentados em uma única seção do README;
- seed de demonstração repetível e restrito a desenvolvimento.

Produção:

- Nginx ou proxy equivalente;
- PHP-FPM com PHP 8.3 ou superior;
- processo separado para queue worker, reiniciado a cada deploy;
- scheduler executado continuamente;
- rota de saúde;
- migrations executadas antes da troca de tráfego, com backup;
- logs estruturados e monitoramento de erros;
- métricas de latência, taxa de erro, conflitos, jobs falhos e tempo de fila.

## 15. Fases e entregáveis

### Fase 0 — fundação

Aplicação Laravel em `api/`, Docker Compose, CI, padrão de resposta, logs, OpenAPI e conexão MySQL/Redis.

### Fase 1 — segurança

Sanctum, usuários, tenants, memberships, convites, papéis, Policies, auditoria e testes de isolamento.

### Fase 2 — operação principal

Equipe, clientes, serviços, disponibilidade, bloqueios, agenda, slots transacionais, criação e cancelamento.

### Fase 3 — receita e retenção

Sinal simulado, créditos, fila de espera, notificações, fidelidade e campanhas.

### Fase 4 — gestão

Produtos, estoque, vendas, despesas, comissões, dashboard e relatórios básicos.

### Fase 5 — corte e estabilização

Ativação gradual no Next.js, comparação, correções, backup, retirada do legado e documentação operacional.

Cada fase só termina quando migrations, seed, análise estática, testes, build do frontend e critérios de aceite do módulo estiverem aprovados.

## 16. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Vazamento entre empresas | TenantContext, consultas compostas, Policies, bindings limitados e testes negativos |
| Reserva duplicada | Slots únicos, transação, idempotência e teste concorrente |
| Divergência entre bancos | Um único responsável por escrita e corte por domínio |
| Quebra do frontend | contrato versionado, adapter, testes de contrato e retorno por flag |
| Perda de notificação | outbox transacional e fila com repetição |
| Datas incorretas | UTC no banco, fuso por tenant e testes de horário |
| Duplicidade financeira | centavos inteiros, máquina de estados e Idempotency-Key |
| Migração longa demais | módulos pequenos, ordem por valor e critérios de conclusão objetivos |

## 17. O que ficará funcional, simulado e externo

Ao final da implementação planejada:

- **Funcional:** autenticação, multiempresa, permissões, cadastros, disponibilidade, agenda, conflitos, cancelamento, fila, dashboard, fidelidade, produtos, estoque e financeiro básico.
- **Simulado:** captura e estorno do sinal; envio de notificações poderá ser registrado localmente.
- **Externo:** gateway de pagamento, WhatsApp oficial, SMS, e-mail transacional, mapas, observabilidade SaaS e infraestrutura de produção.

## 18. Decisões para aprovação

1. Manter o Next.js como frontend.
2. Criar Laravel em `api/` no mesmo repositório.
3. Usar Laravel 13, PHP 8.3+, MySQL 8.4 LTS, Redis e Sanctum.
4. Migrar por domínio, sem dupla escrita.
5. Usar banco compartilhado com `tenant_id` e defesas em camadas.
6. Garantir agenda com `appointment_slots` e índice único.
7. Manter sinal simulado, mas com contrato preparado para gateway real.
8. Só retirar Prisma/PostgreSQL após paridade e estabilização.

## 19. Referências oficiais

- [Laravel 13 — Sanctum](https://laravel.com/docs/13.x/sanctum)
- [Laravel 13 — banco de dados e transações](https://laravel.com/docs/13.x/database)
- [Laravel 13 — rate limiting](https://laravel.com/docs/13.x/rate-limiting)
- [Laravel 13 — testes](https://laravel.com/docs/13.x/testing)
- [Laravel 13 — implantação](https://laravel.com/docs/13.x/deployment)
- [MySQL 8.4 — locking e transações InnoDB](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-transaction-model.html)
- [MySQL 8.4 — tratamento de deadlocks](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks-handling.html)
- [OWASP API Security Top 10 — 2023](https://owasp.org/API-Security/editions/2023/en/0x00-toc/)
