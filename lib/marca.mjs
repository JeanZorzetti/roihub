// Marca e não-marca (025): a regra que separa a demanda que já é sua da que ainda não é.
//
// Módulo PURO: zero imports, sem process.env, sem pg, sem fetch e SEM RELÓGIO INTERNO — `hoje` é
// sempre parâmetro, como o ano vigente foi na 024. As quatro armadilhas desta feature são regras,
// não rede: alternação com o termo curto na frente, dia omitido virando NULL, mês parcial comparado
// com mês inteiro e ponta provisória lida como fechada. Todas produzem números que PARECEM certos,
// e todas cabem num teste de milissegundos aqui — descobri-las em produção custa um mês de KPI
// errado, e no caso do não-marca um KPI errado para o lado que agrada.

/** @typedef {{dia: string, impressoes: number, cliques: number}} PernaDeMarca */

const limpar = (termos) => [...new Set((termos ?? []).map((t) => String(t ?? "").trim()).filter(Boolean))];

/**
 * O padrão de casamento de marca, como STRING sem flags e sem barras.
 *
 * Fonte ÚNICA para os dois consumidores (D3): a corrida prefixa `(?i)` e manda ao Search Console,
 * a tela faz `new RegExp(padrao, "i")`. Duas implementações divergiriam na primeira variante nova,
 * e a tela mostraria uma lista (FR-012) que não é a que classificou os números.
 *
 * Do MAIS LONGO para o mais curto porque alternação é *leftmost-first*: com `atma` na frente,
 * `atma aligner` casaria só os quatro primeiros caracteres. O padrão continuaria "funcionando" e
 * o erro só apareceria numa contagem, meses depois.
 *
 * `\b` nas duas pontas é o que impede a marca de comer não-marca: sem ele `atmasfera` entraria em
 * marca, e o KPI que se quer ver crescer sairia subcontado — para o lado que agrada.
 *
 * ⚠️ Teto conhecido do `\b`: termo que TERMINA em caractere não-palavra (`c++`, `3M.`) nunca casa,
 * e a fatia dele cairia calada em não-marca. O conserto de regex seria lookbehind, que o RE2 do
 * Search Console não aceita — então a defesa é a lista ficar na tela (FR-012), e quem curar um
 * nome assim declarar a variante sem o sufixo.
 *
 * SEM dobra de acento de propósito: quem cura escreve a variante acentuada. Dobrar automaticamente
 * casaria termos que ninguém declarou, invisivelmente, porque a tela exibe a lista DECLARADA e não
 * a expandida — e a defesa contra a lista pobre é justamente poder desconfiar do que está escrito.
 */
export function regexDeMarca(termos) {
  const lista = limpar(termos)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));
  return `\\b(${lista.join("|")})\\b`;
}

/**
 * A declaração de marca do card, validada.
 *
 * `motivo: null` = declarada, e vêm `termos`, `pais` e `padrao`. Caso contrário, o motivo NOMEADO
 * entre `ausente`, `sem-termos` e `sem-pais`: três faltas diferentes, três consertos diferentes, e
 * um `null` mudo faria "não curei ainda" parecer com "curei errado" na tela.
 *
 * `pais` é obrigatório (D2/D7): sem o corte, o total do Search Console é mundial e a fatia de marca
 * não teria o mesmo denominador — a diferença mediria o próprio corte, não a anonimização.
 *
 * O retorno é união DISCRIMINADA por `motivo` de propósito: é ela que faz o `.ts` da borda recusar
 * ler `termos` sem antes ter tratado a ausência.
 *
 * @param {{marca?: {termos?: string[], pais?: string, declaradaEm?: string}}} projeto
 * @returns {{motivo: "ausente"|"sem-termos"|"sem-pais"}
 *          | {motivo: null, termos: string[], pais: string, padrao: string, declaradaEm: string|null}}
 */
export function marcaDeclarada(projeto) {
  const m = projeto?.marca;
  if (!m) return { motivo: "ausente" };
  const termos = limpar(m.termos);
  if (!termos.length) return { motivo: "sem-termos" };
  const pais = String(m.pais ?? "").trim();
  if (!pais) return { motivo: "sem-pais" };
  return { motivo: null, termos, pais, padrao: regexDeMarca(termos), declaradaEm: m.declaradaEm ?? null };
}

