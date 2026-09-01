// A árvore de OKR do `handoff/okr-kpi-template.md`, executável. `lib/funil.mjs` já é a célula e a
// razão (R1, R3, R5) e continua sendo — este arquivo IMPORTA aquele e não reimplementa nada dele.
// Duas regras de `0/0` no mesmo repo seria uma delas ficando para trás na primeira correção.
//
// O que existe aqui e não lá: o template tem QUATRO cadeias, uma por perfil de negócio, e
// `lib/funil.mjs` tem três degraus fixos (`cliques→leads→vendas`) iguais para os 35 projetos.
// Cadeia de SaaS não é cadeia de clínica: `trial → primeira cobrança` e `consulta → compareceu`
// falham por motivos opostos e pedem conserto oposto.
//
// O entregável é o VEREDITO, não a tabela: `posicaoDeAtaque()` devolve em que das posições da §7
// o projeto está e QUAL célula colocou ele lá. Em 01/09/2026, 34 dos 35 projetos não tinham como
// responder "quanto vale um cliente a mais", e a única cadeia apurada do portfólio era a `atma` —
// `535 cliques → 39 leads → 0 vendas`, com o último fator zerado.
import { apurado, naoApurado, ehApurado, razao, ehLeadDeTeste } from "./funil.mjs";

/**
 * A pipeline do CRM cujo slug NÃO é o slug do projeto. Mapa explícito de uma entrada em vez de
 * casar por prefixo: prefixo erraria calado, e atribuir lead ao projeto errado é leitura de
 * dinheiro. Mora aqui, e não em `scripts/funil.mjs`, porque a tela e o script leem a MESMA
 * pipeline — duas cópias divergiriam na primeira pipeline nova e ninguém veria.
 */
export const PIPELINE_DO_PROJETO = { polarisia: "polaris" };

/** @param {string} slug */
export const pipelineDe = (slug) => PIPELINE_DO_PROJETO[slug] ?? slug;

/**
 * A célula de leads de um projeto: filtra o que é teste NOSSO, corta na janela, e devolve
 * `não apurado` — nunca `0` — quando não há o que contar.
 *
 * 🚩 Zero lead na história inteira NÃO é zero: é a pergunta sem resposta. Fonte ligada e nenhum
 * lead jamais recebido não separa "o site não manda evento" de "manda e ninguém converteu", e as
 * duas hipóteses pedem trabalho oposto (encanamento × oferta).
 *
 * 🚩 Lead que NÓS criamos não é demanda. Em 01/09/2026 os 5 leads que o `crm_leads` tinha na vida
 * inteira eram os 5 de teste, e era deles que saía o ÚNICO `CR(clique→lead)` do portfólio —
 * `polarisia 6,67% (2/30)`. A taxa existia; a demanda, não.
 *
 * @param {{nome?:string, email?:string|null, metadata?:Record<string,unknown>, criado:string}[]|null} leads
 * @param {{inicio:string, fim:string, onde:string}} janela
 * @returns {{celula:import("./funil.mjs").Celula, reais:any[]}}
 */
export function celulaDeLeads(leads, { inicio, fim, onde }) {
  if (!Array.isArray(leads)) return { celula: naoApurado(`sem fonte de lead (${onde})`), reais: [] };
  const nossos = leads.filter((l) => ehLeadDeTeste(l));
  const externos = leads.filter((l) => !ehLeadDeTeste(l));
  if (externos.length === 0) {
    return {
      celula: naoApurado(
        nossos.length
          ? `${nossos.length} lead(s) em ${onde}, TODOS de teste nosso — nenhum lead real jamais recebido`
          : `${onde} existe e nunca recebeu lead — não separa 'sem instrumentação' de 'instrumentado e zero'`
      ),
      reais: [],
    };
  }
  const reais = externos.filter((l) => {
    const dia = String(l.criado).slice(0, 10);
    return dia >= inicio && dia <= fim;
  });
  return { celula: apurado(reais.length), reais };
}

/** @typedef {import("./funil.mjs")} */
/** @typedef {{valor:number}|{naoApurado:string}} Celula */

/**
 * As quatro famílias de diagnóstico do §5-N5. A ordem NÃO é alfabética: D4 é avaliada primeiro
 * porque é a que mais destrói OKR e a que menos aparece em dashboard — falha em silêncio, com
 * tudo respondendo 200 e nada sendo gravado. Um `não apurado` em N3 é quase sempre D4, não D1.
 */
export const FAMILIAS = {
  D4: "Encanamento — o evento chega ao banco?",
  D1: "Descoberta — o canal te encontra?",
  D2: "Entrega — a página chega inteira?",
  D3: "Persuasão — ela convence?",
};

