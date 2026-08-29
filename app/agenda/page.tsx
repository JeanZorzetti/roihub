import { evaluateAll } from "@/lib/evaluate";
import { dbOn, listTasks, listDone, type Task } from "@/lib/db";
import {
  todaySP,
  addDaysISO,
  nextOccurrence,
  hash8,
  brShort,
  tipoDe,
  TIPOS,
  ORDEM_BUCKET,
  WD_LABELS,
  NO_DATE,
} from "@/lib/agenda.mjs";
import { Tabs } from "../tabs";
import { addTask, toggle, del } from "./actions";
import { EditTask } from "./edit-task";

export const dynamic = "force-dynamic";

type Tipo = { id: string; label: string; icone: string };

type Item = {
  key: string;
  occ: string;
  titulo: string;
  projeto: string | null;
  meta: string | null;
  taskId: number | null; // null = ação automática do projects.json
  task?: Task; // presente só em tarefa do banco — habilita edição
  desc?: string | null; // descrição de ação do ranking (acaoDesc do projects.json)
  bucket: string; // urgência de data — ordena e pinta a linha dentro do balde
  tipo: string; // conferencia | execucao | decisao
};

function itemFromTask(t: Task, today: string): Item {
  const base = {
    titulo: t.titulo,
    projeto: t.projeto,
    taskId: t.id,
    key: `task:${t.id}`,
    task: t,
    tipo: t.tipo ?? tipoDe(t.titulo), // override manual vence a heurística
  };
  if (t.weekday !== null) {
    const occ = nextOccurrence(t.weekday, today);
    const meta = t.weekday === 7 ? `todo dia · ${brShort(occ)}` : `toda ${WD_LABELS[t.weekday]} · ${brShort(occ)}`;
    return { ...base, occ, meta, bucket: occ === today ? "hoje" : "semana" };
  }
  if (t.due) {
    const bucket =
      t.due < today ? "atrasadas" : t.due === today ? "hoje" : t.due <= addDaysISO(today, 7) ? "semana" : "depois";
    return { ...base, occ: t.due, meta: brShort(t.due), bucket };
  }
  return { ...base, occ: NO_DATE, meta: null, bucket: "semdata" };
}

/** Urgência primeiro, data depois. Sort estável: dentro de "sem data" a ordem do
 *  ranking (score) sobrevive, que é a única ordenação que aqueles cards têm. */
function porUrgencia(a: Item, b: Item): number {
  const ordem = ORDEM_BUCKET as Record<string, number>;
  const d = ordem[a.bucket] - ordem[b.bucket];
  return d !== 0 ? d : a.occ.localeCompare(b.occ);
}

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

function Row({ item, done, canWrite, slugs }: { item: Item; done: boolean; canWrite: boolean; slugs: string[] }) {
  const desc = item.task?.descricao ?? item.desc;
  const atrasada = item.bucket === "atrasadas" && !done;
  return (
    <li className="ag-item">
      {canWrite && <Check item={item} done={done} />}
      <div className="ag-body">
        {canWrite && item.task ? (
          <EditTask task={item.task} done={done} slugs={slugs} />
        ) : canWrite && item.taskId === null ? (
          <EditTask
            task={{
              id: 0,
              titulo: item.titulo,
              descricao: item.desc ?? null,
              projeto: item.projeto,
              due: null,
              weekday: null,
              tipo: null,
            }}
            done={done}
            acaoKey={item.key}
            slugs={slugs}
          />
        ) : (
          <div className={done ? "ag-title done" : "ag-title"}>{item.titulo}</div>
        )}
        {desc && !done && <div className="ag-desc">{desc}</div>}
        <div className="ag-meta">
          {item.projeto && <span className="pill">{item.projeto}</span>}
          {item.taskId === null && <span className="pill">AÇÃO DO RANKING</span>}
          {item.task?.tipo && <span className="pill">BALDE FIXADO</span>}
          {item.meta && (
            <span className={atrasada ? "ag-atraso" : undefined}>
              {atrasada && <span aria-hidden="true">⚠ </span>}
              {atrasada && <span className="sr-only">Atrasada — </span>}
              {item.meta}
            </span>
          )}
        </div>
      </div>
      {canWrite && item.taskId !== null && (
        <form action={del}>
          <input type="hidden" name="id" value={item.taskId} />
          <button className="ag-del" aria-label={`Apagar "${item.titulo}"`}>
            ×
          </button>
        </form>
      )}
    </li>
  );
}

