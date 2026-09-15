import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  escaparHtml,
  faltandoTelegram,
  enviarTelegram,
  avisoDeLead,
  parseAvisoTicket,
  avisoDeTicket,
} from "../lib/avisos.mjs";

const pipelines = JSON.parse(readFileSync(new URL("../data/pipelines.json", import.meta.url), "utf8"));
const env = { TELEGRAM_BOT_TOKEN: "123:segredo-do-bot", TELEGRAM_CHAT_ID: "42" };

// fetch falso que guarda a chamada e devolve (ou lança) o que o caso pedir.
function fetchFalso(resultado) {
  const chamadas = [];
  const impl = async (url, init) => {
    chamadas.push({ url, init });
    if (resultado instanceof Error) throw resultado;
    return resultado;
  };
  return { impl, chamadas };
}

test("escaparHtml troca & antes de < e > (senão vira &amp;lt;)", () => {
  assert.equal(escaparHtml('<b>"Tom & Jerry"</b>'), '&lt;b&gt;"Tom &amp; Jerry"&lt;/b&gt;');
});

test("faltandoTelegram trata ausente, vazio e só espaços como faltando", () => {
  assert.deepEqual(faltandoTelegram(env), []);
  assert.deepEqual(faltandoTelegram({ TELEGRAM_BOT_TOKEN: "x", TELEGRAM_CHAT_ID: "   " }), ["TELEGRAM_CHAT_ID"]);
  assert.deepEqual(faltandoTelegram(undefined), ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]);
});

