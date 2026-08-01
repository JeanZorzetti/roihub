// Reordena o top-50 da fusão com claude-cli. É a camada 6 do doc de arquitetura, recusada na
// fase 3 por "sem cross-encoder local viável" — restrição sobre MODELO LOCAL, que o claude-cli
// não tem. Reaberta em 31/07 com o número que a justifica:
//
//   recall@   @1     @3     @5    @10    @20    @50
//   BM25    32,8%  66,0%  75,4%  82,3%  87,2%  91,9%
//   híbrido 32,0%  65,4%  76,5%  82,4%  88,7%  92,9%
//
// O híbrido é PIOR que o BM25 em @1 e @3 e melhor em @20 e @50: assinatura de bom gerador de
// candidatos usado como ranqueador final. O doc certo já está entre os 50 em 92,9% das
// perguntas — falta ordenar. Teto: +10,5 pontos em @10 e +27 em @3.
//
// Custo: 1 chamada por BUSCA. A fase 4 (contextual retrieval) custaria 1331 por REINDEXAÇÃO —
// o reranker é a ordem de grandeza barata, ao contrário do que a fase 3 supôs.
import { spawn } from "node:child_process";
import { rrf } from "./busca.mjs";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const MODELO_RERANK = process.env.RERANK_MODEL || "sonnet";
const TIMEOUT_MS = Number(process.env.RERANK_TIMEOUT_MS) || 120_000;
// Orçamento de caracteres por candidato. Começou em 400 numa janela só e o reranker DESABOU
// justamente nos docs longos: `fonte@10` de handoff caiu de 80,4% para 28,3% enquanto o de
// protocolo subiu para 89,2%. A causa é aritmética — protocolo tem 780 chars e 400 mostram
// metade dele; handoff tem 9 mil e 400 mostram 4%, então doc longo chegava ao modelo parecendo
// menção de passagem. 900 é o mesmo tamanho de chunk do denso (`denso.mjs:30`), e em 50
// candidatos dá ~45 k chars: cabe numa chamada só.
const ORCAMENTO = 900;
const JANELAS = 3;

// Até três trechos em volta dos termos da pergunta, e o documento INTEIRO quando ele cabe no
// orçamento. Uma janela só privilegia o primeiro casamento, que num handoff longo costuma ser
// a menção de passagem no índice, não a seção que responde.
export function trechoRelevante(texto, termos, orcamento = ORCAMENTO) {
  const limpo = texto.replace(/\s+/g, " ").trim();
  // Doc curto entra completo: recortá-lo só esconderia contexto que já cabia.
  if (limpo.length <= orcamento) return limpo;

  const alvo = limpo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const janela = Math.floor(orcamento / JANELAS);
  const posicoes = [];
  for (const t of termos) {
    const i = alvo.indexOf(t);
    // Casamentos vizinhos cairiam na mesma janela e gastariam o orçamento repetindo texto.
    if (i !== -1 && !posicoes.some((p) => Math.abs(p - i) < janela)) posicoes.push(i);
  }
  if (!posicoes.length) return limpo.slice(0, orcamento);

  const partes = posicoes
    .sort((a, b) => a - b)
    .slice(0, JANELAS)
    .map((p) => {
      const ini = Math.max(0, Math.floor(p - janela / 3));
      return (ini ? "…" : "") + limpo.slice(ini, ini + janela).trim();
    });
  return partes.join(" … ");
}

export function montarPrompt(pergunta, candidatos, k = 10) {
  const lista = candidatos
    .map((c, i) => `[${i}] (${c.tipo}) ${c.titulo}\n${c.trecho}`)
    .join("\n\n");
  return `Você é um reranker de busca sobre a memória institucional de um portfólio de projetos de software.

PERGUNTA: ${pergunta}

CANDIDATOS:
${lista}

Escolha os ${k} candidatos que MELHOR RESPONDEM a pergunta, do melhor para o pior.
Um documento que apenas menciona o assunto vale menos que um que responde de fato.
Responda APENAS com um array JSON de índices, por exemplo: [12, 3, 47, 0]
Sem explicação, sem texto antes ou depois.`;
}

