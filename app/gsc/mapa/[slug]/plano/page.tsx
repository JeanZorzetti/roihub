import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { projetosDeBusca } from "@/lib/projects";
import { hostsDeclarados } from "@/lib/projects.mjs";
import { gscPaginas } from "@/lib/gsc";
import { descoberta } from "@/lib/janelas.mjs";
import { ALAVANCAS, ORIGEM, REGRAS, metaTexto } from "@/lib/proxima-acao.mjs";
import { CABECALHOS, ESFORCO_PADRAO, INTENCOES, PISO_VOLUME, QUEM_FAZ, TIPOS_DE_ENTIDADE, kpisDoBoard, metasExigidas, nomeDe, normalizar, segundaDe, vistaDoPlano } from "@/lib/plano.mjs";
import { RESPONSAVEIS, rotuloResp } from "@/lib/agenda.mjs";
import { Tabs } from "../../../../tabs";
import { apontarPagina, aprovarPropostas, ativar, criarVersao, decidirIntencao, decidirItem, decidirMeta, editarTarefa, salvarPremissas } from "./actions";
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
  const d = await dadosDoPlano(slug, null, { paginas: paginasGsc, comOkr: { temMeta: Boolean(p.meta?.valor) } });
  const { atual, montado, demanda } = d;
  const v = vistaDoPlano({ propostas: d.propostas, decisoes: d.decisoes, montado, planos: d.planos, clusters: d.clusters, backlog: d.backlog, semanaAtual: d.semanaAtual, inicio: d.inicio });
  const lidosEm = d.disparosLidosEm ? `${dm(d.disparosLidosEm.slice(0, 10))} ${d.disparosLidosEm.slice(11, 16)}` : null;
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
    // Capacity 0 empties every week of new pages: it goes before anything else the plan says (057 FR-018).
    ...v.avisos.filter((a) => a.startsWith("Capacidade 0")),
    ...d.avisosDoBacklog,
    ...v.avisos.filter((a) => !a.startsWith("Capacidade 0")),
  ];

  const kpis = kpisDoBoard();
  type Meta = (typeof v.metas)[number];
  const porChave = new Map<string, Meta[]>();
  for (const m of v.metas) porChave.set(m.chave, [...(porChave.get(m.chave) ?? []), m]);

  // 058 US4 — does the plan deliver the clicks the OKR asks for? One line, never an invented number (D14).
  const inteiro = (x: number) => Math.round(x).toLocaleString("pt-BR");
  const faixa = (b: { min: number; max: number }, f: (x: number) => string) => (f(b.min) === f(b.max) ? f(b.min) : `${f(b.min)} a ${f(b.max)}`);
  const linhaDoOkrEmTexto = (o: NonNullable<typeof d.okr>) =>
    "falhou" in o ? (
      `O OKR não respondeu: ${o.falhou}.`
    ) : "semComparacao" in o ? (
      o.semComparacao.startsWith("a meta de cliques") ? `${o.semComparacao.charAt(0).toUpperCase()}${o.semComparacao.slice(1)}.` : `O OKR de ${nomeCurto} não exige cliques ainda: ${o.semComparacao}.`
    ) : (
      <>
        O <a href={`/okr/${slug}`}>OKR de {nomeCurto}</a> exige {faixa(o.necessario, inteiro)} cliques por 28 dias ({faixa(o.necessarioMes, inteiro)} por mês); o plano projeta{" "}
        {inteiro(o.plano)} por mês aos 180 dias: cobre {faixa(o.fracao, pct)} do exigido.
      </>
    );
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
        {m.chave === "cliques" && m.prazo === 180 && d.okr ? <span className="mapa-fila-det">{linhaDoOkrEmTexto(d.okr)}</span> : null}
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
          quem responde por padrão
          <select name="responsavel" defaultValue={atual?.criadoPor ?? "jean"}>
            {(RESPONSAVEIS as { id: string; label: string }[]).map((r) => (
              <option key={r.id} value={r.id}>
                {r.label.split(" ")[0]}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      {/* D10: the owner's minutes only order the backlog; they never move a task to another week. */}
      <fieldset className="plano-minutos">
        <legend>Seus minutos por tarefa, de 1 a 600: só ordenam o backlog</legend>
        {(Object.keys(ESFORCO_PADRAO) as (keyof typeof ESFORCO_PADRAO)[]).map((k) => (
          <label key={k}>
            <span>
              {k === "pergunta" ? "responder uma pergunta" : k === "cobertura" ? "criar uma página nova" : ALAVANCAS[k].curta} · <small>{QUEM_FAZ[k]}</small>
            </span>
            <input type="number" name={`esforco.${k}`} min={1} max={600} step={1} defaultValue={d.premissas.esforco?.[k] ?? ESFORCO_PADRAO[k]} required />
          </label>
        ))}
      </fieldset>
      <button className="ag-dono-b">{rotulo}</button>
    </form>
  );

  // 058 US3 — the backlog, in D7 order, as the owner reads it. Every state is a word (FR-041).
  type TarefaV = (typeof v.backlog)[number];
  const ORIGEM_DA_TAREFA: Record<string, string> = { "pagina-nova": "página nova do plano", "pagina-existente": "página existente", mapa: "card do mapa", pergunta: "pergunta do núcleo" };
  const nomeDaTarefa = (t: TarefaV) => `${ALAVANCAS[t.alavanca as keyof typeof ALAVANCAS].curta} · ${t.alvo.rotulo}`;
  const impactoEm = (t: TarefaV) => ("cliques" in t.impacto ? `${br(t.impacto.cliques)} cliques/mês` : `não calculável: ${t.impacto.naoCalculavel}`);
  const prazoDe = (t: TarefaV) => (t.semana === null ? "sem semana" : `semana ${t.semana} · ${dm(v.semanas.find((s) => s.n === t.semana)?.inicio ?? d.inicio)}${t.prazoFixo ? " (data fixada)" : ""}`);
  const estadoDe = (t: TarefaV) =>
    t.estado === "agendada" ? `agendada${t.motivo ? `: ${t.motivo}` : ""}` : `${t.estado === "a-fazer" ? "a fazer" : "bloqueada"}: ${t.motivo ?? "sem motivo registrado"}`;
  const segundaDeHoje = segundaDe(d.hoje)!;
  const linhaDoBacklog = (t: TarefaV, i: number) => {
    const id = `tarefa-${i}`;
    return [
      <tr key={t.chave}>
        <td className="plano-bl-n">{i + 1}</td>
        <td className="plano-bl-tarefa">{nomeDaTarefa(t)}</td>
        <td className="plano-bl-num" data-rotulo="impacto">
          {impactoEm(t)}
        </td>
        <td className="plano-bl-num" data-rotulo="esforço">
          {t.esforco.minutos} min{t.esforco.editado ? " · ajustado" : ""}
        </td>
        <td data-rotulo="responsável">
          {primeiroNome(t.responsavel.id)}
          {t.responsavel.editado ? " · ajustado" : ""}
        </td>
        <td className="plano-bl-num" data-rotulo="prazo">
          {prazoDe(t)}
        </td>
        <td data-rotulo="estado">{estadoDe(t)}</td>
      </tr>,
      <tr key={`${t.chave}-det`} className="plano-bl-det">
        <td colSpan={7}>
          <details>
            <summary>Conta, origem e ajuste · {nomeDaTarefa(t)}</summary>
            <ul className="mapa-acao-motivos">
              <li>{"cliques" in t.impacto ? t.impacto.conta : `Impacto não calculável: ${t.impacto.naoCalculavel}.`}</li>
              <li>Vem de: {t.origens.map((o) => ORIGEM_DA_TAREFA[o] ?? o).join(" e ")}</li>
              <li>Move: {t.kpis.map(nomeDe).join(", ")}</li>
              {t.perguntas.length ? <li>Perguntas: {t.perguntas.map((q) => `«${q}»`).join(" · ")}</li> : null}
              {t.briefing ? (
                <li>
                  Briefing do cluster: intenção {t.briefing.intencao ?? "sem decisão"} · perguntas{" "}
                  {t.briefing.perguntas.length ? t.briefing.perguntas.map((q) => `«${q}»`).join(", ") : "nenhuma aceita"} · entidades{" "}
                  {t.briefing.entidades.length ? t.briefing.entidades.map((e) => e.nome).join(", ") : "nenhuma declarada"}
                  {t.perguntas.length ? ". Cada pergunta ganha um bloco de resposta com FAQPage no JSON-LD." : ""}
                </li>
              ) : null}
            </ul>
            {podeGravar ? (
              <form action={editarTarefa} className="mapa-marca-form">
                <input type="hidden" name="projeto" value={slug} />
                <input type="hidden" name="chave" value={t.chave} />
                <fieldset>
                  <legend>Ajustar esta tarefa (vale em toda versão nova)</legend>
                  <label htmlFor={`${id}-resp`}>responsável</label>
                  <select id={`${id}-resp`} name="responsavel" defaultValue={t.responsavel.editado ? t.responsavel.id : ""}>
                    <option value="">o da versão</option>
                    {(RESPONSAVEIS as { id: string; label: string }[]).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label.split(" ")[0]}
                      </option>
                    ))}
                  </select>
                  <label htmlFor={`${id}-min`}>seus minutos (vazio = o da versão)</label>
                  <input id={`${id}-min`} type="number" name="esforco" min={1} max={600} step={1} defaultValue={t.esforco.editado ? t.esforco.minutos : ""} className="plano-valor" />
                  <label htmlFor={`${id}-prazo`}>data fixa (vazio = a do plano)</label>
                  <input id={`${id}-prazo`} type="date" name="prazo" min={segundaDeHoje} defaultValue={t.prazoFixo ?? ""} />
                  <button className="ag-dono-b" aria-label={`Salvar o ajuste de ${nomeDaTarefa(t)}`}>
                    Salvar ajuste
                  </button>
                </fieldset>
              </form>
            ) : null}
          </details>
        </td>
      </tr>,
    ];
  };

  // 058 US2 — the core: one block per cluster, by volume (contracts/ui.md §5). Every state is a word.
  type ClusterV = (typeof v.clusters)[number];
  const nomeDoAlvo = (a: string) => (a.startsWith("http") ? caminho(a) : a);
  const ORIGEM_DA_PAGINA: Record<string, string> = { dono: "apontada pelo dono", cobertura: "a página do cluster no site", planejada: "página a criar" };
  const quem = (id: string) => (
    <>
      <label htmlFor={id}>quem decide</label>
      <select id={id} name="responsavel" defaultValue={atual?.criadoPor ?? "jean"}>
        {(RESPONSAVEIS as { id: string; label: string }[]).map((r) => (
          <option key={r.id} value={r.id}>
            {r.label.split(" ")[0]}
          </option>
        ))}
      </select>
    </>
  );
  const ocultos = (c: ClusterV) => (
    <>
      <input type="hidden" name="projeto" value={slug} />
      <input type="hidden" name="semente" value={c.semente} />
    </>
  );
  const blocoDoNucleo = (c: ClusterV) => {
    const nome = c.semente.replaceAll("-", " ");
    const id = `nucleo-${c.semente}`;
    const intencao = c.intencao.decidida
      ? `${c.intencao.valor} · decidida`
      : c.intencao.proposta
        ? `${c.intencao.proposta.classe} · proposta pelo hub: ${br(c.intencao.proposta.volumeDeclarado)} de ${br(c.intencao.proposta.volumeTotal)} buscas/mês declaram intenção`
        : "sem proposta: nenhum termo do cluster declara intenção";
    return (
      <div className="mapa-fila" key={c.semente}>
        <h3 className="mapa-fila-h" id={`${id}-h`}>
          {nome} · {br(c.volume)} buscas/mês
        </h3>
        <ul className="mapa-acao-motivos" aria-labelledby={`${id}-h`}>
          <li>
            <strong>Intenção:</strong> {intencao}
          </li>
          <li>
            <strong>Página responsável:</strong>{" "}
            {c.paginaResponsavel ? `${nomeDoAlvo(c.paginaResponsavel.alvo)} · ${ORIGEM_DA_PAGINA[c.paginaResponsavel.origem]}` : "nenhuma: o cluster não tem volume"}
          </li>
          <li>
            <strong>Perguntas:</strong>{" "}
            {c.perguntas.length ? (
              <ul>
                {c.perguntas.map((q) => (
                  <li key={q.texto}>
                    «{q.texto}» · {q.origem === "termo" ? `da demanda${q.volume !== null ? `, ${br(q.volume)} buscas/mês` : ""}` : "do dono"} ·{" "}
                    {q.estado === "proposta"
                      ? "proposta, sem decisão"
                      : q.estado === "respondida"
                        ? `respondida por ${nomeDoAlvo(q.pagina ?? "")}`
                        : `aceita: ${nomeDoAlvo(q.pagina ?? "")} vai responder`}
                  </li>
                ))}
              </ul>
            ) : (
              "nenhuma pergunta proposta pela demanda: declare as do cliente"
            )}
          </li>
          <li>
            <strong>Entidades:</strong> {c.entidades.length ? c.entidades.map((e) => `${e.nome} (${e.tipo})`).join(" · ") : "nenhuma declarada"}
          </li>
          <li>
            <strong>Próxima tarefa:</strong>{" "}
            {c.proxima ? `${ALAVANCAS[c.proxima.alavanca as keyof typeof ALAVANCAS].curta} · semana ${c.proxima.semana}, a partir de ${dm(c.proxima.inicio)}` : "nada planejado"}
          </li>
        </ul>
        {podeGravar ? (
          <details className="plano-nucleo-editar">
            <summary>Editar o núcleo de {nome}</summary>
            <form action={decidirIntencao} className="mapa-marca-form">
              {ocultos(c)}
              <fieldset>
                <legend>Intenção de {nome}</legend>
                <label htmlFor={`${id}-intencao`}>intenção</label>
                <select id={`${id}-intencao`} name="intencao" defaultValue={c.intencao.valor ?? INTENCOES[1]}>
                  {INTENCOES.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
                {quem(`${id}-intencao-quem`)}
                <button className="ag-dono-b">Salvar intenção</button>
              </fieldset>
            </form>
            <form action={apontarPagina} className="mapa-marca-form">
              {ocultos(c)}
              <fieldset>
                <legend>Página responsável por {nome}</legend>
                <label htmlFor={`${id}-pagina`}>endereço completo da página (vazio volta para a padrão)</label>
                <input id={`${id}-pagina`} type="url" name="pagina" defaultValue={c.paginaResponsavel?.origem === "dono" ? c.paginaResponsavel.alvo : ""} placeholder="https://" />
                {quem(`${id}-pagina-quem`)}
                <button className="ag-dono-b">Salvar página</button>
              </fieldset>
            </form>
            {c.perguntas.map((q, i) => (
              <form action={decidirItem} className="mapa-marca-form" key={q.texto}>
                {ocultos(c)}
                <input type="hidden" name="tipo" value="pergunta" />
                <input type="hidden" name="texto" value={q.texto} />
                <fieldset>
                  <legend>Pergunta «{q.texto}»</legend>
                  <label htmlFor={`${id}-q${i}-pagina`}>página que responde (vazio = a responsável)</label>
                  <input id={`${id}-q${i}-pagina`} type="url" name="detalhe" defaultValue={q.pagina?.startsWith("http") && q.pagina !== c.paginaResponsavel?.alvo ? q.pagina : ""} placeholder="https://" />
                  {quem(`${id}-q${i}-quem`)}
                  <button name="estado" value="aceita" className="ag-dono-b" aria-label={`Aceitar a pergunta «${q.texto}»: a página vai responder`}>
                    Aceitar
                  </button>
                  <button name="estado" value="respondida" className="ag-dono-b" aria-label={`A pergunta «${q.texto}» já é respondida por esta página`}>
                    Já respondida
                  </button>
                  <button name="estado" value="removida" className="ag-dono-b" aria-label={`Remover a pergunta «${q.texto}»`}>
                    Remover
                  </button>
                </fieldset>
              </form>
            ))}
            <form action={decidirItem} className="mapa-marca-form">
              {ocultos(c)}
              <input type="hidden" name="tipo" value="pergunta" />
              <input type="hidden" name="estado" value="aceita" />
              <fieldset>
                <legend>Nova pergunta em {nome}</legend>
                <label htmlFor={`${id}-nova-q`}>pergunta do cliente</label>
                <input id={`${id}-nova-q`} name="texto" required maxLength={200} />
                <label htmlFor={`${id}-nova-q-pagina`}>página que vai responder (vazio = a responsável)</label>
                <input id={`${id}-nova-q-pagina`} type="url" name="detalhe" placeholder="https://" />
                {quem(`${id}-nova-q-quem`)}
                <button className="ag-dono-b">Adicionar pergunta</button>
              </fieldset>
            </form>
            {c.entidades.map((e, i) => (
              <form action={decidirItem} className="mapa-marca-form" key={e.nome}>
                {ocultos(c)}
                <input type="hidden" name="tipo" value="entidade" />
                <input type="hidden" name="texto" value={e.nome} />
                <input type="hidden" name="detalhe" value={e.tipo ?? ""} />
                <input type="hidden" name="estado" value="removida" />
                <fieldset>
                  <legend>Entidade {e.nome}</legend>
                  {quem(`${id}-e${i}-quem`)}
                  <button className="ag-dono-b" aria-label={`Remover a entidade ${e.nome}`}>
                    Remover
                  </button>
                </fieldset>
              </form>
            ))}
            <form action={decidirItem} className="mapa-marca-form">
              {ocultos(c)}
              <input type="hidden" name="tipo" value="entidade" />
              <input type="hidden" name="estado" value="aceita" />
              <fieldset>
                <legend>Nova entidade em {nome}</legend>
                <label htmlFor={`${id}-nova-e`}>nome</label>
                <input id={`${id}-nova-e`} name="texto" required maxLength={200} />
                <label htmlFor={`${id}-nova-e-tipo`}>tipo</label>
                <select id={`${id}-nova-e-tipo`} name="detalhe" defaultValue="produto">
                  {TIPOS_DE_ENTIDADE.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
                {quem(`${id}-nova-e-quem`)}
                <button className="ag-dono-b">Adicionar entidade</button>
              </fieldset>
            </form>
          </details>
        ) : null}
      </div>
    );
  };

  type SemanaV = (typeof v.semanas)[number];
  // One line per lever and responsible, in backlog order: 20 targets of one card are one line to read.
  const porAlavanca = (ts: SemanaV["tarefas"]) => {
    const g = new Map<string, SemanaV["tarefas"]>();
    for (const t of ts) g.set(`${t.alavanca}|${t.responsavel.id}`, [...(g.get(`${t.alavanca}|${t.responsavel.id}`) ?? []), t]);
    return [...g.values()];
  };
  const tarefasDa = (s: SemanaV) =>
    s.tarefas.length ? (
      <ul className="mapa-acao-motivos">
        {porAlavanca(s.tarefas).map((ts) => (
          <li key={`${ts[0].alavanca}|${ts[0].responsavel.id}`}>
            <strong>{ALAVANCAS[ts[0].alavanca as keyof typeof ALAVANCAS].acao}</strong>: {ts.slice(0, 3).map((t) => t.alvo.rotulo).join(", ")}
            {ts.length > 3 ? ` e mais ${ts.length - 3} (no backlog)` : ""} · {primeiroNome(ts[0].responsavel.id)} ·{" "}
            {ts.reduce((a, t) => a + t.esforco.minutos, 0)} min seus
            <span className="mapa-fila-det">Move: {[...new Set(ts.flatMap((t) => t.kpis))].map(nomeDe).join(", ")}</span>
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

        {avisos.length || d.faltas.length ? (
          <div className="plano-aviso" role="note" aria-label="Avisos do plano">
            <ul>
              {avisos.map((a) => (
                <li key={a}>⚠ {a}</li>
              ))}
              {d.faltas.length ? (
                <li>
                  <details>
                    <summary>
                      ⚠ As tarefas de {d.faltas.length} {d.faltas.length === 1 ? "alavanca podem" : "alavancas podem"} faltar: havia folha sem leitura quando o mapa foi lido.
                    </summary>
                    <ul>
                      {d.faltas.map((f) => (
                        <li key={f.alavanca}>
                          «{f.alavanca}»: {f.folhas}
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ) : null}
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

        <section className="ficha-bloco" aria-labelledby="plano-backlog-h">
          <h2 className="ficha-bloco-h" id="plano-backlog-h">
            Backlog: {v.backlog.length} {v.backlog.length === 1 ? "tarefa" : "tarefas"}, na ordem em que vale a pena fazer
          </h2>
          {v.backlog.length ? (
            <>
              <p className="foot">
                Ordem: cliques ganhos por minuto seu; numa mesma página, o degrau anterior vem antes (índice, desempenho, página certa, posição, snippet). Impacto são os cliques por mês
                projetados aos 180 dias (posição 7 a 10) nos termos que a tarefa move; tarefas da mesma página não se somam. Só página nova ocupa a capacidade ({d.premissas.capacidade} por
                semana); o resto entra na primeira semana que a dependência deixa.{lidosEm ? ` Cards do mapa lidos em ${lidosEm}.` : ""}
              </p>
              <table className="plano-backlog">
                <caption className="sr-only">Backlog do plano de SEO de {nomeCurto}, na ordem de execução</caption>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Tarefa</th>
                    <th scope="col">Impacto</th>
                    <th scope="col">Esforço</th>
                    <th scope="col">Responsável</th>
                    <th scope="col">Prazo</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>{v.backlog.flatMap(linhaDoBacklog)}</tbody>
              </table>
            </>
          ) : (
            <p className="mapa-degrau-vazio">{demanda ? "Nenhuma tarefa futura: nada a criar, nenhuma página existente espera tarefa e o mapa não dispara card sem marca de feito." : "∅ sem backlog: falta a demanda congelada."}</p>
          )}
        </section>

        <section className="ficha-bloco" aria-labelledby="plano-nucleo-h">
          <h2 className="ficha-bloco-h" id="plano-nucleo-h">
            Núcleo: o que cada cluster vai atender
          </h2>
          {v.clusters.length ? (
            <>
              <p className="foot">
                Intenção, página, perguntas e entidades valem para SEO, respostas e IA de uma vez, e continuam valendo em toda nova versão e nova consulta de demanda. A intenção
                proposta usa a mesma regra que classifica títulos e consultas.
              </p>
              {v.clusters.map(blocoDoNucleo)}
            </>
          ) : (
            <p className="mapa-degrau-vazio">∅ sem cluster: falta a demanda congelada, ou o projeto não declara produtos.</p>
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
                      {!ate ? ` · páginas novas: ${s.paginasNovas} de ${d.premissas.capacidade}` : ""}
                    </strong>
                    {s.tarefas.length ? tarefasDa(s) : <span className="mapa-fila-det">sem tarefa{ate ? ", marcos iguais" : ""}</span>}
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