function Balde({
  tipo,
  items,
  doneSet,
  canWrite,
  slugs,
}: {
  tipo: Tipo;
  items: Item[];
  doneSet: Set<string>;
  canWrite: boolean;
  slugs: string[];
}) {
  const atrasadas = items.filter((i) => i.bucket === "atrasadas").length;
  return (
    <section className="card ag-section">
      <h2 className="ag-h">
        <span aria-hidden="true">{tipo.icone} </span>
        {tipo.label} ({items.length})
        {atrasadas > 0 && (
          <span className="ag-h-atraso">
            {" · "}
            {atrasadas} atrasada{atrasadas > 1 ? "s" : ""}
          </span>
        )}
      </h2>
      {items.length === 0 ? (
        <p className="ag-vazio">Nada aqui.</p>
      ) : (
        <ul className="ag-list">
          {items.map((it) => (
            <Row
              key={it.key + it.occ}
              item={it}
              done={doneSet.has(`${it.key}@${it.occ}`)}
              canWrite={canWrite}
              slugs={slugs}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function Page() {
  const on = dbOn();
  const today = todaySP();
  const [ranked, [tasks, doneSet]] = await Promise.all([
    evaluateAll(), // mesma avaliação da home — ações na ordem do ranking
    on ? Promise.all([listTasks(), listDone()]) : [[] as Task[], new Set<string>()],
  ]);

  const slugs = ranked.map((p) => p.slug);
  // só o que tem curadoria vira ação da agenda: repo novo sem receita/ação definidas entra
  // no ranking da home marcado SEM CURADORIA, mas não afoga a lista do dia.
  const acoes: Item[] = ranked
    .filter((p) => p.curated)
    .map((p, i) => ({
      key: `acao:${p.slug}:${hash8(p.acao)}`,
      occ: NO_DATE,
      titulo: p.acao,
      projeto: p.slug,
      meta: `#${i + 1} · score ${p.score}`,
      taskId: null,
      desc: p.acaoDesc ?? null,
      bucket: "semdata",
      tipo: tipoDe(p.acao), // ação do ranking não tem linha no banco: heurística é o único caminho
    }));

  const all = [...tasks.map((t) => itemFromTask(t, today)), ...acoes];
  const feitas = all.filter((i) => doneSet.has(`${i.key}@${i.occ}`));
  const pendentes = all.filter((i) => !doneSet.has(`${i.key}@${i.occ}`));
  const tipos = TIPOS as Tipo[];

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
          hoje é {brShort(today)} ({WD_LABELS[new Date(today + "T12:00:00Z").getUTCDay()]})
        </div>
      </div>

      {!on && (
        <div className="banner" role="alert">
          Agenda sem persistência — configure <code>DATABASE_URL</code> (Postgres) no ambiente e redeploy.
          As ações do ranking aparecem abaixo em modo leitura.
        </div>
      )}

      {on && (
        <form action={addTask} className="card ag-add">
          <input name="titulo" placeholder="Nova tarefa…" required maxLength={200} className="ag-in grow" />
          <input type="date" name="due" className="ag-in" title="Data (ignorada se repetir)" />
          <select name="weekday" className="ag-in" title="Repetição">
            <option value="">não repete</option>
            <option value="7">todo dia</option>
            {WD_LABELS.map((l: string, i: number) => (
              <option key={l} value={i}>
                toda {l}
              </option>
            ))}
          </select>
          <select name="projeto" className="ag-in" title="Projeto">
            <option value="">— projeto —</option>
            {slugs.map((slug) => (
              <option key={slug} value={slug}>
                {slug}
              </option>
            ))}
          </select>
          <select name="tipo" className="ag-in" title="Em que balde o card cai">
            <option value="">— balde automático —</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icone} {t.label}
              </option>
            ))}
          </select>
          <button className="ag-btn">Adicionar</button>
        </form>
      )}

      {tipos.map((t) => (
        <Balde
          key={t.id}
          tipo={t}
          items={pendentes.filter((i) => i.tipo === t.id).sort(porUrgencia)}
          doneSet={doneSet}
          canWrite={on}
          slugs={slugs}
        />
      ))}

      {feitas.length > 0 && (
        <details className="card table-details">
          <summary>✓ Feitas ({feitas.length})</summary>
          <ul className="ag-list">
            {feitas.map((it) => (
              <Row key={it.key + it.occ} item={it} done canWrite={on} slugs={slugs} />
            ))}
          </ul>
        </details>
      )}

      <p className="foot">
        Três baldes pelo que o card exige de você: <strong>Conferência</strong> (medir ou olhar um
        número), <strong>Execução</strong> (escrever, publicar, deployar) e <strong>Decisão</strong>{" "}
        (não há o que fazer até você decidir). Dentro de cada um a ordem é urgência — atrasada
        primeiro, depois hoje, semana, mais tarde. O balde sai do título por palavra-chave; quando
        errar, abra o card e fixe no seletor de tipo (aí ele ganha o selo BALDE FIXADO). Tarefas
        datadas e recorrentes vivem no Postgres (<code>hub_tasks</code>/<code>hub_done</code>);
        recorrente reseta sozinha a cada ocorrência. &quot;Ação do ranking&quot; espelha a{" "}
        <code>acao</code> do <code>data/projects.json</code> na ordem do ranking da home — mudou o
        texto, o check reseta, e o balde é sempre derivado (não há onde fixar). Ação de projeto feita
        de verdade = editar o projects.json. Clicar numa ação abre o modal: salvar vira tarefa do
        banco e risca a original.
      </p>
    </main>
  );
}
