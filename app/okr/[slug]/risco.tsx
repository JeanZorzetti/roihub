import { ehApurado } from "@/lib/funil.mjs";
import { reais, num } from "../projecao";

// O pipeline somado (019, FR-013..FR-017). Os números vêm prontos de `valorEmRisco()`
// (lib/okr.mjs, puro) — aqui só se escolhe o que aparece e como se escreve.
//
// ⛔ PROIBIDO neste arquivo e no módulo (FR-014): qualquer razão `enviados ÷ meta`, barra de
// progresso, ou frase do tipo "75% da meta". R$ 37.465 é 75% de R$ 50.000, e escrever isso como
// avanço é a projeção pra frente que a R6 proíbe — o orçamento enviado não é receita realizada.
//
// Dinheiro sempre por `reais()` (app/okr/projecao.tsx), NUNCA `toLocaleString` cru: o default é
// até 3 casas e foi assim que a tela publicou `R$ 4.932,337` na 018.

type Celula = { valor: number } | { naoApurado: string };
type Risco = {
  enviados: { valor: number; n: number };
  fechados: Celula;
  vivos: { pessoas: number; valor: number } | null;
  perdidos: { pessoas: number; valor: number } | null;
  semLead: { n: number; valor: number } | null;
};

export function ValorEmRisco({
  risco,
  motivosDePerda,
  nomeDoDegrauFinal,
}: {
  risco: Risco | null;
  motivosDePerda?: string[];
  nomeDoDegrauFinal: string;
}) {
  // FR-017: sem orçamento na janela o bloco NÃO renderiza. `R$ 0,00 enviados` lê como fato apurado
  // sobre um projeto que simplesmente não tem a fonte.
  if (!risco) return null;

  return (
    <div className="ficha-bloco">
      <h2 className="ficha-bloco-h">Valor em risco</h2>
      <p>
        <strong>{reais(risco.enviados.valor)}</strong> enviados{" "}
        <span className="foot">
          ({risco.enviados.n} orçamento{risco.enviados.n === 1 ? "" : "s"})
        </span>
        {" · "}
        {/* FR-013a: "fechado" vem do DEGRAU `tratamento`, nunca de `orcamentos.status` — 9 de 9
            linhas em `enviado` em cinco semanas; coluna que só conheceu um valor não separa nada.
            O degrau conta TRATAMENTOS, não reais: multiplicá-lo pelo ticket inventaria uma receita
            que ninguém mediu. Sai na unidade que ele tem. */}
        {ehApurado(risco.fechados) ? (
          <>
            <strong>{num((risco.fechados as { valor: number }).valor)}</strong> {nomeDoDegrauFinal}
          </>
        ) : (
          <span className="foot">
            {nomeDoDegrauFinal}: não apurado — {(risco.fechados as { naoApurado: string }).naoApurado}
          </span>
        )}
        {risco.vivos && (
          <>
            {" · "}
            <strong>{risco.vivos.pessoas}</strong> ainda vivo{risco.vivos.pessoas === 1 ? "" : "s"} (
            <strong>{reais(risco.vivos.valor)}</strong>)
          </>
        )}
      </p>
      {risco.perdidos && risco.perdidos.pessoas > 0 && (
        <p className="foot">
          {risco.perdidos.pessoas} perdido{risco.perdidos.pessoas === 1 ? "" : "s"} —{" "}
          {reais(risco.perdidos.valor)}.
        </p>
      )}
      {/* FR-015a: o órfão do WhatsApp entra em `enviados` e fica FORA de vivos e perdidos — sem
          lead vinculado não há `motivo` que o classifique. Nomeado à parte, nunca somado calado. */}
      {risco.semLead && (
        <p className="foot">
          {risco.semLead.n} orçamento{risco.semLead.n === 1 ? "" : "s"} sem lead vinculado —{" "}
          {reais(risco.semLead.valor)}. Entra no total enviado, fica fora de vivos e perdidos.
        </p>
      )}
      {/* FR-015: o leitor tem que ver DE QUE TAXONOMIA se está falando. A lista é do cliente, não
          do template, e sem ela na tela "vivo" é uma palavra sem definição. */}
      {risco.vivos ? (
        <p className="foot">
          Perdido = <code>{(motivosDePerda ?? []).join(", ")}</code> (declarado no card). Vivo é o
          complemento, lead sem motivo registrado incluído. {risco.enviados.n} documento
          {risco.enviados.n === 1 ? "" : "s"} contra pessoas: o mesmo paciente com dois orçamentos é
          um degrau vencido duas vezes, não duas pessoas.
        </p>
      ) : (
        // FR-015b: taxonomia não declarada NÃO vira default. Assumir a lista da Atma para outro
        // projeto herdaria de graça a palitagem do cliente — o defeito que a 017 matou.
        <p className="foot">
          Vivos e perdidos não apurados: este projeto não declara <code>motivosDePerda</code> no
          card, e a taxonomia de perda é do cliente, não do template.
        </p>
      )}
    </div>
  );
}
