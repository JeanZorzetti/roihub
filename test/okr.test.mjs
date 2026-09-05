import test from "node:test";
import assert from "node:assert/strict";
import { apurado, naoApurado, ehApurado } from "../lib/funil.mjs";
import {
  PERFIS,
  FAMILIAS,
  familiaDe,
  montarFicha,
  posicaoDeAtaque,
  resumirPortfolio,
  POSICOES,
  celulaDeLeads,
  celulaDeContato,
  celulaDeResposta,
  celulasDeOrcamento,
  ticketDeOrcamentos,
  motivosDoFunil,
} from "../lib/okr.mjs";
import { conversao } from "../lib/janelas.mjs";

/** Atalho: a ficha de um projeto com o que os três coletores do hub devolveram. */
const ficha = (perfil, coletado) => montarFicha({ slug: "x", perfil, coletado });
const veredito = (perfil, coletado) => posicaoDeAtaque(ficha(perfil, coletado));

test("cada perfil tem a cadeia do template, não uma cadeia genérica", () => {
  assert.deepEqual(Object.keys(PERFIS).sort(), ["A", "B", "C", "D"]);
  // Perfil D tem 4 marcos desde a 018: `visitante` saiu (é Descoberta, taxa entre cadeias) e
  // `contatado` saiu (degrau de 100% declarado vira nota); `respondeu` entra no lugar dos dois —
  // é o degrau que decide. Ver o comentário em `PERFIS.D.marcos` (lib/okr.mjs).
  assert.equal(PERFIS.D.marcos.length, 4);
  assert.equal(PERFIS.A.marcos.length, 5);
  assert.ok(!PERFIS.D.marcos.some((m) => m.chave === "aceito"), "aceito não é degrau — saiu na 017");
  assert.ok(!PERFIS.D.marcos.some((m) => m.chave === "visitante"), "visitante é Descoberta — saiu na 018");
  assert.ok(!PERFIS.D.marcos.some((m) => m.chave === "contatado"), "contatado é degrau de 100% declarado — virou nota na 018");
  // Cadeia de SaaS não é cadeia de clínica.
  assert.notDeepEqual(
    PERFIS.A.marcos.map((m) => m.chave),
    PERFIS.D.marcos.map((m) => m.chave)
  );
});

test("degrau sem COLETOR (perfil sem fonte própria) é `não apurado`, nunca 0", () => {
  // Perfil D genérico, sem coletor `respondeu` no que foi coletado — o caso de um projeto NOVO
  // com perfil D que ainda não declarou fonte própria (a Atma tem; um projeto novo não tem de graça).
  const f = ficha("D", { leads: apurado(39), vendas: apurado(0) });
  const respondeu = f.marcos.find((m) => m.chave === "respondeu");
  assert.equal(ehApurado(respondeu.celula), false);
  assert.match(respondeu.celula.naoApurado, /coletor `respondeu` não rodou/);
});

test("projeto sem perfil NÃO cai em perfil padrão", () => {
  const f = ficha(null, { cliques: apurado(100) });
  assert.equal(f.perfil, null);
  assert.deepEqual(f.marcos, []);
  assert.equal(posicaoDeAtaque(f).posicao, 0);
  // Cadeia errada é pior que cadeia ausente: ela parece medida.
  const g = ficha("Z", { cliques: apurado(100) });
  assert.equal(g.perfil, null);
});

test("a cadeia da atma reproduz o caso apurado do portfólio (018: lead → respondeu)", () => {
  // 51 leads → 21 responderam, época 31/07→hoje. `41,18% (21/51)`.
  const f = ficha("D", { leads: apurado(51), respondeu: apurado(21), vendas: apurado(0) });
  const t = f.taxas[0];
  assert.equal(ehApurado(t.celula), true);
  assert.equal(t.celula.valor.toFixed(4), (21 / 51).toFixed(4));
  // O denominador de uma etapa é o numerador da anterior.
  assert.deepEqual(t.denominador, apurado(51));
});

test("§7.1 — fator ZERADO ganha de qualquer outra leitura", () => {
  const v = veredito("D", { cliques: apurado(535), leads: apurado(39), vendas: apurado(0) });
  assert.equal(v.posicao, 1);
  assert.match(v.celula, /tratamento/);
  // Curto-circuito: existem buracos de D4 no meio da cadeia da atma, e mesmo assim a posição é 1.
  assert.match(v.motivo, /multiplicação/);
});

