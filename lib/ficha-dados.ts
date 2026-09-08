import { listProjects } from "@/lib/projects";
import { montarFicha, posicaoDeAtaque, buracosDeVerdade, valorEmRisco } from "@/lib/okr.mjs";
import { ehApurado } from "@/lib/funil.mjs";
import { distanciaDoMercado } from "@/lib/benchmark.mjs";
import { projetar } from "@/lib/projecao.mjs";
import { montarArvore, camadaDeEntrega, alavancaDePosicao } from "@/lib/arvore-metas.mjs";
import { acoesDoRanking } from "@/lib/agenda.mjs";
import { evaluateAll } from "@/lib/evaluate";
import { dbOn, listDone, listDonos, listDonoDatas } from "@/lib/db";
import { HOJE, coletarLeadsDoHub, coletarDoProjeto } from "@/lib/okr-coleta";
import { montarNiveis, medidoresDeEventos, resolverTicket } from "@/lib/ficha.mjs";
import { SLUGS_DE_CAMPO, celulasDeVitais } from "@/lib/crux.mjs";
import { lerCampo, type Alvo } from "@/lib/crux";

// A composição da ficha, UMA vez só. Existe porque a FR-021 (019) exige que a ação citada na dobra
// e a citada em N6 venham da MESMA chamada de `evaluateAll()` — três telas (`/okr/[slug]`,
// `/okr/[slug]/metodo`, `/okr/[slug]/aquisicao`) passam a precisar desta composição, e duas cópias
// divergiriam na primeira mudança de veredito. É o defeito que a 018 matou nos degraus, um nível
// acima.
//
// É MOVIMENTO, não abstração nova: este é o corpo que vivia dentro de `FichaPage`
// (app/okr/[slug]/page.tsx:382-547), na mesma ordem e com os MESMOS nomes de campo, para o diff da
// página ser de ordem e não de renomeação. NENHUMA regra nova mora aqui — é borda (`pg`,
// `google-auth-library`, `evaluateAll`), e toda decisão continua em `.mjs` (Princípio III).

export type CelulaFicha =
  | { estado: "apurado"; valor: number | string; rotulo: string; fonte: string }
  | { estado: "declarado"; valor: number | string; rotulo: string; declaradoEm: string; oQue: string }
  | { estado: "nao-apurado"; rotulo: string; motivo: string; consultar: string; rotuloBuraco?: "nao-mede" | "falhou-agora" | "tela-nao-le" }
  | { estado: "inferido"; valor: number; rotulo: string; de: string; divida: string };

export type Nivel = {
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
};

export type ArvoreMetas = {
  camadas: {
    chave: string;
    nome: string;
    necessario: { min: number; max: number };
    hoje: { valor: number } | { naoApurado: string };
    gap: { min: number; max: number } | null;
    jaCobre?: boolean;
    divisor: { origem: string; lo: number; hi: number; fonte: string; nota?: string; atravessa: string[] } | null;
  }[];
  parou: { nome?: string; motivo: string } | null;
  bandaAberta: boolean;
};

export type DadosDaFicha = NonNullable<Awaited<ReturnType<typeof dadosDaFicha>>>;

