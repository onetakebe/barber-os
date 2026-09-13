import { authorize } from "@/domain/auth/permissions";
import { getSession } from "@/server/auth/session";
import { tenantDb } from "@/server/db";

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Não autenticado", { status: 401 });
  if (!authorize(session.role, "finance:view")) return new Response("Sem permissão", { status: 403 });
  const db = tenantDb(session.tenantId);

  const [payments, sales, expenses] = await Promise.all([
    db.payment.findMany({ where: { tenantId: session.tenantId }, orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true, amountCents: true, status: true, method: true } }),
    db.sale.findMany({ where: { tenantId: session.tenantId }, orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true, totalCents: true, paymentMethod: true } }),
    db.expense.findMany({ where: { tenantId: session.tenantId }, orderBy: { dueAt: "desc" }, select: { id: true, dueAt: true, description: true, category: true, amountCents: true, paidAt: true } }),
  ]);
  const header = ["tipo", "id", "data", "descrição", "entrada_eur", "saída_eur", "status"];
  const rows = [
    ...payments.map((item) => ["pagamento", item.id, item.createdAt.toISOString(), item.method, (item.amountCents / 100).toFixed(2), "", item.status]),
    ...sales.map((item) => ["venda", item.id, item.createdAt.toISOString(), item.paymentMethod, (item.totalCents / 100).toFixed(2), "", "REALIZADA"]),
    ...expenses.map((item) => ["despesa", item.id, item.dueAt.toISOString(), `${item.category}: ${item.description}`, "", (item.amountCents / 100).toFixed(2), item.paidAt ? "PAGA" : "PENDENTE"]),
  ];
  const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(";")).join("\n")}`;
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="barber-os-financeiro-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
