// A comparação B. As réguas que existiam até aqui comparam a RESPOSTA com o dourado:
//
//   A) resposta da aba × dourado   → mede a SÍNTESE  (lib/juiz.mjs)
//   B) o CORPUS        × apurado   → mede a MEMÓRIA INSTITUCIONAL   ← isto
//
// B é a única que aponta para fora do texto. Ela responde: dos documentos que falam do estado do
// portfólio, quantos afirmam hoje uma coisa que a fonte viva desmente? Ninguém tem esse número —
// há duas provas de corpus defasado achadas por acidente (o hreflang do sirius, o HUB_USER que
// mandava "pedir ao Jean") e zero ideia se são duas ou duzentas.
//
// Só roda contra pergunta com apuração de verdade (`lib/dourado-estado.mjs`). Comparar documento
// com dourado escrito à mão seria a mesma prosa concordando com prosa de sempre.
import { campo } from "./juiz.mjs";
import { semLiteral } from "./validade.mjs";

export const VEREDITOS_DEFASAGEM = ["bate", "desmente", "nao-fala"];

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 🚩 A 2ª VIA DE SELEÇÃO — porque o gargalo é QUAL documento chega ao detector, não o prompt.
//
// A 1ª via é a busca da aba (BM25 + vetor + reranker), e ela seleciona por SEMELHANÇA DE TEMA.
// Um número defasado citado de passagem num documento sobre outro assunto nunca entra no top-10:
// a memória `project_cannibalscan` afirmava "Hub: 39 projetos" (hoje 35) dentro de um documento
// sobre deploy da Vercel, e em 01/08 um grep ancorado no fato a achou em segundos enquanto o
// `corpus-defasado.mjs` nunca a tinha emitido. É o mesmo mecanismo dos erros `bate → nao-fala`
// do holdout: o aparato julga o TEMA do documento, e a afirmação defasada está lá do mesmo jeito.
//
// As três tentativas que falharam (duas redações de regra, uma decomposição em duas passadas)
// mexeram todas no prompt. Nenhuma mexeu em quais documentos chegam até ele.
//
// Zero LLM, zero rede: é grep sobre o corpus que a busca já carregou.
//
// ⚠️ A SELEÇÃO É ENVIESADA DE PROPÓSITO — só entra documento cujo número DIVERGE do apurado. Por
// isso o que sai daqui alimenta a LISTA NOMINAL e NUNCA o percentual: misturar amostra procurada
// com amostra recuperada inflaria a taxa de erro do corpus com a própria consulta que a produziu.
// Quem separa é `scripts/corpus-defasado.mjs`, no campo `via`.
/**
 * Documentos que CITAM a quantidade do fato com número diferente do apurado.
 * @param {{id:string, tipo:string, titulo:string, texto:string}[]} docs
 * @param {{nome:string, re:RegExp, valor:number}[]} citacoes âncoras do apurador (`re` com /g e
 *   um grupo de captura por alternativa; `valor` é o número de hoje)
 * @returns {{doc:object, casamentos:string[]}[]}
 */
export function docsQueCitam(docs, citacoes = []) {
  const achados = [];
  for (const doc of docs) {
    // Literal não é afirmação: crase e bloco cercado saem antes do casamento, pela mesma regra
    // (e pela mesma função) do `scripts/validade.mjs`.
    const texto = semLiteral(doc.texto);
    const casamentos = [];
    for (const c of citacoes) {
      for (const m of texto.matchAll(c.re)) {
        // Uma alternativa por grupo: o número é o único grupo que casou.
        const n = Number(m.slice(1).find((g) => g !== undefined));
        if (!Number.isFinite(n) || n === c.valor) continue;
        casamentos.push(m[0].replace(/\s+/g, " ").trim());
      }
    }
    if (casamentos.length) achados.push({ doc, casamentos });
  }
  return achados;
}
// ─────────────────────────────────────────────────────────────────────────────────────────────

