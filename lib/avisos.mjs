// Avisos no Telegram do dono (spec 026). Lógica pura em .mjs para o `node --test` importar sem
// transpilar (Princípio III); as rotas só leem o ambiente e chamam.

import { texto } from "./crm.mjs";

const ENV_TELEGRAM = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"];

// Só estes três no parse_mode HTML — MarkdownV2 pede 18, e um esquecido derruba o envio com 400.
// O & vem primeiro: depois dele, um &lt; já escapado viraria &amp;lt;.
export const escaparHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Nomes das variáveis do bot ausentes, vazias ou só com espaços — nunca os valores. */
export const faltandoTelegram = (env) =>
  ENV_TELEGRAM.filter((nome) => !(typeof env?.[nome] === "string" && env[nome].trim()));

// Escopo fechado pelo dono em 15/09/2026: os outros leads do hub não avisam.
const PIPELINES_COM_AVISO = ["sirius", "estetiacrm"];

const CANAIS = { contato: "pelo formulário de contato", "calculadora-roi": "pela calculadora de ROI" };

// hasOwn e não `mapa[chave]`: a chave vem do chamador, e "constructor" acharia a função do protótipo.
const rotulo = (mapa, chave) => (Object.hasOwn(mapa, chave) ? mapa[chave] : null);

// O título tem de caber na prévia da notificação (~40 caracteres); "Estetia CRM (clínicas de
// estética)" empurraria o produto para fora dela.
const nomeCurto = (pipelines, slug) =>
  (pipelines.find((p) => p.slug === slug)?.nome ?? slug).replace(/\s*\(.*\)$/, "");

