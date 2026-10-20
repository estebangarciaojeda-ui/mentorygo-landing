// Pruebas de extremo a extremo de la landing (búsqueda, filtros, reservas, simulador, responsive).
// Uso:  npm i -D playwright  &&  npx playwright install chromium  &&  node tests/landing.test.mjs
// Opcional: SHOTS=carpeta para guardar capturas; CHROME_PATH para usar un Chromium existente.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const here = path.dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(path.join(here, "..", "dist", "index.html")).href;
const shots = process.env.SHOTS;
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("  ok  ", name); }
  catch (e) { failed++; console.log("  FAIL", name, "\n       ", e.message.split("\n")[0]); }
}

const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-EC", timezoneId: "America/Guayaquil" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", m => { if (m.type() === "error" && !/fonts\.g/.test(m.text())) errors.push(m.text()); });
await page.goto(url);
await page.waitForSelector(".tcard");
const cards = () => page.$$eval(".tcard", els => els.map(e => e.innerText));
const settle = () => page.waitForFunction(() => !document.querySelector("#resList[aria-busy]"));

await test("carga sin errores de JavaScript", async () => { assert.deepEqual(errors, []); });
await test("muestra docentes y todos están etiquetados como ficticios", async () => {
  const c = await cards(); assert.ok(c.length >= 5, "pocos resultados: " + c.length);
  assert.ok(c.every(t => /ficticio/i.test(t)));
});
await test("filtro de materia actualiza resultados", async () => {
  await page.selectOption("#fSubject", "Matemáticas"); await settle();
  const c = await cards(); assert.ok(c.length > 0); assert.ok(c.every(t => t.includes("Matemáticas")));
  const n = await page.$$eval(".pin:not(.dim)", p => p.length); assert.equal(n, c.length, "pines del mapa = tarjetas");
});
await test("precio máximo filtra por tarifa", async () => {
  await page.selectOption("#fSubject", ""); await settle();
  await page.$eval("#fPrice", el => { el.value = 16; el.dispatchEvent(new Event("input", { bubbles: true })); });
  const prices = await page.$$eval(".tcard .price b", els => els.map(e => Number(e.textContent.replace(/[^\d]/g, ""))));
  assert.ok(prices.length > 0 && prices.every(p => p <= 16), prices.join(","));
});
await test("modalidad virtual deja solo docentes con clase virtual", async () => {
  await page.$eval("#fPrice", el => { el.value = 30; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.click("[data-mod=virtual]"); await settle();
  const c = await cards(); assert.ok(c.length > 0 && c.every(t => t.includes("Virtual")));
});
await test("estado vacío con filtros imposibles y botón de limpiar", async () => {
  await page.selectOption("#fSubject", "Música (piano)"); await settle();
  assert.ok(await page.isVisible("text=No hay docentes con esos filtros"));
  await page.click("#emptyReset"); await settle();
  assert.ok((await cards()).length >= 5);
});
await test("distancia ordena de cerca a lejos (presencial)", async () => {
  const ds = await page.evaluate(() => window.__mentorygo.filtered().filter(x => x.t.modalidades.includes("presencial")).map(x => x.d));
  for (let i = 1; i < ds.length; i++) assert.ok(ds[i] >= ds[i - 1]);
});
await test("Haversine aproximada: La Carolina a Centro Histórico ≈ 4,8 km", async () => {
  const d = await page.evaluate(() => window.__mentorygo.haversineKm({ lat: -0.186, lon: -78.483 }, { lat: -0.220, lon: -78.512 }));
  assert.ok(d > 4.5 && d < 5.1, String(d));
});
if (shots) await page.screenshot({ path: path.join(shots, "desktop-claro.png"), fullPage: false });

let firstSlot;
await test("perfil abre con aviso de no verificado y reserva crea estado requested", async () => {
  await page.click(".tcard >> nth=0");
  await page.waitForSelector("#profileDlg[open]");
  assert.ok(await page.isVisible("#profileDlg >> text=no ha sido verificado"));
  await page.click("#goBook");
  await page.waitForSelector("#bookDlg[open]");
  await page.click("#bkForm button[type=submit]");
  assert.ok(await page.isVisible("text=Elige un horario para continuar"));
  firstSlot = await page.getAttribute("#bookDlg .slot:not(.taken) >> nth=0", "data-key");
  await page.click(`#bookDlg .slot[data-key="${firstSlot}"]`);
  await page.click("#bkForm button[type=submit]");
  await page.waitForSelector(".bk .st-requested");
});
await test("no permite reservar dos veces el mismo horario", async () => {
  await page.click(".tcard >> nth=0"); await page.click("#goBook");
  const cls = await page.getAttribute(`#bookDlg .slot[data-key="${firstSlot}"]`, "class");
  assert.ok(cls.includes("taken"));
  await page.click(`#bookDlg .slot[data-key="${firstSlot}"]`, { force: true });
  assert.ok(await page.isVisible("#bookDlg >> text=ya está reservado"));
  await page.keyboard.press("Escape");
});
await test("reseña bloqueada antes de completar", async () => {
  assert.equal(await page.$$eval(".bk [data-review]", e => e.length), 0);
});
await test("máquina de estados: requested → accepted → awaiting_payment → confirmed (con idempotencia) → completed", async () => {
  await page.click(".bk >> text=Simular: el docente acepta"); await page.waitForSelector(".bk .st-accepted");
  await page.click(".bk >> text=Ir al pago"); await page.waitForSelector(".bk .st-awaiting_payment");
  const pay = page.locator(".bk >> text=Simular pago aprobado (no se cobra)");
  await pay.click();
  await page.locator(".bk >> text=Simular pago aprobado (no se cobra)").click();
  await page.waitForSelector("#toast.show >> text=idempotencia");
  await page.waitForSelector(".bk .st-confirmed", { timeout: 4000 });
  const logs = await page.$eval(".bk .log", e => e.innerText);
  assert.equal((logs.match(/awaiting_payment → confirmed/g) || []).length, 1, "confirmado una sola vez");
  await page.click(".bk >> text=Simular: la clase terminó"); await page.waitForSelector(".bk .st-completed");
});
await test("reseña habilitada solo en completed", async () => {
  await page.click(".bk [data-review]"); await page.click("#rvForm [data-n='4']");
  await page.fill("#rvText", "Muy clara"); await page.click("#rvForm button[type=submit]");
  assert.ok(await page.isVisible(".bk >> text=★★★★ Muy clara"));
});
await test("disputa y reembolso por administrador", async () => {
  await page.click(".bk >> text=Reportar un problema"); await page.waitForSelector(".bk .st-disputed");
  await page.click(".bk >> text=Simular: admin aprueba reembolso"); await page.waitForSelector(".bk .st-refunded");
});
await test("simulador calcula con los supuestos editados", async () => {
  for (const [id, v] of [["sTutors", 10], ["sClasses", 2], ["sHours", 1], ["sRate", 20], ["sFee", 10], ["sGw", 0], ["sFixed", 0]]) await page.fill("#" + id, String(v));
  // 10*2*1*52/12 = 86,67 h -> 1733 USD; comisión 10 % = 173
  assert.equal((await page.textContent("#oGmv")).replace(/\s/g, ""), "$1.733");
  assert.equal((await page.textContent("#oFee")).replace(/\s/g, ""), "$173");
});
await test("formularios simulados no envían datos", async () => {
  await page.fill("#wEmail", "malo"); await page.click("#waitForm button[type=submit]");
  assert.ok((await page.textContent("#wMsg")).includes("correo válido"));
  await page.fill("#wEmail", "ana@correo.com"); await page.click("#waitForm button[type=submit]");
  assert.ok((await page.textContent("#wMsg")).includes("no se envía"));
});
await test("tema oscuro aplica tokens", async () => {
  await page.click("#themeBtn");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.notEqual(bg, "rgb(244, 247, 251)");
  if (shots) { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: path.join(shots, "desktop-oscuro.png") }); await page.locator("#buscar").screenshot({ path: path.join(shots, "buscar-oscuro.png") }); }
});
await test("sin errores durante la sesión", async () => { assert.deepEqual(errors, []); });
await ctx.close();

const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mp = await m.newPage();
await mp.goto(url); await mp.waitForSelector(".tcard");
await test("móvil 390 px sin scroll horizontal", async () => {
  const over = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(over <= 0, "desborde de " + over + " px");
});
await test("móvil: reserva desde tarjeta", async () => {
  await mp.locator(".tcard").first().tap(); await mp.waitForSelector("#profileDlg[open]");
  await mp.locator("#goBook").tap(); await mp.waitForSelector("#bookDlg[open]");
  const over = await mp.evaluate(() => document.querySelector("#bookDlg").scrollWidth - document.querySelector("#bookDlg").clientWidth);
  assert.ok(over <= 0);
  if (shots) await mp.screenshot({ path: path.join(shots, "movil-reserva.png") });
});
if (shots) { await mp.keyboard.press("Escape"); await mp.evaluate(() => scrollTo(0, 0)); await mp.screenshot({ path: path.join(shots, "movil-inicio.png") }); await mp.locator("#buscar").screenshot({ path: path.join(shots, "movil-buscar.png") }); }
await m.close();
await browser.close();
console.log(`\n${passed} pruebas pasaron, ${failed} fallaron`);
process.exit(failed ? 1 : 0);
