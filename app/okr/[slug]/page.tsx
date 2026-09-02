import { notFound } from "next/navigation";
import { listProjects } from "@/lib/projects";
import { montarFicha, posicaoDeAtaque } from "@/lib/okr.mjs";
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
  | { estado: "nao-apurado"; rotulo: string; motivo: string; consultar: string };

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
  return (
    <span className="foot">
      não apurado — {c.motivo} · consultar: {c.consultar}
    </span>
  );
}

function Linha({ c }: { c: CelulaFicha }) {
  return (
    <p className="ficha-linha">
      <span className="ficha-rotulo">{c.rotulo}</span> <Cel c={c} />
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
  const { cliques, leads, vendas, impressoes } = await coletarDoProjeto(p, { inicio: INICIO, fim: FIM, porPipeline, erroLeads });
  const ficha = montarFicha({ slug: p.slug, perfil: p.perfil, coletado: { cliques, leads, vendas } });
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
  }) as Array<{
    id: string;
    titulo: string;
    celulas: CelulaFicha[];
    krs?: { kr: { kpi: string; dono?: string }; marca: string | null; texto: string }[];
    familia?: string | null;
    motivoFamilia?: string;
    itens?: { key: string; titulo: string; meta: string | null; dono: string | null; data: CelulaFicha; celulaQueMove: string }[];
  }>;

  return (
    <main className="page">
      <Tabs active="okr" okrSlug={slug} />

      <section className="card ag-section">
        <p className="eyebrow">OKR · ficha de {p.nome}</p>
        <h1>{p.nome}</h1>
        <p>
          Janela única para a árvore inteira (R7):{" "}
          <strong>
            {INICIO} → {FIM}
          </strong>{" "}
          — 28 dias fechando em D-3, o atraso do Search Console.
        </p>
      </section>

      {niveis.map((n) => (
        <section className="card ag-section" key={n.id}>
          <h2 className="eyebrow">{n.titulo}</h2>

          {n.celulas.map((c, i) => (
            <Linha key={i} c={c} />
          ))}

          {n.id === "N0" && n.krs && n.krs.length > 0 && (
            <ul className="ficha-krs">
              {n.krs.map((k, i) => (
                <li key={i}>
                  <strong>{k.kr.kpi}</strong>
                  {k.kr.dono && <span className="pill">{k.kr.dono}</span>}
                  {k.marca && <span className="pill pill-warn">{k.marca}</span>}
                  {k.texto && <div className="foot">{k.texto}</div>}
                </li>
              ))}
            </ul>
          )}

          {n.id === "N5" && "familia" in n && (
            <p className="foot">
              família: <strong>{n.familia ?? "nenhuma"}</strong> — {n.motivoFamilia}
            </p>
          )}

          {n.id === "N6" && n.itens && n.itens.length > 0 && (
            <ul className="ficha-krs">
              {n.itens.map((item) => (
                <li key={item.key}>
                  <strong>{item.titulo}</strong>
                  {item.meta && <span>{item.meta}</span>}
                  {item.dono ? <span className="pill">{item.dono}</span> : <span className="pill pill-warn">sem responsável</span>}
                  <div className="foot">
                    <Cel c={item.data} /> · célula que move: não declarada
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </main>
  );
}
