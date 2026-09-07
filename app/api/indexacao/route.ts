// A corrida diária que apura quanto do que cada site declara está no índice do Google (022).
//
// O Actions só dispara (`.github/workflows/indexacao.yml`); o trabalho é AQUI pelo mesmo motivo da
// série da 021: o runner do GitHub não tem `GOOGLE_SERVICE_ACCOUNT_JSON` nem `DATABASE_URL`.
//
// A restrição que molda a rota inteira: a URL Inspection API dá ~2000 inspeções/dia POR
// PROPRIEDADE, e 21 dos 35 projetos resolvem para `sc-domain:roilabs.com.br`. Por isso a corrida
// PLANEJA antes de gastar — resolve a propriedade de todo mundo, monta a fila do rodízio e reparte
// o orçamento — em vez de sair inspecionando e descobrir o teto no 429.
import { projetosDeBusca } from "@/lib/projects";
import { gravarIndexacao, ultimasApuracoes, dbOn } from "@/lib/db";
import { buscar, urlDoSitemap } from "@/lib/conformidade.mjs";
import { lerSitemap } from "@/lib/sitemap.mjs";
import { filaDoDia, repartir, amostra, agregar } from "@/lib/indexacao-corrida.mjs";
import { clienteGsc, propriedades, inspecionarIndexacao } from "@/lib/indexacao.mjs";
import { melhorPropriedade } from "@/lib/gsc-consulta.mjs";

export const runtime = "nodejs";
// Rota NOVA: não altera a `maxDuration` de `/api/estado`, então o proxy do EasyPanel não muda
// (Princípio IV). 400 inspeções em série a ~300 ms dão ~2 min; a folga até 800 é para sitemap
// grande e rede lenta, não para gastar.
export const maxDuration = 800;

type Propriedade = { orcamento: number; gastas: number; falhasDeQuota: number };

const num = (nome: string, padrao: number) => {
  const v = Number(process.env[nome]);
  return Number.isFinite(v) && v > 0 ? v : padrao;
};

/**
 * Aplica `fn` em lotes de `n`, preservando a ordem de entrada.
 *
 * MEDIDO na primeira corrida (07/09/2026): o planejamento em série levou 9min22s e o `maxDuration`
 * matou a corrida com 2 projetos de 35 apurados — ANTES de gastar a primeira inspeção. A causa é o
 * timeout de 15 s de `conformidade.mjs`: cada host que não resolve (tapepro, atma) custava 15 s
 * parado, e são 35 projetos × (robots + sitemap + filhos do índice).
 *
 * Ler sitemap é HTTP contra 35 hosts DIFERENTES e não custa quota do GSC — é o oposto da inspeção,
 * que continua em série logo abaixo porque ali são requisições ao MESMO endpoint do Google com a
 * mesma credencial, e disparar dezenas de uma vez é o caminho mais curto para um 429.
 */
async function emLotes<T, R>(itens: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const saida: R[] = [];
  for (let i = 0; i < itens.length; i += n) {
    saida.push(...(await Promise.all(itens.slice(i, i + n).map(fn))));
  }
  return saida;
}