test("§7.1 — com entrada zerada, o TOPO ganha: consertar o degrau de baixo não move nada", () => {
  // 018: o topo da cadeia D é `lead` (Conversão), não mais `visitante` (Descoberta).
  const v = veredito("D", { leads: apurado(0), vendas: apurado(0) });
  assert.equal(v.posicao, 1);
  assert.match(v.celula, /^lead \(form do site\)$/);
});

test("§7 — zero na ENTRADA e zero no FIM são doenças opostas e mandam trabalho oposto", () => {
  const entrada = veredito("A", { cliques: apurado(0), leads: apurado(5), vendas: apurado(2) });
  const fim = veredito("D", { cliques: apurado(535), leads: apurado(39), vendas: apurado(0) });

  assert.equal(entrada.posicao, 1);
  assert.equal(fim.posicao, 1);
  // Volume nenhum NÃO se conserta com landing melhor: o texto tem que mandar para descoberta.
  assert.match(entrada.rotulo, /ENTRADA/);
  assert.match(entrada.motivo, /DEMANDA/);
  assert.doesNotMatch(entrada.motivo, /nada em performance, indexação ou copy/);
  // Taxa nenhuma NÃO se conserta com mais tráfego: aí sim o resto é desperdício.
  assert.match(fim.motivo, /nada em performance, indexação ou copy/);
  assert.notEqual(entrada.rotulo, fim.rotulo);
});

test("T044/US4/FR-029 — posicaoDeAtaque() não escolhe célula com rotuloBuraco === 'tela-nao-le'", () => {
  const v = veredito("D", {
    leads: apurado(51),
    respondeu: { naoApurado: "motivo x", rotuloBuraco: "tela-nao-le" },
    orcamentos: apurado(4),
    vendas: apurado(0),
  });
  // tratamento apurado(0) é fator ZERADO — §7.1 ganha de qualquer buraco, tela-nao-le ou não.
  // Fixture sem zero para provar §7.2 ignorando o rótulo:
  const v2 = veredito("D", {
    leads: apurado(51),
    respondeu: { naoApurado: "motivo x", rotuloBuraco: "tela-nao-le" },
    orcamentos: apurado(4),
    vendas: apurado(1),
  });
  assert.notEqual(v2.celula, "respondeu", "respondeu é tela-nao-le — não pode ser o buraco escolhido");
  assert.equal(v.posicao, 1); // tratamento zerado ainda ganha, independente do teste acima
});

test("§7.2 — sem zero, o buraco de encanamento (D4) vem antes de qualquer outro", () => {
  // Cliques sem propriedade no GSC é D1; o lead que nunca chegou é D4. D4 ganha.
  const v = veredito("D", {
    cliques: naoApurado("sem propriedade no GSC para x.vercel.app"),
    leads: naoApurado("pipeline existe e nunca recebeu lead"),
    vendas: apurado(2),
  });
  assert.equal(v.posicao, 2);
  assert.match(v.rotulo, /D4/);
  assert.match(v.celula, /lead/);
});

test("§7.3 — cadeia fechada aponta a MENOR taxa, não a primeira", () => {
  // Perfil A com todos os degraus apurados à mão: 1000 → 500 (50%) → 400 (80%) → 40 (10%) → 20 (50%).
  const f = montarFicha({ slug: "x", perfil: "A", coletado: {} });
  f.marcos.forEach((m, i) => (m.celula = apurado([1000, 500, 400, 40, 20][i])));
  f.taxas = f.marcos.slice(1).map((m, i) => ({
    de: f.marcos[i].nome,
    para: m.nome,
    numerador: m.celula,
    denominador: f.marcos[i].celula,
    celula: apurado(m.celula.valor / f.marcos[i].celula.valor),
  }));
  const v = posicaoDeAtaque(f);
  assert.equal(v.posicao, 3);
  // 10% (ativado → trial) é a menor; 50% é a primeira. É multiplicação: dobrar 10% rende mais.
  assert.match(v.celula, /trial/);
});

