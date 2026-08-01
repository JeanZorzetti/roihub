// Síntese com citação estrita sobre o top-10 da busca. O handoff de 31/07 apontou o número que
// justifica isto: depois do reranker o recall@10 é 88,0% mas o @1 é 34,2% — o material para
// responder está lá em 88% das perguntas, e ainda assim dois terços das buscas não põem a
// resposta em primeiro lugar. A lista LISTA; o custo que a aba existe para eliminar (abrir,
// ler, decidir) continua sendo pago, só que sobre 10 documentos em vez de 263.
//
// A tensão, dita na cara: sintetizar sobre um corpus com taxa de erro desconhecida transforma
// erro silencioso em erro FLUENTE. A defesa não é evitar a síntese, é citação estrita e
// FALHA FECHADA — resposta sem `[n]` válido não é renderizada. Hoje uma memória errada na
// posição 3 é lida e acreditada sem sinal nenhum; com citação ela fica conferível em um clique.
import { rodarClaude, rodarCacheado, trechoRelevante } from "./reranker.mjs";

// 2400 contra os 900 do reranker: lá são 50 candidatos e o orçamento é a restrição de janela;
// aqui são 10 e o que custa caro é responder por cima de um recorte que cortou justo a frase
// que sustentava a afirmação. Mesma armadilha medida na fase do reranker (recorte fixo tem viés
// contra doc longo: `fonte@10` de handoff caiu para 28,3% com 400 chars), agora com folga.
const ORCAMENTO = 2400;
export const RECUSA = "NÃO ESTÁ NO CORPUS";

// Os índices são 1-based porque a aba os renderiza como a numeração da própria lista de
// resultados: `[3]` na resposta é o 3º card abaixo dela. Sem esse casamento, conferir a citação
// exigiria um mapa extra na tela — e citação que dá trabalho de conferir não é conferida.
export function montarPromptResposta(pergunta, docs) {
  const lista = docs.map((d, i) => `[${i + 1}] (${d.tipo}) ${d.titulo}\n${d.trecho}`).join("\n\n");
  return `Você responde perguntas sobre a memória institucional de um portfólio de projetos de software, usando SOMENTE os trechos abaixo.

PERGUNTA: ${pergunta}

TRECHOS:
${lista}

Regras:
- Responda em português, direto, no máximo 5 frases. Sem preâmbulo, sem título, sem lista de fontes no fim.
- Toda afirmação termina com a citação do trecho que a sustenta, no formato [1] ou [1][4]. Afirmação que você não consegue citar não pode ser escrita.
- Não use nada que não esteja nos trechos, nem conhecimento seu sobre o assunto.
- A pergunta é quase sempre sobre a PRÁTICA, não sobre o caso específico citado nela: um trecho que estabelece a regra sustenta a resposta mesmo que o seu projeto, endpoint ou data não apareçam em lugar nenhum.
- Escreva ${RECUSA} só quando nenhum trecho tratar do assunto — nunca porque eles tratam dele em outro projeto.`;
}

// Índices citados, na ordem em que aparecem. Fora da faixa é descartado em silêncio: o modelo às
// vezes cita [11] com 10 trechos, e renderizar uma citação que não aponta para card nenhum é
// pior que não citar — parece conferível e não é.
export function citacoes(texto, total) {
  const vistos = [];
  for (const m of String(texto ?? "").matchAll(/\[(\d+)\]/g)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= total && !vistos.includes(n)) vistos.push(n);
  }
  return vistos;
}

const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

// Contrato: `texto` vazio significa "não há resposta para mostrar" e a lista fica sozinha, que é
// exatamente o comportamento de hoje. As três razões para vazio ficam separadas em `erro`:
// recusa (""), síntese sem citação ("resposta-sem-citacao") e falha de CLI (a mensagem). Só as
// duas últimas viram aviso no rodapé — recusa é o sistema funcionando.
export async function responder(pergunta, docs, { run = rodarClaude, cache = false } = {}) {
  if (!pergunta.trim() || !docs.length) return { texto: "", fontes: [], erro: "" };
  const prompt = montarPromptResposta(pergunta, docs);
  try {
    const texto = (await rodarCacheado(prompt, run, cache, { effort: "medium" })).trim();
    // A CITAÇÃO decide, não a frase de recusa — e nessa ordem por um erro medido: procurar
    // `${RECUSA}` em qualquer lugar do texto apagou 5 das 78 respostas do dourado que eram
    // completas e citadas, e só abriam com uma ressalva ("${RECUSA} quanto a X, mas sobre Y a
    // regra é… [1][3]"). Recusa PARCIAL é o comportamento certo e fica na tela; recusa de
    // verdade é a que não conseguiu citar nada.
    const fontes = citacoes(texto, docs.length);
    if (fontes.length) return { texto, fontes, erro: "" };
    if (semAcento(texto).includes(semAcento(RECUSA))) return { texto: "", fontes: [], erro: "" };
    // Falha FECHADA: prosa fluente sem citação é o pior resultado possível deste componente —
    // ela tem a autoridade da resposta e nenhuma da procedência. Melhor devolver a lista.
    return { texto: "", fontes: [], erro: "resposta-sem-citacao" };
  } catch (err) {
    // `rodarClaude` é compartilhado com o reranker e seus códigos começam com `rerank-`. Deixar
    // "rerank-output" no rodapé da RESPOSTA mandaria a próxima sessão debugar o reranker.
    return { texto: "", fontes: [], erro: err.message.replace(/^rerank-/, "resposta-") };
  }
}

// Os 10 documentos já ranqueados, recortados no orçamento da síntese.
export function trechosPara(docs, termos) {
  return docs.map((d) => ({ tipo: d.tipo, titulo: d.titulo, trecho: trechoRelevante(d.texto, termos, ORCAMENTO) }));
}
