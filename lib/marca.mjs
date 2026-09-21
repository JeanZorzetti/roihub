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

/**
 * A partir de que fatia de dias em ZERO um mês deixa de servir de BASE para a razão mensal.
 *
 * Um terço e não "qualquer zero": site pequeno tem dia de zero legítimo, e derrubar a razão no
 * primeiro deles calaria a medida a vida toda. Um terço do mês sem nenhuma impressão não-marca não
 * é sazonalidade — é o instrumento ou o índice fora do ar.
 */
const FRACAO_MES_INTERROMPIDO = 1 / 3;

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
 * 045 — `campo` escolhe a coluna somada, e a chave de saída leva o mesmo nome. A folha de marca do
 * board pede o volume MENSAL de marca, com as mesmas duas armadilhas de calendário: uma segunda
 * função de meses divergiria desta na primeira regra nova.
 *
 * @returns {{mes: string, impressoesNaoMarca: number, dias: number, diasZero: number}[]}
 */
export function mesesFechados(dias, hoje, campo = "impressoesNaoMarca") {
  const porMes = new Map();
  for (const d of dias ?? []) {
    if (typeof d?.[campo] !== "number" || !d?.dia) continue;
    const mes = d.dia.slice(0, 7);
    const e = porMes.get(mes) ?? { mes, [campo]: 0, dias: 0, diasZero: 0 };
    e[campo] += d[campo];
    e.dias += 1;
    // Dia com zero MEDIDO, que é diferente de dia ausente: `adensarDias` já garantiu que todo dia
    // da janela existe, então um `0` aqui é o Search Console dizendo "ninguém viu", não um buraco.
    if (d[campo] === 0) e.diasZero += 1;
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
 * CINCO estados e não `null` (036), pelo mesmo motivo de `completude()` ter quatro e não um
 * booleano. O `null` de antes carregava três ausências com consertos OPOSTOS — esperar o
 * calendário, investigar um buraco na série, aceitar que não há base — e uma quarta se disfarçava
 * de "poucos meses": `mesesFechados` descarta todo dia sem `impressoesNaoMarca` numérico, então um
 * projeto SEM marca declarada devolvia zero meses e a tela acusava "ainda não há dois meses
 * fechados". Medido em 20/09/2026: 33 dos 34 projetos com série gravada estão nesse caso.
 *
 * Nenhum estado de ausência tem `valor`, e é de propósito: quem ler `.valor` sem checar `estado`
 * recebe `undefined` e quebra à vista — `0` mentiria (FR-009: com um mês só, um zero leria como
 * estagnação medida e mandaria consertar um problema que não existe). Os meses saem NOMEADOS porque
 * a tela é obrigada a dizer quais comparou (FR-008), e onde a ausência tem um número útil ele sai
 * junto (`fechados`, `paraImpressoes`).
 *
 * A ordem é a da causa mais específica para a mais genérica. `nao-declarada` vem ANTES da contagem
 * de meses porque é a razão de a contagem dar zero.
 *
 * Meses não consecutivos não se comparam: um buraco na série derruba o mês do buraco pela regra do
 * calendário, e chamar de crescimento mensal a soma de dois meses seria inventar o eixo do tempo.
 *
 * @returns {{estado: "nao-declarada"}
 *          | {estado: "poucos-meses", fechados: number}
 *          | {estado: "nao-consecutivos", de: string, para: string}
 *          | {estado: "base-zero", de: string, para: string, paraImpressoes: number}
 *          | {estado: "medido", de: string, para: string, deImpressoes: number, paraImpressoes: number,
 *             valor: number, diasZeroDe: number, diasDe: number, baseInterrompida: boolean}}
 */
export function crescimentoNaoMarca(dias, hoje) {
  if (!(dias ?? []).some((d) => typeof d?.impressoesNaoMarca === "number")) return { estado: "nao-declarada" };
  const fechados = mesesFechados(dias, hoje);
  if (fechados.length < 2) return { estado: "poucos-meses", fechados: fechados.length };
  const [anterior, atual] = fechados.slice(-2);
  const seguinte = new Date(Date.parse(ultimoDiaDoMes(anterior.mes) + "T00:00:00Z") + 864e5).toISOString().slice(0, 7);
  if (seguinte !== atual.mes) return { estado: "nao-consecutivos", de: anterior.mes, para: atual.mes };
  // Sem base não há razão, e ÷0 renderiza Infinity. O mês seguinte tem número real, então sai junto.
  if (anterior.impressoesNaoMarca === 0) {
    return { estado: "base-zero", de: anterior.mes, para: atual.mes, paraImpressoes: atual.impressoesNaoMarca };
  }
  // Os ABSOLUTOS saem junto da razão. Uma variação sobre base pequena é ilegível sozinha: o
  // `43×` da atma em jul→ago é 342 → 14.689, e 342 é o fundo da desindexação de junho, não um
  // mês normal. Sem os dois números na tela o leitor lê "crescemos 43×" onde o fato é
  // "recuperamos de um mês quebrado" — e o veredito contra a meta do board vira ruído.
  return {
    estado: "medido",
    de: anterior.mes,
    para: atual.mes,
    deImpressoes: anterior.impressoesNaoMarca,
    paraImpressoes: atual.impressoesNaoMarca,
    valor: atual.impressoesNaoMarca / anterior.impressoesNaoMarca - 1,
    diasZeroDe: anterior.diasZero,
    diasDe: anterior.dias,
    // ⚠️ O mês-base parou de ser medido no meio. A razão continua ARITMETICAMENTE certa e deixa de
    // medir crescimento: ela mede a VOLTA. Julho da atma são 27 dias de zero em 31, e o `43×`
    // contra agosto é a distância até o fundo de uma desindexação — não o ritmo de aquisição que a
    // faixa do board de 5% a 10%/mês pede. Quem compara os dois aprova um mês de retomada como se
    // fosse um mês bom, e a faixa do board passa a premiar justamente o site que quebrou antes.
    baseInterrompida: anterior.diasZero / anterior.dias >= FRACAO_MES_INTERROMPIDO,
  };
}

const br = (n) => n.toLocaleString("pt-BR");
const pct = (f) => `${(f * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/**
 * Uma variação relativa como o leitor a lê ao lado de uma meta em porcentagem (`0.072` → `7,2%`),
 * e acima de 10× como múltiplo (`41.95` → `43×`).
 *
 * Em pt-BR o separador de milhar é o PONTO, então `4195%` imprime `"4.195%"` — que, ao lado de "5%
 * a 10%", lê como 4,195% e INVERTE o veredito para quem bate o olho. Medido em 08/09 (025): julho
 * da atma colapsou para 342 impressões não-marca e agosto voltou a 14.689. Subiu de
 * `aquisicao/page.tsx` na 036, quando o mapa virou o segundo consumidor: o limiar de 10× e a
 * escrita `×` não podem existir em dois lugares.
 *
 * `pct` fica LOCAL e não é exportado: serve só a esta função e à linha abaixo. A página tem o dela,
 * para outras dez medidas que nada têm a ver com marca.
 */
export function variacao(f) {
  return Math.abs(f) >= 10 ? `${(f + 1).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}×` : pct(f);
}

/**
 * A causa de uma ausência de `crescimentoNaoMarca`, em prosa, sem o prefixo de tela.
 *
 * Existe para as DUAS telas lerem a mesma frase: `/gsc/mapa` a prefixa com `∅ não apurado ·` e
 * `/okr/[slug]/aquisicao` a põe depois do rótulo da leitura. Uma frase escrita em cada uma
 * divergiria na primeira causa nova, e nada reprovaria.
 *
 * @param {Exclude<ReturnType<typeof crescimentoNaoMarca>, {estado: "medido"}>} m
 */
export function causaDaAusencia(m) {
  if (m.estado === "nao-declarada") return "marca não declarada para este projeto";
  if (m.estado === "poucos-meses") {
    const n = m.fechados === 0 ? "nenhum mês fechado" : `${m.fechados} mês fechado`;
    return `${n} na série — a razão pede dois consecutivos`;
  }
  if (m.estado === "nao-consecutivos") return `buraco na série entre ${m.de} e ${m.para}`;
  return `mês-base em zero (${m.de}) — sem base não há razão`;
}

/**
 * A linha de topo do nó do mapa — o que a tela exibe SEM expandir, e por isso precisa ser
 * verdadeira lida sozinha (FR-003, SC-006).
 *
 * Mora aqui e não no `.tsx` porque carrega a CORREÇÃO: com `baseInterrompida` a linha abre pelos
 * ABSOLUTOS, e um `43×` na frente publicaria "recuperamos de um mês quebrado" como crescimento,
 * ao lado de uma meta de 5% a 10%. Regra de correção não pode morar onde `node --test` não alcança
 * (Princípio III). A razão dessa base desce para a nota do nó.
 *
 * Sem `baseInterrompida` é a razão que abre, com sinal explícito — só nas porcentagens: `+43×`
 * leria como soma e não como múltiplo. O glifo de ausência é o da 034, e nenhum estado escreve `0`.
 *
 * @param {ReturnType<typeof crescimentoNaoMarca>} m
 */
export function linhaDeCrescimento(m) {
  if (m.estado !== "medido") return `∅ não apurado · ${causaDaAusencia(m)}`;
  const de = br(m.deImpressoes);
  const para = br(m.paraImpressoes);
  if (m.baseInterrompida) {
    return `Medido: ${para} impressões não-marca em ${m.para}, contra ${de} em ${m.de} — base interrompida (${m.diasZeroDe} de ${m.diasDe} dias em zero)`;
  }
  const sinal = m.valor > 0 && Math.abs(m.valor) < 10 ? "+" : "";
  return `Medido: ${sinal}${variacao(m.valor)} de ${m.de} para ${m.para} (${de} → ${para} impressões não-marca)`;
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

// ── A FORMA da série, que a razão mensal não mostra (information-design, 18/09) ──────────────
//
// `crescimentoNaoMarca` responde "cresceu do mês passado para este?" e é cega por construção a
// duas coisas que decidem a leitura: o mês corrente (que nunca está fechado) e o FORMATO dos oito
// meses. A atma prova as duas — o `43×` de jul→ago é aprovado contra a faixa do board enquanto a
// série real vai de 17.020 impressões não-marca na melhor semana para 1.492 na última, e ninguém
// que leia só a razão descobre isso.
//
// As duas funções abaixo existem para a tela poder desenhar a série e dar um veredito sobre ELA.

/**
 * @typedef {object} SemanaNaoMarca
 * @property {string} inicio  segunda-feira da semana, `YYYY-MM-DD`
 * @property {string} fim     último dia MEDIDO da semana (não o domingo do calendário)
 * @property {number} dias    dias com não-marca medida
 * @property {boolean} completa  `dias === 7`
 * @property {number} impressoesNaoMarca
 * @property {number} cliquesNaoMarca
 * @property {number|null} posicao  média das posições diárias, `null` sem nenhuma
 * @property {string|null} host  o site de onde a semana foi medida; `null` quando ela cruza uma
 *   troca de domínio e soma dois sites — ou quando nenhum dia dela traz o host
 */

/**
 * @typedef {object} SegmentoDeHost
 * @property {string|null} host
 * @property {{dia: string, host?: string|null, impressoesMarca?: number|null,
 *             impressoesNaoMarca?: number|null}[]} dias
 */

/**
 * @typedef {object} RitmoNaoMarca
 * @property {SemanaNaoMarca} ultima
 * @property {SemanaNaoMarca} pico
 * @property {number|null} fracaoDoPico
 * @property {number} quedasConsecutivas
 * @property {number} semanasCompletas
 * @property {number} parciaisIgnoradas
 */

/** A segunda-feira da semana de um dia `YYYY-MM-DD`, em UTC. */
const segundaDa = (iso) => {
  const t = Date.parse(iso + "T00:00:00Z");
  // getUTCDay: 0 = domingo. `(dow + 6) % 7` põe segunda em 0 e domingo em 6.
  const recuo = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - recuo * 864e5).toISOString().slice(0, 10);
};

/**
 * A série não-marca agregada por semana, com `completa` dizendo quais têm os 7 dias.
 *
 * A bandeira é o ponto da função. As pontas da janela quase nunca caem numa segunda: a atma tem
 * 37 semanas, e a primeira (1 dia) e a última (2 dias) são fatias. Somá-las com as de 7 dias
 * fabrica uma queda de 63% na ponta direita que é só calendário — o MESMO erro que a D9 já evita
 * do lado dos meses, reaparecendo na semana porque ninguém o tinha evitado aqui.
 *
 * Só entra o dia com não-marca MEDIDA; o dia sem a coluna não vira zero (seria a inversão da
 * FR-004), ele não entra e encolhe `dias`, o que já derruba a semana de `completa`.
 *
 * 029 — com `declarados`, duas assinaturas que cabem no mesmo conjunto declarado NÃO tornam a
 * semana mista: depois que a corrida passou a somar os hosts declarados, a semana da troca tem 4
 * dias com uma assinatura e 3 com outra, e as duas medem o mesmo negócio. Continuar a marcando
 * como `null` apagaria do gráfico a única semana em que a migração é visível.
 *
 * @param {{dia?: string, impressoesNaoMarca?: number|null, cliquesNaoMarca?: number|null, posicao?: number|null, host?: string|null}[]} dias
 * @param {string[]} [declarados] hosts que o card declara como sendo o site; vazio = leitura da 026
 * @returns {SemanaNaoMarca[]}
 */
export function semanasNaoMarca(dias, declarados = []) {
  const porSemana = new Map();
  for (const d of dias ?? []) {
    if (!d?.dia || typeof d.impressoesNaoMarca !== "number") continue;
    const inicio = segundaDa(d.dia);
    const e = porSemana.get(inicio) ?? {
      inicio, fim: d.dia, dias: 0, impressoesNaoMarca: 0, cliquesNaoMarca: 0, somaPos: 0, diasPos: 0,
      // 026: `undefined` = nenhum dia visto ainda; `null` = a semana tem dias de DOIS sites.
      host: undefined,
    };
    // 026 — a semana da migração cruza os dois domínios. Somar 4 dias de um site com 3 de outro
    // produz um valor que não pertence a nenhum dos dois, e desenhá-lo como barra inventaria uma
    // queda (ou uma alta) que é só a troca de casa. `host: null` é a marca disso, e a tela a
    // traduz para o estado que ela JÁ tem: coluna vazia, "semana fora da leitura".
    const host = d.host ?? null;
    e.host =
      e.host === undefined
        ? host
        : e.host === host ||
            (declarados.length > 0 && dentroDoDeclarado(e.host, declarados) && dentroDoDeclarado(host, declarados))
          ? e.host
          : null;
    e.dias += 1;
    e.impressoesNaoMarca += d.impressoesNaoMarca;
    e.cliquesNaoMarca += typeof d.cliquesNaoMarca === "number" ? d.cliquesNaoMarca : 0;
    if (typeof d.posicao === "number") { e.somaPos += d.posicao; e.diasPos += 1; }
    if (d.dia > e.fim) e.fim = d.dia;
    porSemana.set(inicio, e);
  }
  return [...porSemana.values()]
    .sort((a, b) => (a.inicio < b.inicio ? -1 : 1))
    .map(({ somaPos, diasPos, ...s }) => ({
      ...s,
      host: s.host ?? null,
      // Média das posições DIÁRIAS, nunca a posição da soma: o GSC já devolve a posição do dia como
      // média ponderada por impressão, e não há como reponderar sem a impressão por consulta.
      posicao: diasPos ? somaPos / diasPos : null,
      completa: s.dias === 7,
    }));
}

/**
 * O veredito sobre a FORMA da série, só com semanas completas.
 *
 * Devolve a última semana completa, a de pico e a fração entre as duas — que é a frase que a tela
 * precisa e a razão mensal não dá. `null` com menos de duas semanas completas: com uma só não há
 * forma para ler, e um `0` ou um `100%` ali seria um veredito sobre nada.
 *
 * `quedasConsecutivas` conta para TRÁS a partir da última e para no primeiro não-recuo. Ele existe
 * para a tela não poder dizer "caindo" quando a última semana subiu — a atma faz exatamente isso
 * (1.449 → 1.492 em 07/09 depois de quatro semanas de recuo), e "caindo há 4 semanas" seria tão
 * falso quanto o `43×` que esta corrida veio consertar.
 *
 * @param {Parameters<typeof semanasNaoMarca>[0]} dias
 * @returns {RitmoNaoMarca | null}
 */
export function ritmoNaoMarca(dias) {
  const todas = semanasNaoMarca(dias);
  const completas = todas.filter((s) => s.completa);
  if (completas.length < 2) return null;
  const ultima = completas[completas.length - 1];
  // `>` estrito: com empate fica a PRIMEIRA, ou seja, a mais antiga — o pico é onde o site chegou
  // primeiro, não a repetição mais recente dele.
  const pico = completas.reduce((a, b) => (b.impressoesNaoMarca > a.impressoesNaoMarca ? b : a));
  let quedas = 0;
  for (let i = completas.length - 1; i > 0; i--) {
    if (completas[i].impressoesNaoMarca < completas[i - 1].impressoesNaoMarca) quedas += 1;
    else break;
  }
  return {
    ultima,
    pico,
    fracaoDoPico: pico.impressoesNaoMarca > 0 ? ultima.impressoesNaoMarca / pico.impressoesNaoMarca : null,
    quedasConsecutivas: quedas,
    semanasCompletas: completas.length,
    parciaisIgnoradas: todas.length - completas.length,
  };
}

/**
 * 029 — todos os hosts desta assinatura estão entre os declarados pelo projeto?
 *
 * É a régua que substitui a igualdade de host na guarda da 026. A proteção continua inteira para o
 * caso que a motivou (trocar a `url` sem declarar fazia a corrida reescrever 248 dias com números
 * de outro site); o que ela deixa passar é a regravação de um dia cuja medição melhorou DENTRO da
 * mesma declaração.
 *
 * Assinatura ausente devolve `true`: linha gravada antes da coluna existir é ignorância sobre o
 * site, não evidência de outro — a mesma leitura que a 026 já fazia de `host IS NULL`.
 *
 * `declarados` vazio devolve `false` para assinatura preenchida: sem declaração não há conjunto ao
 * qual pertencer, e afrouxar por omissão é como esta guarda morreria em silêncio.
 *
 * @param {string|null|undefined} assinatura
 * @param {string[]} declarados
 * @returns {boolean}
 */
export function dentroDoDeclarado(assinatura, declarados) {
  if (!assinatura) return true;
  const conjunto = new Set((declarados ?? []).map((h) => String(h ?? "").trim().replace(/^www\./, "")).filter(Boolean));
  if (!conjunto.size) return false;
  return String(assinatura)
    .split("+")
    .every((h) => conjunto.has(h));
}

/**
 * 026 — os blocos CONTÍGUOS de mesmo site dentro da série.
 *
 * `hub_gsc_dia` é chaveada por `(projeto, dia)` e um projeto pode trocar de domínio: a Atma saiu
 * de `atma.roilabs.com.br` para `usealigner.com` em 11/09/2026. Os dois lados do corte não se
 * somam nem se comparam — propriedade nova do Search Console nasce vazia, e a queda de 1.492 para
 * 35 impressões por semana é mudança de casa, não perda de tráfego.
 *
 * Contíguos e não `group by host`: se um projeto voltasse ao domínio antigo, agrupar juntaria dois
 * períodos separados por meses num bloco só e a série leria como contínua onde houve duas trocas.
 *
 * Dia com `host` ausente entra no bloco corrente em vez de abrir um novo: `null` é "gravado antes
 * da coluna existir", ou seja, ignorância sobre o site — e ignorância não é evidência de troca.
 *
 * 029 — com `declarados`, duas assinaturas que CABEM no mesmo conjunto declarado são o mesmo site.
 * Depois que a corrida passou a somar os hosts declarados, a assinatura do dia muda no dia da troca
 * (`atma.roilabs.com.br` → `atma.roilabs.com.br+usealigner.com`) sem que o site tenha mudado — e
 * cortar ali devolveria a leitura em dois pedaços que esta feature veio costurar. Assinatura com
 * host FORA do declarado continua abrindo bloco novo: é a proteção contra trocar a `url` sem
 * declarar, que é o caso que criou esta função.
 *
 * @param {{dia?: string, host?: string|null}[]} dias em ordem cronológica
 * @param {string[]} [declarados] hosts que o card declara como sendo o site; vazio = leitura da 026
 * @returns {SegmentoDeHost[]}
 */
export function segmentosPorHost(dias, declarados = []) {
  const segmentos = [];
  const mesmoSite = (a, b) =>
    a === b || (declarados.length > 0 && dentroDoDeclarado(a, declarados) && dentroDoDeclarado(b, declarados));
  for (const d of dias ?? []) {
    if (!d?.dia) continue;
    const ultimo = segmentos[segmentos.length - 1];
    const host = d.host ?? null;
    if (!ultimo || (host !== null && ultimo.host !== null && !mesmoSite(host, ultimo.host))) {
      segmentos.push({ host, dias: [d] });
      continue;
    }
    // Um bloco que começou sem host e depois ganha um adota esse host: é a mesma casa, agora
    // nomeada.
    if (ultimo.host === null) ultimo.host = host;
    ultimo.dias.push(d);
  }
  return segmentos;
}

/**
 * 026 — de qual bloco sai o veredito da tela, e o que sobrou depois dele.
 *
 * A regra: o bloco MAIS RECENTE que tem forma para ler, ou seja, com pelo menos duas semanas
 * completas (o mesmo piso de `ritmoNaoMarca`). Domínio recém-migrado tem 5 dias e nenhuma semana
 * fechada — dizer "caiu 98%" sobre isso seria o mesmo erro do `43×` medido a partir de 27 dias de
 * zero, só que na direção contrária.
 *
 * `posteriores` é o que vem DEPOIS do bloco que respondeu. Vazio = o veredito é sobre o site de
 * hoje. Não vazio = a tela está falando do site ANTERIOR, e precisa dizer isso com todas as
 * letras — senão o leitor lê a história de um domínio como se fosse o estado do outro.
 *
 * 029 — `declarados` desce inteiro para `segmentosPorHost`: com a migração declarada a série volta
 * a ser um bloco só, `posteriores` sai vazio e a tela deixa de dizer que a série está encerrada
 * sobre um projeto que segue sendo medido.
 *
 * @param {Parameters<typeof segmentosPorHost>[0]} dias
 * @param {string[]} [declarados]
 * @returns {{segmento: SegmentoDeHost, ritmo: RitmoNaoMarca, posteriores: SegmentoDeHost[]} | null}
 */
export function ritmoDoSegmentoAtual(dias, declarados = []) {
  const segmentos = segmentosPorHost(dias, declarados);
  for (let i = segmentos.length - 1; i >= 0; i--) {
    const ritmo = ritmoNaoMarca(segmentos[i].dias);
    if (ritmo) return { segmento: segmentos[i], ritmo, posteriores: segmentos.slice(i + 1) };
  }
  return null;
}
