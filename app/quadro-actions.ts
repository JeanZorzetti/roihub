"use server";

import { revalidatePath } from "next/cache";
import {
  dbOn,
  insertPauta,
  updatePauta,
  updatePautaDescricao,
  movePauta,
  removePauta,
  arquivarPauta,
  restaurarPauta,
  listColunas,
  insertColuna,
  renameColuna,
  swapColunaOrdem,
  removeColuna,
  contarCardsDaColuna,
  contarColunas,
  liberarAnexosVencidos,
  type NovoPautaCard,
} from "@/lib/db";
import {
  QUADRO_IDS,
  CANAL_IDS,
  TIPOS_CARD,
  TITULO_MAX,
  DESCRICAO_MAX,
  COLUNA_NOME_MAX,
  ANEXO_CARENCIA_DIAS,
  validarColunaRemovivel,
} from "@/lib/pauta.mjs";
import { RESPONSAVEL_IDS } from "@/lib/agenda.mjs";
import { listProjects } from "@/lib/projects";

// Nenhuma action deste arquivo escreve em hub_tasks, seo_* ou crm_*. FR-009/FR-010 são
// verificáveis por leitura: se aparecer um insertTask aqui, a entrega está errada.
//
// Entrada inválida não lança — é descartada e vira o valor neutro, como agenda/actions.ts já
// faz com projeto desconhecido. Formulário é entrada de usuário e volta para a tela nos
// `value` dos selects.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const texto = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max);

const quadroDe = (fd: FormData): string | null => {
  const q = String(fd.get("quadro") ?? "");
  return (QUADRO_IDS as string[]).includes(q) ? q : null;
};

const rotaDe = (quadro: string) => (quadro === "marketing" ? "/marketing" : "/ideias");

/** A querystring NÃO entra no revalidatePath: é assim que filtro e vista sobrevivem às ações. */
const revalidar = (quadro: string) => revalidatePath(rotaDe(quadro));

const inteiro = (fd: FormData, k: string): number | null => {
  const n = Number(fd.get(k));
  return Number.isInteger(n) && n > 0 ? n : null;
};

async function camposDoCard(fd: FormData, quadro: string): Promise<NovoPautaCard | null> {
  const titulo = texto(fd, "titulo", TITULO_MAX);
  if (!titulo) return null;

  const tipoRaw = String(fd.get("tipo") ?? "");
  const tipo = (TIPOS_CARD as string[]).includes(tipoRaw) ? tipoRaw : "card";
  const doc = tipo === "doc";

  // Coluna de outro quadro é descartada: primeira coluna do quadro é o destino neutro.
  const colunas = await listColunas(quadro);
  const pedida = Number(fd.get("coluna_id"));
  const coluna_id = doc
    ? null
    : (colunas.find((c) => c.id === pedida)?.id ?? colunas[0]?.id ?? null);

  // lista viva: repo novo do GitHub já pode receber card sem esperar curadoria
  const slugs = new Set((await listProjects()).map((p) => p.slug));
  const projRaw = String(fd.get("projeto") ?? "");
  const projeto = slugs.has(projRaw) ? projRaw : null; // null = demanda transversal, não erro

  const respRaw = String(fd.get("responsavel") ?? "");
  const responsavel = (RESPONSAVEL_IDS as string[]).includes(respRaw) ? respRaw : null;

  // canal, data e url só existem no Marketing; em `doc` nem lá.
  const marketing = quadro === "marketing" && !doc;
  const canalRaw = String(fd.get("canal") ?? "");
  const canal = marketing && (CANAL_IDS as string[]).includes(canalRaw) ? canalRaw : null;
  const dataRaw = String(fd.get("data") ?? "");
  const data = marketing && ISO_DATE.test(dataRaw) ? dataRaw : null;
  const urlRaw = texto(fd, "url", 500);
  const url = marketing && /^https?:\/\//.test(urlRaw) ? urlRaw : null;

  return {
    quadro,
    coluna_id,
    tipo,
    titulo,
    descricao: texto(fd, "descricao", DESCRICAO_MAX) || null,
    projeto,
    responsavel,
    canal,
    data,
    url,
  };
}

// ── Cards ───────────────────────────────────────────────────────────────────

export async function addCard(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const quadro = quadroDe(fd);
  if (!quadro) return;
  const c = await camposDoCard(fd, quadro);
  if (!c) return;
  await insertPauta(c);
  revalidar(quadro);
}