/**
 * Um marco é um degrau NOMEADO da cadeia, e a cadeia é a do perfil — não uma cadeia genérica.
 *
 * `coletor` é o que o hub já lê hoje (`cliques` do GSC, `leads` do `crm_leads`, `vendas` do campo
 * do card). `null` significa **não há coletor**, e aí o degrau sai `não apurado` nomeando a
 * `fonte` a CONSULTAR — não a instrumentação a escrever. É a R4: procurar o dado onde ele já cai
 * antes de escrever encanamento novo, porque instrumentar cedo demais cria uma cópia PIOR da
 * tabela que já existe, sem histórico, contando só de hoje em diante.
 *
 * @typedef {{chave:string, nome:string, coletor:string|null, familia:string, fonte:string}} Marco
 * @typedef {{nome:string, n1:string, n2:string, marcos:Marco[]}} Perfil
 */

/** @type {Record<string, Perfil>} */
export const PERFIS = {
  A: {
    nome: "SaaS / assinatura",
    n1: "Clientes pagantes na janela",
    n2: "MRR = Clientes pagantes × ARPA × (1 − churn de receita)",
    marcos: [
      { chave: "visitante", nome: "visitante", coletor: "cliques", familia: "D1", fonte: "Search Console" },
      { chave: "signup", nome: "signup", coletor: null, familia: "D4", fonte: "tabela de usuários do banco do próprio projeto" },
      // "ativado" sem definição ESCRITA não é etapa, é opinião — o template marca isso no perfil A.
      { chave: "ativado", nome: "ativado", coletor: null, familia: "D4", fonte: "definição escrita de ativação + evento no banco do projeto" },
      { chave: "trial", nome: "trial pago", coletor: null, familia: "D4", fonte: "tabela de assinatura do projeto" },
      // ⚠️ Trial expirado que segue com `plan: 'pro'` no banco NÃO é cliente. `plan` é intenção,
      // extrato é fato — e foi assim que "usuários PRO" do Polaris viraram R$ 0 em 6 meses.
      { chave: "cobranca", nome: "primeira cobrança APROVADA", coletor: "vendas", familia: "D4", fonte: "extrato do gateway (não o painel de aprovados)" },
    ],
  },
  B: {
    nome: "E-commerce",
    n1: "Pedidos pagos na janela",
    n2: "Receita = Sessões × CR(sessão→pedido) × AOV × (1 − devolução)",
    marcos: [
      { chave: "visitante", nome: "visitante", coletor: "cliques", familia: "D1", fonte: "Search Console" },
      { chave: "produto", nome: "viu produto", coletor: null, familia: "D3", fonte: "GA4 / evento de view_item" },
      { chave: "carrinho", nome: "carrinho", coletor: null, familia: "D3", fonte: "GA4 / tabela de carrinho da loja" },
      { chave: "checkout", nome: "checkout iniciado", coletor: null, familia: "D4", fonte: "preferências criadas no gateway" },
      // ⚠️ `approved` no gateway não é venda. Aprovação em conta de teste, ou com você mesmo como
      // pagador, aprova igual — só o PAGADOR DISTINTO separa venda de teste.
      { chave: "pago", nome: "pagamento APROVADO E LIQUIDADO", coletor: "vendas", familia: "D4", fonte: "extrato do gateway, conferindo o pagador" },
    ],
  },
  C: {
    nome: "Serviço / agência / projeto",
    n1: "Contratos fechados na janela",
    n2: "Receita = Propostas × Taxa de fecho × Ticket médio × (1 + expansão)",
    marcos: [
      { chave: "contato", nome: "contato", coletor: "leads", familia: "D4", fonte: "`crm_leads` (pipeline do projeto)" },
      { chave: "conversa", nome: "conversa qualificada", coletor: null, familia: "D3", fonte: "etapa do CRM / WhatsApp de quem atende" },
      { chave: "proposta", nome: "proposta enviada", coletor: null, familia: "D3", fonte: "etapa do CRM / pasta de propostas" },
      { chave: "contrato", nome: "contrato ASSINADO", coletor: null, familia: "D3", fonte: "contrato assinado / e-mail de aceite" },
      // ⚠️ Contrato assinado não é receita. Se a KPI primária é caixa, a última etapa é PAGAMENTO
      // RECEBIDO — e as duas não se misturam no mesmo trimestre.
      { chave: "pagamento", nome: "primeiro pagamento RECEBIDO", coletor: "vendas", familia: "D4", fonte: "extrato bancário / gateway" },
    ],
  },
  D: {
    nome: "Clínica / agendamento / lead de alto valor",
    n1: "Tratamentos iniciados na janela",
    n2: "Receita = Leads × CR(lead→consulta) × CR(consulta→tratamento) × Valor do tratamento",
    marcos: [
      { chave: "visitante", nome: "visitante", coletor: "cliques", familia: "D1", fonte: "Search Console" },
      { chave: "lead", nome: "lead (form / WhatsApp)", coletor: "leads", familia: "D4", fonte: "`crm_leads` ou tabela de leads do próprio projeto" },
      { chave: "contatado", nome: "contato feito", coletor: null, familia: "D4", fonte: "CRM da clínica / WhatsApp de quem atende" },
      { chave: "agendada", nome: "consulta AGENDADA", coletor: null, familia: "D4", fonte: "agenda da clínica" },
      // No-show é etapa PRÓPRIA, não ruído: agendar e não comparecer é um vazamento inteiro que
      // some quando as duas etapas viram uma só.
      { chave: "compareceu", nome: "COMPARECEU", coletor: null, familia: "D4", fonte: "agenda da clínica (presença)" },
      { chave: "tratamento", nome: "tratamento INICIADO", coletor: "vendas", familia: "D4", fonte: "extrato do gateway / contrato do tratamento" },
    ],
  },
};

