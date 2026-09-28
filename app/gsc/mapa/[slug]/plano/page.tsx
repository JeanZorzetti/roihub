import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { projetosDeBusca } from "@/lib/projects";
import { hostsDeclarados } from "@/lib/projects.mjs";
import { gscPaginas } from "@/lib/gsc";
import { descoberta } from "@/lib/janelas.mjs";
import { ALAVANCAS, ORIGEM, REGRAS, metaTexto } from "@/lib/proxima-acao.mjs";
import { CABECALHOS, PISO_VOLUME, kpisDoBoard, metasExigidas, nomeDe, normalizar, vistaDoPlano } from "@/lib/plano.mjs";
import { RESPONSAVEIS, rotuloResp } from "@/lib/agenda.mjs";
import { Tabs } from "../../../../tabs";
import { aprovarPropostas, ativar, criarVersao, decidirMeta, salvarPremissas } from "./actions";
import { dadosDoPlano } from "./dados";

// Reads the database and the Search Console on open, like the map.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = (await projetosDeBusca()).find((x) => x.slug === slug);
  return { title: `Plano de SEO — ${p?.nome.split(" — ")[0].replace(/\s*\([^)]*$/, "") ?? slug}` };
}

type Regra = { op: string; limiar: number; unidade: string; origem: keyof typeof ORIGEM };
const REGRAS_ = REGRAS as unknown as Record<string, Regra | null>;
const FRACAO = new Set(["top20", "tamBusca", "pagina1"]);
const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const br = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const primeiroNome = (id: string) => rotuloResp(id).split(" ")[0];

/** A value in the unit its leaf is read in: fractions as %, headlines per month, rules by their unit. */
function fmt(chave: string, v: number): string {
  if (FRACAO.has(chave)) return pct(v);
  if (chave === "cliques") return `${br(v)} cliques/mês`;
  if (chave === "impressoes") return `${br(v)} impressões/mês`;
  if (chave === "paginas") return `${br(v)} ${v === 1 ? "página nova" : "páginas novas"}`;
  const r = REGRAS_[chave];
  if (r?.unidade === "%") return pct(v);
  if (r?.unidade === "ms") return `${br(v)} ms`;
  return br(v);
}

/** The meta as a sentence: demand metas are floors ("≥"), REGRAS leaves print their own rule text. */
function metaEmTexto(m: { chave: string; valor: number }, regra: Regra | null): string {
  if (regra) return metaTexto(regra);
  return `≥ ${fmt(m.chave, m.valor)}`;
}

const SELO_DEMANDA = "◇ demanda do nicho";
const caminho = (url: string) => {
  try {
    return decodeURIComponent(new URL(url).pathname);
  } catch {
    return url;
  }
};
const seloDe = (origem: string) => (origem === "demanda" ? SELO_DEMANDA : ORIGEM[origem as keyof typeof ORIGEM]);

/**
 * 058: this screen only speaks of the future (FR-001). Every block renders from `vistaDoPlano`, the one
 * object the SC-001 test walks; the starting point, the page states and the marks live on the map.
 */
