import test from "node:test";
import assert from "node:assert/strict";

import { REGUA, ROTULOS, leituraDoDegrau, distanciaDoMercado, formatarRazao, faixaDoSpan } from "../lib/benchmark.mjs";
import { PERFIS, montarFicha } from "../lib/okr.mjs";
import { apurado, naoApurado, razao } from "../lib/funil.mjs";

// A ficha do `atma`: lead → respondeu → orçamento → tratamento (018). `REGUA.D` esvaziou na 018 —
// `visitante→lead` e `lead→contatado` saíram junto com os próprios marcos — e a 020 a repovoou com
// TRÊS RECUSAS, não com linhas: a pesquisa de 06/09/2026 confirmou que nenhum dos três degraus tem
// benchmark publicado. Por isso os testes de MECANISMO (trava 1, "acima da média", "sem par
// apurado"...) usam o perfil B abaixo, que continua com cobertura real — o que eles verificam é o
// ALGORITMO, não um número específico da atma.
const fichaAtma = () =>
  montarFicha({
    slug: "atma",
    perfil: "D",
    coletado: { leads: apurado(51), respondeu: apurado(21), orcamentos: apurado(4), vendas: apurado(0) },
  });

// ---------------------------------------------------------------------------
// TRAVA Nº 1 — a R6 como asserção. É a razão de este arquivo existir.
//
// Nenhuma outra trava precisa de teste: `sem régua` e `sem par apurado` o próprio código impede.
// Compor duas faixas, não — quem escrever `a.razao * b.razao` produz código que compila e que
// reproduz exatamente a projeção de €1,8M com barra de erro de 56×. A suíte é o único lugar onde
// isso quebra antes do deploy.
// ---------------------------------------------------------------------------

test("trava 1: uma leitura carrega UMA faixa só, nunca um produto de faixas", () => {
  const taxa = { de: "produto", para: "carrinho", celula: apurado(0.077), numerador: apurado(77), denominador: apurado(1000) };
  const l = leituraDoDegrau("B", taxa, "produto→carrinho");
  assert.deepEqual(Object.keys(l.faixa).sort(), ["elite", "media"], "faixa deveria ter exatamente media+elite de UM degrau");
  assert.equal(l.faixa.media.length, 2, "faixa é [min,max], não uma cadeia acumulada");
});

test("trava 1: a saída de uma leitura NÃO é aceita como entrada de outra", () => {
  const taxa = { de: "produto", para: "carrinho", celula: apurado(0.077), numerador: apurado(77), denominador: apurado(1000) };
  const primeira = leituraDoDegrau("B", taxa, "produto→carrinho");
  assert.equal(primeira.rotulo, "acima da média");

  // Tentar realimentar a régua com o resultado dela mesma — o gesto exato que gerou a projeção
  // que a R6 recusa. Uma leitura não tem `celula`, então `ehApurado` recusa e a régua cala.
  const realimentada = leituraDoDegrau("B", { de: "x", para: "y", celula: primeira, numerador: primeira, denominador: primeira }, "produto→carrinho");
  assert.equal(realimentada.rotulo, "sem par apurado", "compor leitura com leitura DEVE calar");
  assert.equal(realimentada.razao, undefined);
});

test("trava 1: o buraco vem de UMA multiplicação, contra denominador apurado", () => {
  // 1000 visitantes de produto apurados × 6% (piso do mercado) = 60 esperados. Se o cálculo
  // passasse por outra faixa, o resultado mudaria — e seria a pesquisa de volta.
  const taxa = { de: "produto", para: "carrinho", celula: apurado(0), numerador: apurado(0), denominador: apurado(1000) };
  const l = leituraDoDegrau("B", taxa, "produto→carrinho");
  assert.equal(l.buraco.esperado, 60);
  assert.equal(l.buraco.base, 0.06, "a base do buraco é o piso da média DESTE degrau, e só");
  assert.equal(l.buraco.faltam, 60);
});

// ---------------------------------------------------------------------------
// A tabela casa com os marcos, nos dois sentidos
// ---------------------------------------------------------------------------

test("toda linha da REGUA aponta para um par de marcos que existe em PERFIS", () => {
  for (const [perfil, linhas] of Object.entries(REGUA)) {
    const marcos = PERFIS[perfil]?.marcos;
    assert.ok(marcos, `perfil ${perfil} não existe em PERFIS`);
    const pares = new Set(marcos.slice(1).map((m, i) => `${marcos[i].chave}→${m.chave}`));
    for (const chave of Object.keys(linhas)) {
      assert.ok(pares.has(chave), `${perfil}: régua aponta para degrau inexistente \`${chave}\``);
    }
  }
});

