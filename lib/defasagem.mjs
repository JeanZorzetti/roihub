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

export const VEREDITOS_DEFASAGEM = ["bate", "desmente", "nao-fala"];

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

// Falha FECHADA como a do juiz: veredito fora do vocabulário vira erro, nunca `nao-fala`. Um
// parse tolerante aqui esconderia documento defasado atrás de "o modelo não respondeu direito",
// que é justamente o número que esta régua existe para produzir.
//
// E, desde 01/08, a coerência interna também falha fechada. `desmente` é o único veredito que
// vira TAREFA (uma edição de memória ou de handoff), e ele passava sem evidência nenhuma: bastava
// a linha do veredito. Agora um achado sem citação, ou com citação que não está no documento, não
// conta como achado — é o mesmo princípio do `resposta-sem-citacao` da aba de busca, onde prosa
// fluente sem procedência tem a autoridade da resposta e nenhuma da fonte.
export function parseDefasagem(texto, docTrecho = "") {
  const bruto = campo(texto, "VEREDITO");
  const veredito = VEREDITOS_DEFASAGEM.find((v) => bruto.startsWith(v)) ?? "";
  const trecho = campo(texto, "TRECHO", false);
  const semTrecho = !trecho || trecho === "-";
  // A citação é conferida com espaço normalizado e sem caixa: o modelo reproduz a frase certa e
  // erra a quebra de linha do recorte, e reprovar por isso seria trocar alucinação por diagramação.
  // Elipse é elisão legítima do meio da frase — cada pedaço tem que estar lá, na ordem.
  const citado = docTrecho && !semTrecho
    ? trecho.split(/\s*(?:\.\.\.|…)\s*/).filter(Boolean).every((p) => norm(docTrecho).includes(norm(p)))
    : true;
  let erro = "";
  if (!veredito) erro = "defasagem-output";
  else if (veredito === "desmente" && semTrecho) erro = "defasagem-incoerente";
  else if (!citado) erro = "defasagem-citacao";
  return { veredito, trecho, motivo: campo(texto, "MOTIVO", false), erro };
}

