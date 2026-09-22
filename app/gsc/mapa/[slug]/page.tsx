import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATALOGO, CLASSES, MEDIDO_POR, filaDoMapa, regua } from "@/lib/gsc-delta.mjs";
import { dadosDaFicha } from "@/lib/ficha-dados";
import { DIVERGENCIAS, GRUPO_DO_TITULO, mapaDoBoard, RAMOS } from "@/lib/board-gsc.mjs";
import { projetosDeBusca } from "@/lib/projects";
import { cadeiaLigada } from "@/lib/okr.mjs";
import { hostsDeclarados } from "@/lib/projects.mjs";
import { gscConsultas, gscLigado, gscPaginas, gscTermos } from "@/lib/gsc";
import { lerInventario } from "@/lib/inventario.mjs";
import INVENTARIOS from "@/data/inventario-de-termos.json";
import DEMANDAS from "@/data/demanda-estimada.json";
import { canibalizacao, canibalizacaoPorPagina, coberturaDaDemanda, conformidadeDeCtr, consultasUnicas, impressoesNoTop3, LIMIAR_PAGINAS_DECIDIDAS, noTop20, penetracaoNoInventario, penetracaoNoTop3, porFaixaDePosicao, queryToPageRatio, activeIndexRatio, strikingDistancePorTermo, termoPrincipal, totalImpressoes, urlsComImpressao } from "@/lib/kpis-busca.mjs";
import { motivoDeAusencia } from "@/lib/gsc-hosts.mjs";
import { modificadoresDeIntencao, posicaoDoTermo } from "@/lib/pagina.mjs";
import { marcaDeclarada, crescimentoNaoMarca, linhaDeCrescimento, mesesFechados, razaoDeMarca, variacao, ritmoDoSegmentoAtual } from "@/lib/marca.mjs";
import { descoberta, descobertaLonga } from "@/lib/janelas.mjs";
import { dbOn, lerCrawlDePagina, lerDiasGsc, lerIndexacao, type Apuracao, type DiaSeparado, type PaginaCrawl } from "@/lib/db";
import { cadencia, cadenciaDe, CADENCIA_POR_INTENCAO, canonizar, correspondenciaDeIntencao, densidadeContextual, LINKS_POR_MIL_MAX, LINKS_POR_MIL_MIN, taxaAlinhamento, taxaCobertura, taxaIntegridadeDoTitulo, taxaLarguraDoTitulo, TERMO_ATE, TITULO_PX_MAX, TITULO_PX_MIN } from "@/lib/grafo.mjs";
import { coberturaRich, taxasDeIndexacao, tiposDoBoard } from "@/lib/indexacao-corrida.mjs";
import { CAP_URLS_PASS_RATE, formatarValor, rodape, SLUGS_DE_CAMPO, VITAIS, vitalPorOrigem } from "@/lib/crux.mjs";
import { lerOrigens, lerPassRate } from "@/lib/crux";

import { Tabs } from "../../../tabs";
import { CadeiaDiagrama } from "../../../okr/[slug]/celulas";
import { Mapa } from "../mapa";

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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const projetosComMapa = await projetosDeBusca();
  const p = projetosComMapa.find((x) => x.slug === slug);
  const nomeCurto = p?.nome.split(" — ")[0] ?? slug;
  return { title: `Board GSC — ${nomeCurto}` };
}

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

/** 040 — o mesmo, por `topic`. Os GRUPOS do board não têm id literal: `mapaDoBoard()` gera o deles
 *  por hash do caminho (`board-gsc.mjs#id`), e hash não é chave de busca — o nome do grupo é o
 *  MESMO literal que `GRUPOS` e `NOTA_DO_GRUPO` já declaram, e muda com eles ou não muda. */
