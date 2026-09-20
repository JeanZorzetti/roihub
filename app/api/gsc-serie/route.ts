// A corrida que grava a série diária do Search Console (021).
//
// O Actions só dispara (`.github/workflows/serie-gsc.yml`); o trabalho é AQUI porque o runner do
// GitHub não tem `GOOGLE_SERVICE_ACCOUNT_JSON` nem `DATABASE_URL`, e colocá-los lá espalharia
// segredo por um segundo ambiente sem ganho nenhum.
//
// Rota própria em vez de mais um coletor em `/api/estado`: aquela roda na janela que o Princípio
// IV declara intocável, e uma indisponibilidade do GSC passaria a poder derrubar o card noturno.
import { gscSerieDeUmHost, gscSerieFiltrada } from "@/lib/gsc";
import { projetosDeBusca } from "@/lib/projects";
import { hostsDeclarados } from "@/lib/projects.mjs";
import { gravarDiasGsc, gravarMarcaGsc, ultimoDiaGsc, dbOn } from "@/lib/db";
import {
  janelaDaCorrida,
  diasParaGravar,
  somarSeriesPorHost,
  assinaturaDeHosts,
  DIAS_BACKFILL,
} from "@/lib/serie-gsc.mjs";
import { marcaDeclarada, adensarDias, completude } from "@/lib/marca.mjs";

export const runtime = "nodejs";
// O backfill é ~1 requisição por projeto; a corrida diária, idem. Medida contra a de `/api/estado`
// (~2 min para ~425 requisições), esta é ordem de segundos. 300 é margem larga de propósito —
// e, ao contrário daquela rota, não encosta no limite do proxy do EasyPanel.
export const maxDuration = 300;

