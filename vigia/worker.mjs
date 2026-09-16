// Vigia do backend da Atma (spec 027, US2). Roda na Cloudflare, fora da VPS: o hub e a Atma dividem
// a mesma máquina, e um vigia rodando nela cairia junto com o que vigia (FR-009).

import { enviarTelegram } from "../lib/avisos.mjs";
import { checar, passo, textoDoAviso } from "../lib/vigia.mjs";

const CHAVE = "atma";

export default {
  async scheduled(_controller, env) {
    const r = passo(await env.VIGIA.get(CHAVE, "json"), await checar(env.ALVO_URL), Date.now());
    if (!r.mudou) return;

    if (r.aviso) {
      const envio = await enviarTelegram(textoDoAviso(r.aviso, env.ALVO_URL), env);
      // Sem gravar: a execução seguinte vê o mesmo estado e tenta de novo. `erro` nunca traz o token.
      if (!envio.ok) return console.error(`[vigia] ${envio.erro}`);
    }

    if (r.estado) await env.VIGIA.put(CHAVE, JSON.stringify(r.estado));
    else await env.VIGIA.delete(CHAVE);
  },
};
