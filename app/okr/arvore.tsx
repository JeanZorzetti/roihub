import { ehApurado, pct } from "@/lib/funil.mjs";
import { num } from "./projecao";

// A árvore de metas (016) desenhada na ordem do FUNIL — impressões em cima, tratamento embaixo —
// e não na ordem em que `montarArvore()` a constrói (do fim para o começo). A conta desce; a
// leitura sobe. Inverter aqui, e não no motor, mantém o teste do gap escrito na ordem da divisão.

type Banda = { min: number; max: number };
type Divisor = { origem: string; lo: number; hi: number; fonte: string; nota?: string; atravessa: string[] };
type Celula = { valor: number } | { naoApurado: string };
type Camada = { chave: string; nome: string; necessario: Banda; hoje: Celula; gap: Banda | null; jaCobre?: boolean; divisor: Divisor | null };

/** Banda degenerada sai como número, não como `2,94–2,94` — repetir o mesmo número dos dois lados
 *  faz uma certeza parecer um intervalo. Só a faixa de mercado produz intervalo de verdade. */
const banda = (b: Banda, f: (v: number) => string = num) =>
  Math.abs(b.max - b.min) < 0.005 ? f(b.max) : `${f(b.min)} – ${f(b.max)}`;

const ROTULO_ORIGEM: Record<string, string> = {
  apurado: "apurado",
  ponte: "ponte",
  mercado: "mercado",
};

export function Arvore({
  arvore,
  entrega,
  ctrAlvo,
  impressoesHoje,
}: {
  arvore: { camadas: Camada[]; parou: { nome?: string; motivo: string } | null; bandaAberta: boolean };
  entrega: { celula: Celula; mediaPorPagina?: number; amostra?: number; paginasNecessarias?: Banda; porSemana?: Banda; fonte?: string };
  ctrAlvo: Celula;
  impressoesHoje: Celula;
}) {
  const linhas = [...arvore.camadas].reverse();

  return (
    <div className="foot">
      <p>
        A meta declarada dividida pela cadeia apurada, camada a camada. Cada linha é a de cima
        multiplicada pela taxa da coluna <strong>converte a</strong>.
        {arvore.bandaAberta
          ? " Uma faixa de mercado entrou na descida, então tudo acima dela é intervalo, nunca número único."
          : " Nenhuma faixa de mercado entrou: todos os divisores são medidas nossas."}
      </p>

      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>camada</th>
              <th>precisa na janela</th>
              <th>hoje</th>
              <th>falta</th>
              <th>converte a</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((c) => (
              <tr key={c.chave}>
                <td>
                  <strong>{c.nome}</strong>
                </td>
                <td>{banda(c.necessario, (v) => num(Math.round(v * 100) / 100))}</td>
                <td>{ehApurado(c.hoje) ? num((c.hoje as { valor: number }).valor) : "não apurado"}</td>
                <td>
                  {c.gap ? (
                    c.jaCobre ? (
                      <span>já cobre</span>
                    ) : (
                      <strong>{banda(c.gap, (v) => `${v.toFixed(2).replace(".", ",")}×`)}</strong>
                    )
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {c.divisor ? (
                    <>
                      <strong>
                        {c.divisor.lo === c.divisor.hi
                          ? pct(c.divisor.lo)
                          : `${pct(c.divisor.lo)} – ${pct(c.divisor.hi)}`}
                      </strong>{" "}
                      <em>({ROTULO_ORIGEM[c.divisor.origem] ?? c.divisor.origem})</em>
                      {/* A ponte é medida real, e ela só não diz ONDE dentro do trecho a perda
                          acontece. Sem nomear o que foi atravessado, 16,13% lê como taxa de um
                          degrau só — e manda consertar a etapa errada. */}
                      {c.divisor.atravessa.length > 0 && (
                        <div className="proj-url">atravessa {c.divisor.atravessa.join(", ")}</div>
                      )}
                      <div className="proj-url">{c.divisor.fonte}</div>
                    </>
                  ) : (
                    <em>meta declarada</em>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {arvore.parou && (
        <p>
          <strong>A árvore para em {arvore.parou.nome ?? "a primeira camada"}</strong>: {arvore.parou.motivo}. As
          camadas acima continuam válidas — o que falta é o divisor deste degrau, não a conta inteira.
        </p>
      )}

      {entrega.paginasNecessarias && entrega.porSemana ? (
        <p>
          <strong>Entrega</strong> · para cobrir as impressões que faltam:{" "}
          <strong>{banda(entrega.paginasNecessarias, (v) => num(Math.ceil(v)))} páginas</strong>, ou{" "}
          <strong>{banda(entrega.porSemana, (v) => v.toFixed(1).replace(".", ","))} por semana</strong> até o
          prazo. <em>Fonte: {entrega.fonte}.</em>
        </p>
      ) : (
        <p>
          <strong>Entrega</strong> · não apurada — {(entrega.celula as { naoApurado: string })?.naoApurado}
        </p>
      )}

      {/* Leitura PARALELA, fora da conta (D7): ela usaria uma segunda faixa (curva CTR × posição),
          e faixa composta com faixa é a trava nº 1 da R6. Aqui ela só responde "e se eu não
          publicar nada?" — sem alterar camada nenhuma acima. */}
      {ehApurado(ctrAlvo) && ehApurado(impressoesHoje) && (
        <p>
          <strong>Sem publicar nada</strong> · as mesmas {num((impressoesHoje as { valor: number }).valor)}{" "}
          impressões entregariam os cliques necessários com um CTR de{" "}
          <strong>{pct((ctrAlvo as { valor: number }).valor)}</strong>. É a alavanca de posição — subir
          posição em vez de publicar página. Leitura paralela: não entra em nenhuma camada acima.
        </p>
      )}
    </div>
  );
}