/**
 * A família do BURACO, não a do degrau. O degrau declara sua família padrão, mas o motivo do
 * `não apurado` sobrepõe: "sem propriedade no GSC" é D1 (não há onde olhar, o conserto é domínio
 * próprio), enquanto "nunca recebeu lead" é D4 (o evento não chega a tabela nenhuma).
 *
 * Sem isso a atribuição seria decorativa — e a §5 diz que ela decide qual das quatro famílias
 * recebe o trabalho.
 *
 * @param {Marco} marco @param {Celula} celula @returns {string|null} chave de FAMILIAS, ou null se apurado
 */
export function familiaDe(marco, celula) {
  if (ehApurado(celula)) return null;
  const motivo = String(celula?.naoApurado ?? "");
  if (/propriedade|GSC|indexa/i.test(motivo)) return "D1";
  if (/ausente|indisponível|indisponivel|nunca recebeu|teste|sem pipeline|sem coletor|sem régua|sem regra/i.test(motivo)) return "D4";
  return marco.familia;
}

/**
 * A ficha do §6 para um projeto, numa janela só (R7).
 *
 * Projeto sem perfil declarado NÃO cai num perfil padrão: cadeia errada é pior que cadeia
 * ausente, porque parece medida. Mesmo motivo de `blockers` ter virado campo em vez de grep no
 * texto — medir o texto devolvia 18 cards contra os 5 reais.
 *
 * @param {{slug:string, perfil?:string|null, coletado:Record<string,Celula>}} entrada
 */
export function montarFicha({ slug, perfil, coletado }) {
  const def = perfil ? PERFIS[perfil] : null;
  if (!def) {
    return { slug, perfil: null, semPerfil: naoApurado("sem perfil declarado no card"), marcos: [], taxas: [] };
  }

  const marcos = def.marcos.map((m) => {
    // Degrau sem coletor não é 0 e não é omissão: é a fonte que ainda não foi consultada (R4).
    const celula = m.coletor ? (coletado[m.coletor] ?? naoApurado(`coletor \`${m.coletor}\` não rodou`)) : naoApurado(`sem coletor — consultar ${m.fonte}`);
    return { ...m, celula, familiaDoBuraco: familiaDe(m, celula) };
  });

  // O denominador de uma etapa é o numerador da anterior. Se não for, a cadeia tem furo — e é
  // `razao()` de lib/funil.mjs que recusa `0/0` e numerador > denominador, não este arquivo.
  const taxas = marcos.slice(1).map((m, i) => ({
    de: marcos[i].nome,
    para: m.nome,
    numerador: m.celula,
    denominador: marcos[i].celula,
    celula: razao(m.celula, marcos[i].celula),
  }));

  return { slug, perfil, perfilNome: def.nome, n1: def.n1, n2: def.n2, marcos, taxas };
}

/**
 * A §7 como função, e o CURTO-CIRCUITO é a semântica: achou fator zerado, para. Não segue
 * procurando taxa baixa, porque otimizar taxa num projeto com fator zerado é exatamente o
 * desperdício que o template nomeia — dinheiro é multiplicação, e multiplicação com um fator
 * zerado dá zero por mais perfeitas que sejam as outras.
 *
 * Devolve a CÉLULA que decidiu, nunca só o número: "posição 2" sem dizer qual `não apurado` a
 * causou é a mesma opinião que esta tela existe para substituir.
 *
 * ⚠️ As posições 4 e 5 do template (volume/ticket, depois N5) NÃO são derivadas aqui. Separar
 * "taxa razoável" de "taxa ruim" exige um número de referência, e a R6 proíbe benchmark como
 * meta — empilhar percentil de elite em todas as etapas produz projeção dezenas de vezes acima
 * da média. Cadeia fechada para na posição 3 com a menor taxa apontada; o passo seguinte é
 * leitura humana, e dizer o contrário seria fabricar automação por cima de um chute.
 *
 * @param {ReturnType<typeof montarFicha>} ficha
 */
