// A régua de mercado — o SEGUNDO veredito da árvore OKR, paralelo à §7 e subordinado a ela.
//
// A §7 (`lib/okr.mjs`) manda por fato apurado: ela diz QUE um fator está zerado. O que ela não
// sabe dizer é do TAMANHO de quê, nem se `7,29%` é bom ou ruim — porque não tem referência
// nenhuma fora da própria cadeia. Este arquivo é a referência.
//
// ⚠️ A R6 do template (`handoff/okr-kpi-template.md`) diz "benchmark é ontologia, nunca previsão"
// e "nunca cite benchmark como meta de KR". Isto aqui NÃO é a exceção da R6 — é o uso que ela
// permite, e a diferença é fina o bastante para merecer estar escrita:
//
//   O defeito que gerou a R6 (`handoff/funil-seo/01-a-leitura-da-pesquisa.md`) é a MULTIPLICAÇÃO.
//   A pesquisa empilhou o percentil de elite em quatro estágios seguidos — `35.294 × 8% × 42,5%
//   × 62,5% × 40%` — e apresentou o produto como determinístico. As mesmas sessões davam 5 ou 300
//   clientes: barra de erro de 56×, dentro da própria tabela do documento.
//
//   Comparar UM degrau contra a faixa DELE carrega a barra de erro dele (≈2-4×), não o produto de
//   quatro. É a diferença entre uma régua e uma bola de cristal.
//
// As cinco travas que mantêm a distinção, e onde cada uma vive:
//
//   1. Um degrau por vez, NUNCA compor duas faixas ......... `test/benchmark.test.mjs` (executável)
//   2. Só lê degrau com os DOIS lados apurados ............. `leituraDoDegrau`, via `razao()`
//   3. Faixa, nunca ponto ................................. formato de `REGUA`
//   4. Fonte por linha e vertical declarado (R8) .......... campo `fonte`, obrigatório
//   5. Nunca vira meta de KR .............................. saída é `razao`, nunca alvo
//
// A trava nº 1 é a única que o código não consegue impedir sozinho — quem compuser duas leituras
// escreve código que compila. Por isso ela é TESTE, não comentário: `npm test` fica vermelho
// antes do deploy. Comentário pedindo boa-fé é o que a R6 já tentou e não segurou.
//
// `.mjs` puro por decisão da constituição (III): a régua é testável sem subir o Next.

import { ehApurado } from "./funil.mjs";
import { PERFIS } from "./okr.mjs";

/**
 * @typedef {{media:[number,number], elite:[number,number], fonte:string, nota?:string,
 *            condicional?:string}} Linha
 *
 * A leitura COMPARÁVEL — a que tem número. As que calam (`sem régua`, `sem par apurado`) só têm
 * `rotulo` e `motivo`, e o typedef separado é o que faz o TypeScript recusar na borda quem tentar
 * ler `razao` de uma leitura que calou. Sem isso a tela renderizaria `undefined×` sem reclamar.
 * @typedef {{degrau:string, de:string, para:string, rotulo:string, apurado:number,
 *            faixa:{media:[number,number], elite:[number,number]}, razao:number|null,
 *            buraco:{esperado:number, apuradoEmUnidades:number, faltam:number, base:number}|null,
 *            fonte:string, nota:string|null}} LeituraComparavel
 */

/**
 * A tabela. Chaveada por perfil e pelo par de `chave` dos marcos de `PERFIS` — NÃO pelo `nome`.
 *
 * `nome` é rótulo de tela e já mudou uma vez ("form / WhatsApp" virou "lead (form do site)"
 * quando o canal virou WhatsApp). Se a régua casasse por nome, aquele rename teria silenciado o
 * degrau mais importante do `atma` sem erro nenhum — e `test/benchmark.test.mjs` percorre
 * `PERFIS` nos dois sentidos justamente para que um rename futuro quebre alto.
 *
 * Faixas de AQUISIÇÃO FRIA / paciente novo, que é o que o SEO entrega. Onde a fonte separa
 * cliente novo de recorrente, a linha usa o de novo: misturar os dois infla o piso e passa a
 * cobrar de quem capta frio o número de quem tem carteira.
 *
 * Degrau sem fonte publicada NÃO tem linha. Ausência é estado visível (`sem régua`), e buraco
 * declarado vale mais que número estimado — é a mesma regra de `naoApurado` em `lib/funil.mjs`.
 *
 * @type {Record<string, Record<string, Linha>>}
 */