test("toda linha tem fonte citável e faixa, nunca ponto solto (R8 + trava 3)", () => {
  for (const [perfil, linhas] of Object.entries(REGUA)) {
    for (const [chave, linha] of Object.entries(linhas)) {
      const onde = `${perfil}/${chave}`;
      // 020: uma `Recusa` não tem faixa nem fonte — ela É a declaração de que não há fonte. A trava
      // que a governa é a nº 8 (mutuamente exclusivas), não esta.
      if (linha.recusa) continue;
      assert.ok(linha.fonte?.length > 10, `${onde}: sem fonte citável`);
      for (const f of ["media", "elite"]) {
        assert.equal(linha[f].length, 2, `${onde}: ${f} deve ser [min,max]`);
        assert.ok(linha[f][0] <= linha[f][1], `${onde}: ${f} invertida`);
        assert.ok(linha[f][0] > 0 && linha[f][1] <= 1, `${onde}: ${f} fora de 0..1`);
      }
      assert.ok(linha.elite[0] >= linha.media[0], `${onde}: elite abaixo da média`);
    }
  }
});

test("cobertura declarada: 7 linhas + 3 recusas em 15 degraus (SC-002, atualizado na 020)", () => {
  // Era 9/16 antes da 018: `visitante→lead` e `lead→contatado` saíram de REGUA.D junto com os
  // próprios marcos (`visitante` é Descoberta agora, `contatado` virou nota) — -1 degrau (D fica
  // com 4 marcos/3 degraus), -2 linhas.
  //
  // 020: as três chaves da cadeia D voltaram, como RECUSA. A contagem separa os dois tipos de
  // propósito — somar recusa como linha faria a cobertura parecer 10/15 quando o que pode ser
  // COMPARADO continua sendo 7.
  const degraus = Object.values(PERFIS).reduce((n, p) => n + p.marcos.length - 1, 0);
  const entradas = Object.values(REGUA).flatMap((l) => Object.values(l));
  assert.equal(degraus, 15);
  assert.equal(entradas.filter((e) => !e.recusa).length, 7, "linhas comparáveis");
  assert.equal(entradas.filter((e) => e.recusa).length, 3, "recusas pesquisadas");
});

test("020: os 3 degraus de D são RECUSA pesquisada, não ausência — e nenhum vira linha", () => {
  // A 018 tinha esvaziado REGUA.D e este teste afirmava `deepEqual(REGUA.D, {})`. A afirmação de
  // fundo não mudou — nenhum degrau da cadeia D tem benchmark publicado — mas agora isso é um
  // resultado registrado com o que foi descartado, não um objeto vazio que não conta história.
  assert.deepEqual(Object.keys(REGUA.D), ["lead→respondeu", "respondeu→orcamento", "orcamento→tratamento"]);
  for (const [chave, e] of Object.entries(REGUA.D)) {
    assert.ok(e.recusa?.motivo, `${chave}: recusa sem motivo`);
    assert.equal(e.media, undefined, `${chave}: nenhum degrau de D pode ter faixa`);
  }
});

// ---------------------------------------------------------------------------
// O caso `atma` (SC-001, SC-003) e os estados que calam
// ---------------------------------------------------------------------------

test("atma: nenhuma leitura de mercado é comparável — 3 recusas, destaque é null", () => {
  const { leituras, destaque } = distanciaDoMercado(fichaAtma());
  for (const l of leituras) assert.equal(l.rotulo, "sem régua", `${l.degrau} não deveria ter linha`);
  assert.equal(destaque, null, "sem nenhum degrau comparável, não há destaque a escolher");
  // 020: e cada uma cala por um motivo PRÓPRIO. Três recusas com a mesma frase seria o estado que
  // esta spec veio apagar (medido em 06/09: 1 frase para 3 degraus).
  assert.equal(new Set(leituras.map((l) => l.motivo)).size, 3, "cada degrau cala pelo motivo dele");
});

test("mecanismo 'acima da média': produto→carrinho a 7,7% lê acima da média, 1,3× o piso", () => {
  const taxa = { de: "produto", para: "carrinho", celula: apurado(0.077), numerador: apurado(77), denominador: apurado(1000) };
  const l = leituraDoDegrau("B", taxa, "produto→carrinho");
  assert.equal(l.rotulo, "acima da média");
  assert.equal(formatarRazao(l.razao), "1,3×"); // 7,7% / 6% (piso da média)
  assert.ok(l.apurado > 0.0769 && l.apurado < 0.0771);
  assert.match(l.fonte, /Mida|Triple Whale|ChatBoq/);
  assert.equal(l.buraco, null, "acima do piso não tem buraco");
});

