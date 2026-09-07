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
  buracosDeVerdade,
  valorEmRisco,
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

test("020/auditoria — órfão cujo NOME já entrou com id é a mesma pessoa, não uma a mais", () => {
  // O caso da Maiara: id 11 sem `paciente_lead_id` e id 12 com lead 53, mesmo nome. A soma
  // `pessoas.size + semLead` a contava nos dois lados e punha a atma em `orçamento = 6` com o
  // banco dizendo 5. A cadeia real de 07/09, com os 9 documentos:
  const rows = [
    { criado: "2026-08-05", paciente_lead_id: "21", paciente_nome: "Kailane Rayssa da Costa Santos" },
    { criado: "2026-08-05", paciente_lead_id: "22", paciente_nome: "Túlio Gonçalves da Fonseca" },
    { criado: "2026-08-17", paciente_lead_id: "22", paciente_nome: "Túlio Gonçalves da Fonseca" },
    { criado: "2026-08-17", paciente_lead_id: "44", paciente_nome: "Juliana Rocha Carnaúba da Costa" },
    { criado: "2026-08-17", paciente_lead_id: "44", paciente_nome: "Juliana Rocha Carnaúba da Costa" },
    { criado: "2026-09-01", paciente_lead_id: "51", paciente_nome: "Larissa Lima Carvalho Farias" },
    { criado: "2026-09-01", paciente_lead_id: "51", paciente_nome: "Larissa Lima Carvalho Farias" },
    { criado: "2026-09-05", paciente_lead_id: null, paciente_nome: "Maiara Fernanda Hermann" },
    { criado: "2026-09-05", paciente_lead_id: "53", paciente_nome: "Maiara Fernanda Hermann" },
  ];
  const { enviados } = celulasDeOrcamento(rows, { inicio: "2026-07-31", fim: "2026-09-07" });
  assert.deepEqual(enviados, apurado(5), "9 documentos, 5 pessoas — a Maiara entra uma vez só");
});

test("020/auditoria — órfão com nome que NÃO aparece com id continua sendo pessoa própria", () => {
  // O `semLead` existe porque orçamento sem vínculo ainda é gente a quem se mandou preço. A
  // correção do caso da Maiara não pode transformar todo órfão em duplicata.
  const rows = [
    { criado: "2026-08-05", paciente_lead_id: "21", paciente_nome: "Kailane" },
    { criado: "2026-08-06", paciente_lead_id: null, paciente_nome: "Alguém do WhatsApp" },
    { criado: "2026-08-07", paciente_lead_id: null, paciente_nome: "" },
    { criado: "2026-08-08", paciente_lead_id: null },
  ];
  const { enviados } = celulasDeOrcamento(rows, { inicio: "2026-08-01", fim: "2026-08-31" });
  assert.deepEqual(enviados, apurado(4), "1 com id + 3 órfãos irreconhecíveis; nome vazio/ausente nunca casa");
});