test("R3 continua valendo através da árvore — nada de taxa acima de 100%", () => {
  // `respondeu` maior que `lead` não pode existir de verdade — as pontas não medem a mesma coisa.
  const f = ficha("D", { leads: apurado(30), respondeu: apurado(45), vendas: apurado(1) });
  assert.equal(ehApurado(f.taxas[0].celula), false);
  assert.match(f.taxas[0].celula.naoApurado, /pontas não casam/);
});

test("a família do BURACO sobrepõe a do degrau", () => {
  const marco = PERFIS.D.marcos[0]; // visitante, família padrão D1
  assert.equal(familiaDe(marco, apurado(10)), null);
  assert.equal(familiaDe(marco, naoApurado("sem propriedade no GSC para x")), "D1");
  // Mesmo degrau, motivo de encanamento: vira D4. Sem isso a atribuição seria decorativa.
  assert.equal(familiaDe(marco, naoApurado("DATABASE_URL ausente")), "D4");
  assert.ok(Object.keys(FAMILIAS).every((k) => typeof FAMILIAS[k] === "string"));
});

test("todos os leads de teste nossos não viram taxa", () => {
  // O `não apurado` vem do coletor (lib/funil.mjs já filtra por `ehLeadDeTeste`); a árvore só não
  // pode transformá-lo em 0. Foi assim que `polarisia 6,67% (2/30)` — dois testes do Jean —
  // virou a única taxa do portfólio.
  const v = veredito("D", {
    cliques: apurado(30),
    leads: naoApurado("2 lead(s), TODOS de teste nosso — nenhum lead real jamais recebido"),
    vendas: apurado(1),
  });
  assert.equal(v.posicao, 2);
  assert.match(v.motivo, /teste nosso/);
});

test("a soma do resumo bate com o total, faixa `sem perfil` incluída", () => {
  const vereditos = [{ posicao: 1 }, { posicao: 2 }, { posicao: 2 }, { posicao: 0 }, { posicao: 3 }];
  const r = resumirPortfolio(vereditos);
  assert.equal(r.total, 5);
  assert.equal(r.porPosicao.reduce((a, b) => a + b, 0), 5);
  assert.equal(r.porPosicao.length, POSICOES.length);
});

// ── celulaDeContato — 017: "todo cancelado foi contatado" ───────────────────

test("celulaDeContato: status <> 'novo' conta como contatado, mesmo regra dos cancelados", () => {
  const reais = [{ status: "novo" }, { status: "cancelado" }, { status: "contatado" }, { status: "pre_orcamento" }];
  const c = celulaDeContato(reais);
  assert.deepEqual(c, apurado(3));
});

test("celulaDeContato: `status` ausente vale 'novo' (o default do banco), não contatado", () => {
  const c = celulaDeContato([{}, { status: "cancelado" }]);
  assert.deepEqual(c, apurado(1));
});

test("celulaDeContato: sem lead real na janela é não apurado, não 0", () => {
  const c = celulaDeContato([]);
  assert.equal(ehApurado(c), false);
});

// ── celulasDeOrcamento — 017: pessoa, não linha ──────────────────────────────

test("celulasDeOrcamento: reemissão do MESMO paciente conta uma vez, não duas", () => {
  // O Túlio: dois orçamentos (05/08 e 17/08), mesmo `paciente_lead_id`.
  const rows = [
    { criado: "2026-08-05", paciente_lead_id: "22" },
    { criado: "2026-08-17", paciente_lead_id: "22" },
  ];
  const { enviados } = celulasDeOrcamento(rows, { inicio: "2026-08-01", fim: "2026-08-31" });
  assert.deepEqual(enviados, apurado(1));
});

test("celulasDeOrcamento: paciente_lead_id NULL conta uma vez POR LINHA, nunca colapsa com outro NULL", () => {
  const rows = [
    { criado: "2026-08-05", paciente_lead_id: null },
    { criado: "2026-08-06", paciente_lead_id: null },
  ];
  const { enviados } = celulasDeOrcamento(rows, { inicio: "2026-08-01", fim: "2026-08-31" });
  assert.deepEqual(enviados, apurado(2), "dois pacientes anônimos do WhatsApp não são o mesmo paciente");
});

