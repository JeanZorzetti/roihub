// Fecha o NXDOMAIN dos 14 subdomínios aposentados do roilabs.com.br: cria os registros A e as 4
// Redirect Rules descritas em handoff/handoff-nxdomain-subdominios.md. 76,6% do crawl do Googlebot
// na propriedade vai para hosts que não resolvem, e NXDOMAIN não converge — o bot tenta para sempre.
//
// Uso:
//   node scripts/cloudflare-redirects.mjs --verify   sem token: só mede o estado (DNS + HTTP)
//   CLOUDFLARE_API_TOKEN=... node scripts/cloudflare-redirects.mjs
//
// O token precisa de Zone:DNS:Edit + Zone:Config:Edit na zona roilabs.com.br
// (My Profile → API Tokens → Create Token → Edit zone DNS, e adicionar a permissão de Rules).
//
// É idempotente: registro que já existe não é tocado, e as Redirect Rules são casadas por
// `description` — regras de terceiros no mesmo phase são preservadas.
//
// ⚠️ Proxied (nuvem laranja) é obrigatório: Redirect Rule roda na borda. Registro grey-cloud vai
// direto no origin 2.24.207.200 e a regra nunca dispara.

import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(path.join(REPO, ".env"));

const ZONE = "roilabs.com.br";
const ORIGIN = "2.24.207.200";
const API = "https://api.cloudflare.com/client/v4";
const TAG = "[roihub nxdomain]"; // prefixo da description — é assim que reconhecemos NOSSAS regras
const VERIFY_ONLY = process.argv.includes("--verify");

const h = (s) => `${s}.${ZONE}`;

// PROMOVIDO = host que voltou a ter site próprio. Mover um sub de RESSUSCITAR para cá e rodar o
// script É o passo 1+2 do checklist, na ordem certa e num ato só: o hostname sai da Regra 4 e o A
// passa a apontar para o destino real. **DNS only, sem proxy** — a nuvem laranja impede a Vercel de
// emitir o certificado do domínio.
// Antes de promover, o domínio precisa estar no projeto: `vercel domains add <host> <projeto>`.
const VERCEL = "76.76.21.21";
const PROMOVIDOS = {
  pathfinder: VERCEL, // projeto Vercel `pathfinder`
  orion: VERCEL, //      projeto Vercel `orion-nova-ui`
  vertice: VERCEL, //    projeto Vercel `vertice`
  atma: VERCEL, //       projeto Vercel `atma` — o domínio nunca saiu de lá, só o DNS sumiu
};

// Ainda em 301: têm repo e site no ar, mas o Jean não pediu de volta (29/07).
const RESSUSCITAR = ["alibi"];
// `atmaadmin` e `atmaapi` NÃO são morte — o Jean quer os dois de volta (29/07), mas o admin não tem
// projeto na Vercel e a API depende do container + MySQL no EasyPanel. Ficam em 301 até existir
// destino; no dia em que existir, viram linha em PROMOVIDOS.
const MORTOS = ["atmaadmin", "atmaapi", "clerk.atma", "jbadvocacia", "andorinha"];
const COM_SUCESSOR = ["sirius", "www.sirius", "sofiaia", "www.goiania"];

const HOSTS = [...COM_SUCESSOR, ...MORTOS, ...RESSUSCITAR];
// Vivos: NÃO tocar. Só entram na verificação, como teste de segurança — se um destes sair do 200,
// alguma regra encostou em produção.
const PRODUCAO = ["goiania", "tapepro"];

// concat() preserva o path porque nesses três a migração foi 1:1 (mesmo app, domínio novo).
// A regra dos sem-destino usa URL estática: mandar /dashboard do Atma para roilabs.com.br/dashboard
// só troca um 404 por outro.
const RULES = [
  {
    description: `${TAG} sirius → siriuscrm.com.br`,
    expression: `http.host in {"${h("sirius")}" "${h("www.sirius")}"}`,
    target: { expression: `concat("https://siriuscrm.com.br", http.request.uri.path)` },
  },
  {
    description: `${TAG} sofiaia → polarisia.com.br`,
    expression: `http.host eq "${h("sofiaia")}"`,
    target: { expression: `concat("https://polarisia.com.br", http.request.uri.path)` },
  },
  {
    description: `${TAG} www.goiania → goiania`,
    expression: `http.host eq "${h("www.goiania")}"`,
    target: { expression: `concat("https://${h("goiania")}", http.request.uri.path)` },
  },
  {
    description: `${TAG} sem destino → apex`,
    expression: `http.host in {${[...MORTOS, ...RESSUSCITAR].map((s) => `"${h(s)}"`).join(" ")}}`,
    target: { value: `https://${ZONE}/` },
  },
].map((r) => ({
  description: r.description,
  expression: r.expression,
  action: "redirect",
  action_parameters: {
    from_value: { status_code: 301, target_url: r.target, preserve_query_string: true },
  },
}));

