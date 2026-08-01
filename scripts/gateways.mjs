// O INVENTÁRIO DE COBRANÇA — a pergunta que veio depois de ligar a primeira fonte de pagamento, e
// que devia ter vindo antes: **quantos dos 35 projetos sequer TÊM um sistema de pagamento?**
//
//   node scripts/gateways.mjs          # os 35
//   node scripts/gateways.mjs --ver    # com a evidência de cada balde
//
// Sem esse número, "1 de 35 tem gateway ligado" pode significar "faltam 34" ou "faltam 2" — e a
// diferença entre as duas leituras é a diferença entre um portfólio que NÃO COBRA e um portfólio
// que cobra e NÃO MEDIU. São conclusões opostas sobre a mesma frase.
//
// Zero LLM e zero pool, como o `conformidade.mjs`: é HTTP contra os sites de produção. Fora do
// `npm test` pelo mesmo motivo — teste não faz 200 requisições contra produção.
//
// ⚠️ A PRIMEIRA CORRIDA DE UM CHECK NOVO MEDE O CHECK (VER-08, quinta vez nesta base). A saída é
// LISTA NOMINAL de propósito; percentual só na segunda corrida, depois de alguém ler as linhas.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buscar } from "../lib/conformidade.mjs";

const ver = process.argv.includes("--ver");
const projetos = JSON.parse(readFileSync(fileURLToPath(new URL("../data/projects.json", import.meta.url)), "utf8"));

