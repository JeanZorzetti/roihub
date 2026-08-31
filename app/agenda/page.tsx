import { evaluateAll } from "@/lib/evaluate";
import { ACAO_DONE_DIAS, dbOn, listDone } from "@/lib/db";
import {
  todaySP,
  brShort,
  TIPOS,
  WD_LABELS,
  ORDENS,
  acoesDoRanking,
  lerFiltros,
  filtrosAtivos,
  comFiltro,
  filtrar,
  ordenar,
} from "@/lib/agenda.mjs";
import { Tabs } from "../tabs";
import { toggle } from "./actions";

export const dynamic = "force-dynamic";

type Tipo = { id: string; label: string; icone: string };
/** Opção de filtro/ordem: mesma forma do balde, sem ícone. */
type Opcao = { id: string; label: string };

/**
 * Uma linha da agenda. TODA linha é a `acao` de um projeto do ranking — não existe mais card
 * de outra fonte, então não há `taskId`, nem data, nem dono para carregar.
 */
type Item = {
  key: string;
  occ: string;
  titulo: string;
  projeto: string;
  meta: string; // "#N · score S" — a posição no ranking, que é também a chave de ordem
  desc: string | null; // acaoDesc do projects.json
  tipo: string; // conferencia | execucao | decisao
  rank: number; // posição do projeto no ranking curado
  seguranca: boolean; // furou a fila da Execução — ortogonal a `tipo`
};

function Check({ item, done }: { item: Item; done: boolean }) {
  return (
    <form action={toggle}>
      <input type="hidden" name="key" value={item.key} />
      <input type="hidden" name="occurrence" value={item.occ} />
      <input type="hidden" name="to" value={done ? "0" : "1"} />
      <button
        className={done ? "ag-check done" : "ag-check"}
        aria-label={`${done ? "Desmarcar" : "Marcar"} "${item.titulo}"`}
      >
        {done ? "✓" : ""}
      </button>
    </form>
  );
}

function Row({ item, done, canWrite }: { item: Item; done: boolean; canWrite: boolean }) {
  return (
    <li className="ag-item">
      {canWrite && <Check item={item} done={done} />}
      <div className="ag-body">
        <div className={done ? "ag-title done" : "ag-title"}>{item.titulo}</div>
        <div className="ag-meta">
          <span className="pill">{item.projeto}</span>
          <span>{item.meta}</span>
        </div>
        {item.desc && !done && (
          <details className="ag-ctx">
            {/* O rótulo se repete em 32 linhas: sem o projeto junto, quem navega por elementos
                ouve "contexto" 32 vezes sem saber de qual card. */}
            <summary>
              contexto<span className="sr-only"> de {item.projeto}</span>
            </summary>
            <div className="ag-desc">{item.desc}</div>
          </details>
        )}
      </div>
    </li>
  );
}

