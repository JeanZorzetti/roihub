import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { destDirFor, validateExport } from "../lib/crawl-fetch.mjs";

const SUMMARY = "Gráfico de resumo das estatísticas de rastreamento.csv";
const HEADER = "Data,Total de solicitações de rastreamento,Tamanho total do download (bytes),Média do tempo de resposta (ms)";

function fixture(files) {
  const dir = mkdtempSync(path.join(tmpdir(), "crawl-test-"));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

test("destDirFor usa o nome do download — é ele que a aba /infra sabe ler", () => {
  const got = destDirFor("goiania.roilabs.com.br-Crawl-stats-2026-07-25.zip", "/repo");
  assert.equal(got.host, "goiania.roilabs.com.br");
  assert.equal(got.exportDate, "2026-07-25");
  assert.equal(
    got.dir,
    path.join("/repo", "docs", "Crawl-stats", "goiania.roilabs.com.br", "goiania.roilabs.com.br-Crawl-stats-2026-07-25")
  );
});

test("destDirFor recusa nome fora do padrão em vez de adivinhar", () => {
  assert.equal(destDirFor("crawl-stats (1).zip", "/repo"), null);
  assert.equal(destDirFor("goiania.roilabs.com.br-Crawl-stats-25-07-2026.zip", "/repo"), null);
});

test("validateExport aceita export com dia no gráfico de resumo", () => {
  const dir = fixture({ [SUMMARY]: `${HEADER}\n2026-07-24,261,597053,97\n2026-07-25,124,625383,105\n` });
  assert.deepEqual(validateExport(dir), { ok: true, days: 2 });
  rmSync(dir, { recursive: true, force: true });
});

test("validateExport recusa resumo só com header, ZIP em subpasta e pasta inexistente", () => {
  const semDia = fixture({ [SUMMARY]: `${HEADER}\n` });
  assert.equal(validateExport(semDia).ok, false);

  // Extração com nível extra: os arquivos existem, mas não onde o readCsv procura.
  const aninhado = fixture({ [path.join("sub", SUMMARY)]: `${HEADER}\n2026-07-25,10,100,50\n` });
  assert.equal(validateExport(aninhado).ok, false);

  assert.equal(validateExport(path.join(tmpdir(), "nao-existe-crawl-test")).ok, false);
  for (const d of [semDia, aninhado]) rmSync(d, { recursive: true, force: true });
});
