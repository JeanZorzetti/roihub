// A corrida noturna do aparato que já existia e só rodava quando alguém digitava o comando.
// O Actions só dispara; o trabalho é AQUI porque o `probe-pool` precisa do claude-cli e do
// `CLAUDE_CODE_OAUTH_TOKENS`, e nenhum dos dois existe no runner do GitHub.
//
// Três coletores são zero LLM (rede pura + API do GitHub). O quarto gasta 1 chamada por conta
// do pool — o toque mais barato que existe, e o único jeito de DATAR o 403 da conta 3.
import { insertTask, estadoAnterior, gravarEstado, dbOn } from "@/lib/db";
import { listProjects } from "@/lib/projects";
import { todaySP, addDaysISO } from "@/lib/agenda.mjs";
import { rodarProjeto } from "@/lib/conformidade.mjs";
import { inventariarServido } from "@/lib/gateways-servido.mjs";
import { inventariarRepo } from "@/lib/gateways-repo.mjs";
import { sondar } from "@/lib/reranker.mjs";
import {
  coletarConformidade,
  coletarGateways,
  coletarPool,
  coletarRepo,
  diffEstado,
  mesclarEstado,
  montarCard,
  primeiraCorrida,
} from "@/lib/estado-noturno.mjs";
import { hashConta, celulasIA } from "@/lib/telemetria.mjs";
import { atualizarPool, poolDatado, janela, ultimaSonda, consolidar, expirar } from "@/lib/telemetria-db.mjs";

export const runtime = "nodejs";
// `conformidade` faz ~140 requisições, `gateways` ~250 e `gateways-repo` puxa 35 árvores do
// GitHub. Medido à mão os três somam ~2 min; o dobro disso é a margem, e o proxy do EasyPanel
// precisa acompanhar igual ao autopublish.
export const maxDuration = 600;

type Falha = { dominio: string; erro: string };

const tokensDoPool = () =>
  String(process.env.CLAUDE_CODE_OAUTH_TOKENS ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

export async function POST() {
  // A autenticação é do middleware (Bearer CRON_SECRET) — sem isenção lá, esta rota cai no
  // Basic auth do hub e o cron leva 401.
  if (!dbOn()) return Response.json({ error: "sem DATABASE_URL" }, { status: 503 });

  const runDate = todaySP();
  const projetos = (await listProjects()).filter((p) => p.url);

  // Janela padrão da observabilidade de IA: últimas 24h, prod (a mesma da aba /ia).
  const agoraIA = new Date();
  const desdeIA = new Date(agoraIA.getTime() - 24 * 3_600_000);

  const coletores = [
    { dominio: "CONF", rodar: () => coletarConformidade(projetos, rodarProjeto) },
    { dominio: "GTW", rodar: async () => coletarGateways(await inventariarServido(projetos)) },
    { dominio: "REPO", rodar: async () => coletarRepo(await inventariarRepo(projetos)) },
    {
      dominio: "POOL",
      rodar: async () => {
        // A sonda mede o pool EM REPOUSO — por isso roda antes das 00:13 do autopublishing
        // (contracts/estado-noturno-ia.md). `atualizarPool` grava a transição em `ia_pool`
        // (specs/002-observabilidade-ia US2); o rótulo do card lê de volta por `poolDatado()`,
        // que é quem tem a data — re-chaveado por hash da conta, nunca índice (FR-002a).
        const tokens = tokensDoPool();
        const leituras = await sondar(tokens);
        await atualizarPool(tokens.map((token, i) => ({ conta: hashConta(token), estado: leituras[i].estado })), agoraIA);
        return coletarPool(await poolDatado());
      },
    },
    {
      // Quinto coletor, serial como os outros (specs/002-observabilidade-ia US4). Só
      // transição categórica vira célula — "zero linha na série" é lacuna (célula própria),
      // nunca um throw: o throw aqui é reservado para o banco não responder de verdade.
      dominio: "IA",
      rodar: async () => {
        const [linhas, sonda] = await Promise.all([
          janela({ desde: desdeIA, ate: agoraIA }),
          ultimaSonda(),
        ]);
        return celulasIA(linhas, [], sonda, agoraIA);
      },
    },
  ];

  // Um coletor por vez, de propósito: o `sondar` troca `process.env.CLAUDE_CODE_OAUTH_TOKENS`
  // durante a sondagem, e em paralelo com os outros a variável global viraria corrida.
  // ponytail: serial resolve; se um dia doer o tempo, isole o POOL num worker em vez de
  // paralelizar os quatro.
  const atual: Record<string, string> = {};
  const dominiosOk: string[] = [];
  const falhas: Falha[] = [];
  for (const { dominio, rodar } of coletores) {
    try {
      Object.assign(atual, await rodar());
      dominiosOk.push(dominio);
    } catch (erro) {
      // Falha FECHADA: o domínio sai do diff em vez de entrar como zero achado. Ausência lida
      // como conserto publicaria "35 violações resolvidas" no dia em que o token expirar.
      falhas.push({ dominio, erro: erro instanceof Error ? erro.message : "desconhecido" });
    }
  }

  const anterior = await estadoAnterior(runDate);
  const primeira = primeiraCorrida(anterior);
  const diff = diffEstado(anterior, atual, dominiosOk);
  await gravarEstado(runDate, mesclarEstado(anterior, atual, dominiosOk));

  // A 1ª corrida não tem contra o que comparar, e um card com 40 "novidades" seria a linha de
  // base disfarçada de achado. Grava o mapa e cala; o diff começa amanhã.
  const card = primeira ? null : montarCard(diff, runDate, falhas);
  // tipo fixo: o card noturno é uma lista nominal pra CONFERIR célula por célula (conserto
  // de verdade ou coletor quebrado?) — nunca uma execução. Não depende da heurística.
  if (card)
    await insertTask({
      ...card,
      projeto: null,
      weekday: null,
      descricao: card.descricao,
      tipo: "conferencia",
      responsavel: null,
    });

  // Consolidação e expiração da série de IA rodam DEPOIS do diff/card, nessa ordem — inverter
  // perderia o último dia (D8). Best-effort: erro aqui não pode derrubar a corrida noturna
  // inteira, que já produziu o card de verdade acima.
  let resumo = 0;
  let expiradas = 0;
  try {
    resumo = await consolidar(addDaysISO(runDate, -1));
    expiradas = await expirar(90);
  } catch {
    // silencioso — mesmo critério do coletor best-effort acima.
  }

  // "ok" só quando o coletor IA rodou (não estourou) E não há célula de lacuna — qualquer
  // outra combinação é reportada como lacuna: incerto nunca lê como saudável (D7).
  const telemetria = dominiosOk.includes("IA") && !Object.hasOwn(atual, "IA:coletor:telemetria") ? "ok" : "lacuna";

  return Response.json({
    runDate,
    primeira,
    celulas: Object.keys(atual).length,
    novos: diff.novos.length,
    sumidos: diff.sumidos.length,
    falhas,
    card: card ? "criado" : "nenhum",
    resumo,
    expiradas,
    telemetria,
  });
}
