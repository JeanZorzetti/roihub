// A corrida que grava a série diária do Search Console (021).
//
// O Actions só dispara (`.github/workflows/serie-gsc.yml`); o trabalho é AQUI porque o runner do
// GitHub não tem `GOOGLE_SERVICE_ACCOUNT_JSON` nem `DATABASE_URL`, e colocá-los lá espalharia
// segredo por um segundo ambiente sem ganho nenhum.
//
// Rota própria em vez de mais um coletor em `/api/estado`: aquela roda na janela que o Princípio
// IV declara intocável, e uma indisponibilidade do GSC passaria a poder derrubar o card noturno.
import { gscSeries } from "@/lib/gsc";
import { projetosDeBusca } from "@/lib/projects";
import { gravarDiasGsc, ultimoDiaGsc, dbOn } from "@/lib/db";
import { janelaDaCorrida, diasParaGravar } from "@/lib/serie-gsc.mjs";

export const runtime = "nodejs";
// O backfill é ~1 requisição por projeto; a corrida diária, idem. Medida contra a de `/api/estado`
// (~2 min para ~425 requisições), esta é ordem de segundos. 300 é margem larga de propósito —
// e, ao contrário daquela rota, não encosta no limite do proxy do EasyPanel.
export const maxDuration = 300;

export async function POST() {
  // Princípio V: valida o ambiente na ENTRADA e responde só com os NOMES do que falta.
  const faltando = [
    !dbOn() && "DATABASE_URL",
    !process.env.GOOGLE_SERVICE_ACCOUNT_JSON && "GOOGLE_SERVICE_ACCOUNT_JSON",
  ].filter(Boolean);
  if (faltando.length) return Response.json({ error: "ambiente incompleto", faltando }, { status: 503 });

  // Princípio I: os projetos vêm de `listProjects()`, nunca de `data/projects.json` — e a corrida
  // percorre SÓ os de `SLUGS_DE_BUSCA` (hoje, a Atma). O board de busca é dela; varrer os 35 era
  // escopo errado, não escopo generoso.
  const projetos = await projetosDeBusca();

  const gravados: Record<string, number> = {};
  const backfills: string[] = [];
  const semPropriedade: string[] = [];
  const falhas: { projeto: string; erro: string }[] = [];

  // Em SÉRIE, não em Promise.all: são requisições ao mesmo endpoint do Google com a mesma
  // credencial, e disparar dezenas de uma vez é o caminho mais curto para um 429 que transformaria
  // a corrida inteira em falha por pressa.
  for (const p of projetos) {
    try {
      const ultimo = await ultimoDiaGsc(p.slug);
      const janela = janelaDaCorrida(ultimo);
      const s = await gscSeries(p.url, janela.inicio, janela.fim);
      // `null` é ausência estrutural (host fora de toda propriedade) e `{erro}` é falha
      // transitória — a distinção que `lib/gsc.ts` mantém e que aqui decide entre um projeto que
      // nunca terá série e um que precisa ser olhado.
      if (s === null) {
        semPropriedade.push(p.slug);
        continue;
      }
      if ("erro" in s) {
        falhas.push({ projeto: p.slug, erro: s.erro });
        continue;
      }
      const dias = diasParaGravar(s.days);
      gravados[p.slug] = await gravarDiasGsc(p.slug, dias);
      if (janela.backfill) backfills.push(p.slug);
    } catch (e) {
      // FR-004: um projeto que estoura não pode levar os outros junto. Mensagem truncada e sem
      // nenhum valor de ambiente, como no resto da casa.
      falhas.push({ projeto: p.slug, erro: e instanceof Error ? e.message.slice(0, 60) : String(e).slice(0, 60) });
    }
  }

  // A corrida responde 200 mesmo com falhas parciais: um projeto fora não é a corrida fora, e o
  // corpo lista nominalmente quem caiu para o Actions não precisar adivinhar pelo status.
  return Response.json({
    projetos: projetos.length,
    linhas: Object.values(gravados).reduce((a, b) => a + b, 0),
    gravados,
    backfills,
    semPropriedade,
    falhas,
  });
}
