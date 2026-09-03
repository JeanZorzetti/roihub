import { notFound } from "next/navigation";
import { listProjects } from "@/lib/projects";
import { montarFicha, posicaoDeAtaque, FAMILIAS } from "@/lib/okr.mjs";
import { distanciaDoMercado, formatarRazao } from "@/lib/benchmark.mjs";
import { projetar } from "@/lib/projecao.mjs";
import { acoesDoRanking } from "@/lib/agenda.mjs";
import { evaluateAll } from "@/lib/evaluate";
import { dbOn, listDone, listDonos, listDonoDatas } from "@/lib/db";
import { FIM, INICIO, HOJE, coletarLeadsDoHub, coletarDoProjeto } from "@/lib/okr-coleta";
import { montarNiveis, medidoresDeEventos } from "@/lib/ficha.mjs";
import { canaisDoN4, razaoDoKr } from "@/lib/ficha-visual.mjs";
import { Projecao } from "../projecao";
import { Tabs } from "../../tabs";

// Igual à `/okr`: número de OKR vindo do build é número de outra janela, e a R7 pede UMA janela
// declarada para a árvore inteira (contracts/rota-e-menu.md).
export const dynamic = "force-dynamic";

type CelulaFicha =
  | { estado: "apurado"; valor: number | string; rotulo: string; fonte: string }
  | { estado: "declarado"; valor: number | string; rotulo: string; declaradoEm: string; oQue: string }
  | { estado: "nao-apurado"; rotulo: string; motivo: string; consultar: string }
  | { estado: "inferido"; valor: number; rotulo: string; de: string; divida: string };

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

/** O único caminho que imprime valor (FR-009). Sem `0`, sem `—`, sem célula em branco. */
function Cel({ c }: { c: CelulaFicha }) {
  if (c.estado === "apurado")
    return (
      <>
        <strong>{c.valor}</strong> <span className="foot">({c.fonte})</span>
      </>
    );
  if (c.estado === "declarado")
    return (
      <>
        <strong>{c.valor}</strong> <span className="foot">declarado em {c.declaradoEm}</span>
      </>
    );
  if (c.estado === "inferido")
    return (
      <span className="ficha-inferido">
        <strong>{c.valor}</strong> <span className="foot">inferido de {c.de} — dívida: {c.divida}</span>
      </span>
    );
  return (
    <span className="foot">
      não apurado — {c.motivo} · consultar: {c.consultar}
    </span>
  );
}

/** N4/N5 repetem o mesmo `motivo` em várias células "não apurado" (achado 4 do design-review: 9
 *  das 33 linhas da ficha). Agrupamento só de apresentação — `montarN4Nivel`/`montarN5` continuam
 *  devolvendo lista plana; célula apurada nunca entra num grupo. */
function agruparPorMotivo(celulas: CelulaFicha[]) {
  const avulsas: CelulaFicha[] = [];
  const porMotivo = new Map<string, Extract<CelulaFicha, { estado: "nao-apurado" }>[]>();
  for (const c of celulas) {
    if (c.estado !== "nao-apurado") {
      avulsas.push(c);
      continue;
    }
    const grupo = porMotivo.get(c.motivo) ?? [];
    grupo.push(c);
    porMotivo.set(c.motivo, grupo);
  }
  return { avulsas, grupos: [...porMotivo.values()] };
}

function Linha({ c }: { c: CelulaFicha }) {
  return (
    <p className="ficha-linha">
      <span className="ficha-rotulo">{ROTULOS_AMIGAVEIS[c.rotulo] ?? c.rotulo}</span> <Cel c={c} />
    </p>
  );
}

/** O funil de N3 (spec 012): um segmento por taxa, na mesma ordem das linhas de texto abaixo dele
 *  — decorativo (FR-008), sem `'use client'` nem estado (FR-007). `entrada`/`saida` já chegam em
 *  fração `0..1` de `segmentosDoFunil()`; aqui só a conversão para unidade de `viewBox` (× 44). */
