// O INVENTÁRIO DE COBRANÇA PELO HTML SERVIDO — a pergunta que veio depois de ligar a primeira
// fonte de pagamento, e que devia ter vindo antes: **quantos dos 35 projetos sequer TÊM um
// sistema de pagamento?** Sem ela, "1 de 35 tem gateway ligado" pode significar "faltam 34" ou
// "faltam 2", e a diferença entre as duas leituras é a diferença entre um portfólio que NÃO COBRA
// e um portfólio que cobra e NÃO MEDIU.
//
// Zero LLM e zero pool: é HTTP contra os sites de produção, ~250 requisições. É essa conta que faz
// dele um apurador CARO em `lib/dourado-estado.mjs` — ele não pode entrar em toda corrida de régua.
//
// Mora em `lib/` desde 01/08 porque tem dois consumidores: `scripts/gateways.mjs` (lista nominal
// para ler) e o apurador de `D-81`/`D-82`.
import { buscar } from "./conformidade.mjs";

// Host de gateway, casado só contra URL — e a distinção custou a segunda corrida deste check.
// Procurar a PALAVRA no HTML marcou o `estetiacrm` com três gateways, e os três eram o catálogo de
// integrações do próprio produto: "56 integrações nativas com WhatsApp, Google, Stripe, Asaas".
// São gateways que o CRM integra PARA OS CLIENTES DELE, não cobrança dele. O `orcaobra`, no mesmo
// varrimento, tinha `<a href="https://pay.kiwify.com.br/r85uk0S">` — um link de checkout de
// verdade. **O que separa vender de falar sobre vender é a URL apontar para o host do gateway.**
export const GATEWAYS = [
  ["mercadopago", /mercadopago\.com|mercadolibre\.com|mercadolivre\.com/i],
  ["stripe", /js\.stripe\.com|checkout\.stripe\.com|buy\.stripe\.com/i],
  ["kiwify", /kiwify\.com|kiwify\.app/i],
  ["hotmart", /hotmart\.com|pay\.hotmart/i],
  ["paypal", /paypal\.com|paypalobjects\.com/i],
  ["pagarme", /pagar\.me|pagarme\.com/i],
  ["asaas", /asaas\.com/i],
  ["pagseguro", /pagseguro\.uol\.com\.br|pagseguro\.com/i],
  ["eduzz", /eduzz\.com|sun\.eduzz/i],
  ["lastlink", /lastlink\.com/i],
  ["cakto", /cakto\.com|pay\.cakto/i],
  ["abacatepay", /abacatepay\.com/i],
  ["iugu", /iugu\.com/i],
];

// Caminho de cobrança que existe sem gateway carregado na home: página de preço, de plano, de
// checkout. Ela é a evidência do balde do MEIO — "existe intenção de cobrar e falta plugar".
//
// ⚠️ O SINGULAR ENTROU NA TERCEIRA CORRIDA, e ele custou um projeto inteiro: o `polarisia` serve
// `/preco` (sem s) com 200, tem `mercadopago` no `package.json` e caiu em `NÃO TEM GATEWAY` — o
// balde mais errado possível — porque a lista só tinha `/precos`. Uma letra decidiu a leitura de
// um card. Variante de rota é barata (uma requisição a mais por projeto); balde errado não é.
export const CAMINHOS = ["/checkout", "/precos", "/preco", "/pricing", "/planos", "/plano", "/plans", "/assinar", "/comprar"];

// Seção de preço NA PRÓPRIA HOME, quando não há rota. O `vertice` tem `mercadopago` no
// `package.json` e `href="#pricing"` na home, e caiu em `NÃO TEM GATEWAY` porque a lista acima só
// pergunta por ROTA. Uma landing de uma página só não tem `/precos` — tem âncora.
//
// Casa contra o `href`, nunca contra a palavra solta no corpo: "plano" aparece em qualquer texto
// de marketing, e foi exatamente essa confusão que custou a segunda corrida deste check ("palavra
// ≠ URL"). `href="#pricing"` é o SITE declarando que ali começa a seção de preço — é estrutura,
// da mesma família de uma rota, não vocabulário.
export const ANCORA_PRECO = /href="[^"]*#(pricing|precos?|planos?|assinatura|checkout)"/i;

