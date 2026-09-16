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
  parseAvisoEvento,
  avisoDeEvento,
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

test("avisoDeLead: Vértice avisa, sem o parêntese de 'Vértice Marketing (agência)'", () => {
  assert.equal(
    avisoDeLead({ ...lead, pipeline: "verticemarketing", origem: "verticemarketing:contato" }, pipelines),
    [
      "🟢 <b>Lead novo · Vértice Marketing</b>",
      "Maria Souza, pelo formulário de contato",
      "maria@exemplo.com",
      "11 99999-0000",
      '<a href="https://hub.roilabs.com.br/crm">Abrir no CRM do hub</a>',
    ].join("\n"),
  );
});

// Corpo como Atma, ROI Labs e Coopluz mandam a POST /api/avisos/evento (027, contracts/avisos.md §1).
const corpoEvento = {
  projeto: "atma",
  titulo: "  🟢 Lead novo ",
  texto: "\nMaria Souza, paciente\nmaria@exemplo.com\n",
  caminho: "/admin/pacientes",
};

test("parseAvisoEvento aceita o contrato, apara e mantém as quebras de linha", () => {
  assert.deepEqual(parseAvisoEvento(corpoEvento), {
    ok: true,
    aviso: {
      projeto: "atma",
      titulo: "🟢 Lead novo",
      texto: "Maria Souza, paciente\nmaria@exemplo.com",
      caminho: "/admin/pacientes",
      acao: "Abrir no painel",
    },
  });
});

test("parseAvisoEvento recusa o que foge do contrato", () => {
  const erro = (corpo) => parseAvisoEvento(corpo).ok;
  assert.equal(erro(null), false);
  assert.equal(erro({ ...corpoEvento, projeto: "sirius" }), false);
  assert.equal(erro({ ...corpoEvento, projeto: "constructor" }), false);
  assert.equal(erro({ ...corpoEvento, titulo: "   " }), false);
  assert.equal(erro({ ...corpoEvento, titulo: 42 }), false);
  // O domínio do link é do hub; o caminho não pode trocá-lo nem carregar query.
  for (const caminho of ["//evil.com", "https://evil.com", "admin", "/admin?x=1", "/admin/<b>", `/${"a".repeat(200)}`]) {
    assert.equal(erro({ ...corpoEvento, caminho }), false, caminho);
  }
  assert.equal(erro({ ...corpoEvento, caminho: `/${"a".repeat(199)}` }), true);
});

test("parseAvisoEvento corta título em 120 e texto em 3.500 com reticências; texto, caminho e ação são opcionais", () => {
  const r = parseAvisoEvento({ projeto: "roilabs", titulo: "t".repeat(130), texto: "x".repeat(4000), acao: "a".repeat(50) });
  assert.equal(r.aviso.titulo.length, 120);
  assert.ok(r.aviso.texto.length <= 3500 && r.aviso.texto.endsWith("…"));
  assert.equal(r.aviso.caminho, "");
  assert.equal(r.aviso.acao, "a".repeat(40));
  assert.deepEqual(parseAvisoEvento({ projeto: "coopluz", titulo: "t" }).aviso, {
    projeto: "coopluz",
    titulo: "t",
    texto: "",
    caminho: "",
    acao: "Abrir no painel",
  });
});

test("avisoDeEvento: título com o projeto, texto e link na base fixa do projeto", () => {
  assert.equal(
    avisoDeEvento(parseAvisoEvento(corpoEvento).aviso),
    [
      "<b>🟢 Lead novo · Atma</b>",
      "Maria Souza, paciente",
      "maria@exemplo.com",
      '<a href="https://atmaadmin.roilabs.com.br/admin/pacientes">Abrir no painel</a>',
    ].join("\n"),
  );
  assert.equal(
    avisoDeEvento({ projeto: "coopluz", titulo: "🟢 Lead novo", texto: "", caminho: "/leads", acao: "Abrir no painel" }),
    '<b>🟢 Lead novo · Coopluz</b>\n<a href="https://admin.autogestor.roilabs.com.br/leads">Abrir no painel</a>',
  );
});

test("avisoDeEvento: não repete o projeto que já está no título e some com o link sem caminho", () => {
  assert.equal(
    avisoDeEvento({ projeto: "roilabs", titulo: "📊 Semana ROI Labs", texto: "12 pedidos", caminho: "", acao: "Abrir no admin" }),
    "<b>📊 Semana ROI Labs</b>\n12 pedidos",
  );
});

test("avisoDeEvento: título, texto e ação de fora são escapados", () => {
  assert.equal(
    avisoDeEvento({ projeto: "roilabs", titulo: "💰 <b>", texto: "A & B\n<i>x</i>", caminho: "/admin/pedidos", acao: "<Abrir>" }),
    [
      "<b>💰 &lt;b&gt; · ROI Labs</b>",
      "A &amp; B",
      "&lt;i&gt;x&lt;/i&gt;",
      '<a href="https://app.roilabs.com.br/admin/pedidos">&lt;Abrir&gt;</a>',
    ].join("\n"),
  );
});
