// Juiz da SÍNTESE. `scripts/avaliar.mjs` mede recuperação ("o doc certo está entre os 10?") e
// `scripts/avaliar-resposta.mjs` mede ancoragem ("a citação aponta para um doc que o dourado
// reconhece?"). Citar a fonte certa e resumi-la errado passa com 100% nas duas — é o modo de
// falha mais caro do componente, porque a saída é indistinguível de uma resposta correta.
//
// O QUE ESTE JUIZ MEDE: "o que o sistema escreveu bate com o que a instituição sabe?"
// O QUE ELE NÃO MEDE: "o que a instituição sabe é verdade?". O dourado foi escrito por um agente
// lendo o mesmo corpus, então isto é CONSISTÊNCIA INTERNA: se o corpus está errado, o dourado
// provavelmente repete o erro e o juiz aprova com nota máxima. Verdade contra a realidade é o
// `scripts/conformidade.mjs`, que bate 10 normas contra os 35 projetos sem LLM nenhum.
//
// Duas passadas de propósito, e a diferença entre elas é o sinal mais valioso:
//
//   FIDELIDADE (A)  CONCORDÂNCIA (B)  significado
//   fiel            concorda          resposta boa
//   infiel          discorda          a síntese errou — bug de prompt/recorte
//   infiel          concorda          acertou por sorte; o corpus não sustenta o que ela disse
//   fiel            discorda          ou o dourado está errado, ou o corpus está errado  ← o achado
//
// A última linha é o único mecanismo deste sistema que aponta o dedo para DENTRO do corpus: uma
// resposta fielmente derivada das fontes que contradiz o que a instituição julga saber é, por
// definição, contradição entre dois documentos. Juntar as duas passadas num prompt só economiza
// uma chamada e destrói exatamente essa célula.
import { rodarClaude, rodarCacheado } from "./reranker.mjs";

// Sem fallback silencioso: se `opus` não responder, a corrida falha com `juiz-output` em vez de
// cair para `sonnet`. Cair para o modelo que ESCREVEU a resposta reintroduziria o viés de
// auto-preferência sem ninguém notar, e o número sairia melhor justamente por isso. Toda corrida
// grava o modelo que julgou (`scripts/avaliar-resposta.mjs`), então o veredito nunca fica órfão.
export const MODELO_JUIZ = process.env.JUIZ_MODEL || "opus";

export const VEREDITOS = ["correta", "incompleta", "contradiz", "recusou"];
// `recusou` não está aqui: ele é decidido pelo CONTRATO de `responder()` (texto vazio sem erro),
// nunca pelo LLM. Deixar o juiz "concluir" que houve recusa criaria um jeito de uma resposta
// errada virar recusa e sumir da conta.
const VEREDITOS_LLM = ["correta", "incompleta", "contradiz"];

// Três linhas com chave: maiúscula em vez de JSON porque claude-cli não tem `json_schema` strict
// e o parse de objeto no meio de prosa é o problema que `parseJsonBlock` existe para resolver.
// Para três campos escalares, uma regex por linha é menor e não quebra com chaves na prosa.
export function montarPromptJuiz(pergunta, gerada, dourado) {
  return `Você audita a resposta de um sistema de busca sobre a memória institucional de um portfólio de projetos de software. Existe uma RESPOSTA DE REFERÊNCIA escrita à mão: ela é o que a instituição sabe hoje, e é o padrão contra o qual você julga.

PERGUNTA: ${pergunta}

RESPOSTA DO SISTEMA:
${gerada}

RESPOSTA DE REFERÊNCIA:
${dourado.resposta}

ERRO QUE SE ESPERA DE UM SISTEMA INGÊNUO NESTA PERGUNTA:
${dourado.armadilha}

Julgue DUAS coisas independentes.

1) VEREDITO — a resposta do sistema bate com a referência no que decide a ação?
   correta    — leva à MESMA ação que a referência. Pode chegar lá por outro caminho, pode omitir detalhes que a pergunta não pediu, e pode trazer fatos a mais.
   incompleta — nada contradiz, mas falta algo da referência que MUDA o que a pessoa vai fazer. Se a ação prescrita já é a mesma, é \`correta\`, não \`incompleta\`.
   contradiz  — afirma o oposto da referência em algum ponto material.

   Julgue SÓ contra a referência. Afirmação sobre algo que a referência não menciona não é contradição, mesmo que lhe pareça errada: você não tem como saber, e essa não é a régua aqui.

   Abertura invertida ("Sim" onde a referência diz "Não") é \`contradiz\` quando a correção só chega em outra frase — quem lê a primeira e age faz a coisa errada. NÃO é \`contradiz\` quando a ressalva que corrige está na MESMA frase da abertura, nem quando o "Sim" responde a outra coisa que não a decisão.

2) ARMADILHA — a resposta comete o erro descrito acima?
   evitou | caiu
   Independente do veredito: uma resposta pode contradizer a referência e ainda assim não cometer esse erro específico, e o contrário também acontece.

Responda em exatamente três linhas, sem preâmbulo e sem nada depois:
VEREDITO: correta|incompleta|contradiz
ARMADILHA: evitou|caiu
MOTIVO: uma frase curta dizendo o ponto que decidiu.`;
}

