import type { Metadata } from "next";
import { CATALOGO, MEDIDO_POR, regua } from "@/lib/gsc-delta.mjs";
import { DIVERGENCIAS, mapaDoBoard, RAMOS } from "@/lib/board-gsc.mjs";
import { listProjects } from "@/lib/projects";
import { hostsDeclarados } from "@/lib/projects.mjs";
import { gscLigado, gscPaginas, gscTermos } from "@/lib/gsc";
import { lerInventario } from "@/lib/inventario.mjs";
import INVENTARIOS from "@/data/inventario-de-termos.json";
import { penetracaoNoTop3, porFaixaDePosicao, strikingDistancePorTermo } from "@/lib/kpis-busca.mjs";
import { motivoDeAusencia } from "@/lib/gsc-hosts.mjs";
import { marcaDeclarada } from "@/lib/marca.mjs";
import { descoberta } from "@/lib/janelas.mjs";

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
  const sdNode = acharNo(dados.nodeData as No, "strikingDistance");
  if (sdNode) {
    // A MESMA construção de marca de `/okr/[slug]/aquisicao` (025/D3): uma fonte só. Duas
    // divergiriam na primeira variante nova, e a tela filtraria por um padrão que não é o exibido.
    // `?? {}` e não `atma!`: sem o card não há marca a declarar, e `motivo: "ausente"` é o estado
    // certo. (Sem o card também não há leitura, então a folha cai no primeiro estado de qualquer
    // forma — mas a medida não pode depender dessa coincidência para não quebrar.)
    const decl = marcaDeclarada(atma ?? {});
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

  const nos = (n: No): number => 1 + (n.children ?? []).reduce((s, f) => s + nos(f), 0);
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
          <strong>As seis faixas de &ldquo;Posição no Google&rdquo; medem a Atma</strong> —{" "}
          {atma ? hostsDeclarados(atma).join(" + ") : "projeto não encontrado"}, janela{" "}
          {janela.inicio} → {janela.fim} (28 dias, fecha em D-3). O board{" "}
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
