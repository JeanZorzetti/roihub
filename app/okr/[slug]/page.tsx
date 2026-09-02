import { notFound } from "next/navigation";
import { listProjects } from "@/lib/projects";
import { montarFicha, posicaoDeAtaque, FAMILIAS } from "@/lib/okr.mjs";
import { projetar } from "@/lib/projecao.mjs";
import { acoesDoRanking } from "@/lib/agenda.mjs";
import { evaluateAll } from "@/lib/evaluate";
import { dbOn, listDone, listDonos, listDonoDatas } from "@/lib/db";
import { FIM, INICIO, HOJE, coletarLeadsDoHub, coletarDoProjeto } from "@/lib/okr-coleta";
import { montarNiveis } from "@/lib/ficha.mjs";
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
  "abandono-por-campo": "Abandono por campo",
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

export default async function FichaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const projects = await listProjects();
  const p = projects.find((x) => x.slug === slug);
  // A existência é conferida contra a lista COMPLETA (curados + repos do GitHub), não contra as
  // fichas curadas — projeto com perfil e sem curadoria abre a mesma página (contracts/rota-e-menu.md).
  if (!p) notFound();

  // ── T013a: a montagem, na ordem do contrato — coleta → montarFicha → posicaoDeAtaque → projetar → montarNiveis.
  const { porPipeline, erroLeads } = await coletarLeadsDoHub();
  const { cliques, leads, vendas, impressoes, orcamentos, orcamentosAceitos, ga4, orcamentosSemLead } = await coletarDoProjeto(p, { inicio: INICIO, fim: FIM, porPipeline, erroLeads });
  const ficha = montarFicha({ slug: p.slug, perfil: p.perfil, coletado: { cliques, leads, vendas, orcamentos, orcamentosAceitos } });
  const veredito = posicaoDeAtaque(ficha);
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
  // já dá cliques, lead-gravado da célula de leads, gateway-ligado do campo `vendas` do card.
  const disponiveisN5: Record<string, { valor: number } | { naoApurado: string }> = {
    impressoes,
    "lead-gravado": leads,
    "gateway-ligado": vendas,
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
        <h1 className="ficha-nome">{p.nome}</h1>
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

      {niveis.map((n) => (
        <section className="card ag-section" aria-labelledby={n.id} key={n.id}>
          <h2 className="eyebrow" id={n.id}>{n.titulo}</h2>
          {n.id === "N4" && n.nota && <p className="foot ficha-nota-n4">{n.nota}</p>}

          {n.id === "N3" && n.funil && n.funil.length > 0 && <FunilN3 segmentos={n.funil} />}

          {n.id === "N4" || n.id === "N5"
            ? (() => {
                const { avulsas, grupos } = agruparPorMotivo(n.celulas);
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
            : n.celulas.map((c, i) => <Linha key={i} c={c} />)}

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
      ))}
    </main>
  );
}
