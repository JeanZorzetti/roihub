# 014 — N5: medidores D3 lidos do GA4, sem instrumentar o site

**Status:** ENTREGUE em 2026-09-03. Janela de referência: 2026-08-04 → 2026-08-31.

## O problema

A `atma` trava em **D3 — Persuasão** (`tratamento INICIADO = 0`, §7.1 fim da cadeia), e
`escolherFamilia()` escolhe os MEDIDORES de D3 para o N5. Os quatro saíam iguais:

```
scroll-ate-oferta   não apurado — sem coletor nesta requisição
cliques-cta         não apurado — sem coletor nesta requisição
abandono-por-campo  não apurado — sem coletor nesta requisição
saida-checkout      não apurado — sem coletor nesta requisição
```

Meia página de tela dizendo a mesma frase quatro vezes. `disponiveisN5` só tinha `impressoes`,
`lead-gravado` e `gateway-ligado` — todos medidores de D1 e D4, nenhum de D3.

## A decisão: R4 antes de instrumentar

O reflexo é escrever eventos novos no site da Atma. **Não.** O GA4 da propriedade
`properties/504053080` — a MESMA que a 013 já lê para os canais do N4 — já grava, retroativo,
por enhanced measurement:

| evento | janela | vira |
|---|---|---|
| `scroll` (90% da página) | 629 | `scroll-ate-oferta` |
| `click` (link EXTERNO) | 30 | `cliques-cta` |
| `form_start` | 49 | metade de `abandono-por-campo` |
| `form_submit` | **ZERO** | a outra metade, ausente |
| `begin_checkout` | ausente | `saida-checkout` |

Instrumentar antes de olhar criaria a cópia pior de sempre: sem histórico, contando de hoje em
diante, ao lado de um dado que já cai.

## Requisitos

- **FR-001** Uma query só, na mesma `Promise.all` de `ga4Canais` — `eventName` × `pagePath` ×
  `linkUrl`, filtrada aos 5 eventos. Falha dela NÃO alcança o caminho dos canais nem do orgânico.
- **FR-002** **Tráfego interno sai.** `/admin` e `/login` são cortados por
  `PAGINA_INTERNA`. Sem isso o medidor de persuasão mede a EQUIPE: 327 dos 629 `scroll` da
  `atma` (52%) estavam em `/admin/pacientes/lista`.
- **FR-003** O NOME do medidor promete mais do que o evento entrega, então a **`fonte` vai colada
  na célula** e `montarN5` passa a usá-la em vez de `"coleta desta requisição"`:
  `scroll` é 90% da PÁGINA, não a seção de oferta; `click` é link EXTERNO.
- **FR-004** `cliques-cta` sai com a **quebra por destino colada** (`instagram.com 18 · wa.me 9 ·
  facebook.com 2 · linkedin.com 1`), mesma regra da R2 que exige fração colada no percentual —
  clique em Instagram não é CTA de venda, e um `30` solto seria lido como se fosse.
- **FR-005** `form_submit` em ZERO é **`não apurado` com motivo**, NUNCA 100% de abandono. O zero
  é o site não emitir o evento, não o formulário ser perfeito — e o conserto é encanamento (D4)
  no site, não copy. A `fonte` diz isso.
- **FR-006** GA4 fora (`erro`) não vira zero em medidor nenhum — falha FECHADA, os quatro voltam
  a `não apurado` nomeando o erro.
- **FR-007** Projeto sem `ga4.propertyId` no card: mapa vazio, medidores voltam ao
  `sem coletor nesta requisição` de antes. Sem regressão para os outros 41 projetos.

## O que mudou

| arquivo | o quê |
|---|---|
| `lib/ga4.ts` | `ga4Eventos()` + `EVENTOS_D3` — borda de rede, zero regra (Princípio III) |
| `lib/ficha.mjs` | `PAGINA_INTERNA`, `medidoresDeEventos()` puro; `montarN5` usa `celula.fonte` |
| `lib/okr-coleta.ts` | `ga4ev` na mesma `Promise.all`, devolvido junto |
| `app/okr/[slug]/page.tsx` | `...medidoresDeEventos(ga4ev)` em `disponiveisN5` |
| `test/ficha.test.mjs` | 8 testes (arquivo já registrado no `package.json` — Princípio II) |