test("enviarTelegram chama sendMessage do bot com HTML, no chat do dono, sem prévia de link", async () => {
  const f = fetchFalso(new Response('{"ok":true}', { status: 200 }));
  assert.deepEqual(await enviarTelegram("<b>oi</b>", env, f.impl), { ok: true });
  assert.equal(f.chamadas.length, 1);
  assert.equal(f.chamadas[0].url, "https://api.telegram.org/bot123:segredo-do-bot/sendMessage");
  assert.equal(f.chamadas[0].init.method, "POST");
  assert.deepEqual(JSON.parse(f.chamadas[0].init.body), {
    chat_id: "42",
    text: "<b>oi</b>",
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
});

test("enviarTelegram: recusa da Bot API vira erro com status e descrição, sem o token", async () => {
  const f = fetchFalso(new Response('{"ok":false,"error_code":400,"description":"Bad Request: chat not found"}', { status: 400 }));
  const r = await enviarTelegram("oi", env, f.impl);
  assert.deepEqual(r, { ok: false, erro: "telegram 400: Bad Request: chat not found" });
});

test("enviarTelegram: recusa sem JSON ainda devolve o status", async () => {
  const f = fetchFalso(new Response("<html>bad gateway</html>", { status: 502 }));
  assert.deepEqual(await enviarTelegram("oi", env, f.impl), { ok: false, erro: "telegram 502" });
});

test("enviarTelegram: fetch que lança (a mensagem traz a URL com o token) não vaza nada", async () => {
  const f = fetchFalso(new TypeError(`fetch failed: https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`));
  assert.deepEqual(await enviarTelegram("oi", env, f.impl), { ok: false, erro: "telegram indisponível" });
});

test("enviarTelegram sem ambiente não chama o fetch e devolve só os nomes", async () => {
  const f = fetchFalso(new Response('{"ok":true}'));
  const r = await enviarTelegram("oi", { TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN }, f.impl);
  assert.deepEqual(r, { ok: false, erro: "ambiente ausente: TELEGRAM_CHAT_ID" });
  assert.equal(f.chamadas.length, 0);
});

// Lead como sai do parseLead (lib/crm.mjs) e entra no insertLead.
const lead = {
  externalId: "abc",
  pipeline: "sirius",
  etapa: "novo",
  nome: "Maria Souza",
  email: "maria@exemplo.com",
  telefone: "11 99999-0000",
  origem: "sirius:contato",
  valor: null,
  metadata: {},
};

test("avisoDeLead: só as pipelines sirius e estetiacrm avisam", () => {
  assert.equal(avisoDeLead({ ...lead, pipeline: "atma", origem: "atma:contato" }, pipelines), null);
  assert.equal(avisoDeLead({ ...lead, pipeline: "orion", origem: "orion:contato" }, pipelines), null);
  assert.notEqual(avisoDeLead({ ...lead, pipeline: "estetiacrm", origem: "estetiacrm:contato" }, pipelines), null);
});

test("avisoDeLead: título com produto, nome com o canal, contato e link do CRM", () => {
  assert.equal(
    avisoDeLead(lead, pipelines),
    [
      "🟢 <b>Lead novo · Sirius CRM</b>",
      "Maria Souza, pelo formulário de contato",
      "maria@exemplo.com",
      "11 99999-0000",
      '<a href="https://hub.roilabs.com.br/crm">Abrir no CRM do hub</a>',
    ].join("\n"),
  );
});

test("avisoDeLead: Estetia sai sem o parêntese do pipelines.json e sem a linha do telefone nulo", () => {
  assert.equal(
    avisoDeLead({ ...lead, pipeline: "estetiacrm", origem: "estetiacrm:calculadora-roi", telefone: null }, pipelines),
    [
      "🟢 <b>Lead novo · Estetia CRM</b>",
      "Maria Souza, pela calculadora de ROI",
      "maria@exemplo.com",
      '<a href="https://hub.roilabs.com.br/crm">Abrir no CRM do hub</a>',
    ].join("\n"),
  );
});

test("avisoDeLead: canal desconhecido sai como 'via', e texto de fora é escapado", () => {
  assert.equal(
    avisoDeLead({ ...lead, origem: "sirius:webinar", nome: "<b>Tom & Jerry</b>", email: null }, pipelines).split("\n")[1],
    "&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;, via webinar",
  );
});

// Corpo como os produtos mandam a POST /api/avisos/ticket (contracts/avisos.md §1).
const corpoTicket = {
  produto: "sirius",
  tipo: "novo",
  ticket_id: "4f7c2b1e-9a0d-4c55-8e21-3b6f0d9a7c12",
  assunto: "  Não consigo exportar contatos  ",
  organizacao: "Clínica Bella",
  categoria: "BUG",
  prioridade: "NORMAL",
};

test("parseAvisoTicket aceita o contrato e apara o texto", () => {
  assert.deepEqual(parseAvisoTicket(corpoTicket), {
    ok: true,
    aviso: {
      produto: "sirius",
      tipo: "novo",
      ticketId: "4f7c2b1e-9a0d-4c55-8e21-3b6f0d9a7c12",
      assunto: "Não consigo exportar contatos",
      organizacao: "Clínica Bella",
      categoria: "BUG",
      prioridade: "NORMAL",
    },
  });
});

test("parseAvisoTicket recusa o que foge do contrato", () => {
  const casos = [
    ["produto", "atma"],
    ["produto", "constructor"],
    ["tipo", "fechado"],
    ["ticket_id", "../../admin"],
    ["ticket_id", "a".repeat(65)],
    ["assunto", "   "],
    ["organizacao", undefined],
  ];
  for (const [campo, valor] of casos) {
    assert.equal(parseAvisoTicket({ ...corpoTicket, [campo]: valor }).ok, false, `${campo}=${valor}`);
  }
  assert.equal(parseAvisoTicket(null).ok, false);
  assert.equal(parseAvisoTicket("texto").ok, false);
});

test("parseAvisoTicket corta o assunto em 200 e deixa categoria e prioridade opcionais", () => {
  const r = parseAvisoTicket({ ...corpoTicket, assunto: "x".repeat(300), categoria: undefined, prioridade: 7 });
  assert.equal(r.aviso.assunto, "x".repeat(200));
  assert.equal(r.aviso.categoria, null);
  assert.equal(r.aviso.prioridade, null);
});

const avisoTicket = (extra) => parseAvisoTicket({ ...corpoTicket, ...extra }).aviso;

test("avisoDeTicket: ticket novo de prioridade normal leva categoria e prioridade no corpo", () => {
  assert.equal(
    avisoDeTicket(avisoTicket({ produto: "estetiacrm", categoria: "QUESTION" }), pipelines),
    [
      "🎫 <b>Ticket novo · Estetia CRM</b>",
      "Clínica Bella",
      "“Não consigo exportar contatos”",
      "Dúvida · prioridade normal",
      '<a href="https://estetiacrm.com.br/admin/support/4f7c2b1e-9a0d-4c55-8e21-3b6f0d9a7c12">Responder no painel</a>',
    ].join("\n"),
  );
});

test("avisoDeTicket: urgente e alta vão para a frente do título e saem do corpo", () => {
  const urgente = avisoDeTicket(avisoTicket({ prioridade: "URGENT" }), pipelines).split("\n");
  assert.equal(urgente[0], "🔴 <b>Urgente · Ticket novo · Sirius CRM</b>");
  assert.equal(urgente[3], "Bug");
  const alta = avisoDeTicket(avisoTicket({ prioridade: "HIGH", categoria: "BILLING" }), pipelines).split("\n");
  assert.equal(alta[0], "🟠 <b>Prioridade alta · Ticket novo · Sirius CRM</b>");
  assert.equal(alta[3], "Financeiro");
});

test("avisoDeTicket: prioridade baixa sem categoria deixa só a prioridade no corpo", () => {
  assert.equal(
    avisoDeTicket(avisoTicket({ prioridade: "LOW", categoria: undefined }), pipelines).split("\n")[3],
    "prioridade baixa",
  );
});

test("avisoDeTicket: resposta do cliente ignora categoria e prioridade", () => {
  assert.equal(
    avisoDeTicket(avisoTicket({ tipo: "resposta", prioridade: "URGENT" }), pipelines),
    [
      "💬 <b>Cliente respondeu · Sirius CRM</b>",
      "Clínica Bella",
      "“Não consigo exportar contatos”",
      '<a href="https://siriuscrm.com.br/admin/support/4f7c2b1e-9a0d-4c55-8e21-3b6f0d9a7c12">Responder no painel</a>',
    ].join("\n"),
  );
});

test("avisoDeTicket: enum desconhecido sai cru — inclusive 'constructor' — e texto de fora é escapado", () => {
  const linhas = avisoDeTicket(
    avisoTicket({ categoria: "constructor", prioridade: "CRITICAL", assunto: "<script>&", organizacao: "A & B" }),
    pipelines,
  ).split("\n");
  assert.deepEqual(linhas.slice(1, 4), ["A &amp; B", "“&lt;script&gt;&amp;”", "constructor · prioridade CRITICAL"]);
});