// claude-cli não tem json_schema strict: o array vem no meio de prosa que pode conter colchetes
// (listas em markdown). Por isso tenta cada "[" como início candidato, como o parseJsonBlock do
// autopublish faz com "{" — recortar do primeiro "[" ao último "]" quebra.
export function parseOrdem(texto, total) {
  if (!texto) return [];
  const candidatos = [];
  for (const m of texto.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)) candidatos.push(m[1]);
  const fim = texto.lastIndexOf("]");
  for (let ini = texto.indexOf("["); ini >= 0 && ini < fim; ini = texto.indexOf("[", ini + 1)) {
    candidatos.push(texto.slice(ini, fim + 1));
  }
  for (const c of candidatos) {
    let parsed;
    try {
      parsed = JSON.parse(c.trim());
    } catch {
      continue;
    }
    if (!Array.isArray(parsed)) continue;
    // Índice fora da faixa e repetido são descartados: o modelo às vezes devolve 50 quando há 50
    // candidatos (0..49), e repetir um índice duplicaria o documento na lista final.
    const ordem = [];
    for (const n of parsed) {
      if (Number.isInteger(n) && n >= 0 && n < total && !ordem.includes(n)) ordem.push(n);
    }
    if (ordem.length) return ordem;
  }
  return [];
}

// Índice que o modelo não citou vai para o fim na ordem original: sem isso o recall@50 cairia
// para o tamanho da lista que ele devolveu, e o reranker passaria a PERDER documento que a
// fusão já tinha achado. O reranker pode errar a ordem; não pode encolher o conjunto.
export function reordenar(candidatos, ordem) {
  const escolhidos = ordem.map((i) => candidatos[i]);
  const usados = new Set(ordem);
  return [...escolhidos, ...candidatos.filter((_, i) => !usados.has(i))];
}

// O ranking do reranker é para FUNDIR, não para obedecer — a mesma lição que o vetor já tinha
// dado na fase 3. Obedecer foi medido duas vezes, com dois prompts diferentes, e perdeu sempre:
//
//   politica             @1     @3     @5    @10    @20
//   fusao (hibrido)   32,0%  65,4%  76,5%  82,4%  88,7%
//   rerank puro       19,5%  62,1%  71,0%  76,7%  91,6%
//   RRF(fusao,rerank) 34,2%  70,5%  79,6%  88,0%  91,6%
//
// O modelo acerta o CONJUNTO (só ele levou o @20 de 88,7% para 91,6%) e erra a ORDEM (sozinho
// derruba o @1 de 32,0% para 19,5%): ele não vê o score do BM25, que carrega o casamento de
// termo raro. Fundir soma as duas competências. `c=10` é o mesmo da fusão BM25+vetor.
export function fundirComFusao(candidatos, reordenados) {
  const porId = new Map(candidatos.map((c) => [c.id, c]));
  return rrf([candidatos, reordenados], { k: candidatos.length }).map((r) => porId.get(r.id));
}

// Prompt por stdin e shell no Windows pelos mesmos motivos do autopublish
// (`autopublish-clients.ts:176`): argv tem limite e o binário é um shim .cmd. Duplicado de
// propósito — este arquivo é .mjs para que a medição (`scripts/avaliar.mjs`, node puro) e a aba
// rodem o MESMO caminho. Reranker medido por um runner e servido por outro não prova nada.
// Erro da CONTA, não do prompt: trocar de token resolve, repetir no mesmo não. O CLI manda
// `api_error_status`, e é ele que decide, porque a mensagem varia — "You've hit your monthly
// spend limit" (429) não tem uma palavra de rate limit, e "organization has disabled Claude
// subscription access" (403) não tem uma de auth. Mesmo critério do autopublish
// (`autopublish-clients.ts:148`), que classifica pelo status pela mesma razão.
export function trocaDeConta(payload) {
  return [401, 403, 429].includes(Number(payload?.api_error_status));
}

