// `node scripts/sirius-usuario-leitura.mjs <caminho do .env do Sirius>`
//
// 053/research D8 — cria (ou troca a senha de) `roihub_leitura` no banco do Sirius e grava
// `SIRIUS_DATABASE_URL` no `.env` do hub. Autorizado pelo dono em 22/09/2026.
//
// O usuário da aplicação do Sirius é SUPERUSUÁRIO (medido em 22/09): o hub não pode usá-lo. O grant é
// por COLUNA porque `"Contact"` guarda nome, telefone e e-mail dos clientes dos clientes (LGPD), e a
// cadeia só precisa de conta e data. Nada aqui imprime a senha ou a URL (Princípio V): quem precisa
// dela copia do `.env` para o EasyPanel.
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import pg from "pg";

const envSirius = process.argv[2];
if (!envSirius) {
  console.error("uso: node scripts/sirius-usuario-leitura.mjs <caminho do .env do Sirius>");
  process.exit(2);
}
const admin = readFileSync(envSirius, "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)?.[1];
if (!admin) {
  console.error("DATABASE_URL ausente no .env informado");
  process.exit(1);
}

const USUARIO = "roihub_leitura";
// base64url: só [A-Za-z0-9_-], então cabe entre aspas simples no DDL sem escape (DDL não aceita $1).
const senha = randomBytes(32).toString("base64url");
const banco = new URL(admin).pathname.slice(1);

const c = new pg.Client({ connectionString: admin, connectionTimeoutMillis: 10000 });
await c.connect();
try {
  const existe = (await c.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [USUARIO])).rowCount > 0;
  await c.query(
    existe
      ? `ALTER ROLE ${USUARIO} LOGIN PASSWORD '${senha}' CONNECTION LIMIT 2`
      : `CREATE ROLE ${USUARIO} LOGIN PASSWORD '${senha}' CONNECTION LIMIT 2`,
  );
  await c.query(`GRANT CONNECT ON DATABASE "${banco}" TO ${USUARIO}`);
  await c.query(`GRANT USAGE ON SCHEMA public TO ${USUARIO}`);
  await c.query(
    // `name` é nome de EMPRESA, e é o que deixa o card guardar só o id das pagantes (o repo é público).
    `GRANT SELECT (id, name, "createdAt", "isTestAccount", tier, "stripeSubscriptionId", "mercadoPagoSubscriptionId") ON "Organization" TO ${USUARIO}`,
  );
  await c.query(`GRANT SELECT ("organizationId", "createdAt") ON "Contact" TO ${USUARIO}`);
  console.log(`${USUARIO}: ${existe ? "senha trocada" : "criado"}, grants por coluna aplicados`);
} finally {
  await c.end();
}

const url = new URL(admin);
url.username = USUARIO;
url.password = senha;
const caminho = new URL("../.env", import.meta.url);
const atual = readFileSync(caminho, "utf8");
const linha = `SIRIUS_DATABASE_URL=${url.toString()}`;
writeFileSync(
  caminho,
  /^SIRIUS_DATABASE_URL=.*$/m.test(atual)
    ? atual.replace(/^SIRIUS_DATABASE_URL=.*$/m, linha)
    : `${atual.replace(/\s*$/, "")}\n${linha}\n`,
);
console.log("SIRIUS_DATABASE_URL gravada no .env do hub (valor não impresso)");
