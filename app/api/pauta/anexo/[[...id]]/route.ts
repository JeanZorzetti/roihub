import { NextResponse } from "next/server.js";
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
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "id inválido" }, { status: 404 });
    const dono = await anexoDoCard(id);
    if (!dono) return NextResponse.json({ error: "anexo não encontrado" }, { status: 404 });
    const padrao = dono.quadro === "marketing" ? "/marketing" : "/ideias";
    if (acao === "remover") await removeAnexo(id);
    else if (acao === "mover") {
      const dir = new URL(request.url).searchParams.get("dir") === "-1" ? -1 : 1;
      await swapAnexoOrdem(id, dir);
    } else return NextResponse.json({ error: "ação desconhecida" }, { status: 404 });
    return volta(request, destino(fd, padrao));
  }

  if (seg.length) return NextResponse.json({ error: "rota desconhecida" }, { status: 404 });

  const pautaId = Number(fd.get("pauta_id"));
  if (!Number.isInteger(pautaId) || pautaId <= 0)
    return NextResponse.json({ error: "pauta_id inválido" }, { status: 404 });
  const card = await cardExiste(pautaId);
  if (!card) return NextResponse.json({ error: "card não encontrado" }, { status: 404 });

  const para = destino(fd, card.quadro === "marketing" ? "/marketing" : "/ideias");
  const arquivos = fd.getAll("imagens").filter((x): x is File => x instanceof File && x.size > 0);
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

  return volta(request, erro ? `${para}${para.includes("?") ? "&" : "?"}erro=${erro}` : para);
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
