// A corrida noturna do aparato que já existia e só rodava quando alguém digitava o comando.
// O Actions só dispara; o trabalho é AQUI porque o `probe-pool` precisa do claude-cli e do
// `CLAUDE_CODE_OAUTH_TOKENS`, e nenhum dos dois existe no runner do GitHub.
//
// Três coletores são zero LLM (rede pura + API do GitHub). O quarto gasta 1 chamada por conta
// do pool — o toque mais barato que existe, e o único jeito de DATAR o 403 da conta 3.
import { insertTask, estadoAnterior, gravarEstado, dbOn } from "@/lib/db";
import { listProjects } from "@/lib/projects";
import { todaySP } from "@/lib/agenda.mjs";
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

  const coletores = [
    { dominio: "CONF", rodar: () => coletarConformidade(projetos, rodarProjeto) },
    { dominio: "GTW", rodar: async () => coletarGateways(await inventariarServido(projetos)) },
    { dominio: "REPO", rodar: async () => coletarRepo(await inventariarRepo(projetos)) },
    { dominio: "POOL", rodar: async () => coletarPool(await sondar(tokensDoPool())) },
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
  if (card) await insertTask({ ...card, projeto: null, weekday: null, descricao: card.descricao });

  return Response.json({
    runDate,
    primeira,
    celulas: Object.keys(atual).length,
    novos: diff.novos.length,
    sumidos: diff.sumidos.length,
    falhas,
    card: card ? "criado" : "nenhum",
  });
}