// Cego ao dourado E à lista de fontes esperada, de propósito: ver a lista esperada faria o juiz
// avaliar RECUPERAÇÃO de novo, que já tem régua determinística e de graça em `avaliar.mjs`.
// Só os trechos CITADOS entram, com a numeração original — mostrar o top-10 inteiro deixaria
// "sustentado por algum doc da pilha" passar por "sustentado pelo doc que ela citou".
export function montarPromptFidelidade(pergunta, gerada, citados) {
  const lista = citados.map((c) => `[${c.n}] (${c.tipo}) ${c.titulo}\n${c.trecho}`).join("\n\n");
  return `Você audita se uma resposta é SUSTENTADA pelos trechos que ela mesma cita. Você não sabe qual é a resposta certa para a pergunta e não deve tentar adivinhar: julgue só a derivação.

PERGUNTA: ${pergunta}

RESPOSTA (as marcas [n] apontam para os trechos abaixo):
${gerada}

TRECHOS CITADOS:
${lista}

Cada afirmação material da resposta sai do trecho que ela cita?
   fiel   — tudo o que ela afirma está nos trechos citados.
   infiel — pelo menos uma afirmação material não está: número que não aparece no trecho, sujeito ou projeto trocado, conclusão que o trecho não sustenta, ou generalização que ele não autoriza.

Não julgue se a resposta é a certa para a pergunta, e não use conhecimento seu sobre o assunto: uma resposta pode ser fiel aos trechos e ainda assim estar errada, e isso aqui conta como FIEL.

Responda em exatamente duas linhas, sem preâmbulo e sem nada depois:
FIEL: sim|nao
MOTIVO: uma frase curta dizendo a afirmação que decidiu.`;
}

// `baixa` existe porque `lib/defasagem.mjs` reusa este parse para extrair o TRECHO literal do
// documento — comparar veredito é caso-insensível, citar não: trecho em minúscula deixa de ser
// procurável no arquivo de origem. O default mantém o juiz byte a byte como estava.
export const campo = (texto, nome, baixa = true) => {
  const bruto = (String(texto ?? "").match(new RegExp(`^[^\\S\\n]*${nome}[^\\S\\n]*:[^\\S\\n]*(.+)$`, "im"))?.[1] ?? "").trim();
  return baixa ? bruto.toLowerCase() : bruto;
};

// Falha FECHADA, como a citação em `resposta.mjs`: veredito que não casa com o vocabulário vira
// vazio e o chamador conta como erro. Um parse tolerante que devolvesse "correta" no default
// transformaria juiz quebrado em nota alta — o pior resultado possível de uma régua.
export function parseVeredito(texto) {
  const bruto = campo(texto, "VEREDITO");
  const veredito = VEREDITOS_LLM.find((v) => bruto.startsWith(v)) ?? "";
  const arm = campo(texto, "ARMADILHA");
  const armadilha = ["evitou", "caiu"].find((a) => arm.startsWith(a)) ?? "";
  return { veredito, armadilha, motivo: campo(texto, "MOTIVO") };
}

export function parseFidelidade(texto) {
  const bruto = campo(texto, "FIEL");
  const fiel = bruto.startsWith("sim") ? true : bruto.startsWith("nao") || bruto.startsWith("não") ? false : null;
  return { fiel, motivo: campo(texto, "MOTIVO") };
}

// `rodarClaude` é compartilhado com o reranker e seus códigos começam com `rerank-`: deixar
// "rerank-timeout" no relatório do juiz mandaria a próxima sessão debugar o componente errado.
// Mesma renomeação de `resposta.mjs:77`.
async function rodar(prompt, run, cache) {
  try {
    const texto = await rodarCacheado(prompt, run, cache, { effort: "medium", modelo: MODELO_JUIZ });
    return { texto, erro: "" };
  } catch (err) {
    return { texto: "", erro: err.message.replace(/^rerank-/, "juiz-") };
  }
}

// Passada B. `recusou` é curto-circuito: recusa não é erro (em D-66 o corpus guardava quatro
// contagens defasadas do mesmo número e recusar era o comportamento certo), e julgá-la com LLM
// gastaria uma chamada para redescobrir o que o contrato de `responder()` já diz.
// ⚠️ Só passe aqui resposta com `erro: ""`. `responder()` tem TRÊS causas para texto vazio — recusa,
// síntese sem citação e falha de CLI — e as duas últimas não são recusa: contá-las como `recusou`
// creditaria ao sistema, como acerto, uma resposta que ele suprimiu por estar quebrada.
export async function julgarConcordancia(pergunta, gerada, dourado, { run = rodarClaude, cache = false } = {}) {
  if (!gerada) return { veredito: "recusou", armadilha: "", motivo: "", erro: "" };
  const { texto, erro } = await rodar(montarPromptJuiz(pergunta, gerada, dourado), run, cache);
  if (erro) return { veredito: "", armadilha: "", motivo: "", erro };
  const v = parseVeredito(texto);
  return { ...v, erro: v.veredito && v.armadilha ? "" : "juiz-output" };
}

// Passada A. Sem citação não há o que auditar: a resposta sem `[n]` já é suprimida por
// `responder()` e nunca chega aqui, mas a guarda evita gastar chamada num prompt sem trechos.
export async function julgarFidelidade(pergunta, gerada, citados, { run = rodarClaude, cache = false } = {}) {
  if (!gerada || !citados.length) return { fiel: null, motivo: "", erro: "" };
  const { texto, erro } = await rodar(montarPromptFidelidade(pergunta, gerada, citados), run, cache);
  if (erro) return { fiel: null, motivo: "", erro };
  const f = parseFidelidade(texto);
  return { ...f, erro: f.fiel === null ? "juiz-output" : "" };
}
