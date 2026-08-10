// O INVENTÁRIO DE COBRANÇA PELO REPO — a outra metade de `lib/gateways-servido.mjs`, e ela existe
// porque aquele mede uma coisa que não é a que se quer saber.
//
// `gateways-servido` olha o HTML SERVIDO. Ele não vê gateway montado por JS depois de um clique,
// não vê chave num `.env` e não vê SDK num `package.json` — por isso o balde `sem-gateway` dele é
// "não achei caminho de cobrança servido", NUNCA "não cobra". Trinta projetos caíram nesse balde e
// a diferença entre as duas leituras é a diferença entre um portfólio que não cobra e um que cobra
// sem ninguém medir.
//
// Este lê o CÓDIGO, pela API do GitHub: dependência de SDK de pagamento em qualquer
// `package.json` da árvore, e nome de variável de ambiente de gateway em `.env.example` e afins.
// Zero LLM e zero pool, como o irmão.
//
// Mora em `lib/` e não no script desde 01/08 porque tem DOIS consumidores: o
// `scripts/gateways-repo.mjs` (lista nominal para ler) e o apurador de `D-80`/`D-81` em
// `lib/dourado-estado.mjs` (o fato que vira gabarito). Duplicar as duas listas de regex faria as
// duas leituras divergirem em silêncio — que é o defeito que este par de checks existe para achar.

// Dependência de SDK, não menção. `stripe` como dependência é intenção de cobrar; a palavra
// "Stripe" numa página de marketing é o falso positivo que custou a segunda corrida do irmão —
// o catálogo de integrações do `estetiacrm` cita três gateways que o CRM integra PARA OS CLIENTES
// DELE. Casar contra o NOME DO PACOTE é o equivalente, aqui, de casar contra a URL lá.
export const PACOTES = [
  ["mercadopago", /^(mercadopago|@mercadopago\/)/i],
  ["stripe", /^(stripe|@stripe\/)/i],
  ["asaas", /^(asaas|@asaas\/)/i],
  ["pagseguro", /^(pagseguro|@pagseguro\/)/i],
  ["pagarme", /^(pagarme|@pagarme\/)/i],
  ["paypal", /^(@paypal\/|paypal-rest-sdk)/i],
  ["iugu", /^(iugu|@iugu\/)/i],
  ["kiwify", /^(kiwify|@kiwify\/)/i],
  ["abacatepay", /^(abacatepay|@abacatepay\/)/i],
  ["efi", /^(sdk-node-apis-efi|gerencianet)/i],
  ["paddle", /^(@paddle\/|paddle-sdk)/i],
  ["lemonsqueezy", /^(@lemonsqueezy\/|lemonsqueezy)/i],
];

// Env var é sinal mais fraco que dependência: `.env.example` viaja em fork e boilerplate. Entra
// como balde SEPARADO justamente por isso — somar os dois inventaria cobrança onde há template.
export const ENVS = [
  ["mercadopago", /MERCADOPAGO|MERCADO_PAGO|MP_ACCESS_TOKEN/],
  ["stripe", /STRIPE_(SECRET|PUBLISHABLE|WEBHOOK|PRICE)/],
  ["asaas", /ASAAS_(API|TOKEN|KEY)/],
  ["pagseguro", /PAGSEGURO_/],
  ["pagarme", /PAGARME_/],
  ["iugu", /IUGU_/],
  ["kiwify", /KIWIFY_/],
  ["abacatepay", /ABACATEPAY_/],
];

// `repo` em `data/projects.json` é o NOME do repositório, sem o dono — a primeira corrida deste
// check pediu `/repos/roilabs` e levou 404 em 35 de 35, que é o formato que "todo projeto está
// quebrado" tem quando o quebrado é o check. Sétima vez nesta base (VER-08).
export const DONO = "JeanZorzetti";
export const nomeCompleto = (repo) => (repo.includes("/") ? repo : `${DONO}/${repo}`);

// Máximo de arquivos abertos por repo. Está aqui, e não solto no meio do loop, porque é o teto da
// própria medição: SDK declarado no arquivo 41 não é visto, e isso vai para a ressalva do fato.
export const TETO_ARQUIVOS = 40;

/** Linha COMENTADA não é variável declarada — `# STRIPE_SECRET_KEY` é o oposto de chave configurada. */
export function envDeclarada(texto, re) {
  return (texto.split("\n").find((l) => {
    const s = l.trim();
    return !s.startsWith("#") && /^[A-Z0-9_]+\s*=/.test(s) && re.test(s.split("=")[0]);
  }) ?? "").split("=")[0].trim() || null;
}

