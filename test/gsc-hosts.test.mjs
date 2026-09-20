// 030 — a leitura por página do Search Console soma os hosts declarados.
//
// Os números não são inventados: saem da medição de 19/09/2026 nas duas propriedades da Atma
// (specs/030-consultas-somam-hosts/spec.md) — a página campeã tem 22.059 impressões na posição 7,3
// no domínio antigo e 5 na posição 21 no novo, e é a MESMA página.
import test from "node:test";
import assert from "node:assert/strict";
import { mesclarPorCaminho } from "../lib/gsc-hosts.mjs";
import { gscConsultas, gscPaginas, gscQueryPages, gscSeries, gscTrend, isoDaysAgo, lerPorHosts } from "../lib/gsc.ts";

const ATUAL = "usealigner.com";
const ANTIGO = "atma.roilabs.com.br";
const HOSTS = [ATUAL, ANTIGO];
const CAMPEA = "/blog/quanto-custa-alinhador-invisivel";

// Uma linha como o Search Console a devolve: `keys` é [página] ou [consulta, página].
const bruta = (host, caminho, impressions, clicks = 0, position = 5, query) => ({
  keys: query === undefined ? [`https://${host}${caminho}`] : [query, `https://${host}${caminho}`],
  clicks,
  impressions,
  position,
});
const resposta = (host, ...rows) => ({ host, rows });

test("a mesma página nos dois hosts vira UMA linha, com cliques e impressões somados", () => {
  const linhas = mesclarPorCaminho(
    [resposta(ATUAL, bruta(ATUAL, CAMPEA, 5, 1, 21)), resposta(ANTIGO, bruta(ANTIGO, CAMPEA, 22059, 380, 7.3))],
    HOSTS,
  );
  assert.equal(linhas.length, 1, "sem a mescla a campeã apareceria duas vezes no KPI por URL");
  assert.equal(linhas[0].impressoes, 22064);
  assert.equal(linhas[0].cliques, 381);
});

test("a campeã da Atma sai na posição ≈ 7,3 e nunca ≈ 14", () => {
  const [l] = mesclarPorCaminho(
    [resposta(ATUAL, bruta(ATUAL, CAMPEA, 5, 1, 21)), resposta(ANTIGO, bruta(ANTIGO, CAMPEA, 22059, 380, 7.3))],
    HOSTS,
  );
  const esperado = (21 * 5 + 7.3 * 22059) / 22064;
  assert.ok(Math.abs(l.posicao - esperado) < 1e-9);
  // Média simples daria 14,15 — uma posição que nenhum dos dois domínios mediu, fora da faixa do
  // balizador (≤ 10,9): a página que vive na 7ª posição seria reprovada por 5 impressões de ruído.
  assert.ok(l.posicao < 7.31);
});

test("linha de 0 impressões não vota na posição", () => {
  const [l] = mesclarPorCaminho(
    [resposta(ATUAL, bruta(ATUAL, "/x", 0, 0, 90)), resposta(ANTIGO, bruta(ANTIGO, "/x", 100, 4, 5))],
    HOSTS,
  );
  assert.equal(l.posicao, 5);
});

test("sem impressão nenhuma a posição é null, nunca 0", () => {
  const [l] = mesclarPorCaminho([resposta(ATUAL, bruta(ATUAL, "/x", 0, 0, 12))], HOSTS);
  // Posição 0 não existe no Google: gravá-la faria "não medido" ler como a melhor posição possível.
  assert.equal(l.posicao, null);
  assert.equal(l.impressoes, 0);
});

test("um host só devolve a mesma linha, com `page` e posição byte a byte", () => {
  const rows = [
    // (3,9 × 1146) ÷ 1146 dá 3,8999999999999995 em ponto flutuante: sem tratar a linha única, um
    // projeto de UM host teria a posição alterada na 16ª casa só por passar pela mescla.
    bruta(ATUAL, "/blog/a", 1146, 14, 3.9),
    bruta(ATUAL, "/blog/b", 786, 16, 4.2),
  ];
  const linhas = mesclarPorCaminho([resposta(ATUAL, ...rows)], [ATUAL]);
  assert.deepEqual(
    linhas.map(({ page, cliques, impressoes, posicao }) => ({ page, cliques, impressoes, posicao })),
    [
      { page: `https://${ATUAL}/blog/a`, cliques: 14, impressoes: 1146, posicao: 3.9 },
      { page: `https://${ATUAL}/blog/b`, cliques: 16, impressoes: 786, posicao: 4.2 },
    ],
  );
});