export function montarPromptDefasagem(pergunta, apurado, doc) {
  return `Você audita a memória institucional de um portfólio de projetos de software. Um FATO foi apurado hoje na fonte viva (API, arquivo do repositório, Search Console). Você vai dizer se um DOCUMENTO da memória afirma algo incompatível com esse fato.

PERGUNTA QUE O FATO RESPONDE: ${pergunta}

FATO APURADO (${apurado.fonte}, em ${apurado.apurado_em}):
${apurado.resposta}
${apurado.ressalva ? `\nLIMITAÇÃO DA MEDIÇÃO (como o fato foi medido — NÃO é uma afirmação sobre o assunto):\n${apurado.ressalva}\n` : ""}
DOCUMENTO (${doc.tipo}) ${doc.titulo}:
${doc.trecho}

Regras:
- \`desmente\` só quando o documento AFIRMA algo incompatível com o fato: número diferente para a mesma coisa, negação do que a fonte viva mostra, instrução que o fato torna errada. Incompatível, não apenas diferente em detalhe.
- \`bate\` quando o documento afirma sobre esse assunto e é compatível com o fato — inclusive quando descreve a REGRA (como se mede, onde se publica) sem citar o número.
- \`nao-fala\` quando o documento não trata do que a pergunta pede. É o veredito mais comum e não é defeito nenhum.
- Documento datado que descreve o passado explicitamente ("em 30/07 eram 36") não desmente o presente: só é \`desmente\` se ele afirma valer HOJE.
- A LIMITAÇÃO DA MEDIÇÃO nunca torna um documento \`desmente\` sozinha. Documento que afirma o mesmo número do fato \`bate\`, mesmo que a medição tenha ressalva — o documento não tinha como saber dela, e concordar com o número é concordar.
- Não use conhecimento seu sobre o assunto: compare o documento com o fato apurado, e nada mais.

O TRECHO é conferido contra o documento, palavra por palavra:
- copie UM trecho contínuo, exatamente como está escrito acima. Não junte pedaços distantes, não troque uma data ou um nome de lugar, não reescreva.
- para omitir o meio de uma frase longa, use … — cada pedaço continua sendo conferido.
- \`desmente\` EXIGE trecho: acusação sem a frase citada não conta como achado e é descartada.

Responda em exatamente três linhas, NESTA ORDEM, sem preâmbulo e sem nada depois:
TRECHO: o trecho copiado do documento, ou - se nenhuma frase do documento trata do assunto
MOTIVO: uma frase curta comparando o que esse trecho afirma com o fato apurado
VEREDITO: bate|desmente|nao-fala`;
}

// O TRECHO e o MOTIVO vêm ANTES do VEREDITO de propósito, e isso é decisão de engenharia, não de
// redação. Com `VEREDITO:` na primeira linha o modelo tinha que cravar a decisão antes de escrever
// o raciocínio que a justifica, e o resultado apareceu três vezes na calibração de 01/08 —
// `VEREDITO: bate` com `MOTIVO: o número "hoje 9, BATIDO" é incompatível com o apurado (2) —
// desmente.` A linha 3 chegava ao veredito certo porque foi escrita depois de pensar; a linha 1
// tinha sido escrita antes. Duas redações de REGRA já haviam falhado nesse mesmo formato (71,4% e
// 50,0% no holdout), o que é o sinal de que o texto das regras não era o problema.
// Só letras e dígitos sobrevivem à comparação, e isso foi MEDIDO, não escolhido por elegância:
// com espaço normalizado apenas, 8 citações da calibração de 01/08 foram reprovadas e NENHUMA era
// fabricada — o modelo cita a prosa e larga o markdown (`**19/10** — gate do \`tapepro\`` volta como
// `19/10 — gate do tapepro`), junta dois bullets numa linha, troca aspas. Reprovar isso seria
// trocar alucinação de citação por diagramação, que é o erro que este check existe para não ser.
// Letra e dígito bastam para pegar a fabricação de verdade: número trocado e palavra trocada não
// sobrevivem. O que passou a cair aqui é o caso REAL — o modelo escrevendo `TRECHO: nao-fala`.
const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

// A citação é conferida com espaço normalizado e sem caixa: o modelo reproduz a frase certa e
// erra a quebra de linha do recorte, e reprovar por isso seria trocar alucinação por diagramação.
// Elipse é elisão legítima do meio da frase — cada pedaço tem que estar lá, na ordem.
export function citadoNoDoc(trecho, docTrecho) {
  if (!docTrecho || !trecho || trecho === "-") return true;
  return trecho.split(/\s*(?:\.\.\.|…)\s*/).filter(Boolean).every((p) => norm(docTrecho).includes(norm(p)));
}

