// information-design · foco + contexto com régua de mês · responde: a Atma é encontrada por quem
// não a conhece, e esse volume está subindo ou caindo AGORA? · fonte: hub_gsc_dia · 2026-09-18
// ─────────────────────────────────────────────────────────────────────────────────────────────
// 9ª corrida desta rota, e a segunda de FORMA. O bloco de nível 1 desenhava as 37 semanas num
// eixo LINEAR COMPARTILHADO, e a escala não sustenta as quatro ordens de magnitude da série:
// pico de 17.020 em 06/04 contra 1.492 na última semana completa. Medido no plot de 56 unidades,
// as seis últimas completas davam 14, 14, 11, 5, 3 e 3 — e os valores 114, 28, 7 e 2 davam a MESMA
// barra de 1 unidade, porque é o piso que impede a barra de sumir. A pergunta é sobre AGORA e a
// resposta morava nos 9% de baixo do gráfico.
//
// Por que não escala log, que é a resposta de reflexo para quatro ordens de magnitude: barra tem
// que começar no zero (piso da skill), e comprimento em log não codifica razão nenhuma — 2 contra
// 17.020 desenharia meia barra. O que a série precisa não é outra escala, é OUTRA JANELA.
//
// Este componente NÃO está em `app/viz.tsx` de propósito. `WeekChart` serve /seo, /infra e o
// gráfico mensal de Descoberta desta mesma página; as seis formas abaixo entrariam lá como seis
// props opcionais que nenhum dos três consumidores passa. A convenção do log ("prop OPCIONAL,
// /seo e /infra não mudam um pixel") funcionou para UMA prop duas vezes; seis é config surface.
// O que é compartilhado de verdade — a geometria da barra — vem de `barPath`, importada.
//
// Todo RÓTULO aqui é HTML posicionado em %, nunca `<text>` do SVG: texto dentro de um viewBox de
// 248 unidades encolhe com o container, e a 360px um rótulo de 3 unidades renderiza a 4,3px. Por
// isso `.sf-plot` envolve SÓ o svg — assim `top`/`height` em % dos overlays batem exatamente com
// as unidades do viewBox, e a régua e os hosts ficam FORA dele, no fluxo normal.

import { barPath, fmtDay, num } from "../../../viz";
import type { WeekPoint, WeekCut } from "../../../viz";
import { reguaDeMeses } from "@/lib/serie-gsc.mjs";

const W = 248; // as mesmas unidades de largura do WeekChart: o bloco tem uma escala horizontal só

type Geo = { alturaPlot: number; topo: number; base: number; zero: number; total: number };

/** A tira de contexto e o gráfico de foco têm a MESMA anatomia e alturas diferentes. Derivar as
 *  duas de uma função em vez de repetir quatro constantes é o que mantém a linha de base, a faixa
 *  do zero medido e o topo alinhados entre os dois — desalinhar a base faria o olho ler as duas
 *  escalas como uma. */
function geo(alturaPlot: number, reservaTopo: number): Geo {
  const topo = reservaTopo;
  const base = topo + alturaPlot;
  return { alturaPlot, topo, base, zero: base + 3, total: base + 7 };
}

/** 56 unidades de plot são as MESMAS do gráfico que este substitui (222px renderizados em 982) —
 *  o que muda é quantos slots as dividem, de 37 para 13. A tira de contexto leva 18: ela é
 *  evidência do foco, não uma segunda resposta, e tem que perder em peso. */
const FOCO = geo(56, 10);
const CONTEXTO = geo(18, 4);

const pct = (v: number) => `${v * 100}%`;

