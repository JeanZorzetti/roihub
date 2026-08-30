import { NextResponse } from "next/server.js";
import { revalidatePath } from "next/cache";
import {
  dbOn,
  cardExiste,
  contarAnexos,
  insertAnexo,
  getAnexoBytes,
  anexoDoCard,
  removeAnexo,
  swapAnexoOrdem,
} from "@/lib/db";
import { validarAnexo } from "@/lib/pauta.mjs";

// A ÚNICA superfície que toca bytes: todo o resto do sistema conhece apenas a URL
// /api/pauta/anexo/<id>. Trocar Postgres por storage externo no futuro mexe só aqui.
//
// A autenticação é HERDADA: o matcher do middleware é /((?!_next|favicon.ico).*) e as isenções
// são nominais, então esta rota cai no Basic auth do HUB_PASS sozinha. NÃO acrescentar isenção
// lá — segredo próprio existe para capacidade MAIOR, e aqui a capacidade é a mesma de quem já
// lê o hub inteiro. Isenção exporia as imagens publicamente (FR-023).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Parâmetro de redirect vindo do formulário é entrada de usuário, e redirect aberto é a falha
 * clássica dessa forma: só caminho relativo passa. `//host` é URL protocol-relative — vira
 * o padrão do quadro.
 */
function destino(fd: FormData, padrao: string): string {
  const v = String(fd.get("voltar") ?? "");
  return v.startsWith("/") && !v.startsWith("//") ? v : padrao;
}

/** 303 e não 302: força o navegador a trocar POST por GET, então recarregar não reenvia o upload. */
const volta = (req: Request, para: string) => NextResponse.redirect(new URL(para, req.url), 303);

/**
 * Recusa de POST volta para o QUADRO com o código na querystring, nunca como JSON.
 *
 * A rota é alvo de `<form>` e não de fetch: o que o navegador faz com um 404 `application/json`
 * é pintar a tela inteira de `{"error":"anexo não encontrado"}` e engolir o quadro. E o caminho
 * para chegar nisso é banal — clicar "×" duas vezes, ou usar o botão Voltar depois de remover
 * e clicar de novo: na segunda vez a linha já não existe. Isso é uma ação repetida, não um
 * erro do sistema, e a resposta certa é a tela de sempre com um aviso em cima.
 */
const recusa = (req: Request, para: string, codigo: string) =>
  volta(req, `${para}${para.includes("?") ? "&" : "?"}erro=${codigo}`);

const semBanco = () => NextResponse.json({ error: "DATABASE_URL ausente" }, { status: 503 });

export async function POST(request: Request, ctx: { params: Promise<{ id?: string[] }> }) {
  if (!dbOn()) return semBanco();

  const seg = (await ctx.params).id ?? [];
  const fd = await request.formData();

  // /api/pauta/anexo/<id>/remover e /mover — mesmo padrão de `voltar` e 303. Ficam aqui, e não
  // em server action, para o carrossel inteiro ter uma superfície só: três formas de mexer em
  // anexo espalhadas em dois mecanismos é o tipo de divergência que aparece seis meses depois.
  if (seg.length === 2) {
    const id = Number(seg[0]);
    const acao = seg[1];
    // `voltar` já veio no corpo do formulário: dá para devolver a pessoa ao quadro certo mesmo
    // quando o anexo não existe mais e não há dono de onde deduzir a rota.
    const paraSemDono = destino(fd, "/marketing");
    if (!Number.isInteger(id) || id <= 0) return recusa(request, paraSemDono, "sumiu");
    const dono = await anexoDoCard(id);
    if (!dono) return recusa(request, paraSemDono, "sumiu");
    const padrao = dono.quadro === "marketing" ? "/marketing" : "/ideias";
    const para = destino(fd, padrao);
    if (acao === "remover") await removeAnexo(id);
    else if (acao === "mover") {
      const dir = new URL(request.url).searchParams.get("dir") === "-1" ? -1 : 1;
      await swapAnexoOrdem(id, dir);
    } else return recusa(request, para, "sumiu");
    // A página é `force-dynamic`, mas o redirect cai no cache de rota do App Router e a lista
    // de anexos podia voltar com a imagem que acabou de sair — o "erro" mais parecido com bug
    // que esta tela produzia.
    revalidatePath(padrao);
    return volta(request, para);
  }

  if (seg.length) return recusa(request, destino(fd, "/marketing"), "sumiu");

  const pautaId = Number(fd.get("pauta_id"));
  const card = Number.isInteger(pautaId) && pautaId > 0 ? await cardExiste(pautaId) : null;
  if (!card) return recusa(request, destino(fd, "/marketing"), "card");

  const para = destino(fd, card.quadro === "marketing" ? "/marketing" : "/ideias");
  const arquivos = fd.getAll("imagens").filter((x): x is File => x instanceof File && x.size > 0);
  // Enviar o formulário sem escolher arquivo recarregava a página e não dizia nada — ação sem
  // efeito e sem explicação é indistinguível de falha para quem está do outro lado.
  if (!arquivos.length) return recusa(request, para, "vazio");
  let jaTem = await contarAnexos(pautaId);
  let erro = "";

  // Os aceitos são gravados mesmo quando um do lote é recusado: perder o carrossel inteiro por
  // causa de um PNG grande faria a pessoa reenviar tudo à mão.
  for (const f of arquivos) {
    const v = validarAnexo({ mime: f.type, tamanho: f.size, jaTem });
    if (!v.ok) {
      erro ||= String(v.erro ?? "");
      continue;
    }
    await insertAnexo({
      pauta_id: pautaId,
      nome: f.name.slice(0, 200),
      mime: f.type,
      tamanho: f.size,
      bytes: Buffer.from(await f.arrayBuffer()),
    });
    jaTem++;
  }

  revalidatePath(card.quadro === "marketing" ? "/marketing" : "/ideias");
  return erro ? recusa(request, para, erro) : volta(request, para);
}

export async function GET(_request: Request, ctx: { params: Promise<{ id?: string[] }> }) {
  if (!dbOn()) return semBanco();

  const seg = (await ctx.params).id ?? [];
  const id = Number(seg[0]);
  if (seg.length !== 1 || !Number.isInteger(id) || id <= 0)
    return NextResponse.json({ error: "id inválido" }, { status: 404 });

  const a = await getAnexoBytes(id);
  if (!a) return NextResponse.json({ error: "anexo não encontrado" }, { status: 404 });
  // 410 e não 404: a diferença entre "nunca existiu" e "expirou" é exatamente a informação que
  // a retenção existe para preservar — o registro do anexo continua legível na tela.
  if (!a.bytes) return NextResponse.json({ error: "anexo liberado" }, { status: 410 });

  return new NextResponse(new Uint8Array(a.bytes), {
    headers: {
      "Content-Type": a.mime,
      "Content-Length": String(a.tamanho),
      // private, nunca public: conteúdo atrás de autenticação. Permite ao navegador do usuário
      // reusar sem autorizar cache intermediário.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
