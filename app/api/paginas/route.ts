// A corrida SEMANAL que lê o que há dentro das páginas do site (024).
//
// A 022 mediu 9 de 36 URLs da Atma indexadas, com 19 lidas e RECUSADAS pelo Googlebot. Nenhum
// conserto técnico move essa classe: o que move está dentro da página e em como o site liga uma à
// outra — e é a única coisa que o hub nunca olhou.
//
// O Actions só dispara (`.github/workflows/paginas.yml`); o trabalho é AQUI porque o runner não tem
// `DATABASE_URL`. Ao contrário da 022, esta corrida NÃO fala com o Search Console: não há quota a
// gastar, só HTTP contra um host da casa. Por isso o teto é de TEMPO, não de cota.
import { projetosDeBusca } from "@/lib/projects";
import { dbOn, gravarCrawlDePagina, type PaginaCrawl } from "@/lib/db";
import { buscar, urlDoSitemap } from "@/lib/conformidade.mjs";
import { lerSitemap } from "@/lib/sitemap.mjs";
import { extrair } from "@/lib/pagina.mjs";
import {
  canonizar,
  ehInterna,
  navegacao,
  profundidades,
  densidades,
  fronteira,
  dedupPorUrl,
  agregar,
} from "@/lib/grafo.mjs";

export const runtime = "nodejs";
// O MESMO valor de `/api/indexacao`, de propósito: o proxy do EasyPanel não muda (Princípio IV).
export const maxDuration = 800;

/** Lotes de 4, não 8. É contra UM ÚNICO host — o de um cliente da casa —, ao contrário da 022, que
 *  abre 8 conexões contra 8 hosts diferentes. Educação com o servidor do cliente, não performance. */
const LOTE = 4;

const trunca = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 60);

async function emLotes<T, R>(itens: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const saida: R[] = [];
  for (let i = 0; i < itens.length; i += n) {
    saida.push(...(await Promise.all(itens.slice(i, i + n).map(fn))));
  }
  return saida;
}

type Buscada = {
  /** A URL PEDIDA. Distinta de `url` sempre que houve redirecionamento — e é ela que fecha a
   *  fronteira da travessia: marcar só o destino deixa a origem eternamente "não visitada", e a
   *  fase largura volta a buscá-la para sempre. */
  pedida: string;
  url: string;
  status: number | null;
  redirecionada: boolean;
  erro: string | null;
  extraida: ReturnType<typeof extrair> | null;
};

/**
 * Uma página: busca, canoniza o DESTINO e extrai.
 *
 * A chave é a URL final após redirecionamento (D13): duas URLs do sitemap que redirecionam para o
 * mesmo destino são uma página só, e o `dedupPorUrl()` mais adiante conta com isso. O fato de o
 * sitemap declarar uma URL que redireciona é o ACHADO (FR-013), não um buraco.
 *
 * Erro NUNCA vira "página sem título, sem Schema ou sem links" (FR-016): a página fica com `erro`
 * preenchido e sai de todo numerador.
 */
async function buscarPagina(url: string, ano: number): Promise<Buscada> {
  try {
    const r = await buscar(url);
    const final = canonizar(r.url ?? url, url) ?? url;
    const pedida = url;
    // `status` é `null` quando nem respondeu — nunca 0, que seria um código HTTP inventado.
    const status: number | null = typeof r.status === "number" ? r.status : null;
    const redirecionada = !!r.redirecionada;
    if (r.erro) return { pedida, url: final, status, redirecionada, erro: String(r.erro).slice(0, 60), extraida: null };
    if (status !== null && status >= 400) {
      return { pedida, url: final, status, redirecionada, erro: `HTTP ${status}`, extraida: null };
    }
    return { pedida, url: final, status, redirecionada, erro: null, extraida: extrair(r.corpo, ano) };
  } catch (e) {
    return { pedida: url, url, status: null, redirecionada: false, erro: trunca(e), extraida: null };
  }
}

