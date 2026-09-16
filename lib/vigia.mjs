// Vigia do backend da Atma (spec 027, US2). Lógica pura para o `node --test` (Princípio III); o
// Worker em vigia/worker.mjs só lê o KV, chama e grava.

import { escaparHtml } from "./avisos.mjs";

// O contêiner da Atma reinicia sob o cap de CPU da VPS e volta em menos de 2 min. Avisar esses
// reinícios ensinaria o dono a ignorar o canal.
const LIMITE_MS = 10 * 60 * 1000;

/**
 * Uma checagem do /health. Ele responde 200 mesmo sem banco, de propósito (server.js da Atma), e
 * diz o estado no corpo.
 *
 * @returns {Promise<{ ok: true } | { ok: false, motivo: string }>}
 */
export async function checar(url, fetchImpl = fetch) {
  let res;
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
  } catch {
    return { ok: false, motivo: "sem resposta" };
  }
  if (!res.ok) return { ok: false, motivo: `erro ${res.status}` };

  let corpo;
  try {
    corpo = await res.json();
  } catch {
    return { ok: false, motivo: "resposta inesperada" };
  }
  return corpo?.status === "OK" ? { ok: true } : { ok: false, motivo: "sem banco de dados" };
}

/**
 * Transição do estado guardado no KV (data-model.md). `mudou` diz se o Worker precisa gravar; com
 * aviso, ele só grava depois de o Telegram aceitar, e um envio que falhou volta na execução seguinte.
 *
 * @param {{ foraDesde: number, motivo: string, avisado: boolean } | null} estado
 */
export function passo(estado, checagem, agora) {
  if (!estado) {
    if (checagem.ok) return { estado: null, aviso: null, mudou: false };
    return { estado: { foraDesde: agora, motivo: checagem.motivo, avisado: false }, aviso: null, mudou: true };
  }
  if (checagem.ok) {
    const aviso = estado.avisado ? { tipo: "volta", foraDesde: estado.foraDesde, ate: agora } : null;
    return { estado: null, aviso, mudou: true };
  }
  if (!estado.avisado && agora - estado.foraDesde >= LIMITE_MS) {
    return {
      estado: { ...estado, avisado: true },
      aviso: { tipo: "queda", foraDesde: estado.foraDesde, motivo: estado.motivo },
      mudou: true,
    };
  }
  return { estado, aviso: null, mudou: false };
}

// BRT por deslocamento fixo: o Worker roda em UTC, o Brasil não tem horário de verão desde 2019, e
// `Intl` depende dos dados de fuso de cada ambiente. Se o horário de verão voltar, trocar por
// `Intl.DateTimeFormat` com `timeZone: "America/Sao_Paulo"` e ajustar o teste.
const BRT_MS = -3 * 60 * 60 * 1000;
const dois = (n) => String(n).padStart(2, "0");
const brt = (ms) => new Date(ms + BRT_MS);
const hora = (ms) => `${dois(brt(ms).getUTCHours())}:${dois(brt(ms).getUTCMinutes())}`;
const data = (ms) => `${dois(brt(ms).getUTCDate())}/${dois(brt(ms).getUTCMonth() + 1)}`;

const duracao = (ms) => {
  const min = Math.round(ms / 60000);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${dois(min % 60)} min`;
};

// "sem resposta" e "sem banco de dados" já leem como frase; "erro 502" pede o "com".
const comMotivo = (motivo) => (motivo.startsWith("sem ") ? motivo : `com ${motivo}`);

/** Texto do aviso de queda ou de volta. */
export function textoDoAviso(aviso, alvoUrl) {
  const link = `<a href="${escaparHtml(alvoUrl)}">Abrir a checagem</a>`;
  if (aviso.tipo === "queda") {
    return [
      "🔴 <b>Fora do ar · Atma</b>",
      `Backend ${escaparHtml(comMotivo(aviso.motivo))} desde ${hora(aviso.foraDesde)} de ${data(aviso.foraDesde)}`,
      link,
    ].join("\n");
  }
  const mesmoDia = data(aviso.foraDesde) === data(aviso.ate);
  const quando = (ms) => (mesmoDia ? hora(ms) : `${hora(ms)} de ${data(ms)}`);
  return [
    "✅ <b>De volta · Atma</b>",
    `Backend ficou fora por ${duracao(aviso.ate - aviso.foraDesde)}, das ${quando(aviso.foraDesde)} às ${quando(aviso.ate)}`,
    link,
  ].join("\n");
}
