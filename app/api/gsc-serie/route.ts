// A corrida que grava a série diária do Search Console (021).
//
// O Actions só dispara (`.github/workflows/serie-gsc.yml`); o trabalho é AQUI porque o runner do
// GitHub não tem `GOOGLE_SERVICE_ACCOUNT_JSON` nem `DATABASE_URL`, e colocá-los lá espalharia
// segredo por um segundo ambiente sem ganho nenhum.
//
// Rota própria em vez de mais um coletor em `/api/estado`: aquela roda na janela que o Princípio
// IV declara intocável, e uma indisponibilidade do GSC passaria a poder derrubar o card noturno.
import { gscSeries, gscSerieFiltrada } from "@/lib/gsc";
import { projetosDeBusca } from "@/lib/projects";
import { gravarDiasGsc, gravarMarcaGsc, ultimoDiaGsc, dbOn } from "@/lib/db";
import { janelaDaCorrida, diasParaGravar, DIAS_BACKFILL } from "@/lib/serie-gsc.mjs";
import { marcaDeclarada, adensarDias, completude } from "@/lib/marca.mjs";

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
  // 025: as três saídas novas. `semMarca` traz o MOTIVO e não só o slug — `ausente`, `sem-termos` e
  // `sem-pais` são três faltas diferentes com três consertos diferentes.
  const marca: Record<string, unknown> = {};
  const conferencia: Record<string, unknown> = {};
  const semMarca: { projeto: string; motivo: string }[] = [];

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

      // ── 025: a fatia de marca, DEPOIS de o total já estar gravado ───────────────────────────
      // Projeto sem lista curada não perde a série do total: ele sai em `semMarca` com o motivo, e
      // as sete colunas ficam NULL — "não declarada", nunca "zero buscas de marca" (FR-004).
      const decl = marcaDeclarada(p);
      if (decl.motivo) {
        semMarca.push({ projeto: p.slug, motivo: decl.motivo });
        continue;
      }

      // A janela das três pernas é a de BACKFILL toda corrida, não a incremental do total (D4):
      // a lista de termos é curadoria, e quando ela muda a história inteira precisa ser
      // reclassificada — senão o período antigo e o novo ficariam com réguas diferentes dentro da
      // mesma série. Isso também mata o backfill como evento: esperar não custa histórico.
      const fim = janela.fim;
      const inicio = new Date(Date.parse(fim + "T00:00:00Z") - DIAS_BACKFILL * 864e5)
        .toISOString()
        .slice(0, 10);
      const jm = { inicio, fim };

      // As três pernas na MESMA corrida e na MESMA janela (D13): pernas de corridas diferentes
      // mediriam o deslizamento da janela do GSC na meia-noite UTC (33 e depois 42 na mesma tarde),
      // e o corte de país nas três é o que impede a diferença de medir o próprio corte.
      const pernas = [];
      for (const corte of [undefined, { modo: "inclui" as const, padrao: decl.padrao }, { modo: "exclui" as const, padrao: decl.padrao }]) {
        const r = await gscSerieFiltrada(p.url, decl.pais, jm, corte);
        if (r === null) throw new Error("sem propriedade na perna de marca");
        if ("erro" in r) throw new Error(r.erro);
        pernas.push(adensarDias(jm.inicio, jm.fim, r.days));
      }
      const [totalPais, deMarca, naoMarca] = pernas;

      const linhasDeMarca = totalPais.map((d, i) => ({
        dia: d.dia,
        impressoesPais: d.impressoes,
        cliquesPais: d.cliques,
        impressoesMarca: deMarca[i].impressoes,
        cliquesMarca: deMarca[i].cliques,
        impressoesNaoMarca: naoMarca[i].impressoes,
        cliquesNaoMarca: naoMarca[i].cliques,
      }));
      const escrita = await gravarMarcaGsc(p.slug, decl.pais, linhasDeMarca);
      marca[p.slug] = { dias: linhasDeMarca.length, ...escrita, termos: decl.termos.length, pais: decl.pais };

      // FR-006 registrada: a conferência é a resposta a uma pergunta que só a medição responde.
      // ⚠️ Leia `impressoesMarca > 0` ANTES do veredito — marca zerada com resíduo ≈ 0 diria
      // `fecha` e estaria errado (seria o `includingRegex` exigindo a consulta inteira, com o
      // não-marca engolindo tudo).
      const c = completude(linhasDeMarca) as Record<string, unknown>;
      const { estado, ...resto } = c;
      conferencia[p.slug] = { ...resto, veredito: estado };
    } catch (e) {
      // FR-004: um projeto que estoura não pode levar os outros junto. Mensagem truncada e sem
      // nenhum valor de ambiente, como no resto da casa. Falha SÓ das pernas de marca deixa o
      // total já gravado — o dado honesto não é revertido por causa da parte que não veio.
      falhas.push({ projeto: p.slug, erro: e instanceof Error ? e.message.slice(0, 60) : String(e).slice(0, 60) });
    }
  }

  // A corrida responde 200 mesmo com falhas parciais: um projeto fora não é a corrida fora, e o
  // corpo lista nominalmente quem caiu para o Actions não precisar adivinhar pelo status.
  // `veredito: "contradicao"` também sai em 200: o dado gravado é honesto, e o alarme é o campo.
  return Response.json({
    projetos: projetos.length,
    linhas: Object.values(gravados).reduce((a, b) => a + b, 0),
    gravados,
    backfills,
    semPropriedade,
    falhas,
    marca,
    conferencia,
    semMarca,
  });
}