function Barras({
  pontos,
  max,
  g,
  cut,
  classe,
  fmt,
}: {
  pontos: WeekPoint[];
  max: number;
  g: Geo;
  cut?: { index: number } | null;
  classe: string;
  fmt: (v: number) => string;
}) {
  const slot = W / pontos.length;
  return (
    <svg
      className={classe}
      viewBox={`0 0 ${W} ${g.total}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${pontos.length} semanas, de ${fmtDay(pontos[0].start)} a ${fmtDay(
        pontos[pontos.length - 1].end,
      )}. Topo da escala: ${fmt(max)}.`}
    >
      <line vectorEffect="non-scaling-stroke" className="sf-axis" x1="0" y1={g.base} x2={W} y2={g.base} />
      {pontos.map((p, i) => {
        const v = p.value;
        // O piso de 1 unidade: sem ele, 2 impressões contra o topo da escala arredondam para
        // altura 0 e a barra fica idêntica ao zero MEDIDO logo abaixo — a distinção que este
        // gráfico existe para fazer. A régua de quando o piso deixa de bastar é a própria
        // `janelaDeFoco`: ela troca a JANELA em vez de deixar quatro valores empatarem em 1px.
        const h = max > 0 && v ? Math.max(1, Math.round((v / max) * g.alturaPlot)) : 0;
        return (
          // ponytail: tooltip = <title> nativo do SVG; quem lê por teclado usa <SerieEmTabela>
          <g key={`${p.start}-${p.end}`} className="sf-wk">
            <title>
              {`${fmtDay(p.start)}–${fmtDay(p.end)}: ${
                v === null
                  ? "semana parcial ou que cruza a troca de site — fora da leitura"
                  : v === 0
                    ? `${fmt(0)} — medido`
                    : fmt(v)
              }`}
            </title>
            <rect x={i * slot} y="0" width={slot} height={g.total} fill="transparent" />
            {/* AUSÊNCIA VISÍVEL, e ABAIXO DA LINHA DE BASE. Antes desta corrida `value === null`
                desenhava NADA: a legenda dizia "coluna vazia: semana parcial (2 nas pontas)" e o
                leitor contava buracos. Mas a primeira tentativa desta corrida — contorno tracejado
                de ALTURA CHEIA dentro do plot — foi pior, e só abrir o PNG pegou: num gráfico de
                barras, marca alta lê como VALOR alto, e a parcial de janeiro ficava mais alta que
                as barras de janeiro. Pior no slot que também está depois do corte: a hachura da
                faixa ENGOLIA o contorno, e o slot ficava com uma ausência só em vez de duas.
                Sob o eixo a regra fica única — nada ali é valor positivo medido — e o que separa
                os dois estados é a FORMA: o zero é linha pontilhada, a parcial é caixa vazada. */}
            {v === null ? (
              <rect
                className="sf-parcial"
                vectorEffect="non-scaling-stroke"
                x={i * slot + 1.5}
                y={g.base + 1}
                width={Math.max(1, slot - 3)}
                height={5}
              />
            ) : null}
            {h > 0 ? <path className="sf-bar" d={barPath(i * slot + 1, g.base - h, slot - 2, h)} /> : null}
            {/* ZERO MEDIDO ≠ SEM DADO: a fonte respondeu, e a resposta foi nenhuma impressão.
                Abaixo da base de propósito — lá nunca compete em altura com a menor das barras. */}
            {v === 0 ? (
              <line vectorEffect="non-scaling-stroke" className="sf-zero" x1={i * slot + 1} y1={g.zero} x2={(i + 1) * slot - 1} y2={g.zero} />
            ) : null}
          </g>
        );
      })}
      {cut && cut.index > 0 && cut.index < pontos.length ? (
        <line vectorEffect="non-scaling-stroke" className="sf-cut" x1={cut.index * slot} y1={g.topo - 4} x2={cut.index * slot} y2={g.zero + 2} />
      ) : null}
    </svg>
  );
}

/** A faixa DEPOIS do corte: dali para a direita o slot soma outro site.
 *
 *  Textura e não cor, e por isso HTML e não SVG — um `<pattern>` precisaria de um `id`, e este
 *  componente desenha DOIS gráficos na mesma página (foco e contexto), o que colidiria de id. O
 *  `repeating-linear-gradient` do CSS dá a hachura sem id nenhum.
 *
 *  Por que a faixa existe além da linha: com o corte no slot 34 de 37, a linha tracejada caía a
 *  3% da borda direita e lia como a MOLDURA do gráfico, não como uma divisão. Faixa tem extensão,
 *  e extensão é o que diz "daqui em diante". */
function Faixa({ cut, n, g }: { cut: { index: number }; n: number; g: Geo }) {
  return (
    <span
      className="sf-depois"
      aria-hidden
      style={{ left: pct(cut.index / n), top: pct(g.topo / g.total), height: pct(g.alturaPlot / g.total) }}
    />
  );
}

/** A régua de mês, FORA do `.sf-plot` e no fluxo normal: 11px reais em qualquer largura.
 *
 *  Sem ela o eixo da atma tinha 37 slots e DOIS rótulos (12/01 e 15/09), e o veredito falava de
 *  quatro datas — pico 06/04, colapso 20/04, zero em julho, retomada em agosto — nenhuma delas
 *  localizável. O leitor via a forma e não sabia quando. */
function Regua({ pontos }: { pontos: WeekPoint[] }) {
  const ticks: { index: number; rotulo: string; ano: string | null }[] = reguaDeMeses(pontos);
  return (
    <div className="sf-regua" aria-hidden>
      {ticks.map((t) => (
        <span key={t.index} style={{ left: pct(t.index / pontos.length) }}>
          {t.rotulo}
          {t.ano ? <i>/{t.ano.slice(2)}</i> : null}
        </span>
      ))}
    </div>
  );
}

