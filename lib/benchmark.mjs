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
 * @typedef {{media:[number,number], elite:[number,number], fonte:string, url:string,
 *            acessadoEm:string, recorte:string, nota?:string, condicional?:string}} Linha
 *
 * `url`, `acessadoEm` (`AAAA-MM-DD`) e `recorte` são OBRIGATÓRIOS em linha criada da 020 em diante.
 * As sete linhas legadas da 015 não os têm e não foram tocadas — a 020 é sobre a Atma (perfil D), e
 * nenhuma das sete aparece na ficha dela. A dívida está nomeada em `handoff/okr-regua-de-mercado.md`;
 * `test/benchmark.test.mjs` carrega a mesma lista literal, para que uma legada NOVA não passe batido.
 *
 * `recorte` existe porque a fonte certa do degrau vizinho é a armadilha mais cara desta tabela: o
 * InfluxMD mede *agendamento* e o Henry Schein One mede aceite *pós-consulta*. Os dois são sólidos e
 * nenhum dos dois é régua da Atma.
 *
 * @typedef {{recusa:{motivo:string,
 *            descartadas?:{fonte:string, url?:string, numero:string, porQue:string}[]}}} Recusa
 *
 * A ausência de régua como DADO, não como ausência de chave. `Linha` e `Recusa` são mutuamente
 * exclusivas na mesma chave: quem tem `recusa` não tem `media`, e `test/benchmark.test.mjs` reprova
 * quem misturar.
 *
 * Por que entrada em vez de chave faltando: sem entrada, os três degraus da Atma devolviam a MESMA
 * frase ("nenhuma fonte publica este degrau isolado") por três razões diferentes — medido em
 * 06/09/2026, 1 motivo para 3 degraus. Quem lesse a ficha não distinguia "ninguém publica isso" de
 * "publicam, mas medem outro degrau", e a segunda é a que evita decisão errada.
 *
 * A leitura COMPARÁVEL — a que tem número. As que calam (`sem régua`, `sem par apurado`) só têm
 * `rotulo` e `motivo`, e o typedef separado é o que faz o TypeScript recusar na borda quem tentar
 * ler `razao` de uma leitura que calou. Sem isso a tela renderizaria `undefined×` sem reclamar.
 * @typedef {{degrau:string, de:string, para:string, rotulo:string, apurado:number,
 *            faixa:{media:[number,number], elite:[number,number]}, razao:number|null,
 *            buraco:{esperado:number, apuradoEmUnidades:number, faltam:number, base:number}|null,
 *            fonte:string, nota:string|null}} LeituraComparavel
 *
 * A leitura que RECUSA, com o motivo pesquisado. Typedef próprio pela mesma razão do de cima, no
 * sentido oposto: sem ele a tela não consegue ler `motivo`/`descartadas` sem o TypeScript reclamar,
 * porque `leituraDoDegrau()` devolve a união de cinco formas diferentes.
 * @typedef {{degrau:string, de:string, para:string, rotulo:string, motivo:string, armadilha:boolean,
 *            descartadas:{fonte:string, url?:string, numero:string, porQue:string}[]}} LeituraRecusada
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
  //
  // 018: `visitante→lead` e `lead→contatado` SAÍRAM. `visitante` deixou de ser marco de D (é
  // Descoberta — ligá-lo à cadeia de Conversão seria taxa cruzando janelas, FR-011) e `contatado`
  // virou nota (degrau de 100% DECLARADO não é gargalo comparável a régua nenhuma). As citações
  // ficam em comentário, como a 017 fez com case acceptance:
  //
  //   visitante→lead: média 2-5%, elite 8-15% — fonte PatientGain (média 4,2%); Runner Agency
  //   (mediana 3,6%, top 25% ≥20,4%).
  //   lead→contatado: 39,9% (InfluxMD, 278.000 leads de saúde, 2023) — mede *agendamento*, degrau
  //   que a Atma não tem (ela nunca marcou consulta).
  //
  // 020 — as duas foram REAVALIADAS e nenhuma vira linha, cada uma por um motivo diferente:
  //
  //   `visitante→lead` — o degrau não existe mais na cadeia D. Ressuscitá-lo aqui reintroduziria a
  //   taxa entre cadeias que a FR-011 da 018 baniu (Descoberta e Conversão têm janelas diferentes).
  //   A citação sobrevive como candidata da 022, que exibe aquisição.
  //
  //   `lead→contatado` — nem degrau nem régua. `contatado` virou nota na 018 (100% declarado), e a
  //   fonte mede AGENDAMENTO, que a Atma nunca teve. É a mesma armadilha do Henry Schein One em
  //   `orcamento→tratamento`: fonte sólida, degrau vizinho, régua errada.
  //
  // `lead→respondeu`, `respondeu→orçamento` e `orçamento→tratamento`: **pesquisados em 06/09/2026
  // (020) e recusados um a um**, com o que foi procurado e por que não serve logo abaixo.
  //
  // Até a 020 esta linha dizia "sem linha de propósito — nenhum publica benchmark para esses
  // degraus", sem que ninguém tivesse procurado. A afirmação estava CERTA; o problema é que ela era
  // suposição escrita com voz de fato, e é exatamente o defeito que a 018 existiu para matar
  // (o comentário de `lib/okr.mjs` afirmando "0 transições reais gravadas" numa tabela com 82).
  // A 020 aplica a regra à própria tabela: agora o mesmo comentário está provado, e a prova é dado,
  // não prosa — `test/benchmark.test.mjs` reprova se duas recusas repetirem motivo.
  D: {
    "lead→respondeu": {
      recusa: {
        motivo:
          "ninguém publica taxa de resposta de lead de saúde — o que existe é B2B SaaS e outbound frio",
        descartadas: [
          {
            fonte: "Salesforce, State of Sales 2024 (via RevenueHero)",
            numero: "MQL→SQL 13%",
            porQue:
              "B2B SaaS, e 'qualificado' é definição interna de cada empresa — mesma razão pela qual o perfil C recusa `contato→conversa`",
          },
          {
            fonte: "Cognism, Cold Email Benchmark Report",
            numero: "reply rate 1-5%, topo 8-10%",
            porQue: "outbound FRIO. A atma responde a quem procurou ela — o ato é o inverso",
          },
          {
            fonte: "Ruler Analytics / Umbrex (saúde)",
            numero: "conversão de lead 4-6%",
            porQue: "é lead→cliente, a cadeia inteira, não o primeiro degrau",
          },
        ],
      },
    },
    "respondeu→orcamento": {
      recusa: {
        motivo:
          "ninguém publica este degrau — quote-to-close mede o seguinte",
        descartadas: [
          {
            fonte: "Count.co / KPITree — quote-to-close rate",
            url: "https://count.co/metric/quote-to-close-rate",
            numero: "exemplo de 35% (28 fechados / 80 orçamentos)",
            porQue: "mede orçamento→venda, que é `orcamento→tratamento`, não este degrau",
          },
        ],
      },
    },
    "orcamento→tratamento": {
      recusa: {
        // A única das três marcada como ARMADILHA, e o critério é estreito: a fonte descartada é do
        // setor do leitor e ele a acha sozinho. "Case acceptance rate" é o primeiro resultado do
        // Google e devolve 45% redondo; "MQL→SQL" (a descartada de `lead→respondeu`) nenhum dono de
        // clínica vai topar por acidente. É por isso que ESTA é a recusa que a ficha mostra quando
        // há espaço para uma só — não a mais alta da cadeia, a que evita a conclusão errada.
        armadilha: true,
        // ⚠️ A recusa mais importante das três. Quem pesquisar "case acceptance rate" acha 45% em
        // cinco minutos e conclui que os 0% da atma são catástrofe. São dois degraus diferentes: as
        // fontes medem o aceite de um plano apresentado DEPOIS de consulta presencial, e a atma manda
        // preço por mensagem sem consulta nenhuma. Não é diferença de calibragem, é estágio faltando.
        motivo:
          "os benchmarks de aceitação medem aceite pós-consulta, e a atma manda preço sem consulta",
        descartadas: [
          {
            fonte: "Henry Schein One, Catalyst Index 2026",
            url: "https://www.henryscheinone.com/insights/blogs/dso-dental-practice-case-acceptance-rate/",
            numero: "média 45%, top 10% 75%",
            porQue:
              "aceite pós-consulta; não separa paciente novo de carteira (verificado abrindo a página) e não divulga amostra",
          },
          {
            fonte: "Gaidge Analytics + Planet DDS 2025, via Orthia",
            url: "https://orthia.io/blog/orthodontic-new-patient-conversion-rate",
            numero: "média 64-68%, elite 80%+",
            porQue:
              "ortodontia específica, mas o degrau é `treatment recommended → accepted`, que só existe depois da consulta; fonte secundária",
          },
        ],
      },
    },
    // Procurei o substituto certo — conversão de teledentistria / orçamento remoto → início de
    // tratamento em aligner DTC — e não achei nada citável (`specs/020-regua-de-mercado/research.md`
    // §D3). O único número que apareceu (26,8% de consulta online) mede consulta AGENDADA, não preço
    // enviado, e não declara o que chama de "conversão".
    //
    // 🚩 `orcamento→aceito` saiu em 05/09/2026 (spec 017) — não por falta de dado, por falta de
    // DEGRAU: `aceito` não existe na cadeia canônica da Atma (funil.ts vai de `pre_orcamento` a
    // `exames_enviados`/`convertido` sem um "aceite" no meio) e `orcamentos.status` nunca escreveu
    // outro valor além de `enviado` em 5 semanas de produção. A citação fica registrada aqui para
    // quando — e se — a Atma passar a distinguir aceite de envio: case acceptance de paciente
    // NOVO roda 25-35% (média) / 70-90% (elite), fonte Dentx; GrowthRx; Henry Schein One (Catalyst
    // Index 2026: média 45%, top 10% 75%) — nota: a manchete de "50-60%" mistura paciente novo com
    // base existente, e 50% seria cobrar de captação fria o número de quem já tem carteira.
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

/**
 * Os três vereditos da cadeia de AQUISIÇÃO (020). Ficam fora de `REGUA` porque `REGUA` é chaveada
 * por `perfil → degrau da cadeia`, e aquisição não é cadeia de perfil nenhum: a 019 separou
 * Descoberta e Comportamento da Conversão de propósito (FR-029 — taxa entre GSC e GA4 não existe).
 * Não têm perfil ao qual pertencer, e enfiá-los em `REGUA.D` recriaria a taxa que aquela FR baniu.
 *
 * 🚩 Por que este objeto existe (auditoria de 07/09/2026): a 020 pesquisou seis degraus e produziu
 * UMA linha publicável — `form_start→lead`, Zuko 66%. Ela estava no banco da **Atma** e no markdown
 * do handoff, e em lugar nenhum do roihub: `grep -rl Zuko lib/ app/ data/` devolvia zero. A spec
 * 022, que vai exibi-la, teria que re-derivá-la de prosa. Pesquisa que só existe em handoff foi
 * anotada, não entregue — mesma família de `tela_nao_le_nao_e_buraco_de_medicao`, invertida.
 *
 * Nada lê isto ainda. A exibição é a **022**; aqui é só o dado deixando de morar só no cliente.
 * Os textos são transcrição literal de `market_benchmarks` da Atma (migration 024).
 *
 * @type {Record<string, Linha>}
 */
export const AQUISICAO = {
  "impressao→clique": {
    condicional: {
      motivo: "sem régua enquanto a posição média não for declarada — CTR agregado sem controle de posição mede mix de posição, não desempenho",
      // A fonte é boa e publica CTR POR POSIÇÃO, indústria e dispositivo; o que falta é a Atma
      // declarar em que posição ela está. Vira linha no dia em que esse recorte existir.
      fonte: "Advanced Web Ranking, Google Organic CTR tool",
      url: "https://www.advancedwebranking.com/free-seo-tools/google-organic-ctr",
      acessoEm: "2026-09-06",
    },
  },
  "clique→form_start": {
    recusa: {
      motivo:
        "recusa ESTRUTURAL, não falta de publicação: numerador GA4 (todos os canais) e denominador GSC (só orgânica) medem populações diferentes",
      // Não vira régua nem com fonte publicada — é a mesma taxa gêmea que a 019 baniu em FR-029.
      // Por isso não tem `url`: não há o que citar, e citar qualquer coisa daria ar de pesquisa
      // malfeita a uma decisão que é de modelagem.
      descartadas: [],
    },
  },
  "form_start→lead": {
    // ⭐ A única linha publicável das seis pesquisadas na 020.
    media: [0.66, 0.68],
    // Sem número de elite VERIFICADO — a Zuko publica média, não quartil superior. `elite: null` é
    // o estado honesto; inventar um teto seria o que a FR-006 proíbe. Pendência 4 do handoff da 020.
    elite: null,
    fonte: "Zuko Analytics (66%) + FormAssembly (68%, 1,6 bi de interações)",
    url: "https://www.zuko.io/blog/25-conversion-rate-statistics-you-need",
    acessoEm: "2026-09-06",
    recorte: "agregado multi-setor, 93.022.997 sessões — de quem COMEÇA a preencher o formulário, quantos enviam",
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

  // Recusa PESQUISADA — a diferença entre "não procuramos" (acima) e "procuramos e eis o porquê".
  // Vem ANTES da checagem de par apurado de propósito: se o mercado não publica o degrau, ter as duas
  // pontas medidas não muda nada, e mandar o leitor para a §7.2 (`apurar antes de comparar`) o mandaria
  // apurar algo que já está apurado. Foi o que aconteceu com `orçamento→tratamento`: 4 de 4 apurados,
  // e a tela pedindo medição.
  if (linha.recusa) {
    return {
      ...base,
      rotulo: "sem régua",
      motivo: linha.recusa.motivo,
      descartadas: linha.recusa.descartadas ?? [],
      armadilha: linha.recusa.armadilha === true,
    };
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
    // `?? null` e não `?? ""`: as sete linhas legadas da 015 não têm link, e `null` diz isso. String
    // vazia viraria `href=""`, que a tela renderiza como link para a própria página.
    url: linha.url ?? null,
    acessadoEm: linha.acessadoEm ?? null,
    recorte: linha.recorte ?? null,
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

  // 020 — sem destaque, a tela ainda tem UMA linha para gastar, e gastá-la numa frase genérica é
  // desperdício. `recusaEmDestaque` é o que ela diz no lugar.
  //
  // A ordem NÃO é "o degrau mais alto da cadeia" (a regra da §7.1, que vale para gargalo). Aqui a
  // pergunta é outra: qual ausência, se ficar calada, faz o leitor ir buscar o número errado
  // sozinho? A `armadilha` marca exatamente essa — fonte do setor dele, achável em cinco minutos.
  // Empate ou nenhuma armadilha: a primeira da cadeia, que é a ordem dos marcos.
  const recusas = /** @type {LeituraRecusada[]} */ (leituras.filter((l) => "descartadas" in l));
  const recusaEmDestaque = recusas.find((l) => l.armadilha) ?? recusas[0] ?? null;

  return { perfil: ficha.perfil, leituras, destaque, recusaEmDestaque };
}

/** Formata a razão como a tela fala: `2,0×`. Diagnóstico, nunca alvo (trava nº 5). */
export function formatarRazao(razao) {
  if (razao == null) return null;
  return `${razao.toFixed(1).replace(".", ",")}×`;
}

/**
 * A faixa de um SPAN, não de um degrau. A 015 lê degrau consecutivo (`leituraDoDegrau`); a árvore
 * de metas (016) precisa atravessar buraco de medição e pergunta pelo trecho inteiro
 * `chaveDe→chavePara`. Lookup EXATO na mesma tabela — proibido casar por aproximação, pelo mesmo
 * motivo do D2 da 015: `nome` é rótulo de tela e já mudou, `chave` é identidade.
 *
 * Span sem linha devolve `null`, e `null` PARA a árvore (FR-004). Estimar a faixa aqui seria
 * inventar justamente o número que a tabela deixou de fora de propósito.
 *
 * @param {string|null|undefined} perfil @param {string} chaveDe @param {string} chavePara
 * @returns {Linha|null}
 */
export function faixaDoSpan(perfil, chaveDe, chavePara) {
  if (!perfil) return null;
  const entrada = REGUA[perfil]?.[`${chaveDe}→${chavePara}`];
  // Uma `Recusa` devolve `null`, igual a chave ausente. Ela É uma entrada na tabela (020) e sem esta
  // linha a árvore de metas receberia um objeto sem `media`/`elite` e projetaria contra `undefined` —
  // que é literalmente projetar contra faixa inventada, o defeito que a R6 inteira existe para barrar.
  if (!entrada || entrada.recusa) return null;
  return entrada;
}
