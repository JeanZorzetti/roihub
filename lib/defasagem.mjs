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

Responda em exatamente três linhas, sem preâmbulo e sem nada depois:
VEREDITO: bate|desmente|nao-fala
TRECHO: a frase literal do documento que decidiu, ou - se nenhuma
MOTIVO: uma frase curta.`;
}

// Falha FECHADA como a do juiz: veredito fora do vocabulário vira erro, nunca `nao-fala`. Um
// parse tolerante aqui esconderia documento defasado atrás de "o modelo não respondeu direito",
// que é justamente o número que esta régua existe para produzir.
export function parseDefasagem(texto) {
  const bruto = campo(texto, "VEREDITO");
  const veredito = VEREDITOS_DEFASAGEM.find((v) => bruto.startsWith(v)) ?? "";
  return {
    veredito,
    trecho: campo(texto, "TRECHO", false),
    motivo: campo(texto, "MOTIVO", false),
    erro: veredito ? "" : "defasagem-output",
  };
}
