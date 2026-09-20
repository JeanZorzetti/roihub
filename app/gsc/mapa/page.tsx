import type { Metadata } from "next";
import { CATALOGO, MEDIDO_POR, regua } from "@/lib/gsc-delta.mjs";
import { DIVERGENCIAS, mapaDoBoard, RAMOS } from "@/lib/board-gsc.mjs";
import { listProjects } from "@/lib/projects";
import { hostsDeclarados } from "@/lib/projects.mjs";
import { gscConsultas, gscLigado, gscPaginas, gscTermos } from "@/lib/gsc";
import { lerInventario } from "@/lib/inventario.mjs";
import INVENTARIOS from "@/data/inventario-de-termos.json";
import { conformidadeDeCtr, impressoesNoTop3, LIMIAR_PAGINAS_DECIDIDAS, penetracaoNoTop3, porFaixaDePosicao, strikingDistancePorTermo, totalImpressoes } from "@/lib/kpis-busca.mjs";
import { motivoDeAusencia } from "@/lib/gsc-hosts.mjs";
import { marcaDeclarada, crescimentoNaoMarca, linhaDeCrescimento, variacao, ritmoDoSegmentoAtual } from "@/lib/marca.mjs";
import { descoberta, descobertaLonga } from "@/lib/janelas.mjs";
import { dbOn, lerDiasGsc, type DiaSeparado } from "@/lib/db";

import { Tabs } from "../../tabs";
import { Mapa } from "./mapa";

// O BOARD DE GSC COMO MAPA MENTAL (032). O Whimsical `okr-Saw2eoSKZDPLJAk6xeDBuS` completo — os
// níveis que `/gsc` não desenha porque o SVG dele para na folha.
//
// POR QUE UMA SEGUNDA TELA E NÃO A SUBSTITUIÇÃO DE `/gsc`: as duas respondem perguntas diferentes.
// `/gsc` responde "contra o que este KPI é julgado" — 32 linhas, estático, imprimível, zero JS, e é
// dele que sai o placar de procedência. Esta responde "o que este KPI É, na definição do board" —
// 113 nós em 6 níveis (medidos, nunca estimados: ver `fundo`), e a prosa que só existia dentro do
// editor. Fundir as duas custaria o render
// estático da primeira para ganhar profundidade que a maior parte das visitas não pede.
//
// 033 — REVERSÃO DECLARADA (`plan.md` § Complexity Tracking): até 19/09/2026 esta tela recusava
// ler dado de projeto pelo motivo abaixo, escrito então:
//   "os números da Atma vivem em /okr/atma/aquisicao, e repeti-los aqui daria duas telas
//   discordando sobre o mesmo KPI."
// O risco era real, mas a causa era DUAS IMPLEMENTAÇÕES, não dois lugares de exibição. A FR-005 é
// explícita: é O MAPA que precisa mostrar, em cada faixa de posição, a base e o veredito — nenhuma
// outra tela do hub tem a faixa como unidade (a de aquisição lê por URL e por termo). A trava que
// neutraliza o risco original: as seis faixas do nó "Posição no Google" vêm de
// `lib/kpis-busca.mjs#porFaixaDePosicao()`, a MESMA função que `/okr/atma/aquisicao` consome —
// discordar exigiria escrever a conta duas vezes, que é exatamente o que a função única impede.
// O board `okr-Saw2eoSKZDPLJAk6xeDBuS` é o board DA ATMA, não do portfólio, então a tela lendo a
// Atma é coerente com o escopo dela — e é isso que o cabeçalho da seção declara por escrito.
//
// 033/T070 — DINÂMICA, e não por gosto. A janela é MÓVEL (28 dias fechando em D-3) e a leitura do
// Search Console precisa da credencial, que NÃO existe no `npm run build` do Docker (o `Dockerfile`
// não tem `ARG`/`ENV` para ela, e não deve ter: segredo em camada de build fica no histórico da
// imagem — Princípio V). Com `revalidate = 3600` a rota era ESTÁTICA: o build pré-renderizava, a
// leitura devolvia `null` sem a credencial, e esse `null` foi assado no artefato e servido como
// `X-Nextjs-Cache: HIT` — seis faixas sem dado e uma frase falsa, a primeira hora de cada deploy.
// `/okr/[slug]/aquisicao` declara o MESMO `revalidate` e escapou por acidente de roteamento (o
// segmento `[slug]` sem `generateStaticParams` não pré-renderiza), não por acerto.
//
// POR QUE NÃO `<Suspense>` em volta da leitura, que manteria o board estático: misturar estático e
// dinâmico DENTRO de uma rota é o Partial Prerendering, que é feature do `cacheComponents` — e o
// `next.config.mjs` não o liga (ligar muda o padrão de todas as rotas do hub, e proíbe `revalidate`
// e `dynamic` de segmento). Sem ele o `<Suspense>` não muda o que é pré-renderizado, e a leitura
// continua rodando no build. Conferido em 20/09/2026 pela doc do Next 16 instalada, e pelo build.
// O que se perde é o render estático do board (`mapaDoBoard()` é função pura, custo desprezível).
export const dynamic = "force-dynamic";

// ⚠️ A META DO BOARD NÃO VIRA RÉGUA AO SER DESENHADA. Cada folha carrega o losango da procedência
// (`◆` tem fonte, `◇` não tem) e o painel imprime o motivo. Publicar "< 15% de reescrita" com a
// mesma tipografia de "LCP ≤ 2,5s" é o defeito que `/gsc` existe para acusar — e um mapa bonito é
// justamente onde ele passaria despercebido.

export const metadata: Metadata = {
  title: "Board GSC — o mapa mental completo, com a definição de cada KPI",
};

type No = { id: string; topic: string; note?: string; tags?: string[]; children?: No[]; metadata?: unknown };

/** Busca em profundidade por `id` — a árvore de `mapaDoBoard()` não tem índice, e os ids das
 *  folhas são literais (`chave` do catálogo, ver `lib/board-gsc.mjs#mapaDoBoard`). */
function acharNo(n: No, id: string): No | null {
  if (n.id === id) return n;
  for (const f of n.children ?? []) {
    const achado = acharNo(f, id);
    if (achado) return achado;
  }
  return null;
}

const pct1 = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** 033 — o `topic` de uma faixa: curto, os cinco estados (`data-model.md` § Os cinco estados) por
 *  glifo E texto, nunca só cor. A prosa longa (IC completo, régua, fonte, janela) vai no `note`,
 *  que o painel de seleção mostra — a `mind-elixir` não renderiza `note` (ver `mapa.tsx`). */
function topicDaFaixa(f: ReturnType<typeof porFaixaDePosicao>[number]): string {
  const base = `${f.rotulo}`;
  if (f.amostra.impressoes === 0) return `${base} · ∅ o site não aparece aqui`;
  const contagem = `${f.amostra.impressoes.toLocaleString("pt-BR")} impr · ${f.paginas} ${f.paginas === 1 ? "pág" : "págs"}`;
  if (f.regua === null) return `${base} · ${contagem} · ○ sem régua nesta faixa`;
  if (f.veredito === "indecisa") return `${base} · ${contagem} · ◐ não decide`;
  const ic = f.intervalo!;
  const parenteses =
    f.veredito === "abaixo"
      ? `IC até ${pct1(ic.superior)} < régua ${pct1(f.regua)}`
      : `IC desde ${pct1(ic.inferior)} > régua ${pct1(f.regua)}`;
  const glifo = f.veredito === "abaixo" ? "▼ abaixo" : "▲ atinge";
  return `${base} · ${contagem} · ${glifo} (${parenteses})`;
}

