import projects from "@/data/projects.json";
import { dbOn, listTasks, listDone, type Task } from "@/lib/db";
import { todaySP, addDaysISO, nextOccurrence, hash8, brShort, WD_LABELS, NO_DATE } from "@/lib/agenda.mjs";
import { Tabs } from "../tabs";
import { addTask, toggle, del } from "./actions";
import { EditTask } from "./edit-task";

export const dynamic = "force-dynamic";

type Item = {
  key: string;
  occ: string;
  titulo: string;
  projeto: string | null;
  meta: string | null;
  taskId: number | null; // null = ação automática do projects.json
  task?: Task; // presente só em tarefa do banco — habilita edição
};

function itemFromTask(t: Task, today: string): { item: Item; bucket: string } {
  const base = { titulo: t.titulo, projeto: t.projeto, taskId: t.id, key: `task:${t.id}`, task: t };
  if (t.weekday !== null) {
    const occ = nextOccurrence(t.weekday, today);
    const meta = `toda ${WD_LABELS[t.weekday]} · ${brShort(occ)}`;
    return { item: { ...base, occ, meta }, bucket: occ === today ? "hoje" : "semana" };
  }
  if (t.due) {
    const bucket =
      t.due < today ? "atrasadas" : t.due === today ? "hoje" : t.due <= addDaysISO(today, 7) ? "semana" : "depois";
    return { item: { ...base, occ: t.due, meta: brShort(t.due) }, bucket };
  }
  return { item: { ...base, occ: NO_DATE, meta: null }, bucket: "semdata" };
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

function Row({ item, done, canWrite }: { item: Item; done: boolean; canWrite: boolean }) {
  return (
    <li className="ag-item">
      {canWrite && <Check item={item} done={done} />}
      <div className="ag-body">
        {canWrite && item.task ? (
          <EditTask task={item.task} done={done} />
        ) : (
          <div className={done ? "ag-title done" : "ag-title"}>{item.titulo}</div>
        )}
        <div className="ag-meta">
          {item.projeto && <span className="pill">{item.projeto}</span>}
          {item.taskId === null && <span className="pill">AÇÃO DO RANKING</span>}
          {item.meta && <span>{item.meta}</span>}
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

function Section({ title, items, doneSet, canWrite, alert }: { title: string; items: Item[]; doneSet: Set<string>; canWrite: boolean; alert?: boolean }) {
  if (items.length === 0) return null;
  return (
    <section className="card ag-section">
      <h2 className={alert ? "ag-h alert" : "ag-h"}>{title}</h2>
      <ul className="ag-list">
        {items.map((it) => (
          <Row key={it.key + it.occ} item={it} done={doneSet.has(`${it.key}@${it.occ}`)} canWrite={canWrite} />
        ))}
      </ul>
    </section>
  );
}

export default async function Page() {
  const on = dbOn();
  const today = todaySP();
  const [tasks, doneSet] = on ? await Promise.all([listTasks(), listDone()]) : [[] as Task[], new Set<string>()];

  const buckets: Record<string, Item[]> = { atrasadas: [], hoje: [], semana: [], depois: [], semdata: [] };
  for (const t of tasks) {
    const { item, bucket } = itemFromTask(t, today);
    buckets[bucket].push(item);
  }
  const acoes: Item[] = projects.map((p) => ({
    key: `acao:${p.slug}:${hash8(p.acao)}`,
    occ: NO_DATE,
    titulo: p.acao,
    projeto: p.slug,
    meta: null,
    taskId: null,
  }));

  const all = [...Object.values(buckets).flat(), ...acoes];
  const feitas = all.filter((i) => doneSet.has(`${i.key}@${i.occ}`));
  const pend = (xs: Item[]) => xs.filter((i) => !doneSet.has(`${i.key}@${i.occ}`));

  return (
    <main className="page">
      <div className="topbar">
        <div className="topbar-left">
          <div className="brand">
            ROI <span>Hub</span>
          </div>
          <Tabs active="agenda" />
        </div>
        <div className="topbar-meta">hoje é {brShort(today)} ({WD_LABELS[new Date(today + "T12:00:00Z").getUTCDay()]})</div>
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
          <select name="weekday" className="ag-in" title="Repetição semanal">
            <option value="">não repete</option>
            {WD_LABELS.map((l, i) => (
              <option key={l} value={i}>
                toda {l}
              </option>
            ))}
          </select>
          <select name="projeto" className="ag-in" title="Projeto">
            <option value="">— projeto —</option>
            {projects.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.slug}
              </option>
            ))}
          </select>
          <button className="ag-btn">Adicionar</button>
        </form>
      )}

      <Section title="⚠ Atrasadas" items={pend(buckets.atrasadas)} doneSet={doneSet} canWrite={on} alert />
      <Section title="Hoje" items={pend(buckets.hoje)} doneSet={doneSet} canWrite={on} />
      <Section title="Próximos 7 dias" items={pend(buckets.semana)} doneSet={doneSet} canWrite={on} />
      <Section title="Mais tarde" items={pend(buckets.depois)} doneSet={doneSet} canWrite={on} />
      <Section title="Sem data" items={pend(buckets.semdata)} doneSet={doneSet} canWrite={on} />
      <Section title="Ações dos projetos (do ranking)" items={pend(acoes)} doneSet={doneSet} canWrite={on} />

      {feitas.length > 0 && (
        <details className="card table-details">
          <summary>✓ Feitas ({feitas.length})</summary>
          <ul className="ag-list">
            {feitas.map((it) => (
              <Row key={it.key + it.occ} item={it} done canWrite={on} />
            ))}
          </ul>
        </details>
      )}

      <p className="foot">
        Tarefas datadas e recorrentes vivem no Postgres (<code>hub_tasks</code>/<code>hub_done</code>); recorrente
        reseta sozinha a cada ocorrência. "Ações dos projetos" espelha a <code>acao</code> do{" "}
        <code>data/projects.json</code> — mudou o texto, o check reseta. Ação de projeto feita de verdade = editar o
        projects.json (aqui o check é só pra riscar do dia).
      </p>
    </main>
  );
}