function Balde({
  tipo,
  items,
  doneSet,
  canWrite,
  filtrando,
}: {
  tipo: Tipo;
  items: Item[];
  doneSet: Set<string>;
  canWrite: boolean;
  filtrando: boolean;
}) {
  // Segurança fura a fila só dentro de Execução — nos outros dois baldes o grupo fica vazio e
  // a lista renderiza chapada, exatamente como antes desta partição existir.
  const seg = tipo.id === "execucao" ? items.filter((i) => i.seguranca) : [];
  const resto = seg.length ? items.filter((i) => !i.seguranca) : items;
  const lista = (its: Item[]) => (
    <ul className="ag-list">
      {its.map((it) => (
        <Row key={it.key} item={it} done={doneSet.has(`${it.key}@${it.occ}`)} canWrite={canWrite} />
      ))}
    </ul>
  );
  return (
    <section className="card ag-section">
      <h2 className="ag-h">
        <span aria-hidden="true">{tipo.icone} </span>
        {tipo.label} ({items.length})
      </h2>
      {items.length === 0 ? (
        <p className="ag-vazio">
          {filtrando ? "Nenhuma ação com este filtro." : "Nenhuma ação neste balde."}
        </p>
      ) : seg.length === 0 ? (
        lista(resto)
      ) : (
        <>
          <h3 className="ag-sub">
            <span aria-hidden="true">🔒 </span>
            Segurança ({seg.length})
          </h3>
          {lista(seg)}
          <h3 className="ag-sub">resto</h3>
          {lista(resto)}
        </>
      )}
    </section>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const on = dbOn();
  const today = todaySP();
  const [ranked, doneSet] = await Promise.all([
    evaluateAll(), // mesma avaliação da home — a agenda é a projeção dela
    // falha de DB nunca derruba a agenda: sem os checks, tudo aparece como pendente
    on ? listDone().catch(() => new Set<string>()) : new Set<string>(),
  ]);

  // só o que tem curadoria vira linha: repo novo sem receita/ação definidas entra no ranking
  // da home marcado SEM CURADORIA, mas não afoga a lista do dia.
  const curados = ranked.filter((p) => p.curated);
  const acoes = acoesDoRanking(curados) as Item[];
  // O select lista quem TEM linha, não os 35 do ranking: projeto sem ação viraria um filtro
  // que devolve lista vazia sem explicação, que é o bug #1 de painel.
  const slugs = [...new Set(acoes.map((a) => a.projeto))];

  const f = lerFiltros(sp, slugs);
  const ativos = filtrosAtivos(f) as string[];
  const visiveis = filtrar(acoes, f) as Item[];
  const feito = (i: Item) => doneSet.has(`${i.key}@${i.occ}`);
  const feitas = ordenar(visiveis.filter(feito), f.ordem) as Item[];
  const pendentes = visiveis.filter((i) => !feito(i));
  const tipos = TIPOS as Tipo[];
  // Chip de filtro ativo carrega o valor, não o nome do campo: "atma" diz o que
  // está escondendo a lista; "projeto" não diz nada.
  const ROTULO: Record<string, string> = {
    q: `"${f.q}"`,
    projeto: f.projeto,
    tipo: tipos.find((t) => t.id === f.tipo)?.label ?? "",
  };
  const semFiltro = comFiltro({ ...f, q: "", projeto: "", tipo: "" }, "ordem", f.ordem);

  return (
    <main className="page">
      <div className="topbar">
        <div className="topbar-left">
          <div className="brand">
            ROI <span>Hub</span>
          </div>
          <Tabs active="agenda" />
        </div>
        <div className="topbar-meta">
          {acoes.length} ações na ordem do ranking · hoje é {brShort(today)} (
          {WD_LABELS[new Date(today + "T12:00:00Z").getUTCDay()]})
        </div>
      </div>

      {!on && (
        <div className="banner" role="alert">
          Não dá para marcar nada como feito: falta a <code>DATABASE_URL</code> (Postgres) neste
          ambiente. A lista abaixo continua completa e na ordem certa — só não guarda o check.
        </div>
      )}

      {/* Filtro e ordem por GET: a visão inteira cabe na URL, então ela é compartilhável,
          sobrevive ao reload e à server action de marcar, que revalida /agenda sem trocar a
          querystring. Sem client component. */}
      <form className="card ag-add" method="get">
        <input
          className="ag-in grow"
          type="search"
          name="q"
          defaultValue={f.q}
          maxLength={100}
          placeholder="Filtrar por texto da ação, projeto ou descrição…"
          aria-label="Filtrar por texto"
        />
        <select name="projeto" defaultValue={f.projeto} className="ag-in" aria-label="Filtrar por projeto">
          <option value="">todos os projetos</option>
          {slugs.map((slug) => (
            <option key={slug} value={slug}>
              {slug}
            </option>
          ))}
        </select>
        {/* Sem filtro de balde os três ficam na tela mesmo vazios, para o filtro não esconder
            que existe um balde. Com o filtro ligado o balde FOI a escolha: mostrar os outros
            dois vazios é ruído, não transparência. */}
        <select name="tipo" defaultValue={f.tipo} className="ag-in" aria-label="Filtrar por balde">
          <option value="">os três baldes</option>
          {tipos
            .filter((t) => !f.tipo || t.id === f.tipo)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.icone} {t.label}
              </option>
            ))}
        </select>
        <select name="ordem" defaultValue={f.ordem} className="ag-in" aria-label="Ordenar por">
          {(ORDENS as Opcao[]).map((o) => (
            <option key={o.id} value={o.id}>
              ordenar por {o.label}
            </option>
          ))}
        </select>
        <button className="ag-btn sec">Filtrar</button>
      </form>

      {ativos.length > 0 && (
        <div className="ag-chips">
          <span className="ag-chips-cont">
            {visiveis.length} de {acoes.length} ações
          </span>
          {ativos.map((k) => (
            <a key={k} className="pill ag-chip" href={comFiltro(f, k, "")}>
              {ROTULO[k]}
              <span aria-hidden="true"> ×</span>
              <span className="sr-only"> — remover este filtro</span>
            </a>
          ))}
          <a className="ag-chips-limpar" href={semFiltro}>
            limpar filtros
          </a>
        </div>
      )}

      {tipos
        .filter((t) => !f.tipo || t.id === f.tipo)
        .map((t) => (
          <Balde
            key={t.id}
            tipo={t}
            items={ordenar(pendentes.filter((i) => i.tipo === t.id), f.ordem) as Item[]}
            doneSet={doneSet}
            canWrite={on}
            filtrando={ativos.length > 0}
          />
        ))}

      {feitas.length > 0 && (
        <details className="card table-details">
          <summary>✓ Feitas ({feitas.length})</summary>
          <ul className="ag-list">
            {feitas.map((it) => (
              <Row key={it.key} item={it} done canWrite={on} />
            ))}
          </ul>
        </details>
      )}

      <p className="foot">
        <strong>Esta aba não tem fonte própria.</strong> Cada linha é a <code>acao</code> de um
        projeto do <a href="/">ranking</a>, lida do <code>data/projects.json</code> na ordem do
        score — mudou a prioridade na home, mudou aqui, sem uma segunda lista para manter em dia.
        Só projeto curado entra, e <code>acao</code> vazia não vira linha (card curado para dizer
        que não há o que fazer não é tarefa de execução).
      </p>
      <p className="foot">
        Três baldes pelo que a ação exige de você: <strong>Conferência</strong> (medir ou olhar um
        número), <strong>Execução</strong> (escrever, publicar, deployar) e <strong>Decisão</strong>{" "}
        (não há o que fazer até você decidir). Dentro de cada um manda o ranking: a ação do #1 vem
        antes da do #20. O balde sai do texto da ação por palavra-chave — quando errar, o conserto
        é a heurística em <code>lib/agenda.mjs</code>, não um override por card. Dentro de Execução,
        card de segurança (token, credencial, CORS, CVE) fura a fila.
      </p>
      <p className="foot">
        O check é só um lembrete de &quot;já olhei isso&quot;: ele expira em{" "}
        <strong>{ACAO_DONE_DIAS} dias</strong>, porque ação não tem data própria e um check eterno
        some com o topo do ranking. Concluir de verdade é trocar a <code>acao</code> no{" "}
        <code>data/projects.json</code> e dar push — o texto muda, o check reseta sozinho. Para o
        que não é ação de projeto, use os quadros de <a href="/marketing">Marketing</a> e{" "}
        <a href="/ideias">Ideias</a>; o card noturno de estado fica em{" "}
        <a href="/automacao">Automação</a>.
      </p>
    </main>
  );
}