function noteDaFaixa(f: ReturnType<typeof porFaixaDePosicao>[number]): string {
  const janela = `janela ${f.janela.inicio} → ${f.janela.fim}`;
  if (f.amostra.impressoes === 0) return `Nenhuma impressão nesta faixa na janela — ${janela}. Não é 0%: é ausência de amostra.`;
  const ctr = f.amostra.ctr === null ? "sem CTR" : `CTR real ${pct1(f.amostra.ctr)}`;
  if (f.regua === null) return `${ctr}, sobre ${f.amostra.impressoes.toLocaleString("pt-BR")} impressões — sem régua publicada para esta faixa (o board pede "~1,5%" e o número não tem fonte) · ${janela}.`;
  const ic = f.intervalo!;
  const veredito =
    f.veredito === "indecisa"
      ? "o intervalo de confiança de 95% (Wilson) atravessa a régua — a amostra não decide"
      : f.veredito === "abaixo"
        ? "o intervalo de confiança de 95% exclui a régua por baixo"
        : "o intervalo de confiança de 95% exclui a régua por cima";
  return `${ctr} (IC 95%: ${pct1(ic.inferior)} a ${pct1(ic.superior)}) contra a régua de ${pct1(f.regua)} — ${veredito} · ${janela}.`;
}

/** 034 — o `topic` da penetração: o número, a base e o estado. NENHUM glifo de veredito (`▼`/`▲`/
 *  `◐`) aparece aqui, e a ausência é exigência da FR-009 — a folha tem coletor e NÃO tem régua.
 *  Os "20% a 30%" são meta do board, e comparar contra eles seria publicar um veredito que o
 *  `balizador: recusa` desta folha nega duas linhas acima, no mesmo painel. */
function topicDaPenetracao(p: { fracao: number; noTop3: number; total: number; cobertura: number; piso: boolean }): string {
  const base = `Medido: ${pct1(p.fracao)} · ${p.noTop3} de ${p.total} termos monitorados`;
  return p.piso ? `${base} · piso (${p.cobertura} apurados na janela)` : base;
}

function noteDaPenetracao(
  p: { fracao: number; noTop3: number; total: number; cobertura: number; piso: boolean },
  janela: { inicio: string; fim: string },
  procedencia: { congeladoEm: string; piso: number; janela: { inicio: string; fim: string } },
): string {
  const medida = `${p.noTop3} dos ${p.total} termos do inventário estão em posição ≤ 3 na janela ${janela.inicio} → ${janela.fim} (28 dias, fecha em D-3).`;
  const inventario = `O inventário foi congelado em ${procedencia.congeladoEm}: termos com ao menos ${procedencia.piso} impressões entre ${procedencia.janela.inicio} e ${procedencia.janela.fim}, somados os hosts declarados, sem a marca própria.`;
  // A cobertura não é rodapé: 271 dos 725 termos não tiveram UMA impressão na janela, e um termo
  // sem impressão não prova estar fora do Top 3 — prova que ninguém buscou por ele, ou que o
  // Search Console omitiu a consulta rara. Sem esta frase o piso leria como total.
  const cobertura = p.piso
    ? ` Só ${p.cobertura} deles tiveram impressão nesta janela, então o número é PISO: os ${p.total - p.cobertura} ausentes contam no denominador e não podem contar no numerador.`
    : " Todos tiveram impressão nesta janela.";
  return `${medida}${cobertura} ${inventario} Meta do board: 20% a 30% — meta, não régua: o denominador é escolhido por quem mede, então não há faixa de mercado para julgar contra.`;
}

type MedidaStriking = NonNullable<ReturnType<typeof strikingDistancePorTermo>>;

const br = (n: number) => n.toLocaleString("pt-BR");

/** 035 — o `topic` do striking distance: o número e a base, nada além. NENHUM glifo de veredito,
 *  pela mesma razão da penetração (FR-009): os 15% a 25% são meta do board, `balizador.tipo` desta
 *  folha é `recusa`, e um `▼` aqui publicaria julgamento que o painel nega duas linhas acima.
 *  `total: 0` cai neste mesmo formato de propósito — zero MEDIDO é uma medida, e é o que o separa
 *  dos três estados de ausência. */
function topicDoStriking(m: MedidaStriking): string {
  return `Medido: ${br(m.total)} ${m.total === 1 ? "consulta" : "consultas"} entre as posições 4,0 e 10,9 · base ${br(m.base)} termos lidos`;
}

function noteDoStriking(
  m: MedidaStriking,
  janela: { inicio: string; fim: string },
  inventario: { termos: string[]; total: number } | null,
): string {
  const medida = `${br(m.total)} de ${br(m.base)} termos lidos estão entre as posições 4,0 e 10,9 na janela ${janela.inicio} → ${janela.fim} (28 dias, fecha em D-3), somando ${br(m.impressoes)} impressões e ${br(m.cliques)} cliques.`;
  // FR-005 — `removidas: null` NÃO é `0`. Um é "a marca pode estar aí e ninguém procurou", o outro
  // é "procurei e não achei". Consertos opostos: editar o card × nada a fazer.
  const marca =
    m.removidas === null
      ? " ⚠️ A marca própria NÃO foi filtrada: este projeto não declara `marca` no card, e a fila pode estar encabeçada pelo próprio nome da empresa — que reforço de conteúdo e link interno não movem."
      : m.removidas > 0
        ? ` ${br(m.removidas)} consulta(s) de marca saíram da contagem.`
        : " Nenhuma consulta de marca caiu nesta faixa (a marca é declarada no card).";
  // FR-014 — sem piso de impressões, a cauda precisa aparecer. Um total nu lê como se as 344 fossem
  // trabalho do mesmo tamanho, e 93 delas tiveram UMA impressão em 28 dias.
  const cauda = m.cauda > 0 ? ` ${br(m.cauda)} delas tiveram uma única impressão na janela.` : "";
  // FR-013 — leitura SECUNDÁRIA, nunca o numerador: o inventário está congelado, e filtrar por ele
  // cegaria a folha para a consulta nova, que é a oportunidade que este KPI existe para achar.
  const noInventario = inventario
    ? ` ${br(m.lista.filter((l) => (inventario.termos as string[]).includes((l as { termo: string }).termo)).length)} das ${br(m.total)} estão no inventário declarado de ${br(inventario.total)} termos monitorados.`
    : "";
  // FR-007 — as duas telas medem grandezas diferentes sob o mesmo nome de KPI, e a que não declarar
  // isso vira "duas telas discordando". Sem citar o número de lá: ele muda a cada janela.
  const divergencia = ` A aba de aquisição do projeto publica um número MAIOR para o mesmo KPI: lá a leitura é por consulta×página, porque a lista de lá é fila de trabalho e precisa nomear a página a reforçar — o mesmo termo entra uma vez por página em que ranqueia. Aqui a contagem é de CONSULTAS, na dimensão que o Google agrega por consulta, como o board pede.`;
  return `${medida}${marca}${cauda}${noInventario}${divergencia} Meta do board: converter 15% a 25% ao trimestre — meta, não régua: a taxa de promoção depende da dificuldade do termo e do esforço aplicado, e nenhum estudo público controla as duas.`;
}

type MedidaCrescimento = ReturnType<typeof crescimentoNaoMarca>;
type LeituraDaSerie = ReturnType<typeof ritmoDoSegmentoAtual>;