/** Texto do aviso de lead novo, ou null quando a pipeline não avisa. */
export function avisoDeLead(lead, pipelines) {
  if (!PIPELINES_COM_AVISO.includes(lead.pipeline)) return null;
  const superficie = lead.origem.slice(lead.origem.indexOf(":") + 1);
  return [
    `🟢 <b>Lead novo · ${escaparHtml(nomeCurto(pipelines, lead.pipeline))}</b>`,
    `${escaparHtml(lead.nome)}, ${escaparHtml(rotulo(CANAIS, superficie) ?? `via ${superficie}`)}`,
    lead.email && escaparHtml(lead.email),
    lead.telefone && escaparHtml(lead.telefone),
    '<a href="https://hub.roilabs.com.br/crm">Abrir no CRM do hub</a>',
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Manda `texto` (HTML) ao chat do dono. Nunca lança.
 *
 * O token viaja NA URL da Bot API (`/bot<token>/sendMessage`) e o erro do fetch costuma trazer a
 * URL. Por isso `erro` só carrega status, `description` do Telegram ou nome de variável.
 *
 * @returns {Promise<{ ok: true } | { ok: false, erro: string }>}
 */
export async function enviarTelegram(texto, env, fetchImpl = fetch) {
  const faltando = faltandoTelegram(env);
  if (faltando.length) return { ok: false, erro: `ambiente ausente: ${faltando.join(", ")}` };

  let res;
  try {
    res = await fetchImpl(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN.trim()}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID.trim(),
        text: texto,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { ok: false, erro: "telegram indisponível" };
  }
  if (res.ok) return { ok: true };

  // "chat not found" e "bot was blocked by the user" dão o mesmo 400/403 que um token errado;
  // sem a descrição, quem depura não sabe qual dos três consertar.
  const descricao = await res.json().then((j) => (typeof j?.description === "string" ? j.description : ""), () => "");
  return { ok: false, erro: descricao ? `telegram ${res.status}: ${descricao}` : `telegram ${res.status}` };
}

// Mesmo caminho dos e-mails de staff dos dois produtos (lib/email-templates/support/new-ticket-staff.tsx).
// O link sai daqui e não do payload: aceitar `url` deixaria quem tem o segredo pôr qualquer link no
// Telegram do dono.
const PAINEL = {
  sirius: "https://siriuscrm.com.br/admin/support/",
  estetiacrm: "https://estetiacrm.com.br/admin/support/",
};

// Rótulos do painel de suporte dos produtos (CATEGORY_LABELS em admin/support/[id]/page.tsx e
// components/support/ticket-priority-badge.tsx): dois nomes para a mesma coisa confundem quem abre o
// painel depois do aviso.
const CATEGORIAS = {
  BUG: "Bug",
  QUESTION: "Dúvida",
  FEATURE_REQUEST: "Sugestão",
  BILLING: "Financeiro",
  ONBOARDING: "Onboarding",
  OTHER: "Outro",
};
const PRIORIDADES = { LOW: "baixa", NORMAL: "normal", HIGH: "alta", URGENT: "urgente" };

// A urgência tem de estar na prévia da notificação, antes de a mensagem ser aberta.
const DESTAQUE = { URGENT: "🔴 <b>Urgente · ", HIGH: "🟠 <b>Prioridade alta · " };

/**
 * Normaliza e valida o corpo de `POST /api/avisos/ticket` — mesmo molde do `parseLead`.
 *
 * @returns {{ ok: true, aviso: { produto: string, tipo: "novo" | "resposta", ticketId: string,
 *   assunto: string, organizacao: string, categoria: string | null, prioridade: string | null } }
 *   | { ok: false, erro: string }}
 */
export function parseAvisoTicket(body) {
  if (!body || typeof body !== "object") return { ok: false, erro: "corpo inválido" };

  const produto = texto(body.produto, 40);
  if (!rotulo(PAINEL, produto)) return { ok: false, erro: `produto desconhecido: ${produto || "(vazio)"}` };

  const tipo = texto(body.tipo, 20);
  if (tipo !== "novo" && tipo !== "resposta") return { ok: false, erro: `tipo desconhecido: ${tipo || "(vazio)"}` };

  // Entra direto no href do link: só o alfabeto de um uuid, sem barra nem ponto.
  const ticketId = texto(body.ticket_id, 65);
  if (!/^[A-Za-z0-9-]{1,64}$/.test(ticketId)) return { ok: false, erro: "ticket_id inválido" };

  const assunto = texto(body.assunto, 200);
  if (!assunto) return { ok: false, erro: "assunto é obrigatório" };

  const organizacao = texto(body.organizacao, 200);
  if (!organizacao) return { ok: false, erro: "organizacao é obrigatória" };

  return {
    ok: true,
    aviso: {
      produto,
      tipo,
      ticketId,
      assunto,
      organizacao,
      categoria: texto(body.categoria, 40) || null,
      prioridade: texto(body.prioridade, 40) || null,
    },
  };
}

/** Texto do aviso de ticket novo ou de resposta do cliente. A descrição e a resposta nunca entram. */
export function avisoDeTicket(aviso, pipelines) {
  const produto = escaparHtml(nomeCurto(pipelines, aviso.produto));
  const corpo = [escaparHtml(aviso.organizacao), `“${escaparHtml(aviso.assunto)}”`];
  const link = `<a href="${PAINEL[aviso.produto]}${aviso.ticketId}">Responder no painel</a>`;

  if (aviso.tipo === "resposta") return [`💬 <b>Cliente respondeu · ${produto}</b>`, ...corpo, link].join("\n");

  const destaque = rotulo(DESTAQUE, aviso.prioridade);
  const categoria = aviso.categoria && (rotulo(CATEGORIAS, aviso.categoria) ?? aviso.categoria);
  const prioridade =
    !destaque && aviso.prioridade && `prioridade ${rotulo(PRIORIDADES, aviso.prioridade) ?? aviso.prioridade}`;
  return [
    `${destaque ?? "🎫 <b>"}Ticket novo · ${produto}</b>`,
    ...corpo,
    [categoria, prioridade].filter(Boolean).map(escaparHtml).join(" · "),
    link,
  ]
    .filter(Boolean)
    .join("\n");
}