test("`/x` e `/x/` são duas páginas: a barra final não é normalizada", () => {
  const linhas = mesclarPorCaminho(
    [resposta(ATUAL, bruta(ATUAL, "/x", 10), bruta(ATUAL, "/x/", 20))],
    [ATUAL],
  );
  assert.equal(linhas.length, 2, "fundi-las inventaria uma fusão que o Search Console não fez");
});

test("`?p=2` é uma linha própria", () => {
  const linhas = mesclarPorCaminho(
    [resposta(ATUAL, bruta(ATUAL, "/blog", 10), bruta(ATUAL, "/blog?p=2", 3))],
    [ATUAL],
  );
  assert.deepEqual(linhas.map((l) => l.caminho), ["/blog", "/blog?p=2"]);
});

test("URL que não parseia é descartada, nunca vira chave crua", () => {
  const linhas = mesclarPorCaminho(
    [resposta(ATUAL, { keys: ["isto não é url"], clicks: 1, impressions: 9, position: 3 }, { keys: ["/relativa"], clicks: 1, impressions: 9, position: 3 }, bruta(ATUAL, "/ok", 4))],
    [ATUAL],
  );
  assert.deepEqual(linhas.map((l) => l.caminho), ["/ok"]);
});

test("página só no domínio antigo sai assinada pelo host de `url`, com um host contribuinte", () => {
  const [l] = mesclarPorCaminho([resposta(ATUAL), resposta(ANTIGO, bruta(ANTIGO, "/so-no-antigo", 300, 7, 6))], HOSTS);
  assert.equal(l.page, `https://${ATUAL}/so-no-antigo`, "a tela nomeia o endereço que o visitante vê hoje");
  assert.deepEqual(l.hosts, [ANTIGO]);
});

test("com consulta, a chave é consulta + caminho: consultas diferentes da mesma página não se fundem", () => {
  const linhas = mesclarPorCaminho(
    [
      resposta(ATUAL, bruta(ATUAL, CAMPEA, 5, 0, 21, "quanto custa alinhador")),
      resposta(
        ANTIGO,
        bruta(ANTIGO, CAMPEA, 20000, 350, 7.1, "quanto custa alinhador"),
        bruta(ANTIGO, CAMPEA, 900, 12, 9, "alinhador invisivel preco"),
      ),
    ],
    HOSTS,
  );
  assert.equal(linhas.length, 2);
  const [primeira, segunda] = linhas;
  assert.equal(primeira.query, "quanto custa alinhador");
  assert.equal(primeira.impressoes, 20005);
  assert.deepEqual(primeira.hosts, [ATUAL, ANTIGO]);
  assert.equal(segunda.query, "alinhador invisivel preco");
  assert.equal(segunda.impressoes, 900);
});

test("`hosts` da linha segue a ordem de declaração, mesmo com as respostas fora dela", () => {
  const [l] = mesclarPorCaminho(
    [resposta(ANTIGO, bruta(ANTIGO, "/x", 10)), resposta(ATUAL, bruta(ATUAL, "/x", 1))],
    HOSTS,
  );
  assert.deepEqual(l.hosts, [ATUAL, ANTIGO]);
});

test("linha com consulta ou página vazia é descartada", () => {
  const linhas = mesclarPorCaminho(
    [
      resposta(
        ATUAL,
        { keys: ["", `https://${ATUAL}/x`], clicks: 1, impressions: 5, position: 3 },
        { keys: ["termo", ""], clicks: 1, impressions: 5, position: 3 },
        bruta(ATUAL, "/y", 7, 0, 4, "termo"),
      ),
    ],
    [ATUAL],
  );
  assert.deepEqual(linhas.map((l) => l.caminho), ["/y"]);
});

test("a mescla redistribui linhas e nunca altera o total de impressões (SC-004)", () => {
  const atual = [bruta(ATUAL, CAMPEA, 5), bruta(ATUAL, "/a", 30), bruta(ATUAL, "/", 63)];
  const antigo = [bruta(ANTIGO, CAMPEA, 22059), bruta(ANTIGO, "/b", 2400), bruta(ANTIGO, "/", 100)];
  const linhas = mesclarPorCaminho([resposta(ATUAL, ...atual), resposta(ANTIGO, ...antigo)], HOSTS);
  const soma = (rows) => rows.reduce((t, r) => t + r.impressions, 0);
  assert.equal(linhas.reduce((t, l) => t + l.impressoes, 0), soma(atual) + soma(antigo));
  assert.equal(new Set(linhas.map((l) => l.page)).size, linhas.length, "nenhuma página aparece duas vezes (SC-003)");
});