/** Os dois hosts sob o eixo, cada um do seu lado do corte.
 *
 *  Antes desta corrida isto era um flex com `flexBasis: (index/n)*100%`: com o corte no slot 34 de
 *  37, o host novo ficava com 6% da largura e o rótulo saía truncado em
 *  `atma.roilabs.com.br + usealigne…`. Agora o lado novo não tem largura reservada — ele se ancora
 *  na linha do corte e cresce para o lado em que há espaço. */
function Hosts({ cut, n }: { cut: WeekCut; n: number }) {
  const emPorcento = (cut.index / n) * 100;
  // Acima de 70% não há largura à direita para o rótulo crescer, e ele saía truncado. Ali ele
  // cresce para a ESQUERDA, ancorado na mesma linha. É a única diferença entre os dois casos.
  const naPonta = emPorcento > 70;
  return (
    <div className="sf-hosts">
      <span className="sf-host-antes" style={{ maxWidth: `${emPorcento}%` }}>
        {cut.antes}
      </span>
      <span
        className={naPonta ? "sf-host-novo sf-host-fim" : "sf-host-novo"}
        style={naPonta ? { right: `${100 - emPorcento}%` } : { left: `${emPorcento}%` }}
      >
        {cut.depois}
      </span>
    </div>
  );
}

/** O rótulo do pico, ancorado no slot dele. `transform` em três casos porque um rótulo centrado
 *  num pico do primeiro ou do último slot sairia metade fora do bloco. */
function Pico({ index, n, valor, dia }: { index: number; n: number; valor: number; dia: string }) {
  const x = ((index + 0.5) / n) * 100;
  const alinhamento = x < 12 ? "translateX(0)" : x > 88 ? "translateX(-100%)" : "translateX(-50%)";
  return (
    <span className="sf-pico" style={{ left: `${x}%`, transform: alinhamento }}>
      pico {num.format(valor)} · {fmtDay(dia)}
    </span>
  );
}

export type Foco = { inicio: number; fim: number; max: number; maxSerie: number; vezesAbaixo: number };

