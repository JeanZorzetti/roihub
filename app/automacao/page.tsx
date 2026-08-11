import { dbOn, estadoUltimo, listPublications, listProjectStates, listTasks } from "@/lib/db";
import { Tabs } from "../tabs";
import { Stat, num } from "../viz";
import { Publications } from "./publications";

// As duas automações agendadas da casa moram aqui: o autopublishing (00:13 BRT) e o estado
// noturno (23:37 BRT). Ficavam em lugares diferentes — a sala de controle editorial dentro da
// /seo e o estado só no card que cai na /agenda —, e nenhuma das duas abas é sobre automação.
export const dynamic = "force-dynamic";

// Rótulo dos domínios do mapa de `lib/estado-noturno.mjs`. Domínio novo sem entrada aqui
// aparece com a própria sigla: a lista tem que degradar, nunca esconder coletor.
const DOMINIOS: Record<string, string> = {
  CONF: "conformidade",
  GTW: "gateway servido",
  REPO: "gateway no código",
  POOL: "pool de contas",
  IA: "telemetria",
};

const fmtHora = (valor: Date | string) =>
  new Date(valor).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

function EstadoNoturno({
  estado,
  cards,
}: {
  estado: Awaited<ReturnType<typeof estadoUltimo>>;
  cards: { titulo: string; descricao: string | null }[];
}) {
  const ultimo = cards.at(-1);
  const porDominio = new Map<string, number>();
  for (const chave of Object.keys(estado?.mapa ?? {})) {
    const dominio = chave.slice(0, chave.indexOf(":"));
    porDominio.set(dominio, (porDominio.get(dominio) ?? 0) + 1);
  }

  return (
    <section className="card ag-section" aria-labelledby="estado-title">
      <h2 id="estado-title" className="ag-h">
        Estado noturno · 23:37 BRT
      </h2>
      {!estado ? (
        <p className="seo-empty">Nenhuma corrida gravada — a primeira grava o mapa e não emite card.</p>
      ) : (
        <>
          <div className="seo-stats">
            <Stat label="Última corrida">{estado.runDate}</Stat>
            <Stat label="Gravada às">{fmtHora(estado.criado)}</Stat>
            <Stat label="Células no mapa">{num.format(Object.keys(estado.mapa).length)}</Stat>
            <Stat label="Cards emitidos">{num.format(cards.length)}</Stat>
          </div>
          <div className="ag-meta">
            {[...porDominio].map(([dominio, total]) => (
              <span key={dominio} className="pill">
                {DOMINIOS[dominio] ?? dominio} {total}
              </span>
            ))}
          </div>
          <p className="ag-desc">
            Contagem do mapa GRAVADO, não saúde do coletor: domínio que falhou carrega os valores de ontem para o dia
            seguinte não ler as mesmas chaves como novidade. Coletor fora aparece no card, nunca aqui.
          </p>
        </>
      )}

      {ultimo && (
        <>
          <h3 className="ag-h">Último card emitido</h3>
          <div className="ag-title">{ultimo.titulo}</div>
          <div className="ag-desc">{ultimo.descricao}</div>
        </>
      )}
    </section>
  );
}

export default async function AutomacaoPage() {
  const databaseOn = dbOn();
  const [publications, projectStates, estado, tasks] = await Promise.all([
    databaseOn ? listPublications(50) : Promise.resolve([]),
    databaseOn ? listProjectStates() : Promise.resolve([]),
    databaseOn ? estadoUltimo() : Promise.resolve(null),
    databaseOn ? listTasks() : Promise.resolve([]),
  ]);
  // Os cards do estado vivem na mesma tabela das tarefas da agenda — o título é o que os
  // separa, porque é `montarCard` quem o escreve (`Estado YYYY-MM-DD: …`). Já vêm ordenados
  // por `due`, então o último do array é o mais recente.
  const cards = tasks.filter((t) => /^Estado \d{4}-\d{2}-\d{2}:/.test(t.titulo));

  return (
    <main className="page">
      <div className="topbar">
        <div className="topbar-left">
          <div className="brand">
            ROI <span>Hub</span>
          </div>
          <Tabs active="automacao" />
        </div>
        <div className="topbar-meta">2 automações agendadas · GitHub Actions dispara, o hub executa</div>
      </div>

      <section className="card ag-section">
        <h2 className="ag-h">Autopublishing · 00:13 BRT</h2>
        <p className="ag-desc">
          Um artigo por dia, um projeto por vez — a fila gira 1 passo por dia para o rate limit não cair sempre no
          mesmo. Motor é o claude-cli pelo pool de contas da assinatura; conta esgotada é pulada. Pausar aqui grava no
          banco e vale para a corrida da noite.
        </p>
      </section>

      <Publications publications={publications} states={projectStates} databaseOn={databaseOn} />

      <EstadoNoturno estado={estado} cards={cards} />

      <p className="foot">
        As duas rodam por cron do GitHub Actions, que dispara e não executa: o trabalho é server-side porque depende do
        claude-cli e do pool de tokens, que só existem na imagem do hub.{" "}
        <b>O Actions atrasa o agendamento em ~1h40</b> — a hora do cron é o mais cedo possível, nunca a hora exata. A
        ordem entre elas é deliberada: o estado mede o pool <b>em repouso</b>, 36 min antes de o autopublishing drenar.
        Não dar push entre 23:30 e 01:00 BRT: um deploy no meio derruba a corrida. O detalhe de consumo de cada
        chamada fica na aba <a href="/ia">IA</a>; os cards emitidos caem na <a href="/agenda">Agenda</a>.
      </p>
    </main>
  );
}