test("020/auditoria — o casamento por nome ignora caixa e espaço, e só vale dentro da janela", () => {
  const rows = [
    { criado: "2026-08-05", paciente_lead_id: "53", paciente_nome: "  Maiara Fernanda HERMANN " },
    { criado: "2026-08-06", paciente_lead_id: null, paciente_nome: "maiara fernanda hermann" },
    // Mesmo nome, mas o par com id está FORA da janela: aqui o órfão é a única linha da pessoa,
    // e contá-lo como 1 é o certo — não há com quem colapsar.
    { criado: "2026-07-01", paciente_lead_id: "99", paciente_nome: "Fulano de Tal" },
    { criado: "2026-08-07", paciente_lead_id: null, paciente_nome: "Fulano de Tal" },
  ];
  const { enviados } = celulasDeOrcamento(rows, { inicio: "2026-08-01", fim: "2026-08-31" });
  assert.deepEqual(enviados, apurado(2), "Maiara colapsa (1) + Fulano órfão sozinho na janela (1)");
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

test("auditoria 05/09 — o ticket carrega os DOIS denominadores: documento (média) e pessoa (degrau)", () => {
  // Os 7 orçamentos reais da atma são de 4 pessoas: 21 pediu 1, e 22/44/51 pediram 2 cada.
  // `celulasDeOrcamento` conta 4 (pessoa) e a média é sobre 7 (documento) — sem os dois números
  // no valor, o rótulo não consegue dizer qual é qual e o leitor divide um pelo outro.
  const janela = { inicio: "2026-07-31", fim: "2026-09-05" };
  const rows = [
    { criado: "2026-08-05", preco: 6355.93, desconto_vista: 0.1, paciente_lead_id: 21 },
    { criado: "2026-08-05", preco: 5084.75, desconto_vista: 0.05, paciente_lead_id: 22 },
    { criado: "2026-08-17", preco: 5084.75, desconto_vista: 0.05, paciente_lead_id: 22 },
    { criado: "2026-08-17", preco: 5980.0, desconto_vista: 0.1, paciente_lead_id: 44 },
    { criado: "2026-08-17", preco: 5980.0, desconto_vista: 0.05, paciente_lead_id: 44 },
    { criado: "2026-09-01", preco: 4490.0, desconto_vista: 0.1, paciente_lead_id: 51 },
    { criado: "2026-09-01", preco: 4490.0, desconto_vista: 0.1, paciente_lead_id: 51 },
  ];
  const c = ticketDeOrcamentos(rows, janela);
  assert.equal(c.docs, 7);
  assert.equal(c.pessoas, 4);
  assert.equal(c.valor.toFixed(2), "4932.34");
  // O degrau conta a MESMA coisa que `pessoas` — se um dia divergirem, o rótulo passa a mentir.
  assert.equal(celulasDeOrcamento(rows, janela).enviados.valor, c.pessoas);

  // 🚩 A asserção acima passou por sorte até 07/09: este fixture não tem órfão, então as duas somas
  // ingênuas (que eram cópias uma da outra) concordavam. O conserto do caso da Maiara pegou só
  // `celulasDeOrcamento`, e a trava não acusou. Amarrar as duas exige o caso que as separa.
  const comOrfao = [
    ...rows,
    { criado: "2026-09-05", preco: 4490, desconto_vista: 0.1, paciente_lead_id: null, paciente_nome: "Maiara Fernanda Hermann" },
    { criado: "2026-09-05", preco: 2990, desconto_vista: 0.05, paciente_lead_id: 53, paciente_nome: "Maiara Fernanda Hermann" },
  ];
  const t = ticketDeOrcamentos(comOrfao, janela);
  assert.equal(t.docs, 9, "9 documentos");
  assert.equal(t.pessoas, 5, "5 pessoas — a Maiara entra uma vez, não duas");
  assert.equal(t.orfaos, 0, "o órfão foi resolvido pelo nome, então não sobra órfão a decompor");
  assert.equal(celulasDeOrcamento(comOrfao, janela).enviados.valor, t.pessoas, "degrau e ticket contam a MESMA coisa");
});

test("auditoria 05/09 — orçamento sem `paciente_lead_id` conta como pessoa própria (lead de WhatsApp)", () => {
  const janela = { inicio: "2026-08-01", fim: "2026-08-31" };
  const c = ticketDeOrcamentos(
    [
      { criado: "2026-08-05", preco: 1000, desconto_vista: 0, paciente_lead_id: 7 },
      { criado: "2026-08-06", preco: 3000, desconto_vista: 0, paciente_lead_id: null },
    ],
    janela,
  );
  assert.equal(c.docs, 2);
  assert.equal(c.pessoas, 2);
  assert.equal(c.valor, 2000);
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

// ── 019/US2 — `buracosDeVerdade()`: a lista que a dobra mostra (contracts/buracos.md).
// A mesma que `posicaoDeAtaque()` consome — duas listas de "onde falta dado" na mesma tela é a
// segunda régua que a FR-002 proíbe.

/** Marcos sintéticos com a forma que `montarFicha()` produz (celula + familiaDoBuraco). */
const marcoBuraco = (chave, motivo, familia, rotuloBuraco) => ({
  chave,
  nome: chave,
  fonte: `fonte de ${chave}`,
  familia,
  familiaDoBuraco: familia,
  celula: rotuloBuraco ? { naoApurado: motivo, rotuloBuraco } : { naoApurado: motivo },
});
const marcoOk = (chave, valor) => ({ chave, nome: chave, fonte: `fonte de ${chave}`, familia: "D4", familiaDoBuraco: null, celula: apurado(valor) });

test("019/T015 caso 1 — célula `tela-nao-le` NÃO entra na lista (dívida de leitura, não buraco)", () => {
  const b = buracosDeVerdade([marcoOk("lead", 10), marcoBuraco("respondeu", "a tela não lê", "D4", "tela-nao-le")]);
  assert.deepEqual(b.map((x) => x.chave), []);
});

test("019/T015 caso 2 — `falhou-agora` entra com transitorio: true", () => {
  const b = buracosDeVerdade([marcoBuraco("lead", "fonte própria indisponível (ETIMEDOUT)", "D4", "falhou-agora")]);
  assert.equal(b.length, 1);
  assert.equal(b[0].transitorio, true);
  assert.equal(b[0].fonte, "fonte de lead");
  assert.equal(b[0].motivo, "fonte própria indisponível (ETIMEDOUT)");
  assert.equal(b[0].familia, "D4");
});

test("019/T015 caso 3 — `nao-mede` e célula sem rótulo entram com transitorio: false", () => {
  const b = buracosDeVerdade([
    marcoBuraco("respondeu", "sem coletor", "D4", "nao-mede"),
    marcoBuraco("orcamento", "sem fonte de orçamento", "D3"),
  ]);
  assert.deepEqual(b.map((x) => x.transitorio), [false, false]);
  // Ordem PRESERVADA: é a ordem da cadeia. Quem prioriza D4 é `posicaoDeAtaque()`, do lado dela.
  assert.deepEqual(b.map((x) => x.chave), ["respondeu", "orcamento"]);
});

test("019/T015 caso 4 — todos apurados devolve [], NUNCA null (vazio ≠ não calculado)", () => {
  const b = buracosDeVerdade([marcoOk("lead", 10), marcoOk("respondeu", 4)]);
  assert.deepEqual(b, []);
  assert.notEqual(b, null);
  // Sem marcos nenhum, idem.
  assert.deepEqual(buracosDeVerdade([]), []);
});

test("019/T015 caso 5 — `posicaoDeAtaque()` e a lista NÃO divergem: a célula do veredito é o 1º D4, ou o 1º item", () => {
  // Cadeia D real: lead apurado, respondeu D4 sem coletor, orcamento D3 sem fonte.
  const f = ficha("D", { leads: apurado(31), respondeu: naoApurado("sem coletor"), orcamentos: naoApurado("sem fonte de orçamento"), vendas: apurado(0) });
  const b = buracosDeVerdade(f.marcos);
  const v = posicaoDeAtaque(f);
  if (v.posicao === 2) {
    const esperada = b.find((x) => x.familia === "D4") ?? b[0];
    assert.equal(v.celula, esperada.nome);
  }
  // E a lista é EXATAMENTE a que o veredito filtra: mesmos degraus, mesma ordem.
  assert.deepEqual(
    b.map((x) => x.nome),
    f.marcos.filter((m) => !ehApurado(m.celula) && m.celula?.rotuloBuraco !== "tela-nao-le").map((m) => m.nome),
  );
});

// ── 019/US3 — `valorEmRisco()`: o pipeline somado (contracts/valor-em-risco.md).
// TODAS as linhas são SINTÉTICAS. Nenhuma constante de contagem real (FR-016, SC-004): um teste
// contra "9 orçamentos" reprovaria hoje mesmo — o handoff de ontem registrava 7, e a janela de
// CONVERSAO cresce todo dia. Testa-se a REGRA; o banco é o oráculo, na hora da verificação.

const JANELA_RISCO = { inicio: "2026-08-01", fim: "2026-08-31" };
const PERDA = ["sem_resposta", "perdido_concorrencia"];
const orc = (criado, lead, preco, desconto) => ({ criado, status: "enviado", paciente_lead_id: lead, preco, desconto_vista: desconto });
const leads = (pares) => new Map(pares.map(([id, motivo]) => [String(id), { motivo }]));

test("020/auditoria — o órfão resolvido pelo NOME entra no balde da pessoa dele, não num 'sem lead' à parte", () => {
  // Antes de 07/09 o bloco publicava "1 orçamento sem lead vinculado" ao lado de um degrau que já
  // contava aquela pessoa pelo id — vivos + perdidos + semLead dava um a mais que o degrau.
  const rows = [
    { criado: "2026-08-05", status: "enviado", paciente_lead_id: 53, paciente_nome: "Maiara Fernanda Hermann", preco: 3000, desconto_vista: 0 },
    { criado: "2026-08-06", status: "enviado", paciente_lead_id: null, paciente_nome: "maiara fernanda hermann", preco: 1000, desconto_vista: 0 },
    { criado: "2026-08-07", status: "enviado", paciente_lead_id: 21, paciente_nome: "Kailane", preco: 500, desconto_vista: 0 },
  ];
  const r = valorEmRisco(rows, leads([[53, "enviou_documentacao"], [21, "sem_resposta"]]), JANELA_RISCO, PERDA, apurado(0));
  assert.equal(r.semLead, null, "o órfão foi reconhecido — não sobra balde de 'sem lead'");
  assert.deepEqual(r.vivos, { pessoas: 1, valor: 4000 }, "os dois orçamentos da Maiara somam no balde dela");
  assert.deepEqual(r.perdidos, { pessoas: 1, valor: 500 });
  // A conta fecha contra o degrau e contra o total enviado — as três leituras da mesma pessoa.
  assert.equal(r.vivos.pessoas + r.perdidos.pessoas, celulasDeOrcamento(rows, JANELA_RISCO).enviados.valor);
  assert.equal(r.vivos.valor + r.perdidos.valor, r.enviados.valor);
});

test("020/auditoria — órfão irreconhecível continua no 'sem lead', fora de vivos e perdidos", () => {
  const rows = [
    { criado: "2026-08-05", status: "enviado", paciente_lead_id: 21, paciente_nome: "Kailane", preco: 500, desconto_vista: 0 },
    { criado: "2026-08-06", status: "enviado", paciente_lead_id: null, paciente_nome: "Anônimo do WhatsApp", preco: 900, desconto_vista: 0 },
  ];
  const r = valorEmRisco(rows, leads([[21, "sem_resposta"]]), JANELA_RISCO, PERDA, apurado(0));
  assert.deepEqual(r.semLead, { n: 1, valor: 900 }, "sem pessoa identificada não há motivo a consultar — chutar balde inventaria dado");
  assert.equal(r.vivos.pessoas + r.perdidos.pessoas + r.semLead.n, celulasDeOrcamento(rows, JANELA_RISCO).enviados.valor);
});

test("019/T027 caso 1 — 2 orçamentos do MESMO lead: enviados conta DOCUMENTO, vivos conta PESSOA", () => {
  const r = valorEmRisco(
    [orc("2026-08-05", 22, 1000, 0), orc("2026-08-17", 22, 1000, 0)],
    leads([[22, "contato_futuro"]]),
    JANELA_RISCO,
    PERDA,
    apurado(0),
  );
  assert.equal(r.enviados.n, 2);
  assert.equal(r.enviados.valor, 2000);
  assert.equal(r.vivos.pessoas, 1);
  assert.equal(r.vivos.valor, 2000);
});

test("019/T027 caso 2 — lead com motivo NA lista de perda é perdido, não vivo", () => {
  const r = valorEmRisco([orc("2026-08-05", 21, 1000, 0)], leads([[21, "sem_resposta"]]), JANELA_RISCO, PERDA, apurado(0));
  assert.equal(r.perdidos.pessoas, 1);
  assert.equal(r.vivos.pessoas, 0);
  assert.equal(r.perdidos.valor, 1000);
});

test("019/T027 caso 3 — lead com `motivo: null` é VIVO (quem não foi palitado não é perda)", () => {
  const r = valorEmRisco([orc("2026-08-05", 90, 1000, 0)], leads([[90, null]]), JANELA_RISCO, PERDA, apurado(0));
  assert.equal(r.vivos.pessoas, 1);
  assert.equal(r.perdidos.pessoas, 0);
});

test("019/T027 caso 4 — motivo FORA da lista declarada é vivo (a taxonomia é do cliente)", () => {
  const r = valorEmRisco([orc("2026-08-05", 51, 1000, 0)], leads([[51, "enviou_documentacao"]]), JANELA_RISCO, PERDA, apurado(0));
  assert.equal(r.vivos.pessoas, 1);
});

test("019/T027 caso 5 — `paciente_lead_id: null` entra em enviados, sai em semLead, fora de vivos e perdidos", () => {
  const r = valorEmRisco([orc("2026-08-05", null, 1000, 0)], leads([]), JANELA_RISCO, PERDA, apurado(0));
  assert.equal(r.enviados.n, 1);
  assert.equal(r.enviados.valor, 1000);
  assert.equal(r.semLead.n, 1);
  assert.equal(r.semLead.valor, 1000);
  assert.equal(r.vivos.pessoas, 0);
  assert.equal(r.perdidos.pessoas, 0);
});

test("019/T027 caso 6 — `motivosDePerda` null: vivos/perdidos saem null e `enviados` CONTINUA", () => {
  const r = valorEmRisco([orc("2026-08-05", 21, 1000, 0)], leads([[21, "sem_resposta"]]), JANELA_RISCO, null, apurado(0));
  assert.equal(r.vivos, null);
  assert.equal(r.perdidos, null);
  assert.equal(r.enviados.n, 1);
  assert.equal(r.enviados.valor, 1000);
});

test("019/T027 caso 7 — `preco`/`desconto_vista` chegando como STRING (o que o `pg` devolve para numeric)", () => {
  const r = valorEmRisco([orc("2026-08-05", 21, "6355.93", "0.1")], leads([[21, "contato_futuro"]]), JANELA_RISCO, PERDA, apurado(0));
  assert.equal(r.enviados.valor, 6355.93 * 0.9);
});

test("019/T027 caso 8 — `preco: null` fica FORA da soma, NUNCA vira 0", () => {
  const r = valorEmRisco(
    [orc("2026-08-05", 21, null, 0), orc("2026-08-06", 22, 500, 0)],
    leads([[21, "contato_futuro"], [22, "contato_futuro"]]),
    JANELA_RISCO,
    PERDA,
    apurado(0),
  );
  assert.equal(r.enviados.n, 1, "a linha sem preço numérico não conta como documento somado");
  assert.equal(r.enviados.valor, 500);
});

test("019/T027 caso 9 — nenhuma linha na janela devolve null (o bloco não renderiza; `R$ 0,00` não existe)", () => {
  assert.equal(valorEmRisco([], leads([]), JANELA_RISCO, PERDA, apurado(0)), null);
  assert.equal(valorEmRisco(null, leads([]), JANELA_RISCO, PERDA, apurado(0)), null);
});

test("019/T027 caso 10 — linha FORA da janela é ignorada", () => {
  const r = valorEmRisco(
    [orc("2026-07-15", 21, 999, 0), orc("2026-08-05", 22, 500, 0), orc("2026-09-30", 23, 999, 0)],
    leads([[21, null], [22, null], [23, null]]),
    JANELA_RISCO,
    PERDA,
    apurado(0),
  );
  assert.equal(r.enviados.n, 1);
  assert.equal(r.enviados.valor, 500);
});

test("019/T028/FR-013a — `fechados` vem do degrau `tratamento`, NUNCA de `orcamentos.status`", () => {
  // Todas as linhas em `enviado` — a coluna que só conheceu um valor não separa nada. O degrau
  // repassado é que manda, e ele pode ser `não apurado` sem contaminar o resto.
  const r = valorEmRisco([orc("2026-08-05", 21, 1000, 0)], leads([[21, null]]), JANELA_RISCO, PERDA, naoApurado("sem coletor"));
  assert.equal(ehApurado(r.fechados), false);
  assert.equal(r.fechados.naoApurado, "sem coletor");
  const fechado = valorEmRisco([orc("2026-08-05", 21, 1000, 0)], leads([[21, null]]), JANELA_RISCO, PERDA, apurado(3));
  assert.equal(fechado.fechados.valor, 3);
});

test("019/T028 — `status` do lead não entra em nada: manda o `motivo` (contradição do id 44)", () => {
  // O lead 44 está em `exames_enviados` com motivo `sem_interesse`. Esta spec, como a 018, não
  // modela contradição — quem decide é o campo que o operador de fato preenche.
  const r = valorEmRisco(
    [orc("2026-08-17", 44, 1000, 0)],
    new Map([["44", { motivo: "sem_interesse", status: "exames_enviados" }]]),
    JANELA_RISCO,
    ["sem_interesse"],
    apurado(0),
  );
  assert.equal(r.perdidos.pessoas, 1);
  assert.equal(r.vivos.pessoas, 0);
});