test("celulasDeOrcamento: fora da janela não conta, mesmo pertencendo à mesma pessoa que uma linha dentro", () => {
  const rows = [
    { criado: "2026-07-01", paciente_lead_id: "1" }, // fora
    { criado: "2026-08-10", paciente_lead_id: "1" }, // dentro
  ];
  const { enviados } = celulasDeOrcamento(rows, { inicio: "2026-08-01", fim: "2026-08-31" });
  assert.deepEqual(enviados, apurado(1));
});

test("celulasDeOrcamento: tabela nunca recebeu orçamento é não apurado, nunca 0", () => {
  const { enviados } = celulasDeOrcamento([], { inicio: "2026-08-01", fim: "2026-08-31" });
  assert.equal(ehApurado(enviados), false);
});

test("celulasDeOrcamento: fonte ausente (null) é não apurado", () => {
  const { enviados } = celulasDeOrcamento(null, { inicio: "2026-08-01", fim: "2026-08-31" });
  assert.equal(ehApurado(enviados), false);
});

// ── motivosDoFunil — 017: o funil diz ONDE, a palitagem diz POR QUÊ ─────────

test("motivosDoFunil: conta por motivo, ordenado do maior para o menor", () => {
  const reais = [
    { motivo: "sem_resposta" }, { motivo: "sem_resposta" }, { motivo: "sem_resposta" },
    { motivo: "sem_interesse" },
    { motivo: "contato_futuro" },
  ];
  const r = motivosDoFunil(reais);
  assert.deepEqual(r.motivos, [
    { motivo: "sem_resposta", n: 3 },
    { motivo: "sem_interesse", n: 1 },
    { motivo: "contato_futuro", n: 1 },
  ]);
  assert.equal(r.semMotivo, 0);
  assert.equal(r.total, 5);
});

test("motivosDoFunil: motivo null/vazio conta como `semMotivo`, não vira uma categoria", () => {
  const r = motivosDoFunil([{ motivo: null }, { motivo: "" }, { motivo: "sem_resposta" }, {}]);
  assert.deepEqual(r.motivos, [{ motivo: "sem_resposta", n: 1 }]);
  assert.equal(r.semMotivo, 3);
  assert.equal(r.total, 4);
});

test("motivosDoFunil: nenhum lead real na janela devolve lista vazia, não erro", () => {
  const r = motivosDoFunil([]);
  assert.deepEqual(r.motivos, []);
  assert.equal(r.total, 0);
});

// ── T010/US1 — a cadeia lê 51 e 7 quando a janela é a CONVERSAO com época, nunca 20 e 5 ─────────

test("T010/US1-AC1 — celulaDeLeads() com a janela CONVERSAO(agora, epocaAtma) e `propria:true` devolve apurado(51), nunca 20", () => {
  const agora = Date.parse("2026-09-05T12:00:00Z");
  const epocaAtma = { data: "2026-07-31", porque: "sociedade desfeita; o banco com os leads anteriores foi perdido" };
  const janela = conversao(agora, epocaAtma);
  assert.equal(janela.inicio, "2026-07-31");
  const leads = Array.from({ length: 51 }, (_, i) => ({ nome: `Paciente ${i}`, email: `paciente${i}@gmail.com`, criado: "2026-08-10" }));
  const { celula } = celulaDeLeads(leads, { ...janela, onde: "tabela `patient_leads` do próprio projeto", propria: true });
  assert.deepEqual(celula, apurado(51));
});

// ── D11 (research.md) — ehLeadDeTeste() não pode rodar em fonte própria ─────────────────────────

test("D11 — fonte PRÓPRIA (`propria:true`) conta lead com e-mail `teste@teste.com.br` — patient_leads só tem paciente real", () => {
  // O achado de 05/09/2026: 8 leads reais da Atma (vindos do WhatsApp, sem formulário) usam
  // `teste@teste.com.br` como placeholder de e-mail — `teste.com.br` está em DOMINIOS_INTERNOS e
  // `ehLeadDeTeste()` os classificava como teste nosso, derrubando 51 para 43.
  const leads = [
    { nome: "Lucas Pimentel - Wpp", email: "teste@teste.com.br", criado: "2026-08-10" },
    { nome: "Adriene Almeida - Wpp", email: "teste@teste.com.br", criado: "2026-08-11" },
  ];
  const { celula } = celulaDeLeads(leads, { inicio: "2026-08-01", fim: "2026-08-31", onde: "x", propria: true });
  assert.deepEqual(celula, apurado(2));
});

