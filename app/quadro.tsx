import {
  CANAIS,
  VISTAS,
  MIMES_ACEITOS,
  ANEXO_MAX_POR_CARD,
  ANEXO_CARENCIA_DIAS,
  TITULO_MAX,
  DESCRICAO_MAX,
  COLUNA_NOME_MAX,
  lerFiltros,
  filtrosAtivos,
  comFiltro,
  filtrar,
  agruparPorColuna,
  agruparPorDia,
  gradeDoMes,
  mesVizinho,
  mesDe,
  rotuloMes,
  dataDeLiberacao,
  tamanhoHumano,
} from "@/lib/pauta.mjs";
import { RESPONSAVEIS, RESPONSAVEL_IDS, todaySP, brShort, WD_LABELS } from "@/lib/agenda.mjs";
import type { PautaAnexo, PautaCard, PautaColuna } from "@/lib/db";
import { Tabs } from "./tabs";
import { EditarCard } from "./editar-card";
import {
  addCard,
  moverCard,
  delCard,
  arquivarCard,
  restaurarCard,
  addColuna,
  renomearColuna,
  moverColuna,
  delColuna,
} from "./quadro-actions";

type Opcao = { id: string; label: string };

/** A rota traduz o código; o código é o que o teste e o log leem. */
const ERRO_ANEXO: Record<string, string> = {
  mime: "Formato recusado — só PNG, JPEG e WebP.",
  tamanho: "Arquivo recusado — acima de 3 MB.",
  quantidade: `Limite de ${ANEXO_MAX_POR_CARD} imagens por card atingido.`,
  card: "Card não encontrado.",
};

const rotuloCanal = (id: string | null) => (CANAIS as Opcao[]).find((c) => c.id === id)?.label ?? id ?? "";
const rotuloResp = (id: string | null) => (RESPONSAVEIS as Opcao[]).find((r) => r.id === id)?.label ?? id ?? "";

