import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listProjects } from "@/lib/projects";
import { montarFicha, posicaoDeAtaque, FAMILIAS } from "@/lib/okr.mjs";
import { ehApurado, pct } from "@/lib/funil.mjs";
import { distanciaDoMercado, formatarRazao } from "@/lib/benchmark.mjs";
import { projetar } from "@/lib/projecao.mjs";
import { montarArvore, camadaDeEntrega, alavancaDePosicao } from "@/lib/arvore-metas.mjs";
import { acoesDoRanking } from "@/lib/agenda.mjs";
import { evaluateAll } from "@/lib/evaluate";
import { dbOn, listDone, listDonos, listDonoDatas } from "@/lib/db";
import { HOJE, coletarLeadsDoHub, coletarDoProjeto } from "@/lib/okr-coleta";
import { montarNiveis, medidoresDeEventos, estadoDeApurado, resolverTicket } from "@/lib/ficha.mjs";
import { canaisDoN4, razaoDoKr } from "@/lib/ficha-visual.mjs";
import { Projecao, num } from "../projecao";
import { Arvore } from "../arvore";
import { Tabs } from "../../tabs";

// Igual à `/okr`: número de OKR vindo do build é número de outra janela, e a R7 pede UMA janela
// declarada para a árvore inteira (contracts/rota-e-menu.md).
export const dynamic = "force-dynamic";

type CelulaFicha =
  | { estado: "apurado"; valor: number | string; rotulo: string; fonte: string }
  | { estado: "declarado"; valor: number | string; rotulo: string; declaradoEm: string; oQue: string }
  | { estado: "nao-apurado"; rotulo: string; motivo: string; consultar: string; rotuloBuraco?: "nao-mede" | "falhou-agora" | "tela-nao-le" }
  | { estado: "inferido"; valor: number; rotulo: string; de: string; divida: string };

type Marco = { chave: string; nome: string; celula: { valor: number } | { naoApurado: string }; fonte: string };
type Taxa = { de: string; para: string; celula: { valor: number } | { naoApurado: string } };
type Veredito = { posicao: number; celula: string | null };

/** Só apresentação — as chaves cruas continuam sendo o espaço de `n4:`/`n5:` que `validarKrs()`
 *  casa por igualdade exata (FR-017/R-017); não mexer nos catálogos de lib/ficha.mjs. */
const ROTULOS_AMIGAVEIS: Record<string, string> = {
  organico: "Orgânico",
  direto: "Direto",
  pago: "Pago",
  indicacao: "Indicação",
  outbound: "Outbound",
  social: "Social",
  "paginas-indexadas": "Páginas indexadas",
  "posicao-media-com-corte-pais": "Posição média (BR)",
  cobertura: "Cobertura",
  alcance: "Alcance",
  "citacao-por-ia": "Citação por IA",
  impressoes: "Impressões",
  lcp: "LCP",
  inp: "INP",
  cls: "CLS",
  ttfb: "TTFB",
  uptime: "Uptime",
  "taxa-5xx": "Taxa de erro 5xx",
  build: "Build",
  certificado: "Certificado SSL",
  "scroll-ate-oferta": "Scroll até a oferta",
  "cliques-cta": "Cliques no CTA",
  // "Abandono por campo" prometia quebra POR CAMPO, que o GA4 não dá — e o nome sozinho não
  // dizia o que era medido. O rótulo agora é a definição da métrica.
  "abandono-por-campo": "Formulário começado e não enviado",
  "saida-checkout": "Saída no checkout",
  "lead-gravado": "Lead gravado",
  "webhook-2xx": "Webhook respondendo",
  "gateway-ligado": "Gateway de pagamento ligado",
  "email-entregue": "E-mail entregue",
};

/** `marca` de KR (FR-017/R-017) — valores fixos de `validarKrs()` em lib/ficha.mjs. */
const MARCAS_AMIGAVEIS: Record<string, string> = {
  "chave-invalida": "chave inválida",
  "nao-verificavel": "não verificável",
  "sem-dono": "sem dono",
  excedente: "excedente",
};

/** Glossário fixo da ficha — termos que se repetem em toda tela e nunca são definidos nela
 *  (achado 5 do design-review: §7.N, R7, D1-D4, CR(), âncora saíam sem tradução). Estático porque
 *  o vocabulário é do MÉTODO (handoff/okr-kpi-template.md), não do projeto. */
const GLOSSARIO: { termo: string; def: string }[] = [
  { termo: "§7.N", def: "a posição do veredito no método de ataque: 1 = fator zerado, 2 = falta apurar antes de melhorar, 3 = cadeia fechada (ataca a menor taxa)." },
  { termo: "N0–N6", def: "os 7 níveis da árvore, do objetivo (N0) ao que fazer segunda (N6) — cada um responde uma pergunta diferente, nunca a mesma duas vezes." },
  { termo: "D1–D4", def: "as 4 famílias de causa de um buraco: D1 Descoberta (o canal te encontra?), D2 Entrega (a página chega inteira?), D3 Persuasão (ela convence?), D4 Encanamento (o evento chega ao banco?)." },
  { termo: "CR(A→B)", def: "taxa de conversão de A para B — de cada 100 que chegam em A, quantos viram B." },
  { termo: "âncora", def: "o último degrau apurado da cadeia, de cima para baixo — é a partir dele que a meta é dividida para trás." },
  // Auditoria de 05/09: esta entrada ainda ensinava a R7 ("uma janela de datas só, igual para a
  // árvore inteira") a dez linhas do bloco que diz "Janela desta cadeia: 2026-07-31 → 2026-09-05".
  // A 018 revogou a regra e o glossário continuou ensinando a versão morta — a tela se contradizia
  // sozinha. O termo fica (aparece nos comentários e nas specs 009-017), mas dizendo o que vale.
  { termo: "janela", def: "cada cadeia lê a janela que a fonte dela tem — Descoberta e Comportamento em 28 dias fechando em D-3, Conversão desde a época do projeto. Nenhuma taxa cruza duas janelas: seria dividir um período por outro. Substitui a R7 (\"uma janela só para a árvore inteira\"), revogada pela spec 018." },
  { termo: "época", def: "a data a partir da qual os dados do projeto pertencem ao negócio de hoje. Na Atma é 31/07/2026, quando a sociedade foi desfeita e o banco com os leads anteriores foi perdido — antes disso o funil era de outra operação." },
];