/** 036 — a nota do crescimento não-marca. O topic já é `linhaDeCrescimento()` (em `lib/`, testada);
 *  aqui mora só a prosa, na ordem do `data-model.md` § 5: a janela nos termos DESTA folha, por que
 *  a faixa do board não se aplica, a FORMA da série, e a razão quando ela não abriu a linha.
 *
 *  O nó é lido ISOLADO (clique direto, sem o pai), então a nota carrega o que a linha de topo não
 *  cabe: de que meses o número é e por que os 28 dias do cabeçalho da página não valem aqui. */
function noteDoCrescimento(
  m: MedidaCrescimento,
  leitura: LeituraDaSerie,
  decl: ReturnType<typeof marcaDeclarada>,
): string {
  if (m.estado === "nao-declarada") {
    return decl.motivo
      ? `O card da Atma não declara \`marca\` (${decl.motivo}). Sem a lista de termos o hub não sabe quais consultas são busca pelo NOME, e a separação marca/não-marca não existe — o que não é o mesmo que zero. Declara-se em \`data/projects.json\`, campo \`marca\` (\`termos\` + \`pais\`).`
      : "O card declara `marca`, mas nenhum dia da série gravada traz a separação medida. Não é falta de declaração: a corrida das 05:17 ainda não preencheu a série, e a medida aparece na próxima passagem.";
  }
  if (m.estado === "poucos-meses") {
    return "A razão compara dois meses fechados CONSECUTIVOS, e a série ainda não os tem. É calendário: o conserto é esperar o próximo mês fechar. O mês corrente nunca entra — o Search Console ainda sobe a ponta dos últimos dias.";
  }
  if (m.estado === "nao-consecutivos") {
    return `Os dois últimos meses fechados são ${m.de} e ${m.para}, e há um mês no meio que não fechou: falta dia com a separação medida. É buraco a investigar em \`hub_gsc_dia\`, não calendário a esperar — comparar os dois chamaria de crescimento mensal a soma de dois meses.`;
  }
  if (m.estado === "base-zero") {
    return `O mês-base ${m.de} tem ZERO impressões não-marca, então a razão dividiria por zero. O mês seguinte (${m.para}) tem ${br(m.paraImpressoes)}: há número, não há razão. Não é problema a consertar — sem base, a comparação não existe.`;
  }
  const janela = `A razão compara MESES FECHADOS (${m.de} e ${m.para}) da série que o hub grava da Atma — não os 28 dias que o cabeçalho da página declara para as seis faixas de posição. O mês corrente nunca entra: o Search Console ainda sobe a ponta (30/07 saiu com 30 impressões e fechou em 827).`;
  // FR-003/FR-009 — a razão SÓ chega aqui quando a linha de topo não a abriu. É a mesma palavra da
  // aba de aquisição ("a faixa do board não se aplica"), para as duas telas não divergirem.
  const base = m.baseInterrompida
    ? ` ⚠️ O mês-base ${m.de} teve ${m.diasZeroDe} de ${m.diasDe} dias em zero: um terço do mês sem nenhuma impressão não-marca é o instrumento ou o índice fora do ar, não sazonalidade. A razão entre os dois é ${variacao(m.valor)}, e ela mede a VOLTA de um mês quebrado, não ritmo de aquisição — a faixa do board não se aplica.`
    : "";
  // FR-013 — o `ritmo` é o MESMO objeto que assina o "% do pico" de /okr/atma/aquisicao. Derivar um
  // pico aqui abriria a porta para as duas telas citarem picos diferentes.
  const semana = (s: { inicio: string; fim: string; impressoesNaoMarca: number; posicao: number | null }) =>
    `${s.inicio} → ${s.fim}, ${br(s.impressoesNaoMarca)} impressões não-marca${s.posicao === null ? "" : `, posição média ${s.posicao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}`}`;
  const forma = leitura
    ? ` Forma da série, sobre semanas completas: a última (${semana(leitura.ritmo.ultima)}) contra a melhor (${semana(leitura.ritmo.pico)})${leitura.ritmo.fracaoDoPico === null ? "" : ` — ${pct1(leitura.ritmo.fracaoDoPico)} do pico`}.${leitura.posteriores.length ? " ⚠️ Esta forma é do site ANTERIOR: o domínio novo ainda não fechou duas semanas completas." : ""}`
    : " A série ainda não tem duas semanas completas para ler a forma.";
  return `${janela}${base}${forma} Meta do board: 5% a 10% ao mês — meta, não régua: não há faixa de mercado publicada, então o hub não julga contra ela.`;
}

type MedidaImpressoes = NonNullable<ReturnType<typeof impressoesNoTop3>>;

/** 037 — o `topic` da concentração no Top 3: a fração, o numerador e a base LIDA, nada além.
 *  NENHUM glifo de veredito (`▼`/`▲`/`◐`), pela mesma razão das três folhas vizinhas
 *  (FR-009 da 034, FR-008 da 036): os 40% a 50% são meta do board, `balizador.tipo` desta folha é
 *  `recusa`, e um `▼` aqui publicaria o julgamento que o `◇ sem fonte` do rótulo nega duas
 *  linhas acima, no mesmo painel. Quem julga contra a faixa é a aba de aquisição, e a nota diz isso. */
function topicDasImpressoes(m: MedidaImpressoes): string {
  return `Medido: ${pct1(m.fracao)} · ${br(m.noTop3)} de ${br(m.total)} impressões lidas por consulta×página`;
}

/** A nota da concentração. Ordem: a medida com a janela, a BASE (que é parcial, e a alternativa de
 *  base completa com o número que ela daria), a marca, a concentração numa URL, e a divergência de
 *  veredito com a outra tela. Nada de novo entra aqui sem sair outra coisa: quatro corridas
 *  acrescentaram ressalva a esta família de blocos e o log de 18/09 registrou que a ressalva já é
 *  mais comprida que a resposta. */
function noteDasImpressoes(
  m: MedidaImpressoes,
  janela: { inicio: string; fim: string },
  porPagina: { base: number; fracao: number } | null,
  marca: { noTop3: number; semMarca: number } | null,
  campea: { caminho: string; fracao: number } | null,
): string {
  const medida = `${br(m.noTop3)} das ${br(m.total)} impressões lidas estão entre as posições 1,0 e 3,9 na janela ${janela.inicio} → ${janela.fim} (28 dias, fecha em D-3).`;
  // A base é PARCIAL, e dizer isso não é rodapé: a dimensão `query` do Search Console omite as
  // consultas raras. Sem esta frase a fração leria como fatia do site inteiro. A alternativa de
  // base completa está aqui com o número que ela daria, porque é ele que prova por que ela não foi
  // escolhida — não uma opinião sobre dimensões.
  const base = porPagina
    ? ` A leitura cobre ${br(m.total)} das ${br(porPagina.base)} impressões que o site teve na mesma janela: a dimensão \`query\` omite as consultas raras, então isto é fração da parte apurada. A dimensão \`page\`, que tem a base completa, daria ${pct1(porPagina.fracao)} — lá a posição é a MÉDIA da URL, e a média de uma página não descreve nenhuma das impressões dela.`
    : "";
  const daMarca = marca
    ? ` ${br(marca.noTop3)} do numerador ${marca.noTop3 === 1 ? "é impressão" : "são impressões"} da marca própria; sem ${marca.noTop3 === 1 ? "ela" : "elas"} a concentração seria ${pct1(marca.semMarca)}.`
    : " A marca própria NÃO foi separada: este projeto não declara `marca` no card, e o número pode estar sustentado pelo próprio nome da empresa.";
  const concentrada = campea ? ` ${pct1(campea.fracao)} do numerador vêm de uma URL só (${campea.caminho}).` : "";
  // FR-007 da 035, aplicada a uma divergência de VEREDITO e não de número: as duas telas publicam o
  // mesmo valor (mesma função, mesma leitura, mesma janela) e só uma o julga. Sem esta frase, quem
  // vier das duas telas encontra um `▼` de um lado e nenhum do outro sobre o MESMO número.
  const divergencia = " A aba de aquisição do projeto publica este mesmo número — mesma função, mesma leitura, mesma janela — com veredito contra a faixa; aqui não há glifo.";
  return `${medida}${base}${daMarca}${concentrada}${divergencia} Meta do board: 40% a 50% — meta, não régua: a concentração depende do mix de termos de marca, e nenhum estudo publica faixa de mercado para ela.`;
}

