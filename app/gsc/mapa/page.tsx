import type { Metadata } from "next";
import { CATALOGO, MEDIDO_POR, regua } from "@/lib/gsc-delta.mjs";
import { DIVERGENCIAS, mapaDoBoard, RAMOS } from "@/lib/board-gsc.mjs";
import { listProjects } from "@/lib/projects";
import { hostsDeclarados } from "@/lib/projects.mjs";
import { gscLigado, gscPaginas } from "@/lib/gsc";
import { motivoDeAusencia } from "@/lib/gsc-hosts.mjs";
import { descoberta } from "@/lib/janelas.mjs";
import { porFaixaDePosicao } from "@/lib/kpis-busca.mjs";
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