export async function POST(req: Request) {
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

  // 029 — `desde` reabre a janela do TOTAL para trás, e é assim que o histórico de uma transição de
  // domínio é corrigido: a mesma corrida, com outro início. Script próprio repetiria o laço de
  // projetos, as três pernas e a gravação — quatro lugares para divergir no primeiro conserto que
  // só um dos dois recebesse. As sete colunas de marca não precisam dele: elas já rodam na janela
  // de backfill de 480 dias a cada corrida e se recorrigem sozinhas.
  const desde = await (async () => {
    try {
      const corpo = (await req.json()) as { desde?: unknown };
      return typeof corpo?.desde === "string" ? corpo.desde : null;
    } catch {
      return null; // corpo vazio é o caso comum: o cron dispara sem body
    }
  })();
  if (desde !== null && !/^\d{4}-\d{2}-\d{2}$/.test(desde)) {
    return Response.json({ error: "desde inválido", esperado: "YYYY-MM-DD" }, { status: 400 });
  }

  const gravados: Record<string, number> = {};
  const backfills: string[] = [];
  const semPropriedade: string[] = [];
  const falhas: { projeto: string; erro: string }[] = [];
  // 025: as três saídas novas. `semMarca` traz o MOTIVO e não só o slug — `ausente`, `sem-termos` e
  // `sem-pais` são três faltas diferentes com três consertos diferentes.
  const marca: Record<string, unknown> = {};
  const conferencia: Record<string, unknown> = {};
  const semMarca: { projeto: string; motivo: string }[] = [];
  // 026: dias que a guarda de host recusou — a série daquele projeto foi medida em outro site.
  const recusados: { projeto: string; host: string | null; dias: number }[] = [];
  // 029: os hosts que ENTRARAM na soma de cada projeto, e os declarados que não têm mais
  // propriedade no Search Console. `somados` é o que torna a corrida auditável sem abrir o banco:
  // host que sumir da lista sem ninguém ter mexido na declaração encolheu a soma — e o número do
  // dia encolheu junto.
  const somados: Record<string, string[]> = {};
  const encerrados: { projeto: string; host: string }[] = [];

  // Em SÉRIE, não em Promise.all: são requisições ao mesmo endpoint do Google com a mesma
  // credencial, e disparar dezenas de uma vez é o caminho mais curto para um 429 que transformaria
  // a corrida inteira em falha por pressa.
  for (const p of projetos) {
    try {
      const ultimo = await ultimoDiaGsc(p.slug);
      const janela = janelaDaCorrida(ultimo);
      const inicioTotal = desde ?? janela.inicio;
      // 029 — a corrida mede TODOS os hosts que o card declara, não o host da `url` atual. Medido
      // na Atma em 18/09/2026, quatro dias depois da troca: `atma.roilabs.com.br` ainda valia 1.146
      // impressões em 15/09 contra 31 de `usealigner.com`. Ler só o novo gravou 35 em 16/09, ~3% do
      // que o negócio fez. É a mesma régua que o bloco de Comportamento (GA4) desta tela já usa —
      // "o site" é o conjunto declarado, e não um host.
      const declarados: string[] = hostsDeclarados(p);
      const respostas: { host: string; days: { date: string }[] }[] = [];
      const vivos: string[] = [];
      let abortou = "";
      for (const h of declarados) {
        const s = await gscSerieDeUmHost(`https://${h}/`, inicioTotal, janela.fim);
        // `null` é ausência ESTRUTURAL (host fora de toda propriedade) e `{erro}` é falha
        // transitória — a distinção que `lib/gsc.ts` mantém. 029: a ausência estrutural de um host
        // declarado é ele ENCERRADO (propriedade removida da conta), e a corrida segue com os que
        // sobraram; a falha aborta o projeto, porque soma parcial é indistinguível de queda real.
        if (s === null) {
          encerrados.push({ projeto: p.slug, host: h });
          continue;
        }
        if ("erro" in s) {
          abortou = `${h}: ${s.erro}`;
          break;
        }
        respostas.push({ host: h, days: s.days });
        vivos.push(h);
      }
      if (abortou) {
        falhas.push({ projeto: p.slug, erro: abortou.slice(0, 60) });
        continue;
      }
      if (!vivos.length) {
        semPropriedade.push(p.slug);
        continue;
      }
      somados[p.slug] = vivos;
      const dias = diasParaGravar(somarSeriesPorHost(respostas));
      // 026/029 — a assinatura do que ESTA corrida somou. Sai dos hosts declarados e não da
      // propriedade: `sc-domain:` cobre o domínio inteiro, e é o host que `queryTimeseries` usa
      // para filtrar — ou seja, é ele que identifica o site medido. Sem passá-la adiante, trocar a
      // `url` de um projeto faz a corrida seguinte reescrever a história com números de outro site.
      const host = assinaturaDeHosts(vivos);
      gravados[p.slug] = await gravarDiasGsc(p.slug, dias, host, declarados);
      // Dia recusado pela guarda de host é ACHADO, não silêncio: a série mudou de casa e alguém
      // precisa decidir o que a tela mostra. `pedidos - gravados` é a conta, aqui e na marca.
      if (dias.length > gravados[p.slug]) {
        recusados.push({ projeto: p.slug, host, dias: dias.length - gravados[p.slug] });
      }
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
      // 029 — cada perna soma os MESMOS hosts vivos do total. Ler a fatia de marca num host e o
      // total noutro produziria uma fração cujo numerador e denominador medem sites diferentes —
      // e é a fatia de não-marca que assina o veredito do topo da tela.
      const pernas = [];
      for (const corte of [undefined, { modo: "inclui" as const, padrao: decl.padrao }, { modo: "exclui" as const, padrao: decl.padrao }]) {
        const porHost = [];
        for (const h of vivos) {
          const r = await gscSerieFiltrada(`https://${h}/`, decl.pais, jm, corte);
          if (r === null) throw new Error("sem propriedade na perna de marca");
          if ("erro" in r) throw new Error(r.erro);
          porHost.push({ host: h, days: r.days });
        }
        pernas.push(adensarDias(jm.inicio, jm.fim, somarSeriesPorHost(porHost)));
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
      const escrita = await gravarMarcaGsc(p.slug, decl.pais, linhasDeMarca, host, declarados);
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
    somados,
    encerrados,
    semPropriedade,
    recusados,
    falhas,
    marca,
    conferencia,
    semMarca,
  });
}