// achado 2 do design-review de 03/09: buraco PERMANENTE ("sem coletor", "sem propriedade no GSC")
// e falha TRANSITÓRIA (GSC/GA4/banco fora do ar por um instante) liam a mesma frase "não apurado
// — ...". Toda fonte que falha por conexão já embute "indisponível (código)" no motivo (lib/gsc.ts,
// lib/ga4.ts, lib/okr-coleta.ts); nenhum motivo estrutural usa essa palavra — checado nos 5 pontos
// que constroem motivo hoje. O rótulo muda, o `estado` da célula continua sendo `nao-apurado`: não
// é um 5º estado novo, é a mesma célula dizendo com mais precisão por que ela está vazia.
const EH_FALHA_TRANSITORIA = /indispon[íi]vel/i;
// 018/FR-028, R2 do contrato rotulo-buraco.md — precedência: `c.rotuloBuraco` decide primeiro;
// SÓ na ausência dele a regex de hoje continua sendo o comportamento (fallback, nunca definição).
const ehFalhaTransitoria = (c: { motivo: string; rotuloBuraco?: string }) =>
  c.rotuloBuraco ? c.rotuloBuraco === "falhou-agora" : EH_FALHA_TRANSITORIA.test(c.motivo);
const rotuloExibicaoBuraco = (c: { motivo: string; rotuloBuraco?: string }) => (ehFalhaTransitoria(c) ? "falhou agora" : "não apurado");

// achado 4: mesmo número em 3 formatos na mesma tela — "R$ 4.000" no hero (app/okr/projecao.tsx),
// "4000" cru no N2 (esta célula), "0" sem cifrão no N1. Os dois rótulos abaixo são os ÚNICOS que
// carregam dinheiro fora do hero — `${ficha.n1} em R$` (lib/ficha.mjs:621/626, todo perfil) e
// "Valor do tratamento" (o único fator `tipo:"valor"` em lib/okr.mjs) — checado nos dois arquivos.
const EH_ROTULO_MONETARIO = /em R\$$|^Valor do tratamento$/;
// `style: "currency"` e não `R$ ${…}` à mão (auditoria de 05/09): o padrão do `toLocaleString` é
// ATÉ 3 casas decimais, e a 018 trocou o ticket declarado (4000, inteiro) pelo apurado (uma
// MÉDIA) — a tela publicou `R$ 4.932,337`, que não é uma quantia que exista. Enquanto o valor foi
// digitado à mão o defeito não tinha como aparecer. Mesmo idioma de `app/crm/page.tsx:49`.
const formatarCifra = (c: { valor: number | string; rotulo: string }) =>
  typeof c.valor === "number" && EH_ROTULO_MONETARIO.test(c.rotulo)
    ? c.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : c.valor;

/** O único caminho que imprime valor (FR-009). Sem `0`, sem `—`, sem célula em branco. */
function Cel({ c }: { c: CelulaFicha }) {
  if (c.estado === "apurado")
    return (
      <>
        <strong>{formatarCifra(c)}</strong> <span className="foot">({c.fonte})</span>
      </>
    );
  if (c.estado === "declarado")
    return (
      <span className="cel-tag-declarado">
        {/* achado 6: `oQue` já vem calculado por `combinar()` (lib/ficha.mjs) e era descartado —
            "declarado em 2026-09-01" sozinho lia como se alguém tivesse declarado um R$ 0, quando
            é 0 × meta.ticket. */}
        <strong>{formatarCifra(c)}</strong> <span className="foot">declarado em {c.declaradoEm} · {c.oQue}</span>
      </span>
    );
  if (c.estado === "inferido")
    return (
      <span className="ficha-inferido">
        <strong>{c.valor}</strong> <span className="foot">inferido de {c.de} — dívida: {c.divida}</span>
      </span>
    );
  // não apurado — achado 1: `motivo` e `consultar` chegam com o mesmo texto quando a fonte já
  // está embutida no motivo (ex.: degraus do perfil D sem coletor). Repetir a mesma frase duas
  // vezes na tela era o maior consumo de altura da ficha; aqui a repetição é cortada, e o que
  // sobra — quando ainda é longo — vira disclosure em vez de parágrafo corrido.
  const repetido = c.consultar && c.motivo.includes(c.consultar);
  const texto = repetido ? c.motivo : `${c.motivo} · consultar: ${c.consultar}`;
  if (texto.length > 110) {
    // achado 3 do design-review de 03/09: 8 `<summary>` da página inteira liam "não apurado —
    // como apurar isto" para quem navega por nome acessível (WCAG 2.4.6) — indistinguíveis fora
    // do contexto visual da linha. O rótulo da própria célula (já traduzido acima) desambigua.
    return (
      <details className="ficha-explicacao">
        <summary className="foot">{rotuloExibicaoBuraco(c)} — como apurar {ROTULOS_AMIGAVEIS[c.rotulo] ?? c.rotulo}</summary>
        <p className="foot">
          {c.motivo}
          {!repetido && (
            <>
              <br />
              consultar: {c.consultar}
            </>
          )}
        </p>
      </details>
    );
  }
  return <span className="foot">{rotuloExibicaoBuraco(c)} — {texto}</span>;
}

/** Células "não apurado" repetem o mesmo motivo (achado 4 do design-review original: 9 das 33
 *  linhas da ficha; achado 2 do design-review de 03/09: 8 disclosures idênticos na página inteira,
 *  4 só em N3). Agrupamento só de apresentação — os `montarNX()` continuam devolvendo lista plana;
 *  célula apurada nunca entra num grupo.
 *
 *  `razao()` (lib/funil.mjs) prefixa o motivo com `numerador:`/`denominador:` conforme o lado que
 *  falta — duas taxas vizinhas de N3 citam o MESMO buraco (a célula que uma tem como numerador é
 *  o denominador da outra) só com prefixo trocado. Agrupar sem o prefixo funde essas duas; o texto
 *  exibido no `<summary>` mantém o motivo original (com prefixo) do primeiro item do grupo. */
function agruparPorMotivo(celulas: CelulaFicha[]) {
  const avulsas: CelulaFicha[] = [];
  const porMotivo = new Map<string, { motivo: string; itens: Extract<CelulaFicha, { estado: "nao-apurado" }>[] }>();
  for (const c of celulas) {
    if (c.estado !== "nao-apurado") {
      avulsas.push(c);
      continue;
    }
    const chave = c.motivo.replace(/^(numerador|denominador): /, "");
    const grupo = porMotivo.get(chave) ?? { motivo: c.motivo, itens: [] };
    grupo.itens.push(c);
    porMotivo.set(chave, grupo);
  }
  return { avulsas, grupos: [...porMotivo.values()] };
}

