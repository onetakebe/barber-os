import { mkdir } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

// Contas demo do seed, também presentes no Supabase Auth com a senha do seed (script de migração).
const accounts = { Proprietário: "owner@asbarber.be", Recepção: "recepcao@asbarber.be", Profissional: "lucas@asbarber.be" } as const;

async function signInQuick(page: Page, account: keyof typeof accounts) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(accounts[account]);
  await page.getByLabel("Senha").fill("demo123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/painel$/);
}

test("public barbershop presents the commercial experience without horizontal overflow", async ({ page }) => {
  await mkdir("artifacts", { recursive: true });
  await page.goto("/barbearia/as-barber-club");
  // Copy do redesign de setembro (Grafite Acolhedor).
  await expect(page.getByRole("heading", { name: /Bom corte\.\s*Boa conversa\./ }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Encontre seu ritual\./ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Agendar/ }).first()).toHaveAttribute("href", "/barbearia/as-barber-club/agendar");
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.locator("html").evaluate((element) => element.clientWidth));
  await page.screenshot({ path: "artifacts/barbershop-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole("heading", { name: /Bom corte\.\s*Boa conversa\./ }).first()).toBeVisible();
  const viewportWidth = await page.locator("html").evaluate((element) => element.clientWidth);
  const documentWidth = await page.locator("html").evaluate((element) => element.scrollWidth);
  expect(documentWidth).toBe(viewportWidth);
  await page.screenshot({ path: "artifacts/barbershop-mobile.png", fullPage: true });
});

test("owner signs in and sees the live dashboard", async ({ page }) => {
  await signInQuick(page, "Proprietário");
  await expect(page.getByRole("heading", { name: /Olá, Alexandre/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Agenda de hoje" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Próximos horários" })).toBeVisible();
});

test("customer completes a persisted booking without an online deposit", async ({ page }) => {
  await page.goto("/barbearia/as-barber-club/agendar");
  await expect(page.getByText("Passo 1 de 3")).toBeVisible();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(page.getByText(/Horários disponíveis/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Próximo mês" })).toBeVisible();
  await expect(page.locator("button.font-mono[data-state]").first()).toBeVisible();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(page.getByText("Passo 3 de 3")).toBeVisible();
  await page.getByRole("textbox", { name: "Nome", exact: true }).fill("Cliente");
  await page.getByLabel("Sobrenome").fill("Playwright");
  await page.getByLabel("E-mail").fill("playwright@example.com");
  await page.getByLabel("Telefone").fill("+32 470 99 88 77");
  await page.getByRole("button", { name: /Confirmar reserva/ }).click();
  await expect(page.getByRole("heading", { name: "Sua cadeira está reservada." })).toBeVisible();
  await expect(page.getByText("Total a pagar na barbearia")).toBeVisible();
  await expect(page.getByText("Nada foi cobrado agora", { exact: false })).toBeVisible();
});

test("owner creates a customer and the record survives reload", async ({ page }) => {
  await signInQuick(page, "Proprietário");
  await page.goto("/clientes");
  await page.getByRole("button", { name: "Adicionar cliente" }).click();
  await page.getByRole("textbox", { name: "Nome", exact: true }).fill("Persistência");
  await page.getByRole("textbox", { name: "Sobrenome" }).fill("E2E");
  await page.getByRole("textbox", { name: "E-mail" }).fill("persistencia.e2e@example.com");
  await page.getByRole("textbox", { name: "Telefone" }).fill("+32 470 77 66 55");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Registro salvo com sucesso.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Persistência E2E")).toBeVisible();

  const row = page.getByRole("row").filter({ hasText: "Persistência E2E" });
  await row.getByRole("button", { name: "Editar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Nome", exact: true }).fill("Persistido");
  await dialog.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(dialog.getByText("Alterações salvas com sucesso.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Persistido E2E")).toBeVisible();
});

test("owner persists a weekly workday and a time-off block", async ({ page }) => {
  await signInQuick(page, "Proprietário");
  await page.goto("/agenda");
  await expect(page.getByText("Disponibilidade da equipe")).toBeVisible();

  await page.getByRole("button", { name: "Editar jornada" }).click();
  const workdayDialog = page.getByRole("dialog");
  await workdayDialog.getByLabel("Profissional").selectOption({ label: "Lucas Moreira" });
  await workdayDialog.getByLabel("Dia").selectOption("1");
  await workdayDialog.getByLabel("Início", { exact: true }).fill("10:00");
  await workdayDialog.getByLabel("Fim", { exact: true }).fill("18:00");
  await workdayDialog.getByRole("button", { name: "Salvar jornada" }).click();
  await expect(workdayDialog.getByText("Jornada atualizada.")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Bloquear período" }).click();
  const timeOffDialog = page.getByRole("dialog");
  await timeOffDialog.getByLabel("Profissional").selectOption({ label: "Lucas Moreira" });
  await timeOffDialog.getByLabel("Início", { exact: true }).fill("2030-01-08T10:00");
  await timeOffDialog.getByLabel("Fim", { exact: true }).fill("2030-01-08T12:00");
  await timeOffDialog.getByLabel("Motivo").fill("Treinamento E2E");
  await timeOffDialog.getByRole("button", { name: "Registrar bloqueio" }).click();
  await expect(timeOffDialog.getByText(/Bloqueio registrado/)).toBeVisible();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByText("Treinamento E2E")).toBeVisible();
});

test("owner cancels an appointment and applies the deposit policy", async ({ page }) => {
  await signInQuick(page, "Proprietário");
  await page.goto("/agendamentos");
  const cancelButton = page.getByRole("button", { name: "Cancelar" }).first();
  await expect(cancelButton).toBeVisible();
  await cancelButton.click();
  await expect(page.getByText(/Cancelado\. O sinal/).first()).toBeVisible();
});

test("receptionist is blocked from finance on the server", async ({ page }) => {
  await signInQuick(page, "Recepção");
  await page.goto("/financeiro");
  await expect(page).toHaveURL(/\/acesso-negado$/);
  await expect(page.getByRole("heading", { name: "Acesso não autorizado" })).toBeVisible();
});

test("professional sees only the own operation and no financial metrics", async ({ page }) => {
  await signInQuick(page, "Profissional");
  await expect(page.getByText("Meu desempenho", { exact: true })).toBeVisible();
  await expect(page.getByText("Faturamento em movimento")).toHaveCount(0);
  await page.goto("/agendamentos");
  const rows = await page.locator("tbody tr").allInnerTexts();
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every((row) => row.includes("Lucas Moreira"))).toBe(true);
  await page.goto("/financeiro");
  await expect(page).toHaveURL(/\/acesso-negado$/);
});