function Anexos({ card, anexos, voltar }: { card: PautaCard; anexos: PautaAnexo[]; voltar: string }) {
  const vivos = anexos.filter((a) => a.liberado_em === null);
  return (
    <details className="q-anexos">
      <summary>
        🖼️ Arte ({anexos.length}
        {anexos.length !== vivos.length && ` · ${anexos.length - vivos.length} liberada(s)`})
      </summary>
      {anexos.length > 0 && (
        <ul className="q-slides">
          {anexos.map((a, i) => (
            <li key={a.id} className="q-slide">
              {/* Anexo liberado continua listado: nome, formato, tamanho e ordem são o registro
                  permanente (FR-033) — só os bytes é que não existem mais. */}
              {a.liberado_em === null ? (
                <img src={`/api/pauta/anexo/${a.id}`} alt={a.nome} width={120} loading="lazy" />
              ) : (
                <div className="q-slide-liberado" aria-label="imagem liberada">
                  liberada
                </div>
              )}
              <div className="q-slide-meta">
                <span className="q-slide-n">#{i + 1}</span> {a.nome}
                <br />
                {a.mime.replace("image/", "")} · {tamanhoHumano(a.tamanho)}
              </div>
              <div className="q-slide-acoes">
                <form method="post" action={`/api/pauta/anexo/${a.id}/mover?dir=-1`}>
                  <input type="hidden" name="voltar" value={voltar} />
                  <button className="q-mini" aria-label={`Mover ${a.nome} para antes`}>
                    ‹
                  </button>
                </form>
                <form method="post" action={`/api/pauta/anexo/${a.id}/mover?dir=1`}>
                  <input type="hidden" name="voltar" value={voltar} />
                  <button className="q-mini" aria-label={`Mover ${a.nome} para depois`}>
                    ›
                  </button>
                </form>
                <form method="post" action={`/api/pauta/anexo/${a.id}/remover`}>
                  <input type="hidden" name="voltar" value={voltar} />
                  <button className="q-mini" aria-label={`Remover ${a.nome}`}>
                    ×
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
      {/* Formulário HTML nativo, sem JavaScript: server action tem teto de corpo de ~1 MB e
          mudar isso exigiria tocar next.config.mjs, fora do escopo declarado. */}
      <form
        method="post"
        action="/api/pauta/anexo"
        encType="multipart/form-data"
        className="q-upload"
      >
        <input type="hidden" name="pauta_id" value={card.id} />
        <input type="hidden" name="voltar" value={voltar} />
        <input type="file" name="imagens" accept={MIMES_ACEITOS.join(",")} multiple className="ag-in" />
        <button className="ag-btn sec">Anexar</button>
      </form>
    </details>
  );
}

function Card({
  card,
  colunas,
  slugs,
  anexos,
  voltar,
  on,
}: {
  card: PautaCard;
  colunas: PautaColuna[];
  slugs: string[];
  anexos: PautaAnexo[];
  voltar: string;
  on: boolean;
}) {
  const arquivado = card.arquivado_em !== null;
  const libera = dataDeLiberacao(card);
  return (
    <li className="ag-item q-card">
      <div className="ag-body">
        {on ? (
          <EditarCard card={card} colunas={colunas} slugs={slugs} />
        ) : (
          <div className="ag-title">{card.titulo}</div>
        )}
        {card.descricao && <div className="ag-desc q-desc">{card.descricao}</div>}
        <div className="ag-meta">
          {card.projeto && <span className="pill">{card.projeto}</span>}
          {card.canal && <span className="pill">{rotuloCanal(card.canal)}</span>}
          {card.responsavel && <span className="pill">{rotuloResp(card.responsavel)}</span>}
          {card.data && <span>{brShort(card.data)}</span>}
          {card.url && (
            <a href={card.url} target="_blank" rel="noreferrer">
              no ar ↗
            </a>
          )}
        </div>
        {arquivado && libera && (
          <div className="ag-desc q-libera">
            arquivado — imagens liberadas em {brShort(libera)} ({ANEXO_CARENCIA_DIAS} dias do arquivamento)
          </div>
        )}
        {on && <Anexos card={card} anexos={anexos} voltar={voltar} />}
      </div>
      {on && (
        <div className="q-acoes">
          {!arquivado && card.tipo !== "doc" && colunas.length > 1 && (
            <form action={moverCard} className="q-mover">
              <input type="hidden" name="id" value={card.id} />
              <input type="hidden" name="quadro" value={card.quadro} />
              <select name="coluna_id" defaultValue={card.coluna_id ?? ""} className="ag-in" aria-label={`Mover "${card.titulo}"`}>
                {colunas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icone ? `${c.icone} ` : ""}
                    {c.nome}
                  </option>
                ))}
              </select>
              <button className="ag-btn sec">mover</button>
            </form>
          )}
          <form action={arquivado ? restaurarCard : arquivarCard}>
            <input type="hidden" name="id" value={card.id} />
            <input type="hidden" name="quadro" value={card.quadro} />
            <button className="q-mini" title={arquivado ? "Restaurar" : "Arquivar"}>
              {arquivado ? "↩" : "📥"}
            </button>
          </form>
          <form action={delCard}>
            <input type="hidden" name="id" value={card.id} />
            <input type="hidden" name="quadro" value={card.quadro} />
            <button className="ag-del" aria-label={`Apagar "${card.titulo}"`}>
              ×
            </button>
          </form>
        </div>
      )}
    </li>
  );
}

/**
 * O cabeçalho carrega a configuração inteira da coluna (FR-012): renomear, reordenar e remover
 * saem daqui, sem publicação de versão nova. A remoção mostra a contagem ANTES do clique —
 * recusar depois é pior que avisar antes.
 */
function ColunaHead({
  coluna,
  quadro,
  cards,
  totalColunas,
  on,
}: {
  coluna: PautaColuna;
  quadro: string;
  cards: number;
  totalColunas: number;
  on: boolean;
}) {
  const bloqueio = cards > 0 ? `${cards} card(s) aqui dentro` : totalColunas <= 1 ? "é a última coluna" : "";
  return (
    <div className="q-coluna-head">
      <h2 className="ag-h">
        {coluna.icone && <span aria-hidden="true">{coluna.icone} </span>}
        {coluna.nome} ({cards})
      </h2>
      {on && (
        <details className="q-coluna-cfg">
          <summary aria-label={`Configurar coluna ${coluna.nome}`}>⚙</summary>
          <form action={renomearColuna} className="q-coluna-form">
            <input type="hidden" name="id" value={coluna.id} />
            <input type="hidden" name="quadro" value={quadro} />
            <input name="icone" defaultValue={coluna.icone ?? ""} maxLength={4} className="ag-in q-icone" aria-label="Ícone" />
            <input name="nome" defaultValue={coluna.nome} maxLength={COLUNA_NOME_MAX} required className="ag-in" aria-label="Nome da coluna" />
            <button className="ag-btn sec">renomear</button>
          </form>
          <div className="q-coluna-ordem">
            <form action={moverColuna}>
              <input type="hidden" name="id" value={coluna.id} />
              <input type="hidden" name="quadro" value={quadro} />
              <input type="hidden" name="dir" value="-1" />
              <button className="q-mini" aria-label="Mover coluna para antes">
                ‹
              </button>
            </form>
            <form action={moverColuna}>
              <input type="hidden" name="id" value={coluna.id} />
              <input type="hidden" name="quadro" value={quadro} />
              <input type="hidden" name="dir" value="1" />
              <button className="q-mini" aria-label="Mover coluna para depois">
                ›
              </button>
            </form>
            {bloqueio ? (
              <span className="foot">não dá para remover: {bloqueio}</span>
            ) : (
              <form action={delColuna}>
                <input type="hidden" name="id" value={coluna.id} />
                <input type="hidden" name="quadro" value={quadro} />
                <button className="ag-del" aria-label={`Remover coluna ${coluna.nome}`}>
                  remover
                </button>
              </form>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

export function Quadro({
  quadro,
  on,
  colunas,
  cards,
  anexos,
  slugs,
  espaco,
  sp,
}: {
  quadro: string;
  on: boolean;
  colunas: PautaColuna[];
  cards: PautaCard[];
  anexos: PautaAnexo[];
  slugs: string[];
  espaco: { ativos: number; bytes: number; liberados: number };
  sp: Record<string, string | string[] | undefined>;
}) {
  const marketing = quadro === "marketing";
  const rota = marketing ? "/marketing" : "/ideias";
  const f = lerFiltros(sp, { slugs, responsaveis: RESPONSAVEL_IDS as string[], colunas });
  // No quadro de Ideias só existe o fluxo: calendário e documentação são do Marketing (Out of Scope).
  const vista = marketing ? f.vista : "kanban";
  const ativos = filtrosAtivos(f) as string[];
  // O `?` sozinho de comFiltro viraria "/marketing?&erro=…" quando a rota anexasse o código de
  // recusa — feio numa URL que a pessoa vê na barra depois de um upload recusado.
  const qs = comFiltro(f, "q", f.q);
  const voltar = `${rota}${qs === "?" ? "" : qs}`;

  const anexosDe = (id: number) => anexos.filter((a) => a.pauta_id === id);
  const visiveis = filtrar(cards, f) as PautaCard[];
  const naoArquivados = visiveis.filter((c) => c.arquivado_em === null);
  const arquivados = visiveis.filter((c) => c.arquivado_em !== null);
  const doFluxo = naoArquivados.filter((c) => c.tipo !== "doc");
  const docs = naoArquivados.filter((c) => c.tipo === "doc");

  const ym = f.mes || mesDe(todaySP());
  const porDia = agruparPorDia(doFluxo, ym) as Record<string, PautaCard[]>;

  // "Publicados ainda não arquivados" = última etapa do fluxo. A contagem não usa o NOME da
  // coluna porque o nome é editável (FR-012): amarrar em "Publicado" quebraria no dia em que
  // alguém renomeasse a etapa, que é exatamente o que a US3 existe para permitir.
  const ultima = colunas.at(-1);
  const naUltima = ultima
    ? cards.filter((c) => c.arquivado_em === null && c.tipo !== "doc" && c.coluna_id === ultima.id).length
    : 0;

  const ROTULO: Record<string, string> = {
    q: `"${f.q}"`,
    projeto: f.projeto,
    responsavel: rotuloResp(f.responsavel),
    canal: rotuloCanal(f.canal),
  };
  const semFiltro = comFiltro({ ...f, q: "", projeto: "", responsavel: "", canal: "" }, "vista", f.vista);
  const erro = typeof sp.erro === "string" ? sp.erro : "";

  return (
    <main className="page">
      <div className="topbar">
        <div className="topbar-left">
          <div className="brand">
            ROI <span>Hub</span>
          </div>
          <Tabs active={marketing ? "marketing" : "ideias"} />
        </div>
        <div className="topbar-meta">
          {naoArquivados.length} ativos · {arquivados.length} arquivados
        </div>
      </div>

      {!on && (
        <div className="banner" role="alert">
          Quadro sem persistência — configure <code>DATABASE_URL</code> (Postgres) no ambiente e redeploy.
        </div>
      )}

      {erro && ERRO_ANEXO[erro] && (
        <div className="banner" role="alert">
          {ERRO_ANEXO[erro]} Os demais arquivos do envio foram gravados.
        </div>
      )}

      {/* Contador permanente de espaço (FR-036): o custo dos anexos fica visível sem ninguém
          precisar consultar o banco. */}
      <p className="foot">
        Anexos: {espaco.ativos} imagem(ns) ocupando {tamanhoHumano(espaco.bytes)}
        {espaco.liberados > 0 && ` · ${espaco.liberados} já liberada(s)`}
        {marketing && ` · ${naUltima} card(s) na última etapa ainda não arquivados`}. As imagens de um
        card arquivado são liberadas {ANEXO_CARENCIA_DIAS} dias depois do arquivamento; o registro
        escrito fica para sempre.
      </p>

      {marketing && (
        <nav className="tabs q-vistas" aria-label="Vista">
          {(VISTAS as Opcao[]).map((v) => (
            <a key={v.id} className={vista === v.id ? "tab active" : "tab"} href={comFiltro(f, "vista", v.id)}>
              {v.label}
            </a>
          ))}
        </nav>
      )}

      {on && vista !== "docs" && (
        <form action={addCard} className="card ag-add">
          <input type="hidden" name="quadro" value={quadro} />
          <input type="hidden" name="tipo" value="card" />
          <input name="titulo" placeholder={marketing ? "Nova pauta…" : "Nova ideia…"} required maxLength={TITULO_MAX} className="ag-in grow" />
          <select name="coluna_id" className="ag-in" title={marketing ? "Coluna" : "Seção"}>
            {colunas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icone ? `${c.icone} ` : ""}
                {c.nome}
              </option>
            ))}
          </select>
          <select name="projeto" className="ag-in" title="Projeto">
            <option value="">— transversal —</option>
            {slugs.map((slug) => (
              <option key={slug} value={slug}>
                {slug}
              </option>
            ))}
          </select>
          <select name="responsavel" className="ag-in" title="Responsável">
            <option value="">— sem responsável —</option>
            {(RESPONSAVEIS as Opcao[]).map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          {marketing && (
            <>
              <select name="canal" className="ag-in" title="Canal">
                <option value="">— canal —</option>
                {(CANAIS as Opcao[]).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input type="date" name="data" className="ag-in" title="Data de publicação" />
            </>
          )}
          <button className="ag-btn">Adicionar</button>
        </form>
      )}

      {on && vista === "docs" && (
        <form action={addCard} className="card ag-add">
          <input type="hidden" name="quadro" value={quadro} />
          <input type="hidden" name="tipo" value="doc" />
          <input name="titulo" placeholder="Novo documento — processo ou estudo…" required maxLength={TITULO_MAX} className="ag-in grow" />
          <select name="responsavel" className="ag-in" title="Responsável">
            <option value="">— sem responsável —</option>
            {(RESPONSAVEIS as Opcao[]).map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <button className="ag-btn">Criar documento</button>
        </form>
      )}

      {/* Filtro por GET: a visão inteira cabe na URL, então é compartilhável e sobrevive ao
          reload e às server actions, que revalidam a rota sem trocar a querystring. */}
      <form className="card ag-add" method="get">
        {vista !== "kanban" && <input type="hidden" name="vista" value={vista} />}
        {f.mes && <input type="hidden" name="mes" value={f.mes} />}
        <input
          className="ag-in grow"
          type="search"
          name="q"
          defaultValue={f.q}
          maxLength={100}
          placeholder="Filtrar por título, projeto ou descrição…"
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
        <select name="responsavel" defaultValue={f.responsavel} className="ag-in" aria-label="Filtrar por responsável">
          <option value="">todo mundo</option>
          {(RESPONSAVEIS as Opcao[]).map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        {marketing && (
          <select name="canal" defaultValue={f.canal} className="ag-in" aria-label="Filtrar por canal">
            <option value="">todo canal</option>
            {(CANAIS as Opcao[]).map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        )}
        <button className="ag-btn sec">Filtrar</button>
      </form>

      {ativos.length > 0 && (
        <div className="ag-chips">
          <span className="ag-chips-cont">
            {visiveis.length} de {cards.length} cards
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

      {vista === "kanban" && (
        <div className={marketing ? "q-colunas" : "q-secoes"}>
          {(agruparPorColuna(doFluxo, colunas) as { coluna: PautaColuna; cards: PautaCard[] }[]).map(
            ({ coluna, cards: daColuna }) => (
              <section key={coluna.id} className="card ag-section q-coluna">
                <ColunaHead
                  coluna={coluna}
                  quadro={quadro}
                  cards={daColuna.length}
                  totalColunas={colunas.length}
                  on={on}
                />
                {daColuna.length === 0 ? (
                  <p className="ag-vazio">{ativos.length > 0 ? "Nenhum card sobreviveu ao filtro." : "Nada aqui."}</p>
                ) : (
                  <ul className="ag-list">
                    {daColuna.map((c) => (
                      <Card key={c.id} card={c} colunas={colunas} slugs={slugs} anexos={anexosDe(c.id)} voltar={voltar} on={on} />
                    ))}
                  </ul>
                )}
              </section>
            ),
          )}
          {on && (
            <section className="card ag-section q-coluna q-coluna-nova">
              <form action={addColuna} className="q-coluna-form">
                <input type="hidden" name="quadro" value={quadro} />
                <input name="icone" placeholder="🙂" maxLength={4} className="ag-in q-icone" aria-label="Ícone da coluna nova" />
                <input
                  name="nome"
                  placeholder={marketing ? "nova coluna…" : "nova seção…"}
                  maxLength={COLUNA_NOME_MAX}
                  required
                  className="ag-in"
                  aria-label="Nome da coluna nova"
                />
                <button className="ag-btn">+</button>
              </form>
            </section>
          )}
        </div>
      )}

      {vista === "calendario" && (
        <section className="card ag-section">
          <div className="q-cal-nav">
            <a className="ag-btn sec" href={comFiltro(f, "mes", mesVizinho(ym, -1))}>
              ‹ {rotuloMes(mesVizinho(ym, -1))}
            </a>
            <h2 className="ag-h">{rotuloMes(ym)}</h2>
            <a className="ag-btn sec" href={comFiltro(f, "mes", mesVizinho(ym, 1))}>
              {rotuloMes(mesVizinho(ym, 1))} ›
            </a>
          </div>
          <div className="q-cal">
            {(WD_LABELS as string[]).map((l) => (
              <div key={l} className="q-cal-wd">
                {l.slice(0, 3)}
              </div>
            ))}
            {(gradeDoMes(ym) as (string | null)[][]).flat().map((dia, i) => (
              <div key={dia ?? `vazio-${i}`} className={dia ? "q-cal-dia" : "q-cal-dia q-cal-fora"}>
                {dia && <div className="q-cal-n">{Number(dia.slice(8, 10))}</div>}
                {dia &&
                  (porDia[dia] ?? []).map((c) => (
                    <div key={c.id} className="q-cal-card">
                      {c.canal && <span className="pill">{rotuloCanal(c.canal)}</span>} {c.titulo}
                    </div>
                  ))}
              </div>
            ))}
          </div>
          <p className="foot">
            Card sem data não aparece em dia nenhum e continua acessível no fluxo. O mês e os
            filtros ficam na URL — o endereço desta tela abre igual para quem receber o link.
          </p>
        </section>
      )}

      {vista === "docs" && (
        <section className="card ag-section">
          <h2 className="ag-h">Processo e estudo ({docs.length})</h2>
          {docs.length === 0 ? (
            <p className="ag-vazio">Nenhum documento ainda.</p>
          ) : (
            <ul className="ag-list">
              {docs.map((c) => (
                <Card key={c.id} card={c} colunas={colunas} slugs={slugs} anexos={anexosDe(c.id)} voltar={voltar} on={on} />
              ))}
            </ul>
          )}
          <p className="foot">
            Documento não entra em coluna nem no calendário — é o que a casa sabe, não o que está
            para publicar.
          </p>
        </section>
      )}

      {arquivados.length > 0 && (
        <details className="card table-details">
          <summary>📥 Arquivados ({arquivados.length})</summary>
          <ul className="ag-list">
            {arquivados.map((c) => (
              <Card key={c.id} card={c} colunas={colunas} slugs={slugs} anexos={anexosDe(c.id)} voltar={voltar} on={on} />
            ))}
          </ul>
        </details>
      )}

      <p className="foot">
        {marketing
          ? "Quadro de Marketing: pauta que ainda não é compromisso. As colunas são editáveis pelo ⚙ de cada uma — acrescentar uma etapa não exige publicar versão nova do hub. Coluna com card dentro não é removível, e a contagem aparece antes do clique."
          : "Quadro de Ideias: site novo, serviço novo ou melhoria no que já existe. Ideia não é “feita” — o único encerramento é arquivar."}{" "}
        <strong>Nada daqui vai para a Agenda ou para o ranking</strong> — mandar um card para a
        execução é decisão de pessoa, e por enquanto se faz criando a tarefa na Agenda à mão. Filtro
        e vista vivem na URL: a tela é compartilhável e sobrevive a criar, mover, arquivar e apagar.
        As colunas continuam visíveis mesmo vazias, para o filtro não esconder que a etapa existe.
      </p>
    </main>
  );
}