/** Uma linha de célula agora carrega o ESTADO como forma (achado 2): a borda à esquerda muda de
 *  traço por estado — sólida ausente para medido, tracejada para declarado, sólida colorida para
 *  inferido (mantém `.ficha-inferido`, já validado), pontilhada para buraco. Não é só cor: cor
 *  sozinha falha para quem não a distingue, e a régua de acessibilidade do design system já
 *  proíbe isso para status (ver `--good`/`--crit` em globals.css). */
function Linha({ c }: { c: CelulaFicha }) {
  return (
    <div className={`ficha-linha cel-${c.estado}`}>
      <span className="ficha-rotulo">{ROTULOS_AMIGAVEIS[c.rotulo] ?? c.rotulo}</span> <Cel c={c} />
    </div>
  );
}

/** Acha o nó (marco zerado/buraco) ou a aresta (menor taxa) que `posicaoDeAtaque()` já escolheu,
 *  para o diagrama de cadeia apontar exatamente para a MESMA célula do veredito de texto — nunca
 *  uma leitura visual paralela e potencialmente divergente (R1: um veredito só, várias vitrines). */
function indiceTrava(marcos: Marco[], taxas: Taxa[], veredito: Veredito): { tipo: "no" | "aresta"; indice: number } | null {
  if (veredito.posicao === 1 || veredito.posicao === 2) {
    const i = marcos.findIndex((m) => m.nome === veredito.celula);
    return i >= 0 ? { tipo: "no", indice: i } : null;
  }
  if (veredito.posicao === 3) {
    const comTaxa = taxas.map((t, i) => ({ t, i })).filter(({ t }) => ehApurado(t.celula));
    if (!comTaxa.length) return null;
    const menor = comTaxa.reduce((a, b) => ((b.t.celula as { valor: number }).valor < (a.t.celula as { valor: number }).valor ? b : a), comTaxa[0]);
    return { tipo: "aresta", indice: menor.i };
  }
  return null;
}

/**
 * O diagrama que substitui o funil decorativo (achado 3): cada marco vira um nó com o próprio
 * número (ou `?` para buraco), cada taxa vira uma aresta rotulada, e a célula que `posicaoDeAtaque`
 * escolheu como trava sai destacada em `--crit`. `<figcaption>` é a MESMA leitura em texto corrido
 * (achado 10) — não decorativa, visível, e o SVG some da árvore de acessibilidade (`aria-hidden`)
 * porque o texto ao lado já diz tudo que ele mostra.
 */
