import type { Permission } from "@/domain/auth/permissions";
import { tenantDb } from "@/server/db";

export const moduleMeta = {
  agendamentos: { title: "Agendamentos", description: "Acompanhe reservas, sinais e status em um só lugar.", columns: ["Horário", "Cliente", "Serviço", "Profissional", "Status"], action: "Novo agendamento", permission: "appointments:view" },
  clientes: { title: "Clientes", description: "Relacionamentos que crescem a cada atendimento.", columns: ["Cliente", "Contato", "Visitas", "Total gasto", "Status"], action: "Adicionar cliente", permission: "customers:view" },
  equipe: { title: "Equipe", description: "Desempenho, ocupação e disponibilidade dos profissionais.", columns: ["Profissional", "Função", "Agenda", "Comissão", "Status"], action: "Adicionar profissional", permission: "team:edit" },
  servicos: { title: "Serviços e combos", description: "Organize preços, duração e quem pode executar cada serviço.", columns: ["Serviço", "Categoria", "Duração", "Preço", "Status"], action: "Criar serviço", permission: "services:view" },
  produtos: { title: "Produtos e estoque", description: "Venda mais sem perder o controle do inventário.", columns: ["Produto", "SKU", "Preço", "Estoque", "Situação"], action: "Adicionar produto", permission: "products:view" },
  campanhas: { title: "Campanhas", description: "Preencha horários e traga clientes de volta com contexto.", columns: ["Campanha", "Público", "Entregas", "Conversões", "Receita"], action: "Nova campanha", permission: "campaigns:create" },
  fidelidade: { title: "Fidelidade", description: "Recompense frequência e valor com regras transparentes.", columns: ["Cliente", "Pontos", "Movimentos", "Total gasto", "Última visita"], action: "Nova recompensa", permission: "loyalty:view" },
  financeiro: { title: "Financeiro", description: "Receita, custos e saldo para decidir com confiança.", columns: ["Origem", "Quantidade", "Entradas", "Saídas", "Saldo"], action: "Registrar despesa", permission: "finance:view" },
  relatorios: { title: "Relatórios", description: "Indicadores reais do período com exportação CSV.", columns: ["Indicador", "Resultado", "Base", "Período", "Status"], action: "Exportar CSV", permission: "finance:view" },
} as const satisfies Record<string, { title: string; description: string; columns: readonly string[]; action: string; permission: Permission }>;

export type ModuleSlug = keyof typeof moduleMeta;

/** Rosto do profissional numa célula da tabela, indexado pela coluna. */
export type RowAvatar = { imageUrl: string | null; initials: string; color: string };

function initialsOf(name: string) {
  return name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

export type ModuleData = {
  title: string;
  description: string;
  columns: readonly string[];
  action: string;
  rows: { id: string; cells: string[]; avatars?: Record<number, RowAvatar>; edit?: Record<string, string | number> }[];
  /** `hint` diz o que o número é, com dado real quando houver — nunca um número solto. */
  stats: { label: string; value: string; hint?: string }[];
};

const euro = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "EUR" }).format(cents / 100);
const integer = (value: number) => new Intl.NumberFormat("pt-BR").format(value);
const dateTime = (value: Date, timezone: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: timezone }).format(value);
const dateOnly = (value: Date | null, timezone: string) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: timezone }).format(value) : "—";

