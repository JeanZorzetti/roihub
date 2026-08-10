// O aparato de medição que já existia e só rodava quando alguém digitava o comando.
// Quatro coletores zero-LLM (o `probe-pool` gasta 1 chamada por conta, e é o mais barato
// que existe) viram um MAPA chave→rótulo. A entrega é o DIFF contra a corrida anterior:
// célula que não mudou não vira card.
//
// Por que diff e não placar: "41 violações" saiu igual antes e depois do conserto do
// GEO-01 — o agregado não se mexeu e só a LINHA mudou. Placar esconde o achado; a lista
// nominal É o produto. Mesma razão pela qual `dourado-estado.mjs` tem `--diff`.
//
// `validade.mjs` fica FORA de propósito: já roda dentro do `npm test`, então um card
// noturno sobre ele seria aviso de coisa que o CI já reprovou.

/** Chave estável: mudar o estado de um projeto troca a chave, e o diff acusa os dois lados. */
const chave = (dominio, ...partes) => [dominio, ...partes].join(":");

/**
 * Roda os 10 protocolos contra os projetos com url. Só VIOLAÇÃO entra no mapa —
 * `ok: null` é "não olhei" e nunca aprovação, então não vira e não sai de célula.
 */
export async function coletarConformidade(projetos, rodarProjeto, concorrencia = 6) {
  const comUrl = projetos.filter((p) => p.url);
  const fila = [...comUrl];
  const mapa = {};
  await Promise.all(
    Array.from({ length: Math.min(concorrencia, fila.length || 1) }, async () => {
      while (fila.length) {
        const p = fila.shift();
        const r = await rodarProjeto(p, comUrl);
        for (const l of r.linhas) {
          if (l.ok === false) mapa[chave("CONF", r.slug, l.id)] = l.detalhe ?? "viola";
        }
      }
    })
  );
  return mapa;
}

/** Balde de cobrança pelo HTML servido. O balde É o fato: sair de `sem-gateway` é o achado. */
export function coletarGateways(inventario) {
  const mapa = {};
  for (const l of inventario) mapa[chave("GTW", l.slug, l.balde)] = l.motivo ?? l.balde;
  return mapa;
}

/** Inventário pelo código. `sem_repo` entra: 404 em massa é o formato de um check quebrado. */
export function coletarRepo(inventario) {
  const mapa = {};
  for (const l of inventario) mapa[chave("REPO", l.slug, l.balde)] = l.repo ?? l.balde;
  return mapa;
}

/**
 * Sondagem do pool. 429 recarrega esperando, 403 (`subscription disabled`) NÃO — e é
 * exatamente a transição que ninguém conseguiu datar lendo sondagens coladas uma na outra.
 * Uma leitura por noite é o histórico que data.
 */
export function coletarPool(contas) {
  // Pool vazio é `CLAUDE_CODE_OAUTH_TOKENS` ausente, nunca "nenhuma conta com problema".
  // Sem este throw o domínio entraria em `dominiosOk` com zero chave e o diff anunciaria as
  // contas de ontem como resolvidas — a mesma fabricação que o `dominiosOk` existe para barrar.
  if (!contas.length) throw new Error("pool vazio: CLAUDE_CODE_OAUTH_TOKENS ausente");
  const mapa = {};
  contas.forEach((c, i) => {
    mapa[chave("POOL", String(i + 1), c.estado)] = c.detalhe ?? c.estado;
  });
  return mapa;
}

const dominioDe = (chave) => chave.slice(0, chave.indexOf(":"));