// ── A borda: lerPorHosts e as três leituras, com um client falso ─────────────────────────────
//
// A lista de propriedades fica em cache no módulo por 10 min, então TODOS os testes abaixo usam a
// mesma lista — a variação está em QUAIS hosts são pedidos. Host que não está nesta lista é o
// "sem propriedade no Search Console".
const SITES = [
  { siteUrl: `sc-domain:${ATUAL}`, permissionLevel: "siteOwner" },
  { siteUrl: `sc-domain:${ANTIGO}`, permissionLevel: "siteOwner" },
];
const SEM_PROPRIEDADE = "encerrado.sem-propriedade.example";
const JANELA = { inicio: "2026-08-20", fim: "2026-09-16" };
const PEDIDO = { janela: JANELA, dimensions: ["query", "page"], rowLimit: 25000 };
const hostDoPedido = (req) => req.data.dimensionFilterGroups[0].filters[0].expression.slice("https://".length, -1);

// `linhasPorHost[host]` é uma lista ou uma função da requisição (para variar por janela).
function clienteFalso(linhasPorHost = {}, { falhaEm } = {}) {
  const posts = [];
  return {
    posts,
    request: async (req) => {
      if (req.method !== "POST") return { data: { siteEntry: SITES } };
      posts.push(req);
      const host = hostDoPedido(req);
      if (host === falhaEm) throw new Error("Quota exceeded for quota metric");
      const linhas = linhasPorHost[host];
      return { data: { rows: typeof linhas === "function" ? linhas(req.data) : (linhas ?? []) } };
    },
  };
}

test("lerPorHosts: env ausente devolve null e não tenta rede", async () => {
  const guardada = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  try {
    assert.equal(await lerPorHosts(HOSTS, PEDIDO), null);
  } finally {
    if (guardada !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_JSON = guardada;
  }
});

test("lerPorHosts: lista de hosts vazia devolve null — não lê tudo e não lê um host padrão", async () => {
  const client = clienteFalso();
  assert.equal(await lerPorHosts([], { ...PEDIDO, client }), null);
  assert.equal(client.posts.length, 0);
});

test("lerPorHosts: todos os hosts sem propriedade devolve null — ausência estrutural, não erro", async () => {
  const client = clienteFalso();
  assert.equal(await lerPorHosts([SEM_PROPRIEDADE, `outro.${SEM_PROPRIEDADE}`], { ...PEDIDO, client }), null);
  assert.equal(client.posts.length, 0, "sem propriedade não gasta requisição");
});

test("lerPorHosts: UM host sem propriedade — lê os vivos e nomeia o encerrado", async () => {
  const client = clienteFalso({ [ATUAL]: [bruta(ATUAL, "/", 98, 8, 6, "atma")] });
  const lida = await lerPorHosts([ATUAL, SEM_PROPRIEDADE], { ...PEDIDO, client });
  assert.deepEqual(lida.hosts, [ATUAL]);
  assert.deepEqual(lida.encerrados, [SEM_PROPRIEDADE], "estrutural (criar a propriedade) e transitório (tentar de novo) não colapsam");
  assert.equal(lida.linhas[0].impressoes, 98);
  assert.equal(client.posts.length, 1);
});

test("lerPorHosts: UM host falhando — {erro} começa pelo host e NENHUM número sai", async () => {
  const client = clienteFalso(
    { [ATUAL]: [bruta(ATUAL, "/", 98, 8, 6, "atma")], [ANTIGO]: [bruta(ANTIGO, "/", 24566, 426, 7, "atma")] },
    { falhaEm: ANTIGO },
  );
  const lida = await lerPorHosts(HOSTS, { ...PEDIDO, client });
  // O primeiro host respondeu, e mesmo assim nada dele é publicado: um total que encolhe sem
  // explicação lê como queda de tráfego — o defeito de `guarda_salva_o_historico_e_entrega_a_subcontagem`.
  assert.deepEqual(Object.keys(lida), ["erro"]);
  assert.ok(lida.erro.startsWith(`${ANTIGO}: `), lida.erro);
  assert.ok(lida.erro.length <= ANTIGO.length + 2 + 60, "a mensagem é truncada em 60 caracteres");
});

test("lerPorHosts: uma requisição por host, na ordem declarada, com o filtro de host de sempre", async () => {
  const client = clienteFalso();
  await lerPorHosts(HOSTS, { ...PEDIDO, client });
  assert.deepEqual(client.posts.map(hostDoPedido), HOSTS);
  assert.deepEqual(client.posts[0].data, {
    startDate: JANELA.inicio,
    endDate: JANELA.fim,
    dimensions: ["query", "page"],
    rowLimit: 25000,
    dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "contains", expression: `https://${ATUAL}/` }] }],
  });
});

