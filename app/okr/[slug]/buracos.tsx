import { FAMILIAS } from "@/lib/okr.mjs";

// A lista de buracos de medição da dobra (019, FR-004/FR-005). Vem de `buracosDeVerdade()`
// (lib/okr.mjs) — a MESMA função que `posicaoDeAtaque()` consome, nunca um segundo filtro na tela:
// duas listas de "onde falta dado" na mesma ficha é a segunda régua que a FR-002 proíbe, e regra
// testável em `.tsx` é regressão pelo Princípio III.

type Buraco = { chave: string; nome: string; fonte: string; motivo: string; familia: string; transitorio: boolean };
type Veredito = { posicao: number; celula: string | null };

function Linhas({ itens }: { itens: Buraco[] }) {
  return (
    <ul className="ficha-krs">
      {itens.map((b) => (
        <li key={b.chave}>
          <strong>{b.nome}</strong>
          {b.familia && <span className="pill pill-warn">{b.familia}</span>}
          <div className="foot">
            {b.motivo}
            {/* US2-AC2: cada linha nomeia A FONTE A CONSULTAR. Sem isso a lista diz que falta dado
                e cala onde ele está — que é o trabalho que o leitor veio buscar. */}
            <br />
            consultar: {b.fonte}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Buracos({ buracos, veredito }: { buracos: Buraco[]; veredito: Veredito }) {
  const permanentes = buracos.filter((b) => !b.transitorio);
  const transitorios = buracos.filter((b) => b.transitorio);
  // A frase que sobreviveu à reordenação e mudou de casa: sem ela, a dobra parece dois planos de
  // ataque — "tratamento: 0 apurado" no topo contra "apurar respondeu" logo abaixo (achado 1 do
  // design-review de 03/09). Só entra quando os dois nomes divergem.
  const primeiro = permanentes[0] ?? transitorios[0] ?? null;
  const cita = veredito.posicao === 1 && veredito.celula && primeiro && veredito.celula !== primeiro.nome;

  return (
    <div className="ficha-bloco">
      <h2 className="ficha-bloco-h">
        Buracos de medição {buracos.length > 0 && <span className="pill">{buracos.length}</span>}
      </h2>
      {buracos.length === 0 ? (
        // FR-005: lista vazia é um estado EXIBIDO, não uma ausência. Sumir em silêncio é
        // indistinguível de não ter sido calculada.
        <p className="foot">nenhum buraco de medição na cadeia.</p>
      ) : (
        <>
          {permanentes.length > 0 && <Linhas itens={permanentes} />}
          {/* US2-AC4: transitório sai num agrupamento PRÓPRIO, abaixo do permanente e rotulado como
              tal — foi a regressão da rodada 3 do design-review deixá-lo competindo pela atenção.
              O rótulo vem da célula (`falhou-agora`), não de heurística de texto. */}
          {transitorios.length > 0 && (
            <details className="ficha-glossario">
              <summary className="foot">
                {transitorios.length} falharam agora — falha de conexão, não buraco permanente
              </summary>
              <Linhas itens={transitorios} />
            </details>
          )}
          {cita && (
            <p className="foot">
              Isso fecha um buraco de medição, mas não destrava <strong>{veredito.celula}</strong> — o
              fator zerado só sai de 0 com trabalho na etapa em que ele está.
            </p>
          )}
          {permanentes[0] && (
            <p className="foot">
              {FAMILIAS[permanentes[0].familia as keyof typeof FAMILIAS] ?? ""} Apurar vem antes de
              melhorar: você não sabe o tamanho do problema enquanto não mede.
            </p>
          )}
        </>
      )}
    </div>
  );
}
