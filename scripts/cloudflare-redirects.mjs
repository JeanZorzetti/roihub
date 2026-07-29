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

// Os 4 hosts a RESSUSCITAR. Redirect Rule ganha do origin: no dia em que um destes ganhar site
// próprio, apague a linha AQUI e rode de novo ANTES de apontar o A para a Vercel — senão o site
// fica invisível atrás de um 301 e o sintoma parece deploy quebrado.
// Checklist completo: handoff/handoff-nxdomain-subdominios.md §"Checklist de ressurreição".
const RESSUSCITAR = ["alibi", "pathfinder", "orion", "vertice"];
const MORTOS = ["atma", "atmaadmin", "atmaapi", "clerk.atma", "jbadvocacia", "andorinha"];
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

  const existentes = new Set((await cf(`/zones/${zone.id}/dns_records?per_page=500`)).map((r) => r.name));
  for (const sub of HOSTS) {
    if (existentes.has(h(sub))) {
      console.log(`  = ${h(sub)} já existe, não toco`);
      continue;
    }
    await cf(`/zones/${zone.id}/dns_records`, {
      method: "POST",
      body: JSON.stringify({ type: "A", name: h(sub), content: ORIGIN, proxied: true, ttl: 1 }),
    });
    console.log(`  + ${h(sub)} → ${ORIGIN} (proxied)`);
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
  for (const sub of [...HOSTS, ...PRODUCAO]) {
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
    const alvo = PRODUCAO.includes(sub) ? "  ← PRODUÇÃO, tem que ser 200" : "";
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