test("mecanismo do destaque: entre duas leituras comparáveis, escolhe a mais distante do piso (pior primeiro)", () => {
  // `distanciaDoMercado()` monta a chave de cada taxa a partir de PERFIS[perfil].marcos POR
  // POSIÇÃO — o marco real do perfil, não um marcos[] avulso — então o fixture usa os marcos
  // REAIS de B (visitante/produto/carrinho/checkout/pago) para as posições continuarem batendo.
  const marcos = PERFIS.B.marcos.map((m) => ({ ...m, celula: naoApurado(`sem coletor — ${m.chave}`) }));
  marcos[1].celula = apurado(1000); // produto
  marcos[2].celula = apurado(65); // carrinho — 6,5% de produto, na média (6-7,5%)
  marcos[3].celula = apurado(19); // checkout — 19/65 = 29,2%, abaixo do piso (30-35%)
  const taxas = marcos.slice(1).map((m, i) => ({ de: marcos[i].nome, para: m.nome, numerador: m.celula, denominador: marcos[i].celula, celula: razao(m.celula, marcos[i].celula) }));
  const ficha = { ...montarFicha({ slug: "loja", perfil: "B", coletado: {} }), marcos, taxas };
  const { destaque } = distanciaDoMercado(ficha);
  assert.equal(destaque.degrau, "carrinho→checkout", "abaixo do piso pesa mais que na média (PESO)");
  assert.ok(ROTULOS.includes(destaque.rotulo));
});

test("ponta não apurada devolve `sem par apurado` e aponta para a §7.2", () => {
  const taxa = { de: "carrinho", para: "checkout", celula: naoApurado("coletor `checkout` não rodou"), numerador: naoApurado("x"), denominador: apurado(65) };
  const l = leituraDoDegrau("B", taxa, "carrinho→checkout");
  assert.equal(l.rotulo, "sem par apurado");
  assert.match(l.motivo, /§7\.2/);
  assert.equal(l.apurado, undefined, "sem número onde não há medição");
  assert.equal(l.faixa, undefined);
});

test("degrau sem linha devolve `sem régua` MESMO com os dois lados apurados", () => {
  const taxa = { de: "lead (form do site)", para: "respondeu", celula: apurado(0.5), numerador: apurado(5), denominador: apurado(10) };
  const l = leituraDoDegrau("D", taxa, "lead→respondeu");
  assert.equal(l.rotulo, "sem régua");
  assert.equal(l.razao, undefined, "sem régua não produz razão");

  // 020: este teste usava `lead→respondeu` PORQUE a chave não existia em `REGUA.D`. Agora existe —
  // como recusa — e sem as duas linhas abaixo ele continuaria verde pelo caminho novo sem afirmar
  // nada. Teste que sobrevive à mudança que deveria pegá-lo é pior que teste ausente: dá cobertura
  // de mentira. As asserções afirmam o motivo ESPECÍFICO, que é o que a 020 entrega.
  assert.match(l.motivo, /B2B SaaS|outbound/, "o motivo tem de nomear o que foi descartado, não a frase genérica");
  assert.notEqual(l.motivo, "nenhuma fonte publica este degrau isolado");
});

test("perfil A: trial→cobrança cala enquanto o modelo de trial não for declarado", () => {
  const taxa = { de: "trial pago", para: "cobrança", celula: apurado(0.2), numerador: apurado(2), denominador: apurado(10) };
  const l = leituraDoDegrau("A", taxa, "trial→cobranca");
  assert.equal(l.rotulo, "sem régua");
  assert.match(l.motivo, /modelo de trial/);
});

test("zero apurado com denominador > 0 é `abaixo do piso` COM buraco, não ausência", () => {
  const taxa = { de: "produto", para: "carrinho", celula: apurado(0), numerador: apurado(0), denominador: apurado(1000) };
  const l = leituraDoDegrau("B", taxa, "produto→carrinho");
  assert.equal(l.rotulo, "abaixo do piso");
  assert.equal(l.razao, 0);
  assert.equal(l.buraco.faltam, 60); // 1000 × 6%
});

test("denominador 0 cala: `0/0` não é 0% (razao() já recusa)", () => {
  const taxa = { de: "produto", para: "carrinho", celula: naoApurado("denominador 0 — 0/0 não é 0%"), numerador: apurado(0), denominador: apurado(0) };
  const l = leituraDoDegrau("B", taxa, "produto→carrinho");
  assert.equal(l.rotulo, "sem par apurado");
});