test("gscConsultas soma os dois hosts: o total fecha com a soma das duas propriedades (SC-004)", async () => {
  const client = clienteFalso({
    [ATUAL]: [bruta(ATUAL, CAMPEA, 5, 0, 21, "quanto custa alinhador"), bruta(ATUAL, "/", 93, 8, 9, "atma aligner")],
    [ANTIGO]: [bruta(ANTIGO, CAMPEA, 10354, 400, 7.3, "quanto custa alinhador"), bruta(ANTIGO, "/blog/b", 200, 3, 12, "clareamento")],
  });
  const lida = await gscConsultas(HOSTS, JANELA, { client });
  assert.equal(lida.linhas.reduce((t, l) => t + l.impressoes, 0), 5 + 93 + 10354 + 200);
  assert.deepEqual(lida.hosts, HOSTS);
  assert.deepEqual(lida.encerrados, []);
  const campea = lida.linhas.filter((l) => l.page === `https://${ATUAL}${CAMPEA}`);
  assert.equal(campea.length, 1, "a página nos dois hosts aparece UMA vez (SC-003)");
  assert.equal(campea[0].impressoes, 10359);
  assert.deepEqual(campea[0].hosts, HOSTS);
});

test("gscConsultas com UM host faz uma requisição só e devolve o que sempre devolveu (FR-006)", async () => {
  const client = clienteFalso({ [ATUAL]: [bruta(ATUAL, "/blog/a", 1146, 14, 3.9, "termo")] });
  const lida = await gscConsultas([ATUAL], JANELA, { client });
  assert.equal(client.posts.length, 1);
  assert.deepEqual(lida, {
    linhas: [{ query: "termo", page: `https://${ATUAL}/blog/a`, cliques: 14, impressoes: 1146, posicao: 3.9, hosts: [ATUAL] }],
    hosts: [ATUAL],
    encerrados: [],
    truncado: false,
  });
});

test("gscConsultas: host sem propriedade não é falha, e host que falha não publica nada", async () => {
  const soUm = await gscConsultas([ATUAL, SEM_PROPRIEDADE], JANELA, {
    client: clienteFalso({ [ATUAL]: [bruta(ATUAL, "/", 98, 8, 6, "atma")] }),
  });
  assert.deepEqual(soUm.encerrados, [SEM_PROPRIEDADE]);
  assert.deepEqual(soUm.hosts, [ATUAL]);

  const falha = await gscConsultas(HOSTS, JANELA, { client: clienteFalso({}, { falhaEm: ATUAL }) });
  assert.deepEqual(Object.keys(falha), ["erro"]);
  assert.ok(falha.erro.startsWith(`${ATUAL}: `));
});

test("gscConsultas: `truncado` vale POR PROPRIEDADE — qualquer uma no teto liga a flag", async () => {
  const cheia = (host, n) => Array.from({ length: n }, (_, i) => bruta(host, `/p${i}`, 1, 0, 5, "q"));
  const noTeto = await gscConsultas(HOSTS, JANELA, {
    client: clienteFalso({ [ATUAL]: cheia(ATUAL, 25000), [ANTIGO]: cheia(ANTIGO, 3) }),
  });
  assert.equal(noTeto.truncado, true);

  // Duas propriedades a UMA linha do teto: o total somado passa de 25.000 e nenhuma foi cortada.
  // Comparar o total dispararia a flag sem motivo.
  const foraDoTeto = await gscConsultas(HOSTS, JANELA, {
    client: clienteFalso({ [ATUAL]: cheia(ATUAL, 24999), [ANTIGO]: cheia(ANTIGO, 24999) }),
  });
  assert.equal(foraDoTeto.truncado, false);
});

test("gscPaginas funde a página nos dois hosts e mantém o campo `paginas`", async () => {
  const client = clienteFalso({
    [ATUAL]: [bruta(ATUAL, CAMPEA, 5, 1, 21)],
    [ANTIGO]: [bruta(ANTIGO, CAMPEA, 22059, 380, 7.3), bruta(ANTIGO, "/blog/b", 40, 1, 15)],
  });
  const lida = await gscPaginas(HOSTS, JANELA, { client });
  assert.deepEqual(lida.paginas.map((p) => p.pagina), [`https://${ATUAL}${CAMPEA}`, `https://${ATUAL}/blog/b`]);
  assert.equal(lida.paginas[0].impressoes, 22064, "a campeã com as ~22.000 impressões, e não com as 5 do domínio novo");
  assert.equal(client.posts[0].data.rowLimit, 1000);
  assert.deepEqual(client.posts[0].data.dimensions, ["page"]);
  assert.deepEqual(lida.hosts, HOSTS);
});