/**
 * Todos os dias da janela pedida, com `0` onde o Search Console não devolveu linha (D5).
 *
 * O GSC OMITE o dia sem impressão. Gravar só o que ele devolveu deixaria "nenhuma busca de marca
 * nesse dia" e "não declarada" indistinguíveis DENTRO do banco — a inversão da FR-004 pelo lado de
 * dentro, onde nenhuma tela a pegaria.
 *
 * Recebe as linhas na forma do GSC (`date`/`impressions`/`clicks`) e devolve na do domínio, como
 * `diasParaGravar()` de `lib/serie-gsc.mjs` já faz para o total.
 *
 * @param {string} inicio `YYYY-MM-DD`
 * @param {string} fim `YYYY-MM-DD`
 * @param {{date: string, impressions?: number, clicks?: number}[]} linhas
 * @returns {PernaDeMarca[]}
 */
export function adensarDias(inicio, fim, linhas) {
  const porDia = new Map(
    (linhas ?? [])
      .filter((l) => l?.date)
      .map((l) => [l.date, { impressoes: l.impressions ?? 0, cliques: l.clicks ?? 0 }]),
  );
  const dias = [];
  // Aritmética em UTC e não em Date local: somar 864e5 sobre um Date local pula ou repete o dia da
  // virada de horário de verão, e a série sairia com um buraco ou uma duplicata silenciosa.
  for (let t = Date.parse(inicio + "T00:00:00Z"); t <= Date.parse(fim + "T00:00:00Z"); t += 864e5) {
    const dia = new Date(t).toISOString().slice(0, 10);
    dias.push({ dia, ...(porDia.get(dia) ?? { impressoes: 0, cliques: 0 }) });
  }
  return dias;
}

/**
 * O veredito de completude da FR-006/FR-007 sobre a janela recebida.
 *
 * QUATRO estados e não um booleano. `contradicao` (as pernas somam MAIS que o total) não é "não
 * fecha um pouco mais": é sinal de que o `excludingRegex` não é o complemento exato do
 * `includingRegex`, e o conserto é OPOSTO ao de um piso. Colapsar os dois faria um bug de regex se
 * disfarçar de limitação da fonte, e sair na tela como ressalva educada em vez de alarme.
 *
 * Só entram os dias com as TRÊS medidas: um dia meio-preenchido entraria só do lado do denominador
 * e fabricaria resíduo do nada.
 *
 * União DISCRIMINADA por `estado` pelo mesmo motivo de `marcaDeclarada`: é ela que impede a tela de
 * ler `residuo` num veredito que não tem resíduo.
 *
 * @param {{impressoesPais?: number|null, impressoesMarca?: number|null, impressoesNaoMarca?: number|null}[]} dias
 * @returns {{estado: "nao-declarada"}
 *          | {estado: "fecha"|"contradicao", residuo: number, impressoesPais: number, impressoesMarca: number, impressoesNaoMarca: number}
 *          | {estado: "piso", residuo: number, fracao: number|null, impressoesPais: number, impressoesMarca: number, impressoesNaoMarca: number}}
 */
export function completude(dias) {
  const validos = (dias ?? []).filter(
    (d) =>
      typeof d?.impressoesPais === "number" &&
      typeof d?.impressoesMarca === "number" &&
      typeof d?.impressoesNaoMarca === "number",
  );
  if (!validos.length) return { estado: "nao-declarada" };
  const soma = (campo) => validos.reduce((a, d) => a + d[campo], 0);
  const impressoesPais = soma("impressoesPais");
  const impressoesMarca = soma("impressoesMarca");
  const impressoesNaoMarca = soma("impressoesNaoMarca");
  const residuo = impressoesPais - (impressoesMarca + impressoesNaoMarca);
  const somas = { impressoesPais, impressoesMarca, impressoesNaoMarca };
  if (residuo === 0) return { estado: "fecha", residuo: 0, ...somas };
  if (residuo < 0) return { estado: "contradicao", residuo, ...somas };
  // `fracao` é o "tamanho da diferença" que a FR-007 manda informar. Denominador zero não vira 0:
  // sem denominador não há fração, e um 0% aqui leria como "fecha quase perfeito".
  return { estado: "piso", residuo, fracao: impressoesPais > 0 ? residuo / impressoesPais : null, ...somas };
}