// Falha FECHADA como a do juiz: veredito fora do vocabulário vira erro, nunca `nao-fala`. Um
// parse tolerante aqui esconderia documento defasado atrás de "o modelo não respondeu direito",
// que é justamente o número que esta régua existe para produzir.
//
// E, desde 01/08, a coerência interna também falha fechada. `desmente` é o único veredito que
// vira TAREFA (uma edição de memória ou de handoff), e ele passava sem evidência nenhuma: bastava
// a linha do veredito. Agora um achado sem citação, ou com citação que não está no documento, não
// conta como achado — é o mesmo princípio do `resposta-sem-citacao` da aba de busca, onde prosa
// fluente sem procedência tem a autoridade da resposta e nenhuma da fonte.
// ─────────────────────────────────────────────────────────────────────────────────────────────
// 🚩 DUAS PASSADAS — TENTADO, MEDIDO E REPROVADO EM 01/08. Fica aqui como registro, atrás de
// `--duas-passadas`, porque a hipótese era boa e o número é o único jeito de não repeti-la.
//
//   contra o MESMO fixture congelado (44 holdout + 20 adversariais):
//
//   política          holdout        adversarial   células perigosas
//   uma passada       83,3% (35/42)  14/20         ZERO
//   duas passadas     65,9% (29/44)  14/20         `bate→desmente` 5 · `desmente→nao-fala` 1
//
// Perdeu 17 pontos, não mexeu no adversarial, e — o que decide — QUEBROU a única propriedade que
// valia mais que o agregado: com uma passada o detector nunca fabricou tarefa nem escondeu corpus
// podre; com duas, fabricou 5 e escondeu 1.
//
// A CAUSA, e ela generaliza: a passada 2 é cega ao documento de propósito, para não poder
// absolver por assunto — mas cega ao documento é também cega ao CONTEXTO que torna uma afirmação
// compatível. Vendo só a afirmação e o fato, ela grita `desmente` em qualquer divergência
// literal: chamou de incompatível "a fonte é a API do GitHub + `lib/projects.mjs`
// (`listProjects()`)" contra um apurado que diz "API do GitHub + `data/projects.json` via
// `mergeProjects()`" — o MESMO mecanismo com outro nome. Trocar absolvição indevida por acusação
// indevida não é conserto, é mudar de lado o mesmo erro, e a acusação é o lado caro.
//
// O que funcionou três vezes NÃO foi separar em duas CHAMADAS: foi forçar a evidência antes da
// decisão DENTRO da mesma chamada (`TRECHO → MOTIVO → VEREDITO`). É a mesma forma da lição do
// reranker — o modelo acerta o conjunto e erra a ordem porque não vê o score do BM25; aqui ele
// acerta a incompatibilidade literal e erra a compatibilidade contextual porque não vê o texto.
// **A próxima tentativa não é uma terceira redação de regra nem uma terceira decomposição: os
// 6 erros que restam com uma passada são todos `bate → nao-fala`, e todos caem no lado seguro.**
//
// ↓ o que segue é a implementação medida, preservada para que o número acima seja reproduzível.
//
// Com uma passada só, TODOS os erros do holdout de 01/08 (4 de 33) e, depois de ampliar para 44
// casos, TODOS os 7, são `bate → nao-fala`; 4 dos 6 adversariais perdidos são `desmente →
// nao-fala`. Ampliar o fixture de 33 para 44 e de 10 para 20 não mudou o modo de falha, só a
// resolução: é UM defeito, não ruído. O motivo que o detector escreve é sempre da mesma forma —
// *"o documento trata de X, não do que a pergunta pede"* — e ele o escreve olhando para o fato
// apurado.
//
// Com uma passada só, TODOS os erros do holdout de 01/08 (4 de 33) e, depois de ampliar para 44
// casos, TODOS os 7, são `bate → nao-fala`; 4 dos 6 adversariais perdidos são `desmente →
// nao-fala`. Ampliar o fixture de 33 para 44 e de 10 para 20 não mudou o modo de falha, só a
// resolução: é UM defeito, não ruído. O motivo que o detector escreve é sempre da mesma forma —
// *"o documento trata de X, não do que a pergunta pede"* — e ele o escreve olhando para o fato
// apurado. Ou seja: ele decide o TEMA do documento com o fato na mão e constrói a desculpa para
// absolver.
//
//   passada 1 (CEGA AO FATO):      que afirmação este documento faz sobre X? → frase ou `nenhuma`
//   passada 2 (CEGA AO DOCUMENTO): esta afirmação é compatível com este fato? → bate|desmente
//
// É a mesma decomposição que fez o juiz funcionar (`lib/juiz.mjs`, passada A cega ao dourado) e a
// mesma lição que inverter `TRECHO → MOTIVO → VEREDITO` já tinha dado: separar a extração da
// evidência do julgamento dela. `nao-fala` deixa de COMPETIR com os outros dois vereditos — ele
// não é mais uma escolha do julgamento, é a saída da extração.
//
// Custo: 2 chamadas por documento em vez de 1. Mas a passada 1 não vê o apurado, então sua chave
// de cache não muda quando o fato muda — reapurar o GSC amanhã reaproveita as 286 extrações e só
// a passada 2 (prompt curto, sem o documento) roda de novo.
export function montarPromptAfirmacao(pergunta, doc) {
  return `Você lê um DOCUMENTO da memória institucional de um portfólio de projetos de software e extrai o que ele afirma sobre um assunto. Você NÃO julga se o que ele afirma é certo ou errado — você não tem como saber, e supor seria inventar.

ASSUNTO (a pergunta que outra pessoa vai responder com uma fonte viva): ${pergunta}

DOCUMENTO (${doc.tipo}) ${doc.titulo}:
${doc.trecho}

Regras:
- Copie a frase do documento que afirma algo sobre esse assunto, mesmo que ela não traga número — descrever a REGRA (como se mede, de onde sai o número, onde se publica) é afirmar sobre o assunto.
- Documento datado que descreve o passado ("em 30/07 eram 36") TAMBÉM afirma: copie a frase inteira, com a data junto. Quem julga precisa ver a data.
- Se mais de uma frase afirma, escolha a mais específica — a que traz número, nome ou data.
- \`nenhuma\` só quando NENHUMA frase do documento trata do assunto. Não force: documento que fala de outro projeto, ou do aparato que mede o assunto em vez do assunto, não afirma sobre ele.

O TRECHO é conferido contra o documento, palavra por palavra:
- copie UM trecho contínuo, exatamente como está escrito acima. Não junte pedaços distantes, não troque uma data ou um nome de lugar, não reescreva.
- para omitir o meio de uma frase longa, use … — cada pedaço continua sendo conferido.

Responda em exatamente duas linhas, NESTA ORDEM, sem preâmbulo e sem nada depois:
TRECHO: o trecho copiado do documento, ou - se nenhuma frase trata do assunto
AFIRMACAO: em uma frase, o que esse trecho afirma sobre o assunto, ou nenhuma`;
}