test("gscPaginas mede o truncamento contra 1.000, e não contra o teto das consultas", async () => {
  const cheia = (host, n) => Array.from({ length: n }, (_, i) => bruta(host, `/p${i}`, 1, 0, 5));
  // Contra 25.000 a flag NUNCA dispararia na ficha: a API já cortou em 1.000.
  const noTeto = await gscPaginas(HOSTS, JANELA, { client: clienteFalso({ [ATUAL]: cheia(ATUAL, 1000), [ANTIGO]: cheia(ANTIGO, 3) }) });
  assert.equal(noTeto.truncado, true);
  const foraDoTeto = await gscPaginas(HOSTS, JANELA, { client: clienteFalso({ [ATUAL]: cheia(ATUAL, 999), [ANTIGO]: cheia(ANTIGO, 999) }) });
  assert.equal(foraDoTeto.truncado, false);
});

test("gscPaginas com UM host devolve as páginas de sempre, com uma requisição só (FR-006)", async () => {
  const client = clienteFalso({ [ATUAL]: [bruta(ATUAL, "/blog/a", 1146, 14, 3.9)] });
  const lida = await gscPaginas([ATUAL], JANELA, { client });
  assert.equal(client.posts.length, 1);
  assert.deepEqual(lida, {
    paginas: [{ pagina: `https://${ATUAL}/blog/a`, impressoes: 1146, cliques: 14, posicao: 3.9, hosts: [ATUAL] }],
    hosts: [ATUAL],
    encerrados: [],
    truncado: false,
  });
});

const AGORA = new Date("2026-07-24T12:00:00Z");

test("gscQueryPages soma os hosts DENTRO de cada janela e só depois compara as janelas", async () => {
  const client = clienteFalso({
    [ATUAL]: (data) => (data.startDate === "2026-06-23" ? [bruta(ATUAL, CAMPEA, 5, 0, 21, "crm")] : []),
    [ANTIGO]: (data) =>
      data.startDate === "2026-06-23"
        ? [bruta(ANTIGO, CAMPEA, 20000, 300, 7.3, "crm")]
        : [bruta(ANTIGO, CAMPEA, 15000, 250, 6.9, "crm")],
  });
  const linhas = await gscQueryPages(HOSTS, { client, now: AGORA });
  // Com as respostas cruas seriam DUAS linhas — a mesma página, uma por host — e a pauta leria a
  // mesma URL como duas.
  assert.equal(linhas.length, 1);
  const [l] = linhas;
  assert.equal(l.page, `https://${ATUAL}${CAMPEA}`);
  assert.equal(l.current.impressions, 20005);
  assert.equal(l.current.clicks, 300);
  assert.ok(Math.abs(l.current.position - (21 * 5 + 7.3 * 20000) / 20005) < 1e-9);
  assert.deepEqual(l.previous, { clicks: 250, impressions: 15000, position: 6.9 });
});

test("gscQueryPages: sem propriedade continua devolvendo [], e host que falha derruba a leitura", async () => {
  const semPropriedade = await gscQueryPages([SEM_PROPRIEDADE], { client: clienteFalso(), strict: true, sleep: async () => {}, now: AGORA });
  // Comportamento de sempre, mantido: ausência estrutural não é falha. O contrato C4.3 do plano
  // escreve "lança" para esta linha, mas o código de hoje devolve [] e a FR-006 manda preservá-lo.
  assert.deepEqual(semPropriedade, []);

  const falhando = () => clienteFalso({}, { falhaEm: ANTIGO });
  assert.deepEqual(await gscQueryPages(HOSTS, { client: falhando(), now: AGORA }), [], "sem strict, falha vira []");
  await assert.rejects(
    () => gscQueryPages(HOSTS, { client: falhando(), strict: true, sleep: async () => {}, now: AGORA }),
    /gsc-unavailable/,
  );
});

test("as três leituras consultam os MESMOS hosts declarados (FR-007)", async () => {
  const consultados = async (ler) => {
    const client = clienteFalso();
    await ler(client);
    return [...new Set(client.posts.map(hostDoPedido))];
  };
  assert.deepEqual(await consultados((client) => gscConsultas(HOSTS, JANELA, { client })), HOSTS);
  assert.deepEqual(await consultados((client) => gscPaginas(HOSTS, JANELA, { client })), HOSTS);
  assert.deepEqual(await consultados((client) => gscQueryPages(HOSTS, { client, now: AGORA })), HOSTS);
});