// Pool INTEIRO esgotado tem código próprio (`-conta`), separado de "o modelo escreveu bobagem".
// Sem ele a corrida das 78 de 31/07 imprimiu 19,2% de recusa fantasma com casa decimal: 15
// perguntas seguidas (D-48→D-65) morreram por conta, saíram como `resposta-output` e o relatório
// contou as 15 como `recusou` — o código de "o sistema acertou ao se recusar a responder".
// `responder()` e `juiz.mjs` só trocam o prefixo, então o sufixo sobrevive aos três consumidores.
export const MAX_CONTA_SEGUIDAS = 3;

// Zera em qualquer sucesso: conta que morre e volta na pergunta seguinte é rotação normal do
// pool. O que aborta é a SEQUÊNCIA — nenhuma conta respondendo é instrumento quebrado, e daí
// para a frente a corrida só queima tempo produzindo linha vazia.
export function falhasDeConta(anterior, erros) {
  return erros.some((e) => typeof e === "string" && e.endsWith("-conta")) ? anterior + 1 : 0;
}

// Prompt por stdin e shell no Windows pelos mesmos motivos do autopublish
// (`autopublish-clients.ts:176`): argv tem limite e o binário é um shim .cmd. Duplicado de
// propósito — este arquivo é .mjs para que a medição (`scripts/avaliar.mjs`, node puro) e a aba
// rodem o MESMO caminho. Reranker medido por um runner e servido por outro não prova nada.
function spawnClaude(prompt, token, timeoutMs, effort, modelo) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.CLAUDE_BIN || "claude", [
      "-p", "--output-format", "json",
      "--model", modelo,
      // Ordenar 50 trechos é julgamento em um passo, não agente: sem ferramenta e sem turno extra.
      "--effort", effort,
      "--max-turns", "1",
    ], {
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32",
      // Sem pool configurado, cai na autenticação ambiente do CLI — é o que permite medir na
      // máquina do dev sem copiar os tokens de produção para cá.
      env: token ? { ...process.env, CLAUDE_CODE_OAUTH_TOKEN: token, CLAUDE_CODE_OAUTH_TOKENS: "" } : process.env,
    });
    let stdout = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("rerank-timeout"));
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (c) => { stdout += c; });
    child.stderr.on("data", () => {});
    child.on("error", () => { clearTimeout(timer); reject(new Error("rerank-cli")); });
    child.on("close", () => {
      clearTimeout(timer);
      let payload;
      try {
        payload = JSON.parse(stdout);
      } catch {
        reject(new Error("rerank-output"));
        return;
      }
      if (payload?.is_error || typeof payload?.result !== "string") {
        const erro = new Error("rerank-output");
        erro.trocaDeConta = trocaDeConta(payload);
        reject(erro);
        return;
      }
      resolve(payload.result);
    });
    child.stdin.on("error", () => {});
    child.stdin.end(prompt);
  });
}

