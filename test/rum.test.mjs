import { test } from "node:test";
import assert from "node:assert/strict";
import { VITAIS, passRate } from "../lib/crux.mjs";
import { CORPO_MAX, agenteRecusado, leituraRum, lerMedida, passRateMisto } from "../lib/rum.mjs";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const SIRIUS = { origem: "https://siriuscrm.com.br", agente: CHROME };
const slugDoHost = (h) => (h === "siriuscrm.com.br" ? "sirius" : null);
const ler = (corpo, cab = SIRIUS) => lerMedida(typeof corpo === "string" ? corpo : JSON.stringify(corpo), cab, slugDoHost);

test("a valid beacon becomes one row, path without query or fragment", () => {
  assert.deepEqual(ler({ m: "LCP", v: 1834.5, p: "/pricing/?email=a@b.com#top" }), {
    projeto: "sirius", host: "siriuscrm.com.br", caminho: "/pricing", metrica: "lcp", valor: 1834.5,
  });
  assert.equal(ler({ m: "CLS", v: 0, p: "/" }).caminho, "/");
  assert.equal(ler({ m: "TTFB", v: 120, p: "/" }, { ...SIRIUS, origem: "https://www.siriuscrm.com.br" }).host, "siriuscrm.com.br");
});

test("every refusal is null (research D6)", () => {
  const ok = { m: "INP", v: 80, p: "/blog" };
  assert.ok(ler(ok));
  assert.equal(ler(ok, { ...SIRIUS, origem: "https://exemplo.com" }), null);
  assert.equal(ler(ok, { ...SIRIUS, origem: "null" }), null);
  assert.equal(ler(ok, { ...SIRIUS, origem: "" }), null);
  for (const agente of ["", "Mozilla/5.0 (Linux; Android 11) Chrome-Lighthouse", "Mozilla/5.0 (compatible; Googlebot/2.1)", "HeadlessChrome/140", "Google-InspectionTool/1.0"])
    assert.equal(ler(ok, { ...SIRIUS, agente }), null, agente);
  assert.equal(ler({ ...ok, m: "FCP" }), null);
  assert.equal(ler({ ...ok, m: "toString" }), null);
  for (const v of [-1, Number.NaN, "80", 60_001, null]) assert.equal(ler({ ...ok, v }), null, String(v));
  assert.equal(ler({ ...ok, m: "CLS", v: 11 }), null);
  assert.equal(ler({ ...ok, p: "blog" }), null);
  assert.equal(ler({ ...ok, p: `/${"a".repeat(300)}` }), null);
  assert.equal(ler("{not json"), null);
  assert.equal(ler(JSON.stringify({ ...ok, p: `/${"a".repeat(CORPO_MAX)}` })), null);
  assert.equal(agenteRecusado(CHROME), false);
});

test("p75 by nearest rank; zero visits has no verdict", () => {
  assert.deepEqual(leituraRum([], "lcp"), { n: 0, p75: null, acima: 0, fracaoAcima: null, intervalo: null, veredito: null });
  assert.equal(leituraRum([4, 1, 3, 2], "lcp").p75, 3);
  assert.equal(leituraRum([5], "lcp").p75, 5);
  assert.throws(() => leituraRum([1], "fcp"));
});

test("the interval decides, not a visit floor (033)", () => {
  const rapido = Array(20).fill(1200);
  assert.equal(leituraRum(rapido, "lcp").veredito, "dentro");
  assert.equal(leituraRum(Array(3).fill(1200), "lcp").veredito, "nao-decide");
  assert.equal(leituraRum(Array(20).fill(4000), "lcp").veredito, "fora");
  // 30% above the limit in 20 visits does not exclude 25%.
  assert.equal(leituraRum([...Array(14).fill(1000), ...Array(6).fill(3000)], "lcp").veredito, "nao-decide");
  // The limit is inclusive, as the board says "≤".
  assert.equal(leituraRum(Array(20).fill(0.1), "cls").veredito, "dentro");
});

test("a decided verdict never contradicts the p75 the rule compares", () => {
  for (const vital of VITAIS) {
    for (let n = 1; n <= 40; n++) {
      for (let acima = 0; acima <= n; acima++) {
        const valores = [...Array(n - acima).fill(vital.limite), ...Array(acima).fill(vital.limite * 2 + 1)];
        const r = leituraRum(valores, vital.id);
        if (r.veredito === "fora") assert.ok(r.p75 > vital.limite, `${vital.id} n=${n} acima=${acima}`);
        if (r.veredito === "dentro") assert.ok(r.p75 <= vital.limite, `${vital.id} n=${n} acima=${acima}`);
      }
    }
  }
});

const medidas = (host, caminho, lcp, inp, cls, n = 20) =>
  [["lcp", lcp], ["inp", inp], ["cls", cls]].flatMap(([metrica, valor]) => Array(n).fill({ host, caminho, metrica, valor }));
const semAmostra = (urls) => ({ ...passRate(new Map(urls.map((u) => [u, { estado: "sem-amostra" }])), urls.length), naoConsultadas: 0 });

test("Pass Rate: RUM judges only the URLs the CrUX has no sample of", () => {
  const urls = ["https://siriuscrm.com.br/", "https://siriuscrm.com.br/pricing", "https://siriuscrm.com.br/blog/x", "https://siriuscrm.com.br/blog/y"];
  const r = passRateMisto(semAmostra(urls), [
    ...medidas("siriuscrm.com.br", "/", 1000, 50, 0.01),
    ...medidas("www.siriuscrm.com.br", "/pricing/", 5000, 50, 0.01),
    ...medidas("siriuscrm.com.br", "/blog/x", 1000, 50, 0.01, 2),
  ]);
  assert.deepEqual(r.porUrl.map((u) => u.estado), ["passa", "reprova", "indecisa", "sem-amostra"]);
  assert.equal(r.comDado, 2);
  assert.equal(r.passam, 1);
  assert.equal(r.fracao, 0.5);
  assert.equal(r.rum, 2);
  assert.equal(r.motivo, null);
});

test("Pass Rate: one decided URL is never a fraction; CrUX states are kept", () => {
  const pass = { ...semAmostra(["https://siriuscrm.com.br/", "https://siriuscrm.com.br/a"]), porUrl: [
    { url: "https://siriuscrm.com.br/", estado: "sem-amostra" },
    { url: "https://siriuscrm.com.br/a", estado: "falhou" },
  ] };
  const r = passRateMisto(pass, medidas("siriuscrm.com.br", "/", 1000, 50, 0.01));
  assert.equal(r.fracao, null);
  assert.match(r.motivo, /1 tem veredito/);
  assert.equal(r.porUrl[1].estado, "falhou");
});