// ── 031: a série diária soma os hosts declarados ─────────────────────────────────────────────
//
// Números da medição de 19/09/2026 (specs/031-serie-ao-vivo-soma-hosts/spec.md): na janela
// 2026-01-17 → 2026-09-17 o domínio novo tem 7 dias e 127 impressões, o antigo 244 dias e 370.432 —
// e a aba publicava as 127, dois blocos acima de uma frase que dizia "hosts somados". `gscSeries` e
// `gscTrend` não tinham UM teste antes desta feature: o `tsc` era o único portão.
//
// Uma linha como a dimensão `date` a devolve: `keys` é [data].
const dia = (date, impressions, clicks = 0, position = 5) => ({ keys: [date], clicks, impressions, position });
const somaDe = (days, campo) => days.reduce((t, d) => t + d[campo], 0);

test("gscSeries soma os dois hosts: o total fecha com a soma das duas respostas (SC-004)", async () => {
  const client = clienteFalso({
    [ATUAL]: [dia("2026-09-13", 4, 0, 6), dia("2026-09-15", 31, 2, 8.3)],
    [ANTIGO]: [dia("2026-09-12", 900, 11, 3.4), dia("2026-09-13", 557, 8, 3.1), dia("2026-09-15", 1146, 14, 2.8)],
  });
  const lida = await gscSeries(HOSTS, undefined, { client });
  // Passar as respostas cruas à soma COMPILA e devolve [] — série vazia, sem erro. É este total que pega.
  assert.equal(somaDe(lida.days, "impressions"), 4 + 31 + 900 + 557 + 1146);
  assert.equal(somaDe(lida.days, "clicks"), 2 + 11 + 8 + 14);
  assert.deepEqual(lida.days.map((d) => d.date), ["2026-09-12", "2026-09-13", "2026-09-15"], "a união dos dias, em ordem");
  assert.equal(lida.property, `sc-domain:${ATUAL}`, "a propriedade do primeiro host vivo");
  assert.deepEqual(lida.hosts, HOSTS);
  assert.deepEqual(lida.encerrados, []);
});

test("gscSeries: a mesma data nos dois hosts vira UMA linha, com a posição ponderada por impressão", async () => {
  const client = clienteFalso({ [ATUAL]: [dia("2026-09-15", 31, 2, 8.3)], [ANTIGO]: [dia("2026-09-15", 1146, 14, 2.8)] });
  const { days } = await gscSeries(HOSTS, undefined, { client });
  assert.equal(days.length, 1);
  assert.equal(days[0].impressions, 1177);
  assert.equal(days[0].clicks, 16);
  assert.ok(Math.abs(days[0].position - (8.3 * 31 + 2.8 * 1146) / 1177) < 1e-9, "média simples daria 5,55");
});

test("gscSeries com UM host faz uma requisição só e devolve os dias da resposta crua (FR-006)", async () => {
  const client = clienteFalso({
    [ATUAL]: [dia("2026-09-01", 786, 16, 4.2), dia("2026-09-02", 1146, 14, 3.9), dia("2026-09-03", 0, 0, 0)],
  });
  const lida = await gscSeries([ATUAL], undefined, { client });
  assert.equal(client.posts.length, 1);
  assert.deepEqual(lida, {
    property: `sc-domain:${ATUAL}`,
    days: [
      { date: "2026-09-01", clicks: 16, impressions: 786, position: 4.2 },
      // (3,9 × 1146) ÷ 1146 dá 3,8999999999999995: o voto único não pode passar pela ponderação.
      { date: "2026-09-02", clicks: 14, impressions: 1146, position: 3.9 },
      // O Google DEVOLVE a linha sem impressão, com position 0 (medido em 19/09/2026). Descartá-la
      // encurtaria "dias com dado" — o `242` que a tela mostrou antes desta asserção.
      { date: "2026-09-03", clicks: 0, impressions: 0, position: 0 },
    ],
    hosts: [ATUAL],
    encerrados: [],
  });
});

test("gscSeries: o dia sem impressão em TODOS os hosts continua na série, com o 0 do Google", async () => {
  const client = clienteFalso({
    [ATUAL]: [dia("2026-07-05", 0, 0, 0), dia("2026-07-06", 31, 2, 8.3)],
    [ANTIGO]: [dia("2026-07-05", 0, 0, 0), dia("2026-07-06", 1146, 14, 2.8)],
  });
  const { days } = await gscSeries(HOSTS, undefined, { client });
  assert.deepEqual(days[0], { date: "2026-07-05", clicks: 0, impressions: 0, position: 0 });
  assert.equal(days.length, 2);
});