// Percorre o pool até uma conta responder. O autopublish faz isso desde sempre
// (`autopublish-clients.ts:253`); a busca tinha copiado só o spawn e ficava presa em tokens[0].
// Custou caro: em 31/07 o token[0] estourou o limite mensal e a busca inteira morreu em produção
// — rerank caindo para a fusão e resposta suprimida, ambos como `-output`, que é o código de
// "modelo escreveu bobagem". Dois dos três tokens do pool estavam mortos e a aba não trocava
// para o terceiro, que respondia normalmente.
// `modelo` é parâmetro, não constante, porque o juiz (`lib/juiz.mjs`) NÃO pode rodar no mesmo
// modelo que escreveu a resposta: modelo avaliando a própria saída tem viés de auto-preferência,
// e ele empurra a nota para cima justamente onde a resposta é fluente — o caso que o juiz existe
// para pegar. O default continua sendo o do reranker, então nada mais neste arquivo muda.
export async function rodarClaude(prompt, { timeoutMs = TIMEOUT_MS, effort = "low", modelo = MODELO_RERANK } = {}) {
  const tokens = String(process.env.CLAUDE_CODE_OAUTH_TOKENS ?? process.env.CLAUDE_CODE_OAUTH_TOKEN ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  let ultimo = new Error("rerank-output");
  for (const token of tokens.length ? tokens : [null]) {
    try {
      return await spawnClaude(prompt, token, timeoutMs, effort, modelo);
    } catch (erro) {
      ultimo = erro;
      if (!erro.trocaDeConta) throw erro;
    }
  }
  // Só chega aqui com TODA conta do pool devolvendo 401/403/429 — erro que não é de conta lança
  // dentro do laço. Deixar "rerank-output" aqui é o que fez a corrida contar falha de instrumento
  // como resultado do sistema.
  ultimo.message = "rerank-conta";
  throw ultimo;
}

// Cache em disco SÓ para a avaliação (`cache: true`), no molde do embeddings-*.json. As 78
// perguntas do dourado custam ~11 min de claude-cli, e em 31/07 uma corrida foi morta no meio:
// pool gasto, zero número. Com cache, corrida morta retoma de onde parou e iterar no prompt
// deixa de custar o dourado inteiro. A aba NUNCA liga isto: cada busca é uma pergunta nova, e
// gravar no disco do container a cada busca só somaria I/O.
const CACHE = join(dirname(fileURLToPath(import.meta.url)), "..", ".cache", "rerank.json");
const chave = (prompt, modelo) => createHash("sha1").update(`${modelo}\n${prompt}`).digest("hex");

function lerCache() {
  try {
    return JSON.parse(readFileSync(CACHE, "utf8"));
  } catch {
    return {}; // cache corrompido se refaz sozinho, como o do denso
  }
}

// A chave é o hash do MODELO + PROMPT, então o mesmo arquivo serve o reranker, a síntese e o juiz
// sem colidir — motivo de `lib/resposta.mjs` e `lib/juiz.mjs` importarem isto em vez de abrir um
// cache cada. O modelo entra na chave porque o juiz roda em `opus` e a síntese em `sonnet`:
// servir o veredito de um modelo para o outro esconderia justamente a troca que se quer medir.
export async function rodarCacheado(prompt, run, ligado, modelo = MODELO_RERANK) {
  if (!ligado) return run(prompt);
  const memo = lerCache();
  const id = chave(prompt, modelo);
  if (memo[id] !== undefined) return memo[id];
  const texto = await run(prompt);
  memo[id] = texto;
  mkdirSync(dirname(CACHE), { recursive: true });
  // Gravado por pergunta, não no fim: o ponto do cache é sobreviver a ser morto no meio.
  writeFileSync(CACHE, JSON.stringify(memo));
  return texto;
}

// Falha do LLM devolve a ordem da fusão, nunca lança: a aba já responde sem o reranker e
// degradar para "a lista de antes" é invisível para quem busca. Quem precisa saber é o rodapé.
export async function rerank(pergunta, candidatos, { run = rodarClaude, k = 10, cache = false } = {}) {
  if (candidatos.length <= 1) return { itens: candidatos, ok: true, erro: "" };
  const prompt = montarPrompt(pergunta, candidatos, k);
  try {
    const texto = await rodarCacheado(prompt, run, cache);
    const ordem = parseOrdem(texto, candidatos.length);
    if (!ordem.length) return { itens: candidatos, ok: false, erro: "rerank-output" };
    return { itens: fundirComFusao(candidatos, reordenar(candidatos, ordem)), ok: true, erro: "" };
  } catch (err) {
    return { itens: candidatos, ok: false, erro: err.message };
  }
}