test("D11 — SEM `propria:true` (fonte compartilhada do hub), o mesmo lead continua sendo filtrado — regra intacta para crm_leads", () => {
  const leads = [{ nome: "Lucas Pimentel - Wpp", email: "teste@teste.com.br", criado: "2026-08-10" }];
  const { celula } = celulaDeLeads(leads, { inicio: "2026-08-01", fim: "2026-08-31", onde: "x" });
  assert.equal(ehApurado(celula), false);
  assert.match(celula.naoApurado, /teste nosso/);
});

test("T010/US1-AC2 — celulasDeOrcamento() com a janela CONVERSAO(agora, epocaAtma) devolve apurado(4) — pacientes distintos, nunca 7 linhas cruas nem 5", () => {
  const agora = Date.parse("2026-09-05T12:00:00Z");
  const epocaAtma = { data: "2026-07-31", porque: "sociedade desfeita; o banco com os leads anteriores foi perdido" };
  const janela = conversao(agora, epocaAtma);
  // Os 7 registros reais da atma (05/09/2026): pacientes 21, 22×2, 44×2, 51×2 — dedup do Túlio
  // (017) dá 4 pacientes distintos, não 7 linhas.
  const rows = [
    { criado: "2026-08-05", paciente_lead_id: "21" },
    { criado: "2026-08-05", paciente_lead_id: "22" },
    { criado: "2026-08-17", paciente_lead_id: "22" },
    { criado: "2026-08-17", paciente_lead_id: "44" },
    { criado: "2026-08-17", paciente_lead_id: "44" },
    { criado: "2026-09-01", paciente_lead_id: "51" },
    { criado: "2026-09-01", paciente_lead_id: "51" },
  ];
  const { enviados } = celulasDeOrcamento(rows, janela);
  assert.deepEqual(enviados, apurado(4));
});

// ── T019/US2 — celulaDeResposta() e a cadeia D com `respondeu` ──────────────────────────────────

test("T019/US2-AC1 — celulaDeResposta(): 21 respondeu, 1 indeterminado, piso teto 22", () => {
  const reais = [
    ...Array.from({ length: 21 }, () => ({ motivo: "sem_interesse" })),
    ...Array.from({ length: 29 }, () => ({ motivo: "sem_resposta" })),
    { motivo: null },
  ];
  const c = celulaDeResposta(reais);
  assert.deepEqual(c, { valor: 21, piso: { indeterminados: 1, teto: 22 } });
});

test("T019 — celulaDeResposta(): sem lead sem motivo, apurado SEM piso", () => {
  const reais = [{ motivo: "sem_interesse" }, { motivo: "sem_resposta" }];
  const c = celulaDeResposta(reais);
  assert.deepEqual(c, apurado(1));
  assert.ok(!("piso" in c));
});

test("T019 — celulaDeResposta(): nenhum lead real na janela devolve não apurado, nunca 0", () => {
  const c = celulaDeResposta([]);
  assert.equal(ehApurado(c), false);
  assert.match(c.naoApurado, /sem lead real na janela/);
});

test("T019/FR-017 — celulaDeResposta(): fonte própria sem coluna `motivo` devolve não apurado nomeando a fonte a consultar", () => {
  // Perfil D sem fonte própria que devolva `motivo` (hoje `aftercare`) — os objetos nem têm a
  // chave, porque a query de origem nunca pediu a coluna. Não herda a regra da Atma de graça.
  const reais = [{ status: "novo" }, { status: "cancelado" }];
  const c = celulaDeResposta(reais);
  assert.equal(ehApurado(c), false);
  assert.match(c.naoApurado, /motivo/);
});

test("T019/SC-004 — PERFIS.D.marcos passa a ser lead → respondeu → orcamento → tratamento", () => {
  assert.deepEqual(PERFIS.D.marcos.map((m) => m.chave), ["lead", "respondeu", "orcamento", "tratamento"]);
});

// ── T020/US2/SC-004 — trava latente: perfis A/B mantêm `visitante`, mas SEM coletor ─────────────