// Host de gateway, casado só contra URL — e a distinção custou a segunda corrida deste check.
// Procurar a PALAVRA no HTML marcou o `estetiacrm` com três gateways, e os três eram o catálogo de
// integrações do próprio produto: "56 integrações nativas com WhatsApp, Google, Stripe, Asaas".
// São gateways que o CRM integra PARA OS CLIENTES DELE, não cobrança dele. O `orcaobra`, no mesmo
// varrimento, tinha `<a href="https://pay.kiwify.com.br/r85uk0S">` — um link de checkout de
// verdade. **O que separa vender de falar sobre vender é a URL apontar para o host do gateway.**
const GATEWAYS = [
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
const CAMINHOS = ["/checkout", "/precos", "/pricing", "/planos", "/assinar", "/comprar"];

// Só as URLs do documento entram na comparação — `href`, `src` e qualquer `https://` solto no
// bundle. Casar contra o HTML inteiro é o que confunde catálogo de integração com cobrança.
const urlsDe = (html) => [...html.matchAll(/https?:\/\/[^\s"'<>\\)]+/gi)].map((m) => m[0]);
const achar = (html) => {
  const urls = urlsDe(html);
  return GATEWAYS.filter(([, re]) => urls.some((u) => re.test(u))).map(([nome]) => nome);
};

async function inventariar(p) {
  const base = p.url.replace(/\/$/, "");
  const home = await buscar(base + "/");
  // Home fora do ar não é "não tem gateway": é "não olhei". Tratar erro de rede como ausência
  // seria contar `n/a` como aprovação — a regra que o conformidade.mjs imprime em três estados.
  if (home.erro || home.status >= 400) {
    return { p, balde: "nao_apurado", motivo: home.erro || `home devolveu ${home.status}`, evidencia: [] };
  }

  const naHome = achar(home.corpo);

  // O CONTROLE, e ele nasceu da primeira corrida deste check: `tapevision` e `potencialarquitetado`
  // devolveram 200 nos SEIS caminhos, inclusive `/comprar` e `/assinar` ao mesmo tempo. Não é
  // cobrança — é o shell de SPA servido em qualquer rota, com a home inteira (preços incluídos)
  // dentro. Validar o corpo em vez do status não bastou, porque o corpo É a home. O único teste que
  // separa os dois é pedir uma rota que NÃO PODE existir: se ela também vem 200, todo 200 daquele
  // host vale zero. Mesma família do `spa_sitemap_200_is_not_proof`, um degrau mais fundo.
  const controle = await buscar(`${base}/__rota-que-nao-existe-${Date.now()}`);
  const serveTudo = !controle.erro && controle.status === 200;

  const paginas = [];
  for (const caminho of serveTudo ? [] : CAMINHOS) {
    const r = await buscar(base + caminho);
    if (r.erro || r.status !== 200) continue;
    const gws = achar(r.corpo);
    const fala = /R\$\s?\d|\bpre[çc]o|\bplano|assinatura|pagamento|checkout/i.test(r.corpo);
    if (gws.length || fala) paginas.push({ caminho, gws });
  }

  const gws = [...new Set([...naHome, ...paginas.flatMap((x) => x.gws)])];
  const evidencia = [
    ...(naHome.length ? [`gateway na home: ${naHome.join(", ")}`] : []),
    ...paginas.map((x) => `${x.caminho} 200 com ${x.gws.length ? x.gws.join(", ") : "preço/plano no corpo"}`),
    ...(serveTudo ? ["⚠️ serve 200 em rota inexistente — nenhum caminho deste host conta"] : []),
  ];

  // `vendas` no card é o que a régua do dinheiro JÁ LÊ (scripts/vendas-mercadopago.mjs). Ele
  // separa "ligado" de "existe e não está ligado" — e ausente nunca é R$ 0: é "nenhuma fonte de
  // pagamento foi ligada neste projeto".
  if (Array.isArray(p.vendas)) return { p, balde: "ligado", motivo: `card tem \`vendas\` (${p.vendas.length})`, evidencia, gws };
  // Página de preço NÃO é gateway, e separá-las é o ponto do inventário. O balde do meio do
  // handoff é "existe conta, falta plugar" — só assinatura de gateway prova conta. Preço numa
  // página de marketing prova INTENÇÃO de cobrar, que é outro balde e outro trabalho.
  if (gws.length) return { p, balde: "gateway-nao-ligado", motivo: gws.join(", "), evidencia, gws };
  if (paginas.length) return { p, balde: "so-preco", motivo: `${paginas.map((x) => x.caminho).join(", ")} — preço sem gateway`, evidencia, gws };
  return { p, balde: "sem-gateway", motivo: `familia: ${p.familia}${serveTudo ? " · host serve tudo em 200" : ""}`, evidencia, gws };
}

console.log(`${projetos.length} projetos × (home + ${CAMINHOS.length} caminhos) — zero LLM, HTTP contra produção\n`);
const linhas = await Promise.all(projetos.map(inventariar));

const BALDES = [
  ["ligado", "TEM GATEWAY LIGADO — a régua do dinheiro já lê", "a fonte de pagamento responde e `vendas` sai do card"],
  ["gateway-nao-ligado", "TEM GATEWAY E NÃO ESTÁ LIGADO — o backlog de dinheiro da casa", "assinatura de gateway servida no site e nenhuma régua a consulta"],
  ["so-preco", "COBRA SEM GATEWAY NO SITE", "página de preço/plano servida, nenhuma assinatura de gateway — intenção, não conta"],
  ["sem-gateway", "NÃO TEM GATEWAY", "nenhum caminho de cobrança servido — confira contra a `familia` do card"],
  ["nao_apurado", "NÃO OLHEI", "a home não respondeu; não é ausência de gateway"],
];

for (const [balde, titulo, teste] of BALDES) {
  const g = linhas.filter((l) => l.balde === balde);
  console.log(`── ${titulo}  (${g.length})`);
  console.log(`   teste: ${teste}`);
  for (const l of g) {
    console.log(`   ${l.p.slug.padEnd(14)} ${l.motivo}`);
    if (ver) for (const e of l.evidencia) console.log(`   ${"".padEnd(14)}   · ${e}`);
  }
  console.log();
}

// O balde do meio é o número que muda a priorização, e é por isso que ele sai sozinho no fim.
const meio = linhas.filter((l) => l.balde === "gateway-nao-ligado");
const ligado = linhas.filter((l) => l.balde === "ligado");
console.log(`${ligado.length} ligado(s), ${meio.length} com gateway no ar e nenhuma régua lendo.`);
console.log("LISTA NOMINAL, não percentual: as duas primeiras corridas deste check mediram o CHECK.");
console.log("");
console.log("⚠️ O QUE ISTO NÃO VÊ, e muda a leitura de cada linha:");
console.log("   · Só o HTML SERVIDO. Gateway montado por JS depois de um clique não aparece.");
console.log("   · Cobrança que não passa pelo site — o `sirius` fatura por tier de organização no");
console.log("     próprio banco, e nenhuma página dele precisaria carregar gateway nenhum.");
console.log("   · Conta de gateway que existe e não está publicada (chave no .env, SDK no");
console.log("     package.json de um repo não clonado aqui).");
console.log("   Por isso `sem-gateway` significa 'não achei caminho de cobrança servido', nunca");
console.log("   'não cobra'. `n/a` não é aprovação nem reprovação.");
