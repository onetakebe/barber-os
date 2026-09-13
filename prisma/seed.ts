import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";
import { AppointmentStatus, CampaignStatus, LoyaltyTransactionType, NotificationChannel, NotificationStatus, PaymentMethod, PaymentStatus, Role, WaitlistStatus } from "../src/generated/prisma/enums";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL_MISSING");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const tenantId = "tenant_as_barber";

const firstNames = ["Henrique", "Thomas", "Rafael", "Victor", "Noah", "Gabriel", "Matteo", "Arthur", "Miguel", "Samuel", "Louis", "Pedro", "Davi", "Jules", "Nicolas", "Daniel", "Felipe", "Antoine", "Leandro", "Bruno"];
const lastNames = ["Lima", "Peeters", "Martins", "Hugo", "Jacobs", "Souza", "Rossi", "Costa", "Almeida", "Silva"];

async function seed() {
  const passwordHash = await hash("demo123", 12);
  // O tenant de demonstração é reconstruído de forma controlada para que o seed
  // seja repetível sem duplicar agenda, fila, notificações ou despesas.
  await prisma.$transaction(async (tx) => {
    const where = { tenantId };
    await tx.auditLog.deleteMany({ where });
    await tx.commissionEntry.deleteMany({ where });
    await tx.review.deleteMany({ where });
    await tx.rewardRedemption.deleteMany({ where });
    await tx.loyaltyTransaction.deleteMany({ where });
    await tx.campaignDelivery.deleteMany({ where });
    await tx.notification.deleteMany({ where });
    await tx.waitlistOffer.deleteMany({ where });
    await tx.waitlistEntry.deleteMany({ where });
    await tx.refund.deleteMany({ where });
    await tx.deposit.deleteMany({ where });
    await tx.payment.deleteMany({ where });
    await tx.appointmentStatusHistory.deleteMany({ where });
    await tx.appointmentService.deleteMany({ where });
    await tx.saleItem.deleteMany({ where });
    await tx.sale.deleteMany({ where });
    await tx.appointment.deleteMany({ where });
    await tx.inventoryMovement.deleteMany({ where });
    await tx.commissionRule.deleteMany({ where });
    await tx.customerSubscription.deleteMany({ where });
    await tx.subscriptionPlan.deleteMany({ where });
    await tx.reward.deleteMany({ where });
    await tx.loyaltyProgram.deleteMany({ where });
    await tx.campaign.deleteMany({ where });
    await tx.expense.deleteMany({ where });
    await tx.timeOff.deleteMany({ where });
    await tx.availability.deleteMany({ where });
    await tx.staffService.deleteMany({ where });
    await tx.product.deleteMany({ where });
    await tx.service.deleteMany({ where });
    await tx.serviceCategory.deleteMany({ where });
    await tx.staff.deleteMany({ where });
    await tx.customer.deleteMany({ where });
    await tx.businessUnit.deleteMany({ where });
    await tx.session.deleteMany({ where });
    await tx.membership.deleteMany({ where });
    await tx.tenant.deleteMany({ where: { id: tenantId } });
  });
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      name: "AS Barber Club",
      slug: "as-barber-club",
      description: "Barbearia contemporânea no coração de Bruxelas.",
      phone: "+32 2 555 01 84",
      email: "club@asbarber.be",
      address: "Rue Antoine Dansaert 74",
      city: "Bruxelles",
      units: { create: { name: "Dansaert", address: "Rue Antoine Dansaert 74, 1000 Bruxelles", phone: "+32 2 555 01 84" } },
    },
  });

  const personas = [
    ["owner@asbarber.be", "Alexandre", "Silva", Role.OWNER],
    ["gerente@asbarber.be", "Camila", "Rocha", Role.MANAGER],
    ["recepcao@asbarber.be", "Mariana", "Alves", Role.RECEPTIONIST],
    ["lucas@asbarber.be", "Lucas", "Moreira", Role.PROFESSIONAL],
  ] as const;

  const users = [];
  for (const [email, firstName, lastName, role] of personas) {
    const user = await prisma.user.upsert({ where: { email }, update: { passwordHash }, create: { email, firstName, lastName, passwordHash } });
    users.push(user);
    await prisma.membership.upsert({ where: { tenantId_userId: { tenantId, userId: user.id } }, update: { role }, create: { tenantId, userId: user.id, role } });
  }

  const staffSeeds = [
    { name: "Lucas Moreira", userId: users[3].id, title: "Barbeiro sênior", color: "#8B5CF6", commissionBps: 4800, imageUrl: "/images/staff/lucas-moreira.png" },
    { name: "Diego Santos", title: "Barbeiro", color: "#C4B5FD", commissionBps: 4500, imageUrl: "/images/staff/diego-santos.png" },
    { name: "Marco Almeida", title: "Barbeiro", color: "#B7F34A", commissionBps: 4500, imageUrl: "/images/staff/marco-almeida.png" },
    { name: "André Costa", title: "Barbeiro", color: "#F59E0B", commissionBps: 4200, imageUrl: "/images/staff/andre-costa.png" },
  ];
  const staff = [];
  for (const item of staffSeeds) {
    const existing = await prisma.staff.findFirst({ where: { tenantId, displayName: item.name } });
    const member = existing
      ? await prisma.staff.update({ where: { id: existing.id }, data: { imageUrl: item.imageUrl } })
      : await prisma.staff.create({ data: { tenantId, displayName: item.name, userId: item.userId, title: item.title, color: item.color, commissionBps: item.commissionBps, imageUrl: item.imageUrl } });
    staff.push(member);
    for (let day = 1; day <= 6; day += 1) {
      await prisma.availability.upsert({ where: { tenantId_staffId_dayOfWeek_startMinute: { tenantId, staffId: member.id, dayOfWeek: day, startMinute: 540 } }, update: {}, create: { tenantId, staffId: member.id, dayOfWeek: day, startMinute: 540, endMinute: day === 6 ? 1080 : 1140, breakStartMinute: 780, breakEndMinute: 840 } });
    }
  }

  const category = await prisma.serviceCategory.upsert({ where: { tenantId_name: { tenantId, name: "Serviços" } }, update: {}, create: { tenantId, name: "Serviços" } });
  const serviceSeeds = [
    ["Corte Signature", 3200, 45, false], ["Barba Premium", 2400, 30, false], ["Ritual Club", 5200, 75, true], ["Corte Máquina", 2200, 30, false], ["Sobrancelha", 1200, 15, false],
  ] as const;
  const services = [];
  for (const [name, priceCents, durationMinutes, isCombo] of serviceSeeds) {
    const service = await prisma.service.upsert({ where: { tenantId_name: { tenantId, name } }, update: {}, create: { tenantId, categoryId: category.id, name, priceCents, durationMinutes, isCombo } });
    services.push(service);
    for (const member of staff) await prisma.staffService.upsert({ where: { tenantId_staffId_serviceId: { tenantId, staffId: member.id, serviceId: service.id } }, update: {}, create: { tenantId, staffId: member.id, serviceId: service.id } });
  }

  const customers = [];
  for (let index = 0; index < 100; index += 1) {
    const firstName = firstNames[index % firstNames.length];
    const lastName = lastNames[Math.floor(index / firstNames.length) % lastNames.length];
    const phone = `+32 470 ${String(index).padStart(2, "0")} ${String(10 + (index % 90)).padStart(2, "0")} ${String(20 + (index % 70)).padStart(2, "0")}`;
    const customer = await prisma.customer.upsert({ where: { tenantId_phone: { tenantId, phone } }, update: {}, create: { tenantId, firstName, lastName, email: `cliente${index + 1}@demo.asbarber.be`, phone, marketingConsent: index % 3 !== 0, consentRecordedAt: index % 3 !== 0 ? new Date() : null, totalSpentCents: 15_000 + (index % 20) * 3_100, averageFrequencyDays: 16 + (index % 12), loyaltyPoints: 80 + index * 13, noShowCount: index % 17 === 0 ? 2 : 0, lastVisitAt: new Date(Date.now() - (5 + (index % 48)) * 86_400_000) } });
    customers.push(customer);
  }

  const now = new Date();
  now.setMinutes(0, 0, 0);
  const completedAppointments: { id: string; customerId: string; staffId: string }[] = [];
  for (let index = 0; index < 42; index += 1) {
    const startsAt = new Date(now.getTime() + (index - 20) * 3_600_000);
    const service = services[index % services.length];
    const status = index < 18 ? AppointmentStatus.COMPLETED : index === 18 ? AppointmentStatus.NO_SHOW : AppointmentStatus.CONFIRMED;
    const appointment = await prisma.appointment.create({ data: { tenantId, customerId: customers[index].id, staffId: staff[index % staff.length].id, startsAt, endsAt: new Date(startsAt.getTime() + service.durationMinutes * 60_000), status, totalCents: service.priceCents, depositCents: 500, services: { create: { tenantId, serviceId: service.id, priceCents: service.priceCents, durationMinutes: service.durationMinutes } }, statusHistory: { create: { tenantId, toStatus: status } } } });
    if (status === AppointmentStatus.COMPLETED) completedAppointments.push({ id: appointment.id, customerId: customers[index].id, staffId: staff[index % staff.length].id });
    const payment = await prisma.payment.create({ data: { tenantId, appointmentId: appointment.id, amountCents: 500, status: PaymentStatus.PAID, method: PaymentMethod.ONLINE, paidAt: startsAt } });
    await prisma.deposit.create({ data: { tenantId, appointmentId: appointment.id, paymentId: payment.id, amountCents: 500, status: status === AppointmentStatus.NO_SHOW ? PaymentStatus.RETAINED_NO_SHOW : PaymentStatus.PAID } });
    if (status === AppointmentStatus.COMPLETED) await prisma.loyaltyTransaction.create({ data: { tenantId, customerId: customers[index].id, type: LoyaltyTransactionType.EARN, points: 10 + Math.floor(service.priceCents / 100), description: service.name } });
  }

  const reviewCopies = [
    "Atendimento preciso, ambiente impecável e um corte que continua bom semanas depois.",
    "A consulta antes do corte faz toda diferença. Cada detalhe foi pensado.",
    "Fácil de reservar, pontual e sem pressa. Virou meu endereço fixo.",
  ];
  for (let index = 0; index < reviewCopies.length; index += 1) {
    const appointment = completedAppointments[index];
    await prisma.review.create({ data: { tenantId, appointmentId: appointment.id, customerId: appointment.customerId, staffId: appointment.staffId, rating: 5, comment: reviewCopies[index], isPublic: true } });
  }

  for (let index = 0; index < 6; index += 1) await prisma.waitlistEntry.create({ data: { tenantId, customerId: customers[50 + index].id, serviceId: services[index % services.length].id, staffId: index % 2 === 0 ? staff[index % staff.length].id : null, desiredDate: new Date(), windowStartMinute: 960, windowEndMinute: 1140, minimumNoticeMinutes: 40, priorityScore: 100 - index * 4, status: WaitlistStatus.WAITING } });

  // Fotos geradas em 13/09/2026 (Codex, série coesa com os retratos) em public/images.
  const productSeeds = [
    ["Pomada Matte Club", "AS-PM-01", 2200, 800, 4, "/images/product-pomade-matte-club.webp", "Fixação média, acabamento fosco. A que usamos na cadeira."],
    ["Óleo de Barba Nº 7", "AS-OB-07", 2600, 900, 12, "/images/product-beard-oil-n7.webp", "Amacia e disciplina a barba, sem brilho excessivo."],
    ["Shampoo Daily Clean", "RZ-SH-12", 1900, 1000, 8, "/images/product-shampoo-daily-clean.webp", "Limpeza leve para uso diário, sem ressecar."],
    ["Pente Carbon Pro", "UP-PC-02", 1400, 500, 2, "/images/product-comb-carbon-pro.webp", "Fibra de carbono, antiestático, dentes finos e grossos."],
  ] as const;
  for (const [name, sku, priceCents, costCents, stock, imageUrl, description] of productSeeds) await prisma.product.upsert({ where: { tenantId_sku: { tenantId, sku } }, update: { stock, imageUrl, description }, create: { tenantId, name, sku, priceCents, costCents, stock, minimumStock: 4, category: "Retail", imageUrl, description } });

  await prisma.loyaltyProgram.upsert({ where: { tenantId_name: { tenantId, name: "AS Club" } }, update: {}, create: { tenantId, name: "AS Club", pointsPerVisit: 10, pointsPerEuro: 1 } });
  for (const reward of [["Upgrade de finalização", 350, "UPGRADE"], ["Barba Premium", 900, "FREE_SERVICE"], ["Crédito de €10", 650, "CREDIT"]] as const) await prisma.reward.upsert({ where: { tenantId_name: { tenantId, name: reward[0] } }, update: {}, create: { tenantId, name: reward[0], pointsCost: reward[1], benefitType: reward[2] } });

  const campaign = await prisma.campaign.upsert({ where: { tenantId_code: { tenantId, code: "TERCA-CLUB" } }, update: {}, create: { tenantId, name: "Terça Club", status: CampaignStatus.ACTIVE, audienceSegment: "RETURN_DUE", benefitType: "DOUBLE_POINTS", code: "TERCA-CLUB", message: "Terça é dia de voltar para a cadeira com pontos em dobro." } });
  for (let index = 0; index < 12; index += 1) await prisma.campaignDelivery.upsert({ where: { campaignId_customerId: { campaignId: campaign.id, customerId: customers[index].id } }, update: {}, create: { tenantId, campaignId: campaign.id, customerId: customers[index].id, status: "CONVERTED", viewedAt: new Date(), convertedAt: new Date(), revenueCents: 3_100 } });

  await prisma.notification.create({ data: { tenantId, customerId: customers[0].id, channel: NotificationChannel.IN_APP, status: NotificationStatus.SENT, title: "Reserva confirmada", body: "Seu Corte Signature está confirmado para amanhã às 10:15.", sentAt: new Date() } });
  await prisma.expense.createMany({ data: [{ tenantId, category: "ALUGUEL", description: "Aluguel do espaço", amountCents: 320_000, dueAt: new Date(now.getFullYear(), now.getMonth(), 5), paidAt: new Date(now.getFullYear(), now.getMonth(), 3), method: PaymentMethod.TRANSFER }, { tenantId, category: "MARKETING", description: "Campanhas locais", amountCents: 48_000, dueAt: new Date(now.getFullYear(), now.getMonth(), 10), paidAt: new Date(now.getFullYear(), now.getMonth(), 9), method: PaymentMethod.CARD }] });

  const secondTenantId = "tenant_north_cut";
  await prisma.tenant.upsert({
    where: { id: secondTenantId },
    update: { name: "North Cut Demo", slug: "north-cut-demo" },
    create: { id: secondTenantId, name: "North Cut Demo", slug: "north-cut-demo", city: "Antwerpen", units: { create: { name: "Central", address: "Demo Street 10, Antwerpen" } }, categories: { create: { name: "Serviços" } } },
  });
  const secondOwner = await prisma.user.upsert({ where: { email: "owner@northcut.be" }, update: { passwordHash }, create: { email: "owner@northcut.be", firstName: "Nora", lastName: "Janssen", passwordHash } });
  await prisma.membership.upsert({ where: { tenantId_userId: { tenantId: secondTenantId, userId: secondOwner.id } }, update: { role: Role.OWNER, isActive: true }, create: { tenantId: secondTenantId, userId: secondOwner.id, role: Role.OWNER } });

  console.log("Seed concluído: AS Barber Club, 4 personas, 4 profissionais e 100 clientes.");
}

seed().finally(async () => prisma.$disconnect());
