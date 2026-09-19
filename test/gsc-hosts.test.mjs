// 030 — a leitura por página do Search Console soma os hosts declarados.
//
// Os números não são inventados: saem da medição de 19/09/2026 nas duas propriedades da Atma
// (specs/030-consultas-somam-hosts/spec.md) — a página campeã tem 22.059 impressões na posição 7,3
// no domínio antigo e 5 na posição 21 no novo, e é a MESMA página.
import test from "node:test";
import assert from "node:assert/strict";
import { mesclarPorCaminho } from "../lib/gsc-hosts.mjs";
import { gscConsultas, gscPaginas, gscQueryPages, lerPorHosts } from "../lib/gsc.ts";

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