test("gscSeries: UM host falhando — {erro} começa pelo host e NENHUM dia sai (SC-006)", async () => {
  const client = clienteFalso(
    { [ATUAL]: [dia("2026-09-15", 31)], [ANTIGO]: [dia("2026-09-15", 1146)] },
    { falhaEm: ANTIGO },
  );
  const lida = await gscSeries(HOSTS, undefined, { client });
  // O primeiro host respondeu, e mesmo assim nada dele é publicado: a soma encolhida lê como queda.
  assert.deepEqual(Object.keys(lida), ["erro"]);
  assert.ok(lida.erro.startsWith(`${ANTIGO}: `), lida.erro);
});

test("gscSeries: host sem propriedade não é falha — soma os vivos e nomeia o encerrado", async () => {
  const client = clienteFalso({ [ATUAL]: [dia("2026-09-15", 31, 2, 8.3)] });
  const lida = await gscSeries([ATUAL, SEM_PROPRIEDADE], undefined, { client });
  assert.deepEqual(lida.hosts, [ATUAL]);
  assert.deepEqual(lida.encerrados, [SEM_PROPRIEDADE]);
  assert.equal(somaDe(lida.days, "impressions"), 31);
  assert.equal(client.posts.length, 1);
});

test("gscSeries: lista vazia e hosts todos sem propriedade devolvem null, sem gastar requisição", async () => {
  const client = clienteFalso();
  assert.equal(await gscSeries([], undefined, { client }), null);
  assert.equal(await gscSeries([SEM_PROPRIEDADE, `outro.${SEM_PROPRIEDADE}`], undefined, { client }), null);
  assert.equal(client.posts.length, 0);
});

test("gscSeries: a janela default é D-86 → D-3, a mesma de antes (019/FR-025)", async () => {
  const antes = [isoDaysAgo(86), isoDaysAgo(3)];
  const client = clienteFalso();
  await gscSeries([ATUAL], undefined, { client });
  const depois = [isoDaysAgo(86), isoDaysAgo(3)];
  const { startDate, endDate, dimensions, rowLimit } = client.posts[0].data;
  // Dois relógios (antes e depois) só para o teste não quebrar se cruzar a meia-noite UTC.
  assert.ok([antes, depois].some(([i, f]) => i === startDate && f === endDate), `${startDate} → ${endDate}`);
  assert.deepEqual(dimensions, ["date"]);
  assert.equal(rowLimit, 2000, "os 16 meses do backfill cabem com folga; 500 truncaria sem erro");
});

test("gscSeries repassa a janela pedida a TODOS os hosts", async () => {
  const client = clienteFalso();
  await gscSeries(HOSTS, JANELA, { client });
  assert.deepEqual(client.posts.map(hostDoPedido), HOSTS);
  for (const { data } of client.posts) assert.deepEqual([data.startDate, data.endDate], [JANELA.inicio, JANELA.fim]);
});

test("gscSeries: as datas nascem UMA vez — a meia-noite UTC no meio da leitura não separa os hosts (D5)", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-19T23:59:59Z") });
  const client = clienteFalso();
  const request = client.request;
  // Cada requisição ao Google "demora" 2 s: o segundo host é perguntado depois da meia-noite.
  client.request = async (req) => {
    const res = await request(req);
    if (req.method === "POST") t.mock.timers.tick(2000);
    return res;
  };
  await gscSeries(HOSTS, undefined, { client });
  assert.equal(client.posts.length, 2);
  // D-3 de 19/09 é 16/09. Calculada DENTRO do laço, o segundo host (já em 20/09) leria 17/09.
  assert.equal(client.posts[0].data.endDate, "2026-09-16", "o relógio falso está em vigor");
  assert.deepEqual(client.posts[1].data.startDate, client.posts[0].data.startDate);
  assert.deepEqual(client.posts[1].data.endDate, client.posts[0].data.endDate, "dois hosts somariam períodos de um dia de diferença");
});

// ── 031: a tendência da home soma os cliques dos hosts, por janela ───────────────────────────
//
// `queryClicks` devolve `rows[0].clicks` (sem dimensão: uma linha, o total da janela). Relógio falso
// em 19/09/2026 12:00Z: current = D-31→D-3 = 2026-08-19→2026-09-16, previous = D-59→D-32 = 07-22→08-18.
const HOJE_DA_TENDENCIA = new Date("2026-09-19T12:00:00Z");
const CURRENT = "2026-08-19";
const cliquesPorJanela = (atual, anterior) => (data) => [{ clicks: data.startDate === CURRENT ? atual : anterior }];

