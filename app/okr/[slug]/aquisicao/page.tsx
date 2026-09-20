import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listProjects, SLUGS_DE_BUSCA } from "@/lib/projects";
import { hostsDeclarados } from "@/lib/projects.mjs";
import {
  lerIndexacao,
  lerCrawlDePagina,
  lerDiasGsc,
  dbOn,
  type Apuracao,
  type CrawlDePagina,
  type PaginaCrawl,
  type DiaSeparado,
} from "@/lib/db";
import { gscSeries, gscConsultas, gscPaginas } from "@/lib/gsc";
import { mesesDaSerie, janelaDeFoco, assinaturaDeHosts } from "@/lib/serie-gsc.mjs";
import { marcaDeclarada, completude, crescimentoNaoMarca, razaoDeMarca, semanasNaoMarca, ritmoDoSegmentoAtual } from "@/lib/marca.mjs";
import { ga4Canais, ga4Cobertura } from "@/lib/ga4";
import { descobertaLonga, comportamentoLongo, descoberta, comportamento } from "@/lib/janelas.mjs";
import { kpisPorTermo, kpisPorPagina, queryToPageRatio, termoPrincipal, totalImpressoes, PISO_IMPRESSOES_VEREDITO } from "@/lib/kpis-busca.mjs";
import { posicaoDoTermo } from "@/lib/pagina.mjs";
import {
  canonizar,
  taxaIntegridadeDoTitulo,
  taxaAlinhamento,
  taxaCobertura,
  cadencia,
  ordemDaPeriferia,
  TITULO_PX_MIN,
  TITULO_PX_MAX,
  TERMO_ATE,
  LINKS_CONTEXTUAIS_MIN,
  PROFUNDIDADE_MAX,
  CADENCIA_MESES,
} from "@/lib/grafo.mjs";
import { passRate, CAP_URLS_PASS_RATE, SLUGS_DE_CAMPO } from "@/lib/crux.mjs";
import { regua as reguaDoBoard } from "@/lib/gsc-delta.mjs";
import { lerCampo } from "@/lib/crux";
import { Tabs } from "../../../tabs";
import { WeekChart, type WeekPoint, type WeekCut } from "../../../viz";
import { SerieComFoco, SerieEmTabela, type Foco } from "./serie";

// AQUISIÇÃO (019, FR-022..FR-029): o que tem relógio de TRIMESTRE sai da tela que se lê na
// segunda-feira e ganha a janela longa que a 018 adiou — 8 meses de Search Console, 12 de GA4.
//
// A ficha continua nas janelas CURTAS (28d/D-3, FR-024): esticá-las trocaria a célula `visitante`
// dos 17 projetos e o placar do portfólio inteiro (SC-007). As longas vivem só aqui.
//
// ISR de 1 hora (FR-028a): duas chamadas de rede em janela longa numa página lida uma vez por
// trimestre não precisam ser pagas a cada request.
export const revalidate = 3600;

/**
 * 028 — o selo de estado de uma leitura. TRÊS portadores: o símbolo (no `::before` do CSS), a
 * palavra e a cor. O piso da skill proíbe cor como portador único, e esta tela vira PDF de reunião
 * trimestral — impressa em cinza ela continua dizendo qual leitura tem veredito e qual não tem.
 *
 * `cega` é o único vermelho, e é deliberado: instrumento quebrado tem conserto e dono. `sem` e
 * `piso` são neutros porque ausência não é ruim, é desconhecida.
 */
type Selo = "dado" | "fim" | "piso" | "sem" | "cega";
const PALAVRA_DO_SELO: Record<Selo, string> = {
  dado: "com dado",
  fim: "encerrada",
  piso: "abaixo do piso",
  sem: "sem amostra",
  cega: "cega",
};
function SeloEstado({ tipo, palavra }: { tipo: Selo; palavra?: string }) {
  return <span className={`selo selo-${tipo}`}>{palavra ?? PALAVRA_DO_SELO[tipo]}</span>;
}

/**
 * 031 · A ORIGEM DE UMA RÉGUA — de onde vem o número contra o qual a leitura é julgada.
 *
 * Até 19/09/2026 esta tela dizia "meta do board" em três pontos, com faixa desenhada na trilha e
 * selo `dado` quando a leitura batia. O levantamento de `handoff/gsc-balizador-estudo.md` mediu as
 * 26 folhas do board contra fonte primária: **4 têm régua, 21 não têm**. As três metas que esta
 * tela exibia estão entre as 21 — `40% a 50%` no Top 3, `≥ 70%` de Active Index e `5% a 10%/mês`
 * de crescimento não são publicadas por ninguém.
 *
 * Não estão erradas: estão **sem origem**, que é diferente. O problema era tipográfico — elas
 * apareciam com a mesma autoridade de `LCP ≤ 2,5s`, que é do Google e tem URL. Duas coisas de
 * natureza diferente com a mesma cara é mentira de forma, do tipo que nenhuma medição contradiz.
 *
 * A régua sai de `lib/gsc-delta.mjs`, nunca escrita aqui: é lá que `test/gsc-delta.test.mjs` exige
 * `fonte`, `url`, `acessadoEm` e `recorte` de toda linha, e motivo próprio de toda recusa.
 */
function Origem({ chave }: { chave: string }) {
  const r = reguaDoBoard(chave) as
    | { tem: true; meta: number | [number, number] | null; fonte: { fonte: string; url: string; acessadoEm: string; recorte: string } }
    | { tem: false; motivo: string; natureza: string };
  if (r.tem) {
    return (
      <span className="org org-com">
        régua:{" "}
        <a href={r.fonte.url} target="_blank" rel="noreferrer">
          {r.fonte.fonte}
        </a>{" "}
        · {r.fonte.recorte} · acessado em {r.fonte.acessadoEm}
      </span>
    );
  }
  // `natureza` separa quatro ausências com consertos OPOSTOS, e por isso nenhuma delas diz só
  // "sem régua": procurar fonte, ligar coletor, e aceitar que binário não tem quartil são
  // trabalhos diferentes. O motivo vem do catálogo — escrevê-lo aqui criaria a segunda cópia.
  const rotulo =
    r.natureza === "semColetor"
      ? "sem coletor"
      : r.natureza === "norma"
        ? "norma, não régua"
        : r.natureza === "procedimento"
          ? "procedimento"
          : "parâmetro editorial, sem fonte";
  return (
    <span className="org org-sem">
      {rotulo}: {r.motivo}
    </span>
  );
}

/**
 * Uma leitura: valor à esquerda em coluna fixa, rótulo e selo à direita.
 *
 * Substitui o parágrafo-por-leitura que crescia a cada corrida. O valor ocupa a MESMA coluna
 * quando é ausência (`sem`), porque bloco que encolhe sem dado reorganiza a página e o leitor
 * perde a posição — e a palavra do estado nunca é `0`, `—` nem `N/A`.
 */
function Leitura({
  valor,
  sem,
  children,
  selo,
  palavra,
  fracao,
  meta,
  parte,
  base,
}: {
  valor?: string;
  sem?: string;
  children: React.ReactNode;
  selo?: Selo;
  palavra?: string;
  /** 032 (FR-003/E5) — a base de impressões desta medida e a leitura que a produziu. Depois da 032
   *  o bloco de busca tem duas bases lado a lado (24.664 e 10.395 na Atma); sem a base ao lado, a
   *  diferença entre duas linhas vizinhas lê como bug. Mora na coluna do RÓTULO (1fr) e nunca na do
   *  valor (96px fixos), então não empurra a coluna que se compara na vertical. */
  base?: string;
  /** 028 — a fração desta leitura numa escala de 0 a 100%, desenhada como comprimento. */
  fracao?: number;
  /** A meta do board na MESMA escala: um número vira tique, um par `[piso, teto]` vira faixa. */
  meta?: number | [number, number];
  /** O valor contra o MAIOR da lista, quando a escala não é percentual (contagens). */
  parte?: number;
}) {
  return (
    <li className="lt">
      <span className={sem ? "lt-v lt-v-sem" : "lt-v"}>{sem ?? valor}</span>
      <span className="lt-r">
        {children}
        {selo ? <SeloEstado tipo={selo} palavra={palavra} /> : null}
        {base ? <span className="lt-b">{base}</span> : null}
        {/* A barra NUNCA acompanha uma ausência: `sem` presente significa que não há valor, e uma
            trilha vazia ao lado de "não apurado" leria como zero medido — o defeito que as sete
            corridas anteriores desta tela passaram removendo do texto. */}
        {sem === undefined && fracao !== undefined ? <Trilha fracao={fracao} meta={meta} /> : null}
        {sem === undefined && parte !== undefined ? <Parte fracao={parte} /> : null}
      </span>
    </li>
  );
}

/**
 * 028 · A TRILHA — uma fração de 0 a 100% como comprimento, com a meta do board como posição.
 *
 * Mora na faixa de `padding-bottom` da própria linha (`position: absolute`), então **não custa
 * altura**: quinze leituras ganham o canal de comprimento sem o bloco crescer um pixel. Foi por
 * isso que a 6ª corrida recusou o gráfico de barras dos canais do GA4 — "mesma altura que 6
 * linhas de texto, sem ganhar canal". Aqui o canal entra e a altura não.
 *
 * A moldura é o que a distingue da `Parte`: trilha emoldurada = escala fixa 0–100%; barra sem
 * moldura = relativa ao maior da lista. Sem essa distinção visual, 4.988 sessões de Organic
 * Search encostadas na borda leriam como "100% das sessões".
 */
function Trilha({ fracao, meta }: { fracao: number; meta?: number | [number, number] }) {
  const pct = Math.max(0, Math.min(1, fracao)) * 100;
  const lim = (v: number) => Math.max(0, Math.min(100, v * 100));
  return (
    <span className="trk" aria-hidden>
      {/* `max(1px, …)`: fração medida e positiva desenha pelo menos 1px, senão 0,3% arredonda para
          largura 0 e fica idêntico ao zero — a mesma regra das barras do `WeekChart`. */}
      <span className="trk-f" style={{ width: pct > 0 ? `max(1px, ${pct}%)` : 0 }} />
      {Array.isArray(meta) ? (
        <span className="trk-faixa" style={{ left: `${lim(meta[0])}%`, width: `${lim(meta[1]) - lim(meta[0])}%` }} />
      ) : meta !== undefined ? (
        <span className="trk-m" style={{ left: `${lim(meta)}%` }} />
      ) : null}
    </span>
  );
}

/** A barra relativa ao MAIOR item da lista. Sem moldura, porque a escala não é percentual — e o
 *  bloco declara por escrito contra quem ela mede (o "sobe em relação a quê?" do piso da skill). */
function Parte({ fracao }: { fracao: number }) {
  const pct = Math.max(0, Math.min(1, fracao)) * 100;
  return (
    <span className="prt" aria-hidden>
      <span className="prt-f" style={{ width: pct > 0 ? `max(1px, ${pct}%)` : 0 }} />
    </span>
  );
}

/**
 * 028 · A COMPOSIÇÃO — para onde foi o total, em segmentos que somam o denominador.
 *
 * Serve dois blocos: marca/não-marca (impressões do corte de país) e indexação (destino das URLs
 * declaradas). O segmento `hachurado` é o que está FORA da conta — resíduo que o Search Console
 * não atribui, inspeção que falhou, URL que ninguém consultou. A hachura é padrão, não cor: o
 * piso da skill proíbe cor como portador único, e esta tela vira PDF de reunião trimestral.
 *
 * Segmento de valor ZERO não vira faixa de 0px (invisível é indistinguível de ausente): ele sai
 * da barra e aparece na legenda com o valor, que é o zero qualificado do G4.
 */
function Composicao({
  total,
  partes,
  rotulo,
}: {
  total: number;
  partes: { chave: string; valor: number; nome: string; hachurado?: boolean }[];
  rotulo: string;
}) {
  if (total <= 0) return null;
  const desenhadas = partes.filter((x) => x.valor > 0);
  return (
    <figure className="cmp">
      <figcaption className="cmp-cap">{rotulo}</figcaption>
      <div
        className="cmp-barra"
        role="img"
        aria-label={`${rotulo}: ${partes.map((x) => `${x.nome} ${x.valor.toLocaleString("pt-BR")}`).join(", ")}`}
      >
        {desenhadas.map((x) => (
          <span
            key={x.chave}
            className={x.hachurado ? `cmp-s cmp-${x.chave} cmp-hach` : `cmp-s cmp-${x.chave}`}
            style={{ width: `max(2px, ${(x.valor / total) * 100}%)` }}
          />
        ))}
      </div>
      <ul className="cmp-leg">
        {partes.map((x) => (
          <li key={x.chave}>
            <span className={x.hachurado ? `cmp-k cmp-${x.chave} cmp-hach` : `cmp-k cmp-${x.chave}`} aria-hidden />
            <strong>{x.valor.toLocaleString("pt-BR")}</strong> {x.nome}
            {x.valor === 0 ? <span className="cmp-zero"> · zero medido</span> : null}
          </li>
        ))}
      </ul>
    </figure>
  );
}

/**
 * 028 · A RÉGUA DA JANELA — quanto do período PEDIDO a fonte realmente cobre (FR-027).
 *
 * Substitui o `<Recebida>`, que imprimia as mesmas quatro datas em prosa: elas continuam na tela,
 * agora como pontas da régua, e a distância entre "pedi 8 meses" e "recebi 5 dias" passa a ser
 * comprimento em vez de uma subtração que o leitor faz de cabeça. Medido em 18/09: a propriedade
 * nova da atma cobre 5 dos 244 dias pedidos — 2%, que em prosa some e na régua é um risco na
 * borda. Nunca se rotula de 12 meses um dado de 3: o truncamento é NOMEADO, e agora também medido.
 */
function ReguaJanela({
  pedida,
  recebida,
  legenda,
}: {
  pedida: { inicio: string; fim: string };
  recebida: { inicio: string; fim: string } | null;
  legenda: string;
}) {
  const t0 = Date.parse(pedida.inicio);
  const t1 = Date.parse(pedida.fim);
  const span = Math.max(1, t1 - t0);
  const em = (d: string) => Math.max(0, Math.min(100, ((Date.parse(d) - t0) / span) * 100));
  const truncada = !!recebida && (recebida.inicio > pedida.inicio || recebida.fim < pedida.fim);
  const dias = recebida ? Math.round((Date.parse(recebida.fim) - Date.parse(recebida.inicio)) / 864e5) + 1 : null;
  const pedidos = Math.round(span / 864e5) + 1;
  return (
    <figure className="jan">
      <div
        className="jan-trilha"
        role="img"
        aria-label={
          recebida
            ? `Janela pedida ${pedida.inicio} a ${pedida.fim}, ${pedidos} dias. A fonte cobre ${recebida.inicio} a ${recebida.fim}, ${dias} dia(s)${truncada ? " — janela truncada" : ""}.`
            : `Janela pedida ${pedida.inicio} a ${pedida.fim}. A janela recebida não foi apurada.`
        }
      >
        {recebida ? (
          <span
            className="jan-f"
            style={{ left: `${em(recebida.inicio)}%`, width: `max(2px, ${em(recebida.fim) - em(recebida.inicio)}%)` }}
          />
        ) : null}
      </div>
      <figcaption className="jan-cap">
        <span className="jan-p">{pedida.inicio}</span>
        <span className="jan-meio">
          {legenda}
          {recebida ? (
            <>
              {" "}
              · a fonte cobre <strong>{dias}</strong> de {pedidos} dia(s)
              {truncada ? (
                <>
                  {" "}
                  — <strong>truncada</strong>: {recebida.inicio} → {recebida.fim}
                </>
              ) : (
                <> — a janela inteira</>
              )}
            </>
          ) : (
            <> · janela recebida não apurada</>
          )}
        </span>
        <span className="jan-p">{pedida.fim}</span>
      </figcaption>
    </figure>
  );
}

/** Mesma assinatura da série gravada (`hub_gsc_dia.host`, 029): ordenada e unida por `+`. Legível
 *  com espaços, para as fontes serem comparáveis a olho. */
const assinaturaLegivel = (hosts: string[]) => (assinaturaDeHosts(hosts) ?? "").split("+").join(" + ");

/** Um host lido e nenhum encerrado é o caso comum (FR-006): a tela cala, e o chamador não abre o
 *  parágrafo. */
const declaraOsHosts = (l: { hosts: string[]; encerrados: string[] } | null) =>
  !!l && (l.hosts.length > 1 || l.encerrados.length > 0);

/** Publicada quando um host declarado FALHA: com dois hosts o bloco inteiro fica sem número. */
const TOTAL_PARCIAL =
  "Um total parcial leria como queda de tráfego — por isso nenhum número do bloco é publicado. Tente de novo em instantes.";

/**
 * 031 (FR-005) — QUEM compôs os números de um bloco do Search Console, dito pela MESMA frase no bloco
 * de série e no de consultas. Era JSX solto no de consultas (030); no de série seria uma segunda
 * cópia, e duas cópias divergem na primeira edição — a SC-003 é os dois blocos declararem a mesma
 * lista. A frase é a que a 030 já publica: "hosts somados" e "sem propriedade … e fora da soma"
 * (GLOSSARIO.md), sem string nova.
 */
function HostsDaLeitura({ hosts, encerrados }: { hosts: string[]; encerrados: string[] }) {
  return (
    <>
      {hosts.length > 1 ? "hosts somados" : "host consultado"}: <strong>{assinaturaLegivel(hosts)}</strong>
      {encerrados.length > 0 ? (
        <>
          {" "}
          · sem propriedade no Search Console e fora da soma: <strong>{encerrados.join(", ")}</strong>
        </>
      ) : null}
    </>
  );
}

/**
 * 028 · O FRESCOR — a idade da apuração como POSIÇÃO num eixo comum às seis fontes.
 *
 * A tabela de instrumentos já publica seis datas; comparar "15/09, 18/09, 14/09, 07/09" na
 * vertical é aritmética que o leitor faz de cabeça a cada visita. O tique no eixo responde "quem
 * está atrasado" de relance, sem tirar a data do lado.
 *
 * ⚠️ A faixa de tolerância é POR FONTE, não uma só. O crawl roda na segunda e 4 dias de idade é o
 * normal dele; a indexação roda diária e 4 dias é atraso. Uma faixa única marcaria o crawl como
 * atrasado — mentira de forma, do tipo que nenhuma medição contradiz.
 *
 * Série encerrada não tem faixa nenhuma: a promessa de D-3 não se aplica ao que parou de crescer
 * por decisão de escopo ou troca de domínio (o G25 da 3ª corrida, agora em forma visual).
 */
const FRESCOR_DIAS = 14; // o eixo: duas semanas até hoje
function Frescor({
  cobreAte,
  hoje,
  tolerancia,
  encerrada,
}: {
  cobreAte: string;
  hoje: string;
  tolerancia: number;
  encerrada: boolean;
}) {
  const idade = Math.round((Date.parse(hoje) - Date.parse(cobreAte)) / 864e5);
  const anterior = idade > FRESCOR_DIAS;
  const x = anterior ? 0 : ((FRESCOR_DIAS - idade) / FRESCOR_DIAS) * 100;
  return (
    <span
      className="frs"
      title={`${cobreAte} · ${idade} dia(s) atrás${encerrada ? " · série encerrada, sem prazo a cumprir" : ` · esta fonte se compromete com ${tolerancia} dia(s)`}`}
    >
      {!encerrada && (
        <span className="frs-ok" style={{ width: `${(Math.min(tolerancia, FRESCOR_DIAS) / FRESCOR_DIAS) * 100}%` }} />
      )}
      <span
        className={anterior ? "frs-t frs-antes" : idade > tolerancia && !encerrada ? "frs-t frs-atrasada" : "frs-t"}
        style={{ left: `${x}%` }}
      />
    </span>
  );
}

/**
 * 028 · AS CÉLULAS — uma por URL consultada, o estado de cada uma nomeado.
 *
 * O Pass Rate de campo é uma fração sobre 5 URLs: exibir só "0%" ou "não apurável" esconde o
 * denominador, e é o G32 (procedência do número mais destacado) que cobra. Cinco células dizem o
 * total, quantas passaram e por que as outras não — com palavra, forma e cor, nunca só cor.
 */