export async function updateCard(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const quadro = quadroDe(fd);
  const id = inteiro(fd, "id");
  if (!quadro || !id) return;
  const c = await camposDoCard(fd, quadro);
  if (!c) return;
  await updatePauta(id, c);
  revalidar(quadro);
}

/**
 * Anotação do card, gravada sem passar pelo formulário inteiro. É o que sustenta o editor
 * inline da vista de documentação: lá a pessoa escreve direto no card, e um update completo
 * apagaria projeto/responsável/canal por eles não estarem no formulário.
 *
 * Anotação VAZIA é apagamento legítimo do texto e nada mais — o card, os anexos e o registro
 * continuam. É por isso que aqui não há `if (!descricao) return`: engolir o salvamento faria a
 * tela mentir que gravou.
 */
export async function salvarNota(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const quadro = quadroDe(fd);
  const id = inteiro(fd, "id");
  if (!quadro || !id) return;
  await updatePautaDescricao(id, quadro, texto(fd, "descricao", DESCRICAO_MAX) || null);
  revalidar(quadro);
}

/** A recusa de coluna de outro quadro é do UPDATE (EXISTS), não daqui: id trocado na URL não passa. */
export async function moverCard(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const quadro = quadroDe(fd);
  const id = inteiro(fd, "id");
  const colunaId = inteiro(fd, "coluna_id");
  if (!quadro || !id || !colunaId) return;
  await movePauta(id, colunaId);
  revalidar(quadro);
}

export async function delCard(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const quadro = quadroDe(fd);
  const id = inteiro(fd, "id");
  if (!quadro || !id) return;
  await removePauta(id); // anexos vão junto pelo ON DELETE CASCADE
  revalidar(quadro);
}

export async function arquivarCard(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const quadro = quadroDe(fd);
  const id = inteiro(fd, "id");
  if (!quadro || !id) return;
  await arquivarPauta(id);
  revalidar(quadro);
}

/** Restaurar zera a carência: arquivar de novo recomeça os 30 dias (FR-034/FR-035). */
export async function restaurarCard(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const quadro = quadroDe(fd);
  const id = inteiro(fd, "id");
  if (!quadro || !id) return;
  await restaurarPauta(id);
  revalidar(quadro);
}

// ── Colunas ─────────────────────────────────────────────────────────────────

export async function addColuna(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const quadro = quadroDe(fd);
  const nome = texto(fd, "nome", COLUNA_NOME_MAX);
  if (!quadro || !nome) return;
  await insertColuna(quadro, nome, texto(fd, "icone", 4) || null);
  revalidar(quadro);
}

/** Não toca em card nenhum: FR-015 é garantido pela estrutura, o card aponta para `id`. */
export async function renomearColuna(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const quadro = quadroDe(fd);
  const id = inteiro(fd, "id");
  const nome = texto(fd, "nome", COLUNA_NOME_MAX);
  if (!quadro || !id || !nome) return;
  await renameColuna(id, nome, texto(fd, "icone", 4) || null);
  revalidar(quadro);
}

export async function moverColuna(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const quadro = quadroDe(fd);
  const id = inteiro(fd, "id");
  const dir = String(fd.get("dir")) === "-1" ? -1 : 1;
  if (!quadro || !id) return;
  await swapColunaOrdem(id, dir);
  revalidar(quadro);
}

/**
 * A recusa volta para a tela como aviso na querystring — não é exceção, é resposta esperada de
 * uma ação que o usuário tem todo direito de tentar. `redirect()` não serve aqui: ele lança, e
 * quem chama é um `<form action>` sem `try`.
 */
export async function delColuna(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const quadro = quadroDe(fd);
  const id = inteiro(fd, "id");
  if (!quadro || !id) return;
  const [cards, totalColunas] = await Promise.all([contarCardsDaColuna(id), contarColunas(quadro)]);
  const v = validarColunaRemovivel({ cards, totalColunas });
  if (v.ok) await removeColuna(id);
  revalidar(quadro);
}

// ── Manutenção ──────────────────────────────────────────────────────────────

/**
 * Não é action de formulário: é chamada na carga das páginas de quadro, junto das leituras.
 * Segura de chamar em toda renderização — `WHERE bytes IS NOT NULL` faz a segunda passada não
 * achar linha, e o índice parcial mantém indexadas só as linhas ainda com bytes.
 */
export async function liberarVencidos(): Promise<void> {
  if (!dbOn()) return;
  await liberarAnexosVencidos(ANEXO_CARENCIA_DIAS);
}