/** `null` quando o projeto não existe — quem chama faz `notFound()`. */
export async function dadosDaFicha(slug: string) {
  const projects = await listProjects();
  const p = projects.find((x) => x.slug === slug);
  // A existência é conferida contra a lista COMPLETA (curados + repos do GitHub), não contra as
  // fichas curadas — projeto com perfil e sem curadoria abre a mesma página (contracts/rota-e-menu.md).
  if (!p) return null;

  // achado 6 do design-review de 03/09: `evaluateAll()`+`listDonos()`+`listDone()`+`listDonoDatas()`
  // (bloco N6 abaixo) não dependem de NADA que a coleta produz — só de `slug`, já disponível aqui.
  // Disparar antes da coleta e só resolver depois do `await` dela sobrepõe os dois custos de rede
  // em vez de somá-los (TTFB medido em prod: 3,3s a frio). Mesmo try/catch de antes, só adiado.
  const on = dbOn();
  const agendaPromise = on
    ? Promise.all([
        evaluateAll().then((r) => r.filter((x) => x.curated)),
        listDonos().catch(() => new Map<string, string>()),
        listDone().catch(() => new Set<string>()),
        listDonoDatas().catch(() => new Map<string, string>()),
      ])
    : null;

  // ── 023/T014: os Core Web Vitals de CAMPO. Fora de `SLUGS_DE_CAMPO` a chamada nem acontece
  // (FR-014) e os quatro medidores seguem dizendo "sem coletor nesta requisição", que é verdade.
  // Iniciada AQUI e aguardada só na composição de `disponiveisN5`: a ficha é `force-dynamic` e já
  // paga GSC + GA4 + Postgres por request; mais um `await` em fila é latência somada à toa. O
  // `.catch` é a FR-012 em uma linha — `lerCampo()` não lança, e mesmo assim a ficha não pode
  // virar erro por causa de um medidor.
  const alvoCrux: Alvo | null = SLUGS_DE_CAMPO.includes(slug) ? { tipo: "origem", valor: p.url.replace(/\/+$/, "") } : null;
  const cruxPromise = alvoCrux
    ? lerCampo(alvoCrux).catch((e) => ({ estado: "falhou" as const, erro: e instanceof Error ? e.message.slice(0, 60) : "leitura de campo falhou" }))
    : null;

  // ── T013a: a montagem, na ordem do contrato — coleta → montarFicha → posicaoDeAtaque → projetar → montarNiveis.
  const { porPipeline, erroLeads } = await coletarLeadsDoHub();
  const { cliques, leads, contatados, respondeu, ticket, vendas, impressoes, orcamentos, motivos, ga4, ga4ev, orcamentosSemLead, serieGsc, linhasOrc, leadsPorId, paginas, janelas } = await coletarDoProjeto(p, { porPipeline, erroLeads });
  const ficha = montarFicha({ slug: p.slug, perfil: p.perfil, coletado: { cliques, leads, contatados, respondeu, vendas, orcamentos }, declaracoes: p.declaracoes });
  // 018/FR-007/FR-011: a cadeia de Conversão só existe A PARTIR de `lead` — `visitante` é
  // Descoberta e ligá-lo à cadeia seria taxa cruzando janelas. Enquanto `PERFIS.D.marcos` ainda
  // começa em `visitante` (US2/T024 tira `visitante` e `contatado` de lá), a página filtra na
  // exibição; perfil que não começa em `visitante` (ex.: C, que começa em `contato`) não perde nada.
  const iniciaEmVisitante = ficha.marcos[0]?.chave === "visitante";
  const marcosCadeia = iniciaEmVisitante ? ficha.marcos.slice(1) : ficha.marcos;
  const taxasCadeia = iniciaEmVisitante ? ficha.taxas.slice(1) : ficha.taxas;
  const veredito = posicaoDeAtaque(ficha);
  // 019/FR-004: a MESMA lista que `posicaoDeAtaque()` consome, não uma segunda leitura da tela.
  const buracos = buracosDeVerdade(ficha.marcos) as { chave: string; nome: string; fonte: string; motivo: string; familia: string; transitorio: boolean }[];
  // 019/FR-013: o pipeline somado. `fechados` vem do DEGRAU FINAL da cadeia (o `tratamento` do
  // perfil D), nunca de `orcamentos.status` — FR-013a. Janela de CONVERSAO, a mesma que produziu
  // a cadeia; nenhuma chamada de rede nova (as linhas já vieram na query de `lerFontePropria()`).
  const degrauFinal = ficha.marcos.at(-1) ?? null;
  const risco = valorEmRisco(linhasOrc, leadsPorId, janelas.conversao, p.motivosDePerda ?? null, degrauFinal?.celula ?? { naoApurado: "cadeia sem degrau final" }) as {
    enviados: { valor: number; n: number };
    fechados: { valor: number } | { naoApurado: string };
    vivos: { pessoas: number; valor: number } | null;
    perdidos: { pessoas: number; valor: number } | null;
    semLead: { n: number; valor: number } | null;
  } | null;
  // O SEGUNDO veredito, e ele é PARALELO: a §7 manda por fato apurado, a régua só dimensiona.
  // Nada aqui realimenta `posicaoDeAtaque` — se um dia realimentar, a §7 passa a decidir por
  // benchmark, que é exatamente o que a R6 recusa.
  const mercado = distanciaDoMercado(ficha);
  // 018/FR-022/FR-034: resolverTicket() ANTES de projetar() — `lib/projecao.mjs` não ganha regra
  // nova, só recebe o ticket já resolvido. `montarNiveis()` chama a MESMA função pura com os
  // mesmos dois insumos (ticket, meta) para N1/N2 — o resultado é idêntico por construção.
  const ticketCel = resolverTicket(ticket, p.meta ?? null);
  const metaComTicket = ticketCel.estado === "nao-apurado" ? (p.meta ?? null) : { ...p.meta, ticket: (ticketCel as { valor: number }).valor };
  const projecao = projetar({ ficha, meta: metaComTicket, hoje: HOJE });

  // ── Árvore de metas (016) — a descida que a 010 começa e para. `projetar()` divide a meta uma
  // vez (`meta ÷ âncora`); `montarArvore()` continua até impressões, escolhendo o divisor de cada
  // camada entre taxa apurada, ponte sobre buraco de medição e UMA faixa de mercado.
  // O CTR sai da mesma série do GSC que já deu cliques e impressões — sem chamada nova (FR-008).
  const cliquesV = ehApurado(cliques) ? (cliques as { valor: number }).valor : null;
  const impressoesV = ehApurado(impressoes) ? (impressoes as { valor: number }).valor : null;
  // 019/T051/FR-030: o `ctr` passa a carregar A JANELA QUE O PRODUZIU. Para projeto com `epoca`,
  // ele sai de uma FATIA da série de 84 dias que `gscSeries()` já buscou — zero chamada de rede
  // nova (a época da atma, 37 dias, cabe inteira nos 84). A janela declarada é a que a série DEU,
  // não a que foi pedida: é ela que `montarArvore()` compara contra a de Conversão, e rotular a
  // fatia com as datas da época esconderia exatamente o truncamento que a guarda existe para pegar.
  const diasGsc = serieGsc && "days" in serieGsc ? serieGsc.days : null;
  const fatia =
    p.epoca && diasGsc
      ? diasGsc.filter((d) => d.date >= janelas.conversao.inicio && d.date <= janelas.conversao.fim)
      : null;
  const ctr = fatia?.length
    ? (() => {
        const c = fatia.reduce((t, d) => t + d.clicks, 0);
        const i = fatia.reduce((t, d) => t + d.impressions, 0);
        return i > 0
          ? { valor: c / i, impressoes: { valor: i }, janela: { inicio: fatia[0].date, fim: fatia[fatia.length - 1].date } }
          : undefined;
      })()
    : cliquesV != null && impressoesV
      ? // FR-032: projeto SEM época mantém o comportamento de hoje — `ctr` sem janela, e a
        // contenção falha por construção, onde já falhava.
        { valor: cliquesV / impressoesV, impressoes }
      : undefined;
  // Mesmo casting de `montarNiveis()` abaixo: o módulo é .mjs (para `node --test` importar sem
  // transpilar) e o TS não estreita `Celula` por `ehApurado()`.
  const arvore = montarArvore({ ficha, projecao, ctr, janelaConversao: janelas.conversao }) as ArvoreMetas;
  const camadaImpressao = arvore.camadas.find((c) => c.chave === "impressao");
  const camadaClique = arvore.camadas.find((c) => c.chave === "visitante");
  const entrega = camadaDeEntrega(
    camadaImpressao?.necessario ?? null,
    paginas && "paginas" in paginas ? paginas.paginas : null,
    impressoesV ?? 0,
    projecao.normalizacao?.diasRestantes ?? 0,
  );
  const ctrAlvo = alavancaDePosicao(camadaClique?.necessario ?? null, impressoesV ?? 0);

  // ── N6 — a MESMA composição de app/agenda/page.tsx (FR-030, SC-018): a ordem de `evaluateAll()`
  // filtrada por `curated` é de onde sai o `#N · score`; passar `listProjects()` cru mudaria o
  // `meta` de todos os itens (o rótulo de ranking não é a ordem — já apagou ranking da tela antes).
  let itensAgenda: ReturnType<typeof acoesDoRanking> | null = null;
  let erroAgenda: string | null = null;
  let datasDono = new Map<string, string>();
  if (!agendaPromise) {
    erroAgenda = "DATABASE_URL ausente";
  } else {
    try {
      const [curados, donos, doneSet, datas] = await agendaPromise;
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
  // 023/T009: `valor` também `string` (a célula de vital já chega FORMATADA — "2,4 s", "0,08")
  // e `fonte` também no ramo ausente, porque é ela que vira o `consultar` da R4 em montarN5().
  const disponiveisN5: Record<string, { valor: number | string; fonte?: string } | { naoApurado: string; fonte?: string; rotuloBuraco?: "falhou-agora" }> = {
    impressoes,
    "lead-gravado": leads,
    "gateway-ligado": vendas,
    // 018/FR-032/FR-033: abandono compara form_start (GA4, janela COMPORTAMENTO) com lead (banco,
    // janela CONVERSAO) — só quando a primeira cabe inteira dentro da segunda.
    ...medidoresDeEventos(ga4ev, { lead: leads, janelaGa4: janelas.comportamento, epoca: janelas.conversao }),
    // 023: os quatro vitais de campo. `celulasDeVitais()` SEMPRE devolve as quatro chaves —
    // é a presença delas que faz `montarNiveis()` exibir a família de Entrega (FR-002a).
    ...(alvoCrux && cruxPromise ? celulasDeVitais(await cruxPromise, alvoCrux) : {}),
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
    // A janela do GA4 — a mesma que `coletarDoProjeto()` usou para buscá-lo (018, D8). Divergir da
    // janela de Conversão deixou de ser defeito (FR-010); este parâmetro só serve para o N4 saber
    // comparar contra a janela CERTA, não contra qualquer uma.
    janela: { inicio: janelas.comportamento.inicio, fim: janelas.comportamento.fim },
    ga4,
    orcamentosSemLead,
    // 018/FR-013: `contatados` alimenta a NOTA de N3 ("100% contatados..."), não mais um marco.
    // `cliques` idem — N4 lê direto, sem depender de `visitante` existir em `ficha.marcos`.
    contatados,
    cliques,
    ticketApurado: ticket,
  }) as Nivel[];

  // O veredito já é calculado por escolherFamilia() dentro de montarNiveis() — só precisa subir
  // para o topo da página, onde a pergunta "onde atacar" é respondida antes de rolar 6 cards.
  const n5 = niveis.find((n) => n.id === "N5");
  const n6 = niveis.find((n) => n.id === "N6");
  // achado 6: quando não há ação com dono, N6 não pode ficar mudo — o próximo dado a apurar já
  // está calculado (é o primeiro buraco da própria cadeia), só nunca subia até aqui. Sugestão
  // SEM dono, rotulada como tal — não é ação da agenda, é o que a árvore já sabe.
  const proximoBuraco = ficha.marcos.find((m: { celula: { valor: number } | { naoApurado: string } }) => !ehApurado(m.celula)) ?? null;
  const pendentes = n6?.itens?.filter((item) => !item.descontinuado) ?? [];

  // achado 8: o nome do card carrega a descrição inteira do produto ("Atma Aligner — alinhadores
  // invisíveis + infoproduto R$ 47"), incluindo uma oferta DESCONTINUADA (ver N6 abaixo) — e ela
  // se repetia no eyebrow e no h1 com o mesmo peso do nome. Split só de apresentação: o nome curto
  // sobe para o título, o resto desce para uma legenda menor.
  const [nomeCurto, ...restoNome] = p.nome.split(" — ");
  const nomeDescricao = restoNome.join(" — ");

  const necessarioNaJanela = ehApurado(projecao.n1Janela) ? (projecao.n1Janela as { valor: number }).valor : null;

  return {
    p,
    ficha,
    veredito,
    mercado,
    projecao,
    arvore,
    niveis,
    janelas,
    motivos,
    orcamentos,
    buracos,
    risco,
    degrauFinal,
    pendentes,
    cliques,
    impressoes,
    ctr,
    entrega,
    ctrAlvo,
    iniciaEmVisitante,
    marcosCadeia,
    taxasCadeia,
    ticketCel,
    metaComTicket,
    n5,
    n6,
    proximoBuraco,
    nomeCurto,
    nomeDescricao,
    necessarioNaJanela,
  };
}