// A passada 2 recebe a afirmação e o trecho, NUNCA o documento inteiro nem seu título. Sem o
// documento ela não tem do que dizer "trata de outra coisa" — a saída `nao-fala` nem existe aqui,
// e é isso que impede a absolvição por assunto. O vocabulário tem dois valores, não três.
export function montarPromptCompatibilidade(pergunta, apurado, afirmacao, trecho) {
  return `Um FATO foi apurado hoje na fonte viva (API, arquivo do repositório, Search Console). Você vai dizer se uma AFIRMAÇÃO, extraída de um documento por outra pessoa, é compatível com esse fato.

PERGUNTA QUE O FATO RESPONDE: ${pergunta}

FATO APURADO (${apurado.fonte}, em ${apurado.apurado_em}):
${apurado.resposta}
${apurado.ressalva ? `\nLIMITAÇÃO DA MEDIÇÃO (como o fato foi medido — NÃO é uma afirmação sobre o assunto):\n${apurado.ressalva}\n` : ""}
AFIRMAÇÃO EXTRAÍDA DO DOCUMENTO:
${afirmacao}

FRASE LITERAL DE ONDE ELA SAIU:
${trecho}

Você NÃO vê o documento de onde isso saiu e não deve supor nada sobre o resto dele. Já está decidido que ele afirma sobre este assunto: sua tarefa é só comparar esta afirmação com este fato.

Regras:
- \`desmente\` quando a afirmação é incompatível com o fato: número diferente para a mesma coisa, negação do que a fonte viva mostra, instrução que o fato torna errada. Incompatível, não apenas diferente em detalhe.
- \`bate\` quando a afirmação é compatível — inclusive quando descreve a REGRA sem citar o número, e inclusive quando é parcial (omitir não é contradizer).
- Afirmação que descreve o passado com a data explícita ("em 30/07 eram 36") \`bate\`, mesmo que o número de hoje seja outro: ela não afirma valer HOJE. Sem data grudada no número, ela afirma o presente.
- Número que aparece como EXEMPLO ou como relato de um erro ("corrompi para dizer 12 em vez de 35") não é afirmado — vale o que a frase afirma, não o que ela cita.
- A LIMITAÇÃO DA MEDIÇÃO nunca torna uma afirmação \`desmente\` sozinha. Afirmação com o mesmo número do fato \`bate\`, mesmo que a medição tenha ressalva.
- Não use conhecimento seu sobre o assunto: compare a afirmação com o fato apurado, e nada mais.

Responda em exatamente duas linhas, NESTA ORDEM, sem preâmbulo e sem nada depois:
MOTIVO: uma frase curta comparando o que a afirmação diz com o fato apurado
VEREDITO: bate|desmente`;
}

