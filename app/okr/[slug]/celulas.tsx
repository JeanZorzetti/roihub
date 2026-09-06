import { ehApurado, pct } from "@/lib/funil.mjs";
import type { CelulaFicha } from "@/lib/ficha-dados";
import { num } from "../projecao";

// A APRESENTAÇÃO da ficha, compartilhada pelas telas que a 019 separou: a ficha (/okr/[slug]) e
// o método (/okr/[slug]/metodo). Vivia dentro de page.tsx enquanto havia uma tela só; duas
// cópias divergiriam na primeira mudança de rótulo, e `Cel` é o ÚNICO caminho que imprime
// valor (FR-009) — ter dois seria abrir o segundo.
//
// Só apresentação: nenhuma regra mora aqui. Toda decisão continua em .mjs (Princípio III).
export type Marco = { chave: string; nome: string; celula: { valor: number } | { naoApurado: string }; fonte: string };
export type Taxa = { de: string; para: string; celula: { valor: number } | { naoApurado: string } };
export type Veredito = { posicao: number; celula: string | null };

/** Só apresentação — as chaves cruas continuam sendo o espaço de `n4:`/`n5:` que `validarKrs()`
 *  casa por igualdade exata (FR-017/R-017); não mexer nos catálogos de lib/ficha.mjs. */
export const ROTULOS_AMIGAVEIS: Record<string, string> = {
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
export const MARCAS_AMIGAVEIS: Record<string, string> = {
  "chave-invalida": "chave inválida",
  "nao-verificavel": "não verificável",
  "sem-dono": "sem dono",
  excedente: "excedente",
};

/** Glossário fixo da ficha — termos que se repetem em toda tela e nunca são definidos nela
 *  (achado 5 do design-review: §7.N, R7, D1-D4, CR(), âncora saíam sem tradução). Estático porque
 *  o vocabulário é do MÉTODO (handoff/okr-kpi-template.md), não do projeto. */
export const GLOSSARIO: { termo: string; def: string }[] = [
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
export const EH_FALHA_TRANSITORIA = /indispon[íi]vel/i;
// 018/FR-028, R2 do contrato rotulo-buraco.md — precedência: `c.rotuloBuraco` decide primeiro;
// SÓ na ausência dele a regex de hoje continua sendo o comportamento (fallback, nunca definição).
export const ehFalhaTransitoria = (c: { motivo: string; rotuloBuraco?: string }) =>
  c.rotuloBuraco ? c.rotuloBuraco === "falhou-agora" : EH_FALHA_TRANSITORIA.test(c.motivo);
export const rotuloExibicaoBuraco = (c: { motivo: string; rotuloBuraco?: string }) => (ehFalhaTransitoria(c) ? "falhou agora" : "não apurado");

// achado 4: mesmo número em 3 formatos na mesma tela — "R$ 4.000" no hero (app/okr/projecao.tsx),
// "4000" cru no N2 (esta célula), "0" sem cifrão no N1. Os dois rótulos abaixo são os ÚNICOS que
// carregam dinheiro fora do hero — `${ficha.n1} em R$` (lib/ficha.mjs:621/626, todo perfil) e
// "Valor do tratamento" (o único fator `tipo:"valor"` em lib/okr.mjs) — checado nos dois arquivos.
export const EH_ROTULO_MONETARIO = /em R\$$|^Valor do tratamento$/;
// `style: "currency"` e não `R$ ${…}` à mão (auditoria de 05/09): o padrão do `toLocaleString` é
// ATÉ 3 casas decimais, e a 018 trocou o ticket declarado (4000, inteiro) pelo apurado (uma
// MÉDIA) — a tela publicou `R$ 4.932,337`, que não é uma quantia que exista. Enquanto o valor foi
// digitado à mão o defeito não tinha como aparecer. Mesmo idioma de `app/crm/page.tsx:49`.
export const formatarCifra = (c: { valor: number | string; rotulo: string }) =>
  typeof c.valor === "number" && EH_ROTULO_MONETARIO.test(c.rotulo)
    ? c.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : c.valor;

/** O único caminho que imprime valor (FR-009). Sem `0`, sem `—`, sem célula em branco. */
export function Cel({ c }: { c: CelulaFicha }) {
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
export function agruparPorMotivo(celulas: CelulaFicha[]) {
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
export function Linha({ c }: { c: CelulaFicha }) {
  return (
    <div className={`ficha-linha cel-${c.estado}`}>
      <span className="ficha-rotulo">{ROTULOS_AMIGAVEIS[c.rotulo] ?? c.rotulo}</span> <Cel c={c} />
    </div>
  );
}

/** Acha o nó (marco zerado/buraco) ou a aresta (menor taxa) que `posicaoDeAtaque()` já escolheu,
 *  para o diagrama de cadeia apontar exatamente para a MESMA célula do veredito de texto — nunca
 *  uma leitura visual paralela e potencialmente divergente (R1: um veredito só, várias vitrines). */
export function indiceTrava(marcos: Marco[], taxas: Taxa[], veredito: Veredito): { tipo: "no" | "aresta"; indice: number } | null {
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
export function CadeiaDiagrama({ marcos, taxas, veredito, janela }: { marcos: Marco[]; taxas: Taxa[]; veredito: Veredito; janela: { inicio: string; fim: string } }) {
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
export function CanaisN4({ canais }: { canais: { celula: CelulaFicha; fracao: number | null }[] }) {
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
export function HeroN1({ c, necessario }: { c: Extract<CelulaFicha, { estado: "apurado" }>; necessario: number | null }) {
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