const ESTADO_DA_URL: Record<string, { palavra: string; classe: string }> = {
  passa: { palavra: "passa nos três", classe: "cel-passa" },
  reprova: { palavra: "reprova em um dos três", classe: "cel-reprova" },
  parcial: { palavra: "dado parcial, sem os três", classe: "cel-parcial" },
  "sem-amostra": { palavra: "sem amostra de campo", classe: "cel-sem" },
  falhou: { palavra: "falhou agora", classe: "cel-falhou" },
  "sem-chave": { palavra: "hub sem chave da CrUX", classe: "cel-sem" },
  "nao-lida": { palavra: "não lida", classe: "cel-sem" },
};
function CelulasDeUrl({
  urls,
  caminho,
}: {
  urls: { url: string; estado: string }[];
  caminho: (u: string) => string;
}) {
  if (!urls.length) return null;
  const contagem = new Map<string, number>();
  for (const u of urls) contagem.set(u.estado, (contagem.get(u.estado) ?? 0) + 1);
  return (
    <figure className="cel">
      <ul className="cel-linha">
        {urls.map((u) => {
          const e = ESTADO_DA_URL[u.estado] ?? ESTADO_DA_URL["nao-lida"];
          return (
            <li key={u.url} className={`cel-i ${e.classe}`} title={`${caminho(u.url)} — ${e.palavra}`}>
              <span className="cel-c" aria-hidden />
              <span className="cel-u">{caminho(u.url)}</span>
            </li>
          );
        })}
      </ul>
      <figcaption className="cel-cap">
        {urls.length} URL(s) consultada(s) ·{" "}
        {[...contagem.entries()].map(([estado, n], i) => (
          <span key={estado}>
            {i > 0 ? " · " : ""}
            <strong>{n}</strong> {ESTADO_DA_URL[estado]?.palavra ?? estado}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/**
 * 022 — a última apuração de indexação, em três estados como o resto da página: `null` é ausência
 * estrutural (nunca apurado, ou hub sem banco) e `{erro}` é falha de agora. Uma falha do Postgres
 * não pode derrubar a aba inteira, e também não pode se disfarçar de "não apurado".
 *
 * A tela NUNCA inspeciona: a página tem `revalidate = 3600` e a quota é diária e compartilhada por
 * 21 projetos — inspecionar no render transformaria cada visita em consumo da quota que a corrida
 * precisa. E um número que vem do banco TEM data; um número buscado ao vivo finge ser de hoje.
 */
async function lerApuracao(slug: string): Promise<Apuracao | { erro: string } | null> {
  if (!dbOn()) return null;
  try {
    return await lerIndexacao(slug);
  } catch (e) {
    return { erro: e instanceof Error ? e.message.slice(0, 60) : String(e).slice(0, 60) };
  }
}

/**
 * 024 — a última corrida do crawl de página, no mesmo idioma de três estados de `lerApuracao()`.
 *
 * A tela LÊ O GRAVADO E NUNCA BUSCA: com `revalidate = 3600`, uma página que crawleasse ao carregar
 * transformaria cada visita numa varredura do site do cliente — e a corrida semanal existe
 * exatamente para isso não acontecer.
 */
async function lerCrawl(slug: string): Promise<CrawlDePagina | { erro: string } | null> {
  if (!dbOn()) return null;
  try {
    return await lerCrawlDePagina(slug);
  } catch (e) {
    return { erro: e instanceof Error ? e.message.slice(0, 60) : String(e).slice(0, 60) };
  }
}

/**
 * 025 — a série gravada com a separação marca / não-marca, no mesmo idioma de três estados das duas
 * de cima.
 *
 * A tela lê o BANCO e nunca o Search Console (D11): as três pernas custam três requisições e são
 * pedidas UMA vez por dia pela corrida das 05:17. Buscá-las no render triplicaria a rede a cada
 * visita para exibir o mesmo número — e, pior, um número sem data, que finge ser de hoje.
 *
 * Primeiro consumidor de `lerDiasGsc()`: a função existe desde a 021 e ninguém a chamava.
 */
async function lerSerieSeparada(
  slug: string,
  janela: { inicio: string; fim: string },
): Promise<DiaSeparado[] | { erro: string } | null> {
  if (!dbOn()) return null;
  try {
    return await lerDiasGsc(slug, janela.inicio, janela.fim);
  } catch (e) {
    return { erro: e instanceof Error ? e.message.slice(0, 60) : String(e).slice(0, 60) };
  }
}

/**
 * 023/US3 — o Core Web Vitals Pass Rate do board, sobre as URLs PRIORITÁRIAS: as de maior
 * impressão na janela curta, cortadas em `CAP_URLS_PASS_RATE`. Sem a ordenação o corte sortearia o
 * denominador; as que ficam de fora entram no texto como NÃO CONSULTADAS, nunca como reprovadas.
 *
 * 032 — a amostra é por URL e passa a sair da leitura por PÁGINA. Na Atma isso a tira de 14 URLs
 * para 29, e "não consultadas" de 4 para 19: a fração PODE mudar de valor, e isso é a medida
 * passando a ver o site inteiro, não regressão. O custo de rede não muda — `CAP_URLS_PASS_RATE`
 * continua 10 consultas ao CrUX.
 *
 * Em SÉRIE, pelo mesmo motivo de `app/api/gsc-serie/route.ts:36-38`: um punhado de POSTs
 * simultâneos ao mesmo endpoint do Google com a mesma chave é o caminho mais curto para o 429 que
 * transformaria a leitura inteira em falha por pressa. Só para `SLUGS_DE_CAMPO` (FR-014), e a
 * falha segue o idioma de `lerApuracao()`: não derruba a aba.
 */
async function lerPassRate(slug: string, paginas: { pagina: string; impressoes: number }[] | null) {
  if (!SLUGS_DE_CAMPO.includes(slug) || !paginas) return null;
  // Cópia antes de ordenar: a MESMA lista alimenta as outras medidas por URL, e `sort` é no lugar.
  const urls = [...paginas].sort((a, b) => b.impressoes - a.impressoes);
  const prioritarias = urls.slice(0, CAP_URLS_PASS_RATE);
  try {
    const leituras = new Map();
    for (const u of prioritarias) leituras.set(u.pagina, await lerCampo({ tipo: "url", valor: u.pagina }));
    return { ...passRate(leituras, prioritarias.length), naoConsultadas: urls.length - prioritarias.length };
  } catch (e) {
    return { erro: e instanceof Error ? e.message.slice(0, 60) : String(e).slice(0, 60) };
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const projects = await listProjects();
  const p = projects.find((x) => x.slug === slug);
  const nomeCurto = p?.nome.split(" — ")[0] ?? slug;
  return { title: `${nomeCurto} — aquisição (janela longa)` };
}

export default async function AquisicaoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const projects = await listProjects();
  const p = projects.find((x) => x.slug === slug);
  if (!p) notFound();
  const nomeCurto = p.nome.split(" — ")[0];

  const janelaGsc = descobertaLonga() as { nome: string; inicio: string; fim: string; porque: string };
  const janelaGa4 = comportamentoLongo() as { nome: string; inicio: string; fim: string; porque: string };
  const curtaGsc = descoberta() as { inicio: string; fim: string };
  const curtaGa4 = comportamento() as { inicio: string; fim: string };

  // Duas fontes independentes, sem somar latência — mesmo padrão de `coletarDoProjeto()`. A falha
  // de uma nunca alcança a outra.
  const [serie, canais, cobertura, consultas, paginasGsc, indexacao, crawl, serieSeparada] = await Promise.all([
    // 031: os hosts DECLARADOS, os mesmos do bloco de consultas mais abaixo. Lia só o de `url` e
    // publicava 127 das 370.559 impressões da Atma (0,03%) sob a frase "hosts somados".
    gscSeries(hostsDeclarados(p), { inicio: janelaGsc.inicio, fim: janelaGsc.fim }),
    // 026: os hosts DECLARADOS entram na consulta. A propriedade GA4 conta qualquer coisa que
    // carregue a tag — na atma, o painel admin, o `localhost` do desenvolvimento e dois previews
    // da Vercel: 1.075 das 7.846 sessões de 12 meses (13,7%), e 43% do canal Referral. Uma tela
    // que pergunta quem ENCONTRA o produto não pode contar o time entrando no admin.
    ga4Canais(p.ga4?.propertyId, { inicio: janelaGa4.inicio, fim: janelaGa4.fim }, hostsDeclarados(p)),
    ga4Cobertura(p.ga4?.propertyId, { inicio: janelaGa4.inicio, fim: janelaGa4.fim }, hostsDeclarados(p)),
    // 021: as consultas vêm na janela CURTA (descoberta, 28d), não na longa desta página.
    // Striking Distance com 8 meses misturaria posição de fevereiro com a de hoje e a lista de
    // trabalho apontaria para páginas que já subiram ou já caíram — uma fila de trabalho velha
    // é pior que fila nenhuma. A janela sai declarada no bloco, como manda a FR-026 da 019.
    // Fora de `SLUGS_DE_BUSCA` a chamada nem sai: os KPIs do board são da Atma, e este bloco era
    // o último pedaço da 021 que ainda servia os 35 — porque lê ao vivo no render, sem passar
    // pela corrida que já foi restringida.
    // 030: os hosts DECLARADOS, os mesmos da série e do GA4 — a aba lia só o host de `url` e, desde
    // a troca de domínio da Atma, decidia os KPIs de clique sobre 98 das 24.664 impressões do site.
    SLUGS_DE_BUSCA.includes(slug) ? gscConsultas(hostsDeclarados(p), curtaGsc) : null,
    // 032: a leitura por PÁGINA, para as medidas que afirmam algo sobre uma URL. Cita LITERALMENTE
    // `hostsDeclarados(p)` e `curtaGsc`, as mesmas expressões da linha de cima e não duas
    // equivalentes (FR-006) — duas janelas aqui fariam as duas bases não fecharem com a mesma soma
    // de dias. Medido na Atma em 19/09/2026: a dimensão `query` devolve 10.395 das 24.664
    // impressões do site (42,1%) e 14 das 29 URLs, e era sobre essa fatia que o Índice de
    // Conformidade publicava 0%. Custo: +1 requisição por host, em paralelo com as outras duas —
    // a latência é a da mais lenta, não a soma. Os hosts continuam EM SÉRIE dentro de `lerHosts`.
    SLUGS_DE_BUSCA.includes(slug) ? gscPaginas(hostsDeclarados(p), curtaGsc) : null,
    // 022: a indexação vem do BANCO, apurada pela corrida das 05:47. Zero chamada à URL Inspection
    // API aqui — ver `lerApuracao`.
    lerApuracao(slug),
    // 024: o crawl de página vem do BANCO, apurado pela corrida de segunda 06:17. Ver `lerCrawl`.
    lerCrawl(slug),
    // 025: a separação marca / não-marca também vem do BANCO. Ver `lerSerieSeparada`.
    lerSerieSeparada(slug, janelaGsc),
  ]);
  const linhasBusca = consultas && "linhas" in consultas ? consultas.linhas : null;
  const paginasBusca = paginasGsc && "paginas" in paginasGsc ? paginasGsc.paginas : null;
  // 030 (FR-008) — QUEM compôs os números do bloco. Um total somado sem a assinatura de quem o
  // compôs não é conferível. É a MESMA assinatura da série gravada (`hub_gsc_dia.host`, 029 —
  // ordenada, unida por `+`), para as duas fontes serem comparáveis a olho. Com um host só não há
  // o que declarar: a tela de sempre (FR-006).
  const hostsDoCard = hostsDeclarados(p);
  const consultasLidas = consultas && "linhas" in consultas ? consultas : null;
  const paginasLidas = paginasGsc && "paginas" in paginasGsc ? paginasGsc : null;
  // 032/D14 — UMA declaração de hosts no cabeçalho, alimentada pela leitura que respondeu. As duas
  // leem a MESMA lista (FR-006), então duas linhas "hosts somados" seriam duas versões do mesmo
  // fato — e duas versões do mesmo fato divergem na primeira edição.
  const hostsDoBloco = consultasLidas ?? paginasLidas;
  const hostsSomados = hostsDoBloco ? assinaturaLegivel(hostsDoBloco.hosts) : null;
  const declaraHosts = declaraOsHosts(hostsDoBloco);
  // 031: a série também declara — os dois blocos leem os mesmos hosts, e a tela diz a mesma coisa.
  const serieLida = serie && "days" in serie ? serie : null;
  const declaraHostsSerie = declaraOsHosts(serieLida);
  // Ausência estrutural, dita igual nos dois blocos: com dois hosts, "para {url}" nomearia um só.
  const semPropriedadeGsc =
    hostsDoCard.length > 1
      ? `sem propriedade no GSC para nenhum dos hosts declarados (${hostsDoCard.join(", ")})`
      : `sem propriedade no GSC para ${p.url}`;

  // ── 025: a declaração de marca, que serve os DOIS blocos desta página ─────────────────────
  //
  // Uma fonte só (D3): o mesmo padrão que a corrida mandou ao Search Console volta aqui para
  // filtrar a canibalização. Duas construções divergiriam na primeira variante nova, e a tela
  // exibiria uma lista de termos (FR-012) que não é a que classificou os números.
  const decl = marcaDeclarada(p);
  const ehMarca = decl.motivo ? null : (q: string) => new RegExp(decl.padrao, "i").test(q);
  const kpis = linhasBusca ? kpisPorTermo(linhasBusca, ehMarca) : null;
  // 026 — o denominador das frações da janela curta. Toda fração desta tela carrega a base ao
  // lado; a do Top 3 não carregava, e era julgada contra a faixa do board sobre 26 impressões.
  const baseCurta = linhasBusca ? totalImpressoes(linhasBusca) : null;
  // 032 (FR-003/E5) — a base da OUTRA leitura. `null` quando ela não respondeu, e NUNCA 0 por
  // ausência: zero impressões é um estado medido, e a tela já o distingue de "não perguntei".
  const basePagina = paginasBusca ? totalImpressoes(paginasBusca) : null;
  // 028 — UM portão para todas as barras do bloco de consultas. Abaixo do piso a fração existe e a
  // RÉGUA não: desenhar comprimento ao lado de um selo que diz "sem veredito do board" daria
  // autoridade visual justamente ao número que a tela passou três corridas tirando do pedestal
  // (o 43×, a fração do Top 3, a canibalização vazia). A guarda mora aqui, não em cada linha —
  // seis vezes nesta tela um veredito consertado no chamador voltou pela porta seguinte.
  // 032/D7 — UM PORTÃO POR LEITURA. O piso mede se a base sustenta a régua do board, e as duas
  // bases são diferentes: julgar uma fração calculada sobre 24.664 impressões pelo portão de uma
  // base de 10.395 seria aplicar a régua a partir do denominador errado. Os dois continuam morando
  // no cálculo da base, e não em cada linha — seis vezes nesta tela um veredito consertado no
  // chamador voltou pela porta seguinte.
  const acimaDoPisoTermo = baseCurta !== null && baseCurta >= PISO_IMPRESSOES_VEREDITO;
  const acimaDoPisoPagina = basePagina !== null && basePagina >= PISO_IMPRESSOES_VEREDITO;
  const vitais = await lerPassRate(slug, paginasBusca);
  const pct = (f: number) => `${(f * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  // 025: acima de 10× o `pct` vira armadilha de leitura. Em pt-BR o separador de milhar é o PONTO,
  // então um crescimento de 4195% sai "4.195%" — que, ao lado de uma meta de "5% a 10%", lê como
  // 4,195% e inverte o veredito para quem bate o olho. Medido em 08/09: julho da atma colapsou para
  // 342 impressões não-marca e agosto voltou a 14.689, uma recuperação real de 42×.
  const variacao = (f: number) =>
    Math.abs(f) >= 10 ? `${(f + 1).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}×` : pct(f);
  const br = (n: number) => n.toLocaleString("pt-BR");
  // Só encurta a URL para caber na linha: a chave continua sendo a canônica da D3.
  const caminho = (u: string) => u.replace(p.url.replace(/\/+$/, ""), "") || "/";
  // 032/FR-003 — o sufixo que cada medida do bloco de busca carrega. Repetido linha a linha de
  // propósito: é a repetição que deixa duas bases diferentes visíveis lado a lado. Uma nota única
  // no rodapé do bloco obrigaria o leitor a lembrar qual medida é de qual família — que é
  // exatamente o que ninguém faz ao bater o olho numa lista de dez linhas.
  const baseDoTermo = baseCurta === null ? undefined : `${br(baseCurta)} impressões · leitura por termo`;
  const baseDaPagina = basePagina === null ? undefined : `${br(basePagina)} impressões · leitura por página`;
  // 032/FR-005 — o motivo de UMA leitura, na língua que a 030 fixou: `{erro}` é falha de agora (a
  // mensagem já começa pelo host que falhou) e `null` é ausência estrutural, que pede criar a
  // propriedade. Os dois consertos são opostos, e por isso não colapsam.
  const motivoDaLeitura = (r: unknown) =>
    r && typeof r === "object" && "erro" in r
      ? `Search Console indisponível (${String(r.erro)})`
      : semPropriedadeGsc;

  // A apuração de verdade: motivo `null` E alguma inspeção que não falhou.
  const idx = indexacao && !("erro" in indexacao) && !indexacao.motivo ? indexacao : null;
  // 029 — ESCOPO É PROPRIEDADE DA FONTE, não aviso no topo do bloco. A corrida de indexação passou
  // a percorrer só `SLUGS_DE_BUSCA` e a guarda entrou como `⚠️ Fora do escopo` no TOPO do bloco;
  // a cadeia de branches abaixo e a tabela de instrumentos continuaram falando como se o rodízio
  // ainda servisse os 35. Medido em 18/09 nos 34 projetos de fora: a tabela dizia "sem amostra /
  // nenhuma apuração gravada" sobre uma apuração de 2026-09-07 com 14 URLs declaradas, e o bloco
  // prometia "volta na frente da fila na próxima corrida" três linhas abaixo de "não será
  // atualizado". No banco, só a atma foi apurada desde 08/09 — a promessa é impossível.
  const foraDoEscopo = !SLUGS_DE_BUSCA.includes(slug);
  // Apuração que EXISTE e não cresce mais: fim de série, não ausência de amostra.
  const idxCongelado = foraDoEscopo && indexacao && !("erro" in indexacao) ? indexacao : null;
  // Denominador da taxa = inspecionadas − falhas (022, FR-008). A falha sai dos DOIS lados: erro de
  // quota contado como não-indexação inverteria o sinal, e quanto mais o sistema falhasse pior o
  // site pareceria. Zero ⇒ `null`, "não apurado", nunca 0%.
  const base = idx ? idx.inspecionadas - idx.falhas : 0;
  const taxaIdx = idx && base > 0 ? idx.indexadas / base : null;
  const rejeicao = idx && base > 0 ? (idx.rastreadasNaoIndexadas + idx.descobertasNaoIndexadas) / base : null;
  const amostrado = !!idx && idx.inspecionadas < idx.declaradas;
  // 026 — a propriedade que a corrida usou cobre o host que o card declara? `sc-domain:x` cobre
  // `a.b.x`; uma propriedade de prefixo cobre só o próprio host. Divergir é a assinatura de uma
  // troca de domínio no meio da corrida, e é a causa REAL de 100% de falha na inspeção.
  const propriedadeForaDoSite = (() => {
    const prop = indexacao && !("erro" in indexacao) ? indexacao.propriedade : null;
    if (!prop) return false;
    let host: string;
    try { host = new URL(p.url).hostname.replace(/^www\./, ""); } catch { return false; }
    if (prop.startsWith("sc-domain:")) {
      const dominio = prop.slice("sc-domain:".length);
      return host !== dominio && !host.endsWith(`.${dominio}`);
    }
    return !prop.startsWith(`https://${host}/`) && !prop.startsWith(`https://www.${host}/`);
  })();

  // 022/US3 — o denominador das duas razões do board.
  //
  // ⚠️ Ele só existe quando NÃO houve amostragem, e a razão é aritmética, não preciosismo: o
  // numerador (URLs com impressão) é do SITE INTEIRO, medido pelo GSC em 28 dias. Se a apuração
  // inspecionou 200 de 1.200 URLs, `indexadas` é a contagem DA AMOSTRA — dividir um numerador de
  // site por um denominador de amostra produz uma razão que pode passar de 1 e que não mede nada.
  // Com amostra, o denominador é tão chutado quanto o que a 021 se recusou a inventar, então a
  // tela volta à contagem com o motivo (FR-011). Cobrir o site inteiro é aumentar o orçamento.
  const denomIdx = idx && !amostrado ? idx.indexadas : null;
  // 032 — a família por URL nasce AQUI, e não ao lado de `kpis`, porque `denomIdx` só existe
  // depois da apuração de indexação acima. Ele continua vindo do BANCO: nenhuma das duas leituras
  // do Search Console conhece o total de URLs indexadas.
  const kpisUrl = paginasBusca ? kpisPorPagina(paginasBusca, denomIdx) : null;
  const ativas = kpisUrl?.activeIndexRatio ?? null;
  // `queryToPageRatio` NÃO migra: o numerador é `consultasUnicas`, que é por termo. Ele continua
  // nesta leitura e continua carregando o selo de piso por isso (FR-004).
  const porPagina = linhasBusca && denomIdx ? queryToPageRatio(linhasBusca, denomIdx) : null;

  // ── 024: as seis medidas do crawl ────────────────────────────────────────
  //
  // NENHUMA conta aqui: `taxa*`, `cadencia` e `ordemDaPeriferia` moram em `lib/grafo.mjs` e
  // `posicaoDoTermo` em `lib/pagina.mjs` — o que dá para testar sem subir o Next nasce em `.mjs`
  // (Princípio III). Esta seção só chama e passa adiante.
  const paginado = crawl && !("erro" in crawl) && !crawl.motivo ? crawl : null;
  // As URLs do GSC vêm na forma que o Google guarda; as do crawl são a chave canônica da D3.
  // Sem canonizar dos dois lados, `/precos` e `/precos/` seriam páginas diferentes e TODA página
  // apareceria como "sem termo apurado".
  const linhasCanon =
    linhasBusca?.map((l) => ({ ...l, page: canonizar(l.page, p.url) ?? l.page })) ?? null;
  // 032/D10 — este mapa é por URL e passa a sair da leitura por PÁGINA, canonizado pela mesma
  // regra da 024. SOMA por chave canônica em vez de `new Map(...)` direto porque duas páginas
  // distintas do Google viram a mesma chave aqui (a Atma tem o mesmo post com e sem barra final,
  // 442 e 1 impressões): o `Map` ficaria com a última e a periferia leria 1 onde há 443.
  // `termoPorUrl` logo abaixo CONTINUA na leitura por termo — termo não existe na outra, e é essa
  // a fronteira da FR-001.
  const impressoesPorUrl = (paginasBusca ?? []).reduce((m, pag) => {
    const chave = canonizar(pag.pagina, p.url) ?? pag.pagina;
    return m.set(chave, (m.get(chave) ?? 0) + pag.impressoes);
  }, new Map<string, number>());
  const termoPorUrl = new Map<string, string | null>(
    (paginado?.paginas ?? []).map((pg) => [pg.url, linhasCanon ? termoPrincipal(linhasCanon, pg.url) : null])
  );
  const posicaoPorUrl = new Map<string, number | null>(
    (paginado?.paginas ?? []).map((pg) => [pg.url, posicaoDoTermo(pg.titulo, termoPorUrl.get(pg.url) ?? null)])
  );
  const integridade = paginado ? taxaIntegridadeDoTitulo(paginado.paginas, posicaoPorUrl) : null;
  const alinhamento = paginado ? taxaAlinhamento(paginado.paginas) : null;
  const cobertura024 = paginado ? taxaCobertura(paginado.paginas) : null;
  const atualizacao = paginado ? cadencia(paginado.paginas, paginado.dia) : null;
  // Corrida que visitou páginas e não extraiu UM link interno não mediu um site sem links: o
  // rastreador não leu link nenhum (página renderizada no cliente é a causa comum). Com isso,
  // `orfas === visitadas` sai por construção e TODA medida derivada de link interno — órfãs,
  // periferia, profundidade, links contextuais — fica sem veredito nesta corrida.
  const crawlSemLinks = !!(
    paginado && paginado.visitadas > 0 && paginado.linksNavegacao === 0 && paginado.orfas === paginado.visitadas
  );
  const periferia = paginado && !crawlSemLinks ? ordemDaPeriferia(paginado.paginas, impressoesPorUrl) : [];
  // FR-013: URL do sitemap que responde erro ou redireciona é ACHADO — o sitemap declarando uma
  // URL morta é a informação, não um buraco na medição.
  const achadosDoSitemap = (paginado?.paginas ?? []).filter((pg) => pg.noSitemap && (pg.erro || pg.redirecionada));

  const dias = serie && "days" in serie ? serie.days : null;
  // FR-027, lado GSC: a janela real sai da PRÓPRIA série — `days[0].date` / `days.at(-1).date`.
  // Zero chamada extra: a fonte se autodeclara.
  const recebidaGsc = dias && dias.length ? { inicio: dias[0].date, fim: dias[dias.length - 1].date } : null;
  // 026 — quantos dos 28 dias pedidos pelo bloco de consultas a fonte de fato tem. CONTADO na
  // série, não subtraído das pontas: um buraco no meio não pode virar cobertura cheia.
  const diasRecebidosCurta = dias
    ? dias.filter((d) => d.date >= curtaGsc.inicio && d.date <= curtaGsc.fim).length
    : null;
  const cliques = dias?.reduce((t, d) => t + d.clicks, 0) ?? null;
  const impressoes = dias?.reduce((t, d) => t + d.impressions, 0) ?? null;
  // 028 — a FORMA dos oito meses. A janela é a RECEBIDA (`recebidaGsc`), nunca a pedida: a pedida
  // cobre meses que a propriedade não tinha, e o mês de estreia sairia "inteiro" com os poucos
  // dias que mediu. Medido: goiania estreia em 28/06 e junho desenhava 7 impressões ao lado dos
  // 292 de julho; contra a recebida ele sai da conta e restam 2 meses inteiros. Em roilabs o mesmo
  // cálculo devolve 7 meses — três deles com ZERO impressão MEDIDO, que é o que a série precisa
  // mostrar e o que uma janela de 28 dias esconde.
  const mesesGsc = dias && recebidaGsc ? mesesDaSerie(dias, recebidaGsc) : [];
  const mesesCobertos = mesesGsc.filter((m: { coberto: boolean }) => m.coberto);
  const pontosMes: WeekPoint[] = mesesGsc.map((m: { inicio: string; fim: string; impressoes: number; coberto: boolean }) => ({
    start: m.inicio,
    end: m.fim,
    value: m.coberto ? m.impressoes : null,
  }));
  // ── 025: as duas medidas do board que não existiam ───────────────────────────────────────
  //
  // NENHUMA conta aqui: `completude`, `crescimentoNaoMarca` e `razaoDeMarca` moram em
  // `lib/marca.mjs`, testadas sem subir o Next (Princípio III). Esta seção só chama.
  //
  // ⚠️ `hoje` é o dia de VERDADE, não o `fim` da janela (que já é D-3). É dele que sai a folga de
  // três dias da D9 — e o mês precisa dos três depois de fechar no calendário, porque o GSC ainda
  // sobe a ponta (30/07 da atma saiu com 30 impressões e fechou em 827).
  const diasSeparados = Array.isArray(serieSeparada) ? serieSeparada : null;
  const hojeIso = new Date().toISOString().slice(0, 10);
  const comp = diasSeparados ? completude(diasSeparados) : null;
  const crescimento = diasSeparados ? crescimentoNaoMarca(diasSeparados, hojeIso) : null;
  const razao = diasSeparados ? razaoDeMarca(diasSeparados) : null;
  // A janela que a SEPARAÇÃO cobre, tirada dos próprios dias medidos — e não a pedida. A
  // `conferencia` da corrida soma os 480 dias inteiros, então tela e log podem divergir de veredito
  // LEGITIMAMENTE; sem a janela escrita ao lado, a divergência lê como bug e alguém caça um defeito
  // que não existe.
  // ── NÍVEL 1 (information-design, 18/09): a resposta da tela ────────────────────────────────
  //
  // Esta página tinha ONZE blocos do mesmo peso e nenhum que respondesse a pergunta que ela existe
  // para responder. Pior: o número mais destacado dela era o `43×` de jul→ago aprovado contra a
  // faixa do board — uma razão medida a partir de 27 dias de zero. A série real vai de 17.020
  // impressões não-marca na melhor semana a 1.492 na última, e nada na tela mostrava isso.
  //
  // O bloco abaixo é o único de nível 1. Ele responde com a FORMA da série (35 semanas) e com duas
  // cifras, e todos os outros blocos passam a ser evidência dele.
  // 026 — o veredito sai do SEGMENTO, nunca da série inteira. A Atma trocou
  // `atma.roilabs.com.br` por `usealigner.com`, e a propriedade nova do Search Console nasceu
  // vazia: medir "% do pico" através do corte compararia 8 meses de um site com 5 dias de outro e
  // publicaria uma queda de 98% que é mudança de casa, não perda de tráfego. É o mesmo erro do
  // `43×` que a corrida anterior removeu, com o sinal trocado.
  // 029 — os hosts que o CARD declara como sendo o site. Eles entram na LEITURA e não só na
  // procedência: desde a 029 a corrida grava a soma deles, e a assinatura do dia muda no dia da
  // troca sem que o site tenha mudado. Sem passá-los, a leitura cortaria a série em dois
  // exatamente onde esta feature veio costurá-la.
  const hostsDoSite = hostsDeclarados(p);
  const leitura = diasSeparados ? ritmoDoSegmentoAtual(diasSeparados, hostsDoSite) : null;
  const ritmo = leitura?.ritmo ?? null;
  // O bloco fala do site ANTERIOR quando o atual ainda não fechou duas semanas. Não é ressalva de
  // rodapé: muda o SUJEITO da frase, e sem ele o leitor atribui ao domínio novo uma história que
  // é do antigo.
  const segmentosDepois = leitura?.posteriores ?? [];
  const hostDoVeredito = leitura?.segmento.host ?? null;
  // A fatia sai das somas que `completude` já conferiu — a mesma conta que assina o ✅ do bloco de
  // marca. Recalcular aqui abriria a porta para os dois números divergirem na tela.
  // Uma variável ESTREITADA, não um `comp!` na marcação: `nao-declarada` não tem as somas, e um
  // `!` faria o TypeScript parar de cobrar justamente o estado que existe para ser tratado.
  // 026 — as somas do NÍVEL 1 são do segmento que respondeu, não da série inteira. Somar as
  // impressões dos dois domínios num denominador só produz uma fatia que não é de nenhum dos dois
  // sites. `comp` (série inteira) segue servindo o bloco de CONFERÊNCIA lá embaixo, que é sobre a
  // aritmética das três pernas e não sobre o desempenho de um site.
  const compSeg = leitura ? completude(leitura.segmento.dias) : comp;
  const somasMarca =
    compSeg && compSeg.estado !== "nao-declarada" && compSeg.impressoesPais > 0 ? compSeg : null;
  const fatiaNaoMarca = somasMarca ? somasMarca.impressoesNaoMarca / somasMarca.impressoesPais : null;
  // As semanas PARCIAIS das duas pontas entram no gráfico com `value: null` — "sem dado" e não um
  // valor menor. Desenhá-las pelo que mediram encolheria a última coluna por calendário e pintaria
  // uma queda de 63% que não existe (a ponta da atma tem 2 dias dos 7).
  const semanas = diasSeparados ? semanasNaoMarca(diasSeparados, hostsDoSite) : [];
  const pontos: WeekPoint[] = semanas.map((w) => ({
    start: w.inicio,
    end: w.fim,
    // 026: `w.host === null` numa semana COMPLETA é a semana que cruza a migração — 4 dias de um
    // site e 3 de outro. Ela cai no mesmo estado das parciais (coluna vazia) de propósito: o
    // estado que ela precisa é "fora da leitura", e ele já existe. Um quarto estado só para ela
    // custaria uma chave a mais na legenda e diria a mesma coisa.
    value: w.completa && w.host !== null ? w.impressoesNaoMarca : null,
  }));
  // O corte: o primeiro slot cujo host difere do slot anterior nomeado. Sai do DADO (a coluna
  // `host` de `hub_gsc_dia`), nunca de `dominioAnterior.data` — o Search Console segue atribuindo
  // tráfego ao domínio antigo por semanas depois do 301, e a data declarada da migração cairia
  // antes do corte real. Some sozinho quando a série tiver um host só.
  const corte: WeekCut | undefined = (() => {
    const nomeadas = semanas.map((w) => w.host);
    for (let i = 1; i < nomeadas.length; i++) {
      const anterior = nomeadas.slice(0, i).filter(Boolean).at(-1);
      if (anterior && nomeadas[i] && nomeadas[i] !== anterior) {
        // 029 — a assinatura é gravada com `+`; o rótulo do corte mostra a lista legível. Sem
        // isto o gráfico exibe `a.com+b.com`, que é a forma de armazenamento vazando para a tela.
        return { index: i, antes: anterior.split("+").join(" + "), depois: nomeadas[i]!.split("+").join(" + ") };
      }
    }
    return undefined;
  })();
  // 030 — a JANELA de foco. A escala compartilhada não sustenta as quatro ordens de magnitude da
  // série (pico 17.020 contra 1.492 na última completa): as seis últimas semanas desenhavam 14,
  // 14, 11, 5, 3 e 3 unidades de 56, e 114, 28, 7 e 2 desenhavam a MESMA barra de 1 unidade. A
  // função devolve `null` quando não há esmagamento a desfazer, e aí a tela desenha UM gráfico —
  // é ela, e não a marcação, que decide se existe segundo gráfico.
  const foco: Foco | null = janelaDeFoco(pontos);
  // O slot do pico, para rotulá-lo na tira de contexto. Sai de `ritmo.pico`, o MESMO objeto que
  // assina o "% do pico" do título: derivar um segundo pico aqui abriria a porta para o rótulo do
  // gráfico e a cifra do título apontarem para semanas diferentes.
  const picoIndex = ritmo
    ? pontos.findIndex((pt) => pt.start === ritmo.pico.inicio && pt.value !== null)
    : -1;

  // 029 — QUEM a série soma e DESDE QUANDO. Sai do DADO (a assinatura gravada na coluna `host`),
  // nunca de `dominioAnterior.data`: é a assinatura que diz o que a corrida de fato somou, e a data
  // declarada da troca cai antes do primeiro dia em que o domínio novo teve impressão.
  //
  // A CONTRIBUIÇÃO de cada host não está aqui, e não se inventa: a tabela guarda a soma do dia e
  // não a parcela de cada domínio. O que a tela pode afirmar é quem entrou e quando — dizer "97%
  // vem do domínio antigo" exigiria uma linha por host, que é outra spec.
  const somaDaSerie = (() => {
    const desde = new Map<string, string>();
    for (const d of diasSeparados ?? []) {
      for (const h of (d.host ?? "").split("+").filter(Boolean)) if (!desde.has(h)) desde.set(h, d.dia);
    }
    return [...desde.entries()].map(([host, dia]) => ({ host, dia }));
  })();

  // G3/G25 — procedência e frescor. `criado` é quando a corrida GRAVOU; `ultimoDiaMedido` é o
  // último dia que o Search Console cobriu. A distância entre o último dia medido e HOJE é a idade
  // real: a fonte promete D-3, e acima disso a corrida parou ou a fonte atrasou. Um número velho
  // sem esta linha é indistinguível de um número de hoje — e é o defeito que mais ilude, porque o
  // painel continua bonito e continua errado.
  // 026 — a idade é a do SEGMENTO que respondeu, não a da série inteira. Depois da migração, a
  // série inteira segue crescendo no site NOVO enquanto o bloco fala do ANTIGO: medir a idade pela
  // ponta da série diria "há 2 dias" sobre números que pararam de se mover e nunca mais vão se
  // mover. Série encerrada não é dado velho — a promessa de D-3 não se aplica a ela, e o alarme de
  // `dadoVelho` disparando para sempre treinaria o leitor a ignorá-lo.
  const diasDoVeredito = leitura?.segmento.dias ?? diasSeparados;
  const ultimoDiaMedido = diasDoVeredito?.length ? diasDoVeredito[diasDoVeredito.length - 1].dia : null;
  const serieEncerrada = segmentosDepois.length > 0;
  const gravadoEm = diasSeparados?.length
    ? diasSeparados.map((d) => d.criado).filter((c): c is string => !!c).sort().at(-1) ?? null
    : null;
  const ATRASO_PROMETIDO_DIAS = 3; // o D-3 do Search Console
  const FOLGA_DIAS = 2; // a corrida é diária; dois dias cobrem um fim de semana de falha
  const idadeDoDado =
    ultimoDiaMedido !== null
      ? Math.round((Date.parse(hojeIso + "T00:00:00Z") - Date.parse(ultimoDiaMedido + "T00:00:00Z")) / 864e5)
      : null;
  const dadoVelho = !serieEncerrada && idadeDoDado !== null && idadeDoDado > ATRASO_PROMETIDO_DIAS + FOLGA_DIAS;

  // A janela do NÍVEL 1 é a do segmento; a do bloco de conferência segue sendo a da série inteira.
  const diasComMarcaSeg = (leitura?.segmento.dias ?? []).filter(
    (d) => typeof d.impressoesMarca === "number"
  );
  const janelaSeg = diasComMarcaSeg.length
    ? { inicio: diasComMarcaSeg[0].dia, fim: diasComMarcaSeg[diasComMarcaSeg.length - 1].dia }
    : null;
  const diasComMarca = (diasSeparados ?? []).filter((d) => typeof d.impressoesMarca === "number");
  const janelaMarca = diasComMarca.length
    ? { inicio: diasComMarca[0].dia, fim: diasComMarca[diasComMarca.length - 1].dia }
    : null;

  // ── Migração de domínio: o site que o crawl visitou contra o que o hub declara ──────────────
  //
  // O host sai do DADO das duas pontas, nunca de texto fixo: `p.url` é o que o hub declara, e o
  // host majoritário das páginas visitadas é onde o crawl de fato chegou (ele segue o 301). Quando
  // os dois divergem, a tela está juntando dois sites diferentes sob um nome só — e some sozinha
  // quando `data/projects.json` for corrigido, sem ninguém lembrar de apagar um aviso.
  const hostDeclarado = (() => {
    try { return p.url ? new URL(p.url).hostname : null; } catch { return null; }
  })();
  const hostCrawleado = (() => {
    const contagem = new Map<string, number>();
    for (const pagina of paginado?.paginas ?? []) {
      try {
        const host = new URL(pagina.url).hostname;
        contagem.set(host, (contagem.get(host) ?? 0) + 1);
      } catch { /* URL inválida na corrida não vota */ }
    }
    return [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  })();
  const propriedadeGsc = serie && "property" in serie ? serie.property : null;
  const dominioDaPropriedade = propriedadeGsc?.startsWith("sc-domain:") ? propriedadeGsc.slice(10) : null;
  // A propriedade cobre o host novo? `sc-domain:` cobre o domínio e os subdomínios dele — e mais
  // nada. Checagem de string, zero chamada extra à API.
  const novoHostCoberto = !!(
    dominioDaPropriedade && hostCrawleado &&
    (hostCrawleado === dominioDaPropriedade || hostCrawleado.endsWith("." + dominioDaPropriedade))
  );
  const migrou =
    hostDeclarado && hostCrawleado && hostDeclarado !== hostCrawleado
      ? { de: hostDeclarado, para: hostCrawleado, dia: paginado?.dia ?? null }
      : null;

  // Migração DECLARADA no card. Distinta do `migrou` acima: lá o hub está desatualizado e o conserto
  // é editar `projects.json`; aqui o hub já está certo e o que precisa ser dito é POR QUE a série
  // encurtou. Propriedade nova do Search Console nasce vazia — a queda é troca de casa, não perda de
  // tráfego, e sem esta linha o leitor lê catástrofe onde não houve nenhuma.
  //
  // Some sozinha quando a janela recebida alcançar a pedida, ou seja, quando a propriedade nova
  // tiver histórico suficiente. Ninguém precisa lembrar de apagar o aviso.
  const migracao =
    p.dominioAnterior && recebidaGsc && recebidaGsc.inicio > janelaGsc.inicio
      ? {
          ...p.dominioAnterior,
          hostAnterior: (() => {
            try { return new URL(p.dominioAnterior.url).hostname; } catch { return p.dominioAnterior.url; }
          })(),
        }
      : null;

  const recebidaGa4 = cobertura && "primeiro" in cobertura ? { inicio: cobertura.primeiro, fim: cobertura.ultimo } : null;
  const sessoes = canais && "linhas" in canais ? canais.linhas.reduce((t, l) => t + l.sessoes, 0) : null;
  // 026 — o que a propriedade mediu FORA dos hosts declarados (`hostsDoSite`, definido junto da
  // leitura da série): a exclusão nomeada do bloco de Comportamento.
  const fora = canais && "linhas" in canais ? (canais.fora ?? []) : [];
  const foraTotal = fora.reduce((t, f) => t + f.sessoes, 0);

  // ── 028 · A PROCEDÊNCIA DA TELA INTEIRA, UMA VEZ ────────────────────────────────────────────
  //
  // Seis fontes alimentam os onze blocos abaixo, e em 18/09 CINCO delas estavam afetadas pela
  // mesma coisa: a troca de domínio de 11/09. As cinco corridas anteriores descobriram isso uma
  // fonte por vez e escreveram a ressalva onde a acharam — doze parágrafos contando pedaços da
  // mesma história, nenhum contando a história. Medido: `Consultas` 782px e `Dentro das páginas`
  // 850px contra 686px do bloco de nível 1.
  //
  // Esta tabela é o lugar único da história. Cada bloco abaixo perde a sua versão e fica com um
  // selo que aponta para cá. Não é ressalva nova: é a mesma, hasteada.
  // 028 — `cobreAte` é o dia mais recente que a fonte cobre, e `tolerancia` é a cadência que ELA
  // promete. Os dois existem para o `<Frescor>`: sem a tolerância por fonte, o crawl semanal de
  // 4 dias apareceria atrasado ao lado da indexação diária de 4 dias, que está.
  const instrumentos: {
    nome: string;
    mede: string;
    desde: string;
    selo: Selo;
    nota: string;
    cobreAte: string | null;
    tolerancia: number;
  }[] = [];
  const TOLERANCIA_D3 = ATRASO_PROMETIDO_DIAS + FOLGA_DIAS; // as fontes que prometem D-3
  const TOLERANCIA_DIARIA = 2; // a corrida das 05:47, com um dia de folga
  const TOLERANCIA_SEMANAL = 7 + FOLGA_DIAS; // a corrida de segunda 06:17
  if (diasSeparados?.length) {
    // `hostDoVeredito` sai do SEGMENTO que o veredito usa, e ele só existe quando há separação
    // marca / não-marca — ou seja, em 1 dos 35 projetos. Cair em "host não identificado" nos
    // outros 34 seria inventar uma ausência: `hub_gsc_dia.host` está preenchido em 5.840 de 5.840
    // linhas desde o backfill de 18/09. O último dia da série sabe de que site ele veio.
    // 029 — a assinatura do ÚLTIMO dia, não a do segmento: `mede` responde "o que esta fonte mede
    // hoje", e o segmento carrega a assinatura do dia em que ele COMEÇOU. Numa série que atravessa
    // a migração, a do começo é o domínio antigo sozinho — a resposta certa para janeiro e errada
    // para hoje.
    const hostDaSerie =
      [...diasSeparados].reverse().find((d) => d.host)?.host ?? hostDoVeredito ?? null;
    instrumentos.push({
      nome: "Série gravada",
      // 029 — a assinatura é gravada com `+`; na tela ela vira a lista dos domínios somados.
      mede: hostDaSerie ? hostDaSerie.split("+").join(" + ") : "host não gravado nesta série",
      desde: ultimoDiaMedido ? `até ${ultimoDiaMedido}` : "—",
      selo: serieEncerrada ? "fim" : "dado",
      nota: serieEncerrada
        ? `${leitura ? leitura.segmento.dias.length : diasSeparados.length} dia(s) preservados; não crescem mais. O site passou a ser medido em ${segmentosDepois[segmentosDepois.length - 1]?.host ?? "outro host"}, que ainda não tem semana completa.`
        : `${diasSeparados.length} dia(s) em hub_gsc_dia, gravados pela corrida diária.`,
      cobreAte: ultimoDiaMedido,
      tolerancia: TOLERANCIA_D3,
    });
  }
  if (propriedadeGsc) {
    const estreita = baseCurta !== null && baseCurta < PISO_IMPRESSOES_VEREDITO;
    instrumentos.push({
      nome: "Consultas ao vivo",
      // 030 — com dois hosts somados a propriedade da SÉRIE (um host só) não descreve o que esta
      // linha mede. Um host: a propriedade de sempre.
      mede: declaraHosts && hostsSomados ? hostsSomados : propriedadeGsc,
      desde: recebidaGsc ? `desde ${recebidaGsc.inicio}` : "—",
      selo: baseCurta === 0 ? "sem" : estreita ? "piso" : "dado",
      nota:
        baseCurta === 0
          ? "A janela não teve impressão nenhuma: não há base para fração nem para régua."
          : estreita
            ? `${br(baseCurta!)} impressões em ${diasRecebidosCurta ?? "?"} dos 28 dias pedidos. A faixa do board tem 10 pontos de largura e cada impressão vale ${(100 / baseCurta!).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} deles — a régua só passa a valer a partir de ${br(PISO_IMPRESSOES_VEREDITO)}.`
            : /* G5: `?? 0` aqui publicaria "0 impressões na janela" quando a consulta não
                 respondeu — ausência virando zero real, na mesma tabela que existe para dizer em
                 que estado cada fonte está. */
              baseCurta === null
              ? "A consulta respondeu, mas o total de impressões da janela não foi apurado."
              : `${br(baseCurta)} impressões na janela de 28 dias.`,
      cobreAte: recebidaGsc?.fim ?? null,
      tolerancia: TOLERANCIA_D3,
    });
  }
  if (indexacao) {
    const cega = !!idx && idx.inspecionadas > 0 && idx.falhas === idx.inspecionadas;
    instrumentos.push({
      nome: "Indexação",
      mede: (indexacao && !("erro" in indexacao) ? indexacao.propriedade : null) ?? "—",
      // A data da apuração congelada FICA: "—" diria que este projeto nunca foi medido, e o bloco
      // abaixo exibe "Apurado em <dia>" na linha seguinte — duas versões do mesmo fato.
      desde: idxCongelado ? idxCongelado.dia : idx ? idx.dia : "—",
      selo:
        "erro" in indexacao ? "cega" : idxCongelado ? "fim" : cega ? "cega" : idx ? "dado" : "sem",
      nota:
        "erro" in indexacao
          ? `A leitura da apuração falhou agora (${indexacao.erro}).`
          : idxCongelado
            ? `A corrida percorre só ${SLUGS_DE_BUSCA.join(", ")}. As ${br(idxCongelado.declaradas)} URL(s) declaradas foram apuradas em ${idxCongelado.dia} e o número não cresce mais — é decisão de escopo, não falha nem fila.`
          : cega
            ? `${br(idx!.falhas)} de ${br(idx!.inspecionadas)} inspeções falham${propriedadeForaDoSite ? `: a propriedade não cobre ${hostDeclarado ?? p.url}, e a API de inspeção recusa toda URL fora da propriedade. O conserto é na corrida, não nesta tela.` : "."}`
            : idx
              ? `${br(idx.inspecionadas)} URL(s) inspecionadas de ${br(idx.declaradas)} declaradas.`
              : "Nenhuma apuração gravada para este projeto.",
      // A data sai do registro mesmo quando há `motivo` (sem_orcamento, sem_sitemap): a corrida
      // RODOU e decidiu não inspecionar, que é diferente de nunca ter rodado.
      cobreAte: "erro" in indexacao ? null : indexacao.dia,
      tolerancia: TOLERANCIA_DIARIA,
    });
  }
  if (crawl) {
    instrumentos.push({
      nome: "Crawl de página",
      mede: paginado?.paginas?.[0] ? (() => { try { return new URL(paginado.paginas[0].url).hostname; } catch { return p.url; } })() : p.url,
      desde: paginado ? paginado.dia : "—",
      selo: "erro" in crawl ? "cega" : crawlSemLinks ? "cega" : paginado ? "dado" : "sem",
      nota:
        "erro" in crawl
          ? `A leitura da corrida falhou agora (${crawl.erro}).`
          : crawlSemLinks
            ? "A corrida casou os links contra o domínio ANTIGO, que o 301 da home já tinha desmentido, e descartou todos como externos: zero aresta. Por isso as órfãs, a periferia, a profundidade e a densidade contextual ficam sem veredito — e as órfãs exibidas seriam falsas. Corrigido no hub em 18/09; a próxima corrida de segunda mede certo."
            : paginado
              ? `${br(paginado.visitadas)} página(s) visitadas de ${br(paginado.declaradas)} declaradas no sitemap.`
              : "Nenhuma corrida completa gravada.",
      cobreAte: paginado?.dia ?? null,
      tolerancia: TOLERANCIA_SEMANAL,
    });
  }
  if (vitais) {
    instrumentos.push({
      nome: "Campo (CrUX)",
      mede: hostDeclarado ?? p.url,
      desde: "janela da CrUX",
      selo: "erro" in vitais ? "cega" : vitais.fracao === null ? "sem" : "dado",
      nota:
        "erro" in vitais
          ? `A consulta falhou agora (${vitais.erro}).`
          : vitais.fracao === null
            ? `Origem nova não tem amostra de campo: a CrUX só publica o que passou do limiar de tráfego dela, e responde 404 até lá. Isto não é site lento — é site ainda não medido.`
            : `${vitais.comDado} de ${vitais.consultadas} URL(s) consultadas têm os três vitais.`,
      // A CrUX não data a apuração: a janela é dela, móvel, de 28 dias, e não há "dia da
      // apuração" a desenhar. Sem tique é mais honesto que um tique em hoje.
      cobreAte: null,
      tolerancia: TOLERANCIA_D3,
    });
  }
  if (p.ga4?.propertyId) {
    instrumentos.push({
      nome: "Comportamento",
      mede: hostsDoSite.length ? hostsDoSite.join(" + ") : p.url,
      desde: recebidaGa4 ? `desde ${recebidaGa4.inicio}` : "—",
      selo: canais && "erro" in canais ? "cega" : sessoes !== null ? "dado" : "sem",
      nota:
        canais && "erro" in canais
          ? `A consulta ao GA4 falhou agora (${canais.erro}).`
          : foraTotal > 0
            ? `A propriedade ${p.ga4.propertyId} conta qualquer coisa que carregue a tag. ${br(foraTotal)} sessão(ões) de ${fora.length} outro(s) host(s) ficam FORA das cifras deste bloco, nomeadas nele.`
            : `Propriedade ${p.ga4.propertyId}; nenhuma sessão medida fora dos hosts declarados.`,
      cobreAte: recebidaGa4?.fim ?? null,
      tolerancia: TOLERANCIA_D3,
    });
  }

  return (
    <main className="page">
      <Tabs active="okr" okrSlug={slug} />

      <section className="card ag-section" data-info="aquisicao">
        <p className="eyebrow">OKR · aquisição de {nomeCurto}</p>
        <h1 className="ficha-nome">Descoberta e Comportamento em janela longa</h1>
        {/* FR-028: o leitor tem que saber que esta NÃO é uma tela de segunda-feira. */}
        <p className="foot">
          <strong>Cadência de leitura: trimestral.</strong> Descoberta e Comportamento se movem por
          trimestre, não por semana — ler esta página toda segunda produz ruído, não decisão. A tela
          semanal é a <a href={`/okr/${slug}`}>ficha</a>; a derivação da conta é o{" "}
          <a href={`/okr/${slug}/metodo`}>método</a>.
        </p>

        {/* 028 — A TROCA DE DOMÍNIO SAIU DAQUI.
            Os dois parágrafos que ficavam neste ponto contavam, em 14 linhas de prosa, o que a
            tabela de instrumentos abaixo diz em 6 linhas com selo: qual fonte mede qual host, desde
            quando, e em que estado está. Ficando ACIMA do bloco de nível 1, eram a primeira coisa
            lida numa tela cuja primeira coisa deveria ser a resposta — ressalva ocupando o lugar da
            conclusão. O `porque`, o histórico preservado e a exceção do bloco de marca foram para o
            `<details>` da tabela, que é onde o leitor vai quando o selo o manda ir.
            O que sobra aqui é a única linha que a tabela NÃO diz: que o hub está desatualizado e o
            conserto é editar `data/projects.json`. Ela some sozinha quando a URL for corrigida. */}
        {migrou ? (
          <p className="foot" style={{ borderLeft: "3px solid var(--borda)", paddingLeft: "0.75rem" }}>
            <strong>O card está desatualizado.</strong> O crawl de{" "}
            <strong>{migrou.dia ?? "—"}</strong> visitou <code>{migrou.para}</code>, e{" "}
            <code>data/projects.json</code> ainda declara <code>{migrou.de}</code> — o antigo
            responde <strong>301</strong> para o novo. Enquanto isso for verdade, a tabela abaixo
            mostra fontes medindo <strong>sites diferentes</strong>. Este aviso some sozinho quando a
            URL do projeto for corrigida.
          </p>
        ) : null}

        {/* ── NÍVEL 1 · a resposta ────────────────────────────────────────────────────────────
            Um bloco, e só um. Os onze abaixo são evidência dele e por isso ficam mais fracos.
            A forma responde o que a razão mensal não responde: o FORMATO dos oito meses. */}
        {ritmo && somasMarca && fatiaNaoMarca !== null ? (
          <div className="nm-resposta" data-info="aquisicao-nao-marca" id="nao-marca">
            {/* G5: nada de `?? 0` aqui. `fracaoDoPico` é null quando TODA semana completa deu
                zero — e "0% do pico" afirmaria sobre o site o que é ausência de pico. */}
            <h2 className="nm-h">
              {ritmo.fracaoDoPico === null ? (
                <>
                  {nomeCurto} é encontrada por quem não a conhece — mas não há pico na série para
                  medir o volume contra
                </>
              ) : (
                <>
                  {nomeCurto} é encontrada por quem não a conhece — e o volume disso está em{" "}
                  <strong>{pct(ritmo.fracaoDoPico)}</strong> do pico
                </>
              )}
            </h2>

            {/* G27: NÃO é uma fileira de tiles iguais. A primeira cifra é a resposta ao "está
                sendo encontrada por quem não a conhece?" e domina; as duas seguintes qualificam o
                volume e são deliberadamente menores. A fração do pico não se repete aqui — ela já
                é o número do título, e repeti-la seria o donut com o número que a legenda já diz. */}
            <div className="nm-cifras">
              <div className="nm-cifra-1">
                <div className="nm-rotulo">Impressões de quem não busca a marca</div>
                <div className="nm-valor">{pct(fatiaNaoMarca)}</div>
                <div className="foot">
                  {br(somasMarca.impressoesNaoMarca)} de {br(somasMarca.impressoesPais)} impressões
                  {janelaSeg ? <> · {janelaSeg.inicio} → {janelaSeg.fim}</> : null}
                  {somaDaSerie.length ? (
                    <> · <code>{somaDaSerie.map((h) => h.host).join(" + ")}</code></>
                  ) : null}
                  {decl.motivo === null ? <> · corte <code>{decl.pais}</code></> : null}
                </div>
              </div>
              <div className="nm-cifra-2">
                <div className="nm-rotulo">Última semana completa · melhor semana</div>
                <div className="nm-valor">
                  {br(ritmo.ultima.impressoesNaoMarca)} <span className="nm-contra">de</span>{" "}
                  {br(ritmo.pico.impressoesNaoMarca)}
                </div>
                <div className="foot">
                  impressões não-marca em {ritmo.ultima.inicio} → {ritmo.ultima.fim}, contra{" "}
                  {ritmo.pico.inicio} → {ritmo.pico.fim}
                </div>
              </div>
              <div className="nm-cifra-2">
                <div className="nm-rotulo">Posição média · melhor semana → última</div>
                <div className="nm-valor">
                  {ritmo.pico.posicao === null
                    ? "—"
                    : ritmo.pico.posicao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                  <span className="nm-contra"> → </span>
                  {ritmo.ultima.posicao === null
                    ? "—"
                    : ritmo.ultima.posicao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                </div>
                <div className="foot">média das posições diárias · menor é melhor</div>
              </div>
            </div>

            <div className="nm-grafico">
              {/* 030 — FOCO + CONTEXTO no lugar de um eixo linear compartilhado de 37 semanas.
                  `janelaDeFoco` é quem decide se há dois gráficos; `picoIndex` é quem rotula o
                  pico, e ele sai do MESMO `ritmo.pico` que assina o "% do pico" do título. */}
              <SerieComFoco
                pontos={pontos}
                fmt={(v) => `${br(v)} impressões`}
                cut={corte}
                foco={foco}
                picoIndex={picoIndex >= 0 ? picoIndex : null}
              />
              {/* Os 37 valores só existiam no `<title>` do SVG — ou seja, no hover. */}
              <SerieEmTabela pontos={pontos} fmt={(v) => `${br(v)} impressões`} />
            </div>

            {/* O veredito em texto. Ele NÃO pode dizer "caindo" de graça: a última semana da atma
                subiu (1.449 → 1.492) depois de quatro de recuo, e `quedasConsecutivas` é quem
                decide a frase. Trocar um veredito falso por outro não teria consertado nada. */}
            {/* 026 — quando o bloco fala do site ANTERIOR, isso vem ANTES do veredito e não depois.
                A frase abaixo diz "Estacionado bem abaixo do pico" sobre `atma.roilabs.com.br`; o
                leitor que chega hoje pensa em `usealigner.com`, que é o site do card. Sem esta
                linha o bloco atribui ao domínio novo uma história que não é dele — e o domínio
                novo não tem história nenhuma ainda, que é justamente o que precisa ser dito. */}
            {segmentosDepois.length > 0 ? (
              <p className="nm-corte-aviso">
                <strong>Esta leitura é do site anterior</strong> (<code>{hostDoVeredito}</code>).{" "}
                {segmentosDepois.map((seg) => (
                  <span key={seg.host ?? "sem-host"}>
                    <code>{seg.host ?? "site não identificado"}</code> tem {seg.dias.length} dia(s)
                    medidos e nenhuma semana completa — não há forma para ler ainda.{" "}
                  </span>
                ))}
                Propriedade nova do Search Console nasce vazia: a diferença entre os dois lados do
                corte é troca de casa, não queda de tráfego.
              </p>
            ) : null}

            <p className="nm-veredito">
              {ritmo.quedasConsecutivas >= 2 ? (
                <>
                  <strong>Caindo.</strong> São {ritmo.quedasConsecutivas} semanas completas de recuo
                  consecutivo até {ritmo.ultima.fim}.
                </>
              ) : ritmo.fracaoDoPico !== null && ritmo.fracaoDoPico < 0.5 ? (
                <>
                  <strong>Estacionado bem abaixo do pico.</strong> A última semana completa não vem
                  caindo ({ritmo.quedasConsecutivas === 0 ? "ela subiu contra a anterior" : "recuou uma semana só"}),
                  mas vale {pct(ritmo.fracaoDoPico)} da melhor semana da série. O que falta não é
                  retomar o crescimento a partir de agora — é reconquistar o volume que já existiu.
                </>
              ) : ritmo.fracaoDoPico === null ? (
                /* G5 — `?? 0` aqui dizia "No nível do pico. A última semana completa vale 0% da
                   melhor da série" sobre uma série em que TODA semana completa deu zero: não há
                   pico, e "no nível do pico" é o veredito mais otimista possível sobre o pior dado
                   possível. Nulo virando zero, e o zero virando aprovação. */
                <>
                  <strong>Sem pico para medir contra.</strong> Toda semana completa desta série deu{" "}
                  <strong>zero</strong> impressão não-marca — não há melhor semana, e por isso não
                  há fração. Isto <strong>não</strong> é estar no nível do pico.
                </>
              ) : (
                <>
                  <strong>No nível do pico.</strong> A última semana completa vale{" "}
                  {pct(ritmo.fracaoDoPico)} da melhor da série.
                </>
              )}{" "}
              <span className="foot">
                Só semanas de 7 dias entram nesta leitura. Fonte: <code>hub_gsc_dia</code>, série
                gravada pela corrida diária
                {somaDaSerie.length ? (
                  <>
                    {" "}somando{" "}
                    {somaDaSerie.map((h, i) => (
                      <span key={h.host}>
                        {i > 0 ? " + " : ""}
                        <code>{h.host}</code> (desde {h.dia})
                      </span>
                    ))}
                  </>
                ) : null}{" "}
                — {leitura ? leitura.segmento.dias.length : diasSeparados!.length} dias
                {leitura && leitura.segmento.dias.length !== diasSeparados!.length ? (
                  <> dos {diasSeparados!.length} da série</>
                ) : null}. As cifras de busca do resto da tela vêm do site declarado no card e{" "}
                <strong>não se comparam</strong> com estas quando os dois diferem.
                <br />
                {/* G3/G25 — os três que fazem de um número informação: DE QUANDO, DE ONDE, e sobre
                    qual total. O total está nas cifras acima; os outros dois estão aqui. */}
                Último dia medido: <strong>{ultimoDiaMedido}</strong>
                {serieEncerrada ? (
                  <> — esta série <strong>encerrou</strong> aqui e não cresce mais; o site passou a
                    ser medido em <code>{segmentosDepois[segmentosDepois.length - 1].host ?? "outro host"}</code></>
                ) : idadeDoDado !== null ? (
                  <> (há {idadeDoDado} dia(s))</>
                ) : null}
                {gravadoEm ? <> · gravado em <strong>{gravadoEm}</strong></> : null}
                {serieEncerrada ? null : (
                  <> · o Search Console entrega com <strong>{ATRASO_PROMETIDO_DIAS} dias</strong> de
                    atraso.</>
                )}
                {dadoVelho ? (
                  <>
                    {" "}
                    <strong className="nm-velho">
                      ⚠ Dado velho: a promessa de D-{ATRASO_PROMETIDO_DIAS} estourou
                    </strong>{" "}
                    — a corrida diária parou ou a fonte atrasou. Os números acima seguem certos para{" "}
                    {ultimoDiaMedido}, e não dizem nada sobre os {idadeDoDado! - ATRASO_PROMETIDO_DIAS}{" "}
                    dia(s) desde então.
                  </>
                ) : null}
              </span>
            </p>
          </div>
        ) : (
          <div
            /* 029 — a reserva de altura (G24) existe para a ausência TRANSITÓRIA, que vira dado
               sozinha. `decl.motivo` é a ausência DECLARADA: não muda até alguém editar o card. */
            className={decl.motivo ? "nm-resposta nm-declarada" : "nm-resposta"}
            data-info="aquisicao-nao-marca"
            id="nao-marca"
          >
            <h2 className="nm-h">A resposta desta tela ainda não é apurável</h2>
            {/* TRÊS ausências, três consertos diferentes. Colapsar as três em "não apurado" faria
                "ninguém declarou os termos de marca" (conserto: editar o card, 2 minutos) parecer
                com "a série é curta demais" (conserto: esperar semanas) — e 34 dos 35 projetos
                caem na primeira, não na segunda. Um motivo genérico manda esperar por algo que
                nunca vai chegar sozinho. */}
            <p className="foot">
              {!diasSeparados ? (
                <>
                  <strong>não apurado</strong> — a série de{" "}
                  <code>hub_gsc_dia</code> não foi lida: banco fora do ar, ou este projeto ainda não
                  entrou na corrida diária.
                </>
              ) : decl.motivo !== null ? (
                <>
                  <strong>não apurado</strong> — {nomeCurto} tem{" "}
                  <strong>{diasSeparados.length} dia(s)</strong> de série, mas nenhum com a
                  separação marca / não-marca: o card não declara os termos de marca{" "}
                  (<code>{decl.motivo}</code>). Sem saber quais buscas são o nome da empresa, não há
                  como dizer quanto da demanda vem de quem ainda não a conhece.{" "}
                  <strong>O conserto é declarar os termos em <code>data/projects.json</code></strong>,
                  não esperar mais dados.
                </>
              ) : !diasComMarca.length ? (
                <>
                  <strong>não apurado</strong> — os termos de marca estão declarados, mas a corrida
                  ainda não gravou nenhum dia com a separação. Ela roda diariamente; o primeiro dia
                  aparece aqui na próxima.
                </>
              ) : (
                <>
                  <strong>não apurado</strong> — a série tem{" "}
                  <strong>{diasComMarca.length} dia(s)</strong> com a separação, e menos de{" "}
                  <strong>duas semanas completas</strong> de 7 dias. Uma semana só não tem forma
                  para ler, e uma fração aqui seria um veredito sobre nada.
                </>
              )}{" "}
              Não é <strong>zero</strong>: o que falta é medição, não demanda.
            </p>
          </div>
        )}

        {/* ── NÍVEL 2 · o primeiro da evidência, e o que dá sentido aos outros ──────────────────
            Seis fontes, uma linha cada: o que mede HOJE, desde quando, e em que estado está. É a
            procedência da tela inteira num lugar só (janela · fonte · apuração, como manda o
            gate G3/G32) e é o que permite a cada bloco abaixo ficar com o número e o selo. */}
        {instrumentos.length > 0 && (
          <div className="ficha-bloco">
            <h2 className="ficha-bloco-h">O instrumento — o que cada fonte mede hoje</h2>
            <table className="inst">
              <thead>
                <tr>
                  <th scope="col">Fonte</th>
                  <th scope="col">Mede</th>
                  <th scope="col">Apuração · idade</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {instrumentos.map((i) => (
                  <tr key={i.nome}>
                    <td className="inst-n">{i.nome}</td>
                    <td className="inst-q"><code>{i.mede}</code></td>
                    <td className="inst-d">
                      {i.desde}
                      {/* Sem data não há tique: a CrUX não publica dia de apuração, e um tique em
                          hoje inventaria frescor que ninguém mediu. */}
                      {i.cobreAte ? (
                        <Frescor
                          cobreAte={i.cobreAte}
                          hoje={hojeIso}
                          tolerancia={i.tolerancia}
                          encerrada={i.selo === "fim"}
                        />
                      ) : null}
                    </td>
                    <td className="inst-s"><SeloEstado tipo={i.selo} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* A legenda do eixo fica VISÍVEL, não atrás de um clique: barra sem escala declarada é
                o "sobe em relação a quê?" que o piso da skill proíbe. */}
            <p className="foot">
              Eixo: <strong>{FRESCOR_DIAS} dias</strong> até hoje ({hojeIso}). O tique é o dia mais
              recente que a fonte cobre; a faixa clara é o prazo que <strong>ela</strong> promete —
              fora dela está atrasada. Série <strong>encerrada</strong> não tem prazo, e por isso não
              tem faixa.
            </p>
            <details className="ress">
              <summary>
                {(() => {
                  const cegas = instrumentos.filter((i) => i.selo !== "dado").length;
                  return cegas === 0
                    ? `As ${instrumentos.length} fontes estão com dado — de onde cada número vem`
                    : `Por que ${cegas} das ${instrumentos.length} fontes não dão veredito cheio`;
                })()}
              </summary>
              <dl>
                {/* A troca de domínio é a causa COMUM dos selos abaixo, então vem primeiro e uma
                    vez só. Ela ocupava dois parágrafos acima do bloco de nível 1 — ressalva no
                    lugar da conclusão. */}
                {migracao ? (
                  <>
                    <dt>A troca de domínio, em {migracao.data}</dt>
                    <dd>
                      O projeto media <code>{migracao.hostAnterior}</code> e passou a medir{" "}
                      <code>{hostDeclarado}</code> — {migracao.porque}. As fontes que consultam o
                      Search Console <strong>ao vivo</strong> somam os hosts declarados e têm dado
                      só a partir de <strong>{recebidaGsc?.inicio ?? "—"}</strong>: a janela vem
                      truncada.
                      {/* 031 (D8): "o instrumento é novo" só é verdade quando um host declarado FICOU
                          DE FORA da soma. Com os dois somados, o bloco só aparece se a união ainda
                          não alcança a janela pedida — e a frase fixa dizia que a fonte lia só o
                          host novo, o que a leitura deixou de fazer. */}
                      {serieLida && serieLida.encerrados.length > 0 ? (
                        <>
                          {" "}
                          Sem propriedade no Search Console e fora da soma:{" "}
                          <code>{serieLida.encerrados.join(", ")}</code> — o histórico não entra, então
                          o volume baixo é da leitura e <strong>não</strong> do tráfego.
                        </>
                      ) : null}
                      {migracao.historico ? (
                        <> O histórico anterior não se perdeu — {migracao.historico}.</>
                      ) : null}
                      {/* G3: bloco que mede outro SUJEITO declara. 029 — a série gravada soma os
                          hosts declarados. 031 — as fontes ao vivo também, então a frase "as fontes
                          ao vivo medem só o domínio novo" saiu: deixou de ser verdade. */}
                      {diasSeparados?.length ? (
                        <>
                          {" "}
                          <strong>Marca e não-marca:</strong> esse bloco lê a série{" "}
                          <strong>gravada</strong> ({diasSeparados.length} dia(s) em{" "}
                          <code>hub_gsc_dia</code>), que desde{" "}
                          {somaDaSerie.length > 1 ? somaDaSerie[somaDaSerie.length - 1].dia : "a troca"}{" "}
                          <strong>soma os domínios declarados</strong>
                          {somaDaSerie.length > 1 ? (
                            <> ({somaDaSerie.map((h) => h.host).join(" + ")})</>
                          ) : null}
                          .
                        </>
                      ) : null}
                    </dd>
                  </>
                ) : null}
                {instrumentos.map((i) => (
                  <div key={i.nome}>
                    <dt>{i.nome}</dt>
                    <dd>{i.nota}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </div>
        )}

        <div className="ficha-bloco">
          <h2 className="ficha-bloco-h">Descoberta — Search Console, 8 meses</h2>
          <ReguaJanela pedida={janelaGsc} recebida={recebidaGsc} legenda="8 meses pedidos" />
          {declaraHostsSerie && serieLida ? (
            <p className="foot">
              <HostsDaLeitura hosts={serieLida.hosts} encerrados={serieLida.encerrados} />
            </p>
          ) : null}
          {cliques != null && impressoes != null ? (
            <ul className="lts">
              <Leitura valor={br(cliques)}>cliques em {dias!.length} dia(s) com dado</Leitura>
              <Leitura valor={br(impressoes)}>impressões</Leitura>
            </ul>
          ) : (
            <>
              <ul className="lts">
                <Leitura
                  sem="não apurado"
                  selo={serie && "erro" in serie ? "cega" : "sem"}
                  palavra={
                    // O `erro` já COMEÇA pelo host que falhou (031/FR-004).
                    serie && "erro" in serie ? `Search Console indisponível (${serie.erro})` : semPropriedadeGsc
                  }
                >
                  cliques e impressões em 8 meses
                </Leitura>
              </ul>
              {serie && "erro" in serie && hostsDoCard.length > 1 ? <p className="foot">{TOTAL_PARCIAL}</p> : null}
            </>
          )}
          {/* A FORMA dos oito meses. Duas cifras dizem QUANTO; nenhuma diz se o volume está subindo
              ou caindo dentro da janela, que é a pergunta desta tela. Só mês inteiramente coberto
              entra: desenhar as pontas pelo que mediram pintaria uma queda de calendário. */}
          {mesesCobertos.length >= 2 ? (
            <>
              <div className="desc-serie">
                <WeekChart
                  title={`Impressões por mês · ${mesesCobertos.length} mês(es) inteiro(s) na janela`}
                  points={pontosMes}
                  fmt={(v) => `${br(v)} impressões`}
                  unidade="meses"
                />
              </div>
              {/* A COLUNA VAZIA PRECISA DE NOME. O nível 1 tem a legenda dos três estados; aqui
                  uma coluna sem barra ficava sem explicação, e "mês de ponta" e "mês sem
                  impressão" são coisas diferentes que o desenho separa (vazio contra traço abaixo
                  da linha) e o texto tem que nomear. O zero só é citado quando existe na janela —
                  explicar um estado que não está na tela é ruído. */}
              <p className="foot">
                Coluna <strong>vazia</strong>: mês de ponta, que a janela recebida não cobre
                inteiro — {mesesGsc.length - mesesCobertos.length} de {mesesGsc.length}.
                {mesesCobertos.some((m: { impressoes: number }) => m.impressoes === 0) ? (
                  <>
                    {" "}
                    <strong>Traço</strong> abaixo da linha: mês inteiro medido com{" "}
                    <strong>zero</strong> impressão —{" "}
                    {mesesCobertos.filter((m: { impressoes: number }) => m.impressoes === 0).length} nesta
                    janela. Vazio e zero <strong>não</strong> são a mesma coisa.
                  </>
                ) : null}
              </p>
            </>
          ) : dias && dias.length ? (
            /* G4/G5: não é zero e não é gráfico vazio — é janela curta demais para ter forma. A
               causa é a mesma do selo da tabela de instrumentos, e a régua acima já a mostra. */
            <p className="foot">
              <strong>Sem forma mensal:</strong> a janela recebida não fecha dois meses inteiros
              ({mesesGsc.length} tocado(s), {mesesCobertos.length} inteiro(s)) — meio mês ao lado de
              um mês cheio leria como queda.
            </p>
          ) : null}
          <details className="ress">
            <summary>Por que 8 meses, e por que não se divide pela janela da ficha</summary>
            <dl>
              <dt>A janela</dt>
              <dd>{janelaGsc.porque}.</dd>
              {/* FR-026: cada tela cita a outra PELO NOME e pela janela, para ninguém comparar dois
                  números que medem períodos diferentes achando que medem o mesmo. */}
              <dt>A outra janela, na ficha</dt>
              <dd>
                A célula <code>visitante</code> da <a href={`/okr/${slug}`}>ficha</a> usa{" "}
                <strong>28 dias</strong> ({curtaGsc.inicio} → {curtaGsc.fim}). São a mesma fonte em
                janelas diferentes: os números NÃO se dividem um pelo outro.
              </dd>
            </dl>
          </details>
        </div>

        {/* 025 — as duas medidas do board que não existiam: crescimento de impressões NÃO-MARCA e
            proporção de buscas de marca. Vêm do BANCO, gravadas pela corrida das 05:17 (D11).
            Não-marca é MEDIDA, nunca `total − marca`: o total inclui as consultas anonimizadas e a
            fatia de marca não, então a subtração devolveria não-marca MAIS o resto anonimizado —
            inflando exatamente o KPI que se quer ver crescer (5 contra 33 medidos no tapepro). */}
        <div className="ficha-bloco">
          <h2 className="ficha-bloco-h">Marca e não-marca — a demanda que já é sua e a que ainda não é</h2>

          {decl.motivo ? (
            /* FR-004/FR-013: "não declarada" NUNCA vira 0%. Os três motivos saem NOMEADOS porque
               pedem consertos diferentes — e um número inventado aqui seria uma afirmação sobre o
               site que ninguém mediu. */
            <p className="foot">
              <strong>Marca não declarada</strong> para este projeto ({decl.motivo}).{" "}
              {decl.motivo === "ausente"
                ? "O card não tem lista de termos de marca. Sem ela o hub não sabe quais consultas são busca pelo NOME, e as duas medidas não existem — o que não é o mesmo que zero busca de marca."
                : decl.motivo === "sem-termos"
                  ? "O card declara `marca` com a lista de termos vazia. Uma lista vazia não classifica nada; declarar é escrever as variantes pelas quais as pessoas procuram o projeto."
                  : "O card declara os termos mas não o corte de país. Sem ele o total do Search Console é mundial e a fatia de marca não seria comparável com ele — a razão sairia contaminada, e meia-medição é pior que ausência porque parece medida."}
            </p>
          ) : !janelaMarca ? (
            <p className="foot">
              não apurado —{" "}
              {serieSeparada && !Array.isArray(serieSeparada) && "erro" in serieSeparada
                ? `banco indisponível (${serieSeparada.erro})`
                : diasSeparados
                  ? "a série está gravada, mas nenhum dia desta janela tem a separação medida ainda. A corrida das 05:17 preenche a janela inteira na próxima passagem."
                  : "sem banco configurado para o hub"}
              .
            </p>
          ) : (
            <>
              <p className="foot">
                {janelaMarca.inicio} → {janelaMarca.fim} · {diasComMarca.length} dia(s) com a
                separação medida
              </p>

              {/* 028 — A COMPOSIÇÃO. As duas leituras abaixo são uma razão e uma variação; nenhuma
                  das duas mostra o TAMANHO relativo dos dois baldes, que é o que o título deste
                  bloco promete ("a demanda que já é sua e a que ainda não é"). Medido na atma:
                  10.085 de marca contra 169.521 de não-marca — 5,6% contra 94,4%.
                  O denominador é `comp` (a série inteira), o MESMO de `razao` logo abaixo. Usar as
                  somas do segmento aqui faria a barra e a razão divergirem na mesma tela.
                  Na CONTRADIÇÃO a barra não sai: resíduo negativo significa que os baldes somam
                  MAIS que o total, e uma barra empilhada afirmaria uma partição que não existe —
                  o alarme abaixo é que manda não ler os números. */}
              {comp &&
              comp.estado !== "nao-declarada" &&
              comp.estado !== "contradicao" &&
              comp.impressoesPais! > 0 ? (
                <Composicao
                  total={comp.impressoesPais!}
                  rotulo={`Impressões do corte ${decl.pais} · ${janelaMarca.inicio} → ${janelaMarca.fim}`}
                  partes={[
                    { chave: "marca", valor: comp.impressoesMarca!, nome: "de marca — quem já procura pelo nome" },
                    { chave: "nmarca", valor: comp.impressoesNaoMarca!, nome: "não-marca — quem ainda não conhece" },
                    {
                      chave: "resto",
                      valor: Math.max(0, comp.residuo ?? 0),
                      nome: "que o Search Console não atribui a consulta nenhuma",
                      hachurado: true,
                    },
                  ]}
                />
              ) : null}

              <ul className="lts">
                {/* FR-008/FR-009: os dois meses saem NOMEADOS, nenhum é o corrente, e o primeiro
                    mês fechado é "ainda não apurável" — nunca 0%, que leria como estagnação medida
                    e mandaria consertar um problema que não existe. */}
                {crescimento === null ? (
                  <Leitura sem="não apurável" selo="sem" palavra="não é 0%">
                    de crescimento de impressões não-marca — ainda não há dois meses fechados nesta
                    janela
                  </Leitura>
                ) : (
                  <Leitura
                    valor={variacao(crescimento.valor)}
                    selo={crescimento.baseInterrompida ? "piso" : undefined}
                    palavra={crescimento.baseInterrompida ? "a faixa do board não se aplica" : undefined}
                  >
                    de crescimento de impressões não-marca ({crescimento.de} → {crescimento.para}:{" "}
                    {br(crescimento.deImpressoes)} → {br(crescimento.paraImpressoes)})
                    {crescimento.baseInterrompida ? null : (
                      <>
                        {" "}· parâmetro do board: 5% a 10%/mês — <Origem chave="crescimentoNaoMarca" />
                      </>
                    )}
                  </Leitura>
                )}

                {razao === null ? (
                  <Leitura sem="não apurado" selo="sem">
                    de buscas de marca
                  </Leitura>
                ) : (
                  <Leitura
                    valor={pct(razao)}
                    selo={comp?.estado === "piso" ? "piso" : comp?.estado === "contradicao" ? "cega" : undefined}
                    palavra={
                      comp?.estado === "piso"
                        ? "piso, não total"
                        : comp?.estado === "contradicao"
                          ? "a soma não fecha"
                          : undefined
                    }
                  >
                    de buscas de marca (impressões de marca ÷ total do corte{" "}
                    <code>{decl.pais}</code>)
                  </Leitura>
                )}
              </ul>

              {/* A contradição é ALARME, não ressalva educada: resíduo negativo é defeito de filtro
                  e o conserto é oposto ao de um piso. Fica FORA do `<details>` porque diz para não
                  ler os números de cima — uma instrução que não pode depender de um clique. */}
              {comp?.estado === "contradicao" ? (
                <p className="foot">
                  🚨 <strong>Contradição, e isto é defeito — não limitação da fonte.</strong> Marca
                  + não-marca somam {br(comp.impressoesMarca! + comp.impressoesNaoMarca!)}, que é{" "}
                  {br(-comp.residuo!)} <strong>a mais</strong> que o total do corte (
                  {br(comp.impressoesPais!)}). O filtro de exclusão não é o complemento exato do de
                  inclusão: os números acima não devem ser lidos até isso ser consertado.
                </p>
              ) : null}

              <details className="ress">
                <summary>
                  Os {decl.termos.length} termos de marca em uso, e se a soma fecha com o total
                </summary>
                <dl>
                  {/* FR-005/FR-012: a lista e o corte na tela. É o que permite a quem lê DESCONFIAR
                      da classificação — e a única defesa contra a lista pobre, cujo erro é favorável
                      e por isso perigoso: uma variante esquecida infla o não-marca. */}
                  <dt>Termos em uso ({decl.termos.length})</dt>
                  <dd>
                    {decl.termos.map((t) => (
                      <code key={t}>{t} </code>
                    ))}{" "}
                    · corte de país: <code>{decl.pais}</code>
                    {decl.declaradaEm ? <> · declarados em {decl.declaradaEm}</> : null}. Casamento
                    por <strong>palavra inteira</strong>: <code>atmasfera</code> não conta como
                    marca. Termo que falte nesta lista cai em <strong>não-marca</strong> e infla o
                    número que se quer ver crescer — é curadoria, e por isso a lista fica aqui em vez
                    de escondida no card.
                  </dd>

                  {/* FR-006/FR-007: o rótulo de completude. */}
                  {comp?.estado === "fecha" ? (
                    <>
                      <dt>A soma fecha</dt>
                      <dd>
                        ✅ Marca + não-marca = {br(comp.impressoesPais!)} impressões, exatamente o
                        total do corte. O filtro por consulta preserva as raras, então as duas
                        medidas acima são <strong>completas</strong> — não são pisos.
                      </dd>
                    </>
                  ) : comp?.estado === "piso" ? (
                    <>
                      <dt>Por que são piso</dt>
                      <dd>
                        Marca + não-marca somam{" "}
                        {br(comp.impressoesMarca! + comp.impressoesNaoMarca!)} contra{" "}
                        {br(comp.impressoesPais!)} do total do corte: faltam {br(comp.residuo!)}{" "}
                        impressões (
                        {comp.fracao === null ? "fração não apurada" : pct(comp.fracao)} do total)
                        que o Search Console não atribui a consulta nenhuma. O real é maior dos dois
                        lados, e quanto maior não é observável.
                      </dd>
                    </>
                  ) : null}

                  <dt>O denominador</dt>
                  <dd>
                    É o total <strong>dentro do corte de país</strong>, não o site inteiro: o total
                    sem corte é mundial e a fatia de marca não é, então dividir um pelo outro mediria
                    o corte.
                  </dd>

                  {crescimento === null ? (
                    <>
                      <dt>Por que ainda não há crescimento apurável</dt>
                      <dd>
                        <strong>Não é 0%</strong>: um zero aqui seria estagnação medida, e o que
                        existe é ausência de medição. Um mês só entra quando tem o calendário
                        completo <strong>e</strong> três dias de folga depois do fim — o Search
                        Console ainda sobe a ponta (30/07 da atma saiu com 30 impressões e fechou em
                        827).
                      </dd>
                    </>
                  ) : crescimento.baseInterrompida ? (
                    <>
                      <dt>Por que a faixa do board não se aplica</dt>
                      <dd>
                        O mês-base ({crescimento.de}) tem{" "}
                        <strong>
                          {crescimento.diasZeroDe} dos {crescimento.diasDe} dias com zero impressão
                          não-marca
                        </strong>
                        : a razão é aritmeticamente certa e mede a <strong>volta</strong> do índice,
                        não o crescimento da aquisição. Comparar isto com a meta de 5% a 10%/mês
                        aprovaria um mês de retomada como se fosse um mês bom. O veredito de verdade
                        é a <a href="#nao-marca">forma da série, no topo desta tela</a>.
                      </dd>
                    </>
                  ) : null}

                  <dt>Esta tela e a corrida podem divergir</dt>
                  <dd>
                    A corrida confere a janela inteira de <strong>480 dias</strong>; esta tela
                    confere só os {diasComMarca.length} dia(s) da janela acima, então os dois
                    vereditos podem divergir <strong>legitimamente</strong>.
                  </dd>
                </dl>
              </details>
            </>
          )}
        </div>

        {/* 021 — os KPIs de busca do board, na janela CURTA. Bloco separado do de cima de
            propósito: aquele é de leitura trimestral, este é a fila de trabalho da semana. */}
        <div className="ficha-bloco">
          <h2 className="ficha-bloco-h">Consultas — Search Console, 28 dias</h2>
          {/* 028 — a janela pedida, a recebida e o porquê da diferença desceram para o `<details>`
              do fim do bloco; o estado de cada leitura agora é o selo dela. Esta linha é a única
              procedência que fica em cima, porque é o recorte que o leitor precisa ANTES de ler o
              primeiro número. */}
          <p className="foot">
            {curtaGsc.inicio} → {curtaGsc.fim}
            {recebidaGsc && recebidaGsc.inicio > curtaGsc.inicio ? (
              <>
                {" "}
                · recebido <strong>{diasRecebidosCurta} dos 28 dias</strong> ({recebidaGsc.inicio} →{" "}
                {curtaGsc.fim})
              </>
            ) : null}
            {declaraHosts && hostsDoBloco ? (
              <>
                {" "}
                · <HostsDaLeitura hosts={hostsDoBloco.hosts} encerrados={hostsDoBloco.encerrados} />
              </>
            ) : null}
          </p>

          {!SLUGS_DE_BUSCA.includes(slug) ? (
            /* Escopo, não ausência: sem esta linha o `kpis === null` abaixo diria "sem propriedade
               no GSC", que é uma afirmação sobre o projeto — e a única coisa verdadeira aqui é que
               ninguém perguntou. */
            <p className="foot">
              <strong>Fora do escopo da medição.</strong> Os KPIs do board são apurados só para{" "}
              {SLUGS_DE_BUSCA.join(", ")} — o board de busca é de lá. Nada foi perguntado ao Search
              Console sobre este projeto: isto é decisão, não ausência de dado.
            </p>
          ) : kpis === null && kpisUrl === null ? (
            /* FR-010: três telas diferentes, nunca uma lista vazia sem explicação. `null` é
               ausência estrutural (o conserto é domínio próprio); `{erro}` é falha de agora.
               032/FR-005: este parágrafo é só para as DUAS leituras caídas. Com uma de pé o bloco
               continua, com as medidas dela e a ausência da outra nomeada dentro da lista. */
            <p className="foot">
              não apurado — as duas leituras do Search Console: {motivoDaLeitura(consultas)}
              .
              {/* 030 (FR-004) — o `erro` já COMEÇA pelo host que falhou. Com dois hosts o bloco
                  inteiro fica sem número, e a frase diz por quê: um total sem o host que falhou
                  leria como queda de tráfego (a guarda da 029 salvou o histórico e entregou 3% do
                  número). */}
              {consultas && "erro" in consultas && hostsDoCard.length > 1 ? ` ${TOTAL_PARCIAL}` : null}
            </p>
          ) : (
            <>
              <ul className="lts">
                {/* 028 — O MEDIDOR DO PISO, e é a primeira linha de propósito: ele é o portão das
                    leituras abaixo. Quatro selos diziam "abaixo do piso" em palavra e o leitor não
                    tinha como saber se falta pouco ou falta tudo — 26 de 100 é uma distância, e
                    distância se lê por comprimento. Ele SAI da tela sozinho quando a base passar do
                    piso, e aí as trilhas das frações entram no lugar.

                    032/D7 — UM PORTÃO POR LEITURA, e cada um nomeia a sua. As duas bases são
                    diferentes (24.664 contra 10.395 na Atma), e o portão de uma não tem autoridade
                    sobre uma fração calculada na outra. */}
                {kpis !== null && baseCurta !== null && !acimaDoPisoTermo ? (
                  <Leitura
                    valor={br(baseCurta)}
                    fracao={baseCurta / PISO_IMPRESSOES_VEREDITO}
                    selo={baseCurta === 0 ? "sem" : "piso"}
                    palavra={baseCurta === 0 ? "nenhuma impressão na janela" : "a régua do board ainda não vale"}
                  >
                    de {br(PISO_IMPRESSOES_VEREDITO)} impressões na leitura por termo — o piso da régua
                    do board
                  </Leitura>
                ) : null}
                {kpisUrl !== null && basePagina !== null && !acimaDoPisoPagina ? (
                  <Leitura
                    valor={br(basePagina)}
                    fracao={basePagina / PISO_IMPRESSOES_VEREDITO}
                    selo={basePagina === 0 ? "sem" : "piso"}
                    palavra={basePagina === 0 ? "nenhuma impressão na janela" : "a régua do board ainda não vale"}
                  >
                    de {br(PISO_IMPRESSOES_VEREDITO)} impressões na leitura por página — o piso da régua
                    do board
                  </Leitura>
                ) : null}

                {/* ── AS MEDIDAS POR TERMO ──────────────────────────────────────────────────────
                    Afirmam algo sobre uma CONSULTA, e consulta só existe nesta leitura. */}
                {kpis === null ? (
                  /* 032/FR-005 — a falha de UMA leitura suprime só as medidas dela, e a frase diz
                     QUAL caiu. Colapsar as duas esconderia metade do bloco sem motivo. */
                  <Leitura sem="não apurado" selo="sem" palavra="as medidas por URL seguem">
                    as medidas por termo — {motivoDaLeitura(consultas)}
                  </Leitura>
                ) : (
                  <>
                    {/* FR-009: o rótulo de piso é para o LEITOR, não um comentário no código — e
                        continua na tela, agora como selo em vez de parágrafo. */}
                    <Leitura
                      valor={br(kpis.consultasUnicas.valor)}
                      selo="piso"
                      palavra="piso, não total"
                      base={baseDoTermo}
                    >
                      consultas únicas
                    </Leitura>
                    <Leitura valor={br(kpis.noTop20)} base={baseDoTermo}>
                      consultas no Top 20 (posições 1,0 a 20,0)
                    </Leitura>
                    {/* 026 — fração SEMPRE com a base ao lado, e o veredito do board só acima do
                        piso. Com as 26 impressões que a propriedade nova tinha em 18/09, uma única
                        impressão move a fração 3,8 pontos e três atravessam a faixa inteira de 10:
                        exibir "dentro da faixa" ali seria aprovar ruído, o mesmo defeito do `43×`. */}
                    {/* G4 — zero impressões é um ESTADO, não um denominador. E abaixo do piso a
                        fração existe mas a RÉGUA não: o selo diz qual dos dois é o caso, sem
                        fabricar reprovação nem aprovação. */}
                    {/* 032/D9 — esta medida FICA na leitura por termo, por decisão do dono: ela
                        afirma onde as CONSULTAS aparecem, e migrá-la para a leitura por página
                        trocaria a grandeza (a posição passaria a ser a da PÁGINA) ao preço de uma
                        base completa. A base parcial fica declarada ao lado, que é para isso que a
                        declaração existe. */}
                    {baseCurta === 0 ? (
                      <Leitura sem="sem base" selo="sem" palavra="não é 0% no Top 3" base={baseDoTermo}>
                        impressões no Top 3 — a janela não teve impressão nenhuma
                      </Leitura>
                    ) : (
                      <Leitura
                        valor={kpis.impressoesNoTop3 === null ? undefined : pct(kpis.impressoesNoTop3)}
                        sem={kpis.impressoesNoTop3 === null ? "não apurado" : undefined}
                        fracao={acimaDoPisoTermo && kpis.impressoesNoTop3 !== null ? kpis.impressoesNoTop3 : undefined}
                        meta={[0.4, 0.5]}
                        base={baseDoTermo}
                        selo={baseCurta !== null && baseCurta < PISO_IMPRESSOES_VEREDITO ? "piso" : undefined}
                        palavra={
                          baseCurta !== null && baseCurta < PISO_IMPRESSOES_VEREDITO
                            ? "sem veredito do board"
                            : undefined
                        }
                      >
                        das impressões no Top 3
                        {kpis.impressoesNoTop3 !== null && baseCurta !== null ? (
                          <>
                            {" "}
                            ({br(Math.round(kpis.impressoesNoTop3 * baseCurta))} de {br(baseCurta)})
                          </>
                        ) : null}
                        {baseCurta !== null && baseCurta >= PISO_IMPRESSOES_VEREDITO ? (
                          <>
                            {" "}· parâmetro do board: 40% a 50% — <Origem chave="impressoesTop3" />
                          </>
                        ) : null}
                      </Leitura>
                    )}
                  </>
                )}

                {/* ── AS MEDIDAS POR URL ────────────────────────────────────────────────────────
                    032/FR-001 — leem a leitura por PÁGINA, que é completa. Pela leitura por termo
                    elas saíam de 42,1% das impressões e 14 das 29 URLs do site. */}
                {kpisUrl === null ? (
                  <Leitura sem="não apurado" selo="sem" palavra="as medidas por termo seguem">
                    as medidas por URL — {motivoDaLeitura(paginasGsc)}
                  </Leitura>
                ) : ativas === null ? (
                  /* 022/FR-011: com denominador apurado isto vira a RAZÃO que o board pede; sem ele
                     volta a ser contagem, e o selo é que diz qual dos dois está na tela. Razão de
                     denominador chutado é falha. */
                  <Leitura
                    valor={br(kpisUrl.urlsComImpressao)}
                    selo="sem"
                    palavra="contagem, não razão"
                    base={baseDaPagina}
                  >
                    URLs com impressão
                  </Leitura>
                ) : (
                  <Leitura
                    valor={pct(ativas)}
                    fracao={acimaDoPisoPagina ? ativas : undefined}
                    meta={0.7}
                    base={baseDaPagina}
                  >
                    de Active Index Ratio ({br(kpisUrl.urlsComImpressao)} ÷ {br(denomIdx!)} indexadas,{" "}
                    {idx!.dia}) · parâmetro do board: ≥ 70% — <Origem chave="activeIndexRatio" />
                  </Leitura>
                )}

                {/* 032/D6 — o numerador é `consultasUnicas`, então esta razão é POR TERMO e continua
                    carregando o selo de piso por isso (FR-004). Ela saiu de dentro do ramo da razão
                    de índice ativo: aninhada ali, a queda da leitura por página levaria junto uma
                    medida que não depende dela. */}
                {kpis !== null && porPagina && (
                  <Leitura
                    valor={porPagina.valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                    selo="piso"
                    palavra="piso, não total"
                    base={baseDoTermo}
                  >
                    consultas por URL indexada
                  </Leitura>
                )}

                {/* O truncamento da API saiu daqui: ele é uma SEGUNDA razão para o mesmo selo
                    `piso, não total` que as linhas já carregam, e o `<details>` abaixo já o diz.
                    Repetir num parágrafo próprio era a mesma ressalva em dois lugares. */}

                {/* ── A FILA DE TRABALHO ───────────────────────────────────────────────────────
                    Três leituras que antes eram três sub-blocos com h3, parágrafo de definição e
                    parágrafo de ressalva cada — 9 parágrafos para 3 números. Agora são 3 linhas na
                    MESMA lista das de cima (a separação em duas listas era herança dos h3, e
                    custava um respiro sem separar nada); a definição e a ressalva vivem no
                    `<details>` do fim do bloco. Nenhuma frase foi apagada: saíram de 9 lugares e
                    foram para 1. */}
                {kpis !== null &&
                  (kpis.strikingDistance.lista.length > 0 ? (
                    <Leitura valor={br(kpis.strikingDistance.lista.length)} base={baseDoTermo}>
                      consulta(s) a um empurrão do Top 3 (posições 4,0–10,9)
                      {kpis.strikingDistance.removidas
                        ? ` · ${br(kpis.strikingDistance.removidas)} de marca removida(s)`
                        : ""}
                    </Leitura>
                  ) : (
                    /* QUATRO ausências com consertos diferentes. A frase única que existia antes
                       ("o site tem consultas, nenhuma delas está nessa posição") afirmava a quarta
                       nas quatro — inclusive quando a causa era a própria janela. */
                    <Leitura
                      base={baseDoTermo}
                      sem={
                        kpis.strikingDistance.removidas
                          ? "nada a empurrar"
                          : baseCurta === 0
                            ? "sem base"
                            : baseCurta !== null && baseCurta < PISO_IMPRESSOES_VEREDITO
                              ? "não apurável"
                              : "zero real"
                      }
                      selo={
                        kpis.strikingDistance.removidas
                          ? "sem"
                          : baseCurta === 0
                            ? "sem"
                            : baseCurta !== null && baseCurta < PISO_IMPRESSOES_VEREDITO
                              ? "piso"
                              : "dado"
                      }
                      palavra={
                        kpis.strikingDistance.removidas
                          ? `${br(kpis.strikingDistance.removidas)} era(m) de marca`
                          : baseCurta === 0
                            ? "nenhuma impressão na janela"
                            : baseCurta !== null && baseCurta < PISO_IMPRESSOES_VEREDITO
                              ? "não é &ldquo;nenhuma na faixa&rdquo;"
                              : "nenhuma nesta faixa"
                      }
                    >
                      consulta(s) a um empurrão do Top 3 (posições 4,0–10,9)
                    </Leitura>
                  ))}

                {kpisUrl === null ? null : kpisUrl.ctrGap === null ? (
                  <Leitura sem="sem base" selo="sem" palavra="não é 0%" base={baseDaPagina}>
                    das URLs atingem o CTR mínimo da própria posição
                  </Leitura>
                ) : (
                  <Leitura
                    valor={pct(kpisUrl.ctrGap.fracao)}
                    fracao={acimaDoPisoPagina ? kpisUrl.ctrGap.fracao : undefined}
                    meta={[0.75, 0.8]}
                    base={baseDaPagina}
                    selo={kpisUrl.ctrGap.fracao >= 0.75 ? "dado" : undefined}
                  >
                    das URLs atingem o CTR mínimo da posição ({kpisUrl.ctrGap.avaliadas} avaliada(s)) ·
                    meta do board: 75% a 80%
                  </Leitura>
                )}

                {kpis !== null &&
                  (kpis.canibalizacao.lista.length > 0 ? (
                    <Leitura valor={br(kpis.canibalizacao.lista.length)} base={baseDoTermo}>
                      consulta(s) com duas URLs suas disputando · meta do board: zero
                      {kpis.canibalizacao.removidas
                        ? ` · ${br(kpis.canibalizacao.removidas)} de marca removida(s)`
                        : ""}
                    </Leitura>
                  ) : (
                    /* 027 — AUSÊNCIA NÃO É APROVAÇÃO. Declarar a meta do board atingida sobre uma
                       lista que a própria tela chama de piso transforma "não deu para ver" em "está
                       certo". Abaixo do piso o selo diz `não apurável`, nunca `meta atingida`. */
                    <Leitura
                      base={baseDoTermo}
                      sem={
                        baseCurta === 0
                          ? "sem base"
                          : baseCurta !== null && baseCurta < PISO_IMPRESSOES_VEREDITO
                            ? "não apurável"
                            : "zero real"
                      }
                      selo={
                        baseCurta === 0
                          ? "sem"
                          : baseCurta !== null && baseCurta < PISO_IMPRESSOES_VEREDITO
                            ? "piso"
                            : "dado"
                      }
                      palavra={
                        baseCurta === 0
                          ? "nenhuma impressão na janela"
                          : baseCurta !== null && baseCurta < PISO_IMPRESSOES_VEREDITO
                            ? "não é a meta do board atingida"
                            : "meta do board atingida"
                      }
                    >
                      consulta(s) com duas URLs suas disputando
                    </Leitura>
                  ))}
              </ul>

              {/* NÍVEL 3 — mesma regra do bloco do crawl: a LEITURA (número + selo) é nível 2, a
                  LISTA de itens é nível 3. Hoje as três estão vazias; quando `usealigner.com`
                  passar do piso elas voltam a ter dezenas de linhas, e é aí que a regra paga. O
                  resumo carrega as contagens: nada fica escondido. */}
              <details className="ress">
                <summary>
                  {[
                    kpis && kpis.strikingDistance.lista.length > 0
                      ? `${br(kpis.strikingDistance.lista.length)} a um empurrão do Top 3`
                      : null,
                    kpisUrl?.ctrGap && kpisUrl.ctrGap.abaixo.length > 0
                      ? `${br(kpisUrl.ctrGap.abaixo.length)} abaixo do benchmark de CTR`
                      : null,
                    kpis && kpis.canibalizacao.lista.length > 0
                      ? `${br(kpis.canibalizacao.lista.length)} em canibalização`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Nenhuma lista de trabalho nesta janela"}
                  {` — e o que cada selo quer dizer (${curtaGsc.inicio} → ${curtaGsc.fim})`}
                </summary>
              {kpis !== null && kpis.strikingDistance.lista.length > 0 && (
                <ul className="ficha-krs">
                  {kpis.strikingDistance.lista.slice(0, 15).map((c) => (
                    <li key={`${c.query}|${c.page}`}>
                      <strong>{c.query}</strong>{" "}
                      <span className="foot">
                        posição {c.posicao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ·{" "}
                        {br(c.impressoes)} impressões · {br(c.cliques)} cliques · {c.page}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {kpisUrl?.ctrGap != null && kpisUrl.ctrGap.abaixo.length > 0 && (
                <>
                  <p className="foot">
                    Abaixo do benchmark — aqui o problema é o <strong>título</strong>, não a posição:
                  </p>
                  <ul className="ficha-krs">
                    {kpisUrl.ctrGap.abaixo.slice(0, 10).map((u) => (
                      <li key={u.url}>
                        <strong>{u.url}</strong>{" "}
                        <span className="foot">
                          posição {u.posicao!.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ·
                          CTR {pct(u.ctr!)} contra {pct(u.benchmark!)} esperado · {br(u.impressoes)}{" "}
                          impressões
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {kpis !== null && kpis.canibalizacao.lista.length > 0 && (
                <ul className="ficha-krs">
                  {kpis.canibalizacao.lista.slice(0, 10).map((c) => (
                    <li key={c.consulta}>
                      <strong>{c.consulta}</strong>{" "}
                      <span className="foot">
                        {c.urls.length} URLs disputando ·{" "}
                        {c.urls
                          .map(
                            (u) =>
                              `${u.url} (pos ${u.posicao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })})`,
                          )
                          .join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

                {/* A ressalva, uma vez. Tudo o que as cinco corridas anteriores conquistaram por
                    medição, agrupado: cada `dt` é uma leitura da lista de cima. */}
                <dl>
                  <dt>A janela</dt>
                  <dd>
                    Pedida: {curtaGsc.inicio} → {curtaGsc.fim} — a mesma da célula{" "}
                    <code>visitante</code> da <a href={`/okr/${slug}`}>ficha</a>, e{" "}
                    <strong>não</strong> a de 8 meses do bloco acima: os dois medem períodos
                    diferentes e não se dividem um pelo outro.
                    {recebidaGsc && recebidaGsc.inicio > curtaGsc.inicio ? (
                      <>
                        {" "}
                        Recebida: {recebidaGsc.inicio} → {curtaGsc.fim}, ou seja{" "}
                        <strong>{diasRecebidosCurta} dos 28 dias</strong> —{" "}
                        {hostsDoCard.length > 1 ? (
                          <>os hosts somados não têm dado antes de {recebidaGsc.inicio}</>
                        ) : (
                          <>
                            a propriedade de <code>{p.url}</code> não tem dado antes de {recebidaGsc.inicio}
                          </>
                        )}
                        . A queda em relação a qualquer leitura anterior é da JANELA, não do site.
                      </>
                    ) : null}
                  </dd>

                  {baseCurta !== null && basePagina !== null && baseCurta !== basePagina ? (
                    <>
                      <dt>as duas bases</dt>
                      <dd>
                        Cada medida deste bloco declara sobre quantas impressões foi calculada, e as
                        duas bases não batem. <strong>Não é bug.</strong> A leitura por{" "}
                        <strong>página</strong> devolve {br(basePagina)} impressões na janela — o
                        site inteiro — e a leitura por <strong>termo</strong> devolve{" "}
                        {br(baseCurta)}, porque o Search Console omite as consultas raras da
                        dimensão <code>query</code>. Cada medida é lida pela dimensão que a mede: o
                        que afirma algo sobre uma <strong>URL</strong> sai da primeira, o que afirma
                        algo sobre uma <strong>consulta</strong> sai da segunda, e nenhum número
                        mistura as duas. Até 19/09/2026 as duas famílias saíam da leitura por termo,
                        e o Índice de Conformidade publicava 0% sobre 6 URLs avaliadas quando a
                        leitura completa dá 12,5% sobre 24 — a home ficava fora do denominador por
                        aparecer na posição 11,8 por termo em vez dos 6,9 reais.
                      </dd>
                    </>
                  ) : null}

                  <dt>piso, não total</dt>
                  <dd>
                    O Search Console omite as consultas raras da dimensão <code>query</code>: o
                    número real é maior e não é observável.{" "}
                    <strong>A ressalva vale para as medidas por termo</strong> — as por URL leem a
                    leitura por página, que é completa, e desde a 032 não carregam mais este selo.
                    {consultas && "truncado" in consultas && consultas.truncado ? (
                      <>
                        {" "}
                        <strong>E há truncamento</strong> no teto de linhas da API na leitura por
                        termo — os números dela são piso por essa segunda razão, além da omissão das
                        raras.
                        {consultas.hosts.length > 1
                          ? " O teto vale por propriedade: basta uma ter sido cortada."
                          : null}
                      </>
                    ) : null}
                    {paginasGsc && "truncado" in paginasGsc && paginasGsc.truncado ? (
                      <>
                        {" "}
                        <strong>A leitura por página também truncou</strong> no teto de linhas da
                        requisição dela — as medidas por URL são piso nesta janela, e só por essa
                        razão.
                        {paginasGsc.hosts.length > 1
                          ? " O teto vale por propriedade: basta uma ter sido cortada."
                          : null}
                      </>
                    ) : null}
                  </dd>

                  {baseCurta !== null && baseCurta > 0 && baseCurta < PISO_IMPRESSOES_VEREDITO ? (
                    <>
                      <dt>abaixo do piso</dt>
                      <dd>
                        A janela tem <strong>{br(baseCurta)} impressões</strong>. A faixa de
                        referência do board tem 10 pontos de largura, e cada impressão vale{" "}
                        {(100 / baseCurta).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}{" "}
                        deles — três atravessam a faixa inteira. A régua só passa a valer a partir de{" "}
                        <strong>{br(PISO_IMPRESSOES_VEREDITO)}</strong> impressões, e abaixo disso a
                        ausência de achado não é achado nenhum: não é &ldquo;nenhuma na faixa&rdquo;
                        nem &ldquo;meta do board atingida&rdquo;, é <strong>não medido</strong>.
                      </dd>
                    </>
                  ) : null}

                  <dt>Striking distance</dt>
                  <dd>
                    Consultas entre as posições 4,0 e 10,9: já rankeiam, e reforço de conteúdo ou
                    link interno as move. Ordenadas por impressões — a primeira linha rende mais.
                    {kpis?.strikingDistance.removidas ? (
                      <>
                        {" "}
                        <strong>
                          {br(kpis.strikingDistance.removidas)} consulta(s) de marca saíram desta
                          fila
                        </strong>
                        : estar bem posicionado no próprio nome não é trabalho a fazer, e nem
                        conteúdo nem link interno movem a marca. O filtro usa os{" "}
                        {decl.motivo ? 0 : decl.termos.length} termos declarados no card. A contagem
                        fica na tela porque sumir em silêncio é indistinguível de um filtro largo
                        demais que também comeu consulta genérica.
                      </>
                    ) : null}
                  </dd>

                  <dt>CTR contra o benchmark</dt>
                  <dd>
                    O board só define CTR mínimo até a posição 10,9. URLs acima dela ficam fora da
                    conta — contá-las como reprovadas faria toda cauda longa parecer quebrada. Sem
                    URL na faixa não há denominador, e exibir 0% seria inventar uma reprovação.
                  </dd>

                  <dt>Canibalização</dt>
                  <dd>
                    {kpis === null || kpis.canibalizacao.removidas === null ? (
                      <>
                        Consultas de <strong>marca</strong> aparecem aqui e quase nunca são
                        problema: buscar o nome da empresa traz o site inteiro, e é assim que deve
                        ser. A linha que importa é a consulta genérica com duas URLs suas
                        disputando.{" "}
                        <strong>Este projeto não declarou lista de termos de marca</strong>, então o
                        rótulo fica com quem lê.
                      </>
                    ) : (
                      <>
                        <strong>
                          {br(kpis.canibalizacao.removidas)} consulta(s) de marca removida(s)
                        </strong>{" "}
                        desta lista — buscar o nome da empresa traz o site inteiro por construção e
                        não é canibalização. Filtro pelos {decl.motivo ? 0 : decl.termos.length}{" "}
                        termos declarados no card.
                      </>
                    )}
                  </dd>

                  {ativas === null ? (
                    <>
                      <dt>contagem, não razão</dt>
                      <dd>
                        {denomIdx !== null && kpisUrl !== null && kpisUrl.urlsComImpressao > denomIdx ? (
                          /* 032 — apareceu quando o numerador passou a ser do site inteiro. Antes,
                             a leitura por termo subcontava as URLs e a razão cabia em 100% por
                             acidente de medição. */
                          <>
                            A apuração declarou <strong>{br(denomIdx)} URLs indexadas</strong> e o
                            Search Console viu impressão em{" "}
                            <strong>{br(kpisUrl.urlsComImpressao)}</strong> na janela: o numerador é
                            do site inteiro e o denominador não o cobre. A razão passaria de 100% e
                            leria como meta folgada — o conserto é o sitemap declarar as URLs que
                            faltam, não a tela arredondar.
                          </>
                        ) : denomIdx === null && amostrado ? (
                          <>
                            A indexação foi apurada por <strong>amostra</strong> (
                            {br(idx!.inspecionadas)} de {br(idx!.declaradas)} URLs): o numerador é do
                            site inteiro e dividi-lo por um denominador de amostra daria uma razão
                            que não mede nada. Para a razão existir, a apuração precisa cobrir o
                            sitemap inteiro.
                          </>
                        ) : (
                          <>
                            O total de URLs indexadas ainda não foi apurado — ver{" "}
                            <strong>Indexação</strong> abaixo e a linha dele na tabela de
                            instrumentos. Sem denominador a razão seria inventada.
                          </>
                        )}
                      </dd>
                    </>
                  ) : porPagina ? (
                    <>
                      <dt>Consultas por URL indexada</dt>
                      <dd>
                        Faixas do board: <strong>30 a 80</strong> para artigo/blog,{" "}
                        <strong>10 a 25</strong> para produto/landing. O hub não sabe o tipo de cada
                        URL deste projeto, então quem lê escolhe a faixa — inventar o tipo para
                        poder pintar um veredito seria pior que não pintar.
                      </dd>
                    </>
                  ) : null}
                </dl>
              </details>
            </>
          )}
        </div>

        {/* 022 — o denominador que faltava ao board. Bloco separado dos dois de cima porque a
            fonte é outra: aqui não é a série nem as consultas, é a URL Inspection API, apurada
            pela corrida das 05:47 e LIDA do banco. */}
        <div className="ficha-bloco">
          <h2 className="ficha-bloco-h">Indexação — quanto do que o site declara está no índice</h2>
          {/* Linha morta: a corrida das 05:47 varreu os 35 projetos antes da correção de escopo,
              então há apuração gravada para projetos que não são mais percorridos. A data já sai
              embaixo (FR-014), mas data velha sozinha lê como atraso, não como fim. */}
          {indexacao !== null && !SLUGS_DE_BUSCA.includes(slug) && (
            <p className="foot">
              ⚠️ <strong>Fora do escopo da medição.</strong> A corrida de indexação roda só para{" "}
              {SLUGS_DE_BUSCA.join(", ")}. O número abaixo é de uma corrida antiga e{" "}
              <strong>não será atualizado</strong>.
            </p>
          )}
          {indexacao === null && !SLUGS_DE_BUSCA.includes(slug) ? (
            /* Escopo, não fila: a corrida percorre só `SLUGS_DE_BUSCA`. Dizer "ainda não teve a
               vez" aqui prometeria uma apuração que nunca vem — a mesma mentira de tratar ausência
               declarada como pendência. */
            <p className="foot">
              <strong>Fora do escopo da medição.</strong> A corrida de indexação roda só para{" "}
              {SLUGS_DE_BUSCA.join(", ")} — o board de busca é de lá. Este projeto não é apurado, e
              isso é decisão, não pendência nem falha.
            </p>
          ) : indexacao === null ? (
            <p className="foot">
              <strong>Ainda não apurado.</strong> A corrida de indexação roda às 05:47 e percorre os
              projetos por rodízio — do que está há mais tempo sem apuração para o mais recente.
              Este ainda não teve a vez, ou o hub está sem banco.
            </p>
          ) : "erro" in indexacao ? (
            <p className="foot">
              não apurado — a <strong>leitura</strong> da apuração falhou ({indexacao.erro}). O que
              caiu foi o banco agora, não a medição: o número da última corrida continua gravado.
            </p>
          ) : indexacao.motivo === "sem_sitemap" ? (
            /* Cenário 3 da US1: NUNCA 0% de indexação aqui. Sem sitemap não há denominador, e um
               "0%" diria que o Google recusou páginas que o site nunca declarou. */
            <p className="foot">
              <strong>Não há sitemap alcançável</strong> em <code>{p.url}</code> — nem anunciado no{" "}
              <code>robots.txt</code>, nem no caminho convencional. Isso não é 0% de indexação: é a
              ausência da lista que diria o que medir. O passo é o <strong>build do site</strong>{" "}
              publicar um sitemap.
              <br />
              Apurado em <strong>{indexacao.dia}</strong>.
            </p>
          ) : indexacao.motivo === "sitemap_vazio" ? (
            <p className="foot">
              O sitemap existe, é XML válido e <strong>declara zero URLs</strong>. Diferente do caso
              acima: aqui o site foi perguntado e respondeu que não tem nada a declarar — o passo é
              a geração do sitemap, não a publicação dele.
              <br />
              Apurado em <strong>{indexacao.dia}</strong>.
            </p>
          ) : indexacao.motivo === "sem_propriedade" ? (
            /* Cenário 4 da US1: "não indexado" seria a leitura errada. Host de fornecedor
               (*.vercel.app) fica fora de toda propriedade — não há ONDE olhar. */
            <p className="foot">
              <strong>Não há onde olhar.</strong> O host de <code>{p.url}</code> está fora de toda
              propriedade do Search Console, então nenhuma inspeção é possível — o que{" "}
              <strong>não</strong> quer dizer que as páginas não estejam indexadas. O passo é{" "}
              <strong>domínio próprio verificado no Search Console</strong>.
              <br />
              Apurado em <strong>{indexacao.dia}</strong> · {br(indexacao.declaradas)} URL(s)
              declarada(s) no sitemap.
            </p>
          ) : indexacao.motivo === "sem_orcamento" ? (
            /* FR-015: "não perguntei nesta rodada" NUNCA pode virar `indexadas: 0`. */
            <p className="foot">
              <strong>Não inspecionado nesta rodada.</strong> O sitemap foi lido e declara{" "}
              <strong>{br(indexacao.declaradas)}</strong> URL(s), mas a quota da propriedade
              ({indexacao.propriedade ?? "—"}) já tinha sido consumida por outros projetos quando
              chegou a vez deste.{" "}
              {/* 029 — "volta na frente da fila" foi escrita quando o rodízio servia os 35. Com a
                  corrida restrita a SLUGS_DE_BUSCA ela vira promessa de uma corrida que não vem, e
                  contradiz o aviso de escopo três linhas acima. */}
              {foraDoEscopo ? (
                <>
                  <strong>A próxima corrida não vem</strong>: o rodízio foi restrito a{" "}
                  {SLUGS_DE_BUSCA.join(", ")} depois desta apuração, então esta fila não avança
                  mais.
                </>
              ) : (
                <>Ele volta na frente da fila na próxima corrida.</>
              )}
              <br />
              Apurado em <strong>{indexacao.dia}</strong>.
            </p>
          ) : taxaIdx === null ? (
            /* Todas as inspeções falharam: denominador zero. "Não apurado", nunca 0% — contar
               erro de quota como não-indexação inverteria o sinal da medição inteira.
               026 — a redação anterior afirmava a causa ("rede ou quota") e a tela não a conhece.
               Medido em 18/09: 25 de 25 falharam, e por seis corridas seguidas desde 13/09, porque
               o sitemap SEGUE O 301 e passou a declarar URLs de usealigner.com enquanto a
               propriedade gravada continuava `sc-domain:roilabs.com.br` — a URL Inspection API
               recusa toda URL fora da propriedade. Nem rede, nem quota. O que a tela sabe é a
               propriedade usada e o site declarado; quando os dois divergem, isso É a causa. */
            <>
              <p className="foot">Apurado em {indexacao!.dia} · {indexacao!.propriedade ?? "—"}</p>
              {/* 028 — A COMPOSIÇÃO no estado CEGO. Os quatro baldes de destino ficam FORA da barra
                  de propósito: eles valem 0 no registro porque nenhuma inspeção respondeu, e
                  desenhá-los como "0 indexadas, zero medido" afirmaria sobre o índice do Google o
                  que ninguém mediu — a inversão que este bloco existe para não repetir. O que a
                  barra mostra é verdade inteira: das 25 URLs declaradas, nenhuma tem veredito. */}
              <Composicao
                total={indexacao!.declaradas}
                rotulo={`Destino das ${br(indexacao!.declaradas)} URL(s) declaradas no sitemap`}
                partes={[
                  {
                    chave: "falha",
                    valor: indexacao!.inspecionadas,
                    nome: "inspeção(ões) que falharam — sem veredito de índice",
                    hachurado: true,
                  },
                  {
                    chave: "fora",
                    valor: Math.max(0, indexacao!.declaradas - indexacao!.inspecionadas),
                    nome: "não inspecionada(s) nesta corrida",
                    hachurado: true,
                  },
                ]}
              />
              <ul className="lts">
                <Leitura
                  sem="não apurado"
                  selo="cega"
                  palavra={`${br(indexacao!.inspecionadas)} de ${br(indexacao!.inspecionadas)} inspeções falharam`}
                >
                  das URLs inspecionadas estão no índice — falha de inspeção{" "}
                  <strong>não é</strong> não-indexação, então não há fração a exibir
                </Leitura>
              </ul>
              <details className="ress">
                <summary>
                  {propriedadeForaDoSite
                    ? "A propriedade da corrida não cobre o site declarado — é essa a causa"
                    : "O que a tela sabe, e o que ela não tem como saber daqui"}
                </summary>
                <dl>
                  <dt>A propriedade usada e o site declarado</dt>
                  <dd>
                    A corrida usou <code>{indexacao!.propriedade ?? "—"}</code>; o card declara o
                    site em <code>{p.url}</code>.{" "}
                    {propriedadeForaDoSite ? (
                      <>
                        <strong>Os dois não batem</strong>: a API de inspeção só responde sobre URLs{" "}
                        <strong>dentro</strong> da propriedade, então toda inspeção é recusada antes
                        de olhar o índice. É o rastro de uma troca de domínio — o sitemap acompanha
                        o redirecionamento e passa a declarar o site novo antes de a propriedade
                        dele entrar na corrida. O conserto é a propriedade do host atual no Search
                        Console, não uma nova tentativa.
                      </>
                    ) : (
                      <>
                        Os dois batem, então a causa <strong>não é</strong> a propriedade — e a tela
                        não tem como distinguir rede de quota daqui. Quem investiga olha o retorno
                        da corrida das 05:47.
                      </>
                    )}
                  </dd>
                </dl>
              </details>
            </>
          ) : (
            <>
              {/* FR-007 / SC-002: o tamanho da amostra e o total declarado ficam na MESMA linha da
                  fração, nunca em nota de rodapé. Uma taxa de 200 URLs apresentada como "a taxa do
                  site" é a armadilha que esta feature existe para não repetir — e é por isso que o
                  selo `amostra` fica na própria leitura, não no `<details>`. */}
              <p className="foot">
                Apurado em <strong>{idx!.dia}</strong>
                {idx!.propriedade ? <> · {idx!.propriedade}</> : null}
              </p>

              {/* 028 — A COMPOSIÇÃO. A fração de cima responde "quanto do inspecionado está no
                  índice"; a barra responde "e quanto do que o site DECLARA foi olhado", que é a
                  pergunta do título. Os dois segmentos hachurados são o que está fora da divisão:
                  inspeção que falhou (fora dos dois lados) e URL que a corrida não chegou a olhar.
                  Sem eles, uma amostra de 81 de 99 leria como o site inteiro — a armadilha que a
                  022 existe para não repetir. */}
              <Composicao
                total={idx!.declaradas}
                rotulo={`Destino das ${br(idx!.declaradas)} URL(s) declaradas no sitemap`}
                partes={[
                  { chave: "idx", valor: idx!.indexadas, nome: "no índice" },
                  { chave: "rni", valor: idx!.rastreadasNaoIndexadas, nome: "o Google leu e recusou" },
                  { chave: "dni", valor: idx!.descobertasNaoIndexadas, nome: "o Google nem leu" },
                  { chave: "out", valor: idx!.outras, nome: "redirect, canonical, noindex" },
                  {
                    chave: "falha",
                    valor: idx!.falhas,
                    nome: "inspeção(ões) que falharam — fora da conta",
                    hachurado: true,
                  },
                  {
                    chave: "fora",
                    valor: Math.max(0, idx!.declaradas - idx!.inspecionadas),
                    nome: "não inspecionada(s) nesta corrida",
                    hachurado: true,
                  },
                ]}
              />

              <ul className="lts">
                <Leitura
                  valor={pct(taxaIdx)}
                  fracao={taxaIdx}
                  meta={0.95}
                  selo={amostrado ? "piso" : taxaIdx >= 0.95 ? "dado" : undefined}
                  palavra={
                    amostrado
                      ? `amostra de ${br(idx!.inspecionadas)} das ${br(idx!.declaradas)} declaradas`
                      : taxaIdx >= 0.95
                        ? "meta do board atingida"
                        : undefined
                  }
                >
                  das URLs inspecionadas estão no índice ({br(idx!.indexadas)} de {br(base)}) · meta
                  do board: 95%
                  {taxaIdx >= 0.95 ? null : <> — faltam {pct(0.95 - taxaIdx)}</>}
                </Leitura>

                {/* US2 / SC-006 — o leitor tem que responder em 30 segundos se o problema é "o
                    Google não conhece as páginas" ou "o Google conhece e recusou". Por isso o
                    RÓTULO é o diagnóstico em português e o termo do Search Console fica no
                    `<details>`: quem lê esta tela decide trabalho, e "Crawled - currently not
                    indexed" não é uma decisão. Os dois baldes NUNCA somam num "não indexadas"
                    único — os prognósticos são incompatíveis e o conserto de um não move o
                    outro. */}
                {idx!.rastreadasNaoIndexadas + idx!.descobertasNaoIndexadas + idx!.outras > 0 && (
                  <>
                    <Leitura valor={br(idx!.rastreadasNaoIndexadas)}>
                      o Google leu e recusou — trabalho <strong>editorial</strong>
                    </Leitura>
                    <Leitura valor={br(idx!.descobertasNaoIndexadas)}>
                      o Google nem leu — trabalho de <strong>link interno e sitemap</strong>
                    </Leitura>
                    <Leitura valor={br(idx!.outras)}>
                      outros motivos: redirect, canonical, <code>noindex</code>
                    </Leitura>
                    {rejeicao !== null && (
                      <Leitura
                        valor={pct(rejeicao)}
                        fracao={rejeicao}
                        meta={0.05}
                        selo={rejeicao < 0.05 ? "dado" : undefined}
                        palavra={rejeicao < 0.05 ? "meta do board atingida" : undefined}
                      >
                        de rejeição de rastreio (as duas primeiras ÷ {br(base)}) · meta do board:
                        abaixo de 5%
                        {rejeicao < 0.05 ? null : " — acima do teto"}
                      </Leitura>
                    )}
                  </>
                )}
              </ul>

              {/* O diagnóstico em uma frase fica FORA do `<details>`: é a leitura que decide qual
                  dos dois trabalhos começa, e não pode depender de um clique. */}
              {idx!.rastreadasNaoIndexadas !== idx!.descobertasNaoIndexadas &&
                idx!.rastreadasNaoIndexadas + idx!.descobertasNaoIndexadas > 0 && (
                  <p className="foot">
                    {idx!.rastreadasNaoIndexadas > idx!.descobertasNaoIndexadas ? (
                      <>
                        O problema deste site é <strong>conteúdo</strong>: o Google leu a maior
                        parte das páginas que ficaram de fora e recusou.
                      </>
                    ) : (
                      <>
                        O problema deste site é <strong>rastreio</strong>: o Google nem chegou a ler
                        a maior parte das páginas que ficaram de fora.
                      </>
                    )}
                  </p>
                )}

              <details className="ress">
                <summary>O que cada balde quer dizer, e o que a amostra não cobre</summary>
                <dl>
                  <dt>O Google leu e recusou</dt>
                  <dd>
                    No Search Console: <em>rastreada, atualmente não indexada</em>. Ele buscou a
                    página e decidiu que ela não vale uma vaga no índice.{" "}
                    <strong>Nenhum conserto técnico move isto</strong> — é trabalho editorial:
                    profundidade, originalidade, a intenção que a página atende.
                  </dd>
                  <dt>O Google nem leu</dt>
                  <dd>
                    No Search Console: <em>descoberta, atualmente não indexada</em>. Ele sabe que a
                    URL existe e não gastou rastreio nela. Aqui o conteúdo não é a questão: é{" "}
                    <strong>link interno, profundidade de cliques e sitemap</strong>. Os dois baldes
                    ficam separados porque pedem trabalhos diferentes — a soma só aparece como
                    placar na linha de rejeição.
                  </dd>
                  <dt>Outros motivos</dt>
                  <dd>
                    Redirect, canonical apontando para outra página, <code>noindex</code>. Cada uma é
                    um caso — abra a URL no Search Console para ver qual.
                  </dd>

                  {amostrado ? (
                    <>
                      <dt>A amostra</dt>
                      <dd>
                        As <strong>{br(idx!.inspecionadas)}</strong> inspecionadas são uma amostra
                        das <strong>{br(idx!.declaradas)}</strong> que o sitemap declara:{" "}
                        <strong>a fração vale para a amostra, não para o site inteiro</strong>. A
                        amostra é o <strong>começo do sitemap</strong>, na ordem em que o próprio
                        site declara: estável entre corridas (a fração não se move por troca de
                        amostra) e enviesada para o que o site trata como prioritário.
                      </dd>
                    </>
                  ) : (
                    <>
                      <dt>A cobertura</dt>
                      <dd>
                        As {br(base)} inspecionadas são o sitemap <strong>inteiro</strong> (
                        {br(idx!.declaradas)} URL(s) declarada(s)) — sem amostragem.
                      </dd>
                    </>
                  )}

                  {idx!.falhas > 0 && (
                    <>
                      <dt>As inspeções que falharam</dt>
                      <dd>
                        <strong>{br(idx!.falhas)}</strong> inspeção(ões) falharam e ficaram FORA da
                        conta, <strong>dos dois lados da divisão</strong> — falha não é
                        não-indexação, e contá-la como tal inverteria o sinal da medição.
                      </dd>
                    </>
                  )}
                </dl>
              </details>
            </>
          )}
        </div>

        {/* 024 — o que há DENTRO das páginas. Bloco abaixo de Indexação de propósito: a 022 diz
            QUANTO do site está no índice, e este diz o que existe nas páginas que sobraram fora.
            Fonte: a corrida de segunda 06:17, LIDA do banco — a tela nunca crawleia. */}
        <div className="ficha-bloco">
          <h2 className="ficha-bloco-h">Dentro das páginas — seis medidas de um crawl só</h2>
          {crawl === null ? (
            <p className="foot">
              não apurado —{" "}
              {dbOn() ? "a corrida de crawl ainda não passou por este projeto." : "o hub está sem banco."}
            </p>
          ) : "erro" in crawl ? (
            <p className="foot">
              <strong>A leitura falhou agora</strong> ({crawl.erro}) — distinto de não haver crawl. O
              bloco volta na próxima leitura desta página.
            </p>
          ) : crawl.motivo ? (
            /* Os três motivos são estados DIFERENTES e nunca somam num "0 páginas". */
            <p className="foot">
              <strong>Sem apuração em {crawl.dia}</strong> —{" "}
              {crawl.motivo === "sem_sitemap"
                ? "o site não serve sitemap; o conserto é no build do site."
                : crawl.motivo === "sitemap_vazio"
                  ? "o sitemap existe e está vazio; é uma declaração do próprio site."
                  : "a home não respondeu, e sem home não há origem para a travessia — toda página do sitemap sairia órfã por causa de um timeout, então nenhuma linha foi gravada."}
            </p>
          ) : (
            <>
              {/* FR-015: número sem data sempre parece de hoje. O resto da procedência (quantas
                  visitadas, quantos links de navegação, falhas de rede) desceu para o `<details>`:
                  é contexto da medição, não a medição. */}
              <p className="foot">
                Apurado em <strong>{crawl.dia}</strong> · {br(crawl.visitadas)} de{" "}
                {br(crawl.declaradas)} página(s) do sitemap
                {crawl.tetoAtingido && (
                  <>
                    {" "}
                    · <strong>parou no teto</strong>: os números abaixo valem só para as alcançadas
                  </>
                )}
              </p>

              <ul className="lts">
                {/* US1 — para onde vai a autoridade interna.
                    ⚠️ O caso 100%: corrida que visitou páginas e não extraiu UM link não mediu um
                    site sem links internos — ela não leu link nenhum. Aí `orfas === visitadas` por
                    construção, e publicar "N órfãs" afirma sobre o site um defeito que é do
                    rastreador. Erro na fonte nunca vira número. */}
                {crawlSemLinks ? (
                  <Leitura sem="não apurado" selo="cega" palavra="crawl cego">
                    página(s) órfã(s) — a corrida leu zero link interno em{" "}
                    {br(crawl.visitadas)} página(s), então periferia, profundidade e densidade
                    contextual ficam sem veredito
                  </Leitura>
                ) : (
                  <Leitura valor={br(crawl.orfas)}>
                    página(s) órfã(s): declaradas no sitemap que nenhum link interno alcança ·{" "}
                    {br(crawl.linkadasNaoDeclaradas)} alcançada(s) por link e fora do sitemap
                  </Leitura>
                )}

                {/* US2 — o título, que já tem evidência contra si (CTR Gap de 0% na 021). */}
                {integridade && (
                  <Leitura
                    valor={pct(integridade.fracao)}
                    selo={
                      integridade.fracao >= 1
                        ? "dado"
                        : integridade.semTermo > integridade.avaliadas
                          ? "piso"
                          : undefined
                    }
                    palavra={
                      integridade.semTermo > integridade.avaliadas
                        ? `${br(integridade.semTermo)} sem termo apurado`
                        : undefined
                    }
                  >
                    de integridade do título ({br(integridade.avaliadas)} URL(s) avaliada(s)) · meta
                    do board: 100%
                  </Leitura>
                )}

                {alinhamento && (
                  <Leitura valor={pct(alinhamento.fracao)}>
                    de alinhamento de intenção ({br(alinhamento.avaliadas)} título(s))
                  </Leitura>
                )}

                {/* US3 — dados estruturados: presentes, ausentes ou QUEBRADOS. */}
                {cobertura024 && (
                  <Leitura
                    valor={pct(cobertura024.fracao)}
                    selo={cobertura024.fracao >= 1 ? "dado" : undefined}
                  >
                    de cobertura de dados estruturados ({br(cobertura024.validas)} de{" "}
                    {br(cobertura024.avaliadas)} com JSON-LD válido) · meta do board: 100%
                  </Leitura>
                )}

                {/* US4 — há quanto tempo o conteúdo não é tocado. */}
                {atualizacao &&
                  (atualizacao.fracao === null ? (
                    <Leitura sem="não apurado" selo="sem" palavra="nenhuma declara data">
                      dentro da cadência de {CADENCIA_MESES} meses ({br(atualizacao.semData.length)}{" "}
                      página(s) sem data declarada)
                    </Leitura>
                  ) : (
                    <Leitura valor={pct(atualizacao.fracao)}>
                      dentro da cadência ({br(atualizacao.avaliadas)} que declaram data ·{" "}
                      {br(atualizacao.vencidas.length)} passaram de {CADENCIA_MESES} meses)
                    </Leitura>
                  ))}

                {/* FR-013 — o sitemap declarando URL morta ou redirecionada é o achado. */}
                {achadosDoSitemap.length > 0 && (
                  <Leitura valor={br(achadosDoSitemap.length)}>
                    URL(s) do sitemap com achado: o sitemap declara e o site responde outra coisa
                  </Leitura>
                )}
              </ul>

              {/* NÍVEL 3 — as listas de itens E o método, num `<details>` só.
                  A regra que este bloco passou a seguir: a LEITURA (número + selo) é nível 2; a
                  LISTA de itens que a produziu é nível 3. Sem isso o bloco cresce com o dado —
                  15 URLs de periferia sozinhas passam de 300px — e a evidência volta a ficar maior
                  que a resposta, que é o defeito que esta corrida existe para remover.
                  O resumo carrega as contagens, então nada fica escondido: dá para saber que há 4
                  títulos a consertar sem abrir. */}
              <details className="ress">
                <summary>
                  {[
                    periferia.length > 0 ? `${br(periferia.length)} na periferia` : null,
                    integridade && integridade.fora.length > 0
                      ? `${br(integridade.fora.length)} título(s) fora do padrão`
                      : null,
                    achadosDoSitemap.length > 0
                      ? `${br(achadosDoSitemap.length)} achado(s) de sitemap`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Nada a listar nesta corrida"}
                  {" — e como cada uma das seis é medida"}
                </summary>
              {periferia.length > 0 && (
                <ul className="ficha-krs">
                  {periferia.slice(0, 15).map((pg) => (
                    <li key={pg.url}>
                      <strong>{caminho(pg.url)}</strong>{" "}
                      <span className="foot">
                        {pg.erro ? (
                          <>
                            falhou na busca ({pg.erro}) — <strong>não</strong> é órfã, é erro de rede
                          </>
                        ) : pg.profundidade === null && pg.noSitemap ? (
                          <>
                            <strong>órfã</strong> — nenhum link interno chega aqui
                          </>
                        ) : (
                          <>profundidade {br(pg.profundidade ?? 0)} clique(s)</>
                        )}
                        {!pg.erro && (
                          <>
                            {" · "}
                            {br(pg.linksContextuais)} link(s) contextual(is)
                            {pg.linksContextuais < LINKS_CONTEXTUAIS_MIN && (
                              <> (abaixo dos {LINKS_CONTEXTUAIS_MIN} do board)</>
                            )}
                            {" · "}
                            {impressoesPorUrl.get(pg.url)
                              ? `${br(impressoesPorUrl.get(pg.url)!)} impressões em 28 d`
                              : "zero impressão no Search Console"}
                            {pg.conteudoEstado === "js-dependente" && (
                              <>
                                {" "}
                                · conteúdo só existe depois do JS — <strong>atrasa</strong> a
                                indexação, não a impede
                              </>
                            )}
                          </>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {integridade && integridade.fora.length > 0 && (
                <ul className="ficha-krs">
                  {integridade.fora.slice(0, 10).map((pg: PaginaCrawl) => (
                    <li key={pg.url}>
                      <strong>{pg.titulo}</strong>{" "}
                      <span className="foot">
                        {/* FR-005/SC-004: o método viaja com o número até aqui. Um pixel solto é
                            indistinguível de uma medição, e vai ser lido como uma. */}
                        {pg.tituloPx} px (<strong>estimativa</strong>, método {pg.tituloMetodo}) ·{" "}
                        {posicaoPorUrl.get(pg.url) === null
                          ? "sem termo apurado"
                          : posicaoPorUrl.get(pg.url)! < 0
                            ? `o termo "${termoPorUrl.get(pg.url)}" NÃO aparece no título`
                            : `termo "${termoPorUrl.get(pg.url)}" a partir do caractere ${br(posicaoPorUrl.get(pg.url)!)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {achadosDoSitemap.length > 0 && (
                <ul className="ficha-krs">
                  {achadosDoSitemap.slice(0, 8).map((pg) => (
                    <li key={pg.url}>
                      <strong>{caminho(pg.url)}</strong>{" "}
                      <span className="foot">
                        {pg.erro ? pg.erro : `redireciona (HTTP ${pg.status ?? "?"}) — o destino é que conta`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

                <dl>
                  <dt>A corrida</dt>
                  <dd>
                    {br(crawl.visitadas)} página(s) visitada(s) de {br(crawl.declaradas)}{" "}
                    declarada(s) no sitemap · {br(crawl.linksNavegacao)} link(s) classificado(s) como
                    navegação (menu e rodapé, fora da densidade contextual)
                    {crawl.falhas > 0 && (
                      <> · {br(crawl.falhas)} falha(s) de rede, fora de todo numerador</>
                    )}
                    . A tela lê o gravado e nunca crawleia: a corrida é de segunda, 06:17.
                  </dd>

                  {crawlSemLinks ? (
                    <>
                      <dt>Por que o crawl está cego</dt>
                      <dd>
                        A corrida casou os links contra o domínio <strong>declarado</strong>, e a
                        home já tinha respondido <strong>301</strong> para outro — todos os links
                        saíram como externos e sobraram zero arestas. Não é site sem link interno, e
                        não é página renderizada no cliente: é o host da travessia vindo de uma
                        declaração que o próprio redirecionamento desmentiu. Por isso as{" "}
                        {br(crawl.orfas)} &ldquo;órfãs&rdquo; não viram achado —{" "}
                        <strong>são iguais às visitadas por construção</strong>. Corrigido no hub em
                        2026-09-18; a próxima corrida de segunda mede certo.
                      </dd>
                    </>
                  ) : null}

                  {integridade && (
                    <>
                      <dt>Integridade do título</dt>
                      <dd>
                        Largura <strong>estimada</strong> entre {TITULO_PX_MIN} e {TITULO_PX_MAX} px{" "}
                        <strong>E</strong> o termo principal nos primeiros {TERMO_ATE} caracteres.
                        {integridade.semTermo > 0 && (
                          <>
                            {" "}
                            {br(integridade.semTermo)} URL(s) ficam fora por{" "}
                            <strong>sem termo apurado</strong> — o Search Console não tem impressão
                            delas, o que não é o mesmo que título errado.
                          </>
                        )}
                      </dd>
                    </>
                  )}

                  {alinhamento && (
                    <>
                      <dt>Alinhamento de intenção</dt>
                      <dd>
                        Título com modificador explícito, informacional ou comercial.
                        {alinhamento.ausentes.length > 0 && (
                          <>
                            {" "}
                            Sem modificador:{" "}
                            {alinhamento.ausentes
                              .slice(0, 6)
                              .map((pg: PaginaCrawl) => caminho(pg.url))
                              .join(", ")}
                            .
                          </>
                        )}
                      </dd>
                    </>
                  )}

                  {cobertura024 && (
                    <>
                      <dt>Dados estruturados</dt>
                      <dd>
                        <strong>{br(cobertura024.invalidas.length)} inválida(s)</strong> — o schema
                        existe e estoura no parse: achar a vírgula. E{" "}
                        <strong>{br(cobertura024.ausentes.length)} ausente(s)</strong> — não há
                        schema nenhum: escrever. São consertos diferentes, e a soma dos dois não é um
                        número. Meta do board: 100% e <strong>0 erro crítico</strong>.
                      </dd>
                    </>
                  )}

                  {atualizacao && atualizacao.fracao !== null && (
                    <>
                      <dt>Cadência</dt>
                      <dd>
                        As {br(atualizacao.semData.length)} página(s) sem data declarada ficam fora
                        do numerador <strong>e</strong> do denominador. Sem data declarada{" "}
                        <strong>não é</strong> desatualizada: é ausência de declaração.
                      </dd>
                    </>
                  )}

                  {periferia.length > 15 && (
                    <>
                      <dt>A lista de periferia está cortada</dt>
                      <dd>
                        {br(periferia.length - 15)} página(s) a mais, fora do topo — ordenadas por
                        periferia (órfã → profundidade ≥ {PROFUNDIDADE_MAX} → menos de{" "}
                        {LINKS_CONTEXTUAIS_MIN} links contextuais) e, no empate, por impressões.
                      </dd>
                    </>
                  )}

                  {/* Risco aceito do plano, DECLARADO na tela: sem esta frase o leitor conclui
                      sozinho que a órfã é a página recusada pelo Googlebot. */}
                  <dt>O que esta lista NÃO cruza</dt>
                  <dd>
                    Não há cruzamento página a página com as URLs fora do índice: a apuração de
                    indexação grava só o agregado do dia, sem veredito por URL, então não dá para
                    dizer qual órfã é também uma das recusadas. O que está marcado aqui é quem tem{" "}
                    <strong>zero impressão</strong> no Search Console. Cruzar as duas exige a corrida
                    de indexação persistir por URL: spec nova, não esta.
                  </dd>
                </dl>
              </details>
            </>
          )}
        </div>

        {/* 023/US3 — o Pass Rate de campo. Bloco separado porque a fonte é outra (CrUX, dado de
            CAMPO do Chrome) e o alvo é outro: aqui é URL, e URL não se soma com origem. A origem
            aparece na ficha, no N5/Entrega. */}
        {vitais && (
          <div className="ficha-bloco">
            <h2 className="ficha-bloco-h">Core Web Vitals — quantas URLs passam</h2>
            <ul className="lts">
              {"erro" in vitais ? (
                <Leitura sem="não apurado" selo="cega" palavra={`a consulta falhou (${vitais.erro})`}>
                  das URLs prioritárias com &quot;Bom&quot; nos três vitais — a fração volta na
                  próxima leitura desta página
                </Leitura>
              ) : vitais.fracao === null ? (
                /* 027 deixou pendente: o bloco NÃO mentia ("0 das 5 URLs têm os três vitais"), mas
                   não NOMEAVA a causa. Ela é a mesma dos outros selos — origem nova, a CrUX ainda
                   não acumulou amostra — e agora está na tabela de instrumentos e no selo. */
                <Leitura sem="não apurável" selo="sem" palavra="a CrUX não tem amostra desta origem">
                  das URLs prioritárias com &quot;Bom&quot; nos três vitais — {vitais.motivo}
                </Leitura>
              ) : (
                <Leitura
                  valor={pct(vitais.fracao)}
                  fracao={vitais.fracao}
                  meta={0.9}
                  selo={vitais.fracao >= 0.9 ? "dado" : undefined}
                  palavra={vitais.fracao >= 0.9 ? "meta do board atingida" : undefined}
                >
                  das URLs prioritárias com &quot;Bom&quot; nos três vitais ({vitais.passam} de{" "}
                  {vitais.comDado} com dado de campo) · meta do board: 90%
                </Leitura>
              )}
            </ul>
            {/* 028 — AS CÉLULAS. Uma fração sobre cinco URLs esconde o denominador: "não apurável"
                e "0%" ocupam o mesmo espaço na tela e nenhum dos dois diz que são CINCO URLs, nem
                quais. Cada célula carrega forma, palavra e cor, e o rodapé conta os estados — é o
                G32 (procedência do número mais destacado) em forma visual. Medido em 18/09: as 5
                prioritárias da atma responderam 404 na CrUX, então as 5 células saem hachuradas e
                a tela não tem como ser confundida com "site lento". */}
            {!("erro" in vitais) && vitais.porUrl?.length ? (
              <CelulasDeUrl urls={vitais.porUrl} caminho={caminho} />
            ) : null}
            {!("erro" in vitais) && (
              <details className="ress">
                <summary>O que entra na conta, e quantas URLs foram consultadas</summary>
                <dl>
                  <dt>A definição de &quot;Bom&quot;</dt>
                  <dd>
                    LCP ≤ 2,5 s, INP ≤ 200 ms e CLS ≤ 0,1 no p75. O TTFB fica fora: é experimental
                    na fonte e não entra na definição.
                  </dd>
                  <dt>A amostra</dt>
                  <dd>
                    {vitais.consultadas} URL(s) consultada(s) por impressão decrescente
                    {vitais.naoConsultadas > 0 && (
                      <>
                        {" "}
                        · {vitais.naoConsultadas} não consultada(s) (teto de {CAP_URLS_PASS_RATE}) —{" "}
                        <strong>não</strong> reprovadas
                      </>
                    )}
                    . p75 de campo, todos os dispositivos, na janela que a CrUX cobre — que{" "}
                    <strong>não</strong> é a janela desta página.
                  </dd>
                </dl>
              </details>
            )}
          </div>
        )}

        <div className="ficha-bloco">
          <h2 className="ficha-bloco-h">Comportamento — GA4, 12 meses</h2>
          {/* 028 — a procedência (propriedade, hosts contados, janela recebida, exclusões) subiu
              para a tabela de instrumentos e desceu para o `<details>`. Aqui fica só o recorte. */}
          <ReguaJanela pedida={janelaGa4} recebida={recebidaGa4} legenda="12 meses pedidos" />
          {canais && "linhas" in canais ? (
            <>
              <ul className="lts">
                <Leitura valor={br(sessoes!)}>
                  sessões nos hosts declarados
                  {fora.length > 0 && sessoes! + foraTotal > 0 ? (
                    <>
                      {" "}
                      · {br(foraTotal)} ({pct(foraTotal / (sessoes! + foraTotal))}) de outros hosts
                      ficaram fora
                    </>
                  ) : null}
                </Leitura>
                {[...canais.linhas]
                  .sort((a, b) => b.sessoes - a.sessoes)
                  .map((l, _i, ordenados) => (
                    /* `Unassigned` é o grupo do GA4 para a sessão cuja origem ele NÃO conseguiu
                       atribuir. A contagem é real; o canal é que não existe. Sem o selo ele lê
                       como um canal ao lado de Organic Search — e ninguém investe em "Unassigned",
                       mas alguém pode tentar entender por que ele não cresce. */
                    <Leitura
                      key={l.grupo}
                      valor={br(l.sessoes)}
                      /* 028 — a BARRA RELATIVA ao maior canal, que é o que a coluna de números não
                         entrega: 4.988 contra 793 lê como "6 vezes" e mostra-se como domínio.
                         A 6ª corrida recusou um gráfico de barras aqui porque custava a mesma
                         altura de 6 linhas de texto sem ganhar canal; esta mora no `padding` da
                         própria linha e custa zero pixel. A escala sai declarada abaixo. */
                      parte={ordenados[0].sessoes > 0 ? l.sessoes / ordenados[0].sessoes : undefined}
                      selo={l.grupo === "Unassigned" ? "sem" : undefined}
                      palavra={l.grupo === "Unassigned" ? "origem não atribuída pelo GA4" : undefined}
                    >
                      {l.grupo}
                    </Leitura>
                  ))}
              </ul>

              {/* A escala da barra fica VISÍVEL: barra sem referência declarada é o "sobe em
                  relação a quê?" do piso da skill. */}
              {canais.linhas.length > 1 ? (
                <p className="foot">
                  A barra mede contra o <strong>maior canal</strong> (
                  {[...canais.linhas].sort((a, b) => b.sessoes - a.sessoes)[0].grupo},{" "}
                  {br([...canais.linhas].sort((a, b) => b.sessoes - a.sessoes)[0].sessoes)}), não
                  contra o total.
                </p>
              ) : null}

              <details className="ress">
                <summary>
                  De onde vem este número
                  {fora.length > 0
                    ? ` — e por que ${br(foraTotal)} sessão(ões) de ${fora.length} outro(s) host(s) não entraram`
                    : ""}
                </summary>
                <dl>
                  <dt>A propriedade e os hosts</dt>
                  <dd>
                    GA4, propriedade <code>{canais.propriedade}</code>
                    {hostsDoSite.length > 0 ? (
                      <>
                        , contando só{" "}
                        {hostsDoSite
                          .map((h) => <code key={h}>{h}</code>)
                          .reduce((a, b) => (
                            <>
                              {a}, {b}
                            </>
                          ))}
                      </>
                    ) : null}
                    . Janela de <strong>12 meses</strong>; o N4 da{" "}
                    <a href={`/okr/${slug}/metodo`}>derivação</a> usa <strong>28 dias</strong> (
                    {curtaGa4.inicio} → {curtaGa4.fim}) — os dois não se dividem um pelo outro.
                    {cobertura && "erro" in cobertura ? (
                      <>
                        {" "}
                        A sonda de cobertura falhou ({cobertura.erro}); a janela recebida fica não
                        apurada.
                      </>
                    ) : null}
                  </dd>

                  {/* 026 — a exclusão é informação, não faxina. Filtrar em silêncio encolheria o
                      total sem uma linha dizendo por quê, e isso lê como queda de tráfego. */}
                  {fora.length > 0 && (
                    <>
                      <dt>O que ficou fora, e por quê</dt>
                      <dd>
                        <strong>{br(foraTotal)}</strong> sessões da mesma propriedade não entraram
                        nos números acima (
                        {sessoes! + foraTotal > 0
                          ? pct(foraTotal / (sessoes! + foraTotal))
                          : "não apurável"}{" "}
                        do que a propriedade mediu na janela): são de hosts que este card{" "}
                        <strong>não declara</strong> como sendo o site. Painel administrativo,{" "}
                        <code>localhost</code> de desenvolvimento e preview de deploy carregam a
                        mesma tag do GA4 — e nenhum deles é alguém <strong>encontrando</strong> o
                        produto, que é a pergunta desta tela.
                        <br />
                        {fora.map((f, i) => (
                          <span key={f.host}>
                            {i > 0 && " · "}
                            <code>{f.host}</code> {br(f.sessoes)}
                          </span>
                        ))}
                        <br />
                        Host que passar a ser do site entra aqui declarando-o em{" "}
                        <code>data/projects.json</code> (<code>url</code> ou{" "}
                        <code>dominioAnterior.url</code>) — a lista acima nunca é chute do hub.
                      </dd>
                    </>
                  )}

                  {/* FR-029/SC-008: NENHUMA taxa entre `cliques` (GSC) e `sessões` (GA4). Na época
                      da atma são 599 contra 1.140 — o GSC vê só busca orgânica, o GA4 vê todo
                      canal. Dividir um pelo outro produz um número que não mede nada. */}
                  <dt>Cliques (Search Console) e sessões (GA4) não se dividem</dt>
                  <dd>
                    São cadeias diferentes: o GSC conta o clique na SERP e só vê busca orgânica; o
                    GA4 conta a sessão carregada, de qualquer canal. Não existe nesta página nenhuma
                    razão entre as duas séries — uma taxa assim mediria a diferença entre os
                    instrumentos, não o negócio.
                  </dd>
                </dl>
              </details>
            </>
          ) : (
            <p className="foot">
              não apurado —{" "}
              {canais && "erro" in canais ? `GA4 indisponível (${canais.erro})` : "propriedade GA4 não configurada no card"}
              .
            </p>
          )}
        </div>
      </section>
    </main>
  );
}