export async function POST() {
  // Princípio V: valida na ENTRADA e responde só com os NOMES do que falta.
  const faltando = [
    !dbOn() && "DATABASE_URL",
    !process.env.GOOGLE_SERVICE_ACCOUNT_JSON && "GOOGLE_SERVICE_ACCOUNT_JSON",
  ].filter(Boolean);
  if (faltando.length) return Response.json({ error: "ambiente incompleto", faltando }, { status: 503 });

  // Tetos configuráveis de propósito: o "~2000/dia" é a cota que o Google documenta e que esta
  // corrida existe para CONFERIR contra o comportamento real. Constante literal aqui exigiria
  // deploy para corrigir um número que é hipótese.
  const tetoPropriedade = num("INSPECOES_POR_PROPRIEDADE", 2000);
  const tetoCorrida = num("INSPECOES_POR_CORRIDA", 400);
  const dia = new Date().toISOString().slice(0, 10);

  // Princípio I: os projetos vêm de `listProjects()`, nunca de `data/projects.json` — e a corrida
  // percorre SÓ os de `SLUGS_DE_BUSCA` (hoje, a Atma). Com um projeto só, o planejamento abaixo
  // (rodízio + repartição de orçamento) continua correto e simplesmente nunca precisa cortar.
  const projetos = await projetosDeBusca();

  const cliente = await clienteGsc();
  const sites = await propriedades(cliente);
  const apuradas = await ultimasApuracoes();

  // ── Planejamento: nenhuma inspeção sai antes deste bloco terminar ──────────
  const inventarios = new Map<string, Awaited<ReturnType<typeof lerSitemap>>>();
  const candidatos = [];
  const falhas: { projeto: string; erro: string }[] = [];
  const planos = await emLotes(projetos, 8, async (p) => {
    try {
      const base = p.url.replace(/\/+$/, "");
      // O robots diz ONDE o sitemap mora; adivinhar `/sitemap.xml` reprovaria o tapepro, que serve
      // `sitemap-index.xml`. Sem robots alcançável, `urlDoSitemap` cai no caminho convencional.
      const robots = await buscar(`${base}/robots.txt`);
      const inv = await lerSitemap(urlDoSitemap(robots.corpo, base), buscar);
      return { p, inv, erro: "" };
    } catch (e) {
      return { p, inv: null, erro: e instanceof Error ? e.message.slice(0, 60) : String(e).slice(0, 60) };
    }
  });
  for (const { p, inv, erro } of planos) {
    // Rede caída lendo o sitemap é FALHA do projeto, não `sem_sitemap`: gravar "não perguntei" como
    // "não há" é a mesma inversão de sinal que a FR-008 proíbe do lado da inspeção.
    if (erro || !inv || inv.erro) {
      falhas.push({ projeto: p.slug, erro: (erro || inv?.erro || "").slice(0, 60) });
      continue;
    }
    inventarios.set(p.slug, inv);
    candidatos.push({
      slug: p.slug,
      propriedade: melhorPropriedade(new URL(p.url).hostname, sites),
      declaradas: inv.urls.length,
      ultimaApuracao: apuradas[p.slug] ?? null,
    });
  }

  const fatias = repartir(filaDoDia(candidatos), tetoPropriedade, tetoCorrida);
  const porSlug = new Map(candidatos.map((c) => [c.slug, c]));

  // ── Execução ───────────────────────────────────────────────────────────────
  const props: Record<string, Propriedade> = {};
  const apurados = [];
  const pulados: { projeto: string; motivo: string; declaradas: number }[] = [];
  // Quatro listas, não uma de "não apurados": cada motivo pede uma frase e um PASSO diferentes na
  // tela (build do site · declaração do próprio site · domínio próprio · esperar a rodada).
  const semSitemap: string[] = [];
  const sitemapVazio: string[] = [];
  const semPropriedade: string[] = [];

  for (const f of fatias) {
    const c = porSlug.get(f.slug)!;
    const inv = inventarios.get(f.slug)!;
    // O motivo do INVENTÁRIO vem antes do motivo do orçamento: um projeto sem sitemap não foi
    // pulado por falta de cota, ele não tem o que inspecionar. Somar os dois num "0%" é a inversão
    // que este repo já pagou uma vez.
    const motivo = inv.motivo ?? f.motivo;
    if (motivo) {
      await gravarIndexacao(f.slug, {
        dia,
        propriedade: c.propriedade,
        // `sem_orcamento` grava `declaradas` preenchido: ler o sitemap não custou quota, e o
        // inventário é verdade mesmo sem inspeção (FR-015).
        declaradas: inv.urls.length,
        inspecionadas: 0,
        indexadas: 0,
        rastreadasNaoIndexadas: 0,
        descobertasNaoIndexadas: 0,
        outras: 0,
        falhas: 0,
        motivo,
      });
      if (motivo === "sem_sitemap") semSitemap.push(f.slug);
      else if (motivo === "sitemap_vazio") sitemapVazio.push(f.slug);
      else if (motivo === "sem_propriedade") semPropriedade.push(f.slug);
      else pulados.push({ projeto: f.slug, motivo, declaradas: inv.urls.length });
      continue;
    }

    const prop = c.propriedade!;
    props[prop] ??= { orcamento: tetoPropriedade, gastas: 0, falhasDeQuota: 0 };
    try {
      const linhas = await inspecionarIndexacao(amostra(inv.urls, f.cota), { client: cliente });
      const a = agregar(linhas);
      props[prop].gastas += a.inspecionadas;
      // O instrumento que mede o próprio teto: `falhasDeQuota > 0` com `gastas < orcamento`
      // significa que o limite real do Google é menor que o configurado, e o ajuste é por env.
      props[prop].falhasDeQuota += linhas.filter((l: { erro: string }) => /429|quota|rate/i.test(l.erro)).length;
      await gravarIndexacao(f.slug, { dia, propriedade: prop, declaradas: inv.urls.length, ...a, motivo: null });
      apurados.push({
        projeto: f.slug,
        declaradas: inv.urls.length,
        inspecionadas: a.inspecionadas,
        indexadas: a.indexadas,
        rastreadasNaoIndexadas: a.rastreadasNaoIndexadas,
        descobertasNaoIndexadas: a.descobertasNaoIndexadas,
        outras: a.outras,
        falhas: a.falhas,
      });
    } catch (e) {
      // FR-013: um projeto que estoura não leva os outros junto. Mensagem truncada e sem nenhum
      // valor de ambiente, como no resto da casa.
      falhas.push({ projeto: f.slug, erro: e instanceof Error ? e.message.slice(0, 60) : String(e).slice(0, 60) });
    }
  }

  // 200 mesmo com falha parcial: um projeto fora não é a corrida fora. `pulados` é lista SEPARADA
  // de `apurados` — nenhum projeto sem orçamento pode aparecer com `indexadas: 0`.
  return Response.json({
    dia,
    projetos: projetos.length,
    propriedades: props,
    apurados,
    pulados,
    semSitemap,
    sitemapVazio,
    semPropriedade,
    falhas,
  });
}