/**
 * Diff nominal entre duas corridas. `novos` = célula que apareceu (violação nova, conta que
 * caiu); `sumidos` = célula que saiu (conserto que pegou). Nenhum percentual sai daqui.
 *
 * `dominiosOk` é o conjunto de coletores que REALMENTE rodaram, e omiti-lo é o defeito que
 * este parâmetro existe para impedir: coletor que estourou não devolve chave nenhuma, e sem
 * o filtro o diff leria a ausência como conserto — 35 violações "resolvidas" porque o
 * GITHUB_TOKEN expirou. É a regra do `nao_apurado`: fonte que não respondeu SAI da corrida,
 * nunca cai de volta para um valor que dê notícia boa.
 *
 * @param {Record<string,string>|null} anterior
 * @param {Record<string,string>} atual
 * @param {string[]|null} [dominiosOk]
 * @returns {{novos:{chave:string,rotulo:string}[], sumidos:{chave:string,rotulo:string}[]}}
 */
export function diffEstado(anterior, atual, dominiosOk = null) {
  const antes = anterior && typeof anterior === "object" ? anterior : {};
  const conta = (k) => dominiosOk === null || dominiosOk.includes(dominioDe(k));
  const novos = Object.keys(atual)
    .filter((k) => conta(k) && !Object.hasOwn(antes, k))
    .map((k) => ({ chave: k, rotulo: atual[k] }));
  const sumidos = Object.keys(antes)
    .filter((k) => conta(k) && !Object.hasOwn(atual, k))
    .map((k) => ({ chave: k, rotulo: antes[k] }));
  return { novos, sumidos };
}

/**
 * O que fica gravado para a corrida de amanhã. Domínio que falhou hoje CARREGA o valor de
 * ontem — gravar sem ele faria amanhã ver as chaves reaparecendo como novidade, transformando
 * uma falha de token em 35 "violações novas" no dia seguinte.
 *
 * @param {Record<string,string>|null} anterior
 * @param {Record<string,string>} atual
 * @param {string[]} dominiosOk
 * @returns {Record<string,string>}
 */
export function mesclarEstado(anterior, atual, dominiosOk) {
  const antes = anterior && typeof anterior === "object" ? anterior : {};
  const preservadas = Object.fromEntries(
    Object.entries(antes).filter(([k]) => !dominiosOk.includes(dominioDe(k)))
  );
  return { ...preservadas, ...atual };
}

/** Primeira corrida NÃO é 100% de novidade: sem anterior não há diff, e o card mentiria. */
export const primeiraCorrida = (anterior) =>
  !anterior || typeof anterior !== "object" || !Object.keys(anterior).length;

/**
 * Card da agenda, ou `null` quando nada mudou — noite silenciosa é o comportamento certo.
 * Aviso que sai todo dia vira enfeite e sai da lista na primeira sexta-feira.
 */
export function montarCard({ novos, sumidos }, runDate, falhas = []) {
  // Coletor que estourou é notícia mesmo sem diff: silêncio com um coletor morto parece
  // "nada mudou" e é "não olhei". Card sai, então, quando há diff OU quando há falha.
  if (!novos.length && !sumidos.length && !falhas.length) return null;
  const partes = [];
  if (novos.length) partes.push(`${novos.length} novo(s)`);
  if (sumidos.length) partes.push(`${sumidos.length} resolvido(s)`);
  if (falhas.length) partes.push(`${falhas.length} coletor(es) fora`);
  const linha = (p) => `${p.chave} — ${p.rotulo}`;
  const corpo = [
    novos.length ? ["APARECEU:", ...novos.map(linha)].join("\n") : "",
    sumidos.length ? ["SAIU (conferir se foi conserto, não check quebrado):", ...sumidos.map(linha)].join("\n") : "",
    falhas.length
      ? ["NÃO APURADO (domínio fora do diff, não é aprovação):", ...falhas.map((f) => `${f.dominio} — ${f.erro}`)].join("\n")
      : "",
  ].filter(Boolean).join("\n\n");
  return {
    titulo: `Estado ${runDate}: ${partes.join(" · ") || "sem diff"}`,
    // A ressalva é campo, não frase dentro do fato: a 1ª corrida de um check novo mede o CHECK.
    descricao: `${corpo}\n\nLISTA NOMINAL, não percentual. Ler linha por linha antes de agir — célula que "saiu" pode ser conserto OU coletor quebrado.`,
    due: runDate,
  };
}