function FunilN3({ segmentos }: { segmentos: { estado: string; entrada?: number; saida?: number }[] }) {
  const largura = 600 / segmentos.length;
  return (
    <svg className="ficha-funil" viewBox="0 0 600 96" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="n3-hachura" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" />
        </pattern>
      </defs>
      {segmentos.map((s, i) => {
        const x0 = i * largura + 4;
        const x1 = (i + 1) * largura - 4;
        if (s.estado === "apurado") {
          const e = s.entrada ?? 0;
          const sa = s.saida ?? 0;
          return <polygon key={i} points={`${x0},${48 - e * 44} ${x1},${48 - sa * 44} ${x1},${48 + sa * 44} ${x0},${48 + e * 44}`} />;
        }
        return <rect key={i} x={x0} y="4" width={x1 - x0} height="88" fill="url(#n3-hachura)" />;
      })}
    </svg>
  );
}

/** Os canais do N4: a MESMA `Linha` das demais células — `Cel` continua o único caminho que
 *  imprime valor (FR-009) — com um trilho embaixo. O trilho é `aria-hidden` porque o número está
 *  logo acima dele; ele não é um segundo caminho até o dado, é a comparação entre canais que a
 *  lista de texto não dá.
 *
 *  Um tom só: o comprimento já codifica a magnitude, sombrear por valor gastaria hue à toa.
 *  Canal sem fonte não ganha trilho — vazio ao lado de "não apurado" leria como zero medido. */