/**
 * `repo` aceita `null` porque é o que `Project` tem: card do GitHub sem repo casado cai no
 * balde `sem_repo`, e o corpo já testa `!p.repo`. A anotação estava mais estreita que o código.
 * @param {{slug:string, repo?:string|null}[]} projetos
 * @returns {Promise<{slug:string, repo:string, balde:"sdk"|"env"|"nada"|"sem_repo", gateways:string[],
 *   achadosSdk:object[], achadosEnv:object[], motivo:string}[]>}
 */
export async function inventariarRepo(
  projetos,
  { fetchImpl = fetch, token = process.env.GITHUB_TOKEN, onProjeto = () => {} } = {},
) {
  if (!token) throw new Error("sem GITHUB_TOKEN");
  const cabecalho = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "roihub-gateways-repo",
  };

  async function api(url) {
    const r = await fetchImpl(url, { headers: cabecalho, signal: AbortSignal.timeout(20000) });
    if (r.status === 404) return null;
    if (r.status === 403 || r.status === 429) throw new Error(`rate limit da API do GitHub (${r.status})`);
    if (!r.ok) throw new Error(`${r.status} em ${url}`);
    return r.json();
  }

  // Um GET da árvore inteira por repo, não um por arquivo: o repo do sirius tem ~3 mil arquivos e
  // pedir um a um estouraria o rate limit antes do décimo projeto.
  async function arvore(repo) {
    const meta = await api(`https://api.github.com/repos/${repo}`);
    if (!meta) return null;
    const t = await api(`https://api.github.com/repos/${repo}/git/trees/${meta.default_branch}?recursive=1`);
    return t?.tree ?? null;
  }

  async function conteudo(repo, caminho) {
    const c = await api(`https://api.github.com/repos/${repo}/contents/${encodeURI(caminho)}`);
    return c?.content ? Buffer.from(c.content, "base64").toString("utf8") : "";
  }

  const linhas = [];
  for (const p of projetos) {
    const linha = { slug: p.slug, repo: p.repo ? nomeCompleto(p.repo) : "", balde: "sem_repo", gateways: [], achadosSdk: [], achadosEnv: [], motivo: "" };
    if (!p.repo) {
      linha.motivo = "card sem `repo` em data/projects.json";
      linhas.push(linha);
      onProjeto(linha);
      continue;
    }
    let tree;
    try {
      tree = await arvore(linha.repo);
    } catch (err) {
      linha.motivo = err.message;
      linhas.push(linha);
      onProjeto(linha);
      continue;
    }
    if (!tree) {
      linha.motivo = "404 na API do GitHub (repo privado, renomeado ou inexistente)";
      linhas.push(linha);
      onProjeto(linha);
      continue;
    }

    // `node_modules` e `dist` fora: dependência transitiva de terceiro não é intenção de cobrar, e
    // é ela que transformaria este check num detector de árvore de dependências.
    const relevantes = tree.filter(
      (f) =>
        f.type === "blob" &&
        !/(^|\/)(node_modules|dist|build|\.next|vendor)\//.test(f.path) &&
        (/(^|\/)package\.json$/.test(f.path) || /(^|\/)\.env(\.|$)/.test(f.path)),
    );

    for (const f of relevantes.slice(0, TETO_ARQUIVOS)) {
      const txt = await conteudo(linha.repo, f.path);
      if (!txt) continue;
      if (/package\.json$/.test(f.path)) {
        let pkg;
        try {
          pkg = JSON.parse(txt);
        } catch {
          continue; // package.json quebrado é problema de outro check
        }
        const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
        for (const [nome, re] of PACOTES) {
          const casou = deps.filter((d) => re.test(d));
          if (casou.length) linha.achadosSdk.push({ gateway: nome, arquivo: f.path, prova: casou.join(", ") });
        }
      } else {
        for (const [nome, re] of ENVS) {
          // A primeira corrida marcou `orion` com stripe por `# STRIPE_SECRET_KEY`, `goiania` com
          // asaas por `# Asaas (cobrança de success fee…)` e `sirius` por `# STRIPE_WEBHOOK_SECRET
          // vem do endpoint…`. Comentário que ENSINA a configurar a chave é o oposto de chave
          // configurada — mesma classe do "palavra ≠ URL" do irmão.
          const nomeVar = envDeclarada(txt, re);
          if (nomeVar) linha.achadosEnv.push({ gateway: nome, arquivo: f.path, prova: nomeVar });
        }
      }
    }

    const g = (as) => [...new Set(as.map((a) => a.gateway))];
    if (linha.achadosSdk.length) {
      linha.balde = "sdk";
      linha.gateways = g(linha.achadosSdk);
    } else if (linha.achadosEnv.length) {
      linha.balde = "env";
      linha.gateways = g(linha.achadosEnv);
    } else {
      linha.balde = "nada";
    }
    linha.motivo = linha.gateways.join("+");
    linhas.push(linha);
    onProjeto(linha);
  }
  return linhas;
}
