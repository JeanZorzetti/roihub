// A norma que impede a defasagem de NASCER. A primeira corrida do detector de defasagem achou 5
// documentos desmentidos pela fonte viva e os 5 eram o mesmo defeito: `(hoje N)` escrito em prosa.
// Era verdade no dia — a palavra *hoje* num documento que sobrevive ao dia continua se afirmando
// presente para sempre. Corrigir os 5 não resolve nada: o 6º nasce amanhã.
//
// Zero LLM é decisão de projeto, não economia: este check tem que rodar em TODA entrega, como o
// `npm test`. Régua que divide pool com o autopublishing roda uma vez por mês e vira enfeite.
//
// ⚠️ Só documento VIVO (memória, protocolo, card). Handoff é registro datado e é o único lugar
// onde se vê o que se sabia quando a decisão foi tomada — reescrevê-lo para "bater com hoje"
// destrói a única série temporal desta base.

// Dois formatos, porque a casa escreve dos dois jeitos. O segundo para na pontuação: sem isso ele
// engole o parágrafo inteiro e absolve com qualquer data que apareça três frases adiante.
export const PADROES = [
  { nome: "(hoje N)", re: /\((?:hoje|atualmente|agora)\b[^)]*\)/gi },
  { nome: "hoje é N", re: /\bhoje\s+(?:são|é|eram|temos|tem|há|está|estão)\b[^.;\n]*/gi },
];

// A absolvição é avaliada DENTRO do trecho casado, nunca na linha. Na linha, `PRT-03` — o único
// achado real desta família — seria absolvido pela data do gate ("até 19/10/2026 (hoje 21)"), que
// não é a data do número: é o prazo. Data que não gruda no número não data coisa nenhuma.
const ABSOLVE = /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}\b|apurad|se apura|dourado-estado/i;

// Crase é a marca de "isto é literal, não é minha afirmação" — e sem esta linha o check reprova
// justamente os documentos que ENSINAM a norma citando o defeito ("`(hoje 21)`"), que foi o que
// aconteceu na memória do corpus 20 minutos depois de ele passar limpo.
// BLOCO CERCADO é a MESMA classe, e não estava mascarado: saída de script colada em ``` traz
// número de sobra e não afirma nada. Medido na mineração de 01/08, onde ele foi um dos 5 defeitos
// do check — ali absolveu `D-70`/`D-71`, cujos números só aparecem em saída de terminal colada.
// A máscara preserva `\n` porque o achado reporta a LINHA: trocar o bloco por nada deslocaria
// todas as linhas seguintes do arquivo.
// ponytail: regex, não parser de markdown; ``` dentro de crase e crase dentro de ``` escapam,
// mas nenhum dos 6 achados reais até hoje estava — se aparecer um, aí vale o parser.
const mascarar = (m) => m.replace(/[^\n]/g, " ");
export const semLiteral = (texto) =>
  texto.replace(/```[\s\S]*?```/g, mascarar).replace(/`[^`]*`/g, mascarar);

/** Afirmações de presente com número e sem data/apuração junto. `{ linha, padrao, trecho }[]`. */
export function afirmacoesDePresente(texto) {
  const achados = [];
  // A máscara roda no texto INTEIRO antes de quebrar em linhas: bloco cercado atravessa linha,
  // e mascarar linha a linha nunca o veria.
  semLiteral(texto).split("\n").forEach((linha, i) => {
    for (const { nome, re } of PADROES) {
      for (const m of linha.matchAll(re)) {
        // Sem dígito não há número que apodreça: "(hoje o deploy é Docker)" é regra, não placar.
        if (!/\d/.test(m[0]) || ABSOLVE.test(m[0])) continue;
        achados.push({ linha: i + 1, padrao: nome, trecho: m[0].trim() });
      }
    }
  });
  return achados;
}