function CadeiaDiagrama({ marcos, taxas, veredito, janela }: { marcos: Marco[]; taxas: Taxa[]; veredito: Veredito; janela: { inicio: string; fim: string } }) {
  if (!marcos.length) return null;
  const n = marcos.length;
  const passo = 150;
  const largura = passo * (n - 1) + 80;
  // achado 5 do design-review de 03/09: conteúdo (rótulo em y=cy-10 até nó em cy+raio) ocupa
  // ~y=21..60 — os 130px originais deixavam ~98px de área morta abaixo, medido no navegador.
  const alturaSvg = 70;
  const cy = 40;
  const raio = 20;
  const x = (i: number) => 40 + i * passo;
  const trava = indiceTrava(marcos, taxas, veredito);

  const legenda = marcos.map((m) => `${m.nome} ${ehApurado(m.celula) ? (m.celula as { valor: number }).valor : "não apurado"}`).join(" → ");
  const travaTexto =
    trava?.tipo === "no"
      ? `Trava em ${marcos[trava.indice].nome} (0 apurado).`
      : trava?.tipo === "aresta"
        ? `Trava entre ${taxas[trava.indice].de} e ${taxas[trava.indice].para} (${pct((taxas[trava.indice].celula as { valor: number }).valor)}).`
        : "";

  return (
    <figure className="ficha-cadeia">
      <svg viewBox={`0 0 ${largura} ${alturaSvg}`} className="ficha-cadeia-svg" aria-hidden="true" focusable="false">
        {taxas.map((t, i) => {
          const apurada = ehApurado(t.celula);
          const ehTrava = trava?.tipo === "aresta" && trava.indice === i;
          const x1 = x(i) + raio;
          const x2 = x(i + 1) - raio;
          return (
            <g key={i}>
              <line x1={x1} y1={cy} x2={x2} y2={cy} className={`cadeia-aresta${apurada ? "" : " nao-apurada"}${ehTrava ? " trava" : ""}`} />
              <text x={(x1 + x2) / 2} y={cy - 10} textAnchor="middle" className={`cadeia-aresta-rotulo${ehTrava ? " trava" : ""}`}>
                {apurada ? pct((t.celula as { valor: number }).valor) : "?"}
              </text>
            </g>
          );
        })}
        {marcos.map((m, i) => {
          const apurado_ = ehApurado(m.celula);
          const ehTrava = trava?.tipo === "no" && trava.indice === i;
          return (
            <g key={m.chave}>
              <circle cx={x(i)} cy={cy} r={raio} className={`cadeia-no${apurado_ ? "" : " nao-apurado"}${ehTrava ? " trava" : ""}`} />
              <text x={x(i)} y={cy + 5} textAnchor="middle" className="cadeia-no-valor">
                {apurado_ ? (m.celula as { valor: number }).valor : "?"}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="ficha-cadeia-legenda" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
        {marcos.map((m, i) => (
          <div key={m.chave} className={trava?.tipo === "no" && trava.indice === i ? "trava" : ""}>
            {m.nome}
          </div>
        ))}
      </div>
      <figcaption className="foot ficha-cadeia-legenda-texto">
        Cadeia de {n} etapas, {janela.inicio} → {janela.fim}: {legenda}. {travaTexto}
      </figcaption>
    </figure>
  );
}

/** Os canais do N4: a MESMA `Linha` das demais células — `Cel` continua o único caminho que
 *  imprime valor (FR-009) — com um trilho embaixo. O trilho é `aria-hidden` porque o número está
 *  logo acima dele; ele não é um segundo caminho até o dado, é a comparação entre canais que a
 *  lista de texto não dá.
 *
 *  Um tom só: o comprimento já codifica a magnitude, sombrear por valor gastaria hue à toa.
 *  Canal sem fonte não ganha trilho — vazio ao lado de "não apurado" leria como zero medido.
 *
 *  Achado 7 do design-review de 03/09: canal sem fonte é SEMPRE `fracao: null` (nunca entra no
 *  trilho — comentário acima), então os sem-fonte passam pelo MESMO `agruparPorMotivo` que N3/N5
 *  já usam, em vez de repetir "não apurado — fonte GA4 indisponível (ETIMEDOUT)" uma vez por
 *  canal. Fica um grupo só dentro de `.ficha-canais`, não misturado com "fora do catálogo"/"total
 *  composto" do resto do nível — outbound continua lendo como canal, não como estatística derivada. */
function CanaisN4({ canais }: { canais: { celula: CelulaFicha; fracao: number | null }[] }) {
  const comTrilho = canais.filter((c) => c.fracao !== null);
  const { avulsas, grupos } = agruparPorMotivo(canais.filter((c) => c.fracao === null).map((c) => c.celula));
  return (
    <div className="ficha-canais">
      {comTrilho.map(({ celula, fracao }) => (
        <div key={celula.rotulo}>
          <Linha c={celula} />
          <div className="ficha-barra-trilho" aria-hidden="true">
            <div className="ficha-barra-preenche" style={{ width: `${(fracao ?? 0) * 100}%` }} />
          </div>
        </div>
      ))}
      {avulsas.map((c, i) => (
        <Linha key={`avulsa-${i}`} c={c} />
      ))}
      {grupos.map((grupo, i) =>
        grupo.itens.length > 1 ? (
          <details key={`grupo-${i}`} className="ficha-linha">
            <summary>
              {grupo.itens.length} {ehFalhaTransitoria(grupo.itens[0]) ? "falharam agora" : "não apurados"} — {grupo.motivo}:{" "}
              {grupo.itens.map((c) => ROTULOS_AMIGAVEIS[c.rotulo] ?? c.rotulo).join(", ")}
            </summary>
            {grupo.itens.map((c, j) => (
              <Linha key={j} c={c} />
            ))}
          </details>
        ) : (
          <Linha key={`grupo-${i}`} c={grupo.itens[0]} />
        ),
      )}
    </div>
  );
}

/** O número que a página inteira existe para responder sai em corpo de figura, e não no mesmo
 *  15px de "Cliques no CTA". Só para célula APURADA — figura de valor declarado apresentaria
 *  declaração como medição, a linha que `Cel` existe para não deixar borrar.
 *
 *  `necessario` (achado 7): "0" sozinho é o maior elemento da tela sem contexto — o número que
 *  importa é a distância até a meta, não o valor cru. Quando a projeção (010) já calculou quanto
 *  a janela exige, ele entra ao lado do apurado; sem meta declarada, cai para o formato antigo. */
function HeroN1({ c, necessario }: { c: Extract<CelulaFicha, { estado: "apurado" }>; necessario: number | null }) {
  return (
    <p className="ficha-figura">
      <b>{c.valor}</b>
      <span>
        {necessario != null && (
          <>
            {" "}
            de <strong>{num(necessario)}</strong> necessário na janela ·{" "}
          </>
        )}
        {ROTULOS_AMIGAVEIS[c.rotulo] ?? c.rotulo} <span className="foot">({c.fonte})</span>
      </span>
    </p>
  );
}

// achado 8 do design-review de 03/09: `document.title` era "ROI Hub" nas 40 fichas — aba e
// histórico indistinguíveis. `fetch()` em `listProjects()`/`listRepos()` é deduplicado pelo Next
// dentro da mesma requisição (mesma URL), então repetir a chamada aqui não dobra a rede.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const projects = await listProjects();
  const p = projects.find((x) => x.slug === slug);
  const nomeCurto = p?.nome.split(" — ")[0] ?? slug;
  return { title: `${nomeCurto} — OKR` };
}

export default async function FichaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const projects = await listProjects();
  const p = projects.find((x) => x.slug === slug);
  // A existência é conferida contra a lista COMPLETA (curados + repos do GitHub), não contra as
  // fichas curadas — projeto com perfil e sem curadoria abre a mesma página (contracts/rota-e-menu.md).
  if (!p) notFound();

  // achado 6 do design-review de 03/09: `evaluateAll()`+`listDonos()`+`listDone()`+`listDonoDatas()`
  // (bloco N6 abaixo) não dependem de NADA que a coleta produz — só de `slug`, já disponível aqui.
  // Disparar antes da coleta e só resolver depois do `await` dela sobrepõe os dois custos de rede
  // em vez de somá-los (TTFB medido em prod: 3,3s a frio). Mesmo try/catch de antes, só adiado.
  const on = dbOn();
  const agendaPromise = on
    ? Promise.all([
        evaluateAll().then((r) => r.filter((x) => x.curated)),
        listDonos().catch(() => new Map<string, string>()),
        listDone().catch(() => new Set<string>()),
        listDonoDatas().catch(() => new Map<string, string>()),
      ])
    : null;

  // ── T013a: a montagem, na ordem do contrato — coleta → montarFicha → posicaoDeAtaque → projetar → montarNiveis.
  const { porPipeline, erroLeads } = await coletarLeadsDoHub();
  const { cliques, leads, contatados, respondeu, ticket, vendas, impressoes, orcamentos, motivos, ga4, ga4ev, orcamentosSemLead, paginas, janelas } = await coletarDoProjeto(p, { porPipeline, erroLeads });
  const ficha = montarFicha({ slug: p.slug, perfil: p.perfil, coletado: { cliques, leads, contatados, respondeu, vendas, orcamentos }, declaracoes: p.declaracoes });
  // 018/FR-007/FR-011: a cadeia de Conversão só existe A PARTIR de `lead` — `visitante` é
  // Descoberta e ligá-lo à cadeia seria taxa cruzando janelas. Enquanto `PERFIS.D.marcos` ainda
  // começa em `visitante` (US2/T024 tira `visitante` e `contatado` de lá), a página filtra na
  // exibição; perfil que não começa em `visitante` (ex.: C, que começa em `contato`) não perde nada.
  const iniciaEmVisitante = ficha.marcos[0]?.chave === "visitante";
  const marcosCadeia = iniciaEmVisitante ? ficha.marcos.slice(1) : ficha.marcos;
  const taxasCadeia = iniciaEmVisitante ? ficha.taxas.slice(1) : ficha.taxas;
  const veredito = posicaoDeAtaque(ficha);
  // O SEGUNDO veredito, e ele é PARALELO: a §7 manda por fato apurado, a régua só dimensiona.
  // Nada aqui realimenta `posicaoDeAtaque` — se um dia realimentar, a §7 passa a decidir por
  // benchmark, que é exatamente o que a R6 recusa.
  const mercado = distanciaDoMercado(ficha);
  // 018/FR-022/FR-034: resolverTicket() ANTES de projetar() — `lib/projecao.mjs` não ganha regra
  // nova, só recebe o ticket já resolvido. `montarNiveis()` chama a MESMA função pura com os
  // mesmos dois insumos (ticket, meta) para N1/N2 — o resultado é idêntico por construção.
  const ticketCel = resolverTicket(ticket, p.meta ?? null);
  const metaComTicket = ticketCel.estado === "nao-apurado" ? (p.meta ?? null) : { ...p.meta, ticket: (ticketCel as { valor: number }).valor };
  const projecao = projetar({ ficha, meta: metaComTicket, hoje: HOJE });

  // ── Árvore de metas (016) — a descida que a 010 começa e para. `projetar()` divide a meta uma
  // vez (`meta ÷ âncora`); `montarArvore()` continua até impressões, escolhendo o divisor de cada
  // camada entre taxa apurada, ponte sobre buraco de medição e UMA faixa de mercado.
  // O CTR sai da mesma série do GSC que já deu cliques e impressões — sem chamada nova (FR-008).
  const cliquesV = ehApurado(cliques) ? (cliques as { valor: number }).valor : null;
  const impressoesV = ehApurado(impressoes) ? (impressoes as { valor: number }).valor : null;
  const ctr = cliquesV != null && impressoesV ? { valor: cliquesV / impressoesV, impressoes } : undefined;
  // Mesmo casting de `montarNiveis()` abaixo: o módulo é .mjs (para `node --test` importar sem
  // transpilar) e o TS não estreita `Celula` por `ehApurado()`.
  const arvore = montarArvore({ ficha, projecao, ctr }) as {
    camadas: {
      chave: string;
      nome: string;
      necessario: { min: number; max: number };
      hoje: { valor: number } | { naoApurado: string };
      gap: { min: number; max: number } | null;
      jaCobre?: boolean;
      divisor: { origem: string; lo: number; hi: number; fonte: string; nota?: string; atravessa: string[] } | null;
    }[];
    parou: { nome?: string; motivo: string } | null;
    bandaAberta: boolean;
  };
  const camadaImpressao = arvore.camadas.find((c) => c.chave === "impressao");
  const camadaClique = arvore.camadas.find((c) => c.chave === "visitante");
  const entrega = camadaDeEntrega(
    camadaImpressao?.necessario ?? null,
    paginas && "paginas" in paginas ? paginas.paginas : null,
    impressoesV ?? 0,
    projecao.normalizacao?.diasRestantes ?? 0,
  );
  const ctrAlvo = alavancaDePosicao(camadaClique?.necessario ?? null, impressoesV ?? 0);

  // ── N6 — a MESMA composição de app/agenda/page.tsx (FR-030, SC-018): a ordem de `evaluateAll()`
  // filtrada por `curated` é de onde sai o `#N · score`; passar `listProjects()` cru mudaria o
  // `meta` de todos os itens (o rótulo de ranking não é a ordem — já apagou ranking da tela antes).
  let itensAgenda: ReturnType<typeof acoesDoRanking> | null = null;
  let erroAgenda: string | null = null;
  let datasDono = new Map<string, string>();
  if (!agendaPromise) {
    erroAgenda = "DATABASE_URL ausente";
  } else {
    try {
      const [curados, donos, doneSet, datas] = await agendaPromise;
      datasDono = datas;
      const todas = acoesDoRanking(curados, donos).filter((i: { projeto: string }) => i.projeto === slug);
      // Feito não é pendente: mesmo corte de `doneSet.has(key@occ)` que a `/agenda` faz, senão
      // ação concluída dentro de `ACAO_DONE_DIAS` aparece na ficha como trabalho a fazer.
      itensAgenda = todas.filter((i: { key: string; occ: string }) => !doneSet.has(`${i.key}@${i.occ}`));
    } catch (e) {
      erroAgenda = (e as { code?: string })?.code ?? "banco indisponível";
    }
  }

  // ── N5 — só o que ESTA requisição já carrega (FR-028): impressões da mesma série do GSC que
  // já dá cliques, lead-gravado da célula de leads, gateway-ligado do campo `vendas` do card, e
  // os medidores D3 do GA4 (014) — enhanced measurement que já cai, sem instrumentar o site.
  const disponiveisN5: Record<string, { valor: number; fonte?: string } | { naoApurado: string }> = {
    impressoes,
    "lead-gravado": leads,
    "gateway-ligado": vendas,
    // 018/FR-032/FR-033: abandono compara form_start (GA4, janela COMPORTAMENTO) com lead (banco,
    // janela CONVERSAO) — só quando a primeira cabe inteira dentro da segunda.
    ...medidoresDeEventos(ga4ev, { lead: leads, janelaGa4: janelas.comportamento, epoca: janelas.conversao }),
  };

  const niveis = montarNiveis({
    slug: p.slug,
    ficha,
    projecao,
    veredito,
    declarada: p.ficha ?? null,
    meta: p.meta ?? null,
    itensAgenda,
    erroAgenda,
    datasDono,
    disponiveisN5,
    // A janela do GA4 — a mesma que `coletarDoProjeto()` usou para buscá-lo (018, D8). Divergir da
    // janela de Conversão deixou de ser defeito (FR-010); este parâmetro só serve para o N4 saber
    // comparar contra a janela CERTA, não contra qualquer uma.
    janela: { inicio: janelas.comportamento.inicio, fim: janelas.comportamento.fim },
    ga4,
    orcamentosSemLead,
    // 018/FR-013: `contatados` alimenta a NOTA de N3 ("100% contatados..."), não mais um marco.
    // `cliques` idem — N4 lê direto, sem depender de `visitante` existir em `ficha.marcos`.
    contatados,
    cliques,
    ticketApurado: ticket,
  }) as Array<{
    id: string;
    titulo: string;
    celulas: CelulaFicha[];
    nota?: string;
    krs?: {
      kr: { kpi: string; dono?: string; meta?: number | null; prazo?: string | null };
      marca: string | null;
      celulaAlvo: CelulaFicha | null;
      texto: string;
    }[];
    familia?: string | null;
    motivoFamilia?: string;
    itens?: { key: string; titulo: string; meta: string | null; dono: string | null; data: CelulaFicha; celulaQueMove: string; descontinuado: boolean }[];
    funil?: { estado: string; entrada?: number; saida?: number }[];
  }>;

  // O veredito já é calculado por escolherFamilia() dentro de montarNiveis() — só precisa subir
  // para o topo da página, onde a pergunta "onde atacar" é respondida antes de rolar 6 cards.
  const n5 = niveis.find((n) => n.id === "N5");
  const n6 = niveis.find((n) => n.id === "N6");
  // achado 6: quando não há ação com dono, N6 não pode ficar mudo — o próximo dado a apurar já
  // está calculado (é o primeiro buraco da própria cadeia), só nunca subia até aqui. Sugestão
  // SEM dono, rotulada como tal — não é ação da agenda, é o que a árvore já sabe.
  const proximoBuraco = ficha.marcos.find((m: Marco) => !ehApurado(m.celula)) ?? null;
  const pendentes = n6?.itens?.filter((item) => !item.descontinuado) ?? [];

  // achado 8: o nome do card carrega a descrição inteira do produto ("Atma Aligner — alinhadores
  // invisíveis + infoproduto R$ 47"), incluindo uma oferta DESCONTINUADA (ver N6 abaixo) — e ela
  // se repetia no eyebrow e no h1 com o mesmo peso do nome. Split só de apresentação: o nome curto
  // sobe para o título, o resto desce para uma legenda menor.
  const [nomeCurto, ...restoNome] = p.nome.split(" — ");
  const nomeDescricao = restoNome.join(" — ");

  const necessarioNaJanela = ehApurado(projecao.n1Janela) ? (projecao.n1Janela as { valor: number }).valor : null;

  return (
    <main className="page">
      <Tabs active="okr" okrSlug={slug} />

      {/* achado 9: 5.267px de altura em 360px sem nenhum jeito de pular seção — reusa `.tabs`/
          `.tab`, o mesmo padrão de navegação da coluna lateral, para 7 âncoras internas. */}
      <nav className="tabs ficha-indice" aria-label="Seções desta ficha">
        {["N0", "N1", "N2", "N3", "N4", "N5", "N6"].map((id) => (
          <a key={id} className="tab" href={`#${id}`}>
            {id}
          </a>
        ))}
      </nav>

      <section className="card ag-section">
        <p className="eyebrow">OKR · ficha de {nomeCurto}</p>
        <div className="hero-top okr-top">
          <div>
            <h1 className="ficha-nome">{nomeCurto}</h1>
            {nomeDescricao && <p className="foot ficha-subtitulo">{nomeDescricao}</p>}
          </div>
          <span
            className={
              veredito.posicao === 1 ? "pill pill-crit" : veredito.posicao === 2 ? "pill pill-warn" : veredito.posicao === 3 ? "pill pill-ok" : "pill"
            }
          >
            {veredito.posicao ? `§7.${veredito.posicao} — ${veredito.rotulo}` : veredito.rotulo}
          </span>
        </div>
        {ficha.perfil && (
          <p className="foot">
            Perfil {ficha.perfil} — {ficha.perfilNome} · N1: {ficha.n1} · <code>{ficha.n2}</code>
          </p>
        )}

        {/* achado 4: 8 parágrafos de mesmo peso viravam leitura linear obrigatória. Três blocos
            nomeados — cada um responde UMA pergunta, na ordem em que decide o próximo passo. */}
        <div className="ficha-bloco">
          <h2 className="ficha-bloco-h">Onde trava</h2>
          <p>
            {veredito.celula && <strong>{veredito.celula}: </strong>}
            {veredito.motivo}
          </p>
          {n5?.familia && (
            <p className="ficha-veredito">
              A cadeia trava em{" "}
              <strong>
                {n5.familia} — {FAMILIAS[n5.familia as keyof typeof FAMILIAS]?.split(" — ")[0] ?? n5.familia}
              </strong>{" "}
              ({n5.motivoFamilia}).
            </p>
          )}
          {/* Régua de mercado (spec 015) — subordinada ao veredito acima, nunca no lugar dele. Sai
              como diagnóstico (`3,6× o piso`), nunca como alvo: benchmark citado como meta de KR é
              o que a R6 proíbe, e a linha inteira perde o direito de existir se virar prescrição. */}
          {mercado.destaque ? (
            <p className="foot">
              <strong>Mercado</strong> · {mercado.destaque.de} → {mercado.destaque.para}:{" "}
              <strong>{(mercado.destaque.apurado * 100).toFixed(2).replace(".", ",")}%</strong> ={" "}
              <strong>{formatarRazao(mercado.destaque.razao)} o piso</strong> ({mercado.destaque.rotulo}).{" "}
              Faixa da média {(mercado.destaque.faixa.media[0] * 100).toFixed(1).replace(".", ",")}–
              {(mercado.destaque.faixa.media[1] * 100).toFixed(1).replace(".", ",")}% · elite a partir de{" "}
              {(mercado.destaque.faixa.elite[0] * 100).toFixed(1).replace(".", ",")}%.
              {mercado.destaque.buraco &&
                ` Buraco: ${mercado.destaque.buraco.esperado} esperados no piso, ${mercado.destaque.buraco.apuradoEmUnidades} apurados — faltam ${mercado.destaque.buraco.faltam}.`}{" "}
              <em>Fonte: {mercado.destaque.fonte}.</em>
            </p>
          ) : (
            ficha.perfil && (
              <p className="foot">
                <strong>Mercado</strong> · nenhum degrau com régua e os dois lados apurados — a §7.2
                (apurar antes de melhorar) manda antes da comparação. Benchmark não preenche buraco de
                medição.
              </p>
            )
          )}
        </div>

        {iniciaEmVisitante && (
          <div className="ficha-bloco">
            <h2 className="ficha-bloco-h">Descoberta</h2>
            {/* 018/FR-005/FR-007/FR-008/FR-011: `visitante` sai da cadeia de Conversão — é
                Descoberta, janela própria, sem taxa ligando ao resto (a taxa `visitante→lead`
                cruzaria janelas). O rodapé "janela única para a árvore inteira (R7)" saiu; cada
                bloco agora carrega a janela que produziu os números dele. */}
            <p className="foot">
              Janela: <strong>{janelas.descoberta.inicio} → {janelas.descoberta.fim}</strong> — {janelas.descoberta.porque}.
              Sem taxa ligando estes números à Conversão — são cadeias diferentes.
            </p>
            <Linha c={estadoDeApurado(cliques, "Search Console", "visitante")} />
          </div>
        )}

        <div className="ficha-bloco">
          <h2 className="ficha-bloco-h">Quanto falta</h2>
          <Projecao meta={metaComTicket ?? undefined} p={projecao} ticketCel={ticketCel} />
        </div>

        {(arvore.camadas.length > 1 || arvore.parou) && (
          <div className="ficha-bloco ficha-bloco--novo">
            <h2 className="ficha-bloco-h">
              Árvore de metas <span className="pill">novo · spec 016</span>
            </h2>
            <Arvore arvore={arvore} entrega={entrega} ctrAlvo={ctrAlvo} impressoesHoje={impressoes} />
          </div>
        )}

        {/* A palitagem (017) — achado da sessão de 04-05/09/2026: o funil diz ONDE o lead parou,
            a coluna `motivo` diz POR QUÊ, e nenhum arquivo do hub lia ela até aqui. Só aparece
            quando a fonte própria confirma o campo E há pelo menos um motivo real na janela —
            `motivos === null` (campo não existe) e `motivos.motivos.length === 0` (existe e
            ninguém foi palitado ainda) são os dois estados em que a seção não tem o que dizer. */}
        {motivos && motivos.motivos.length > 0 && (
          <div className="ficha-bloco">
            <h2 className="ficha-bloco-h">Por que não avançou</h2>
            <p>
              {motivos.motivos.map((m, i) => (
                <span key={m.motivo}>
                  {i > 0 && " · "}
                  <strong>{m.n}</strong> {m.motivo.replace(/_/g, " ")}
                </span>
              ))}
              {motivos.semMotivo > 0 && (
                <span className="foot"> · {motivos.semMotivo} sem motivo registrado</span>
              )}
            </p>
            <p className="foot">
              {motivos.motivos[0].n / motivos.total >= 0.5 ? (
                <>
                  <strong>{motivos.motivos[0].motivo.replace(/_/g, " ")}</strong> sozinho é{" "}
                  {Math.round((motivos.motivos[0].n / motivos.total) * 100)}% dos {motivos.total} leads
                  reais da janela — não é taxonomia de família (D3/D4 é do degrau, não do motivo),
                  mas um motivo dominando por larga margem lê como encanamento antes de oferta.
                </>
              ) : (
                <>Palitagem do próprio projeto ({motivos.total} lead(s) reais na janela), sem classificação de família — a taxonomia é do cliente.</>
              )}
            </p>
          </div>
        )}

        <div className="ficha-bloco">
          <h2 className="ficha-bloco-h">O que fazer</h2>
          {pendentes.length > 0 ? (
            <p>
              <a href="#N6">{pendentes[0].titulo}</a>
              {pendentes.length > 1 ? ` — e mais ${pendentes.length - 1} em N6.` : "."}
            </p>
          ) : proximoBuraco ? (
            <p>
              {/* achado 7 do design-review de 03/09: "Sem ação com dono agora. Ver a sugestão em
                  N6" empurrava quem lê 2.500px para achar a sugestão — que já está calculada
                  aqui em cima (`proximoBuraco`). O link vira reforço, não o único caminho. */}
              Sem ação com dono agora. Próximo dado a apurar: <strong>{proximoBuraco.nome}</strong> —
              consultar {proximoBuraco.fonte}.
              {/* achado 1 do design-review de 03/09: o veredito §7.1 (fator zerado) e a sugestão
                  de N6 (1º buraco de medição) respondiam perguntas diferentes sem se citar — em
                  atma, "tratamento INICIADO: 0 apurado" no topo contra "apurar contato feito"
                  aqui embaixo lia como dois planos de ataque. Só entra quando os dois nomes
                  divergem (posição 2/3 já apontam pro mesmo degrau/taxa). */}
              {veredito.posicao === 1 && veredito.celula && veredito.celula !== proximoBuraco.nome && (
                <>
                  {" "}
                  Isso fecha um buraco de medição, mas não destrava <strong>{veredito.celula}</strong> —
                  o fator zerado só sai de 0 com trabalho na etapa em que ele está.
                </>
              )}{" "}
              <a href="#N6">Ver em N6</a>.
            </p>
          ) : (
            <p className="foot">Sem ação pendente e sem dado a apurar na cadeia.</p>
          )}
        </div>

        <details className="ficha-glossario">
          <summary className="foot">termos desta página</summary>
          <dl className="foot">
            {GLOSSARIO.map((g) => (
              <div key={g.termo} className="ficha-glossario-item">
                <dt>{g.termo}</dt>
                <dd>{g.def}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>

      {niveis.map((n) => {
        // A primeira célula do N1 é a contagem do último marco da cadeia (`montarN1`) — a única
        // que vira figura, e só quando apurada e numérica (célula de taxa chega como string).
        const primeira = n.celulas[0];
        // N4 renderiza os canais com trilho e SÓ o resto (fora do catálogo, total composto,
        // diferença, inferências) pelo caminho comum de agrupamento.
        // Mesmo casting de `montarNiveis()` acima: o módulo é .mjs (para `node --test` importar
        // sem transpilar), então o tipo entra aqui, na fronteira.
        const n4 = (n.id === "N4" ? canaisDoN4(n.celulas) : null) as {
          canais: { celula: CelulaFicha; fracao: number | null }[];
          resto: CelulaFicha[];
        } | null;
        const heroN1 =
          n.id === "N1" && primeira?.estado === "apurado" && typeof primeira.valor === "number" ? primeira : null;
        return (
        <section className="card ag-section" aria-labelledby={n.id} key={n.id}>
          <h2 className="eyebrow" id={n.id}>{n.titulo}</h2>
          {n.id === "N4" && n.nota && <p className="foot ficha-nota-n4">{n.nota}</p>}
          {/* 018/FR-013: a nota de contato — `contatado` saiu de marco, e a leitura ("todo lead
              fora de `novo` foi contatado") continua visível, só que fora da cadeia e do gargalo. */}
          {n.id === "N3" && n.nota && <p className="foot ficha-nota-n4">{n.nota}</p>}

          {/* achado 3: substitui o funil decorativo (área proporcional a `aria-hidden`, sem
              rótulo, sem eixo) por um diagrama de cadeia com nó por marco e aresta por taxa —
              lido diretamente de `marcosCadeia`/`taxasCadeia` (018: sem `visitante`, que foi para
              o bloco de Descoberta), não do `n.funil` derivado. */}
          {n.id === "N3" && marcosCadeia.length > 0 && (
            <>
              {/* FR-005/FR-008 (018): a época aparece com o motivo declarado ao lado da janela de
                  Conversão — `janelas.conversao.porque` já É esse motivo quando o card declara
                  `epoca`, e "sem época declarada no card" quando não declara. */}
              <p className="foot">
                Janela desta cadeia: <strong>{janelas.conversao.inicio} → {janelas.conversao.fim}</strong> — {janelas.conversao.porque}
              </p>
              <CadeiaDiagrama marcos={marcosCadeia} taxas={taxasCadeia} veredito={veredito} janela={{ inicio: janelas.conversao.inicio, fim: janelas.conversao.fim }} />
            </>
          )}
          {n4 && <CanaisN4 canais={n4.canais} />}
          {heroN1 && <HeroN1 c={heroN1} necessario={necessarioNaJanela} />}

          {/* N2 fica de fora: as células ali formam uma equação lida em sequência (Leads × CR1 ×
              CR2 × Valor = "a conta fecha?") — agrupar reordenaria os não-apurados para depois dos
              apurados/declarados e quebraria essa leitura. N3 é seguro: os 4 não-apurados já vêm
              consecutivos, sem apurado no meio, então agrupar não reordena nada. */}
          {n.id === "N3" || n.id === "N4" || n.id === "N5"
            ? (() => {
                // N3 (018, FR-007): a primeira célula é a taxa `visitante→lead` quando a cadeia
                // ainda começa em `visitante` — ela já saiu para o bloco de Descoberta, então some
                // daqui também. `agruparPorMotivo` nunca vê essa célula.
                const celulasN3 = n.id === "N3" && iniciaEmVisitante ? n.celulas.slice(1) : n.celulas;
                const { avulsas, grupos } = agruparPorMotivo(n4 ? n4.resto : celulasN3);
                return (
                  <>
                    {avulsas.map((c, i) => (
                      <Linha key={`avulsa-${i}`} c={c} />
                    ))}
                    {grupos.map((grupo, i) =>
                      grupo.itens.length > 1 ? (
                        <details key={`grupo-${i}`} className="ficha-linha">
                          <summary>
                            {grupo.itens.length} {ehFalhaTransitoria(grupo.itens[0]) ? "falharam agora" : "não apurados"} — {grupo.motivo}:{" "}
                            {grupo.itens.map((c) => ROTULOS_AMIGAVEIS[c.rotulo] ?? c.rotulo).join(", ")}
                          </summary>
                          {grupo.itens.map((c, j) => (
                            <Linha key={j} c={c} />
                          ))}
                        </details>
                      ) : (
                        <Linha key={`grupo-${i}`} c={grupo.itens[0]} />
                      ),
                    )}
                  </>
                );
              })()
            : (heroN1 ? n.celulas.slice(1) : n.celulas).map((c, i) => <Linha key={i} c={c} />)}

          {n.id === "N0" && n.krs && n.krs.length > 0 && (
            <ul className="ficha-krs">
              {n.krs.map((k, i) => (
                <li key={i}>
                  <strong>{k.kr.kpi}</strong>
                  {k.kr.dono && <span className="pill">{k.kr.dono}</span>}
                  {k.marca && <span className="pill pill-warn">{MARCAS_AMIGAVEIS[k.marca] ?? k.marca}</span>}
                  {/* O KR que passa na validação era o que aparecia mais POBRE: `validarKrs()` só
                      produz `texto` quando há problema, então KR válido saía como nome + dono e
                      nada mais — meta e prazo ficavam no card sem nunca chegar à tela, e um
                      coletor novo podia ser ligado sem que seu número aparecesse em lugar nenhum.
                      O valor sai por `Cel`, o único caminho que imprime valor (FR-009). */}
                  {k.celulaAlvo && (
                    <div className="foot">
                      hoje: <Cel c={k.celulaAlvo} />
                      {k.kr.meta != null && (
                        <>
                          {" · meta "}
                          {k.kr.meta}
                          {k.kr.prazo && ` até ${k.kr.prazo}`}
                        </>
                      )}
                    </div>
                  )}
                  {/* Quanto do caminho até a meta já foi andado. `razaoDoKr()` só devolve algo
                      para célula apurada e numérica — o trilho é redundante com o "hoje X · meta Y"
                      logo acima, por isso `aria-hidden` e sem rótulo próprio. */}
                  {(() => {
                    const r = razaoDoKr(k.celulaAlvo, k.kr.meta);
                    return r ? (
                      <div className="meter-track ficha-kr-medidor" aria-hidden="true">
                        <div className="meter-fill" style={{ width: `${r.fracao * 100}%` }} />
                      </div>
                    ) : null;
                  })()}
                  {k.texto && <div className="foot">{k.texto}</div>}
                </li>
              ))}
            </ul>
          )}

          {n.id === "N6" && n.itens && n.itens.length > 0 && (
            <>
              {n.itens.some((item) => !item.descontinuado) && (
                <ul className="ficha-krs">
                  {n.itens
                    .filter((item) => !item.descontinuado)
                    .map((item) => (
                      <li key={item.key}>
                        <strong>{item.titulo}</strong>
                        {item.meta && <span> {item.meta}</span>}
                        {item.dono ? <span className="pill">{item.dono}</span> : <span className="pill pill-warn">sem responsável</span>}
                        <div className="foot">
                          <Cel c={item.data} /> · célula que move: {item.celulaQueMove === "nao-declarada" ? "não declarada" : item.celulaQueMove}
                        </div>
                      </li>
                    ))}
                </ul>
              )}
              {n.itens.some((item) => item.descontinuado) && (
                <details className="ficha-glossario">
                  <summary className="foot">decisões revogadas</summary>
                  <ul className="ficha-krs">
                    {n.itens
                      .filter((item) => item.descontinuado)
                      .map((item) => (
                        <li key={item.key}>
                          <strong>{item.titulo}</strong>
                          {item.meta && <span> {item.meta}</span>}
                          {item.dono ? <span className="pill">{item.dono}</span> : <span className="pill pill-warn">sem responsável</span>}
                          <div className="foot">
                            <Cel c={item.data} /> · célula que move: {item.celulaQueMove === "nao-declarada" ? "não declarada" : item.celulaQueMove}
                          </div>
                        </li>
                      ))}
                  </ul>
                </details>
              )}
            </>
          )}

          {/* achado 6: sem ação com dono, N6 respondia só com um disclosure de decisões revogadas
              — a pergunta "o que eu faço segunda?" ficava sem resposta nenhuma. O próximo dado a
              apurar já é conhecido pela própria árvore (primeiro marco não apurado); mostrar isso
              como SUGESTÃO SEM DONO, nunca como ação da agenda, respeita o FR-031 (nada de
              inferência de responsável ou de célula que move). */}
          {n.id === "N6" && pendentes.length === 0 && proximoBuraco && (
            <p className="ficha-sugestao">
              <span className="pill">sugestão · sem dono</span> Próximo dado a apurar:{" "}
              <strong>{proximoBuraco.nome}</strong> — consultar {proximoBuraco.fonte}.
            </p>
          )}
        </section>
        );
      })}
    </main>
  );
}