export const REGUA = {
  // ⭐ O perfil do `atma`, a única cadeia apurada do portfólio.
  D: {
    "visitante→lead": {
      media: [0.02, 0.05],
      elite: [0.08, 0.15],
      fonte: "PatientGain (média 4,2%); Runner Agency (mediana 3,6%, top 25% ≥20,4%)",
    },
    "lead→contatado": {
      media: [0.399, 0.399],
      elite: [0.6, 0.75],
      fonte: "InfluxMD, análise de 278.000 leads de saúde (2023)",
      nota: "39,9% dos leads de marketing chegam a agendar. O alvo declarado do setor é 60-75%.",
    },
    "orcamento→aceito": {
      media: [0.25, 0.35],
      elite: [0.7, 0.9],
      fonte: "Dentx; GrowthRx; Henry Schein One (Catalyst Index 2026: média 45%, top 10% 75%)",
      // A manchete de "50-60% de case acceptance" mistura paciente novo com base existente. Para
      // base é 40-50%; para NOVO é 25-35%. Cobrar 50% de quem capta frio no SEO seria exigir o
      // número de uma clínica com carteira — e o `atma` não tem carteira, tem tráfego orgânico.
      nota: "Faixa de paciente NOVO. Base existente roda 40-50% e não se aplica a captação fria.",
    },
    // `contatado→orcamento` e `aceito→tratamento`: sem linha de propósito. Ninguém publica esses
    // dois degraus isolados — o primeiro não existe na literatura, o segundo vive confundido com
    // o próprio aceite. Estimar aqui seria inventar o número mais decisivo da cadeia.
  },
  A: {
    "visitante→signup": {
      media: [0.02, 0.05],
      elite: [0.071, 0.071],
      fonte: "ChartMogul; Orbix (visitor-to-trial 2,1-7,1% conforme o setor)",
    },
    "trial→cobranca": {
      media: [0.089, 0.089],
      elite: [0.35, 0.35],
      fonte: "ChartMogul, SaaS Conversion Report (opt-in 8,9% · cartão exigido 31,4% · mediana geral 8%)",
      // 3,5× de diferença entre os dois modelos de trial. Publicar a média dos dois produziria um
      // piso que não descreve produto nenhum: alto demais para opt-in, baixo demais para cartão.
      // Enquanto o projeto não declarar o modelo, esta linha se recusa a ser lida.
      condicional: "modelo de trial (opt-in ou cartão exigido) não declarado pelo projeto",
      nota: "Faixa de opt-in. Trial com cartão exigido roda 31,4% e é outra régua.",
    },
    // `signup→ativado` e `ativado→trial`: sem linha. "Ativação" é definição própria de cada
    // produto — e o perfil A já marca que sem definição ESCRITA a etapa não é etapa, é opinião.
    // Benchmark de uma etapa que cada um define diferente compara coisas diferentes.
  },
  B: {
    "produto→carrinho": {
      media: [0.06, 0.075],
      elite: [0.08, 0.1],
      fonte: "Mida; Triple Whale; ChatBoq (benchmark 2025-26 ≈ 6,8%)",
    },
    "carrinho→checkout": {
      media: [0.3, 0.35],
      elite: [0.4, 0.5],
      fonte: "ChatBoq; Growers (50-60% de quem põe no carrinho nunca inicia checkout)",
    },
    "checkout→pago": {
      media: [0.2, 0.4],
      elite: [0.45, 0.55],
      fonte: "Littledata (Shopify, média 45%); Blend Commerce",
    },
    // `visitante→produto`: sem linha. O mercado publica CR ponta a ponta (2,5-3%), não este
    // degrau — e usar o ponta a ponta aqui seria comparar uma etapa contra a cadeia inteira.
  },
  C: {
    "conversa→proposta": {
      media: [0.22, 0.22],
      elite: [0.38, 0.38],
      fonte: "Optifai, 939 empresas (serviços profissionais 22% · B2B geral 25%)",
    },
    "proposta→contrato": {
      media: [0.25, 0.35],
      elite: [0.6, 0.6],
      fonte: "Pitchsite; Waco3; Flowcase (agência de 2-10 pessoas: 20-35% · RFP geral: 45%)",
    },
    // `contato→conversa`: sem linha, "qualificado" não tem definição comum entre empresas.
    // `contrato→pagamento`: sem linha, e a distância aqui é problema de caixa, não de marketing.
  },
};

/** Rótulos possíveis. `sem régua` e `sem par apurado` são estados de primeira classe (D4). */
export const ROTULOS = ["abaixo do piso", "na média", "acima da média", "elite"];

/**
 * A leitura de UM degrau. Um, e é o ponto inteiro do arquivo.
 *
 * Devolve sempre um objeto com `rotulo`; nunca `null` e nunca faixa vazia. Quando cala, carrega o
 * MOTIVO de ter calado — estado sem motivo apodrece em silêncio, e foi assim que seis projetos
 * com `visitante = 0` liam o veredito errado por um mês.
 *
 * Note o que esta função NÃO faz: ela não mede nada. `ficha.taxas[].celula` já passou por
 * `razao()` de `lib/funil.mjs`, que recusa ponta não apurada, denominador 0 (`0/0` não é 0%) e
 * numerador > denominador. As três recusas são exatamente os casos em que a régua deve calar, e
 * reimplementá-las aqui criaria uma segunda definição de "degrau apurado" para divergir depois.
 *
 * @param {string} perfil chave de `PERFIS`
 * @param {{de:string, para:string, chaveDe?:string, chavePara?:string, celula:any, numerador:any, denominador:any}} taxa
 * @param {string} chaveDoDegrau `chaveDe→chavePara`
 */