export function posicaoDeAtaque(ficha) {
  if (ficha.semPerfil) {
    return { posicao: 0, rotulo: "sem perfil declarado", motivo: ficha.semPerfil.naoApurado, celula: null };
  }

  // §7.1 — fator ZERADO. O TOPO da cadeia ganha: com entrada 0, tudo abaixo é trivialmente 0, e
  // consertar o degrau de baixo não move nada enquanto ninguém chega.
  const zerado = ficha.marcos.find((m) => ehApurado(m.celula) && m.celula.valor === 0);
  if (zerado) {
    // Zero na ENTRADA e zero no fim são doenças OPOSTAS, e a §7 fecha dizendo exatamente isso:
    // "taxa boa com volume nenhum e volume bom com taxa nenhuma... a primeira não se conserta com
    // landing melhor; a segunda não se conserta com mais tráfego. A árvore separa as duas — é
    // para isso que ela serve." Um texto só para os dois casos manda o trabalho errado: em
    // 01/09/2026 seis projetos com `visitante = 0` liam "nada em indexação move este projeto",
    // quando indexação é precisamente o único trabalho que move.
    const naEntrada = zerado === ficha.marcos[0];
    return {
      posicao: 1,
      rotulo: naEntrada ? "fator ZERADO na ENTRADA" : "fator ZERADO no fim da cadeia",
      celula: zerado.nome,
      motivo: naEntrada
        ? `\`${zerado.nome}\` = 0 apurado: ninguém chega. Taxa não existe sem denominador, e landing melhor não conserta volume nenhum — o trabalho é ${FAMILIAS.D1} Antes de otimizar qualquer coisa, a pergunta do §7 que economiza um trimestre: este projeto tem DEMANDA, ou o mercado não busca?`
        : `\`${zerado.nome}\` = 0 apurado. É multiplicação: nada em performance, indexação ou copy move este projeto enquanto este fator for zero.`,
    };
  }

  // §7.2 — apurar vem antes de melhorar. Você não sabe o tamanho do problema; pode ser que já
  // esteja bom. Buraco de encanamento (D4) primeiro, que é o que falha em silêncio.
  const buracos = ficha.marcos.filter((m) => !ehApurado(m.celula));
  const buraco = buracos.find((m) => m.familiaDoBuraco === "D4") ?? buracos[0];
  if (buraco) {
    return {
      posicao: 2,
      rotulo: `apurar antes de melhorar (${buraco.familiaDoBuraco})`,
      celula: buraco.nome,
      motivo: `\`${buraco.nome}\`: ${buraco.celula.naoApurado}. ${FAMILIAS[buraco.familiaDoBuraco]} Consultar ${buraco.fonte} antes de instrumentar coisa nova.`,
    };
  }

  // §7.3 — cadeia fechada: ataque a MENOR taxa. É multiplicação, dobrar 2% rende mais que
  // dobrar 40%.
  const comTaxa = ficha.taxas.filter((t) => ehApurado(t.celula));
  const menor = comTaxa.reduce((a, b) => (b.celula.valor < a.celula.valor ? b : a), comTaxa[0]);
  return {
    posicao: 3,
    rotulo: "cadeia fechada — atacar a menor taxa",
    celula: `${menor.de} → ${menor.para}`,
    motivo: `menor taxa da cadeia. É multiplicação: dobrar a menor rende mais que dobrar a maior. As posições 4 e 5 do §7 (volume/ticket, depois N5) são leitura humana — derivá-las exigiria benchmark como meta, e a R6 proíbe.`,
  };
}

/** Rótulos das posições, para a tela e para o rodapé. Índice = posição. */
export const POSICOES = [
  "sem perfil declarado",
  "fator ZERADO",
  "apurar antes de melhorar",
  "cadeia fechada — menor taxa",
];

/**
 * Contagem por posição. A soma TEM que dar o total, incluindo a faixa `sem perfil` (posição 0):
 * tabela cuja soma não fecha mente sobre onde a perda acontece, que é o defeito que `resumir()`
 * de lib/funil.mjs já evita com o mesmo comentário.
 *
 * @param {{posicao:number}[]} vereditos
 */
export function resumirPortfolio(vereditos) {
  const porPosicao = Array(POSICOES.length).fill(0);
  for (const v of vereditos) porPosicao[v.posicao]++;
  return { total: vereditos.length, porPosicao };
}