async function cf(pathname, init = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...init,
    headers: {
      authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });
  const body = await res.json();
  if (!body.success) {
    throw new Error(`${init.method ?? "GET"} ${pathname}: ${JSON.stringify(body.errors)}`);
  }
  return body.result;
}

async function apply() {
  const [zone] = await cf(`/zones?name=${ZONE}`);
  if (!zone) throw new Error(`zona ${ZONE} não está nesta conta Cloudflare`);

  const existentes = new Map(
    (await cf(`/zones/${zone.id}/dns_records?per_page=500`)).map((r) => [r.name, r]),
  );
  const alvo = [
    // Quem vai levar 301 fica proxied: é o proxy que faz a Redirect Rule existir.
    ...HOSTS.map((sub) => ({ sub, content: ORIGIN, proxied: true })),
    ...Object.entries(PROMOVIDOS).map(([sub, content]) => ({ sub, content, proxied: false })),
  ];

  for (const { sub, content, proxied } of alvo) {
    const atual = existentes.get(h(sub));
    const body = JSON.stringify({ type: "A", name: h(sub), content, proxied, ttl: 1 });
    if (!atual) {
      await cf(`/zones/${zone.id}/dns_records`, { method: "POST", body });
      console.log(`  + ${h(sub).padEnd(30)} → ${content} ${proxied ? "(proxied)" : "(DNS only)"}`);
    } else if (atual.content !== content || atual.proxied !== proxied) {
      // PATCH e não delete+create: nunca existe uma janela em que o host volta a ser NXDOMAIN.
      await cf(`/zones/${zone.id}/dns_records/${atual.id}`, { method: "PATCH", body });
      console.log(`  ~ ${h(sub).padEnd(30)} ${atual.content} → ${content} ${proxied ? "(proxied)" : "(DNS only)"}`);
    }
  }

  // O PUT no entrypoint substitui o ruleset INTEIRO do phase. Lemos o que existe e só descartamos
  // as regras que são nossas (pela description) — o resto do Jean fica de pé.
  const phase = `/zones/${zone.id}/rulesets/phases/http_request_dynamic_redirect/entrypoint`;
  const atual = await cf(phase).catch(() => ({ rules: [] })); // 404 = phase ainda sem ruleset
  const terceiros = (atual.rules ?? []).filter((r) => !(r.description ?? "").startsWith(TAG));
  await cf(phase, { method: "PUT", body: JSON.stringify({ rules: [...terceiros, ...RULES] }) });
  console.log(`  ✓ ${RULES.length} Redirect Rules aplicadas (${terceiros.length} de terceiros preservadas)`);
}

async function resolve(fqdn) {
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${fqdn}&type=A`, {
    headers: { accept: "application/dns-json" },
  });
  const { Status, Answer = [] } = await res.json();
  return Status === 3 ? "NXDOMAIN" : Answer.map((a) => a.data).join(",") || `status=${Status}`;
}

async function verify() {
  for (const sub of [...HOSTS, ...Object.keys(PROMOVIDOS), ...PRODUCAO]) {
    const fqdn = h(sub);
    const dns = await resolve(fqdn);
    let http = "—";
    try {
      const res = await fetch(`https://${fqdn}/`, { redirect: "manual" });
      http = `${res.status} ${res.headers.get("location") ?? ""}`.trim();
    } catch (e) {
      // TLS falhando em host de 2 níveis (www.sirius, clerk.atma) é esperado: o certificado
      // Universal do Cloudflare cobre apex + *.roilabs.com.br, um label só. Só o http:// desses
      // dois redireciona; https continua quebrado sem Total TLS/ACM (pago).
      http = `ERRO ${e.cause?.code ?? e.message}`;
    }
    const alvo = PRODUCAO.includes(sub)
      ? "  ← PRODUÇÃO, tem que ser 200"
      : sub in PROMOVIDOS
        ? "  ← PROMOVIDO, tem que ser 200 (301 = ficou preso na Regra 4)"
        : "";
    console.log(`  ${fqdn.padEnd(30)} ${dns.padEnd(16)} ${http}${alvo}`);
  }
}

if (!VERIFY_ONLY) {
  if (!process.env.CLOUDFLARE_API_TOKEN) {
    console.error("falta CLOUDFLARE_API_TOKEN (ou rode com --verify para só medir)");
    process.exit(1);
  }
  await apply();
  console.log("\npropagação leva ~1 min; verificando:\n");
}
await verify();