type MedidaConformidade = ReturnType<typeof conformidadeDeCtr>;

/** 038 — o `topic` do Índice de Conformidade, e ele TROCA DE FORMA no mesmo limiar da aba de
 *  aquisição (`LIMIAR_PAGINAS_DECIDIDAS`, 033/FR-012). Abaixo de 20 páginas decididas a resposta é
 *  a URL NOMEADA e não o índice: "um índice sobre 4 páginas é ruído travestido de percentual" está
 *  escrito na outra tela, e publicar o percentual AQUI faria este mapa afirmar sobre a mesma
 *  leitura o que a outra recusa afirmar — a divergência que o cabeçalho deste arquivo existe para
 *  impedir. O percentual não some: desce para o `note`, como evidência de nível 2.
 *
 *  O glifo `▼`/`▲` julga a URL contra a RÉGUA DELA — `ctrGap` declara `balizador: regua` e o piso
 *  por posição tem fonte. Nenhum glifo julga a FRAÇÃO contra os 75% a 80%: a folha vizinha
 *  `conformidadeUrls` declara `balizador: recusa` ("QUANTAS URLs devem superá-lo exigiria o GSC de
 *  terceiros, que ninguém publica"), e um `▼` ali seria veredito sem régua. */
function topicDaConformidade(c: MedidaConformidade): string {
  const resto = `${br(c.indecisas)} ${c.indecisas === 1 ? "indecisa" : "indecisas"} · ${br(c.semRegua)} sem régua`;
  if (c.porPagina.decididas === 0) return `◐ a amostra não decide nenhuma URL · ${resto}`;
  if (c.porPagina.decididas < LIMIAR_PAGINAS_DECIDIDAS && c.nomeada) {
    const n = c.nomeada;
    // O DENOMINADOR abre a caixa, antes da página nomeada: quem chega neste nó procura uma fração,
    // e sem "4 de 24" a página solta lê como se o nó medisse outra coisa. Medido na imagem: sem
    // esta abertura o teste de cinco segundos falha — a caixa responde "qual página", não "quantas".
    // A posição fica só no `note`: a régua já diz em que degrau a URL está, e a caixa tem 240px.
    return `${br(c.porPagina.decididas)} de ${br(c.porPagina.decididas + c.indecisas)} URLs decididas · ${n.veredito === "abaixo" ? "▼ abaixo" : "▲ atinge"} · ${new URL(n.url).pathname} · ${pct1(n.participacao)} do tráfego · CTR ${pct1(n.ctr)} vs régua ${pct1(n.regua)}`;
  }
  return `Medido: ${pct1(c.porPagina.fracao!)} · ${br(c.porPagina.atingem)} de ${br(c.porPagina.decididas)} URLs decididas · ${resto}`;
}

/** A nota da conformidade. Ordem: o índice com a janela, o DENOMINADOR (que é a pergunta que o
 *  índice provoca), por que o topic não é o índice, a leitura por tráfego (que aponta para o outro
 *  lado), a dimensão, e a meta que não julga. */
function noteDaConformidade(c: MedidaConformidade, janela: { inicio: string; fim: string }, lidas: number): string {
  const j = `janela ${janela.inicio} → ${janela.fim} (28 dias, fecha em D-3)`;
  // O índice aparece SEMPRE, inclusive quando não é o topic: quem expande a folha está procurando o
  // número, e escondê-lo faria a folha medida parecer não medida.
  const indice =
    c.porPagina.fracao === null
      ? `Nenhuma URL decidida na ${j}. Não é 0% de conformidade: "a amostra não julga" e "as páginas falham" pedem trabalho oposto, e um zero aqui mandaria reescrever títulos que ninguém provou estarem ruins.`
      : `${pct1(c.porPagina.fracao)} das URLs decididas atingem o CTR mínimo da própria posição na ${j} — ${br(c.porPagina.atingem)} de ${br(c.porPagina.decididas)}.`;
  // 29 lidas → 24 com régua → 4 decididas. Sem esta frase o índice lê como se o site tivesse 4
  // páginas, e a leitura seguinte seria "o denominador está errado" em vez de "a amostra é rala".
  const denominador = ` O denominador é ${br(c.porPagina.decididas)} e não ${br(lidas)}: ${br(c.semRegua)} URLs estão acima da posição 10,9, onde o board não publica piso (o "~1,5%" da página 2 não tem fonte e aplicá-lo à cauda mediria o palpite), e ${br(c.indecisas)} têm o intervalo de confiança de 95% (Wilson) atravessando a régua — desde a 033, amostra que não decide não reprova.`;
  const limiar =
    c.porPagina.decididas > 0 && c.porPagina.decididas < LIMIAR_PAGINAS_DECIDIDAS
      ? ` Por isso o nó não abre pelo índice: com menos de ${br(LIMIAR_PAGINAS_DECIDIDAS)} decididas ele é ruído com casa decimal, e a resposta é a URL de maior impressão entre as decididas — a MESMA regra e a MESMA função de /okr/atma/aquisicao, que publica esta frase inteira.`
      : ` As ${br(c.porPagina.decididas)} decididas passam do limiar de ${br(LIMIAR_PAGINAS_DECIDIDAS)}, e o índice é a resposta — a mesma troca de forma que /okr/atma/aquisicao faz sobre esta leitura.`;
  // A leitura que aponta para o outro lado. Publicar só a fração por página deixaria "1 de 4
  // atinge" soar como um quarto do site salvo, quando a URL que atinge carrega 2,5% do movimento.
  const trafego =
    c.porTrafego.fracao === null
      ? ""
      : ` Pelo TRÁFEGO decidível a mesma leitura dá ${pct1(c.porTrafego.fracao)} (${br(c.porTrafego.impressoesQueAtingem)} de ${br(c.porTrafego.impressoesDecididas)} impressões): contar PÁGINA e contar IMPRESSÃO respondem perguntas diferentes, e a distância entre as duas é o tamanho da concentração — a régua julga cada URL por igual, o usuário não.`;
  // 032: esta folha é por URL e lê a dimensão `page`. A outra leitura omite as consultas raras e
  // publicava 0% sobre 6 URLs porque expulsava a home do denominador.
  const dimensao = " Leitura por PÁGINA (dimensão `page` do Search Console), somados os hosts declarados: é a dimensão que mede URL, e a fronteira que a 032 cobrou do compilador. A leitura por consulta×página omite as consultas raras — 42,1% das impressões da Atma — e com ela este índice publicava 0% sobre 6 URLs.";
  // A testemunha imprime OUTRA regra e isso não é contradição: sem esta frase, quem rodar o script
  // para conferir o board acha que o board está errado, e "conserta" um número correto.
  const testemunha = " A testemunha `scripts/conferir-soma-hosts.mjs atma <ini> <fim> --pagina` aplica o piso FIXO (CTR ≥ régua, sem exigir que a amostra decida) e imprimia 12,50% sobre 24 avaliadas em 20/09/2026, na mesma janela e sobre as mesmas linhas: é a regra anterior à 033, não uma divergência de leitura — as duas contam a mesma coisa e só uma exige significância.";
  return `${indice}${denominador}${limiar}${trafego}${dimensao}${testemunha} Meta do board: 75% a 80% das URLs — meta, não régua: o piso por posição tem fonte, QUANTAS URLs devem superá-lo exigiria o Search Console de terceiros, que ninguém publica.`;
}