function CanaisN4({ canais }: { canais: { celula: CelulaFicha; fracao: number | null }[] }) {
  return (
    <div className="ficha-canais">
      {canais.map(({ celula, fracao }) => (
        <div key={celula.rotulo}>
          <Linha c={celula} />
          {fracao !== null && (
            <div className="ficha-barra-trilho" aria-hidden="true">
              <div className="ficha-barra-preenche" style={{ width: `${fracao * 100}%` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** O número que a página inteira existe para responder sai em corpo de figura, e não no mesmo
 *  15px de "Cliques no CTA". Só para célula APURADA — figura de valor declarado apresentaria
 *  declaração como medição, a linha que `Cel` existe para não deixar borrar. */
function HeroN1({ c }: { c: Extract<CelulaFicha, { estado: "apurado" }> }) {
  return (
    <p className="ficha-figura">
      <b>{c.valor}</b>
      <span>
        {ROTULOS_AMIGAVEIS[c.rotulo] ?? c.rotulo} <span className="foot">({c.fonte})</span>
      </span>
    </p>
  );
}

export default async function FichaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const projects = await listProjects();
  const p = projects.find((x) => x.slug === slug);
  // A existência é conferida contra a lista COMPLETA (curados + repos do GitHub), não contra as
  // fichas curadas — projeto com perfil e sem curadoria abre a mesma página (contracts/rota-e-menu.md).
  if (!p) notFound();

  // ── T013a: a montagem, na ordem do contrato — coleta → montarFicha → posicaoDeAtaque → projetar → montarNiveis.
  const { porPipeline, erroLeads } = await coletarLeadsDoHub();
  const { cliques, leads, vendas, impressoes, orcamentos, orcamentosAceitos, ga4, ga4ev, orcamentosSemLead } = await coletarDoProjeto(p, { inicio: INICIO, fim: FIM, porPipeline, erroLeads });
  const ficha = montarFicha({ slug: p.slug, perfil: p.perfil, coletado: { cliques, leads, vendas, orcamentos, orcamentosAceitos } });
  const veredito = posicaoDeAtaque(ficha);
  // O SEGUNDO veredito, e ele é PARALELO: a §7 manda por fato apurado, a régua só dimensiona.
  // Nada aqui realimenta `posicaoDeAtaque` — se um dia realimentar, a §7 passa a decidir por
  // benchmark, que é exatamente o que a R6 recusa.
  const mercado = distanciaDoMercado(ficha);
  const projecao = projetar({ ficha, meta: p.meta ?? null, hoje: HOJE });

  // ── N6 — a MESMA composição de app/agenda/page.tsx (FR-030, SC-018): a ordem de `evaluateAll()`
  // filtrada por `curated` é de onde sai o `#N · score`; passar `listProjects()` cru mudaria o
  // `meta` de todos os itens (o rótulo de ranking não é a ordem — já apagou ranking da tela antes).
  const on = dbOn();
  let itensAgenda: ReturnType<typeof acoesDoRanking> | null = null;
  let erroAgenda: string | null = null;
  let datasDono = new Map<string, string>();
  if (!on) {
    erroAgenda = "DATABASE_URL ausente";
  } else {
    try {
      const [curados, donos, doneSet, datas] = await Promise.all([
        evaluateAll().then((r) => r.filter((x) => x.curated)),
        listDonos().catch(() => new Map<string, string>()),
        listDone().catch(() => new Set<string>()),
        listDonoDatas().catch(() => new Map<string, string>()),
      ]);
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
    ...medidoresDeEventos(ga4ev),
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
    janela: { inicio: INICIO, fim: FIM },
    ga4,
    orcamentosSemLead,
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

  return (
    <main className="page">
      <Tabs active="okr" okrSlug={slug} />

      <section className="card ag-section">
        <p className="eyebrow">OKR · ficha de {p.nome}</p>
        <div className="hero-top okr-top">
          <h1 className="ficha-nome">{p.nome}</h1>
          <span className={veredito.posicao === 1 ? "pill pill-crit" : veredito.posicao === 2 ? "pill pill-warn" : "pill"}>
            {veredito.posicao ? `§7.${veredito.posicao} — ${veredito.rotulo}` : veredito.rotulo}
          </span>
        </div>
        {/* As três linhas abaixo e o bloco de projeção eram EXCLUSIVOS da lista: quem abria a ficha
            de um projeto via menos sobre ele do que quem passava os olhos na lista de 42. A pior
            ausência era a meta — `projetar()` rodava aqui e o resultado morria sem renderizar. */}
        {ficha.perfil && (
          <p className="foot">
            Perfil {ficha.perfil} — {ficha.perfilNome} · N1: {ficha.n1} · <code>{ficha.n2}</code>
          </p>
        )}
        <p>
          {veredito.celula && <strong>{veredito.celula}: </strong>}
          {veredito.motivo}
        </p>
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
        <Projecao meta={p.meta} p={projecao} />
        {n5?.familia && (
          <p className="ficha-veredito">
            A cadeia trava em{" "}
            <strong>
              {n5.familia} — {FAMILIAS[n5.familia as keyof typeof FAMILIAS]?.split(" — ")[0] ?? n5.familia}
            </strong>{" "}
            ({n5.motivoFamilia}).
          </p>
        )}
        <p>
          Janela única para a árvore inteira (R7):{" "}
          <strong>
            {INICIO} → {FIM}
          </strong>{" "}
          — 28 dias fechando em D-3, o atraso do Search Console.
        </p>
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

          {n.id === "N3" && n.funil && n.funil.length > 0 && <FunilN3 segmentos={n.funil} />}
          {n4 && <CanaisN4 canais={n4.canais} />}
          {heroN1 && <HeroN1 c={heroN1} />}

          {n.id === "N4" || n.id === "N5"
            ? (() => {
                const { avulsas, grupos } = agruparPorMotivo(n4 ? n4.resto : n.celulas);
                return (
                  <>
                    {avulsas.map((c, i) => (
                      <Linha key={`avulsa-${i}`} c={c} />
                    ))}
                    {grupos.map((grupo, i) =>
                      grupo.length > 1 ? (
                        <details key={`grupo-${i}`} className="ficha-linha">
                          <summary>
                            {grupo.length} não apurados — {grupo[0].motivo}:{" "}
                            {grupo.map((c) => ROTULOS_AMIGAVEIS[c.rotulo] ?? c.rotulo).join(", ")}
                          </summary>
                          {grupo.map((c, j) => (
                            <Linha key={j} c={c} />
                          ))}
                        </details>
                      ) : (
                        <Linha key={`grupo-${i}`} c={grupo[0]} />
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
                <details>
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
        </section>
        );
      })}
    </main>
  );
}
