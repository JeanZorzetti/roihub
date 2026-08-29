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
  // listProjects() é o contrato: nunca data/projects.json direto, senão a lista perde os
  // repos que vêm da API do GitHub e o select de projeto mostra menos que o resto do hub.
  const projetos = await listProjects();

  let colunas: PautaColuna[] = [];
  let cards: PautaCard[] = [];
  let anexos: PautaAnexo[] = [];
  let espaco = { ativos: 0, bytes: 0, liberados: 0 };

  if (on) {
    // A varredura de liberação roda na carga da página, não em cron: já há dois crons na
    // janela da madrugada e o hub cai nela. Com carência de 30 dias, atraso de horas é
    // irrelevante — e o UPDATE é idempotente, então repetir não custa nada.
    await liberarVencidos();
    [colunas, cards] = await Promise.all([listColunas("ideia"), listCards("ideia")]);
    [anexos, espaco] = await Promise.all([listAnexos(cards.map((c) => c.id)), resumoAnexos()]);
  }

  return (
    <Quadro
      quadro="ideia"
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
