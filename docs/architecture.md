# Arquitetura do MVP persistido

O Barber OS é um monólito modular em Next.js App Router.

```text
Browser
  ├─ páginas públicas → catálogo/slots pelo slug do tenant
  └─ painel → cookie opaco → Session → Membership/Tenant
                         ├─ Server Components (leituras Prisma)
                         └─ Server Actions (Zod + RBAC + transações)
                                               └─ PostgreSQL
```

`src/domain` contém regras puras. `src/server/data` contém consultas/DTOs. `src/server/services` orquestra disponibilidade e reserva. `src/app` protege rotas e define mutações. `prisma` contém schema, migrations e seed.

Fronteiras externas são interfaces. O e-mail de confirmação da reserva é real (Resend, fila persistida em `Notification`, ver `docs/notifications.md`); pagamento e WhatsApp seguem com adapters simulados/desabilitados. O restante do fluxo é real e persistido, o que permite trocar o adapter sem reescrever agenda, sinal ou fila.