export function leituraDoDegrau(perfil, taxa, chaveDoDegrau) {
  const base = { degrau: chaveDoDegrau, de: taxa.de, para: taxa.para };
  const linha = REGUA[perfil]?.[chaveDoDegrau];

  // Trava nº 4: sem linha, cala. Mesmo com os dois lados apurados — sobretudo com os dois lados
  // apurados, que é quando a tentação de estimar aparece.
  if (!linha) {
    return { ...base, rotulo: "sem régua", motivo: "nenhuma fonte publica este degrau isolado" };
  }
  if (linha.condicional) {
    return { ...base, rotulo: "sem régua", motivo: linha.condicional, fonte: linha.fonte };
  }

  // Trava nº 2: benchmark não preenche buraco de medição. Ponta faltando devolve para a §7.2
  // (`apurar antes de melhorar`), que é quem manda nesse caso.
  if (!ehApurado(taxa.celula)) {
    return {
      ...base,
      rotulo: "sem par apurado",
      motivo: `${taxa.celula?.naoApurado ?? "degrau não apurado"} — a §7.2 manda aqui, não a régua`,
      fonte: linha.fonte,
    };
  }

  const apurado = taxa.celula.valor;
  const [pisoMedia, tetoMedia] = linha.media;
  const [pisoElite] = linha.elite;

  const rotulo =
    apurado >= pisoElite ? "elite"
    : apurado > tetoMedia ? "acima da média"
    : apurado >= pisoMedia ? "na média"
    : "abaixo do piso";

  // Divisor é o PISO da média, o número mais conservador da faixa. O ponto médio inflaria todo
  // "quanto abaixo" de todo mundo e devolveria pela porta dos fundos a autoridade falsa que a
  // trava nº 3 existe para barrar.
  const razao = pisoMedia > 0 ? apurado / pisoMedia : null;

  // O buraco em unidades: UMA multiplicação, contra denominador APURADO. Nunca contra outra
  // faixa — compor duas faixas aqui é literalmente a projeção de €1,8M que a R6 recusa, e
  // `test/benchmark.test.mjs` falha se alguém tentar.
  const esperado = Math.round(taxa.denominador.valor * pisoMedia);
  const faltam = esperado - taxa.numerador.valor;

  return {
    ...base,
    rotulo,
    apurado,
    faixa: { media: linha.media, elite: linha.elite },
    razao,
    // Só é buraco se falta. Excedente não vira "buraco negativo", que ninguém sabe ler.
    buraco: faltam > 0 ? { esperado, apuradoEmUnidades: taxa.numerador.valor, faltam, base: pisoMedia } : null,
    fonte: linha.fonte,
    nota: linha.nota ?? null,
  };
}

/** Ordem de interesse para escolher o destaque: o que está pior fala primeiro. */
const PESO = { "abaixo do piso": 0, "na média": 1, "acima da média": 2, elite: 3 };

/**
 * A régua sobre a ficha inteira. Devolve uma leitura por degrau MAIS um `destaque` — porque a
 * tela mostra uma linha ao lado do veredito da §7, não uma segunda tabela competindo com ela.
 *
 * O destaque é o degrau apurado mais distante do piso do mercado; havendo empate, o mais alto da
 * cadeia, pelo mesmo motivo da §7.1: com o topo quebrado, consertar o degrau de baixo não move
 * nada. Sem nenhum degrau apurado, o destaque é `null` e a tela não inventa linha.
 *
 * @param {{perfil?:string|null, semPerfil?:any, taxas?:any[]}} ficha saída de `montarFicha()`
 */
export function distanciaDoMercado(ficha) {
  // Sem perfil não há cadeia, e cadeia errada é pior que cadeia ausente. A §7 já devolve posição
  // 0 nesse caso; a régua não inventa um perfil padrão para ter o que dizer.
  if (!ficha?.perfil || ficha.semPerfil) {
    return { perfil: null, leituras: [], destaque: null, motivo: "sem perfil declarado no card" };
  }

  const marcos = PERFIS[ficha.perfil]?.marcos ?? [];
  const leituras = (ficha.taxas ?? []).map((taxa, i) => {
    const chave = `${marcos[i]?.chave}→${marcos[i + 1]?.chave}`;
    return leituraDoDegrau(ficha.perfil, taxa, chave);
  });

  const comparaveis = /** @type {LeituraComparavel[]} */ (leituras.filter((l) => ROTULOS.includes(l.rotulo)));
  const destaque = comparaveis.length
    ? comparaveis.reduce((a, b) => (PESO[b.rotulo] < PESO[a.rotulo] ? b : a))
    : null;

  return { perfil: ficha.perfil, leituras, destaque };
}

/** Formata a razão como a tela fala: `2,0×`. Diagnóstico, nunca alvo (trava nº 5). */
export function formatarRazao(razao) {
  if (razao == null) return null;
  return `${razao.toFixed(1).replace(".", ",")}×`;
}
