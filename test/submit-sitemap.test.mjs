import { test } from "node:test";
import assert from "node:assert/strict";
import { propertyOf } from "../scripts/submit-sitemap.mjs";

test("propertyOf deriva a propriedade do host do sitemap", () => {
  // .com: domínio registrável tem 2 rótulos, o subdomínio cai fora.
  assert.equal(propertyOf("https://sem-swarm.nimblabs.com/sitemap.xml"), "sc-domain:nimblabs.com");
  assert.equal(propertyOf("https://nimblabs.com/sitemap.xml"), "sc-domain:nimblabs.com");
  // .com.br: 3 rótulos, senão a propriedade viraria o inexistente "sc-domain:com.br".
  assert.equal(propertyOf("https://links.roilabs.com.br/sitemap.xml"), "sc-domain:roilabs.com.br");
  assert.equal(propertyOf("https://roilabs.com.br/sitemap.xml"), "sc-domain:roilabs.com.br");
  // Host de fornecedor resolve para a propriedade do fornecedor — que não é sua, e é justamente
  // por isso que o SKIP dispara em vez de submeter para o lugar errado.
  assert.equal(propertyOf("https://sem-swarm.vercel.app/sitemap.xml"), "sc-domain:vercel.app");
});
