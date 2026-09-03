import { ehApurado, pct } from "@/lib/funil.mjs";
import { projetar } from "@/lib/projecao.mjs";

// O bloco de projeção invertida (010) mora aqui, e não na página, porque as DUAS telas de OKR o
// mostram: a lista (`/okr`) e a ficha (`/okr/<slug>`). Enquanto ele era função local da lista, a
// ficha calculava `projetar()` e jogava fora — `montarNiveis()` nunca desestruturou `projecao` —,
// e a meta declarada (R$ 50000 em 4000 por unidade) simplesmente não existia na tela do projeto.
// Duas cópias divergiriam na primeira mudança de veredito; uma só não tem como.

/** Número com vírgula, 2 casas só quando não é inteiro — mesma régua de `pct()` de funil.mjs. */
export const num = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ","));

/** Reais com separador de milhar (achado 6 do design-review de 03/09: "R$ 50000 em 4000 por
 *  unidade" saía sem pontuação nenhuma, e o ticket sem o `R$` — os dois lêem como um número
 *  qualquer, não como dinheiro). `num()` continua servindo às contagens (2,94 tratamentos). */
const reais = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

type Meta = { valor?: number; ticket?: number; prazo?: string; declaradaEm?: string };
type ProjecaoResultado = ReturnType<typeof projetar>;

/**
 * Bloco de projeção invertida (010), abaixo do veredito da 009 na mesma seção do card (D6). Só a
 * `atma` tem `meta` hoje — os outros 39 caem na linha `.foot` (R-d, FR-013).
 */
export function Projecao({ meta, p }: { meta?: Meta; p: ProjecaoResultado }) {
  if (p.veredito === "nao-apurado") {
    return <p className="foot">projeção: não apurado — {p.motivo}</p>;
  }

  const ancora = p.ancora as { nome: string; valor: number };
  return (
    <div className="foot">
      <p>
        Meta <strong>declarada</strong>: {reais(meta!.valor!)} em {reais(meta!.ticket!)} por unidade
        (declarada em {meta!.declaradaEm ?? "data não registrada"}) · N1 necessário no prazo:{" "}
        <strong>{num((p.n1Total as { valor: number }).valor)}</strong>, na janela de {p.normalizacao!.janelaDias} dias:{" "}
        <strong>{num((p.n1Janela as { valor: number }).valor)}</strong>
        {p.normalizacao!.encurtada ? " — janela encurtada, prazo restante menor que uma janela cheia" : ""} —{" "}
        <code>{p.normalizacao!.conta}</code>
      </p>
      <p>
        Âncora: <strong>{ancora.nome} = {num(ancora.valor)}</strong>
        {p.ancora!.ehFinal && " (o próprio N1 — cadeia fechada)"}
      </p>
      {ehApurado(p.fatorObrigatorio) && (
        <p>
          <strong>fator obrigatório</strong>:{" "}
          {p.veredito === "impossivel" ? (
            <>meta impossível na janela — {p.motivo}</>
          ) : (
            <>
              <strong>
                {pct((p.fatorObrigatorio as { valor: number }).valor)} ({num((p.n1Janela as { valor: number }).valor)}/{num(ancora.valor)})
              </strong>
              {p.veredito === "limite" && <> — {p.motivo}</>}
            </>
          )}
        </p>
      )}
      {ehApurado(p.multiploNecessario) && (
        <p>
          <strong>múltiplo necessário</strong>: {num((p.multiploNecessario as { valor: number }).valor)}× (
          {num((p.n1Janela as { valor: number }).valor)}/{num(ancora.valor)}) — {p.motivo}
        </p>
      )}
      {ehApurado(p.folga) && (
        <p>
          <strong>folga</strong>: {num((p.folga as { valor: number }).valor)}×
        </p>
      )}
      {p.degrausAMedir.length > 0 && (
        <p>degraus a medir: {p.degrausAMedir.map((d) => `${d.de} → ${d.para}`).join(", ")}</p>
      )}
    </div>
  );
}