const ultimoDiaDoMes = (mes) => {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(m === 12 ? a + 1 : a, m === 12 ? 0 : m, 0)).toISOString().slice(0, 10);
};
const diasNoMes = (mes) => Number(ultimoDiaDoMes(mes).slice(8));

/**
 * Os meses que podem ser COMPARADOS (D9). Duas condições, e as duas são obrigatórias:
 *
 * 1. **calendário completo** na série — janeiro com 21 dos 31 dias não é um mês pequeno, é um mês
 *    pela metade, e comparar fevereiro com ele exibiria como crescimento o que é só calendário;
 * 2. **três dias de folga** depois do último dia do mês — o GSC ainda SOBE os últimos dias (30/07
 *    da atma saiu com 30 impressões e fechou em 827), e um mês lido cedo entra subcontado. São as
 *    duas formas de fabricar queda, e elas fabricam para lados diferentes.
 *
 * Mês parcial NÃO existe nesta lista — em vez de existir com uma marca de "incompleto" que alguém
 * acabaria comparando. Só conta o dia com não-marca MEDIDA: um mês inteiro de dias gravados antes
 * desta feature tem calendário completo e medição nenhuma.
 *
 * @returns {{mes: string, impressoesNaoMarca: number, dias: number}[]}
 */
export function mesesFechados(dias, hoje) {
  const porMes = new Map();
  for (const d of dias ?? []) {
    if (typeof d?.impressoesNaoMarca !== "number" || !d?.dia) continue;
    const mes = d.dia.slice(0, 7);
    const e = porMes.get(mes) ?? { mes, impressoesNaoMarca: 0, dias: 0 };
    e.impressoesNaoMarca += d.impressoesNaoMarca;
    e.dias += 1;
    porMes.set(mes, e);
  }
  return [...porMes.values()]
    .filter((m) => m.dias === diasNoMes(m.mes))
    .filter((m) => Date.parse(hoje + "T00:00:00Z") >= Date.parse(ultimoDiaDoMes(m.mes) + "T00:00:00Z") + 3 * 864e5)
    .sort((a, b) => (a.mes < b.mes ? -1 : 1));
}

/**
 * Crescimento de impressões não-marca entre os dois últimos meses fechados — a medida do board,
 * faixa de 5% a 10%/mês.
 *
 * `null` é "ainda não apurável" e NUNCA `0` (FR-009): com um mês só, um zero leria como estagnação
 * medida e mandaria consertar um problema que não existe. Os dois meses saem NOMEADOS porque a
 * tela é obrigada a dizer quais comparou (FR-008).
 *
 * Meses não consecutivos não se comparam: um buraco na série derruba o mês do buraco pela regra do
 * calendário, e chamar de crescimento mensal a soma de dois meses seria inventar o eixo do tempo.
 */
export function crescimentoNaoMarca(dias, hoje) {
  const fechados = mesesFechados(dias, hoje);
  if (fechados.length < 2) return null;
  const [anterior, atual] = fechados.slice(-2);
  const seguinte = new Date(Date.parse(ultimoDiaDoMes(anterior.mes) + "T00:00:00Z") + 864e5).toISOString().slice(0, 7);
  if (seguinte !== atual.mes) return null;
  if (anterior.impressoesNaoMarca === 0) return null; // sem base não há razão, e ÷0 renderiza Infinity
  return {
    de: anterior.mes,
    para: atual.mes,
    valor: atual.impressoesNaoMarca / anterior.impressoesNaoMarca - 1,
  };
}

/**
 * Proporção de buscas de marca na janela: Σ impressões de marca ÷ Σ impressões do país.
 *
 * O denominador é o total DO CORTE, não o site inteiro: o total sem corte é mundial e a fatia de
 * marca não é, então dividir um pelo outro mediria o corte de país e não a proporção de marca.
 *
 * `null` sem denominador ou sem dia declarado, nunca `0%` — "não declarada" e "ninguém busca pelo
 * nome" são afirmações diferentes, e a segunda é sobre o site.
 */
export function razaoDeMarca(dias) {
  const validos = (dias ?? []).filter(
    (d) => typeof d?.impressoesPais === "number" && typeof d?.impressoesMarca === "number",
  );
  if (!validos.length) return null;
  const total = validos.reduce((a, d) => a + d.impressoesPais, 0);
  if (total <= 0) return null;
  return validos.reduce((a, d) => a + d.impressoesMarca, 0) / total;
}