export default async function PlanoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = (await projetosDeBusca()).find((x) => x.slug === slug);
  if (!p) notFound();
  // The card name may carry an open parenthesis before " — " ("Tapepro (fitas adesivas — …)").
  const nomeCurto = p.nome.split(" — ")[0].replace(/\s*\([^)]*$/, "");

  // FR-007: the only external read. The page impressions decide, with the stored per-URL verdict,
  // which week each existing page's task goes in (FR-002). No per-term read: the starting point is on the map.
  const paginasGsc = await gscPaginas(hostsDeclarados(p), descoberta());
  const d = await dadosDoPlano(slug, null, { paginas: paginasGsc });
  const { atual, montado, demanda } = d;
  const v = vistaDoPlano({ propostas: d.propostas, decisoes: d.decisoes, montado, planos: d.planos, clusters: d.clusters, marcas: d.marcas, hoje: d.hoje, semanaAtual: d.semanaAtual, inicio: d.inicio });
  const rascunho = atual?.estado === "rascunho";
  const podeGravar = d.falhas.length === 0;
  const faltam = rascunho ? v.faltam : null;
  const semana = v.semanas.find((s) => s.n === d.semanaAtual) ?? null;
  const proxima = v.semanas.find((s) => s.n > d.semanaAtual && s.tarefas.length) ?? null;
  const proc = demanda?.procedencia as Record<string, unknown> | undefined;
  const consultadoEm = typeof proc?.consultadoEm === "string" ? proc.consultadoEm.slice(0, 10) : typeof proc?.congeladoEm === "string" ? proc.congeladoEm : null;
  const idadeDias = consultadoEm ? Math.floor((Date.parse(`${d.hoje}T12:00:00Z`) - Date.parse(`${consultadoEm}T12:00:00Z`)) / 864e5) : null;
  const versoes = [v.versoes.ativo ? `Versão ${v.versoes.ativo} ativa` : null, v.versoes.rascunho ? `versão ${v.versoes.rascunho} em rascunho` : null].filter(Boolean).join(" · ");

  // Block 1 — everything that makes the rest unreadable comes first (FR-018), phrased as consequence.
  const avisos: string[] = [
    ...d.falhas,
    ...(!demanda
      ? [`Sem demanda congelada para este projeto. Rode \`node --env-file=.env scripts/consultar-demanda.mjs ${slug}\` para ver saldo e custo, depois com \`--consultar --gravar\`.`]
      : []),
    ...(demanda && !demanda.produtos.length
      ? ["O projeto não declara produtos em lib/autopublish-projects.mjs: todos os termos ficam sem cluster e nenhuma página de cluster é agendada."]
      : []),
    ...(idadeDias !== null && idadeDias > 90 ? [`A demanda foi consultada há ${idadeDias} dias (${dm(consultadoEm!)}): vale consultar de novo antes de uma nova versão.`] : []),
    ...v.avisos,
  ];

  const kpis = kpisDoBoard();
  type Meta = (typeof v.metas)[number];
  const porChave = new Map<string, Meta[]>();
  for (const m of v.metas) porChave.set(m.chave, [...(porChave.get(m.chave) ?? []), m]);

  const linhaDaMeta = (m: Meta) => {
    const regra = REGRAS_[m.chave] && !["top20", "tamBusca"].includes(m.chave) ? REGRAS_[m.chave] : null;
    const nome = nomeDe(m.chave);
    const id = `${m.chave}-${m.prazo}`;
    if (m.valor === null)
      return (
        <li key={id}>
          <strong>{nome}</strong> · {m.prazo} dias · ∅ sem meta: {m.ausente}
        </li>
      );
    // FR-006: the state in words; who decided and when stay in the database.
    const estado =
      m.estado === "proposta"
        ? "proposta · sem decisão"
        : m.estado === "aprovada"
          ? "aprovada"
          : m.estado === "editada"
            ? `editada: ${fmt(m.chave, m.valorFinal!)} (proposta ${fmt(m.chave, m.valor)})`
            : "recusada: fora do plano";
    const naoCabe = v.naoCabe.find((x) => x.chave === m.chave && x.prazo === m.prazo);
    return (
      <li key={id}>
        <span className="mapa-fila-alvo">
          <strong>{nome}</strong> · {m.prazo} dias · meta {metaEmTexto(m as { chave: string; valor: number }, regra)}
        </span>
        <span className="mb-tag">{seloDe(m.origem)}</span>
        <span className="mapa-marca">{estado}</span>
        <span className="mapa-fila-det">{m.conta}</span>
        {m.aviso ? <span className="mapa-fila-det">⚠ {m.aviso}</span> : null}
        {naoCabe ? <span className="mapa-fila-det">⚠ {naoCabe.texto}</span> : null}
        {rascunho && podeGravar ? (
          <form action={decidirMeta} className="mapa-marca-form">
            <input type="hidden" name="projeto" value={slug} />
            <input type="hidden" name="versao" value={atual!.versao} />
            <input type="hidden" name="chave" value={m.chave} />
            <input type="hidden" name="prazo" value={m.prazo} />
            <input type="hidden" name="origem" value={m.origem} />
            <input type="hidden" name="proposto" value={String(m.valor)} />
            <input type="hidden" name="conta" value={m.conta.slice(0, 2000)} />
            <fieldset>
              <legend>Decidir</legend>
              <label htmlFor={`quem-${id}`}>quem</label>
              <select id={`quem-${id}`} name="responsavel" defaultValue={atual!.criadoPor}>
                {(RESPONSAVEIS as { id: string; label: string }[]).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label.split(" ")[0]}
                  </option>
                ))}
              </select>
              <button name="estado" value="aprovada" className="ag-dono-b" aria-label={`Aprovar a meta proposta: ${nome}, ${m.prazo} dias`}>
                Aprovar
              </button>
              <label htmlFor={`valor-${id}`}>outro valor{FRACAO.has(m.chave) || regra?.unidade === "%" ? " (fração: 0.6 = 60%)" : ""}</label>
              <input id={`valor-${id}`} type="number" step="any" name="valor" defaultValue={m.valorFinal ?? m.valor} className="plano-valor" />
              <button name="estado" value="editada" className="ag-dono-b" aria-label={`Aprovar com outro valor: ${nome}, ${m.prazo} dias`}>
                Aprovar com outro valor
              </button>
              <button name="estado" value="recusada" className="ag-dono-b" aria-label={`Recusar a meta: ${nome}, ${m.prazo} dias`}>
                Recusar
              </button>
            </fieldset>
          </form>
        ) : null}
      </li>
    );
  };

  const formPremissas = (acao: typeof salvarPremissas, rotulo: string, versao?: number) => (
    <form action={acao} className="plano-premissas">
      <input type="hidden" name="projeto" value={slug} />
      {versao ? <input type="hidden" name="versao" value={versao} /> : null}
      <fieldset>
        <legend>{rotulo}</legend>
        <label>
          início (a segunda-feira da semana)
          <input type="date" name="inicio" defaultValue={d.inicio} required />
        </label>
        <label>
          páginas novas por semana
          <input type="number" name="capacidade" min={0} max={20} step={1} defaultValue={d.premissas.capacidade} required />
        </label>
        <label>
          semanas até indexar
          <input type="number" name="semanasAteIndexar" min={0} max={26} step={1} defaultValue={d.premissas.semanasAteIndexar} required />
        </label>
        <label>
          semanas até a posição estabilizar
          <input type="number" name="semanasAteEstabilizar" min={0} max={26} step={1} defaultValue={d.premissas.semanasAteEstabilizar} required />
        </label>
        <label>
          piso da página de apoio (buscas/mês)
          <input type="number" name="pisoApoio" min={1} max={100000} step={1} defaultValue={d.premissas.pisoApoio} required />
        </label>
        <label>
          quem executa
          <select name="responsavel" defaultValue={atual?.criadoPor ?? "jean"}>
            {(RESPONSAVEIS as { id: string; label: string }[]).map((r) => (
              <option key={r.id} value={r.id}>
                {r.label.split(" ")[0]}
              </option>
            ))}
          </select>
        </label>
        <button className="ag-dono-b">{rotulo}</button>
      </fieldset>
    </form>
  );

  type SemanaV = (typeof v.semanas)[number];
  const tarefasDa = (s: SemanaV) =>
    s.tarefas.length ? (
      <ul className="mapa-acao-motivos">
        {s.tarefas.map((t) => (
          <li key={t.alavanca}>
            <strong>{ALAVANCAS[t.alavanca as keyof typeof ALAVANCAS].acao}</strong>: {t.alvos.map((a) => (a.startsWith("http") ? caminho(a) : a)).join(", ")}
            {t.responsavel ? ` · ${primeiroNome(t.responsavel)}` : ""}
            <span className="mapa-fila-det">Move: {t.kpis.map(nomeDe).join(", ")}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="mapa-degrau-vazio">
        Nada mais planejado para esta semana.{proxima ? ` A próxima tarefa é da semana ${proxima.n}, a partir de ${dm(proxima.inicio)}.` : " Nenhuma semana adiante tem tarefa."}
      </p>
    );
  const marcosDa = (s: SemanaV) => {
    const pares = Object.entries(s.marcos);
    if (!pares.length) return null;
    return (
      <span className="mapa-fila-det">
        Marcos:{" "}
        {pares.map(([k, x]) => `${nomeDe(k)} ${x === null ? "○ marco não chegou" : fmt(k, x)}`).join(" · ")}
      </span>
    );
  };

  // Consecutive weeks with no task and the same milestones read as one row: 26 identical rows hide the
  // weeks where something changes. The current week always stands alone.
  const blocos: { s: SemanaV; ate: SemanaV | null }[] = [];
  for (const s of v.semanas) {
    const ultimo = blocos[blocos.length - 1];
    const quieta = (x: SemanaV) => !x.tarefas.length && x.n !== d.semanaAtual;
    if (ultimo && quieta(s) && quieta(ultimo.s) && JSON.stringify(s.marcos) === JSON.stringify(ultimo.s.marcos)) ultimo.ate = s;
    else blocos.push({ s, ate: null });
  }

  return (
    <main className="page">
      <Tabs active="gsc" />
      <section className="card ag-section" data-info="gsc">
        <p className="eyebrow">
          <a href={`/gsc/mapa/${slug}`}>Mapa de {nomeCurto}</a> · plano de SEO
        </p>
        <h1 className="ficha-nome">Plano de SEO de {nomeCurto}: o que fazer esta semana e onde chegar em 90 e 180 dias</h1>
        <p className="foot">
          {versoes || "Prévia com as premissas padrão: nenhuma versão criada."} Onde o projeto está hoje (ponto de partida, estado das páginas, marcas de feito) fica no{" "}
          <a href={`/gsc/mapa/${slug}#mapa-plano-h`}>mapa</a>.
        </p>

        {avisos.length ? (
          <div className="plano-aviso" role="note" aria-label="Avisos do plano">
            <ul>
              {avisos.map((a) => (
                <li key={a}>⚠ {a}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <section className="ficha-bloco" aria-labelledby="plano-agora-h">
          <h2 className="ficha-bloco-h" id="plano-agora-h">
            Esta semana
          </h2>
          {!montado ? (
            <p className="mapa-degrau-vazio">∅ sem calendário: falta a demanda congelada (aviso acima).</p>
          ) : v.comecaEm ? (
            <p className="mapa-degrau-vazio">O plano começa em {dm(v.comecaEm)}.</p>
          ) : !semana ? (
            <p className="mapa-degrau-vazio">O plano terminou: a semana {d.semanas} foi a última. Crie uma nova versão.</p>
          ) : (
            <>
              <p className="mapa-n1-resposta">
                Semana {semana.n} de {d.semanas}, a partir de {dm(semana.inicio)}
              </p>
              {tarefasDa(semana)}
              {marcosDa(semana)}
            </>
          )}
        </section>

        <section className="ficha-bloco" aria-labelledby="plano-metas-h">
          <h2 className="ficha-bloco-h" id="plano-metas-h">
            Metas: {metasExigidas().length} com prazo, agrupadas nos {kpis.length} KPIs do board
          </h2>
          <p className="foot">
            Cada meta diz de onde veio: {SELO_DEMANDA} (volume de busca e as premissas abaixo), {ORIGEM.regua}, {ORIGEM.norma}, {ORIGEM.meta} ou {ORIGEM.politica}. As metas que não vêm da demanda
            são o limiar da regra do mapa, escrito uma vez só.{" "}
            {atual
              ? rascunho
                ? faltam
                  ? `Faltam ${faltam} ${faltam === 1 ? "meta" : "metas"} sem decisão para ativar a versão ${atual.versao}.`
                  : `Todas as metas da versão ${atual.versao} têm decisão.`
                : `Para mudar uma meta da versão ${atual.versao}, crie uma nova versão (abaixo, em Premissas).`
              : "Crie a versão 1 (abaixo, em Premissas) para aprovar, editar ou recusar cada meta."}
          </p>
          {rascunho && podeGravar && faltam ? (
            <form action={aprovarPropostas} className="mapa-marca-form">
              <input type="hidden" name="projeto" value={slug} />
              <input type="hidden" name="versao" value={atual!.versao} />
              <input
                type="hidden"
                name="metas"
                value={JSON.stringify(
                  v.metas
                    .filter((m) => m.valor !== null && m.estado === "proposta")
                    .map((m) => ({ chave: m.chave, prazo: m.prazo, origem: m.origem, proposto: m.valor, conta: m.conta.slice(0, 2000) })),
                )}
              />
              <fieldset>
                <legend>Aprovar as {faltam} propostas sem decisão, como estão</legend>
                <label htmlFor="quem-todas">quem</label>
                <select id="quem-todas" name="responsavel" defaultValue={atual!.criadoPor}>
                  {(RESPONSAVEIS as { id: string; label: string }[]).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label.split(" ")[0]}
                    </option>
                  ))}
                </select>
                <button className="ag-dono-b">Aprovar as {faltam} propostas</button>
              </fieldset>
            </form>
          ) : null}
          {rascunho && podeGravar && faltam === 0 ? (
            <form action={ativar} className="mapa-marca-form">
              <input type="hidden" name="projeto" value={slug} />
              <input type="hidden" name="versao" value={atual!.versao} />
              <button className="ag-dono-b">Ativar a versão {atual!.versao}</button>
            </form>
          ) : null}
          <div className="mapa-fila">
            <h3 className="mapa-fila-h">Projeções de cabeçalho · nenhuma folha do mapa conta estes números</h3>
            <ol className="mapa-fila-lista">{CABECALHOS.flatMap((k) => porChave.get(k) ?? []).map(linhaDaMeta)}</ol>
          </div>
          {kpis.map((k) => (
            <div className="mapa-fila" key={k.id}>
              <h3 className="mapa-fila-h">
                {k.ramo.toUpperCase()} · {k.nome}
              </h3>
              <ol className="mapa-fila-lista">{k.folhas.flatMap((f) => porChave.get(f) ?? []).map(linhaDaMeta)}</ol>
            </div>
          ))}
        </section>

        <section className="ficha-bloco" aria-labelledby="plano-cal-h">
          <h2 className="ficha-bloco-h" id="plano-cal-h">
            Calendário: {v.semanas.length ? `semanas ${v.semanas[0].n} a ${d.semanas}` : `${d.semanas} semanas`}
          </h2>
          {montado ? (
            v.semanas.length ? (
              <ol className="plano-semanas">
                {blocos.map(({ s, ate }) => (
                  <li key={s.n} className={s.n === d.semanaAtual ? "plano-agora" : undefined} aria-current={s.n === d.semanaAtual ? "date" : undefined}>
                    <strong>
                      {ate ? `Semanas ${s.n} a ${ate.n} · ${dm(s.inicio)} a ${dm(ate.inicio)}` : `Semana ${s.n} · ${dm(s.inicio)}`}
                      {s.n === d.semanaAtual ? " · esta semana" : ""}
                    </strong>
                    {s.tarefas.length ? tarefasDa(s) : <span className="mapa-fila-det">sem tarefa nova{ate ? ", marcos iguais" : ""}</span>}
                    {marcosDa(s)}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mapa-degrau-vazio">Nenhuma semana adiante: o plano terminou. Crie uma nova versão.</p>
            )
          ) : (
            <p className="mapa-degrau-vazio">∅ sem calendário: falta a demanda congelada.</p>
          )}
        </section>

        <section className="ficha-bloco" aria-labelledby="plano-demanda-h">
          <h2 className="ficha-bloco-h" id="plano-demanda-h">
            Demanda
          </h2>
          {!demanda ? (
            <p className="mapa-degrau-vazio">∅ sem demanda congelada para {nomeCurto}.</p>
          ) : (
            <>
              <p className="foot">
                {demanda.paga
                  ? `Volume mensal do Google Ads (DataForSEO), ${String(proc?.regiao ?? "")}, idioma ${String(proc?.idioma ?? "")}, consultado em ${consultadoEm ? dm(consultadoEm) + "/" + consultadoEm.slice(0, 4) : "?"} por US$ ${String(proc?.custoUsd ?? "?")}.`
                  : `Piso de impressões do Search Console (estimativa da 050, congelada em ${consultadoEm ?? "?"}): não é volume de mercado, e a demanda real é maior.`}{" "}
                Total: {br(v.clusters.reduce((a, c) => a + c.volume, 0) + d.semCluster.reduce((a, t) => a + (t.volume ?? 0), 0))} buscas/mês em{" "}
                {br(v.clusters.reduce((a, c) => a + c.termos.length, 0) + d.semCluster.length)} termos.{" "}
                {d.crawl ? "" : "Sem crawl gravado ainda: todo cluster aparece sem página. "}
                Um termo só conta para a página que tem todas as palavras dele no título ou no H1; uma página existente com tarefa conta a partir da semana em que a tarefa for feita. Para mover ou tirar
                um termo, rode de novo com <code>--mover &quot;termo=semente&quot;</code> ou <code>--excluir &quot;termo:motivo&quot;</code>: a lista congelada é a que conta.
              </p>
              <ul className="mapa-acao-motivos">
                {v.clusters.map((c) => (
                  <li key={c.semente}>
                    <strong>{c.semente.replaceAll("-", " ")}</strong> · {c.termos.length} {c.termos.length === 1 ? "termo" : "termos"} · {br(c.volume)} buscas/mês ·{" "}
                    {c.pagina ? <a href={c.pagina}>{caminho(c.pagina)}</a> : "sem página"}
                    {Object.keys(c.segmentos).length ? ` · segmentos: ${Object.entries(c.segmentos).map(([s, x]) => `${s} ${br(x)}`).join(", ")}` : " · nenhum termo com segmento"}
                    {/* D14: a page counts only the terms whose words are all in its title or its H1. */}
                    {Object.entries(Object.groupBy(c.termos.filter((t) => t.cobertoPor), (t) => t.cobertoPor!)).map(([url, ts]) => (
                      <span className="mapa-fila-det" key={url}>
                        {caminho(url)} cobre pelo título ou H1 {ts!.length} {ts!.length === 1 ? "termo" : "termos"}, {br(ts!.reduce((a, t) => a + (t.volume ?? 0), 0))} buscas/mês:{" "}
                        {ts!.map((t) => t.termo).join(" · ")}
                      </span>
                    ))}
                    {c.termos.some((t) => !t.cobertoPor) ? (
                      <span className="mapa-fila-det">
                        Sem página que cubra:{" "}
                        {c.termos
                          .filter((t) => !t.cobertoPor)
                          .slice(0, 20)
                          .map((t) => {
                            const vol = t.volume === null ? "(volume abaixo do mínimo reportado)" : br(t.volume);
                            const acima = t.volume !== null && t.volume >= d.premissas.pisoApoio;
                            const marca = !acima
                              ? ""
                              : c.pagina && normalizar(t.termo) === normalizar(c.semente)
                                ? " ◇ vai para o título da página existente"
                                : " ◇ candidata a página de apoio";
                            return `${t.termo} ${vol}${marca}`;
                          })
                          .join(" · ")}
                        {c.termos.filter((t) => !t.cobertoPor).length > 20 ? ` · e mais ${c.termos.filter((t) => !t.cobertoPor).length - 20}` : ""}
                      </span>
                    ) : null}
                  </li>
                ))}
                {d.semCluster.length ? (
                  <li>
                    <strong>sem cluster</strong> · {d.semCluster.length} termos, fora das metas de página
                    <span className="mapa-fila-det">
                      {d.semCluster.slice(0, 20).map((t) => `${t.termo} ${t.volume === null ? "(abaixo do mínimo)" : br(t.volume)}`).join(" · ")}
                      {d.semCluster.length > 20 ? ` · e mais ${d.semCluster.length - 20}` : ""}
                    </span>
                  </li>
                ) : null}
              </ul>
              {proc?.excluidos && Object.keys(proc.excluidos as object).length ? (
                <p className="foot">
                  Excluídos na curadoria:{" "}
                  {Object.entries(proc.excluidos as Record<string, string>)
                    .map(([t, m]) => `«${t}» (${m})`)
                    .join("; ")}
                  . Termos abaixo de {PISO_VOLUME} buscas/mês e de marca ficam fora antes disso.
                </p>
              ) : null}
            </>
          )}
        </section>

        <section className="ficha-bloco" aria-labelledby="plano-premissas-h">
          <h2 className="ficha-bloco-h" id="plano-premissas-h">
            Premissas <span className="mb-tag">{ORIGEM.politica}</span>
          </h2>
          <p className="foot">
            {d.premissas.capacidade} páginas novas por semana · {d.premissas.semanasAteIndexar} semanas até indexar · {d.premissas.semanasAteEstabilizar} semanas até a posição estabilizar ·
            termo com {br(d.premissas.pisoApoio)} buscas/mês ou mais, sem página que o cubra, vira página de apoio. Estimativas do dono, sem fonte: a própria {nomeCurto} refina com o que medir.
          </p>
          {podeGravar
            ? rascunho
              ? formPremissas(salvarPremissas, `Salvar premissas da versão ${atual!.versao}`, atual!.versao)
              : formPremissas(criarVersao, atual ? `Criar a versão ${atual.versao + 1}` : "Criar a versão 1")
            : null}
          <p className="foot">
            Abrir esta página não consulta volume de busca. A única leitura externa é a de impressões por página do Search Console: ela decide em que semana entra a tarefa de cada página
            existente.
          </p>
        </section>
      </section>
    </main>
  );
}