// Só as URLs do documento entram na comparação — `href`, `src` e qualquer `https://` solto no
// bundle. Casar contra o HTML inteiro é o que confunde catálogo de integração com cobrança.
const urlsDe = (html) => [...html.matchAll(/https?:\/\/[^\s"'<>\\)]+/gi)].map((m) => m[0]);
export const acharGateways = (html) => {
  const urls = urlsDe(html);
  return GATEWAYS.filter(([, re]) => urls.some((u) => re.test(u))).map(([nome]) => nome);
};

export const BALDES = [
  ["ligado", "TEM GATEWAY LIGADO — a régua do dinheiro já lê", "a fonte de pagamento responde e `vendas` sai do card"],
  ["gateway-nao-ligado", "TEM GATEWAY E NÃO ESTÁ LIGADO — o backlog de dinheiro da casa", "assinatura de gateway servida no site e nenhuma régua a consulta"],
  ["so-preco", "COBRA SEM GATEWAY NO SITE", "página de preço/plano servida, nenhuma assinatura de gateway — intenção, não conta"],
  ["sem-gateway", "NÃO TEM GATEWAY", "nenhum caminho de cobrança servido — confira contra a `familia` do card"],
  ["nao_apurado", "NÃO OLHEI", "a home não respondeu; não é ausência de gateway"],
];

async function inventariarUm(p, buscarImpl) {
  const base = p.url.replace(/\/$/, "");
  const home = await buscarImpl(base + "/");
  // Home fora do ar não é "não tem gateway": é "não olhei". Tratar erro de rede como ausência
  // seria contar `n/a` como aprovação — a regra que o conformidade.mjs imprime em três estados.
  if (home.erro || home.status >= 400) {
    return { slug: p.slug, balde: "nao_apurado", motivo: home.erro || `home devolveu ${home.status}`, evidencia: [], gws: [] };
  }

  const naHome = acharGateways(home.corpo);

  // O CONTROLE, e ele nasceu da primeira corrida deste check: `tapevision` e `potencialarquitetado`
  // devolveram 200 nos SEIS caminhos, inclusive `/comprar` e `/assinar` ao mesmo tempo. Não é
  // cobrança — é o shell de SPA servido em qualquer rota, com a home inteira (preços incluídos)
  // dentro. Validar o corpo em vez do status não bastou, porque o corpo É a home. O único teste que
  // separa os dois é pedir uma rota que NÃO PODE existir: se ela também vem 200, todo 200 daquele
  // host vale zero. Mesma família do `spa_sitemap_200_is_not_proof`, um degrau mais fundo.
  const controle = await buscarImpl(`${base}/__rota-que-nao-existe-${Date.now()}`);
  const serveTudo = !controle.erro && controle.status === 200;

  const paginas = [];
  for (const caminho of serveTudo ? [] : CAMINHOS) {
    const r = await buscarImpl(base + caminho);
    if (r.erro || r.status !== 200) continue;
    const gws = acharGateways(r.corpo);
    const fala = /R\$\s?\d|\bpre[çc]o|\bplano|assinatura|pagamento|checkout/i.test(r.corpo);
    if (gws.length || fala) paginas.push({ caminho, gws });
  }

  // A âncora vale mesmo no host que serve tudo em 200: ela está na HOME, que é a única página que
  // aquele host serve de verdade — não é uma rota inventada pelo shell da SPA.
  const ancora = ANCORA_PRECO.test(home.corpo);

  const gws = [...new Set([...naHome, ...paginas.flatMap((x) => x.gws)])];
  const evidencia = [
    ...(naHome.length ? [`gateway na home: ${naHome.join(", ")}`] : []),
    ...paginas.map((x) => `${x.caminho} 200 com ${x.gws.length ? x.gws.join(", ") : "preço/plano no corpo"}`),
    ...(ancora ? [`âncora de preço na home: ${home.corpo.match(ANCORA_PRECO)[0]}`] : []),
    ...(serveTudo ? ["⚠️ serve 200 em rota inexistente — nenhum caminho deste host conta"] : []),
  ];
  const linha = { slug: p.slug, evidencia, gws };

  // `vendas` no card é o que a régua do dinheiro JÁ LÊ (scripts/vendas-mercadopago.mjs). Ele
  // separa "ligado" de "existe e não está ligado" — e ausente nunca é R$ 0: é "nenhuma fonte de
  // pagamento foi ligada neste projeto".
  if (Array.isArray(p.vendas)) return { ...linha, balde: "ligado", motivo: `card tem \`vendas\` (${p.vendas.length})` };
  // Página de preço NÃO é gateway, e separá-las é o ponto do inventário. O balde do meio do
  // handoff é "existe conta, falta plugar" — só assinatura de gateway prova conta. Preço numa
  // página de marketing prova INTENÇÃO de cobrar, que é outro balde e outro trabalho.
  if (gws.length) return { ...linha, balde: "gateway-nao-ligado", motivo: gws.join(", ") };
  if (paginas.length) return { ...linha, balde: "so-preco", motivo: `${paginas.map((x) => x.caminho).join(", ")} — preço sem gateway` };
  if (ancora) return { ...linha, balde: "so-preco", motivo: "seção de preço na home (âncora) — preço sem gateway" };
  return { ...linha, balde: "sem-gateway", motivo: `familia: ${p.familia}${serveTudo ? " · host serve tudo em 200" : ""}` };
}

/**
 * @param {{slug:string, url:string, familia?:string, vendas?:unknown[]}[]} projetos
 * @returns {Promise<{slug:string, balde:string, motivo:string, evidencia:string[], gws:string[]}[]>}
 */
export function inventariarServido(projetos, { buscarImpl = buscar } = {}) {
  return Promise.all(projetos.map((p) => inventariarUm(p, buscarImpl)));
}