export default async function MapaDoBoardPage() {
  const dados = mapaDoBoard();
  const cat = CATALOGO as Record<string, { nome: string; ramo: string }>;
  const reguaDe = regua as (k: string) => { tem: boolean; meta: number | [number, number] | null };
  const medidoPor = MEDIDO_POR as Record<string, string | undefined>;

  // 033/US2 — as seis faixas de posição, sobre os hosts da ATMA (o board é o dela). Contrato de
  // ausência (`contracts/telas.md` §C): `null` = sem propriedade, `{erro}` = falha transitória,
  // `{paginas:[]}` = respondeu, zero impressão. Nenhum dos três renderiza `0%`.
  const projects = await listProjects();
  const atma = projects.find((p) => p.slug === "atma");
  const janela = descoberta();
  const hosts = atma ? hostsDeclarados(atma) : [];
  const paginasGsc = atma ? await gscPaginas(hosts, janela) : null;
  // 033/T071 — `null` tem TRÊS causas com consertos opostos (lista vazia, credencial ausente, host
  // fora de toda propriedade), e a tela afirmava a terceira sempre. Quem nomeia é `motivoDeAusencia`.
  const notaAusencia =
    paginasGsc === null
      ? motivoDeAusencia({ ligado: gscLigado(), hosts })
      : "erro" in paginasGsc
        ? `erro na fonte: ${paginasGsc.erro}`
        : null;
  const faixas = paginasGsc && !("erro" in paginasGsc) ? porFaixaDePosicao(paginasGsc.paginas, janela) : null;

  // O nó "Posição no Google" é filho único do detalhe de `ctrPorPosicao` (`BOARD.ctrPorPosicao`),
  // e seus 6 filhos estão na MESMA ordem de `FAIXAS`/`porFaixaDePosicao()` — a ordem em que
  // `noDeDetalhe()` percorre `d.filhos`, que é a ordem em que o board declara as seis faixas.
  const ctrNode = acharNo(dados.nodeData as No, "ctrPorPosicao");
  const posicaoNode = ctrNode?.children?.[0] ?? null;
  if (posicaoNode) {
    // FR-004 — a janela também no nó PAI: um nó lido isolado (clique direto, sem passar pelo pai)
    // ainda declara de que período o número é.
    const janelaTxt = `Janela: ${janela.inicio} → ${janela.fim} (28 dias, fecha em D-3).`;
    if (notaAusencia) {
      posicaoNode.note = posicaoNode.note ? `${posicaoNode.note} — ${notaAusencia}. ${janelaTxt}` : `${notaAusencia}. ${janelaTxt}`;
    } else if (faixas) {
      const decisivas = faixas.filter((f) => f.veredito === "atinge" || f.veredito === "abaixo").length;
      posicaoNode.note = posicaoNode.note
        ? `${posicaoNode.note} — ${decisivas} de 6 faixas decisivas nesta janela. ${janelaTxt}`
        : `${decisivas} de 6 faixas decisivas nesta janela. ${janelaTxt}`;
      // As seis faixas, por índice — `FAIXAS`/`porFaixaDePosicao()` devolvem sempre 6, na mesma
      // ordem que `BOARD.ctrPorPosicao.detalhe[0].filhos` declara.
      posicaoNode.children = (posicaoNode.children ?? []).map((filho, i) => {
        const f = faixas[i];
        if (!f) return filho;
        return { ...filho, topic: topicDaFaixa(f), note: noteDaFaixa(f) };
      });
    }
  }

  // 034/US2 — a penetração no Top 3, na folha que define o KPI. Leitura SEPARADA da de cima e na
  // dimensão `query` sozinha: a de cima lê por PÁGINA e esta conta TERMO, e a agregação do Google
  // por termo não é a soma das linhas de `query`+`page` (é a mesma razão que fez a 032 deletar
  // `porUrl`). Duas requisições, duas perguntas.
  const termosGsc = atma ? await gscTermos(hosts, janela) : null;
  // O JSON entra tipado pelo próprio arquivo; `lerInventario` é `.mjs` e valida em tempo de
  // execução (lista vazia, termo duplicado, marca dentro do inventário) — é ela que reprova o
  // arquivo editado à mão, não o `tsc`.
  const inventario = lerInventario("atma", INVENTARIOS);
  const penNode = acharNo(dados.nodeData as No, "penetracaoTop3");
  if (penNode) {
    const pen =
      termosGsc && !("erro" in termosGsc) ? penetracaoNoTop3(termosGsc.linhas, inventario) : null;
    // 034/US3 — QUATRO estados e nunca `0%` em três deles. "Sem inventário" (34 dos 35 projetos)
    // e "a leitura falhou" pedem trabalho oposto — curar uma lista × investigar uma credencial —
    // e um `null` mudo faria os dois parecerem o mesmo. A ordem é a da causa mais específica.
    const filho: No = !inventario
      ? {
          id: "penetracaoTop3-medido",
          topic: "∅ não apurado · inventário de termos não declarado para este projeto",
          note: "A fórmula pede um total de termos MONITORADOS, e monitorar é decisão de quem mede: sem a lista declarada não existe denominador, e qualquer percentual seria inventado. Um inventário se declara em `data/inventario-de-termos.json` — `scripts/derivar-inventario.mjs` deriva o primeiro a partir do que o site já ranqueia.",
        }
      : !termosGsc
        ? {
            id: "penetracaoTop3-medido",
            topic: "∅ não apurado · sem leitura do Search Console",
            note: `${motivoDeAusencia({ ligado: gscLigado(), hosts })}. O inventário existe (${inventario.total} termos); o que falta é a leitura.`,
          }
        : "erro" in termosGsc
          ? {
              id: "penetracaoTop3-medido",
              topic: "∅ não apurado · a leitura do Search Console falhou",
              note: `Falha transitória, não ausência de dado: ${termosGsc.erro}. O inventário existe (${inventario.total} termos) e a medida volta na próxima leitura.`,
            }
          : {
              id: "penetracaoTop3-medido",
              topic: topicDaPenetracao(pen!),
              note: noteDaPenetracao(pen!, janela, inventario.procedencia),
            };
    // À FRENTE da fórmula e da meta: quem expande a folha está procurando o número, e a definição
    // do board é o que ele confere DEPOIS de achá-lo.
    penNode.children = [filho, ...(penNode.children ?? [])];
  }

  // 035/US1 — o striking distance na folha que define o KPI, sobre a MESMA leitura por termo que a
  // penetração acabou de consumir. Zero requisição nova (FR-003): as duas medidas contam CONSULTA,
  // e consulta só existe na dimensão `query`.
  //
  // A guarda de marca é a razão de a medida ter função própria. `strikingDistance()` — a que
  // `/okr/atma/aquisicao` usa — filtra por `c.query`, e as linhas daqui trazem `termo`: a chamada
  // compilaria e removeria NADA. Medido na Atma em 20/09/2026: 347 consultas e 113 cliques com a
  // guarda desligada contra 344 e 41 com ela, e `atma aligner` (posição 4,4, 423 impressões)
  // encabeçando a fila com 70 dos 113 cliques.
  //
  // A MESMA construção de marca de `/okr/[slug]/aquisicao` (025/D3): uma fonte só. Duas
  // divergiriam na primeira variante nova, e a tela filtraria por um padrão que não é o exibido.
  // `?? {}` e não `atma!`: sem o card não há marca a declarar, e `motivo: "ausente"` é o estado
  // certo. (Sem o card também não há leitura, então a folha cai no primeiro estado de qualquer
  // forma — mas a medida não pode depender dessa coincidência para não quebrar.)
  // 036 — SOBE para o escopo da função: a folha do crescimento não-marca lê a mesma declaração, e
  // duas construções seriam a divergência que o parágrafo acima descreve.
  const decl = marcaDeclarada(atma ?? {});
  const sdNode = acharNo(dados.nodeData as No, "strikingDistance");
  if (sdNode) {
    const ehMarca = decl.motivo ? null : (t: string) => new RegExp(decl.padrao, "i").test(t);
    const medida =
      termosGsc && !("erro" in termosGsc) ? strikingDistancePorTermo(termosGsc.linhas, ehMarca) : null;
    // Os QUATRO estados da folha, da causa mais específica para a mais genérica — e nenhum dos três
    // de ausência publica `0`. Zero medido é o quarto, e ele SIM mostra `0`: é o que os separa.
    const filho: No = !termosGsc
      ? {
          id: "strikingDistance-medido",
          topic: "∅ não apurado · sem leitura do Search Console",
          note: `${motivoDeAusencia({ ligado: gscLigado(), hosts })}. Sem a leitura não há faixa de posição para contar — e um "0 consultas" aqui leria como "nada a converter", a afirmação mais otimista possível sobre um KPI de oportunidade.`,
        }
      : "erro" in termosGsc
        ? {
            id: "strikingDistance-medido",
            topic: "∅ não apurado · a leitura do Search Console falhou",
            note: `Falha transitória, não ausência de dado: ${termosGsc.erro}. A medida volta na próxima leitura.`,
          }
        : medida === null
          ? {
              id: "strikingDistance-medido",
              topic: "∅ não apurado · forma de linha inesperada na leitura",
              note: "A medida foi alimentada com linhas que não carregam `termo` — provavelmente a leitura por consulta×página em vez da leitura por consulta. É bug de código, não ausência de dado: a função recusa medir em vez de devolver um número com a guarda de marca desligada.",
            }
          : {
              id: "strikingDistance-medido",
              topic: topicDoStriking(medida),
              note: noteDoStriking(medida, janela, inventario),
            };
    // À FRENTE da métrica e da meta, pelo mesmo motivo da folha vizinha: quem expande está
    // procurando o número, e confere a definição do board DEPOIS de achá-lo.
    sdNode.children = [filho, ...(sdNode.children ?? [])];
  }

  // 036/US1 — o crescimento não-marca na folha que define o KPI. A fonte é o BANCO (`hub_gsc_dia`,
  // gravada pela corrida das 05:17): zero requisição nova ao Search Console (FR-005). Buscar as três
  // pernas no render triplicaria a rede por visita para exibir um número sem data.
  //
  // A MESMA janela da aba de aquisição (`descobertaLonga`) e os MESMOS hosts declarados, senão as
  // duas telas leem recortes diferentes da série e citam meses, absolutos e picos que divergem
  // (SC-005). Falha do banco vira `{erro}` truncado, e nunca a string de conexão (Princípio V).
  const cnmNode = acharNo(dados.nodeData as No, "crescimentoNaoMarca");
  if (cnmNode) {
    const longa = descobertaLonga() as { inicio: string; fim: string };
    let serie: DiaSeparado[] | { erro: string } | null = null;
    if (atma && dbOn()) {
      try {
        serie = await lerDiasGsc("atma", longa.inicio, longa.fim);
      } catch (e) {
        serie = { erro: (e instanceof Error ? e.message : String(e)).slice(0, 60) };
      }
    }
    // SEIS estados de tela, e nenhum publica `0`: os cinco da função pura + a leitura que falhou. A
    // falha é transitória e a ausência é estrutural — uma pede investigar credencial, a outra pede
    // declarar marca, e um `null` mudo faria as duas parecerem a mesma coisa (mesma razão da 030).
    let filho: No;
    if (!Array.isArray(serie)) {
      filho = {
        id: "crescimentoNaoMarca-medido",
        topic: `∅ não apurado · banco indisponível (${serie ? serie.erro : atma ? "sem banco configurado para o hub" : "projeto atma não encontrado no hub"})`,
        note: "Falha transitória ou ambiente sem banco — não ausência de dado. A série está gravada em `hub_gsc_dia`; o que falhou foi a leitura, e a medida volta na próxima. Sem a leitura não há mês fechado para comparar, e um 0% aqui leria como estagnação medida.",
      };
    } else {
      const medida = crescimentoNaoMarca(serie, new Date().toISOString().slice(0, 10));
      // `nao-declarada` sem `decl.motivo`: o card DECLARA e a série ainda não traz a separação.
      // Dizer "marca não declarada" ali mandaria editar o card — o conserto é esperar a corrida.
      const naoPreenchida = medida.estado === "nao-declarada" && !decl.motivo;
      filho = {
        id: "crescimentoNaoMarca-medido",
        topic: naoPreenchida
          ? "∅ não apurado · a série gravada ainda não traz a separação de marca"
          : linhaDeCrescimento(medida),
        note: noteDoCrescimento(medida, ritmoDoSegmentoAtual(serie, hosts), decl),
      };
    }
    // À FRENTE da fórmula e da meta, pelo mesmo motivo das folhas vizinhas. Sem glifo de veredito
    // (FR-008): os 5% a 10% são meta do board, `balizador.tipo` é `recusa` e a folha segue `◇ sem fonte`.
    cnmNode.children = [filho, ...(cnmNode.children ?? [])];
  }

  // 037/US1 — a concentração no Top 3 na folha que a define. MESMA função e MESMA leitura de
  // `/okr/[slug]/aquisicao` (`impressoesNoTop3` sobre consulta×página), então as duas telas
  // publicam o mesmo número por construção — a trava que o cabeçalho deste arquivo declara contra
  // "duas telas discordando" (033). Custa UMA requisição por host, e as duas leituras já carregadas
  // não serviriam — medido na Atma em 20/09/2026, mesma janela: a dimensão `query` sozinha dá
  // 22,5% (uma posição média por termo, misturando as páginas em que ele ranqueia) e a dimensão
  // `page` dá 0,1% (a campeã tem 21.500 impressões numa média de 7,3, e nenhuma delas acontece em
  // 7,3). A leitura por consulta×página é a de grão mais fino que o Search Console entrega, e é
  // a que 032/D9 já tinha escolhido para esta medida na outra tela.
  const impNode = acharNo(dados.nodeData as No, "impressoesTop3");
  if (impNode) {
    const consultasGsc = atma ? await gscConsultas(hosts, janela) : null;
    const lidas = consultasGsc && !("erro" in consultasGsc) ? consultasGsc.linhas : null;
    const medida = lidas ? impressoesNoTop3(lidas) : null;
    const noTop3 = (lidas ?? []).filter((l) => l.posicao >= 1 && l.posicao < 4);
    const soma = (ls: { impressoes: number }[]) => ls.reduce((a, l) => a + l.impressoes, 0);
    // ⚠️ `l.query` e nunca `l.termo`: esta leitura é a de consulta×página, e o campo da outra
    // compilaria removendo ZERO — o defeito que a 035 achou na guarda de marca do striking.
    const impMarca = medida && !decl.motivo ? soma(noTop3.filter((l) => new RegExp(decl.padrao, "i").test(l.query))) : null;
    // A URL que mais sustenta o numerador. `page` é a URL já assinada pelo host de `url` na mescla,
    // e o caminho é o que cabe num nó — o host inteiro repetiria o que o cabeçalho já declara.
    const porUrl = new Map<string, number>();
    for (const l of noTop3) porUrl.set(l.page, (porUrl.get(l.page) ?? 0) + l.impressoes);
    const campea = [...porUrl].sort((a, b) => b[1] - a[1])[0] ?? null;
    // A MESMA leitura por página que as seis faixas consomem — zero requisição nova para provar
    // por que a dimensão de base completa não é a escolhida.
    const paginas = paginasGsc && !("erro" in paginasGsc) ? paginasGsc.paginas : null;
    const porPaginaTop3 = paginas ? impressoesNoTop3(paginas) : null;
    // Os QUATRO estados, da causa mais específica para a mais genérica, e nenhum dos três de
    // ausência publica `0%`: sobre ausência, "0% no Top 3" é a reprovação mais grave que esta folha
    // sabe emitir, e seria fabricada. Zero MEDIDO cai no quarto e mostra `0%` — é o que os separa.
    const filho: No = !consultasGsc
      ? {
          id: "impressoesTop3-medido",
          topic: "∅ não apurado · sem leitura do Search Console",
          note: `${motivoDeAusencia({ ligado: gscLigado(), hosts })}. Sem a leitura não há denominador, e uma fração precisa dos dois lados.`,
        }
      : "erro" in consultasGsc
        ? {
            id: "impressoesTop3-medido",
            topic: "∅ não apurado · a leitura do Search Console falhou",
            note: `Falha transitória, não ausência de dado: ${consultasGsc.erro}. A medida volta na próxima leitura.`,
          }
        : medida === null
          ? {
              id: "impressoesTop3-medido",
              topic: "∅ não apurado · nenhuma impressão na janela",
              note: `A janela ${janela.inicio} → ${janela.fim} não teve uma impressão sequer: o denominador é zero. Não é "nada no Top 3" — é nada em lugar nenhum, e os dois pedem trabalho oposto.`,
            }
          : {
              id: "impressoesTop3-medido",
              topic: topicDasImpressoes(medida),
              note: noteDasImpressoes(
                medida,
                janela,
                porPaginaTop3 ? { base: totalImpressoes(paginas!), fracao: porPaginaTop3.fracao } : null,
                impMarca === null ? null : { noTop3: impMarca, semMarca: (medida.noTop3 - impMarca) / medida.total },
                campea ? { caminho: new URL(campea[0]).pathname, fracao: campea[1] / medida.noTop3 } : null,
              ),
            };
    // À FRENTE da definição e da meta, pelo mesmo motivo das três folhas vizinhas: quem expande está
    // procurando o número, e confere a definição do board DEPOIS de achá-lo.
    impNode.children = [filho, ...(impNode.children ?? [])];
  }

  // 038/CTR — o Índice de Conformidade na folha que o define. ZERO requisição nova: consome
  // `paginasGsc`, a MESMA leitura por página que as seis faixas já carregaram acima, e a MESMA
  // função (`conformidadeDeCtr`) que /okr/[slug]/aquisicao consome — as duas telas concordam por
  // construção, inclusive na TROCA DE FORMA do limiar, que é onde elas discordariam primeiro.
  //
  // A dimensão é decisão da 032 e não preferência: esta medida afirma algo sobre uma URL, e
  // `conformidadeDeCtr` só aceita `LinhaPagina` — passar as linhas de consulta×página não compila.
  const gapNode = acharNo(dados.nodeData as No, "ctrGap");
  if (gapNode) {
    const paginasDoGap = paginasGsc && !("erro" in paginasGsc) ? paginasGsc.paginas : null;
    // Os QUATRO estados, do mais específico ao mais genérico. Nenhum dos três de ausência publica
    // `0%`: sobre ausência, "0% das URLs atingem o CTR mínimo" é a reprovação mais grave que esta
    // folha sabe emitir, e é exatamente o falso negativo que a 032 tirou do ar. O quinto estado —
    // lido, com régua, e a amostra não decide nenhuma — tem `◐` e vive dentro de `topicDaConformidade`.
    const filho: No = !paginasGsc
      ? {
          id: "ctrGap-medido",
          topic: "∅ não apurado · sem leitura do Search Console",
          note: `${motivoDeAusencia({ ligado: gscLigado(), hosts })}. Sem a leitura não há URL para julgar contra a régua da posição.`,
        }
      : "erro" in paginasGsc
        ? {
            id: "ctrGap-medido",
            topic: "∅ não apurado · a leitura do Search Console falhou",
            note: `Falha transitória, não ausência de dado: ${paginasGsc.erro}. A medida volta na próxima leitura.`,
          }
        : paginasDoGap!.length === 0
          ? {
              id: "ctrGap-medido",
              topic: "∅ não apurado · nenhuma impressão na janela",
              note: `A janela ${janela.inicio} → ${janela.fim} não teve uma impressão sequer: não há URL para avaliar. Não é "nenhuma URL atinge a régua" — é nenhuma URL, e os dois pedem trabalho oposto.`,
            }
          : (() => {
              const c = conformidadeDeCtr(paginasDoGap!, janela);
              return {
                id: "ctrGap-medido",
                topic: topicDaConformidade(c),
                note: noteDaConformidade(c, janela, paginasDoGap!.length),
              };
            })();
    // À FRENTE da definição e da meta, pelo mesmo motivo das quatro folhas vizinhas.
    gapNode.children = [filho, ...(gapNode.children ?? [])];
  }

  // 037 — quantas folhas carregam leitura própria, COMPUTADO como todo número desta tela: a frase
  // do cabeçalho dizia "as seis faixas" quando elas eram a única coisa medida aqui, e ficou estreita
  // quando a 034, a 035, a 036 e esta penduraram uma leitura em quatro folhas. Escrever "quatro"
  // ali seria a constante acoplada ao tamanho de uma lista que o comentário abaixo proíbe.
  const medidos = (n: No): number => (n.id.endsWith("-medido") ? 1 : 0) + (n.children ?? []).reduce((s, f) => s + medidos(f), 0);
  const folhasMedidas = medidos(dados.nodeData as No);

  const nos =(n: No): number => 1 + (n.children ?? []).reduce((s, f) => s + nos(f), 0);
  const total = nos(dados.nodeData as No);

  // TODO número desta tela é COMPUTADO, e a regra nasceu de um erro publicado: a primeira versão
  // escreveu "7", "25" e "5 níveis" como texto corrido. Os 5 níveis eram 6 — 7 nós viviam no nível
  // que a tela dizia não existir, e a medida nunca tinha sido feita, foi estimada e propagada de
  // `.info/log.json`. Os 7/25 sobreviveriam intactos a mudar o balizador de uma folha, porque os
  // testes comparam LISTA contra LISTA e nunca contra a constante. Constante acoplada ao tamanho de
  // uma lista é armadilha: a lista muda, a constante fica, e a tela mente sem nenhum teste ficar
  // vermelho.
  const niveis = (n: No, d = 1): number => Math.max(d, ...(n.children ?? []).map((f) => niveis(f, d + 1)));
  const fundo = niveis(dados.nodeData as No);

  const chaves = Object.keys(cat);
  const comRegua = chaves.filter((k) => reguaDe(k).tem);
  // Régua ESCALAR × régua TABELADA: `ctrPorPosicao` e `ctrGap` são julgadas por uma tabela por faixa
  // de posição, não por um número, e o selo `◆` as igualava às outras cinco sem dizer isso.
  const escalar = comRegua.filter((k) => reguaDe(k).meta !== null);
  // Sem coletor ≠ sem faixa publicada, e os dois pedem trabalho OPOSTO: um é ligar a fonte, o outro
  // é aceitar que ninguém publica a régua. A frase antiga dizia "o número existe" para as 25 — e era
  // falsa para as que nenhum coletor mede.
  const semColetor = chaves.filter((k) => !medidoPor[k]);

  // A lista é gerada do MESMO `mapaDoBoard()` que alimenta o mapa. Uma segunda travessia escrita à
  // mão divergiria do desenho na primeira folha nova — e divergiria calada, porque o portador
  // acessível é justamente o que ninguém olha ao mudar o outro.
  const lista = (n: No, nivel: number) => (
    <li key={n.id}>
      <span className={`mb-n mb-n${Math.min(nivel, 3)}`}>{n.topic}</span>
      {n.tags?.map((t) => (
        <span className="mb-tag" key={t}>
          {t}
        </span>
      ))}
      {n.note ? <span className="mb-nota">{n.note}</span> : null}
      {n.children?.length ? <ul>{n.children.map((f) => lista(f, nivel + 1))}</ul> : null}
    </li>
  );

  return (
    <main className="page">
      <Tabs active="gsc" />

      <section className="card ag-section" data-info="gsc">
        <p className="eyebrow">Referência · board de GSC · mapa completo</p>
        <h1 className="ficha-nome">O board do Whimsical inteiro, e o que cada KPI quer dizer</h1>
        <p className="foot">
          As <strong>{Object.keys(cat).length} folhas</strong> do board com os níveis que a{" "}
          <a href="/gsc">árvore de procedência</a> não desenha: o título numerado, a família dentro do
          ramo e a definição — <em>o que mede</em>, <em>fórmula</em>, <em>meta recomendada</em>.{" "}
          <strong>{total} nós</strong> ao todo, em {fundo} níveis. Levantado do board{" "}
          <code>okr-Saw2eoSKZDPLJAk6xeDBuS</code> em <strong>19/09/2026</strong>.
        </p>
        <p className="foot">
          <strong>A meta do board não é régua.</strong> Ela está aqui porque é o que o board diz, não
          porque tem fonte: <span className="arv-k">◆</span> marca as {comRegua.length} folhas com
          limiar declarado — {escalar.length} com um número, {comRegua.length - escalar.length} com a
          tabela de CTR por faixa de posição —, <span className="arv-k">◇</span> as{" "}
          {chaves.length - comRegua.length} em que o hub não publica faixa nenhuma. Dessas,{" "}
          <strong>{semColetor.length} não têm coletor</strong>: ali o número não existe, e o trabalho
          é ligar a fonte, não procurar estudo. O motivo de cada ausência aparece no painel ao clicar
          no nó, e o placar fechado está na <a href="/gsc">árvore</a>.
        </p>
        <p className="foot">
          {/* 033/T042 — qual projeto está medindo, por escrito: o board é o da Atma, não do
              portfólio, e as seis faixas de "Posição no Google" (abaixo) medem os hosts dela. */}
          <strong>O que esta tela mede é a Atma</strong> — {atma ? hostsDeclarados(atma).join(" + ") : "projeto não encontrado"},
          janela {janela.inicio} → {janela.fim} (28 dias, fecha em D-3): as seis faixas de{" "}
          &ldquo;Posição no Google&rdquo; e as <strong>{folhasMedidas} folhas com leitura própria</strong>,
          que abrem com o número antes da definição do board. O board{" "}
          <code>okr-Saw2eoSKZDPLJAk6xeDBuS</code> é o board dela, não do portfólio.{" "}
          {notaAusencia ? <strong>{notaAusencia.charAt(0).toUpperCase() + notaAusencia.slice(1)}.</strong> : null}
        </p>
        <p className="foot">
          <strong>Onde o board e o código discordam, o nó diz.</strong> A transcrição não é corrigida
          — o board é o que o board diz —, mas o nó divergente carrega a etiqueta{" "}
          <span className="mb-tag">⚠</span> com o número que o hub usa para julgar, e o painel explica
          qual dos dois tem fonte. São {Object.keys(DIVERGENCIAS).length}:{" "}
          {Object.keys(DIVERGENCIAS)
            .map((k) => cat[k].nome)
            .join(" · ")}
          .
        </p>

        <Mapa dados={dados} />
      </section>

      {/* ── O SEGUNDO PORTADOR ────────────────────────────────────────────────────────────────
          O mapa é `role="application"` e vive de clique e roda de mouse. A mesma árvore em lista
          aninhada responde sem JavaScript, na impressão, na busca da página (Ctrl+F acha a prosa
          que no mapa está atrás de uma seleção) e no leitor de tela, que lê `ul` aninhada como
          hierarquia. Não é duplicação — é a mesma informação num portador que o mapa não cobre. */}
      <section className="card ag-section" data-info="gsc">
        <p className="eyebrow">O mesmo board em lista</p>
        <h2 className="ficha-nome">Sem JavaScript, e com a prosa toda aberta</h2>
        <p className="foot">
          Tudo o que o mapa mostra atrás de um clique está aqui em texto corrido — inclusive as notas,
          que no mapa só aparecem no painel. É esta versão que a impressão e o <kbd>Ctrl</kbd>+
          <kbd>F</kbd> alcançam.
        </p>
        {/* `tabIndex={-1}` para o alvo receber o foco de fato — sem ele o navegador rola até a
            âncora e deixa o foco no link dentro do mapa, e o próximo Tab volta para os expansores. */}
        <ol className="mapa-board" id="board-lista" tabIndex={-1}>
          {(dados.nodeData as No).children?.map((r) => lista(r, 0))}
        </ol>
      </section>

      <section className="card ag-section" data-info="gsc">
        <p className="eyebrow">Procedência</p>
        <h2 className="ficha-nome">De onde estes nós vieram</h2>
        <p className="foot">
          O board vive em <code>whimsical.com/v-rtice3/okr-Saw2eoSKZDPLJAk6xeDBuS</code> e não tem API
          de leitura — o conteúdo foi transcrito do render completo em 19/09/2026 e mora em{" "}
          <code>lib/board-gsc.mjs</code>, com as chaves presas às do <code>CATALOGO</code>. Um teste
          reprova nos dois sentidos: chave daqui que não existe no catálogo, e folha do catálogo sem
          detalhe aqui. É a trava que faltava — o board foi reconstruído do zero três vezes porque
          cada tentativa escrevia a própria lista de KPIs, e listas divergem em silêncio.
        </p>
        <ul className="lts">
          {RAMOS.map((r) => {
            const n = Object.keys(cat).filter((k) => cat[k].ramo === r.id).length;
            return (
              <li className="lt" key={r.id}>
                <span className="lt-v" style={{ color: r.cor }}>
                  {n}
                </span>
                <span className="lt-r">
                  KPIs em <strong>{r.nome}</strong>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="foot">
          Divergência conhecida e mantida: o board tem <strong>um</strong> nó para "Taxa de
          Integridade do Título" com três metas dentro; o catálogo tem <strong>três</strong> folhas,
          porque as três têm procedência diferente — a largura em pixels tem fonte, a taxa de
          reescrita e a posição do termo não têm. O mapa mostra as duas coisas: o grupo do board e as
          três folhas com o losango de cada uma. O caminho do grupo está em{" "}
          <code>lib/board-gsc.mjs#GRUPOS</code>.
        </p>
      </section>
    </main>
  );
}