export async function getModuleData(module: ModuleSlug, tenantId: string, professionalStaffId?: string | null): Promise<ModuleData> {
  const db = tenantDb(tenantId);
  const restrictToProfessional = professionalStaffId !== undefined;
  const staffId = professionalStaffId ?? "__unlinked_professional__";
  const appointmentScope = restrictToProfessional ? { staffId } : {};
  const customerScope = restrictToProfessional ? { appointments: { some: { staffId } } } : {};
  const [tenant, customerCount, appointmentCount] = await Promise.all([
    db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { timezone: true } }),
    db.customer.count({ where: { tenantId, deletedAt: null, ...customerScope } }),
    db.appointment.count({ where: { tenantId, deletedAt: null, ...appointmentScope } }),
  ]);
  const meta = moduleMeta[module];
  let rows: ModuleData["rows"] = [];
  let stats: ModuleData["stats"] = [];

  if (module === "agendamentos") {
    const [appointments, confirmed, completed] = await Promise.all([
      db.appointment.findMany({ where: { tenantId, deletedAt: null, ...appointmentScope }, orderBy: { startsAt: "desc" }, take: 100, include: { customer: true, staff: true, services: { include: { service: true } } } }),
      db.appointment.count({ where: { tenantId, status: "CONFIRMED", deletedAt: null, ...appointmentScope } }),
      db.appointment.count({ where: { tenantId, status: "COMPLETED", deletedAt: null, ...appointmentScope } }),
    ]);
    rows = appointments.map((item) => ({
      id: item.id,
      cells: [dateTime(item.startsAt, tenant.timezone), `${item.customer.firstName} ${item.customer.lastName}`, item.services.map((service) => service.service.name).join(", "), item.staff.displayName, item.status],
      avatars: { 3: { imageUrl: item.staff.imageUrl, initials: initialsOf(item.staff.displayName), color: item.staff.color } },
    }));
    stats = [{ label: "Total", value: integer(appointmentCount), hint: "reservas registradas até hoje" }, { label: "Confirmados", value: integer(confirmed), hint: "aguardando o atendimento" }, { label: "Concluídos", value: integer(completed), hint: "atendimentos já feitos" }];
  }

  if (module === "clientes") {
    const customers = await db.customer.findMany({ where: { tenantId, deletedAt: null, ...customerScope }, orderBy: { createdAt: "desc" }, take: 100, include: { _count: { select: { appointments: true } } } });
    const totalSpent = customers.reduce((sum, item) => sum + item.totalSpentCents, 0);
    rows = customers.map((item) => ({
      id: item.id,
      cells: [`${item.firstName} ${item.lastName}`, item.email ?? item.phone, integer(item._count.appointments), euro(item.totalSpentCents), item.status],
      edit: { firstName: item.firstName, lastName: item.lastName, email: item.email ?? "", phone: item.phone },
    }));
    stats = [{ label: "Clientes ativos", value: integer(customerCount), hint: "cadastrados na barbearia" }, { label: "Com histórico", value: integer(customers.filter((item) => item._count.appointments > 0).length), hint: `já passaram pela cadeira, entre os ${integer(customers.length)} mais recentes` }, { label: "Valor registrado", value: euro(totalSpent), hint: "soma do que esses clientes gastaram" }];
  }

  if (module === "equipe") {
    const staff = await db.staff.findMany({ where: { tenantId, deletedAt: null }, orderBy: { displayName: "asc" }, include: { _count: { select: { appointments: true, services: true } } } });
    rows = staff.map((item) => ({
      id: item.id,
      cells: [item.displayName, item.title ?? item.role, `${item._count.appointments} reservas · ${item._count.services} serviços`, `${(item.commissionBps / 100).toFixed(0)}%`, item.isBookable ? "Disponível" : "Inativo"],
      avatars: { 0: { imageUrl: item.imageUrl, initials: initialsOf(item.displayName), color: item.color } },
      edit: { displayName: item.displayName, title: item.title ?? "", commissionPercent: item.commissionBps / 100, imageUrl: item.imageUrl ?? "" },
    }));
    stats = [{ label: "Profissionais", value: integer(staff.length), hint: "na equipe" }, { label: "Disponíveis online", value: integer(staff.filter((item) => item.isBookable).length), hint: "aparecem na reserva pública" }, { label: "Reservas vinculadas", value: integer(staff.reduce((sum, item) => sum + item._count.appointments, 0)), hint: "atendidas por toda a equipe" }];
  }

  if (module === "servicos") {
    const services = await db.service.findMany({ where: { tenantId, deletedAt: null }, orderBy: { name: "asc" }, include: { category: true, _count: { select: { appointmentServices: true, staff: true } } } });
    rows = services.map((item) => ({
      id: item.id,
      cells: [item.name, item.category.name, `${item.durationMinutes} min`, euro(item.priceCents), item.isActive ? "Ativo" : "Inativo"],
      edit: { name: item.name, description: item.description ?? "", price: item.priceCents / 100, durationMinutes: item.durationMinutes },
    }));
    stats = [{ label: "Serviços", value: integer(services.length), hint: "no catálogo" }, { label: "Ativos", value: integer(services.filter((item) => item.isActive).length), hint: "visíveis para reserva" }, { label: "Preço médio", value: euro(services.length ? Math.round(services.reduce((sum, item) => sum + item.priceCents, 0) / services.length) : 0), hint: "entre os serviços cadastrados" }];
  }

  if (module === "produtos") {
    const products = await db.product.findMany({ where: { tenantId, deletedAt: null }, orderBy: { name: "asc" } });
    rows = products.map((item) => ({
      id: item.id,
      cells: [item.name, item.sku, euro(item.priceCents), integer(item.stock), item.stock <= item.minimumStock ? "Estoque baixo" : "Em dia"],
      edit: { name: item.name, sku: item.sku, category: item.category, price: item.priceCents / 100, cost: item.costCents / 100, stock: item.stock, minimumStock: item.minimumStock },
    }));
    stats = [{ label: "Produtos", value: integer(products.length), hint: "cadastrados" }, { label: "Unidades em estoque", value: integer(products.reduce((sum, item) => sum + item.stock, 0)), hint: "somando todos os produtos" }, { label: "Alertas", value: integer(products.filter((item) => item.stock <= item.minimumStock).length), hint: "abaixo do estoque mínimo" }];
  }

  if (module === "campanhas") {
    const campaigns = await db.campaign.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, include: { deliveries: true } });
    rows = campaigns.map((item) => ({ id: item.id, cells: [item.name, item.audienceSegment, integer(item.deliveries.length), integer(item.deliveries.filter((delivery) => delivery.convertedAt).length), euro(item.deliveries.reduce((sum, delivery) => sum + delivery.revenueCents, 0))] }));
    stats = [{ label: "Campanhas", value: integer(campaigns.length), hint: "criadas" }, { label: "Ativas", value: integer(campaigns.filter((item) => item.status === "ACTIVE").length), hint: "em andamento agora" }, { label: "Receita atribuída", value: euro(campaigns.flatMap((item) => item.deliveries).reduce((sum, item) => sum + item.revenueCents, 0)), hint: "vendas ligadas a campanhas" }];
  }

  if (module === "fidelidade") {
    const [customers, rewardCount, transactionCount] = await Promise.all([
      db.customer.findMany({ where: { tenantId, deletedAt: null }, orderBy: { loyaltyPoints: "desc" }, take: 100, include: { _count: { select: { loyaltyTransactions: true } } } }),
      db.reward.count({ where: { tenantId, isActive: true } }),
      db.loyaltyTransaction.count({ where: { tenantId } }),
    ]);
    rows = customers.map((item) => ({ id: item.id, cells: [`${item.firstName} ${item.lastName}`, integer(item.loyaltyPoints), integer(item._count.loyaltyTransactions), euro(item.totalSpentCents), dateOnly(item.lastVisitAt, tenant.timezone)] }));
    stats = [{ label: "Participantes", value: integer(customers.length), hint: "clientes no programa de pontos" }, { label: "Recompensas", value: integer(rewardCount), hint: "ativas para resgate" }, { label: "Movimentos", value: integer(transactionCount), hint: "pontos ganhos e resgatados" }];
  }

  if (module === "financeiro" || module === "relatorios") {
    const [payments, sales, expenses, completed] = await Promise.all([
      db.payment.aggregate({ where: { tenantId, status: "PAID" }, _sum: { amountCents: true }, _count: true }),
      db.sale.aggregate({ where: { tenantId }, _sum: { totalCents: true }, _count: true }),
      db.expense.aggregate({ where: { tenantId }, _sum: { amountCents: true }, _count: true }),
      db.appointment.aggregate({ where: { tenantId, status: "COMPLETED", deletedAt: null }, _sum: { totalCents: true }, _count: true }),
    ]);
    const serviceRevenue = completed._sum.totalCents ?? 0;
    const productRevenue = sales._sum.totalCents ?? 0;
    const deposits = payments._sum.amountCents ?? 0;
    const expenseTotal = expenses._sum.amountCents ?? 0;
    const revenue = serviceRevenue + productRevenue;
    const balance = revenue - expenseTotal;
    if (module === "financeiro") {
      rows = [{ id: "services", cells: ["Serviços", integer(completed._count), euro(serviceRevenue), "—", euro(serviceRevenue)] }, { id: "products", cells: ["Produtos", integer(sales._count), euro(productRevenue), "—", euro(productRevenue)] }, { id: "deposits", cells: ["Sinais pagos", integer(payments._count), euro(deposits), "—", euro(deposits)] }, { id: "expenses", cells: ["Despesas", integer(expenses._count), "—", euro(expenseTotal), euro(-expenseTotal)] }];
    } else {
      const ticket = completed._count ? Math.round(serviceRevenue / completed._count) : 0;
      rows = [{ id: "revenue", cells: ["Receita operacional", euro(revenue), `${completed._count + sales._count} lançamentos`, "Todos os dados", "Atualizado"] }, { id: "ticket", cells: ["Ticket médio de serviços", euro(ticket), `${completed._count} atendimentos`, "Todos os dados", "Atualizado"] }, { id: "customers", cells: ["Clientes cadastrados", integer(customerCount), `${appointmentCount} reservas`, "Todos os dados", "Atualizado"] }, { id: "balance", cells: ["Saldo básico", euro(balance), `${expenses._count} despesas`, "Todos os dados", "Atualizado"] }];
    }
    stats = [{ label: "Receita", value: euro(revenue), hint: `${integer(completed._count)} atendimentos e ${integer(sales._count)} vendas` }, { label: "Despesas", value: euro(expenseTotal), hint: `${integer(expenses._count)} lançamentos` }, { label: "Saldo básico", value: euro(balance), hint: "receita menos despesas" }];
  }

  return { ...meta, rows, stats };
}