test("sem perfil declarado, a régua não inventa perfil", () => {
  const ficha = montarFicha({ slug: "x", perfil: null, coletado: {} });
  const r = distanciaDoMercado(ficha);
  assert.equal(r.destaque, null);
  assert.deepEqual(r.leituras, []);
  assert.match(r.motivo, /sem perfil/);
});

test("nenhuma saída é prescritiva: só razão e faixa, nunca `meta` ou `alvo` (trava 5)", () => {
  const taxa = { de: "produto", para: "carrinho", celula: apurado(0.077), numerador: apurado(77), denominador: apurado(1000) };
  const l = leituraDoDegrau("B", taxa, "produto→carrinho");
  for (const k of Object.keys(l)) {
    assert.ok(!/meta|alvo|target|objetivo/i.test(k), `campo \`${k}\` soa prescritivo`);
  }
});

test("linha marcada como não apurada por coletor ausente não vira 0", () => {
  const taxa = { de: "carrinho", para: "checkout", celula: naoApurado("coletor `checkout` não rodou"), numerador: naoApurado("x"), denominador: apurado(65) };
  const l = leituraDoDegrau("B", taxa, "carrinho→checkout");
  assert.equal(l.rotulo, "sem par apurado");
  assert.ok(!("apurado" in l) || l.apurado === undefined);
});

test("018: D perdeu `visitante` e `contatado` — 4 marcos, não 5", () => {
  // `visitante` saiu (é Descoberta, taxa entre cadeias) e `contatado` saiu (degrau de 100%
  // declarado virou nota). `respondeu` entra: é o degrau que decide.
  assert.equal(PERFIS.D.marcos.length, 4);
  assert.equal(PERFIS.D.marcos.at(-1).chave, "tratamento");
  assert.ok(!PERFIS.D.marcos.some((m) => m.chave === "aceito"));
  assert.ok(!PERFIS.D.marcos.some((m) => m.chave === "visitante"));
  assert.ok(!PERFIS.D.marcos.some((m) => m.chave === "contatado"));
});

test("celula ausente é tratada como não apurada, não como zero", () => {
  const l = leituraDoDegrau("B", { de: "a", para: "b", celula: naoApurado("coletor não rodou"), numerador: naoApurado("x"), denominador: apurado(10) }, "produto→carrinho");
  assert.equal(l.rotulo, "sem par apurado");
  assert.match(l.motivo, /coletor não rodou/);
});

// ---------------------------------------------------------------------------
// 020 — TRAVAS 6 A 9. A recusa virou DADO, e dado sem trava apodrece.
//
// A tabela agora guarda dois tipos de entrada: `Linha` (tem faixa) e `Recusa` (tem motivo). As
// quatro travas abaixo existem porque cada uma delas já falhou em algum lugar deste repo:
// fonte sem link (as 7 legadas), motivo genérico repetido (medido: 1 frase para 3 degraus),
// campo misturado, e faixa vazando para quem projeta.
// ---------------------------------------------------------------------------

// As sete linhas da 015, nomeadas. Elas NÃO têm `url`/`acessadoEm` e não foram tocadas pela 020
// (FR-002a). A lista é literal, e não derivada, de propósito: derivar ("toda linha sem url é
// legada") faria uma linha NOVA sem link se autoperdoar, que é exatamente o que a trava 6 pega.
const LEGADAS_015 = new Set([
  "A:visitante→signup", "A:trial→cobranca",
  "B:produto→carrinho", "B:carrinho→checkout", "B:checkout→pago",
  "C:conversa→proposta", "C:proposta→contrato",
]);

const entradasDaRegua = () =>
  Object.entries(REGUA).flatMap(([perfil, linhas]) =>
    Object.entries(linhas).map(([chave, entrada]) => ({ perfil, chave, entrada, id: `${perfil}:${chave}` })));

test("trava 6: linha NOVA sem `url` ou `acessadoEm` reprova (as 7 legadas da 015 estão isentas)", () => {
  for (const { id, entrada } of entradasDaRegua()) {
    if (LEGADAS_015.has(id) || entrada.recusa) continue;
    assert.ok(entrada.url, `${id}: linha nova sem \`url\` — FR-002`);
    assert.match(entrada.acessadoEm, /^\d{4}-\d{2}-\d{2}$/, `${id}: \`acessadoEm\` fora do formato AAAA-MM-DD — FR-003`);
    assert.ok(entrada.recorte, `${id}: linha nova sem \`recorte\` — FR-003`);
  }
});