function acharPorTopico(n: No, topic: string): No | null {
  if (n.topic === topic) return n;
  for (const f of n.children ?? []) {
    const achado = acharPorTopico(f, topic);
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

// ── 051/US3 — a apresentação da fila. A regra (quem entra, em que moeda, em que ordem) mora em
// `lib/gsc-delta.mjs#filaDoMapa`; aqui só se escreve.
type ItemDaFila = {
  chave: string;
  alvo: string | null;
  delta: number;
  base: number | null;
  detalhe: { ctr?: number; regua?: number; posicao?: number; acima?: number; avaliadas?: number; limite?: number };
};

const ROTULO_DA_MOEDA: Record<string, string> = {
  cliques: "Cliques que faltam, por página",
  pp: "Pontos percentuais fora da régua",
  ms: "Milissegundos acima do limite",
  cls: "CLS acima do limite",
};

const dec = (v: number, casas: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** O número do item, na unidade da moeda. `Math.round` nos cliques, como /okr/atma/aquisicao, para
 *  as duas telas publicarem o MESMO "faltam N cliques" sobre a mesma conta. */
function valorDaFila(moeda: string, it: ItemDaFila): string {
  if (moeda === "cliques") return `faltam ${br(Math.round(it.delta))} cliques`;
  if (moeda === "pp") return `${dec(it.delta, 1)} pp`;
  if (moeda === "ms") return `+${br(Math.round(it.delta))} ms`;
  return `+${dec(it.delta, 2)}`;
}

function detalheDaFila(moeda: string, it: ItemDaFila): string {
  const d = it.detalhe;
  // G8 — o CTR leva o denominador: "0%" sobre 12 impressões e sobre 20 mil são achados diferentes.
  if (moeda === "cliques" && d.ctr !== undefined && d.regua !== undefined && d.posicao !== undefined)
    return `CTR ${pct1(d.ctr)} sobre ${it.base !== null ? br(it.base) : "?"} impressões, contra a régua de ${pct1(d.regua)} na posição ${dec(d.posicao, 1)}`;
  if (moeda === "pp" && d.acima !== undefined && d.avaliadas !== undefined) return `${br(d.acima)} de ${br(d.avaliadas)} títulos acima de 580px`;
  return d.limite !== undefined ? `limite ${br(d.limite)}` : "";
}

const nomesDas = (chaves: string[]) => chaves.map((k) => (CATALOGO as Record<string, { nome: string }>)[k].nome).join(", ");

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
      ? `O card deste projeto não declara \`marca\` (${decl.motivo}). Sem a lista de termos o hub não sabe quais consultas são busca pelo NOME, e a separação marca/não-marca não existe — o que não é o mesmo que zero. Declara-se em \`data/projects.json\`, campo \`marca\` (\`termos\` + \`pais\`).`
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
  const janela = `A razão compara MESES FECHADOS (${m.de} e ${m.para}) da série que o hub grava deste projeto — não os 28 dias que o cabeçalho da página declara para as seis faixas de posição. O mês corrente nunca entra: o Search Console ainda sobe a ponta (30/07 saiu com 30 impressões e fechou em 827).`;
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
function noteDaConformidade(c: MedidaConformidade, janela: { inicio: string; fim: string }, lidas: number, slug: string): string {
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
      ? ` Por isso o nó não abre pelo índice: com menos de ${br(LIMIAR_PAGINAS_DECIDIDAS)} decididas ele é ruído com casa decimal, e a resposta é a URL de maior impressão entre as decididas — a MESMA regra e a MESMA função de /okr/${slug}/aquisicao, que publica esta frase inteira.`
      : ` As ${br(c.porPagina.decididas)} decididas passam do limiar de ${br(LIMIAR_PAGINAS_DECIDIDAS)}, e o índice é a resposta — a mesma troca de forma que /okr/${slug}/aquisicao faz sobre esta leitura.`;
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

/** A cobertura de dados estruturados, na forma que o board pergunta.
 *
 *  O nome do TIPO entra no topic e não só no note, e isso é o que separa esta folha de um "94,4%
 *  quase na meta": a meta do board é 100% com Product, Article, FAQPage ou SoftwareApplication, e
 *  na Atma o que o Google reconhece é trilha de navegação. A fração sozinha responde "quantas
 *  páginas têm ALGUM resultado enriquecido" — que não é a pergunta da folha. Mesma lição da 038,
 *  onde o número certo respondia "qual página" a quem perguntava "quantas". */
function topicDoSchema(a: Apuracao, cob: { julgadas: number | null; fracao: number | null }): string {
  const tipos = Object.entries(a.richTipos ?? {}).sort((x, y) => y[1] - x[1]);
  const doBoard = tiposDoBoard(a.richTipos);
  const quais = !tipos.length
    ? "tipo nenhum"
    : doBoard.length
      ? tipos.map(([t, n]) => `${t} ${br(n)}`).join(" · ")
      : `nenhum tipo do board · só ${tipos.map(([t]) => t).join(" e ")}`;
  const erros = a.richErro ? `${br(a.richErro)} com erro crítico` : "0 erro crítico";
  return `Medido: ${pct1(cob.fracao!)} · ${br(a.richCom!)} de ${br(cob.julgadas!)} URLs no índice · ${erros} · ${quais}`;
}

/** A nota do Schema. Ordem: a fração com a data, o DENOMINADOR (que é a pergunta que a fração
 *  provoca), o que o Google de fato reconhece, a leitura por sintaxe que diz o contrário, e a meta
 *  do board com o tipo que falta. */
function noteDoSchema(
  a: Apuracao,
  cob: { julgadas: number | null; fracao: number | null },
  sintaxe: ReturnType<typeof taxaCobertura>,
  diaDoCrawl: string | null,
): string {
  const fracao = `${pct1(cob.fracao!)} das URLs que o Google tem no índice servem pelo menos um resultado enriquecido — ${br(a.richCom!)} de ${br(cob.julgadas!)}, apuração de ${a.dia}, propriedade ${a.propriedade ?? "—"}.`;
  // Sem esta frase a fração lê como se o site tivesse `julgadas` páginas, e a leitura seguinte
  // seria "o denominador está errado" em vez de "metade do sitemap está fora do índice".
  const denominador = ` O denominador é ${br(cob.julgadas!)} e não ${br(a.inspecionadas)}: ${br(a.richSemRelatorio ?? 0)} das URLs declaradas no sitemap estão fora do índice, e para elas o Google não publica relatório nenhum. Elas não entram como falha de schema — "o Google não leu a página" e "o schema não é elegível" pedem trabalho oposto, e somá-los mandaria reescrever markup que ninguém provou estar errado.`;
  const semNada = a.richNenhum ? ` ${br(a.richNenhum)} ${a.richNenhum === 1 ? "URL está no índice e não serve resultado enriquecido nenhum" : "URLs estão no índice e não servem resultado enriquecido nenhum"} — esse é zero MEDIDO, e entra no denominador.` : "";
  const tipos = Object.entries(a.richTipos ?? {}).sort((x, y) => y[1] - x[1]);
  const doBoard = tiposDoBoard(a.richTipos);
  const oQue = tipos.length
    ? ` O que o Search Console reconhece, por URL: ${tipos.map(([t, n]) => `${t} em ${br(n)}`).join(", ")}.`
    : " O Search Console não reconheceu tipo nenhum nas URLs indexadas.";
  // A frase que impede a fração de ser lida como "quase na meta".
  const falta = doBoard.length
    ? ` Desses, ${doBoard.join(" e ")} ${doBoard.length === 1 ? "é o tipo" : "são os tipos"} que a meta do board nomeia.`
    : " NENHUM deles é um dos quatro que a meta do board nomeia (Product, Article, FAQPage ou SoftwareApplication): a fração acima mede cobertura de resultado enriquecido, não cobertura DO tipo pedido, e contra a meta do board a leitura é 0.";
  // A outra metade da definição, medida por outro instrumento — e é ela que estava no lugar deste
  // número antes da 039.
  const porSintaxe = sintaxe
    ? ` Pela SINTAXE a mesma folha dá ${pct1(sintaxe.fracao)} (${br(sintaxe.validas)} de ${br(sintaxe.avaliadas)} páginas com JSON-LD que o parser aceita, crawl de ${diaDoCrawl ?? "—"}, \`lib/grafo.mjs#taxaCobertura\`): "válido e sem erro de sintaxe" é a primeira metade da definição do board, "elegível a rich snippet" é a segunda, e as duas divergem inteiras. O 100% também não distingue página a página — é o MESMO bloco JSON-LD global servido em toda rota, ressalva medida na 024.`
    : "";
  return `${fracao}${denominador}${semNada}${oQue}${falta}${porSintaxe} Meta do board: 100% de cobertura e 0 erro crítico — norma, não régua: válido ou inválido é binário, e binário não tem média de mercado para comparar.`;
}

/** O caminho de uma URL, que é o que cabe num nó — o host inteiro repete o que o cabeçalho diz. */
const caminhoDe = (u: string) => new URL(u).pathname;

/** 040 — a largura, cuja meta é a única das três do grupo que tem faixa publicada. O `topic` abre
 *  pela fração e fecha pelos DOIS jeitos de sair da faixa, porque é neles que está o trabalho. */
function noteDaLargura(l: NonNullable<ReturnType<typeof taxaLarguraDoTitulo>>, dia: string): string {
  const fracao = `${pct1(l.fracao)} dos títulos caem entre ${TITULO_PX_MIN}px e ${TITULO_PX_MAX}px — ${br(l.avaliadas - l.estreitos.length - l.largos.length)} de ${br(l.avaliadas)} páginas com título, corrida de ${dia}.`;
  const maisLargo = [...l.largos].sort((a, b) => (b.tituloPx ?? 0) - (a.tituloPx ?? 0))[0] ?? null;
  const quebra = ` ${br(l.largos.length)} ${l.largos.length === 1 ? "passa" : "passam"} de ${TITULO_PX_MAX}px e ${l.largos.length === 1 ? "corre" : "correm"} risco de corte na SERP; ${br(l.estreitos.length)} ${l.estreitos.length === 1 ? "fica" : "ficam"} abaixo de ${TITULO_PX_MIN}px e ${l.estreitos.length === 1 ? "desperdiça" : "desperdiçam"} pixel que o Google daria de graça. Os dois reprovam a mesma meta e pedem trabalho oposto — encurtar × completar.`;
  const campeao = maisLargo ? ` O mais largo é ${caminhoDe(maisLargo.url)}, com ${br(maisLargo.tituloPx!)}px.` : "";
  // FR-005/SC-004 da 024: o método viaja com o número. Um pixel solto é indistinguível de uma
  // medição, e vai ser lido como uma.
  const metodo = ` O pixel é ESTIMADO, nunca medido: tabela de larguras da Arial 20px (\`lib/pagina.mjs\`, método \`${l.estreitos[0]?.tituloMetodo ?? l.largos[0]?.tituloMetodo ?? "arial-20px-tabela"}\`) — a SERP real usa a fonte do Google e varia por dispositivo.`;
  const semLargura = l.semLargura ? ` ${br(l.semLargura)} página com título e sem largura gravada ficou fora do denominador: largura nula é medida ausente, nunca título fora da faixa.` : "";
  return `${fracao}${quebra}${campeao}${metodo}${semLargura} Meta do board: 100%. A faixa tem régua, e é a única das três metas deste grupo que tem — mas ${TITULO_PX_MAX}px é a zona segura abaixo do corte, não o número do estudo linkado, que diz 600px.`;
}

/** 040 — o termo no título. O `topic` nomeia os AUSENTES e não só a fração: "0% no começo do
 *  título" manda mover uma palavra que, em todas as reprovadas, não está lá. */
function noteDoTermo(
  t: { passam: number; base: number; ausentes: number },
  semTermo: number,
  visitadas: number,
  janela: { inicio: string; fim: string },
  dia: string,
  hosts: string[],
): string {
  const fracao = `${pct1(t.passam / t.base)} das URLs trazem o termo principal nos primeiros ${TERMO_ATE} caracteres do título — ${br(t.passam)} de ${br(t.base)}, títulos da corrida de ${dia} contra a janela ${janela.inicio} → ${janela.fim}.`;
  const ausentes = t.ausentes
    ? ` Em ${br(t.ausentes)} ${t.ausentes === 1 ? "delas o termo não aparece" : "delas o termo não aparece"} no título de jeito nenhum — isso não é "longe do começo", e o conserto não é mover a palavra para a frente.`
    : "";
  // O que o denominador exclui, e por quê. Sem esta frase a fração lê como se o site tivesse
  // `base` páginas.
  const fora = ` O denominador é ${br(t.base)} e não ${br(visitadas)}: ${br(semTermo)} URLs da corrida não têm consulta com impressão na janela, e "o Search Console ainda não vê essa página" nunca pode virar "o título está errado".`;
  const termo = ` Termo principal = a consulta de MAIOR impressão daquela URL na janela (\`lib/kpis-busca.mjs#termoPrincipal\`), lida da dimensão consulta×página; ele vem da LEITURA e muda toda semana, por isso não é gravado na corrida.`;
  const operador = ` A busca é por FRASE INTEIRA, ignorando acento e caixa (\`lib/pagina.mjs#posicaoDoTermo\`): um título com todas as palavras do termo em outra ordem conta como ausente.`;
  // A ressalva que só existe em projeto que trocou de domínio, e na Atma ela decide o número: a
  // leitura soma os hosts por CAMINHO (030) e a corrida visita SÓ o host atual, então o termo pode
  // ser o que a página do domínio ANTERIOR ranqueava, cobrado do título que o domínio atual serve
  // hoje. Um termo de marca antiga não tem como estar num título que já mudou de marca.
  const migracao =
    hosts.length > 1
      ? ` A leitura soma ${hosts.join(" + ")} por caminho, e a corrida visita só ${hosts[0]}: onde a impressão ainda acontece no domínio anterior, o termo principal é o que a página DELE ranqueava, comparado com o título que ${hosts[0]} serve hoje.`
      : "";
  return `${fracao}${ausentes}${fora}${termo}${operador}${migracao} Meta do board: termo nos ${TERMO_ATE} primeiros caracteres — meta, não régua: nenhum estudo publica posição em caracteres, o de títulos mede correspondência com o H1.`;
}

/** 041 — o modificador no título. O `topic` publica a fração da função do hub E o denominador que
 *  sobra quando as URLs de título compartilhado saem: sem o segundo, a folha diz 54,3% sobre um
 *  site em que 13 dos 19 aprovados são o mesmo `<title>`. */
function noteDoAlinhamento(
  a: NonNullable<ReturnType<typeof taxaAlinhamento>>,
  ano: NonNullable<ReturnType<typeof contrafactualDoAno>>,
  dia: string,
  slug: string,
): string {
  const c = a.compartilhado;
  const passam = a.avaliadas - a.ausentes.length;
  const fracao = `${pct1(a.fracao)} dos títulos trazem um modificador de intenção explícito — ${br(passam)} de ${br(a.avaliadas)} páginas com título, corrida de ${dia}. É o número que \`lib/grafo.mjs#taxaAlinhamento\` devolve e o que /okr/${slug}/aquisicao publica na mesma janela.`;
  // O achado, e ele precisa vir ANTES de qualquer conselho sobre título: a maioria dos aprovados
  // não tem título próprio para ter modificador próprio.
  const topo = c.titulos[0];
  const defeito = topo
    ? ` ${br(c.passam)} desses ${br(passam)} aprovados são a MESMA página do ponto de vista do título: ${br(topo.urls)} URLs servem o mesmo \`<title>\` — «${topo.titulo}» — e passam pela palavra que está no template, não numa decisão sobre cada página. Entre elas ${[...topo.paginas].sort((a: PaginaCrawl, b: PaginaCrawl) => caminhoDe(a.url).length - caminhoDe(b.url).length).slice(0, 4).map((p: PaginaCrawl) => caminhoDe(p.url)).join(", ")} — as mais rasas, que são as que mais recebem link interno —, conferidas no site em 21/09/2026 respondendo esse mesmo título: é defeito do site, não da corrida.`
    : "";
  const propria =
    c.fracaoPropria !== null
      ? ` Entre as ${br(c.proprias)} páginas com título PRÓPRIO a leitura é ${pct1(c.fracaoPropria)} (${br(c.passamProprias)} de ${br(c.proprias)}) — e são esses ${br(c.passamProprias)} títulos que alguém escreveu com intenção.`
      : "";
  // A régua do modificador comercial inclui o ano VIGENTE, e é a única parte dela que apodrece
  // sozinha. O contrafactual é CALCULADO pela própria função, nunca escrito: um número de ano no
  // texto vira mentira na virada de janeiro, que é o defeito que o parâmetro `ano` existe para
  // impedir a duas linhas daqui.
  const anoTxt = ano.soPeloAnterior
    ? ` A lista de modificadores inclui o ANO VIGENTE (\`lib/pagina.mjs#modificadoresDeIntencao\`, ano por parâmetro para não apodrecer em janeiro): ${br(ano.comAnterior)} ${ano.comAnterior === 1 ? "título carimba" : "títulos carimbam"} ${ano.anterior} e ${br(ano.comVigente)} ${ano.comVigente === 1 ? "carimba" : "carimbam"} ${ano.vigente}, então a MESMA corrida daria ${pct1(ano.fracaoAnterior)} se o vigente ainda fosse ${ano.anterior}. ${br(ano.soPeloAnterior)} ${ano.soPeloAnterior === 1 ? "página passaria" : "páginas passariam"} só por isso — o conteúdo está datado no ano passado, e esse trabalho a fração não nomeia.`
    : "";
  return `${fracao}${defeito}${propria}${anoTxt} Meta do board: 100% das páginas-chave — norma, não régua: tem ou não tem o modificador, e binário não tem faixa de mercado para comparar.`;
}

/**
 * 041 — o que a fração valeria se o ano vigente fosse o anterior, MEDIDO com a mesma função.
 *
 * Existe porque o modificador comercial do board inclui o ano corrente, e é a única régua da folha
 * que muda de valor sem ninguém tocar no site: em 01/01 toda página datada no ano que fechou
 * reprova de uma vez. O número aqui não é curiosidade — é o tamanho da dívida de conteúdo que a
 * fração publicada esconde. Ver [[numero_no_ar_muda_sem_ninguem_tocar_no_kpi]].
 */
function contrafactualDoAno(paginas: PaginaCrawl[], vigente: number) {
  const base = paginas.filter((p) => !p.erro && p.titulo !== null);
  if (!base.length) return null;
  const anterior = vigente - 1;
  const recalc = base.map((p) => ({ ...p, intencao: modificadoresDeIntencao(p.titulo, anterior) }));
  const comAnterior = taxaAlinhamento(recalc);
  return {
    vigente,
    anterior,
    fracaoAnterior: comAnterior!.fracao,
    comVigente: base.filter((p) => p.titulo!.includes(String(vigente))).length,
    comAnterior: base.filter((p) => p.titulo!.includes(String(anterior))).length,
    // Quem passa SÓ por causa do ano: sem o ano no título, a mesma régua reprova.
    soPeloAnterior: base.filter(
      (p) =>
        modificadoresDeIntencao(p.titulo, anterior) !== "ausente" &&
        modificadoresDeIntencao(p.titulo!.replaceAll(String(anterior), ""), anterior) === "ausente",
    ).length,
  };
}

/** 041 — o MATCH, que é o que o nome da folha pede e `taxaAlinhamento` não mede. */
function noteDoMatch(
  m: NonNullable<ReturnType<typeof correspondenciaDeIntencao>>,
  termoDe: (url: string) => string | null,
  ehMarca: ((t: string) => boolean) | null,
  janela: { inicio: string; fim: string },
  dia: string,
  hosts: string[],
): string {
  const abre = `A folha se chama Search Intent MATCH e a definição do board é "a correspondência entre o modificador de intenção DA BUSCA e o gancho do título" — dois lados. ${br(m.avaliadas)} URLs têm os dois: título na corrida de ${dia} e consulta com impressão na janela ${janela.inicio} → ${janela.fim}.`;
  // Os termos saem do DADO. Escrevê-los no código faria a nota afirmar amanhã o que só é verdade
  // nesta janela, que é o defeito que [[numero_no_ar_muda_sem_ninguem_tocar_no_kpi]] registra.
  const exemplos = m.mudas
    .map((p: PaginaCrawl) => termoDe(p.url))
    .filter(Boolean)
    .slice(0, 3)
    .map((t: string | null) => `"${t}"`)
    .join(", ");
  const muda = m.buscaMuda
    ? ` Em ${br(m.buscaMuda)} ${m.buscaMuda === 1 ? "dela a consulta principal" : "delas a consulta principal"} NÃO traz modificador nenhum${exemplos ? ` (${exemplos})` : ""}, e busca muda não é título errado: não há intenção declarada contra a qual julgar o gancho.`
    : "";
  const resto =
    m.fracao !== null
      ? ` ${m.decididas === 1 ? "Sobra 1 par decidível" : `Sobram ${br(m.decididas)} pares decidíveis`}, ${m.casam === m.decididas ? (m.decididas === 1 ? "e ele casa" : "e todos casam") : `dos quais ${br(m.casam)} ${m.casam === 1 ? "casa" : "casam"}`}. Um percentual sobre ${br(m.decididas)} ${m.decididas === 1 ? "caso" : "casos"} seria ruído travestido de taxa — a 038 já recusou publicar índice abaixo de ${LIMIAR_PAGINAS_DECIDIDAS} URLs decididas na folha vizinha, e esta fica muito abaixo disso.`
      : " Nenhum par decidível: sem busca com modificador, não há correspondência para medir.";
  // A mesma ressalva da 040, e aqui ela é a causa do denominador de 10: o termo vem do domínio que
  // ainda concentra a impressão, e é cobrado do título que o domínio atual serve. Quantos são de
  // MARCA sai da declaração do card, nunca escrito: o termo muda toda semana.
  const deMarca = ehMarca
    ? m.mudas.map((p: PaginaCrawl) => termoDe(p.url)).filter((t: string | null) => t && ehMarca(t)).length
    : 0;
  const migracao =
    hosts.length > 1
      ? ` A leitura soma ${hosts.join(" + ")} por caminho e a corrida visita só ${hosts[0]}${deMarca ? `: ${br(deMarca)} ${deMarca === 1 ? "dos termos apurados é a MARCA" : "dos termos apurados são a MARCA"} declarada, que não carrega modificador de intenção por construção` : ""}.`
      : "";
  return `${abre}${muda}${resto}${migracao} Esta leitura entrou em 21/09/2026; antes dela a folha teria publicado só o lado do título.`;
}

/** 040 — a conjunção, que é o que o NOME do KPI pede e nenhuma das três metas sozinha responde. */
function noteDaIntegridade(
  i: NonNullable<ReturnType<typeof taxaIntegridadeDoTitulo>>,
  l: ReturnType<typeof taxaLarguraDoTitulo>,
  janela: { inicio: string; fim: string },
  dia: string,
  slug: string,
): string {
  const fracao = `${pct1(i.fracao)} das URLs passam nas DUAS metas medíveis ao mesmo tempo — ${br(Math.round(i.fracao * i.avaliadas))} de ${br(i.avaliadas)}, corrida de ${dia} contra a janela ${janela.inicio} → ${janela.fim}.`;
  // A frase que impede a conjunção de ser lida como a largura.
  const partes = l
    ? ` Separadas, as duas metas dão números muito diferentes: a largura passa em ${pct1(l.fracao)} sobre as ${br(l.avaliadas)} páginas com título, e o termo em ${pct1(i.termo.passam / i.termo.base)} sobre as ${br(i.termo.base)} com termo apurado. A conjunção fica no MENOR denominador dos dois, porque um título só pode passar nas duas onde as duas foram medidas.`
    : "";
  const doHub = ` A conjunção é do HUB, não do board: o board nomeia o KPI e lista três metas, sem dizer como combiná-las. \`lib/grafo.mjs#taxaIntegridadeDoTitulo\` combina as duas que algum coletor alcança, e é a mesma função que /okr/${slug}/aquisicao consome — as duas telas concordam por construção.`;
  const terceira = ` A terceira meta, a taxa de reescrita pelo Google, NÃO entra: nada no hub mede o título que o Google de fato exibiu (ver a folha ao lado).`;
  return `${fracao}${partes}${doHub}${terceira}`;
}

type Origens = Awaited<ReturnType<typeof lerOrigens>>;
const hostDe = (origem: string) => origem.replace(/^https:\/\//, "");
const ESTADO_DA_ORIGEM: Record<string, string> = {
  record: "responde",
  "sem-amostra": "sem amostra (404)",
  "sem-chave": "sem chave",
};
const estadosDasOrigens = (origens: Origens) =>
  origens
    .map(({ alvo, leitura }) => `${hostDe(alvo.valor)} ${leitura.estado === "falhou" ? `falhou (${leitura.erro})` : ESTADO_DA_ORIGEM[leitura.estado]}`)
    .join(" · ");
const diaUtc = (s: string) => Date.parse(`${s}T00:00:00Z`) / 86_400_000;

/**
 * 042 — o nó de leitura de um vital. Os estados vêm de `vitalPorOrigem()` e são CINCO, nenhum com
 * `0`: sem chave, falha, nenhuma origem com amostra, a origem responde sem ESTE vital (o INP da
 * Atma), e medido. O `topic` diz de QUAL domínio é o número sempre que não é o do card — é o que
 * impede "1,8 s" de ser lido como a velocidade de hoje de um domínio que a CrUX ainda não mede.
 */
function noDoVital(id: string, origens: Origens, anterior: { url: string; data: string } | null): No {
  const idNo = `${id}-medido`;
  const vital = VITAIS.find((v) => v.id === id)!;
  const nome = id.toUpperCase();
  const r = vitalPorOrigem(origens, id);
  const quais = `Origens perguntadas, na ordem do card: ${estadosDasOrigens(origens)}.`;
  if (r.estado === "sem-chave")
    return { id: idNo, topic: "∅ não apurado · CRUX_API_KEY ausente", note: "Sem a chave da CrUX API no ambiente nenhuma origem é perguntada. Não é site sem amostra — é leitura desligada." };
  if (r.estado === "falhou")
    return { id: idNo, topic: `∅ não apurado · a CrUX falhou agora (${r.erro})`, note: `Falha, não ausência de amostra: a leitura volta na próxima abertura da tela. ${quais}` };
  if (r.estado === "sem-amostra")
    return {
      id: idNo,
      topic: `∅ sem amostra de campo · ${origens.length === 1 ? "a origem não tem" : `nenhuma das ${origens.length} origens tem`} visita suficiente na CrUX`,
      note: `A CrUX responde 404 até a origem passar do limiar de tráfego dela. Não é site lento — é site não medido. ${quais}`,
    };
  if (r.estado === "parcial")
    return {
      id: idNo,
      topic: `∅ sem amostra de ${nome} · ${hostDe(r.alvo.valor)} tem os outros vitais, este não`,
      note: `A CrUX mede cada vital separadamente: a origem tem visita suficiente para os outros e não para o ${nome}${id === "inp" ? " (o INP só conta visita em que alguém clica ou digita, e o site tem pouca)" : ""}. Não é ${nome} ruim, é ${nome} não medido. ${quais}`,
    };

  const { medida, alvo } = r;
  const dentro = medida.veredito === "dentro";
  const veredito = `${dentro ? "✓ dentro" : "✗ fora"} da régua ≤ ${formatarValor(vital, vital.limite)}`;
  const ehAnterior = anterior !== null && hostDe(alvo.valor) === hostsDeclarados({ url: anterior.url })[0];
  const atual = origens[0];
  const doAnterior = ehAnterior
    ? ` · no domínio anterior — ${hostDe(atual.alvo.valor)} ${atual.leitura.estado === "sem-amostra" ? "ainda sem amostra" : atual.leitura.estado === "record" ? `sem ${nome}` : atual.leitura.estado === "falhou" ? "falhou agora" : "sem chave"}`
    : "";
  // A janela é da CrUX e atravessa a troca: dizer QUANTOS dias dela são do domínio antigo é o que
  // separa "o site de hoje" de "o site medido até a troca".
  let migracao = "";
  if (ehAnterior && medida.janela) {
    const total = diaUtc(medida.janela.fim) - diaUtc(medida.janela.inicio) + 1;
    const antes = Math.max(0, Math.min(total, diaUtc(anterior!.data) - diaUtc(medida.janela.inicio)));
    const fimDaUltima = new Date((diaUtc(anterior!.data) + total - 1) * 86_400_000).toISOString().slice(0, 10);
    migracao = ` Esta é a origem ANTERIOR: ${antes} dos ${total} dias da janela são de antes da troca de domínio de ${anterior!.data}, e depois dela o 301 leva a visita para ${hostDe(atual.alvo.valor)}. É o site medido até a troca, não o de hoje — e a leitura desta origem deixa de existir quando a janela passar inteira para depois da troca (a que fecha em ${fimDaUltima}), ou antes, se a amostra cair abaixo do limiar da CrUX.`;
  }
  return {
    id: idNo,
    topic: `Medido: ${formatarValor(vital, medida.p75)} · ${veredito}${doAnterior}`,
    note: `${rodape(medida, alvo)}.${migracao} ${quais}`,
  };
}

/**
 * 042 — o Pass Rate, com o MESMO `lerPassRate()` do bloco de `/okr/[slug]/aquisicao`. A folha tem
 * `balizador: recusa` ("agregação inventada"), então nenhum glifo de veredito aparece: o 90% do
 * board fica no nó da meta, abaixo, como o board escreveu — é a regra que a 034 fixou.
 */
function noDoPassRate(pass: Awaited<ReturnType<typeof lerPassRate>>, janela: { inicio: string; fim: string }, slug: string): No {
  const id = "urlsBoas-medido";
  if (!pass)
    return {
      id,
      topic: "∅ não apurado · sem leitura do Search Console para escolher as URLs",
      note: "As URLs prioritárias são as de maior impressão na janela, e sem a leitura por página não há lista a perguntar à CrUX.",
    };
  if ("erro" in pass) return { id, topic: `∅ não apurado · a CrUX falhou agora (${pass.erro})`, note: "Falha, não ausência de amostra: a fração volta na próxima abertura da tela." };
  const PALAVRA: Record<string, string> = { passa: "passam", reprova: "reprovam", parcial: "com dado parcial", "sem-amostra": "sem amostra", falhou: "falharam", "sem-chave": "sem chave", "nao-lida": "não lidas" };
  const conta = (chave: (u: { url: string; estado: string }) => string) => {
    const m = new Map<string, number>();
    for (const u of pass.porUrl) m.set(chave(u), (m.get(chave(u)) ?? 0) + 1);
    return m;
  };
  const porEstado = [...conta((u) => PALAVRA[u.estado] ?? u.estado)].map(([k, n]) => `${br(n)} ${k}`).join(", ");
  const porHost = [...conta((u) => { try { return new URL(u.url).hostname; } catch { return u.url; } })].map(([h, n]) => `${br(n)} em ${h}`).join(", ");
  const bom = VITAIS.filter((v) => !v.chaveCrux.startsWith("experimental_"))
    .map((v) => `${v.id.toUpperCase()} ≤ ${formatarValor(v, v.limite)}`)
    .join(", ");
  const amostra = `As ${br(pass.consultadas)} URLs de maior impressão na janela ${janela.inicio} → ${janela.fim} (${porHost})${pass.naoConsultadas > 0 ? `; ${br(pass.naoConsultadas)} não consultadas (teto de ${CAP_URLS_PASS_RATE}) — não reprovadas` : ""}. Por URL: ${porEstado}.`;
  const regra = ` "Bom" é ${bom} no p75 de campo; o TTFB fica fora. O board cita o relatório de Core Web Vitals do Search Console, que não tem API: a leitura aqui é a CrUX URL a URL, a fonte daquele relatório, e é o mesmo cálculo do bloco de Pass Rate de /okr/${slug}/aquisicao. A meta do board, no nó abaixo, é meta e não régua: "percentual de URLs aprovadas" não tem limiar publicado.`;
  if (pass.fracao === null)
    return {
      id,
      topic: `∅ não apurável · ${br(pass.comDado)} de ${br(pass.consultadas)} URLs prioritárias com os três vitais na CrUX`,
      note: `${pass.motivo} ${amostra}${regra}`,
    };
  return {
    id,
    topic: `Medido: ${pct1(pass.fracao)} · ${br(pass.passam)} de ${br(pass.comDado)} URLs com os três vitais em "Bom" · ${br(pass.consultadas)} consultadas`,
    note: `${amostra}${regra}`,
  };
}

export default async function MapaDoBoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const projetosComMapa = await projetosDeBusca();
  const p = projetosComMapa.find((x) => x.slug === slug);
  if (!p) notFound();
  const nomeCurto = p.nome.split(" — ")[0];
  // 052/research D3 — o painel "Depois do clique" só chama `dadosDaFicha()` quando o PERFIL
  // declara todo degrau com coletor (FR-010): a Atma (perfil D) segue chamando, como sempre.
  const cadeiaDoPerfil = cadeiaLigada(p.perfil, p.slug);

  const dados = mapaDoBoard();
  const cat = CATALOGO as Record<string, { nome: string; ramo: string }>;
  const reguaDe = regua as (k: string) => { tem: boolean; meta: number | [number, number] | null };
  const medidoPor = MEDIDO_POR as Record<string, string | undefined>;

  // 033/US2 — as seis faixas de posição, sobre os hosts do projeto medido. Contrato de
  // ausência (`contracts/telas.md` §C): `null` = sem propriedade, `{erro}` = falha transitória,
  // `{paginas:[]}` = respondeu, zero impressão. Nenhum dos três renderiza `0%`.
  // 051/US1 — a cadeia depois do clique vem da MESMA composição de /okr/{slug} (`dadosDaFicha`),
  // nunca de uma segunda conta: foi para três telas não divergirem que ela nasceu, e o mapa é a
  // quarta. Disparada aqui e esperada só no fim — ~3,3 s a frio, em paralelo com as leituras do
  // mapa. 052/FR-010: só quando a cadeia do perfil está ligada — sem coletor não há o que compor.
  const fichaAtma = cadeiaDoPerfil.ligada
    ? dadosDaFicha(slug).catch((e: unknown) => ({ erro: e instanceof Error ? e.message.slice(0, 80) : "a composição da ficha falhou" }))
    : null;
  const janela = descoberta();
  const hosts = hostsDeclarados(p);
  const paginasGsc = await gscPaginas(hosts, janela);
  // 042 — o campo (CrUX) COMEÇA aqui e só é esperado no bloco dos vitais, lá embaixo: são até 12
  // POSTs em série (as origens declaradas e as URLs prioritárias), e sem sobrepor às leituras do
  // Search Console que vêm a seguir eles somariam à latência da rota inteira. Nenhuma das duas
  // funções lança.
  const campo = SLUGS_DE_CAMPO.includes(p.slug)
    ? (async () => ({
        origens: await lerOrigens(hosts),
        pass: await lerPassRate(p.slug, paginasGsc && !("erro" in paginasGsc) ? paginasGsc.paginas : null),
      }))()
    : null;
  // 033/T071 — `null` tem TRÊS causas com consertos opostos (lista vazia, credencial ausente, host
  // fora de toda propriedade), e a tela afirmava a terceira sempre. Quem nomeia é `motivoDeAusencia`.
  const notaAusencia =
    paginasGsc === null
      ? motivoDeAusencia({ ligado: gscLigado(), hosts })
      : "erro" in paginasGsc
        ? `erro na fonte: ${paginasGsc.erro}`
        : null;
  const faixas = paginasGsc && !("erro" in paginasGsc) ? porFaixaDePosicao(paginasGsc.paginas, janela) : null;
  // 051 — HASTEADA: o nó do CTR Gap e a fila leem a MESMA conformidade, calculada uma vez.
  const conformidade = paginasGsc && !("erro" in paginasGsc) && paginasGsc.paginas.length ? conformidadeDeCtr(paginasGsc.paginas, janela) : null;
  const cliques28 = paginasGsc && !("erro" in paginasGsc) ? paginasGsc.paginas.reduce((s, p) => s + p.cliques, 0) : null;

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
    // 051/FR-004 — uma das duas relações do mapa que FECHAM por conta. Etiqueta, não cor.
    posicaoNode.tags = [...(posicaoNode.tags ?? []), "soma · cliques = impressões × CTR"];
  }

  // 034/US2 — a penetração no Top 3, na folha que define o KPI. Leitura SEPARADA da de cima e na
  // dimensão `query` sozinha: a de cima lê por PÁGINA e esta conta TERMO, e a agregação do Google
  // por termo não é a soma das linhas de `query`+`page` (é a mesma razão que fez a 032 deletar
  // `porUrl`). Duas requisições, duas perguntas.
  const termosGsc = await gscTermos(hosts, janela);
  // O JSON entra tipado pelo próprio arquivo; `lerInventario` é `.mjs` e valida em tempo de
  // execução (lista vazia, termo duplicado, marca dentro do inventário) — é ela que reprova o
  // arquivo editado à mão, não o `tsc`.
  const inventario = lerInventario(slug, INVENTARIOS);
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
  const decl = marcaDeclarada(p);
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
  // 045 — HASTEADA para fora do bloco: a folha de buscas de marca lê a MESMA série, na mesma janela
  // da aba de aquisição, e uma segunda leitura seria o recorte divergente que o parágrafo acima proíbe.
  const longa = descobertaLonga() as { inicio: string; fim: string };
  let serie: DiaSeparado[] | { erro: string } | null = null;
  if (dbOn()) {
    try {
      serie = await lerDiasGsc(slug, longa.inicio, longa.fim);
    } catch (e) {
      serie = { erro: (e instanceof Error ? e.message : String(e)).slice(0, 60) };
    }
  }
  const cnmNode = acharNo(dados.nodeData as No, "crescimentoNaoMarca");
  if (cnmNode) {
    // SEIS estados de tela, e nenhum publica `0`: os cinco da função pura + a leitura que falhou. A
    // falha é transitória e a ausência é estrutural — uma pede investigar credencial, a outra pede
    // declarar marca, e um `null` mudo faria as duas parecerem a mesma coisa (mesma razão da 030).
    let filho: No;
    if (!Array.isArray(serie)) {
      filho = {
        id: "crescimentoNaoMarca-medido",
        topic: `∅ não apurado · banco indisponível (${serie ? serie.erro : "sem banco configurado para o hub"})`,
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
  // 040 — HASTEADA para fora do bloco: a folha do título consome a MESMA leitura mais abaixo para
  // achar o termo principal de cada URL. Declarar dentro do `if` faria a segunda folha pagar uma
  // segunda requisição por host pela mesma pergunta.
  // 046 — a janela-base do footprint (a meta do board é "ao trimestre"): a MESMA leitura, 13 semanas
  // antes, que mantém o dia da semana dos dois lados. Disparada ANTES do `await` de baixo para as
  // duas correrem juntas; `gscConsultas` não lança, a falha volta como `{erro}`.
  const janelaBase = descoberta(Date.now() - 91 * 864e5);
  const consultasBase = gscConsultas(hosts, janelaBase);
  const consultasGsc = await gscConsultas(hosts, janela);
  const impNode = acharNo(dados.nodeData as No, "impressoesTop3");
  if (impNode) {
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
              const c = conformidade!;
              return {
                id: "ctrGap-medido",
                topic: topicDaConformidade(c),
                note: noteDaConformidade(c, janela, paginasDoGap!.length, slug),
              };
            })();
    // À FRENTE da definição e da meta, pelo mesmo motivo das quatro folhas vizinhas.
    gapNode.children = [filho, ...(gapNode.children ?? [])];
  }

  // ── 039: a cobertura de dados estruturados, medida onde o board mandou olhar ───────────────
  //
  // A folha se chama "Rich Snippets ELEGÍVEIS" e a meta dela termina em "0 erros críticos no
  // relatório de Resultados Enriquecidos do Search Console". O hub já tinha um coletor para esta
  // chave — `lib/grafo.mjs#taxaCobertura`, que conta JSON-LD que o `JSON.parse` aceita — e ele
  // responde a PRIMEIRA metade da definição ("sem erro de sintaxe"), não a segunda. Na Atma as duas
  // divergem inteiras: 35 de 35 pelo parser, e nenhuma URL elegível aos tipos que o board nomeia.
  // Publicar os 100% sozinhos seria medir o critério com outro instrumento — o defeito que a 032
  // tirou do ar na folha vizinha. Por isso o `topic` é o que o Google reporta e a sintaxe desce
  // para o `note`, como evidência.
  //
  // ZERO REQUISIÇÃO NOVA, como a 038: `richResultsResult` chega na MESMA resposta da URL Inspection
  // que a corrida diária de `/api/indexacao` já paga por URL, e vinha sendo descartada em
  // `lib/indexacao.mjs` desde a 022.
  // 040 — HASTEADA pelo mesmo motivo de `consultasGsc`: a folha do título mede largura e termo
  // sobre as MESMAS páginas desta corrida, e duas leituras da mesma tabela poderiam cair em dias
  // diferentes se uma corrida gravasse entre as duas.
  const crawl = dbOn() ? await lerCrawlDePagina(slug) : null;
  // 043 — hasteada pelo mesmo motivo do `crawl`: a Indexação Limpa e a Rejeição de Rastreio leem a
  // MESMA apuração que o schema, e duas leituras podiam cair em corridas diferentes.
  const apuracao = dbOn() ? await lerIndexacao(slug) : null;
  const schemaNode = acharNo(dados.nodeData as No, "schema");
  if (schemaNode) {
    const sintaxe = crawl ? taxaCobertura(crawl.paginas) : null;
    const cob = apuracao ? coberturaRich(apuracao) : { julgadas: null, fracao: null };
    // Os CINCO estados de ausência, do mais específico ao mais genérico, e nenhum publica `0%`:
    // "nenhuma página elegível" é a reprovação mais grave que esta folha sabe emitir, e é a que
    // manda reescrever schema — enquanto o conserto real, em quatro dos cinco, é outro.
    const filho: No = !dbOn()
      ? { id: "schema-medido", topic: "∅ não apurado · sem banco", note: "A leitura mora em `hub_indexacao`, e sem `DATABASE_URL` não há corrida gravada para ler." }
      : !apuracao
        ? { id: "schema-medido", topic: "∅ não apurado · nenhuma corrida de indexação gravada", note: "A cobertura sai do relatório de resultado enriquecido que a corrida diária de `/api/indexacao` baixa junto com o estado de indexação. Sem corrida, não há relatório." }
        : apuracao.motivo
          ? { id: "schema-medido", topic: `∅ não apurado · ${apuracao.motivo.replace(/_/g, " ")}`, note: `A corrida de ${apuracao.dia} não inspecionou URL nenhuma (motivo \`${apuracao.motivo}\`), então não há relatório de resultado enriquecido. Não é "nenhuma página elegível" — é nenhuma página olhada.` }
          : cob.julgadas === null
            ? {
                id: "schema-medido",
                topic: `∅ não apurado · a corrida de ${apuracao.dia} é anterior à leitura do relatório`,
                // A distinção que o `null` das colunas guarda. Sem esta folha explicando, a
                // primeira corrida nova pareceria uma queda vinda do nada.
                note: `A corrida gravou indexação mas não o relatório de resultado enriquecido — as colunas \`rich_*\` de ${apuracao.dia} estão NULAS, e nulo é "não medido", nunca zero. A leitura entrou em 20/09/2026 e vale da próxima corrida em diante; as anteriores não são recuperáveis, porque o relatório é o estado do índice no dia em que se pergunta.`,
              }
            : cob.julgadas === 0
              ? {
                  id: "schema-medido",
                  topic: `∅ não apurado · nenhuma das ${br(apuracao.inspecionadas)} URLs está no índice`,
                  note: `O Google só publica relatório de resultado enriquecido para URL que ele rastreou e indexou. Com ${br(apuracao.richSemRelatorio ?? 0)} URLs fora do índice, não há o que julgar — e chamar isso de 0% de cobertura mandaria reescrever schema quando o conserto é indexação.`,
                }
              : {
                  id: "schema-medido",
                  topic: topicDoSchema(apuracao, cob),
                  note: noteDoSchema(apuracao, cob, sintaxe, crawl?.dia ?? null),
                };
    schemaNode.children = [filho, ...(schemaNode.children ?? [])];
  }

  // ── 040: a Integridade do Título, nas três metas que o board pendura no grupo ──────────────
  //
  // Este é o primeiro nó do board com TRÊS metas irmãs, e elas não compartilham nem denominador nem
  // instrumento. A largura sai do crawl e vale para todo título; o termo exige o Search Console e só
  // vale onde a URL tem consulta com impressão; a reescrita não tem coletor nenhum. Uma fração só
  // para o grupo mediria a mais fraca das três e chamaria o resultado de "integridade do título".
  //
  // Por isso são QUATRO nós: um por meta, no denominador que cada uma pede, e a conjunção no nó do
  // KPI — que é do hub, não do board, e o `note` declara isso. Publicar só a conjunção (0 de 10 na
  // Atma) diria "a largura está em 0%" num site em que quase metade dos títulos cabe na faixa: é o
  // mesmo defeito que a 032 tirou do ar na folha vizinha, medir o critério com outro instrumento.
  //
  // ZERO REQUISIÇÃO NOVA, como a 038 e a 039: a leitura consulta×página e a corrida de página já
  // estão carregadas acima, e foi para isso que as duas subiram para fora dos blocos delas.
  const corrida = crawl && !crawl.motivo ? crawl : null;
  const largura = corrida ? taxaLarguraDoTitulo(corrida.paginas) : null;
  // A MESMA cadeia de /okr/[slug]/aquisicao: canoniza os dois lados (senão `/precos` e `/precos/`
  // são páginas diferentes e TODA URL sai como "sem termo apurado"), acha o termo principal pela
  // leitura e procura esse termo no título gravado pela corrida.
  const linhasDoTermo =
    consultasGsc && !("erro" in consultasGsc)
      ? consultasGsc.linhas.map((l) => ({ ...l, page: canonizar(l.page, p.url) ?? l.page }))
      : null;
  const posicaoPorUrl = new Map<string, number | null>(
    (corrida?.paginas ?? []).map((pg) => [
      pg.url,
      linhasDoTermo ? posicaoDoTermo(pg.titulo, termoPrincipal(linhasDoTermo, pg.url)) : null,
    ]),
  );
  const integridade = corrida && linhasDoTermo ? taxaIntegridadeDoTitulo(corrida.paginas, posicaoPorUrl) : null;
  // Os motivos de ausência, nomeados UMA vez e usados pelos nós — cada um com o seu, porque a
  // largura continua medível sem Search Console e o termo não.
  const semCorrida = !dbOn()
    ? "sem banco · os títulos moram em `hub_pagina`"
    : !crawl
      ? "nenhuma corrida de página gravada"
      : crawl.motivo
        ? `a corrida de ${crawl.dia} não visitou página nenhuma (\`${crawl.motivo}\`)`
        : null;
  const semConsultas = !consultasGsc
    ? motivoDeAusencia({ ligado: gscLigado(), hosts })
    : "erro" in consultasGsc
      ? `a leitura do Search Console falhou: ${consultasGsc.erro}`
      : null;
  // O título é do CRAWL e a consulta é do Search Console: sem crawl não há o que medir em meta
  // nenhuma, e é por isso que ele vem primeiro nos dois nós que dependem dos dois.
  const porqueSemTermo =
    semCorrida ?? semConsultas ?? (integridade === null ? "nenhuma URL da corrida teve consulta com impressão na janela" : null);

  const larguraNode = acharNo(dados.nodeData as No, "larguraTitulo");
  if (larguraNode) {
    const filho: No =
      semCorrida || !largura
        ? {
            id: "larguraTitulo-medido",
            topic: `∅ não apurado · ${semCorrida ?? "nenhuma página com título na corrida"}`,
            note: `A largura é estimada sobre o \`<title>\` que a corrida de página grava, não sobre o Search Console — esta meta é a única das três do grupo que não depende da leitura de busca. ${semCorrida ? "Sem corrida, não há título." : "A corrida rodou e não gravou título nenhum, o que é achado da corrida e não do título."}`,
          }
        : {
            id: "larguraTitulo-medido",
            topic: `Medido: ${pct1(largura.fracao)} · ${br(largura.avaliadas - largura.estreitos.length - largura.largos.length)} de ${br(largura.avaliadas)} títulos na faixa · ${br(largura.largos.length)} acima de ${TITULO_PX_MAX}px · ${br(largura.estreitos.length)} abaixo de ${TITULO_PX_MIN}px`,
            note: noteDaLargura(largura, corrida!.dia),
          };
    larguraNode.children = [filho, ...(larguraNode.children ?? [])];
  }

  const termoNode = acharNo(dados.nodeData as No, "termoNoTitulo");
  if (termoNode) {
    const filho: No = porqueSemTermo
      ? {
          id: "termoNoTitulo-medido",
          topic: `∅ não apurado · ${porqueSemTermo}`,
          note: "Esta meta precisa das DUAS fontes: o título vem da corrida de página e o termo principal vem da leitura consulta×página do Search Console, que é onde se sabe para o que a URL ranqueia. Faltando uma, não há par para comparar — e “sem termo apurado” nunca é “o termo não está no título”, que é o veredito oposto.",
        }
      : {
          id: "termoNoTitulo-medido",
          topic: `Medido: ${pct1(integridade!.termo.passam / integridade!.termo.base)} · ${br(integridade!.termo.passam)} de ${br(integridade!.termo.base)} URLs com termo apurado · em ${br(integridade!.termo.ausentes)} o termo não está no título`,
          note: noteDoTermo(integridade!.termo, integridade!.semTermo, corrida!.visitadas, janela, corrida!.dia, hosts),
        };
    termoNode.children = [filho, ...(termoNode.children ?? [])];
  }

  // A folha SEM COLETOR, e é ela que explica por que a conjunção acima tem duas metas e não três.
  // O nó existe por afirmação, não por lacuna: deixar a folha muda faria "ninguém mediu" parecer
  // "ninguém olhou", e as duas mandam fazer coisas diferentes.
  const reescritaNode = acharNo(dados.nodeData as No, "reescritaTitulo");
  if (reescritaNode) {
    reescritaNode.children = [
      {
        id: "reescritaTitulo-medido",
        topic: "∅ sem coletor · nenhuma fonte do hub diz qual título o Google exibiu",
        note: "A Search Analytics API devolve consulta, página, cliques, impressões e posição — nunca o snippet. A URL Inspection devolve o estado no índice, não o que a SERP mostra. Medir reescrita exigiria capturar a SERP de cada consulta×página e comparar com o `<title>` da corrida, e o hub não tem essa fonte: é a única das três metas deste grupo sem coletor, e não é dado esperando no Search Console para ser lido. Sem coletor E sem régua: o selo `◇` desta folha já diz por que a meta de < 15% não sustenta veredito, e as duas ausências são independentes — ligar uma fonte não daria régua, e uma régua não daria fonte.",
      },
      ...(reescritaNode.children ?? []),
    ];
  }

  // 041 — o alinhamento de intenção, DUAS leituras na mesma folha porque a definição do board tem
  // dois lados e o hub só media um. A primeira (`intencao-medido`) é o modificador no título, que é
  // a função que /okr/atma/aquisicao já publica; a segunda (`intencao-match`) é a correspondência
  // com a intenção da BUSCA, que é o que dá nome à folha e nenhum coletor cruzava.
  //
  // O id do match NÃO termina em `-medido`, pela mesma razão da conjunção do título logo abaixo: o
  // contador conta FOLHAS com leitura própria, e esta folha é uma só.
  //
  // Zero requisição nova: a corrida de página e a leitura consulta×página já estão carregadas.
  const intencaoNode = acharNo(dados.nodeData as No, "intencao");
  if (intencaoNode) {
    const alinhamento = corrida ? taxaAlinhamento(corrida.paginas) : null;
    const ano = corrida ? contrafactualDoAno(corrida.paginas, new Date().getFullYear()) : null;
    const primeiro: No =
      semCorrida || !alinhamento
        ? {
            id: "intencao-medido",
            topic: `∅ não apurado · ${semCorrida ?? "nenhuma página com título na corrida"}`,
            note: "O modificador é procurado no `<title>` que a corrida de página grava, e a classificação é gravada junto (`hub_pagina.intencao`) pela mesma `modificadoresDeIntencao()` que a régua usa. Sem corrida não há título, e sem título não há gancho para julgar.",
          }
        : {
            id: "intencao-medido",
            // O `topic` carrega os DOIS denominadores. Só a fração diria 54,3% sobre um site em que
            // 13 dos 19 aprovados são o mesmo `<title>` — o defeito que a 038 pegou na imagem.
            topic:
              alinhamento.compartilhado.fracaoPropria !== null && alinhamento.compartilhado.urls > 0
                ? `Medido: ${pct1(alinhamento.fracao)} · ${br(alinhamento.avaliadas - alinhamento.ausentes.length)} de ${br(alinhamento.avaliadas)} títulos com modificador · mas ${br(alinhamento.compartilhado.passam)} são o MESMO título de fallback · ${pct1(alinhamento.compartilhado.fracaoPropria)} (${br(alinhamento.compartilhado.passamProprias)} de ${br(alinhamento.compartilhado.proprias)}) entre títulos próprios`
                : `Medido: ${pct1(alinhamento.fracao)} · ${br(alinhamento.avaliadas - alinhamento.ausentes.length)} de ${br(alinhamento.avaliadas)} títulos com modificador explícito`,
            note: noteDoAlinhamento(alinhamento, ano!, corrida!.dia, slug),
          };
    // O segundo lado precisa da leitura de busca ALÉM da corrida, e por isso tem motivo próprio —
    // a mesma separação que a 040 fez entre a largura (só crawl) e o termo (crawl + Search Console).
    const buscaPorUrl = new Map<string, string | null>(
      (corrida?.paginas ?? []).map((pg) => {
        const termo = linhasDoTermo ? termoPrincipal(linhasDoTermo, pg.url) : null;
        return [pg.url, termo ? modificadoresDeIntencao(termo, new Date().getFullYear()) : null];
      }),
    );
    const match = corrida && linhasDoTermo ? correspondenciaDeIntencao(corrida.paginas, buscaPorUrl) : null;
    const segundo: No =
      !match
        ? {
            id: "intencao-match",
            topic: `∅ não apurado · ${semCorrida ?? semConsultas ?? "nenhuma URL da corrida teve consulta com impressão na janela"}`,
            note: "O MATCH precisa das duas pontas: o gancho vem do título da corrida e a intenção da busca vem da consulta de maior impressão de cada URL, na leitura consulta×página. Faltando uma, não há par — e “sem par” nunca é “não casa”, que é o veredito oposto.",
          }
        : {
            id: "intencao-match",
            // Contagem e não percentual, pela regra que a 038 fixou: índice sobre punhado de casos
            // é ruído travestido de taxa. A fração vai para o `note`, como evidência.
            topic: `${match.decididas === 0 ? "∅" : "⚠"} ${br(match.decididas)} de ${br(match.avaliadas)} ${match.avaliadas === 1 ? "par" : "pares"} com intenção declarada nos DOIS lados · em ${br(match.buscaMuda)} a consulta principal não traz modificador`,
            note: noteDoMatch(
              match,
              (url) => (linhasDoTermo ? termoPrincipal(linhasDoTermo, url) : null),
              decl.motivo ? null : (t: string) => new RegExp(decl.padrao, "i").test(t),
              janela,
              corrida!.dia,
              hosts,
            ),
          };
    intencaoNode.children = [primeiro, segundo, ...(intencaoNode.children ?? [])];
  }

  // A conjunção, no nó do KPI. É GRUPO e não folha — por isso a busca é por `topic`, e por isso o
  // id NÃO termina em `-medido`: o contador logo abaixo diz "folhas com leitura própria", e este nó
  // não é uma folha do catálogo.
  const tituloNode = acharPorTopico(dados.nodeData as No, GRUPO_DO_TITULO);
  if (tituloNode) {
    const filho: No = porqueSemTermo
      ? {
          id: "tituloIntegridade-lido",
          topic: `∅ não apurado · ${porqueSemTermo}`,
          note: `A conjunção só existe onde as duas metas medíveis foram medidas na mesma URL.${largura ? ` A largura sozinha está apurada e vale ${pct1(largura.fracao)} sobre ${br(largura.avaliadas)} títulos — ver a folha "Comprimento em pixels".` : ""}`,
        }
      : {
          id: "tituloIntegridade-lido",
          topic: `Medido: ${pct1(integridade!.fracao)} nas duas metas medíveis · ${br(integridade!.avaliadas)} URLs julgadas · largura ${pct1(largura!.fracao)} · termo ${pct1(integridade!.termo.passam / integridade!.termo.base)}`,
          note: noteDaIntegridade(integridade!, largura, janela, corrida!.dia, slug),
        };
    tituloNode.children = [filho, ...(tituloNode.children ?? [])];
  }

  // ── 042: Core Web Vitals e TTFB, no ramo "1. KPIs Técnicas" ────────────────────────────────
  //
  // Leitura de CAMPO: CrUX, p75, todos os dispositivos — a fonte e as funções da ficha
  // (`medirRecord`/`rodape`) e do Pass Rate de /okr/[slug]/aquisicao (`lerPassRate`, que se mudou
  // para `lib/crux.ts` para servir as duas). O que é novo é perguntar pelas DUAS origens
  // declaradas. Medido em 21/09/2026: `usealigner.com` dá 404 e `atma.roilabs.com.br` responde
  // LCP, CLS e TTFB na janela 23/08→19/09 — perguntar só pela do card publicaria "sem amostra" sobre
  // 28 dias de campo, e só pela antiga publicaria o domínio velho como o de hoje.
  const lidoCampo = campo ? await campo : null;
  for (const id of ["lcp", "inp", "cls", "ttfb"]) {
    const no = acharNo(dados.nodeData as No, id);
    if (!no) continue;
    const filho: No = lidoCampo
      ? noDoVital(id, lidoCampo.origens, p.dominioAnterior ?? null)
      : { id: `${id}-medido`, topic: "∅ não apurado · projeto fora do escopo de campo", note: "A leitura de campo só roda para `SLUGS_DE_CAMPO` (`lib/crux.mjs`)." };
    no.children = [filho, ...(no.children ?? [])];
  }
  const passNode = acharNo(dados.nodeData as No, "urlsBoas");
  if (passNode) passNode.children = [noDoPassRate(lidoCampo?.pass ?? null, janela, slug), ...(passNode.children ?? [])];

  // ── 043: "2. KPIs de Rastreabilidade e Saúde do Índice" ────────────────────────────────────
  //
  // ZERO REQUISIÇÃO NOVA: as duas razões do índice saem da apuração diária de `/api/indexacao` (022),
  // a mesma que abre o schema acima, e a profundidade sai da corrida de página (024). A Rejeição de
  // Rastreio constava como "sem coletor" com a razão calculada em `agregar()` desde a 022.
  const semApuracao = !dbOn()
    ? "sem banco · a apuração mora em `hub_indexacao`"
    : !apuracao
      ? "nenhuma corrida de indexação gravada"
      : apuracao.motivo
        ? `a corrida de ${apuracao.dia} não inspecionou URL nenhuma (\`${apuracao.motivo}\`)`
        : null;
  const taxas = apuracao && !apuracao.motivo ? taxasDeIndexacao(apuracao) : null;
  const porqueSemTaxa =
    semApuracao ?? (taxas && taxas.base === 0 ? `as ${br(apuracao!.inspecionadas)} inspeções da corrida de ${apuracao!.dia} falharam` : null);
  if (apuracao && taxas && !porqueSemTaxa) {
    const a = apuracao;
    const fora = a.rastreadasNaoIndexadas + a.descobertasNaoIndexadas + a.outras;
    const daCorrida = `Corrida de ${a.dia} na propriedade ${a.propriedade ?? "(não gravada)"}: ${br(a.inspecionadas)} de ${br(a.declaradas)} URLs do sitemap inspecionadas uma a uma na URL Inspection${a.inspecionadas < a.declaradas ? " — AMOSTRA: o orçamento não cobriu o sitemap inteiro, e a fração é da amostra" : ""}${a.falhas ? `; ${br(a.falhas)} com falha, fora do numerador e do denominador (erro de cota não é desindexação)` : ""}. Fora do índice: ${br(a.descobertasNaoIndexadas)} descobertas e não lidas, ${br(a.rastreadasNaoIndexadas)} rastreadas e recusadas, ${br(a.outras)} em outro estado.`;
    const foraDoSitemap =
      corrida && corrida.linkadasNaoDeclaradas > 0
        ? ` A corrida de página de ${corrida.dia} achou ${br(corrida.linkadasNaoDeclaradas)} páginas linkadas que o sitemap não declara: não foram submetidas, então não entram neste denominador — e a corrida de indexação não as inspeciona.`
        : "";
    const anterior = p.dominioAnterior;
    const aposTroca =
      anterior && diaUtc(a.dia) >= diaUtc(anterior.data)
        ? ` A apuração é de ${diaUtc(a.dia) - diaUtc(anterior.data)} dias depois da troca de domínio de ${anterior.data}: URL do domínio novo que o Googlebot ainda não visitou aparece como descoberta, não como recusada.`
        : "";

    const idxNode = acharNo(dados.nodeData as No, "indexacaoLimpa");
    if (idxNode)
      idxNode.children = [
        {
          id: "indexacaoLimpa-medido",
          topic: `Medido: ${pct1(taxas.taxa!)} · ${br(a.indexadas)} de ${br(taxas.base)} URLs do sitemap no índice · ${br(fora)} fora`,
          note: `${daCorrida}${aposTroca}${foraDoSitemap} A meta de ≥ 95% está no nó abaixo como o board escreveu, e o selo ◇ diz por que não é régua: quem submete só o que já indexa bate 100% sem fazer nada.`,
        },
        ...(idxNode.children ?? []),
      ];

    const rejNode = acharNo(dados.nodeData as No, "rejeicaoRastreio");
    if (rejNode)
      rejNode.children = [
        {
          id: "rejeicaoRastreio-medido",
          topic: `Medido: ${pct1(taxas.rejeicao!)} · ${br(a.descobertasNaoIndexadas + a.rastreadasNaoIndexadas)} de ${br(taxas.base)} URLs do sitemap · ${br(a.descobertasNaoIndexadas)} descobertas e não lidas, ${br(a.rastreadasNaoIndexadas)} rastreadas e recusadas${a.outras ? ` · ${br(a.outras)} em outro estado` : ""}`,
          // O "unknown" foi MEDIDO alternando com "Discovered" na mesma URL, em chamadas seguidas.
          // Sem a frase, uma corrida que caia do outro lado parece o site melhorando.
          note: `Os dois status que o board nomeia, contados separados por \`classificar()\` porque pedem consertos opostos: descoberta e não lida é o Googlebot que ainda não foi lá (rastreio, link interno, solicitar indexação); rastreada e recusada é ele ter lido e dito não (trabalho editorial). ${daCorrida}${aposTroca} O denominador é o sitemap inspecionado, não o inventário inteiro que o board cita: a URL Inspection só olha o que a corrida pede.${foraDoSitemap} Medido em 21/09/2026: a URL Inspection alterna entre “Discovered - currently not indexed” e “URL is unknown to Google” na MESMA URL em chamadas seguidas, e a segunda cai em “outro estado”, fora do numerador — esta fração oscila entre corridas sem o site mudar; o total fora do índice (${br(fora)}) não. A meta de < 5% está no nó abaixo e não é régua: ninguém publica a faixa.`,
        },
        ...(rejNode.children ?? []),
      ];
  } else {
    for (const chave of ["indexacaoLimpa", "rejeicaoRastreio"]) {
      const no = acharNo(dados.nodeData as No, chave);
      if (no)
        no.children = [
          {
            id: `${chave}-medido`,
            topic: `∅ não apurado · ${porqueSemTaxa}`,
            note: "A fração sai da corrida diária de `/api/indexacao`, que inspeciona na URL Inspection cada URL do sitemap. Sem corrida que tenha inspecionado alguma URL não há denominador — e “não apurado” nunca é 0%, que reportaria como desindexado um site que ninguém perguntou.",
          },
          ...(no.children ?? []),
        ];
    }
  }

  // A profundidade é julgada pelo 3 do BOARD, que é a meta escrita no nó abaixo — o hub usa
  // `PROFUNDIDADE_MAX` (4), e a divergência já vive em `DIVERGENCIAS.profundidadeClique`. O `note`
  // traz as duas contagens para que a leitura não dependa de quem ganhar essa decisão.
  const CLIQUES_DO_BOARD = 3;
  const profNode = acharNo(dados.nodeData as No, "profundidadeClique");
  if (profNode) {
    const pags = corrida?.paginas ?? [];
    const filho: No =
      semCorrida || !pags.length
        ? {
            id: "profundidadeClique-medido",
            topic: `∅ não apurado · ${semCorrida ?? "a corrida não gravou página nenhuma"}`,
            note: "A profundidade sai da travessia em largura que a corrida de página faz a partir da home (`profundidades()`). Sem corrida não há grafo de links para percorrer.",
          }
        : (() => {
            // `null` é ÓRFÃ — página do sitemap que nenhum link alcança. Reprova: inalcançável é mais
            // fundo que qualquer número, e nunca é 0 (a raiz é o único 0).
            const passa = (limite: number) => pags.filter((p) => p.profundidade !== null && p.profundidade <= limite).length;
            const noBoard = passa(CLIQUES_DO_BOARD);
            const fundas = pags.filter((p) => p.profundidade !== null && p.profundidade > CLIQUES_DO_BOARD);
            const caminho = (u: string) => { try { return new URL(u).pathname; } catch { return u; } };
            const quais = fundas.slice(0, 2).map((p) => `${caminho(p.url)} a ${p.profundidade}`).join(", ");
            // Da home para fora: `lerCrawlDePagina` entrega por PERIFERIA (órfã e mais funda primeiro).
            const porNivel = new Map<number, number>();
            for (const p of pags) porNivel.set(p.profundidade ?? Infinity, (porNivel.get(p.profundidade ?? Infinity) ?? 0) + 1);
            const distribuicao = [...porNivel]
              .sort(([a], [b]) => a - b)
              .map(([k, n]) => (k === Infinity ? `${br(n)} órfãs` : `${br(n)} a ${k}`))
              .join(", ");
            return {
              id: "profundidadeClique-medido",
              topic: `Medido: ${pct1(noBoard / pags.length)} · ${br(noBoard)} de ${br(pags.length)} páginas a ≤ ${CLIQUES_DO_BOARD} cliques da home${fundas.length ? ` · ${quais}${fundas.length > 2 ? ` e mais ${br(fundas.length - 2)}` : ""}` : ""} · ${br(corrida!.orfas)} órfãs`,
              note: `Corrida de página de ${corrida!.dia}: travessia em largura a partir da home, link de menu contando como clique. Por profundidade: ${distribuicao}. O denominador é TODA página da corrida (${br(corrida!.declaradas)} declaradas no sitemap, ${br(corrida!.linkadasNaoDeclaradas)} linkadas fora dele), não só "transacionais e pilares": o hub não classifica tipo de página, então mede o conjunto que contém as duas — se todas passam, as do board passam, e uma que reprova aqui pode não ser pilar. Órfã é página do sitemap que nenhum link alcança, e reprova. A meta é a do board, ≤ ${CLIQUES_DO_BOARD} cliques, no nó abaixo; pela régua do hub (\`PROFUNDIDADE_MAX\`, ${DIVERGENCIAS.profundidadeClique.hub}) são ${br(passa(DIVERGENCIAS.profundidadeClique.hub))} de ${br(pags.length)}. Nenhum dos dois números tem fonte.`,
            };
          })();
    profNode.children = [filho, ...(profNode.children ?? [])];
  }

  // ── 044: "3. KPIs de Relevância On-Page e Cobertura de Entidades" ─────────────────────────
  //
  // ZERO REQUISIÇÃO NOVA, como a 043: a canibalização lê as linhas consulta×página que a 040
  // hasteou, JÁ CANONIZADAS (`linhasDoTermo`), porque sem isso `/x` e `/x/` disputariam entre si. A
  // cadência lê a mesma corrida de página da profundidade.
  const anterior044 = p.dominioAnterior ?? null;
  const cruzaATroca = anterior044 && diaUtc(janela.inicio) < diaUtc(anterior044.data) && diaUtc(janela.fim) >= diaUtc(anterior044.data);
  const canNode = acharNo(dados.nodeData as No, "canibalizacao");
  if (canNode) {
    const ehMarca = decl.motivo ? null : (q: string) => new RegExp(decl.padrao, "i").test(q);
    const porPagina = linhasDoTermo ? canibalizacaoPorPagina(linhasDoTermo, ehMarca) : null;
    const filho: No =
      !linhasDoTermo || !porPagina?.avaliadas
        ? {
            id: "canibalizacao-medido",
            topic: `∅ não apurado · ${semConsultas ?? "nenhuma URL com palavra-chave primária fora da marca na janela"}`,
            note: "A disputa sai da leitura consulta×página do Search Console: sem ela não há consulta para ver quantas URLs a servem. “0 páginas” aqui leria como a meta do board batida num site que ninguém mediu.",
          }
        : (() => {
            const linhas = linhasDoTermo;
            const canib = canibalizacao(linhas, ehMarca);
            const d = porPagina.disputadas;
            const foraDaMarca = linhas.filter((l) => !ehMarca?.(l.query));
            const impFora = foraDaMarca.reduce((a, l) => a + l.impressoes, 0);
            const impDisputa = canib.lista.reduce((a, c) => a + c.impressoes, 0);
            const pos = (p: number) => p.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
            // O conserto é por PAR de páginas, não por consulta: 73 consultas podem ser um par só.
            const pares = new Map<string, { a: string; b: string; n: number }>();
            for (const c of canib.lista) {
              const [a, b] = c.urls;
              const k = `${a.url}\0${b.url}`;
              pares.set(k, { a: a.url, b: b.url, n: (pares.get(k)?.n ?? 0) + 1 });
            }
            const par = [...pares.values()].sort((x, y) => y.n - x.n)[0];
            const topo = canib.lista[0];
            // Medido em 20/09/2026: a página de preço disputa as consultas de preço SÓ pelo domínio
            // anterior. Sem a frase, o par lê como duas páginas vivas no mesmo site.
            const hostAnterior = anterior044 ? new URL(anterior044.url).host : null;
            const hostsDoRival = par ? new Set(linhas.filter((l) => l.page === par.b).flatMap((l) => l.hosts)) : null;
            const soPeloAnterior = hostAnterior && hostsDoRival?.size === 1 && hostsDoRival.has(hostAnterior);
            const quais = d
              .slice(0, 3)
              .map((x) => `${caminhoDe(x.url)} em «${x.termo}» (também ${x.rivais.slice(0, 2).map(caminhoDe).join(", ")}${x.rivais.length > 2 ? "…" : ""})`)
              .join("; ");
            return {
              id: "canibalizacao-medido",
              topic: `Medido: ${br(d.length)} de ${br(porPagina.avaliadas)} páginas com a palavra-chave primária disputada · ${br(canib.lista.length)} consultas servidas por 2+ URLs`,
              note: `Leitura consulta×página do Search Console, ${janela.inicio} → ${janela.fim}, hosts somados por caminho e URL canonizada. A meta do board conta PÁGINAS: das ${br(porPagina.avaliadas)} URLs cuja consulta de maior impressão (a primária, \`termoPrincipal\`, a mesma do título) não é a marca, ${br(d.length)} dividem essa consulta com outra URL do site${d.length ? `: ${quais}${d.length > 3 ? ` e mais ${br(d.length - 3)}` : ""}` : ""}. Contando CONSULTAS, como a aba de aquisição conta: ${br(canib.lista.length)} das ${br(new Set(foraDaMarca.map((l) => l.query)).size)} consultas fora da marca aparecem em 2+ URLs, com ${impFora ? pct1(impDisputa / impFora) : "—"} das impressões fora da marca${canib.removidas ? ` (${br(canib.removidas)} de marca ficam fora: buscar o nome da empresa traz o site inteiro por construção)` : canib.removidas === null ? " — sem marca declarada, nenhuma consulta de marca foi tirada" : ""}.${par ? ` O par que mais se repete é ${caminhoDe(par.a)} à frente de ${caminhoDe(par.b)}, em ${br(par.n)} das ${br(canib.lista.length)} consultas; a disputa que mais custa é «${topo.consulta}» (${br(topo.impressoes)} impressões), com ${topo.urls.slice(0, 2).map((u) => `${caminhoDe(u.url)} na posição ${pos(u.posicao)}`).join(" e ")}.` : ""}${soPeloAnterior ? ` ${caminhoDe(par.b)} só recebeu impressão pelo domínio anterior (${hostAnterior}); pelo ${hosts[0]}, nenhuma na janela.` : ""}${cruzaATroca ? ` A janela atravessa a troca de domínio de ${anterior044!.data}, e as duas pontas entram somadas.` : ""} O “6ª e 14ª” do board é exemplo de posição flutuante, não corte: a contagem é a literal (duas URLs com impressão na mesma consulta), sem limiar de distância, porque nenhum tem fonte. A meta 0 é norma, não régua: ausência de defeito não tem quartil.`,
            };
          })();
    canNode.children = [filho, ...(canNode.children ?? [])];
  }

  const frescorNode = acharNo(dados.nodeData as No, "frescor");
  if (frescorNode) {
    const cad = corrida ? cadencia(corrida.paginas, corrida.dia) : null;
    const filho: No =
      !cad || cad.fracao === null
        ? {
            id: "frescor-medido",
            topic: `∅ não apurado · ${semCorrida ?? `nenhuma das ${br(cad!.semData.length)} páginas da corrida declara data de atualização`}`,
            note: "A data é a que a página declara no HTML gravado pela corrida (`dateModified` do JSON-LD, depois `article:modified_time`, depois `<time datetime>`). Página sem data fica fora do numerador e do denominador: sem data declarada não é desatualizada, é ausência de declaração, e “0%” aqui acusaria de abandonado um site que só não carimba data.",
          }
        : (() => {
            // A política vem da constante, agrupada por prazo: escrever "6 para comercial" aqui seria
            // a cópia que diverge no dia em que a política mudar.
            const porMeses = new Map<number, string[]>();
            for (const [k, m] of Object.entries(CADENCIA_POR_INTENCAO)) porMeses.set(m, [...(porMeses.get(m) ?? []), k]);
            const politica = [...porMeses]
              .sort(([a], [b]) => a - b)
              .map(([m, ks]) => `${m} meses para ${ks.join(" e ")}`)
              .join(", ");
            const v = cad.vencidas;
            const quais = v
              .slice(0, 3)
              .map((p: PaginaCrawl) => `${caminhoDe(p.url)} (${p.dataDeclarada}, prazo de ${cadenciaDe(p.intencao)} meses)`)
              .join(", ");
            return {
              id: "frescor-medido",
              topic: `Medido: ${pct1(cad.fracao)} · ${br(cad.avaliadas - v.length)} de ${br(cad.avaliadas)} páginas com data dentro do prazo · ${br(v.length)} vencidas · ${br(cad.semData.length)} sem data`,
              note: `Corrida de página de ${corrida!.dia}. A data é a que a própria página declara (\`dateModified\` do JSON-LD, depois \`article:modified_time\`, depois \`<time datetime>\`) — atualização, não publicação. O prazo é por intenção da página, ${politica}: política editorial do hub desde 19/09/2026, não régua (o board diz “6 a 12 meses” sem fonte, e o selo ◇ diz por quê).${v.length ? ` Vencidas: ${quais}${v.length > 3 ? ` e mais ${br(v.length - 3)}` : ""}.` : ""} As ${br(cad.semData.length)} páginas sem data ficam fora do numerador e do denominador: sem data declarada não é desatualizada. O denominador é toda página que declara data, não só os pilares do board: o hub não classifica tipo de página.`,
            };
          })();
    frescorNode.children = [filho, ...(frescorNode.children ?? [])];
  }

  // A folha SEM COLETOR, pelo mesmo motivo da reescrita do título: muda, "ninguém mediu" pareceria
  // "ninguém olhou". O id NÃO termina em `-medido`: o contador abaixo diz "folhas com leitura
  // própria", e esta não tem leitura nenhuma.
  const coberturaNode = acharNo(dados.nodeData as No, "coberturaSemantica");
  if (coberturaNode) {
    coberturaNode.children = [
      {
        id: "coberturaSemantica-sem-coletor",
        topic: "∅ sem coletor · o hub não lê o conteúdo do Top 3 de nenhuma SERP",
        note: "A meta compara a página com as sub-intenções que os 3 primeiros colocados cobrem na mesma SERP. O hub não tem essa fonte: a Search Analytics API devolve consulta, página e posição, nunca quem são os concorrentes nem o que escrevem; a corrida de página lê só o próprio site e grava título, datas e contagem de palavras, não o texto. Medir exigiria capturar a SERP de cada consulta primária, baixar as 3 páginas do topo e extrair as entidades de cada uma: coletor novo, não dado parado no Search Console. Sem coletor E sem régua: o selo ◇ já diz que “sub-intenção mandatória” não tem definição operacional, e ligar uma fonte não daria essa definição.",
      },
      ...(coberturaNode.children ?? []),
    ];
  }

  // ── 045: "4. KPIs de Autoridade e Conexões (PageRank Interno e Externo)" ──────────────────
  //
  // ZERO REQUISIÇÃO NOVA, como a 043 e a 044: a densidade lê a corrida de página da profundidade, a
  // marca lê a série do banco que o crescimento não-marca já leu e os termos que a penetração já leu.
  //
  // O 5 a 10 é a meta do BOARD, escrita no nó abaixo, e conta links; o hub julga por 1.000 palavras
  // desde 19/09 (`densidadeContextual`). O `note` traz as duas contagens, como a profundidade faz com
  // o 3 contra o 4.
  const LINKS_DO_BOARD = [5, 10] as const;
  const linksNode = acharNo(dados.nodeData as No, "linksInternos");
  if (linksNode) {
    const pags = corrida?.paginas ?? [];
    const filho: No =
      semCorrida || !pags.length
        ? {
            id: "linksInternos-medido",
            topic: `∅ não apurado · ${semCorrida ?? "a corrida não gravou página nenhuma"}`,
            note: "A contagem sai dos links que a corrida de página extrai do HTML de cada página, menu fora (`densidades()`). Sem corrida não há link para contar, e “0 de N na faixa” acusaria de isolado um site que ninguém leu.",
          }
        : (() => {
            const [min, max] = LINKS_DO_BOARD;
            const abaixo = pags.filter((p) => p.linksContextuais < min).sort((a, b) => a.linksContextuais - b.linksContextuais);
            const acima = pags.filter((p) => p.linksContextuais > max).sort((a, b) => b.linksContextuais - a.linksContextuais);
            const dentro = pags.length - abaixo.length - acima.length;
            const quais = (ps: PaginaCrawl[]) =>
              ps.slice(0, 3).map((p) => `${caminhoDe(p.url)} (${br(p.linksContextuais)})`).join(", ") + (ps.length > 3 ? ` e mais ${br(ps.length - 3)}` : "");
            const porHub = { dentro: 0, escasso: 0, excessivo: 0, semTexto: 0 };
            for (const p of pags) porHub[densidadeContextual(p.linksContextuais, p.palavras)?.estado ?? "semTexto"] += 1;
            return {
              id: "linksInternos-medido",
              topic: `Medido: ${br(dentro)} de ${br(pags.length)} páginas com ${min} a ${max} links contextuais apontando para elas · ${br(abaixo.length)} abaixo de ${min} · ${br(acima.length)} acima de ${max}`,
              note: `Corrida de página de ${corrida!.dia}: links de uma página do site para outra, lidos no HTML servido, com menu e rodapé fora (o link que se repete em toda página não é voto editorial).${abaixo.length ? ` Com menos de ${min}: ${quais(abaixo)}.` : ""}${acima.length ? ` Com mais de ${max}: ${quais(acima)}.` : ""} O denominador é TODA página da corrida, não só as “páginas-alvo” do board: o hub não sabe quais você quer empurrar para o Top 3, então conta todas, e uma página abaixo da faixa aqui pode não ser alvo. Pela régua do hub (${LINKS_POR_MIL_MIN} a ${LINKS_POR_MIL_MAX} links por 1.000 palavras, \`densidadeContextual\`), ${br(porHub.dentro)} dentro, ${br(porHub.escasso)} abaixo e ${br(porHub.excessivo)} acima${porHub.semTexto ? `, ${br(porHub.semTexto)} sem texto lido` : ""}. A corrida grava QUANTOS links chegam, não DE ONDE vêm: o “partindo de páginas com alto tráfego orgânico” do board não dá para conferir com o que está gravado. O 5 a 10 é meta do board, não régua: nenhum estudo publica contagem de links internos, e o selo ◇ diz por quê.`,
            };
          })();
    linksNode.children = [filho, ...(linksNode.children ?? [])];
  }

  // SEM COLETOR, como a cobertura semântica: o id não termina em `-medido` e não entra no contador.
  const rdNode = acharNo(dados.nodeData as No, "referringDomains");
  if (rdNode) {
    rdNode.children = [
      {
        id: "referringDomains-sem-coletor",
        topic: "∅ sem coletor · o hub não lê backlink de fonte nenhuma",
        note: "A velocidade pede duas coisas que o hub não tem: os domínios que apontam para o site e a data em que cada um apareceu. A Search Analytics API não traz link nenhum. O relatório Links do Search Console lista os sites que mais apontam, mas só na interface (exportação manual, sem API) e sem data de primeira aparição. As bases que datam cada domínio (Ahrefs, Majestic, DataForSEO) são pagas, e a decisão registrada em `handoff/handoff-os-28-do-board-o-que-falta.md` é deixá-las de fora até o portfólio faturar. O coletor mais barato é manual: exportar o relatório Links a cada trimestre e contar os domínios que não estavam na exportação anterior. Sem coletor e sem régua: o “+3 a +10” é do board e não tem fonte.",
      },
      ...(rdNode.children ?? []),
    ];
  }

  // A proporção é a MESMA da aba de aquisição (mesma série, mesma janela, `razaoDeMarca`); os meses
  // entram porque a meta do board é o volume MENSAL crescente, e a razão sozinha não diz direção.
  const marcaNode = acharNo(dados.nodeData as No, "buscasDeMarca");
  if (marcaNode) {
    const razao = Array.isArray(serie) ? razaoDeMarca(serie) : null;
    let filho: No;
    if (!Array.isArray(serie) || decl.motivo || razao === null) {
      filho = {
        id: "buscasDeMarca-medido",
        topic: `∅ não apurado · ${
          !Array.isArray(serie)
            ? `banco indisponível (${serie ? serie.erro : "sem banco configurado para o hub"})`
            : decl.motivo
              ? "marca não declarada para este projeto"
              : "a série gravada ainda não traz a separação de marca"
        }`,
        note: "A proporção sai da série diária gravada em `hub_gsc_dia`, com a separação marca/não-marca que a corrida das 05:17 faz a partir de `marca.termos` do card. Sem ela não há o que dividir, e “0% de marca” leria como “ninguém procura pelo nome”, que é uma afirmação sobre o site.",
      };
    } else {
      const comMarca = serie.filter((d) => typeof d.impressoesMarca === "number");
      const soma = (k: "impressoesMarca" | "impressoesPais") => comMarca.reduce((a, d) => a + (d[k] ?? 0), 0);
      const meses = mesesFechados(serie, new Date().toISOString().slice(0, 10), "impressoesMarca") as unknown as { mes: string; impressoesMarca: number; diasZero: number }[];
      const [pen, ult] = meses.slice(-2);
      const pico = meses.reduce<(typeof meses)[number] | undefined>((a, m) => (!a || m.impressoesMarca > a.impressoesMarca ? m : a), undefined);
      const direcao =
        pen && ult
          ? ` · ${br(ult.impressoesMarca)} em ${ult.mes}, contra ${br(pen.impressoesMarca)} em ${pen.mes}${pico && pico !== ult ? ` e ${br(pico.impressoesMarca)} no pico (${pico.mes})` : ""}`
          : "";
      const zerados = meses.filter((m) => m.diasZero > 0);
      // A consulta de marca mais vista, da leitura por termo que a penetração já fez.
      const termos = termosGsc && !("erro" in termosGsc) ? termosGsc.linhas : [];
      const ehMarca = (t: string) => new RegExp(decl.padrao, "i").test(t);
      const topoMarca = termos.filter((l) => ehMarca(l.termo)).sort((a, b) => b.impressoes - a.impressoes)[0];
      // Medido em 21/09/2026: o site virou usealigner.com e o título da home diz "Use Aligner", mas
      // a marca declarada ainda é `atma*`. Busca pelo nome do domínio cairia em NÃO-marca.
      const nomeDoDominio = (hosts[0] ?? "").replace(/^www\./, "").split(".")[0];
      const dominioFora = nomeDoDominio && !ehMarca(nomeDoDominio);
      const comODominio = termos.filter((l) => l.termo.replace(/\s+/g, "").toLowerCase().includes(nomeDoDominio));
      filho = {
        id: "buscasDeMarca-medido",
        topic: `Medido: ${pct1(razao)} das impressões do corte ${decl.pais} são de marca${direcao}`,
        note: `Série gravada em \`hub_gsc_dia\`, ${comMarca[0].dia} → ${comMarca[comMarca.length - 1].dia}: ${br(soma("impressoesMarca"))} impressões de marca em ${br(soma("impressoesPais"))} do corte ${decl.pais}, a mesma série, janela e função (\`razaoDeMarca\`) da aba de aquisição. Termos de marca: ${decl.termos.join(", ")}. A meta do board é direção (volume mensal crescente), então o nó abre também com os meses. Meses fechados (calendário completo e 3 dias de folga, \`mesesFechados\`): ${meses.map((m) => `${m.mes} ${br(m.impressoesMarca)}`).join(" · ")}.${pen && ult && pen.impressoesMarca > 0 ? ` De ${pen.mes} para ${ult.mes}: ${ult.impressoesMarca > pen.impressoesMarca && ult.impressoesMarca < 11 * pen.impressoesMarca ? "+" : ""}${variacao(ult.impressoesMarca / pen.impressoesMarca - 1)}.` : ""}${pico && ult && pico !== ult ? ` ${ult.mes} está em ${pct1(ult.impressoesMarca / pico.impressoesMarca)} do pico de ${pico.mes}.` : ""} Impressão de marca mede a busca pelo nome só enquanto o site aparece para ela: um mês com o site fora do índice cai sem ninguém ter deixado de buscar.${zerados.length ? ` Dias sem nenhuma impressão de marca: ${zerados.map((m) => `${br(m.diasZero)} em ${m.mes}`).join(", ")}.` : ""}${topoMarca ? ` Na janela de 28 dias, a consulta de marca mais vista é «${topoMarca.termo}», ${br(topoMarca.impressoes)} impressões${topoMarca.posicao === null ? "" : ` na posição ${topoMarca.posicao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}`}.` : ""}${dominioFora ? ` ⚠️ O domínio é ${hosts[0]} e nenhum termo declarado cobre «${nomeDoDominio}»: a busca pelo nome do domínio conta como NÃO-marca. Na janela de 28 dias, ${comODominio.length ? `${br(comODominio.length)} consulta(s) o contêm` : "nenhuma consulta o contém"}. Quando passar a ser buscado, declarar em \`marca.termos\` e refazer o backfill, senão ele infla o crescimento não-marca.` : ""} “Crescente” é direção, não faixa, e o selo ◇ diz por quê.`,
      };
    }
    marcaNode.children = [filho, ...(marcaNode.children ?? [])];
  }

  // 046 — o footprint na folha que o define. MESMA função e MESMA leitura da aba de aquisição
  // (`consultasUnicas` sobre consulta×página), então as duas telas publicam o mesmo número por
  // construção. Medido na Atma em 21/09/2026: 887 aqui e 887 na dimensão `query` sozinha. ⚠️ Não
  // trocar por `termosGsc`: as linhas de lá trazem `termo`, e `consultasUnicas` sobre elas conta 1.
  //
  // O topo abre pelos ABSOLUTOS das duas janelas, nunca pela razão: a base de 13 semanas atrás passa
  // pela desindexação de junho (a janela fechando em 24/07 tem 6 consultas contra 915 na seguinte), e
  // ali a razão mede a VOLTA. A regra de base interrompida da 036 (1/3 dos dias em zero) não pega
  // esse caso — a janela morta teve 2 dias em zero, o resto a 10–20 impressões/dia. A razão desce
  // para a nota ao lado das impressões do site em cada janela, que é o que denuncia a base derrubada.
  const cuNode = acharNo(dados.nodeData as No, "consultasUnicas");
  if (cuNode) {
    const base = consultasBase ? await consultasBase : null;
    let filho: No;
    if (!consultasGsc || "erro" in consultasGsc) {
      filho = {
        id: "consultasUnicas-medido",
        topic: `∅ não apurado · ${consultasGsc ? "a leitura do Search Console falhou" : "sem leitura do Search Console"}`,
        note: consultasGsc
          ? `Falha transitória, não ausência de dado: ${consultasGsc.erro}. A medida volta na próxima leitura.`
          : `${motivoDeAusencia({ ligado: gscLigado(), hosts })}. Sem a leitura não há consulta para contar, e "0 consultas" leria como site que ninguém encontra.`,
      };
    } else {
      const linhas = consultasGsc.linhas;
      const atual = consultasUnicas(linhas).valor;
      const anterior = base && !("erro" in base) ? consultasUnicas(base.linhas).valor : null;
      const porHost = hosts
        .map((h) => `${br(new Set(linhas.filter((l) => l.hosts.includes(h)).map((l) => l.query)).size)} em ${h}`)
        .join(", ");
      const porConsulta = new Map<string, number>();
      for (const l of linhas) porConsulta.set(l.query, (porConsulta.get(l.query) ?? 0) + l.impressoes);
      const cauda = [...porConsulta.values()].filter((v) => v === 1).length;
      const nomeadas = totalImpressoes(linhas);
      const site = paginasGsc && !("erro" in paginasGsc) ? totalImpressoes(paginasGsc.paginas) : null;
      const noSite = (j: { inicio: string; fim: string }) =>
        Array.isArray(serie) ? serie.filter((d) => d.dia >= j.inicio && d.dia <= j.fim).reduce((a, d) => a + d.impressoes, 0) : null;
      const [impBase, impAtual] = [noSite(janelaBase), noSite(janela)];
      const trimestre =
        anterior === null
          ? ` A janela de 13 semanas antes (${janelaBase.inicio} → ${janelaBase.fim}) não foi lida${base && "erro" in base ? `: ${base.erro}` : ""}, então não há variação trimestral.`
          : ` Na mesma janela 13 semanas antes (${janelaBase.inicio} → ${janelaBase.fim}), mesma leitura: ${br(anterior)}${anterior > 0 ? `, ${atual > anterior && atual < 11 * anterior ? "+" : ""}${variacao(atual / anterior - 1)} no trimestre` : ", e sem base não há variação"}.${impBase !== null && impAtual !== null ? ` O site teve ${br(impBase)} impressões naquela janela e ${br(impAtual)} nesta (série \`hub_gsc_dia\`): se a base caiu junto, a variação mede a volta do site ao índice, não amplitude nova.` : ""}`;
      filho = {
        id: "consultasUnicas-medido",
        topic: `Medido: ${br(atual)} consultas com ≥ 1 impressão (piso)${anterior === null ? "" : ` · ${br(anterior)} na mesma janela 13 semanas antes`}`,
        note: `${br(atual)} consultas distintas tiveram ao menos uma impressão na janela ${janela.inicio} → ${janela.fim} (28 dias, fecha em D-3), somados os hosts declarados: ${porHost}.${consultasGsc.truncado ? " ⚠️ A leitura bateu no teto de linhas da API em pelo menos um host." : ""} PISO, não total: ${site ? `as consultas nomeadas somam ${br(nomeadas)} das ${br(site)} impressões que a leitura por página conta (${pct1(nomeadas / site)}); o resto` : "parte das impressões"} vem de consultas que o Search Console omite por privacidade, e quantas são não se sabe. ${br(cauda)} delas tiveram uma única impressão e entram e saem da contagem por acaso.${trimestre} Mesma função e mesma leitura da aba de aquisição, então o número é o mesmo nas duas telas. Meta do board: 10% a 20% ao trimestre — meta, não régua: o crescimento esperado depende da idade do site (novo cresce 200%, maduro 3%, e os dois podem ir bem).`,
      };
    }
    // À FRENTE da definição, como as folhas vizinhas. Sem glifo de veredito: `balizador.tipo` é `recusa`.
    cuNode.children = [filho, ...(cuNode.children ?? [])];
  }

  // 047 — o Top 20 na folha que o define, sobre as DUAS leituras que já estão em memória: zero
  // requisição nova. O absoluto ("O que mede" do board) sai de `noTop20` sobre consulta×página, a
  // MESMA função e a MESMA leitura da aba de aquisição — uma consulta entra se alguma página dela
  // está entre 1,0 e 20,0. A fração do catálogo ("Meta: 60% do catálogo") sai da leitura por termo
  // contra o inventário congelado da 034, a MESMA base da penetração no Top 3, para as duas frações
  // serem comparáveis. Medido na Atma em 21/09/2026: 755 aqui, 751 na dimensão `query` sozinha, e
  // 363 de 725 termos do inventário (50,1%). ⚠️ `noTop20` sobre `termosGsc` conta 0 ou 1: as linhas
  // de lá trazem `termo`, não `query` — a mesma armadilha anotada na 046.
  const t20Node = acharNo(dados.nodeData as No, "top20");
  if (t20Node) {
    let filho: No;
    if (!consultasGsc || "erro" in consultasGsc) {
      filho = {
        id: "top20-medido",
        topic: `∅ não apurado · ${consultasGsc ? "a leitura do Search Console falhou" : "sem leitura do Search Console"}`,
        note: consultasGsc
          ? `Falha transitória, não ausência de dado: ${consultasGsc.erro}. A medida volta na próxima leitura.`
          : `${motivoDeAusencia({ ligado: gscLigado(), hosts })}. Sem a leitura não há posição para contar, e "0 consultas no Top 20" leria como site fora da primeira e da segunda página.`,
      };
    } else {
      const linhas = consultasGsc.linhas;
      const atual = noTop20(linhas);
      const lidas = consultasUnicas(linhas).valor;
      const porHost = hosts.map((h) => `${br(noTop20(linhas.filter((l) => l.hosts.includes(h))))} em ${h}`).join(", ");
      const dentro = new Set(linhas.filter((l) => l.posicao >= 1 && l.posicao <= 20).map((l) => l.query));
      const porConsulta = new Map<string, number>();
      for (const l of linhas) if (dentro.has(l.query)) porConsulta.set(l.query, (porConsulta.get(l.query) ?? 0) + l.impressoes);
      const cauda = [...porConsulta.values()].filter((v) => v === 1).length;
      const termos = termosGsc && !("erro" in termosGsc) ? termosGsc.linhas : null;
      const porTermo = termos ? termos.filter((l) => typeof l.posicao === "number" && l.posicao >= 1 && l.posicao <= 20).length : null;
      const cat = termos ? penetracaoNoInventario(termos, inventario, 20) : null;
      const catalogo = cat
        ? ` CATÁLOGO: ${br(cat.dentro)} dos ${br(cat.total)} termos do inventário estão entre 1,0 e 20,0 (${pct1(cat.fracao)}), na leitura por termo que a penetração no Top 3 usa sobre o mesmo inventário (congelado em ${inventario!.procedencia.congeladoEm}, sem a marca própria).${cat.piso ? ` Só ${br(cat.cobertura)} deles tiveram impressão nesta janela, então a fração é PISO: os ${br(cat.total - cat.cobertura)} ausentes contam no denominador e não podem contar no numerador.` : ""}`
        : ` A fração do catálogo não foi apurada: ${!inventario ? "o projeto não declara inventário de termos, e sem a lista não existe denominador" : termosGsc && "erro" in termosGsc ? `a leitura por termo falhou (${termosGsc.erro})` : "sem a leitura por termo"}.`;
      filho = {
        id: "top20-medido",
        topic: `Medido: ${br(atual)} consultas entre as posições 1,0 e 20,0 (piso)${cat ? ` · ${pct1(cat.fracao)} do inventário (${br(cat.dentro)} de ${br(cat.total)} termos)` : ""}`,
        note: `${br(atual)} das ${br(lidas)} consultas lidas tiveram ao menos uma página entre as posições 1,0 e 20,0 na janela ${janela.inicio} → ${janela.fim} (28 dias, fecha em D-3), somados os hosts declarados: ${porHost}.${consultasGsc.truncado ? " ⚠️ A leitura bateu no teto de linhas da API em pelo menos um host." : ""} PISO, não total: a dimensão \`query\` do Search Console omite as consultas raras. ${br(cauda)} delas tiveram uma única impressão e entram e saem da contagem por acaso. Mesma função e mesma leitura consulta×página da aba de aquisição, então o número é o mesmo nas duas telas${porTermo === null ? "" : `; na dimensão \`query\` sozinha, onde o Google agrega a posição do termo entre as páginas, são ${br(porTermo)}`}.${catalogo} Meta do board: 60% do catálogo dentro do Top 20 — meta, não régua: o catálogo é escolhido por quem mede, então não há faixa de mercado para julgar contra.`,
      };
    }
    // À FRENTE da definição, como as folhas vizinhas. Sem glifo de veredito: `balizador.tipo` é `recusa`.
    t20Node.children = [filho, ...(t20Node.children ?? [])];
  }

  // 048 — Query-to-Page na folha que o define, zero requisição nova: o numerador é a leitura
  // consulta×página da 046 e o denominador é a apuração de indexação da 043. MESMA função
  // (`queryToPageRatio`) e MESMA guarda da aba de aquisição — sem denominador quando a corrida
  // amostrou o sitemap —, então as duas telas publicam o mesmo número. Medido na Atma em 21/09/2026:
  // 887 ÷ 18 = 49,3. O topo abre também pela CONCENTRAÇÃO porque a média mente aqui: 814 das 887
  // consultas aparecem num único post, e sem ele a média cai para dentro da faixa de nenhuma das
  // duas metas do board.
  const qpNode = acharNo(dados.nodeData as No, "queryToPage");
  if (qpNode) {
    const denominador =
      apuracao && !apuracao.motivo && apuracao.inspecionadas >= apuracao.declaradas && apuracao.indexadas > 0 ? apuracao.indexadas : null;
    const semDenominador = semApuracao
      ?? (apuracao!.inspecionadas < apuracao!.declaradas
        ? `a corrida de ${apuracao!.dia} amostrou ${br(apuracao!.inspecionadas)} de ${br(apuracao!.declaradas)} URLs do sitemap, e a contagem da amostra não divide consulta do site inteiro`
        : `a corrida de ${apuracao!.dia} não achou URL indexada${apuracao!.falhas ? ` (${br(apuracao!.falhas)} inspeções falharam)` : ""}`);
    let filho: No;
    if (!consultasGsc || "erro" in consultasGsc) {
      filho = {
        id: "queryToPage-medido",
        topic: `∅ não apurado · ${consultasGsc ? "a leitura do Search Console falhou" : "sem leitura do Search Console"}`,
        note: consultasGsc
          ? `Falha transitória, não ausência de dado: ${consultasGsc.erro}. A medida volta na próxima leitura.`
          : `${motivoDeAusencia({ ligado: gscLigado(), hosts })}. Sem a leitura não há consulta para dividir.`,
      };
    } else {
      const linhas = consultasGsc.linhas;
      const lidas = consultasUnicas(linhas).valor;
      const r = denominador === null ? null : queryToPageRatio(linhas, denominador);
      const porUrl = new Map<string, Set<string>>();
      for (const l of linhas) porUrl.set(l.page, (porUrl.get(l.page) ?? new Set<string>()).add(l.query));
      const [topo, doTopo] = [...porUrl].sort((a, b) => b[1].size - a[1].size)[0] ?? ["", new Set<string>()];
      const resto = new Set(linhas.filter((l) => l.page !== topo).map((l) => l.query)).size;
      const ns = [...porUrl.values()].map((s) => s.size).sort((a, b) => a - b);
      const mediana = ns.length ? (ns[(ns.length - 1) >> 1] + ns[ns.length >> 1]) / 2 : 0;
      const topoPorHost = hosts.map((h) => `${br(new Set(linhas.filter((l) => l.page === topo && l.hosts.includes(h)).map((l) => l.query)).size)} em ${h}`).join(", ");
      const ativas = paginasGsc && !("erro" in paginasGsc) ? urlsComImpressao(paginasGsc.paginas) : null;
      const concentracao = topo
        ? ` ${br(doTopo.size)} das ${br(lidas)} consultas aparecem numa única URL, ${caminhoDe(topo)} (${topoPorHost}); sem ela sobram ${br(resto)} consultas para as outras ${br(porUrl.size - 1)} URLs com consulta nomeada. A mediana entre as ${br(porUrl.size)} é ${mediana.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}: a média descreve um post, não o site.`
        : "";
      const pontas = ` O numerador conta consulta de QUALQUER URL que o Google exibiu na janela, pelos hosts declarados; o denominador é o que a corrida de indexação acha no índice do sitemap de hoje. Os dois não são o mesmo conjunto de URLs, e a razão sobe quando um domínio antigo ainda rende impressão de página que o novo não indexou.${ativas ? ` Contra as ${br(ativas)} URLs com impressão na leitura por página, seriam ${(lidas / ativas).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}.` : ""}`;
      const metas = " Metas do board: 30 a 80 consultas por URL para artigo/blog e 10 a 25 para produto/landing — metas, não régua: as duas pontas da divisão variam com o nicho. A apuração de indexação grava o agregado, sem o estado por URL, então o denominador não se separa por tipo de página e a média do site não se compara com nenhuma das duas faixas.";
      filho = r
        ? {
            id: "queryToPage-medido",
            topic: `Medido: ${r.valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} consultas por URL indexada (piso) · ${br(lidas)} ÷ ${br(denominador!)}${topo ? ` · ${br(doTopo.size)} delas numa única URL` : ""}`,
            note: `${br(lidas)} consultas distintas com impressão na janela ${janela.inicio} → ${janela.fim} (28 dias, fecha em D-3), leitura consulta×página, divididas pelas ${br(denominador!)} URLs do sitemap que a corrida de ${apuracao!.dia} achou no índice (${br(apuracao!.inspecionadas)} inspecionadas, propriedade ${apuracao!.propriedade ?? "—"}). PISO: o Search Console omite as consultas raras do numerador.${consultasGsc.truncado ? " ⚠️ A leitura bateu no teto de linhas da API em pelo menos um host." : ""}${concentracao}${pontas} Mesma função e mesmo denominador da aba de aquisição, então o número é o mesmo nas duas telas.${metas}`,
          }
        : {
            id: "queryToPage-medido",
            topic: `∅ razão não apurada · ${br(lidas)} consultas, sem denominador`,
            note: `O numerador existe: ${br(lidas)} consultas distintas com impressão na janela ${janela.inicio} → ${janela.fim}.${concentracao} O denominador não: ${semDenominador}. Dividir por um número chutado publicaria uma razão falsa, e a contagem de URLs com impressão não é a de URLs indexadas.`,
          };
    }
    // À FRENTE da definição, como as folhas vizinhas. Sem glifo de veredito: `balizador.tipo` é `recusa`.
    qpNode.children = [filho, ...(qpNode.children ?? [])];
  }

  // 049 — Active Index Ratio na folha que o define, zero requisição nova: leitura por página (033),
  // apuração de indexação (043) e sitemap URL a URL da corrida de página (024). A fórmula literal
  // publica 29 ÷ 18 = 161% na Atma (e por isso `activeIndexRatio` devolve null na aba de aquisição):
  // o numerador soma os dois domínios e URL que o sitemap não declara, e o denominador é o índice do
  // sitemap novo. Aqui o numerador fica no MESMO conjunto do denominador: URL do sitemap com impressão
  // PELO HOST NOVO, e uma URL só é exibida pelo Google se está no índice. MESMA função, entrada
  // restrita. Medido em 21/09/2026: 14 ÷ 18 = 77,8%, e a inspeção URL a URL fecha as 4 que faltam.
  const airNode = acharNo(dados.nodeData as No, "activeIndexRatio");
  if (airNode) {
    const hostNovo = hosts[0];
    const lidas = paginasGsc && !("erro" in paginasGsc) ? paginasGsc.paginas : null;
    const falta =
      paginasGsc === null
        ? motivoDeAusencia({ ligado: gscLigado(), hosts })
        : "erro" in paginasGsc
          ? `a leitura por página do Search Console falhou (${paginasGsc.erro})`
          : semApuracao ??
          (apuracao!.inspecionadas < apuracao!.declaradas
            ? `a corrida de ${apuracao!.dia} amostrou ${br(apuracao!.inspecionadas)} de ${br(apuracao!.declaradas)} URLs do sitemap, e a contagem da amostra não é o total indexado`
            : apuracao!.indexadas === 0
              ? `a corrida de ${apuracao!.dia} não achou URL indexada`
              : !corrida
                ? "sem corrida de página gravada: é ela que lista as URLs do sitemap, e sem a lista o numerador não se restringe ao denominador"
                : null);
    let filho: No;
    if (falta) {
      filho = {
        id: "activeIndexRatio-medido",
        topic: `∅ não apurado · ${falta}`,
        note: "A razão pede duas leituras do mesmo conjunto de URLs: as do sitemap que a corrida de indexação achou no índice (denominador) e, entre elas, as que tiveram impressão em 28 dias (numerador). Faltando qualquer uma, o número não existe, e “não apurado” nunca é 0%.",
      };
    } else {
      const a = apuracao!;
      const sitemap = new Set(corrida!.paginas.filter((pg) => pg.noSitemap).map((pg) => canonizar(pg.url, p.url) ?? pg.url));
      const doHostNovo = lidas!
        .filter((pg) => pg.impressoes > 0 && pg.hosts?.includes(hostNovo))
        .map((pg) => ({ ...pg, pagina: canonizar(pg.pagina, p.url) ?? pg.pagina }));
      const ativas = doHostNovo.filter((pg) => sitemap.has(pg.pagina));
      const r = activeIndexRatio(ativas, a.indexadas);
      const comImpressao = new Set(ativas.map((pg) => pg.pagina));
      const semImpressao = [...sitemap].filter((u) => !comImpressao.has(u)).map(caminhoDe).sort();
      const foraDoSitemap = [...new Set(doHostNovo.filter((pg) => !sitemap.has(pg.pagina)).map((pg) => caminhoDe(pg.pagina)))].sort();
      const literal = urlsComImpressao(lidas!);
      const anterior = p.dominioAnterior;
      const troca =
        anterior && diaUtc(anterior.data) > diaUtc(janela.inicio) && diaUtc(anterior.data) <= diaUtc(janela.fim)
          ? ` O domínio novo entrou em ${anterior.data}, então ele tem só ${diaUtc(janela.fim) - diaUtc(anterior.data) + 1} dos 28 dias da janela: URL que entrou no índice depois disso teve poucos dias para aparecer.`
          : "";
      const n = comImpressao.size;
      const semNoIndice = a.indexadas - n;
      const fora = a.rastreadasNaoIndexadas + a.descobertasNaoIndexadas + a.outras;
      // Só fecha se as duas corridas leram o MESMO sitemap: a de página grava a lista, a de
      // indexação só o agregado. Lista de tamanho diferente não autoriza a partilha.
      const partilha =
        sitemap.size === a.declaradas && !a.falhas && semImpressao.length === fora + semNoIndice
          ? ` ${br(fora)} delas estão fora do índice pela corrida, e as outras ${br(semNoIndice)} são as indexadas sem impressão. A apuração grava o agregado, sem o estado por URL, então esta tela não diz quais são.`
          : ` ${br(semNoIndice)} das indexadas não tiveram impressão.`;
      filho = r !== null
        ? {
            id: "activeIndexRatio-medido",
            topic: `Medido: ${pct1(r)} · ${br(n)} de ${br(a.indexadas)} URLs indexadas do sitemap com impressão · ${br(semNoIndice)} sem`,
            note: `${br(n)} URLs do sitemap tiveram ao menos uma impressão por ${hostNovo} na janela ${janela.inicio} → ${janela.fim} (leitura por página, que não omite URL rara), divididas pelas ${br(a.indexadas)} que a corrida de ${a.dia} achou no índice (${br(a.inspecionadas)} de ${br(a.declaradas)} inspecionadas, propriedade ${a.propriedade ?? "—"}). Uma URL só recebe impressão se está no índice, então o numerador cabe no denominador.${troca} As ${br(semImpressao.length)} URLs do sitemap sem impressão no domínio novo: ${semImpressao.join(", ")}.${partilha} A fórmula literal dá ${br(literal)} ÷ ${br(a.indexadas)}: ${br(literal)} são todos os caminhos com impressão pelos ${br(hosts.length)} hosts declarados, com URL que o sitemap não declara e página que só o domínio antigo ainda exibe. Passa de 100% e não mede o índice.${foraDoSitemap.length ? ` ${br(foraDoSitemap.length)} URLs do domínio novo tiveram impressão sem estar no sitemap (${foraDoSitemap.join(", ")}): estão no índice e ficam fora das duas pontas. Com elas nos dois lados seriam ${pct1((n + foraDoSitemap.length) / (a.indexadas + foraDoSitemap.length))}.` : ""} Meta do board: ≥ 70%. É meta, não régua: a razão cai com a idade do site, e quem publica rápido carrega URL nova ainda sem impressão.`,
          }
        : {
            id: "activeIndexRatio-medido",
            topic: `∅ razão não apurada · ${br(n)} URLs do sitemap com impressão, ${br(a.indexadas)} indexadas`,
            note: `O numerador passou do denominador, o que só acontece se o índice encolheu entre a janela (${janela.inicio} → ${janela.fim}) e a corrida de ${a.dia}. Uma razão acima de 100% leria como meta folgada.`,
          };
    }
    // À FRENTE da definição, como as folhas vizinhas. Sem glifo de veredito: `balizador.tipo` é `recusa`.
    airNode.children = [filho, ...(airNode.children ?? [])];
  }

  // 050 — o TAM de busca como ESTIMATIVA, porque o hub não lê volume de mercado (`balizador` segue
  // `semColetor`). O id termina em `-estimado` e não entra no contador de folhas medidas. O pico de
  // impressões de cada termo em 9 janelas de 28 dias é piso do volume dele (`data/demanda-estimada.json`),
  // e a leitura por termo da janela já está em memória: zero requisição nova. Medido em 21/09/2026:
  // 8.749 ÷ 55.278 = 15,8%. A versão por posição (termo no Top 20 ponderado pelo pico) dá 72,9%, dentro
  // da meta do board, porque a posição do GSC só conta as buscas em que o site apareceu.
  const tamNode = acharNo(dados.nodeData as No, "tamBusca");
  if (tamNode) {
    const est = (DEMANDAS as Record<string, { procedencia: { congeladoEm: string; inventarioCongeladoEm: string; janelas: { inicio: string; fim: string; impressoes: number }[] }; termos: Record<string, number> } | undefined>)[slug];
    const falta = !inventario
      ? "inventário de termos não declarado para este projeto"
      : !est
        ? "sem demanda estimada declarada para este projeto"
        : est.procedencia.inventarioCongeladoEm !== inventario.procedencia.congeladoEm
          ? `a estimativa de demanda é do inventário de ${est.procedencia.inventarioCongeladoEm}, e o inventário em uso é de ${inventario.procedencia.congeladoEm}`
          : !termosGsc
            ? "sem leitura do Search Console"
            : "erro" in termosGsc
              ? `a leitura do Search Console falhou (${termosGsc.erro})`
              : null;
    let filho: No;
    const c = falta ? null : coberturaDaDemanda((termosGsc as { linhas: { termo: string; impressoes: number; posicao: number | null }[] }).linhas, est!.termos);
    if (!c) {
      filho = {
        id: "tamBusca-estimado",
        topic: `∅ não estimado · ${falta ?? "a estimativa de demanda está vazia"}`,
        note: "A estimativa divide as impressões da janela pelo pico de impressões de cada termo do inventário, congelado por `scripts/estimar-demanda.mjs`. Faltando o inventário, a estimativa ou a leitura, o número não existe, e “não estimado” nunca é 0%. Se o inventário for refeito, a estimativa tem de ser refeita junto: pico de um inventário não divide impressão de outro.",
      };
    } else {
      const p = est!.procedencia;
      const linhas = (termosGsc as { linhas: { termo: string; posicao: number | null }[] }).linhas;
      const naFronteira = new Set(linhas.filter((l) => typeof l.posicao === "number" && l.posicao >= 1 && l.posicao <= 20).map((l) => l.termo));
      const porPosicao = c.buracos.filter((b) => naFronteira.has(b.termo)).reduce((a, b) => a + b.pico, 0) / c.demanda;
      const maior = p.janelas.reduce((a, j) => (j.impressoes > a.impressoes ? j : a));
      const top = c.buracos.slice(0, 5);
      const faltam = c.demanda - c.impressoes;
      const posDe = (t: string) => {
        const l = linhas.find((x) => x.termo === t);
        return l && typeof l.posicao === "number" ? ` na posição ${l.posicao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}` : "";
      };
      filho = {
        id: "tamBusca-estimado",
        topic: `Estimativa: ${pct1(c.fracao)} da demanda (teto) · ${br(c.impressoes)} de ${br(c.demanda)} impressões em 28 dias · proxy pelo GSC, não volume de mercado`,
        note: `${br(c.impressoes)} impressões dos ${br(c.termos)} termos do inventário na janela ${janela.inicio} → ${janela.fim} (28 dias, fecha em D-3), somados os hosts declarados, divididas pela demanda estimada: para cada termo, o maior número de impressões que ele teve numa janela de 28 dias entre ${p.janelas[0].inicio} e ${p.janelas[p.janelas.length - 1].fim} (${br(p.janelas.length)} janelas, congeladas em ${p.congeladoEm}), ou o de hoje, se for maior. ESTIMATIVA, não medida: o Search Console não informa volume de busca. Impressão só existe onde houve busca, então o pico de cada termo é um piso do volume dele. Como o denominador fica abaixo do real, a razão é TETO. O volume de mercado viria do Google Ads ou de uma base paga, e o hub não lê nenhum dos dois: por isso a folha continua sem coletor. Na janela de maior alcance (${maior.inicio} → ${maior.fim}) as mesmas contas davam ${pct1(maior.impressoes / c.demanda)}, número alto por construção, porque foi essa janela que definiu a maior parte dos picos. Maiores buracos: ${top.map((b) => `«${b.termo}» ${br(b.hoje)} de ${br(b.pico)}${posDe(b.termo)}`).join(", ")}. Os cinco somam ${br(top.reduce((a, b) => a + b.pico - b.hoje, 0))} das ${br(faltam)} impressões que faltam. Por posição, contando o pico dos termos entre 1,0 e 20,0 hoje, seriam ${pct1(porPosicao)}. Esse número não é usado porque a posição do GSC é a média só das buscas em que o site apareceu: termo na posição 3 com um punhado de impressões conta como coberto. Meta do board: 60% a 80% dos clusters de maior volume. É meta, não régua, e o hub não agrupa termos em cluster, então a estimativa soma termo a termo, como o “O que mede” do board.`,
      };
    }
    // À FRENTE da definição, como as folhas vizinhas. Sem glifo de veredito: é estimativa e não tem régua.
    tamNode.children = [filho, ...(tamNode.children ?? [])];
  }

  // ── 051/US3: a fila 80/20, sobre valores que a página JÁ leu — nenhuma requisição nova ─────────
  const fila = filaDoMapa({
    abaixo: conformidade ? conformidade.abaixo : null,
    largura,
    vitais: ["lcp", "inp", "cls", "ttfb"].map((id) => {
      const limite = (CATALOGO as Record<string, { balizador: { limite?: number } }>)[id].balizador.limite as number;
      if (!lidoCampo) return { chave: id, valor: null, limite, falhou: true };
      const r = vitalPorOrigem(lidoCampo.origens, id) as { estado: string; medida?: { p75: number } };
      if (r.estado === "medido") return { chave: id, valor: r.medida!.p75, limite };
      return { chave: id, valor: null, limite, falhou: r.estado === "falhou" || r.estado === "sem-chave" };
    }),
  });

  // ── 051/US1: a cadeia depois do clique, com a conta de /okr/atma ───────────────────────────────
  // Só CONTAGENS (FR-012): valor em reais não entra no mapa. E nenhuma taxa até o clique (FR-003) —
  // o clique lê 28 dias fechando em D-3, a cadeia lê a época da Atma.
  const fichaLida = await fichaAtma;
  const erroDaFicha = fichaLida && "erro" in fichaLida ? fichaLida.erro : null;
  const cadeia = fichaLida && !("erro" in fichaLida) && fichaLida.marcosCadeia.length ? fichaLida : null;
  // 052/FR-010 — sem cadeia LIGADA (`cadeiaDoPerfil.ligada`, research D3), o painel nomeia os
  // degraus sem coletor e não calcula taxa nenhuma. `semColetor` vazio só ocorre com perfil sem
  // degraus ou desconhecido (`cadeiaLigada` devolve `[]`), e aí a frase é genérica.
  const listaSemColetor = new Intl.ListFormat("pt-BR", { type: "conjunction" }).format(cadeiaDoPerfil.semColetor);
  const semCadeiaLigada = "O perfil deste projeto não declara degraus de conversão, então não há cadeia para ligar ao clique.";
  const valorDoMarco = (m: { celula: { valor: number } | { naoApurado: string } }) => ("valor" in m.celula ? String(m.celula.valor) : "?");
  const cliqueRamo = acharNo(dados.nodeData as No, "clique");
  if (cliqueRamo) {
    const noDaCadeia: No = !cadeiaDoPerfil.ligada
      ? {
          id: "depois-do-clique",
          topic: cadeiaDoPerfil.semColetor.length
            ? `→ Depois do clique · ∅ sem cadeia de R$ ligada ao hub: ${listaSemColetor} não têm coletor`
            : "→ Depois do clique · ∅ sem cadeia de R$ ligada ao hub",
          note: cadeiaDoPerfil.semColetor.length
            ? `∅ sem cadeia de R$ ligada ao hub: ${listaSemColetor} não têm coletor. Nenhuma taxa é calculada sem coletor nos dois lados de uma etapa (FR-010).`
            : semCadeiaLigada,
        }
      : cadeia
        ? {
            id: "depois-do-clique",
            topic: `→ Depois do clique: ${cadeia.marcosCadeia.map(valorDoMarco).join(" → ")}`,
            tags: ["soma · cada degrau sai do anterior", ...(cadeia.veredito.celula ? [`trava em ${cadeia.veredito.celula}`] : [])],
            note: `A mesma cadeia de /okr/${slug}, com a mesma conta: ${cadeia.marcosCadeia.map((m) => `${valorDoMarco(m)} ${m.nome}`).join(" → ")}. Janela ${cadeia.janelas.conversao.inicio} → ${cadeia.janelas.conversao.fim} — ${cadeia.janelas.conversao.porque}. É soma porque cada degrau é um pedaço do anterior. Não há taxa até o clique: o clique lê 28 dias fechando em D-3 e a cadeia lê a época, e dividir um pelo outro seria dividir períodos diferentes.`,
          }
        : {
            id: "depois-do-clique",
            topic: `→ Depois do clique · ∅ ${erroDaFicha ? "erro na fonte" : "sem cadeia"}`,
            note: erroDaFicha
              ? `A composição de /okr/${slug} falhou agora (${erroDaFicha}). Não é cadeia zerada: a leitura volta na próxima abertura.`
              : semCadeiaLigada,
          };
    cliqueRamo.children = [...(cliqueRamo.children ?? []), noDaCadeia];
  }
  // G3/G25 — a hora da apuração (a tela lê ao abrir) e o crawl que estourou a promessa diária:
  // mesma tolerância de 2 dias de /okr/[slug]/aquisicao desde que o crawl virou diário.
  const apuradoEm = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const crawlAtrasado = corrida ? (Date.now() - Date.parse(`${corrida.dia}T00:00:00Z`)) / 864e5 > 2 : false;
  const porClasse = (Object.keys(CLASSES) as (keyof typeof CLASSES)[]).map((k) => ({
    k,
    n: Object.values(CATALOGO as Record<string, { classe?: string }>).filter((i) => i.classe === k).length,
  }));

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

        {/* 052/US3/FR-011 — o seletor entre os projetos com mapa: mesmas classes de `Tabs`
            (`.tabs`/`.nav-grupo`/`.tab`), reaproveitadas aqui como em `quadro.tsx` — zero CSS novo.
            O item atual não é link (`aria-current="page"` num `<span>`), só com o teclado um Tab
            alcança o outro projeto e Enter abre (SC-006). */}
        {projetosComMapa.length > 1 && (
          <nav className="tabs" aria-label="Projetos com mapa">
            <div className="nav-grupo">
              <ul>
                {projetosComMapa.map((x) => (
                  <li key={x.slug}>
                    {x.slug === slug ? (
                      <span className="tab active" aria-current="page">
                        {x.nome.split(" — ")[0]}
                      </span>
                    ) : (
                      <a className="tab" href={`/gsc/mapa/${x.slug}`}>
                        {x.nome.split(" — ")[0]}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        )}

        {/* ── 051 · A RESPOSTA ANTES DA PROSA ─────────────────────────────────────────────────────
            O painel responde UMA pergunta: onde o trabalho de busca da Atma rende mais, e ele chega
            ao dinheiro? Nível 1 é a cadeia — a lição da BSC, medida que não chega ao resultado é
            lista. Nível 2 é a fila (80/20). Nível 3 é a legenda. A prosa do board vem depois. */}
        <div className="mapa-resposta">
          {/* G24 — sem cadeia o bloco guarda a altura: a fila não sobe para o lugar da resposta. */}
          <section className={`ficha-bloco mapa-n1${cadeia ? "" : " mapa-n1--ausente"}`} aria-labelledby="mapa-cadeia-h">
            <h2 className="ficha-bloco-h" id="mapa-cadeia-h">
              Depois do clique
            </h2>
            {cadeia ? (
              <>
                <p className="ficha-veredito mapa-n1-resposta">
                  {cadeia.veredito.celula && <strong>{cadeia.veredito.celula}: </strong>}
                  {cadeia.veredito.motivo}
                </p>
                <CadeiaDiagrama
                  marcos={cadeia.marcosCadeia}
                  taxas={cadeia.taxasCadeia}
                  veredito={cadeia.veredito}
                  janela={{ inicio: cadeia.janelas.conversao.inicio, fim: cadeia.janelas.conversao.fim }}
                />
                <p className="foot">
                  Janela da cadeia: <strong>{cadeia.janelas.conversao.inicio} → {cadeia.janelas.conversao.fim}</strong> —{" "}
                  {cadeia.janelas.conversao.porque}. A mesma conta de <a href={`/okr/${slug}`}>{`/okr/${slug}`}</a>.
                  {cliques28 !== null ? (
                    <>
                      {" "}Antes dela, o Search Console contou <strong>{br(cliques28)} cliques</strong> em {janela.inicio} →{" "}
                      {janela.fim}.
                    </>
                  ) : null}{" "}
                  Não há taxa entre os dois números: as janelas são diferentes. Apurado ao abrir a página, em {apuradoEm}.
                </p>
              </>
            ) : !cadeiaDoPerfil.ligada ? (
              <p className="foot">
                ∅ sem cadeia de R$ ligada ao hub:{" "}
                {cadeiaDoPerfil.semColetor.length ? `${listaSemColetor} não têm coletor.` : semCadeiaLigada}
              </p>
            ) : (
              <p className="foot">
                ∅{" "}
                {erroDaFicha
                  ? `erro na fonte — a composição de /okr/${slug} falhou agora (${erroDaFicha}). Não é cadeia zerada.`
                  : semCadeiaLigada}
              </p>
            )}
          </section>

          <section className="ficha-bloco" aria-labelledby="mapa-fila-h">
            <h2 className="ficha-bloco-h" id="mapa-fila-h">
              Primeiro na fila
            </h2>
            {fila.porMoeda.size === 0 ? (
              <p className="foot">Nada abaixo da régua nesta janela.</p>
            ) : (
              [...fila.porMoeda].map(([moeda, itens]) => {
                const topo = Math.abs(itens[0].delta);
                return (
                  <div className="mapa-fila" key={moeda}>
                    {/* G32 — o número mais destacado do bloco diz de quando e de onde veio, no
                        próprio bloco: a janela do cabeçalho da página fica longe demais. */}
                    <h3 className="mapa-fila-h">
                      {ROTULO_DA_MOEDA[moeda] ?? moeda}
                      {moeda === "cliques"
                        ? ` · Search Console, ${janela.inicio} → ${janela.fim}`
                        : moeda === "pp" && corrida
                          ? ` · crawl de página de ${corrida.dia}${crawlAtrasado ? " — atrasado: a corrida é diária" : ""}`
                          : moeda === "ms" || moeda === "cls"
                            ? " · CrUX, p75 de 28 dias"
                            : ""}
                    </h3>
                    <ol className="mapa-fila-lista">
                      {itens.map((it: ItemDaFila, i: number) => (
                        <li key={`${it.chave}-${it.alvo ?? i}`}>
                          <span className="mapa-fila-v">{valorDaFila(moeda, it)}</span>{" "}
                          <span className="mapa-fila-alvo">{it.alvo ? new URL(it.alvo).pathname : cat[it.chave].nome}</span>
                          <span className="mapa-fila-det">{detalheDaFila(moeda, it)}</span>
                          {/* Um tom só: o comprimento já codifica a distância, e ele é o que mostra
                              a concentração que o número sozinho esconde. */}
                          <div className="ficha-barra-trilho" aria-hidden="true">
                            <div className="ficha-barra-preenche" style={{ width: `${topo > 0 ? (Math.abs(it.delta) / topo) * 100 : 0}%` }} />
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })
            )}
            <p className="foot">
              Moedas diferentes não se comparam, e nenhuma lista soma: os degraus de busca não são independentes, e
              somar contaria o mesmo clique duas vezes. Fora da fila: {fila.fora.recusa} folhas sem faixa publicada,{" "}
              {fila.fora.norma} normas (sim ou não, sem distância), {fila.fora.semColetor} sem coletor e{" "}
              {fila.fora.procedimento} procedimento
              {fila.fora.dentroDaRegua.length ? `; dentro da régua: ${nomesDas(fila.fora.dentroDaRegua)}` : ""}
              {fila.fora.semAmostra.length ? `; sem amostra: ${nomesDas(fila.fora.semAmostra)}` : ""}
              {fila.fora.semLeitura.length ? `; sem leitura agora: ${nomesDas(fila.fora.semLeitura)}` : ""}. Também{" "}
              {fila.sobreposicao}.
            </p>
          </section>

          <section className="ficha-bloco" aria-labelledby="mapa-ler-h">
            <h2 className="ficha-bloco-h" id="mapa-ler-h">
              Como ler as etiquetas
            </h2>
            <ul className="mapa-legenda">
              <li>
                <span className="mb-tag">soma</span> a conta fecha: cliques = impressões × CTR em cada faixa de posição, e
                cada degrau da cadeia sai do anterior. Só esses dois nós fecham assim.
              </li>
              {porClasse.map(({ k, n }) => (
                <li key={k}>
                  <span className="mb-tag">{CLASSES[k].rotulo}</span> {n} folhas. {CLASSES[k].nota}
                  {k === "alavanca"
                    ? " A etiqueta nomeia a ação semanal: contar essa ação é o indicador preditivo do 4DX, e o hub ainda não tem fonte para contar."
                    : ""}
                </li>
              ))}
            </ul>
          </section>
        </div>

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
          {/* 052 — qual projeto está medindo, por escrito: a rota resolve o projeto (`p`), e as
              seis faixas de "Posição no Google" (abaixo) medem os hosts dele. */}
          <strong>O que esta tela mede é o projeto {nomeCurto}</strong> — {hostsDeclarados(p).join(" + ")},
          janela {janela.inicio} → {janela.fim} (28 dias, fecha em D-3): as seis faixas de{" "}
          &ldquo;Posição no Google&rdquo; e as <strong>{folhasMedidas} folhas com leitura própria</strong>,
          que abrem com o número antes da definição do board. O board{" "}
          <code>okr-Saw2eoSKZDPLJAk6xeDBuS</code> é de SEO: a mesma definição vale para cada projeto com mapa.{" "}
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
