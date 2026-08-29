import { dbOn, listColunas, listCards, listAnexos, resumoAnexos, type PautaAnexo, type PautaCard, type PautaColuna } from "@/lib/db";
import { listProjects } from "@/lib/projects";
import { Quadro } from "../quadro";
import { liberarVencidos } from "../quadro-actions";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const on = dbOn();
  const projetos = await listProjects();

  let colunas: PautaColuna[] = [];
  let cards: PautaCard[] = [];
  let anexos: PautaAnexo[] = [];
  let espaco = { ativos: 0, bytes: 0, liberados: 0 };

  if (on) {
    await liberarVencidos();
    [colunas, cards] = await Promise.all([listColunas("marketing"), listCards("marketing")]);
    [anexos, espaco] = await Promise.all([listAnexos(cards.map((c) => c.id)), resumoAnexos()]);
  }

  // A vista (fluxo, calendário, documentação) sai da querystring dentro do Quadro: as três são
  // a MESMA informação, então trocar de vista não pode trocar de rota nem perder o filtro.
  return (
    <Quadro
      quadro="marketing"
      on={on}
      colunas={colunas}
      cards={cards}
      anexos={anexos}
      slugs={projetos.map((p) => p.slug)}
      espaco={espaco}
      sp={sp}
    />
  );
}