test("T020 — trava latente: signup (A) e produto (B) continuam com coletor null — travessia de cadeia é latente, não viva", () => {
  assert.equal(PERFIS.A.marcos.find((m) => m.chave === "signup").coletor, null);
  assert.equal(PERFIS.B.marcos.find((m) => m.chave === "produto").coletor, null);
});

// ── T046/US4/FR-025/FR-026/FR-027 — montarFicha() anexa declaracoes à fonte do marco ────────────

test("T046 — montarFicha({declaracoes}) ANEXA a declaração à fonte do marco, nunca substitui", () => {
  const f = montarFicha({
    slug: "atma",
    perfil: "D",
    coletado: { leads: apurado(51), respondeu: apurado(21), orcamentos: apurado(4), vendas: apurado(0) },
    declaracoes: { tratamento: { quem: "Jean", em: "2026-09-05", texto: "zero tratamentos — checkout descontinuado" } },
  });
  const tratamento = f.marcos.find((m) => m.chave === "tratamento");
  assert.match(tratamento.fonte, /extrato do gateway \/ contrato do tratamento/, "a fonte original continua, não some");
  assert.match(tratamento.fonte, /declarado por Jean em 2026-09-05/);
  assert.match(tratamento.fonte, /zero tratamentos — checkout descontinuado/);
  // Sem declaracoes, nenhum marco muda de fonte.
  const semDecl = montarFicha({ slug: "atma", perfil: "D", coletado: {} });
  assert.doesNotMatch(semDecl.marcos.find((m) => m.chave === "tratamento").fonte, /declarado por/);
});

// ── T031/US3 — ticketDeOrcamentos(): apurado líquido, nunca zero, nunca bruto ───────────────────

test("T031/US3-AC1 — ticketDeOrcamentos(): 7 orçamentos reais da atma devolvem apurado(4932.34) líquido", () => {
  const janela = { inicio: "2026-07-31", fim: "2026-09-05" };
  const rows = [
    { criado: "2026-08-05", preco: 6355.93, desconto_vista: 0.1 },
    { criado: "2026-08-05", preco: 5084.75, desconto_vista: 0.05 },
    { criado: "2026-08-17", preco: 5084.75, desconto_vista: 0.05 },
    { criado: "2026-08-17", preco: 5980.0, desconto_vista: 0.1 },
    { criado: "2026-08-17", preco: 5980.0, desconto_vista: 0.05 },
    { criado: "2026-09-01", preco: 4490.0, desconto_vista: 0.1 },
    { criado: "2026-09-01", preco: 4490.0, desconto_vista: 0.1 },
  ];
  const c = ticketDeOrcamentos(rows, janela);
  assert.equal(ehApurado(c), true);
  assert.equal(c.valor.toFixed(2), "4932.34");
});

test("T031 — linha com `preco` ausente ou não numérico fica FORA da média, nunca vira 0", () => {
  const janela = { inicio: "2026-08-01", fim: "2026-08-31" };
  const comBuraco = ticketDeOrcamentos(
    [
      { criado: "2026-08-05", preco: 100, desconto_vista: 0 },
      { criado: "2026-08-06", preco: null, desconto_vista: 0 },
      { criado: "2026-08-07", preco: "não é número", desconto_vista: 0 },
      { criado: "2026-08-08", preco: 300, desconto_vista: 0 },
    ],
    janela,
  );
  // Média só de 100 e 300 — as duas linhas sem `preco` numérico saem da conta, não puxam para 0.
  assert.equal(comBuraco.valor, 200);
});

test("T031 — `rows` null (sem fonte de orçamento) devolve não apurado", () => {
  const c = ticketDeOrcamentos(null, { inicio: "2026-08-01", fim: "2026-08-31" });
  assert.equal(ehApurado(c), false);
  assert.match(c.naoApurado, /sem fonte de orçamento/);
});

test("T031 — tabela existe mas nenhuma linha na janela devolve não apurado, nunca 0", () => {
  const c = ticketDeOrcamentos([{ criado: "2026-01-01", preco: 500, desconto_vista: 0 }], { inicio: "2026-08-01", fim: "2026-08-31" });
  assert.equal(ehApurado(c), false);
  assert.match(c.naoApurado, /sem orçamento na janela/);
});