export function parseAfirmacao(texto, docTrecho = "") {
  const trecho = campo(texto, "TRECHO", false);
  const afirmacao = campo(texto, "AFIRMACAO", false);
  const semTrecho = !trecho || trecho === "-";
  const nenhuma = !afirmacao || afirmacao.toLowerCase().startsWith("nenhuma");
  // A extração falha fechada como o resto: sem AFIRMACAO nenhuma o modelo não respondeu, e tratar
  // isso como `nao-fala` esconderia documento defasado atrás de "o modelo não respondeu direito".
  if (!afirmacao) return { fala: false, trecho: "", afirmacao: "", erro: "defasagem-output" };
  if (nenhuma || semTrecho) return { fala: false, trecho: "", afirmacao: "", erro: "" };
  if (!citadoNoDoc(trecho, docTrecho)) return { fala: false, trecho, afirmacao, erro: "defasagem-citacao" };
  return { fala: true, trecho, afirmacao, erro: "" };
}

export function parseCompatibilidade(texto) {
  const bruto = campo(texto, "VEREDITO");
  // Só `bate` e `desmente`: a passada 2 não tem como devolver `nao-fala`, e aceitá-lo aqui
  // reabriria a porta que a decomposição existe para fechar.
  const veredito = ["bate", "desmente"].find((v) => bruto.startsWith(v)) ?? "";
  return { veredito, motivo: campo(texto, "MOTIVO", false), erro: veredito ? "" : "defasagem-output" };
}

// Orquestra as duas passadas e devolve o MESMO contrato de `parseDefasagem` — `{veredito, trecho,
// motivo, erro}` —, para que `defasagem-calibrar.mjs` e `corpus-defasado.mjs` troquem uma linha e
// não a leitura da saída. `rodar(prompt)` é injetado: quem chama decide cache e effort.
export async function julgarDuasPassadas(pergunta, apurado, doc, rodar) {
  let extraido;
  try {
    extraido = parseAfirmacao(await rodar(montarPromptAfirmacao(pergunta, doc)), doc.trecho);
  } catch (err) {
    return { veredito: "", trecho: "", motivo: "", erro: err.message.replace(/^rerank-/, "defasagem-") };
  }
  if (extraido.erro) return { veredito: "", trecho: extraido.trecho, motivo: extraido.afirmacao, erro: extraido.erro };
  if (!extraido.fala) return { veredito: "nao-fala", trecho: "", motivo: "nenhuma frase do documento trata do assunto", erro: "" };

  let julgado;
  try {
    julgado = parseCompatibilidade(await rodar(montarPromptCompatibilidade(pergunta, apurado, extraido.afirmacao, extraido.trecho)));
  } catch (err) {
    return { veredito: "", trecho: extraido.trecho, motivo: "", erro: err.message.replace(/^rerank-/, "defasagem-") };
  }
  return { veredito: julgado.veredito, trecho: extraido.trecho, motivo: julgado.motivo, erro: julgado.erro };
}

export function parseDefasagem(texto, docTrecho = "") {
  const bruto = campo(texto, "VEREDITO");
  const veredito = VEREDITOS_DEFASAGEM.find((v) => bruto.startsWith(v)) ?? "";
  const trecho = campo(texto, "TRECHO", false);
  const semTrecho = !trecho || trecho === "-";
  const citado = citadoNoDoc(trecho, docTrecho);
  let erro = "";
  if (!veredito) erro = "defasagem-output";
  else if (veredito === "desmente" && semTrecho) erro = "defasagem-incoerente";
  else if (!citado) erro = "defasagem-citacao";
  return { veredito, trecho, motivo: campo(texto, "MOTIVO", false), erro };
}