export async function POST() {
  // Princípio V: valida na ENTRADA e responde só com os NOMES do que falta.
  if (!dbOn()) return Response.json({ error: "ambiente incompleto", faltando: ["DATABASE_URL"] }, { status: 503 });

  const teto = Number(process.env.PAGINAS_POR_CORRIDA) > 0 ? Number(process.env.PAGINAS_POR_CORRIDA) : 300;
  const dia = new Date().toISOString().slice(0, 10);
  const ano = new Date().getFullYear();

  // Princípio I: os projetos vêm de `listProjects()`, e a corrida percorre só `SLUGS_DE_BUSCA`.
  const projetos = await projetosDeBusca();

  const apurados = [];
  const pulados: { projeto: string; motivo: string; declaradas: number }[] = [];
  const falhas: { projeto: string; url: string; erro: string }[] = [];

  for (const p of projetos) {
    try {
      const base = p.url.replace(/\/+$/, "");
      const host = new URL(p.url).hostname.toLowerCase();
      const home = canonizar(`${base}/`, `${base}/`)!;

      // O robots diz ONDE o sitemap mora: adivinhar `/sitemap.xml` reprova quem serve
      // `sitemap-index.xml` e anuncia isso corretamente.
      const robots = await buscar(`${base}/robots.txt`);
      const inv = await lerSitemap(urlDoSitemap(robots.corpo, base), buscar);
      const declaradasCanon = [...new Set(inv.urls.map((u: string) => canonizar(u, base)).filter(Boolean) as string[])];

      // Rede caída lendo o sitemap é FALHA, não `sem_sitemap`: "não perguntei" gravado como
      // "não há" é inversão de sinal.
      if (inv.erro) {
        falhas.push({ projeto: p.slug, url: `${base}/sitemap.xml`, erro: String(inv.erro).slice(0, 60) });
        continue;
      }

      const gravarMotivo = async (motivo: string) => {
        await gravarCrawlDePagina(
          p.slug,
          {
            dia,
            declaradas: declaradasCanon.length,
            visitadas: 0,
            falhas: 0,
            orfas: 0,
            linkadasNaoDeclaradas: 0,
            linksNavegacao: 0,
            tetoAtingido: false,
            motivo,
          },
          []
        );
        pulados.push({ projeto: p.slug, motivo, declaradas: declaradasCanon.length });
      };

      if (inv.motivo) {
        await gravarMotivo(inv.motivo);
        continue;
      }

      // ── Fase largura: a home é a origem da travessia ────────────────────
      const buscadas = new Map<string, Buscada>();
      // MEDIDO na primeira corrida: `buscadas` é chaveada pelo DESTINO (D3), então uma URL que
      // redireciona nunca aparecia nela — e a fronteira, que filtra por URL pedida, a devolvia a
      // cada volta do laço. Travessia infinita, com o teto como único freio. `vistas` guarda os
      // dois lados: o que foi pedido e onde caiu.
      const vistas = new Set<string>();
      const arestas: { de: string; para: string; ancora: string }[] = [];
      let tetoAtingido = false;

      const registrar = (b: Buscada) => {
        vistas.add(b.pedida);
        vistas.add(b.url);
        buscadas.set(b.url, b);
        for (const l of b.extraida?.links ?? []) {
          const destino = canonizar(l.href, b.url);
          if (destino && ehInterna(destino, host)) arestas.push({ de: b.url, para: destino, ancora: l.ancora });
        }
      };

      const inicial = await buscarPagina(home, ano);
      // Sem home não há ORIGEM para a travessia, e toda página do sitemap sairia órfã por causa de
      // um ETIMEDOUT. Estado próprio, e NENHUMA linha de `hub_pagina` gravada.
      if (inicial.erro) {
        await gravarMotivo("home_inacessivel");
        falhas.push({ projeto: p.slug, url: home, erro: inicial.erro });
        continue;
      }
      registrar(inicial);

      let aVisitar: string[] = fronteira(arestas, vistas);
      while (aVisitar.length) {
        const cabe = aVisitar.slice(0, Math.max(0, teto - buscadas.size));
        if (cabe.length < aVisitar.length) tetoAtingido = true;
        if (!cabe.length) break;
        for (const b of await emLotes(cabe, LOTE, (u) => buscarPagina(u, ano))) {
          if (b.erro) falhas.push({ projeto: p.slug, url: b.url, erro: b.erro });
          registrar(b);
        }
        aVisitar = fronteira(arestas, vistas);
      }

      // ── Fase colheita: o que o sitemap declara e ninguém alcançou (D7) ──
      const declaradas = new Set(declaradasCanon);
      const orfasCandidatas = declaradasCanon.filter((u) => !vistas.has(u));
      const colhidas = orfasCandidatas.slice(0, Math.max(0, teto - buscadas.size));
      if (colhidas.length < orfasCandidatas.length) tetoAtingido = true;
      for (const b of await emLotes(colhidas, LOTE, (u) => buscarPagina(u, ano))) {
        if (b.erro) falhas.push({ projeto: p.slug, url: b.url, erro: b.erro });
        // Uma URL declarada pode REDIRECIONAR para uma página já visitada — aí ela não é órfã, é a
        // mesma página com outro nome. O destino herda o `no_sitemap` da origem declarada; sem
        // isso o sitemap encolheria em silêncio e a página viva apareceria como não declarada.
        declaradas.add(b.url);
        if (buscadas.has(b.url)) vistas.add(b.pedida);
        else registrar(b);
      }

      // ── As duas leituras do mesmo grafo (D2) ────────────────────────────
      const nav = navegacao(arestas, buscadas.size);
      const contextuais = densidades(arestas, nav);
      const prof = profundidades(arestas, home, teto);

      const linhas: PaginaCrawl[] = dedupPorUrl(
        [...buscadas.values()].map((b) => ({
          url: b.url,
          noSitemap: declaradas.has(b.url),
          // Ausente do mapa = INALCANÇÁVEL, jamais 0.
          profundidade: prof.mapa.has(b.url) ? prof.mapa.get(b.url) : null,
          linksContextuais: contextuais.get(b.url) ?? 0,
          titulo: b.extraida?.titulo ?? null,
          tituloPx: b.extraida?.larguraPx ?? null,
          tituloMetodo: b.extraida?.metodo ?? null,
          intencao: b.extraida?.intencao ?? null,
          schemaEstado: b.extraida?.schema.estado ?? "ausente",
          schemaTipos: b.extraida?.schema.tipos.length ? b.extraida.schema.tipos.join(",") : null,
          dataDeclarada: b.extraida?.dataDeclarada ?? null,
          palavras: b.extraida?.palavras ?? null,
          conteudoEstado: b.extraida?.conteudo ?? "sem-conteudo",
          status: b.status,
          redirecionada: b.redirecionada,
          erro: b.erro,
        }))
      );

      const a = agregar(linhas, {
        linksNavegacao: nav.size,
        declaradas: declaradasCanon.length,
        tetoAtingido: tetoAtingido || prof.tetoAtingido,
      });
      await gravarCrawlDePagina(p.slug, { dia, ...a, motivo: null }, linhas);
      apurados.push({ projeto: p.slug, ...a });
    } catch (e) {
      // FR-016: um projeto que estoura não leva os outros junto. Truncado e sem valor de ambiente.
      falhas.push({ projeto: p.slug, url: p.url, erro: trunca(e) });
    }
  }

  // 200 mesmo com falha parcial: uma página fora não é a corrida fora (FR-016). `falhas` é lista de
  // URL, não de projeto — com um projeto só no escopo, "a corrida falhou" seria inútil e
  // "esta URL do sitemap devolve 404" é exatamente o achado da FR-013.
  return Response.json({ dia, projetos: projetos.length, apurados, pulados, falhas });
}