test("trava 7: duas recusas não podem ter o MESMO motivo", () => {
  // O defeito medido em 06/09/2026: os três degraus da atma devolviam "nenhuma fonte publica este
  // degrau isolado" — 1 frase para 3 razões diferentes. Motivo repetido é motivo genérico
  // disfarçado, e um leitor não distingue "ninguém publica" de "publicam, mas medem outro degrau".
  const motivos = entradasDaRegua().filter((e) => e.entrada.recusa).map((e) => e.entrada.recusa.motivo);
  assert.equal(new Set(motivos).size, motivos.length, "há recusas com motivo idêntico");
});

test("trava 8: `Linha` e `Recusa` são mutuamente exclusivas na mesma chave", () => {
  for (const { id, entrada } of entradasDaRegua()) {
    if (!entrada.recusa) continue;
    assert.equal(entrada.media, undefined, `${id}: recusa não pode ter faixa de média`);
    assert.equal(entrada.elite, undefined, `${id}: recusa não pode ter faixa de elite`);
  }
});

test("trava 9: `faixaDoSpan()` sobre uma recusa devolve null — a árvore de metas não pode projetar contra ela", () => {
  // Sem isto a 016 receberia um objeto sem `media` e projetaria contra `undefined`, que é projetar
  // contra faixa inventada — a R6 inteira.
  assert.equal(faixaDoSpan("D", "lead", "respondeu"), null);
  assert.equal(faixaDoSpan("D", "orcamento", "tratamento"), null);
  assert.notEqual(faixaDoSpan("B", "produto", "carrinho"), null, "linha real continua devolvendo faixa");
});

test("020: a recusa carrega as fontes DESCARTADAS, com número e porquê", () => {
  // O valor da recusa não é dizer "não tem"; é dizer o que foi considerado e por que não serve.
  // Sem isto a próxima pessoa refaz a busca — e acha os mesmos 45% que não são a régua da atma.
  const taxa = { de: "orçamento ENVIADO", para: "tratamento", celula: apurado(0), numerador: apurado(0), denominador: apurado(4) };
  const l = leituraDoDegrau("D", taxa, "orcamento→tratamento");
  assert.equal(l.rotulo, "sem régua");
  assert.ok(l.descartadas.length >= 2, "as duas fontes de case acceptance têm de estar registradas");
  assert.ok(l.descartadas.every((d) => d.fonte && d.numero && d.porQue));
  assert.match(l.motivo, /consulta/, "o motivo tem de dizer que a fonte mede aceite pós-consulta");
});

test("020: recusa vence par apurado — 4 de 4 apurados e a régua continua calando pelo motivo certo", () => {
  // A ordem importa: se a checagem de par apurado viesse antes, `orcamento→tratamento` (4 apurados,
  // 0 tratamentos) sairia como "sem par apurado" e mandaria o leitor apurar o que já está apurado.
  const taxa = { de: "orçamento ENVIADO", para: "tratamento", celula: apurado(0), numerador: apurado(0), denominador: apurado(4) };
  const l = leituraDoDegrau("D", taxa, "orcamento→tratamento");
  assert.notEqual(l.rotulo, "sem par apurado");
  assert.equal(l.razao, undefined, "recusa não produz razão");
});

test("020: a recusa em destaque é a ARMADILHA, não a mais alta da cadeia", () => {
  // A regra da §7.1 ("o mais alto da cadeia") vale para escolher GARGALO. Aqui a pergunta é outra:
  // qual ausência, calada, faz o leitor buscar o número errado sozinho? `lead→respondeu` é o degrau
  // mais alto e suas descartadas são métricas de B2B SaaS — nenhum dono de clínica topa com elas.
  // `orcamento→tratamento` descarta "case acceptance 45%", que é o primeiro resultado do Google.
  const { destaque, recusaEmDestaque } = distanciaDoMercado(fichaAtma());
  assert.equal(destaque, null, "sem linha comparável não há destaque");
  assert.equal(recusaEmDestaque.degrau, "orcamento→tratamento");
  assert.equal(recusaEmDestaque.armadilha, true);
  assert.ok(recusaEmDestaque.descartadas[0].url, "a fonte que o leitor acharia tem de ser clicável");
});

test("020: projeto sem recusa pesquisada não ganha `recusaEmDestaque` — os outros 34 não mudam", () => {
  // O perfil C não tem recusa nenhuma em REGUA: a tela dele continua caindo no texto genérico.
  const ficha = montarFicha({ slug: "x", perfil: "C", coletado: {} });
  assert.equal(distanciaDoMercado(ficha).recusaEmDestaque, null);
});