// Conta as requisições em voo ao mesmo tempo: as duas janelas de UM host devem estar juntas (o
// `Promise.all` de sempre), e os HOSTS não — o teto é 2, nunca 2×N.
function comPicoEmVoo(client) {
  const request = client.request;
  const medida = { emVoo: 0, pico: 0 };
  client.request = async (req) => {
    if (req.method !== "POST") return request(req);
    medida.pico = Math.max(medida.pico, ++medida.emVoo);
    await new Promise((resolve) => setImmediate(resolve));
    medida.emVoo--;
    return request(req);
  };
  return medida;
}

test("gscTrend soma os dois hosts POR JANELA: current com current, previous com previous", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: HOJE_DA_TENDENCIA });
  const client = clienteFalso({ [ATUAL]: cliquesPorJanela(9, 0), [ANTIGO]: cliquesPorJanela(415, 380) });
  assert.deepEqual(await gscTrend(HOSTS, { client }), { current: 424, previous: 380, property: `sc-domain:${ATUAL}` });
  assert.equal(client.posts.length, 4);
});

test("gscTrend com UM host faz duas requisições em voo juntas e devolve o número de hoje (FR-006)", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: HOJE_DA_TENDENCIA });
  const client = clienteFalso({ [ATUAL]: cliquesPorJanela(415, 380) });
  const medida = comPicoEmVoo(client);
  assert.deepEqual(await gscTrend([ATUAL], { client }), { current: 415, previous: 380, property: `sc-domain:${ATUAL}` });
  assert.equal(client.posts.length, 2);
  assert.equal(medida.pico, 2, "as duas janelas juntas, como o `Promise.all` de hoje — em série seria 1");
});

test("gscTrend com dois hosts: o teto em voo é 2 — os hosts vão em série, e nunca 2×N", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: HOJE_DA_TENDENCIA });
  const client = clienteFalso({ [ATUAL]: cliquesPorJanela(9, 0), [ANTIGO]: cliquesPorJanela(415, 380) });
  const medida = comPicoEmVoo(client);
  await gscTrend(HOSTS, { client });
  assert.equal(medida.pico, 2, "paralelizar os hosts dobraria a rajada contra a mesma credencial — caminho curto para um 429");
});

test("gscTrend: UM host falhando devolve null, e não a soma do que respondeu", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: HOJE_DA_TENDENCIA });
  const client = clienteFalso({ [ATUAL]: cliquesPorJanela(9, 0), [ANTIGO]: cliquesPorJanela(415, 380) }, { falhaEm: ANTIGO });
  // 9 cliques no lugar de 424 lê como colapso: `null` faz a home cair no `seoSeed`.
  assert.equal(await gscTrend(HOSTS, { client }), null);
});

test("gscTrend: host sem propriedade soma os vivos; nenhum vivo e lista vazia dão null sem requisição", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: HOJE_DA_TENDENCIA });
  const vivo = clienteFalso({ [ATUAL]: cliquesPorJanela(9, 0) });
  assert.deepEqual(await gscTrend([ATUAL, SEM_PROPRIEDADE], { client: vivo }), { current: 9, previous: 0, property: `sc-domain:${ATUAL}` });
  const nenhum = clienteFalso();
  assert.equal(await gscTrend([SEM_PROPRIEDADE], { client: nenhum }), null);
  assert.equal(await gscTrend([], { client: nenhum }), null);
  assert.equal(nenhum.posts.length, 0);
});

test("gscTrend: as quatro datas nascem UMA vez — a meia-noite UTC no meio da leitura não separa os hosts", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-19T23:59:59Z") });
  const client = clienteFalso();
  const request = client.request;
  client.request = async (req) => {
    const res = await request(req);
    if (req.method === "POST") t.mock.timers.tick(2000);
    return res;
  };
  await gscTrend(HOSTS, { client });
  const janelas = client.posts.map(({ data }) => `${data.startDate}→${data.endDate}`);
  assert.equal(janelas.length, 4);
  assert.deepEqual(janelas.slice(2), janelas.slice(0, 2), "o segundo host pergunta as mesmas janelas do primeiro");
});

test("gscTrend: env malformada não derruba a home — e o trecho da service account não sai em lugar nenhum", async () => {
  const guardada = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = '{"private_key": "SEGREDO-QUE-NAO-PODE-VAZAR", malformado';
  try {
    // O `JSON.parse` cita um trecho do texto na mensagem: fora do `try` do laço ele sobe, e o `catch`
    // da tendência o transforma em `null` — a home cai no `seoSeed` sem exibir a mensagem.
    assert.equal(await gscTrend(HOSTS), null);
  } finally {
    if (guardada === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    else process.env.GOOGLE_SERVICE_ACCOUNT_JSON = guardada;
  }
});