## Resultado na `atma`

```
scroll-ate-oferta   255 apurado   (629 − 327 /admin − 25 /login − 22 outros /admin)
cliques-cta          30 apurado   instagram.com 18 · wa.me 9 · facebook.com 2 · linkedin.com 1
abandono-por-campo   não apurado  form_start 48 e form_submit ZERO
saida-checkout       não apurado  nenhum begin_checkout na propriedade
```

De 4 frases idênticas para 2 números apurados e 2 `não apurado` que nomeiam trabalho.

## Fora de escopo, registrado

- **Os 9 cliques em `wa.me` são o canal novo, medidos.** O N4 infere "contato fora do formulário"
  de `orçamento sem paciente_lead_id` (2 linhas). O GA4 tem 9, com data, retroativo — fonte
  melhor para a mesma célula. Não trocado aqui.
- **`projecao` é calculada e descartada na ficha.** `app/okr/[slug]/page.tsx` chama `projetar()`
  e passa `projecao` a `montarNiveis()`, que **não desestrutura o campo**. Por isso a meta
  (`R$ 50000 em 4000 por unidade`) sai em `/okr` e não sai em `/okr/atma`. Bug da 010/011.

---

## Segunda leva (03/09/2026, mesma sessão) — o que o Jean pediu depois de ver a tela

**FR-008 A ficha mostra tudo que a lista mostra.** `Projecao` era função local de
`app/okr/page.tsx`; virou `app/okr/projecao.tsx`, importada pelas DUAS telas. A ficha ganha
também o pill do veredito (`§7.1 — fator ZERADO no fim da cadeia`), a linha de perfil
(`Perfil D — … · N1: … · Receita = …`) e o motivo completo do veredito. Quem abria a ficha de um
projeto via MENOS do que quem passava os olhos na lista de 42 — e a pior ausência era a meta,
porque `projetar()` rodava na ficha e o resultado morria sem renderizar.

**FR-009 `cliques-cta` é o CTA de CONTATO, não link externo qualquer.** `DESTINO_CTA` aceita
WhatsApp (`wa.me`, `*.whatsapp.com`), `tel:` e `mailto:`. A `atma` saía `30` com 18 em Instagram —
clique em perfil social não é intenção de contato e um `30` solto é lido como se fosse. Agora
sai **9**. Zero clique em CTA vira `não apurado` nomeando a armadilha: o `click` do GA4 só enxerga
`<a href>` externo, então botão que abre WhatsApp por `window.open` sai igual a botão que ninguém
apertou.

**FR-010 `saida-checkout` não existe em perfil sem checkout.** Regra declarativa
(`medidorCabeNoPerfil`): o medidor só aparece se a cadeia do perfil tem o marco `checkout` — hoje
só o B (e-commerce). Numa clínica era linha permanente de "não apurado" sobre um checkout que não
existe. **Não** é inferido do dado: zero evento na janela não prova ausência de checkout, e a R1
não deixa confundir os dois.

**FR-011 "Abandono por campo" virou "Formulário começado e não enviado".** O nome prometia quebra
POR CAMPO, que o GA4 não dá, e sozinho não dizia o que era medido. O rótulo agora é a definição.

### No repo da Atma (`JeanZorzetti/Atma`), mesma leva

- `components/footer.tsx` — Instagram, Facebook e LinkedIn removidos. Levavam 21 dos 30 cliques
  externos da janela: tráfego saindo sem virar contato.
- `components/structured-data.tsx` — os três saem do `sameAs` junto. Ele não é decoração: é a
  identidade que Google e mecanismos generativos seguem para descrever a marca, e o LinkedIn
  apontava para uma página que não existe mais — um 404 assinado por nós.
- `components/ui/floating-action-button.tsx` — `FloatingAction` ganhou `href`, e o WhatsApp/telefone
  viraram `<a href>` de verdade em vez de `window.open`. **É o conserto que faz o FR-009 medir a
  verdade:** no mobile, o botão de contato mais usado do site não emitia evento nenhum. Rótulo
  agora é "Falar no WhatsApp", e os controles só-ícone ganharam `aria-label`.