export function SerieComFoco({
  pontos,
  cut,
  fmt,
  foco,
  picoIndex,
}: {
  pontos: WeekPoint[];
  cut?: WeekCut;
  fmt: (v: number) => string;
  /** O que `janelaDeFoco` devolveu. `null` = a escala compartilhada não esmaga nada, e o
   *  componente desenha UM gráfico só — dois do mesmo dado é o donut com o número que a legenda
   *  já diz. */
  foco: Foco | null;
  /** O slot do pico da série inteira. `null` quando não há pico (série toda zero). */
  picoIndex: number | null;
}) {
  const n = pontos.length;
  const maxSerie = Math.max(0, ...pontos.map((p) => p.value ?? 0));
  // Sem foco o gráfico grande É a série inteira, e é ele que leva o corte, a régua e o pico.
  const principal = foco ? pontos.slice(foco.inicio) : pontos;
  const maxPrincipal = foco ? foco.max : maxSerie;
  // A DATA do topo da escala. "topo da escala 4.129" sozinho não diz que esse topo é de seis
  // semanas atrás — e é justamente isso que faz o desenho do foco ser uma QUEDA. O número sem a
  // data deixa a leitura para o olho e não a escreve em lugar nenhum.
  const diaDoTopo = principal.find((pt) => pt.value === maxPrincipal)?.start ?? null;
  const cutPrincipal = foco
    ? cut && cut.index > foco.inicio
      ? { ...cut, index: cut.index - foco.inicio }
      : undefined
    : cut;
  const temCut = (c: { index: number } | undefined, total: number) => !!c && c.index > 0 && c.index < total;

  return (
    <figure className="sf">
      {/* ── O FOCO, que é a resposta ────────────────────────────────────────────────────────── */}
      <div className="sf-cab">
        <span className="sf-cab-t">
          Impressões não-marca · {foco ? `últimas ${principal.length} semanas` : `${n} semanas`}
        </span>
        {/* G32 na IMAGEM: recortado da tela, o gráfico tinha ZERO número. O topo da escala é o
            número que faz cada barra ser lida como fração de algo, e não como altura solta. */}
        <span className="sf-cab-escala">
          topo da escala <strong>{num.format(maxPrincipal)}</strong>
          {diaDoTopo ? <> · {fmtDay(diaDoTopo)}</> : null}
        </span>
      </div>
      <div className="sf-plot">
        {/* A linha do topo declara a escala DENTRO do plot — é a régua que faz "8,8% do pico" ser
            lido como distância e não como cifra a decorar. */}
        <span className="sf-teto" aria-hidden style={{ top: pct(FOCO.topo / FOCO.total) }} />
        {temCut(cutPrincipal, principal.length) ? (
          <Faixa cut={cutPrincipal!} n={principal.length} g={FOCO} />
        ) : null}
        {!foco && picoIndex !== null ? (
          <Pico index={picoIndex} n={n} valor={maxSerie} dia={pontos[picoIndex].start} />
        ) : null}
        <Barras pontos={principal} max={maxPrincipal} g={FOCO} cut={cutPrincipal} classe="sf-svg" fmt={fmt} />
      </div>
      <Regua pontos={principal} />
      {temCut(cutPrincipal, principal.length) ? <Hosts cut={cutPrincipal!} n={principal.length} /> : null}

      {/* ── O CONTEXTO, só quando a escala do foco de fato deixa o pico fora de vista ───────── */}
      {foco ? (
        <div className="sf-ctx">
          <div className="sf-cab">
            <span className="sf-cab-t">As {n} semanas da série</span>
            {/* A DECLARAÇÃO obrigatória do foco: o eixo de cima não é truncado por baixo (a barra
                sai do zero), mas o topo dele deixa o pico FORA DE VISTA, e isso tem que estar
                escrito na tela, não só no comentário do código. */}
            <span className="sf-cab-escala">
              o pico é <strong>{foco.vezesAbaixo.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}×</strong> o
              topo de cima
            </span>
          </div>
          <div className="sf-plot sf-plot-ctx">
            {/* A janela do foco, marcada na tira: sem ela o leitor não sabe QUE PEDAÇO desta série
                o gráfico de cima ampliou, e os dois viram duas séries em vez de duas escalas. */}
            <span
              className="sf-janela"
              aria-hidden
              style={{ left: pct(foco.inicio / n), width: pct((n - foco.inicio) / n) }}
            >
              <i>o foco ↑</i>
            </span>
            {temCut(cut, n) ? <Faixa cut={cut!} n={n} g={CONTEXTO} /> : null}
            {picoIndex !== null ? (
              <Pico index={picoIndex} n={n} valor={maxSerie} dia={pontos[picoIndex].start} />
            ) : null}
            <Barras pontos={pontos} max={maxSerie} g={CONTEXTO} cut={cut} classe="sf-svg" fmt={fmt} />
          </div>
          <Regua pontos={pontos} />
        </div>
      ) : null}

      {/* A legenda em UMA linha. Eram quatro linhas de prosa, três delas descrevendo ausência —
          e a 8ª corrida registrou no log que é essa linha que engorda o bloco. O que saiu de
          prosa entrou no plot: o corte ganhou textura, e a semana parcial ganhou contorno. */}
      <ul className="sf-legenda">
        <li>
          <span className="sf-k sf-k-barra" aria-hidden /> impressões da semana
        </li>
        <li>
          <span className="sf-k sf-k-zero" aria-hidden /> zero <strong>medido</strong>
        </li>
        <li>
          <span className="sf-k sf-k-parcial" aria-hidden /> semana <strong>parcial</strong>, fora da leitura
        </li>
        {cut ? (
          <li>
            <span className="sf-k sf-k-depois" aria-hidden /> daqui em diante o slot{" "}
            <strong>soma os domínios declarados</strong>
          </li>
        ) : null}
      </ul>
    </figure>
  );
}

/** A série em tabela, por teclado.
 *
 *  `app/viz.tsx` afirmava num comentário que "a tabela-gêmea cobre teclado" desde a 2ª corrida. A
 *  única `<table>` da página é a de instrumentos, que não tem a série: os 37 valores só existiam
 *  no `<title>` do SVG, ou seja, no hover. Isto é o que aquele comentário prometia. */
export function SerieEmTabela({ pontos, fmt }: { pontos: WeekPoint[]; fmt: (v: number) => string }) {
  const medidas = pontos.filter((p) => p.value !== null).length;
  return (
    <details className="sf-tabela">
      <summary>
        Ver as {pontos.length} semanas em tabela ({medidas} medidas)
      </summary>
      <div className="tabela-rolavel" tabIndex={0}>
        <table>
          <caption className="foot">Impressões não-marca por semana ISO · fonte hub_gsc_dia</caption>
          <thead>
            <tr>
              <th scope="col">Semana</th>
              <th scope="col">Impressões não-marca</th>
            </tr>
          </thead>
          <tbody>
            {pontos.map((p) => (
              <tr key={`${p.start}-${p.end}`}>
                <th scope="row">
                  {fmtDay(p.start)}–{fmtDay(p.end)}
                </th>
                <td className="sf-td-num">
                  {p.value === null ? (
                    <span className="foot">parcial ou cruza a troca de site — fora da leitura</span>
                  ) : p.value === 0 ? (
                    <>0 — medido</>
                  ) : (
                    fmt(p.value)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
