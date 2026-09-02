# Quickstart — como conferir a 013

**Feature**: `013-n4-canais-ga4-somado` | **Data**: 2026-09-02

Guia de validação, não de implementação. Cada seção prova um Critério de Sucesso da spec e diz o
que reprova.

---

## 0. Pré-requisito operacional (uma vez, fora do código)

1. Abrir o admin do GA4 da propriedade do projeto → **Administrador → Acesso à propriedade**.
2. Adicionar o `client_email` da conta de serviço de `GOOGLE_SERVICE_ACCOUNT_JSON` como
   **Visualizador**.
3. Anotar o **ID da propriedade** (número, em *Administrador → Detalhes da propriedade*).
4. No card do projeto em `data/projects.json`:

   ```json
   "ga4": { "propertyId": "properties/123456789" }
   ```

Sem o passo 2 a API responde 403 e os canais saem `não apurado` nomeando a falha — que é o
comportamento desenhado. Sem o passo 4 nada é chamado.

---

## 1. Suíte pura (a régua que reprova sozinha)

```bash
npm test
```

Verde é gate de merge (Princípio II). Nenhum arquivo de teste novo: as asserções da 013 entram em
`test/ficha.test.mjs`, **já registrado** em `package.json` — nenhuma linha nova lá, e
`test/validade.test.mjs` continua concordando com o diretório.

O que a suíte tem de reprovar se alguém quebrar a feature:

| Asserção | Reprova o quê |
|---|---|
| `ga4: null` → 5 canais `nao-apurado`, orgânico intacto | FR-003, FR-007, SC-003 |
| `ga4: {erro}` → mesma coisa, motivo diferente, orgânico intacto | FR-008, SC-006 |
| `ga4: {linhas: []}` → 4 canais em `0` **apurado** | FR-004 |
| linhas com `Organic Search` → não altera a célula do orgânico | FR-005a, SC-008 |
| janela do GA4 ≠ janela da cadeia → canais do GA4 `nao-apurado` | FR-006 |
| grupo `Email` → aparece em `foraDoCatalogo`, não em canal nenhum | FR-009 |
| total composto = soma **só** dos apurados, rótulo com cobertura | FR-005b, D7 |
| `diferença` `nao-apurado` enquanto `outbound` não tem fonte | FR-012 |
| célula inferida fora do total, fora de `espacosKr["n4:"]` | FR-011, SC-009 |

---

## 2. Projeto sem GA4 — o teste que prova que nada quebrou (SC-004, SC-010)

**Antes** de tocar em qualquer código, guardar o retrato de uma ficha sem `ga4`:

```bash
curl -su "$HUB_USER:$HUB_PASS" https://hub.roilabs.com.br/okr/<slug> > /tmp/antes.html
```

Depois do deploy, repetir para `/tmp/depois.html` e comparar as linhas de N3 e N4. **Idênticas** —
mesmos números, mesmos motivos. Qualquer diferença reprova a FR-007.

Vale a pena repetir para dois ou três projetos de perfis diferentes: o perfil decide a cadeia, e
uma regressão pode aparecer só no perfil C (onde `organico` fica `semElo`).

---

## 3. Projeto com GA4 — o caminho feliz (SC-001, SC-002, SC-005)

Na ficha do projeto configurado, no card **N4**:

- [ ] pelo menos **4** canais com número e procedência na mesma linha (SC-001, SC-002);
- [ ] `outbound` continua `não apurado`, nomeando que a fonte não o distingue;
- [ ] cada canal aparece **uma vez**, com **uma** fonte (SC-005);
- [ ] o total composto está rotulado **composto**, com a cobertura no rótulo (FR-005b);
- [ ] a nota do nível diz que o composto **não** é o `visitante` da cadeia (FR-005d);
- [ ] o `visitante` do N3 e todas as taxas estão **iguais** ao retrato de antes (SC-010).

Conferência aritmética: somar à mão os canais apurados exibidos e bater com o total composto. Se
não bater, ou o total somou um `não apurado` como zero (R1) ou incluiu o volume fora do catálogo.

---

## 4. Com o GA4 fora do ar (SC-006, FR-008)

Simular a falha sem derrubar nada: apontar `ga4.propertyId` do card para uma propriedade
inexistente (`properties/1`) e recarregar a ficha.

- [ ] a página **abre**;
- [ ] o número orgânico continua lá, com o mesmo valor;
- [ ] os quatro canais do GA4 dizem `não apurado` nomeando a falha — nenhum `0`;
- [ ] a mensagem **não** contém valor de variável de ambiente, chave, e-mail da conta de serviço
      nem trecho de credencial (FR-013, Princípio V).

Reverter o card em seguida.

---

## 5. A inferência do WhatsApp na Atma (SC-007, SC-009)

Na ficha `/okr/atma`:

- [ ] existe linha própria para o contato fora do formulário, com o volume;
- [ ] ela está visivelmente marcada como **inferência**, não como apurada;
- [ ] a dívida está escrita ao lado: instrumentar a origem do contato é feature separada (FR-011b);
- [ ] o número **não** aparece somado em lugar nenhum: nem no total composto, nem em canal, nem em
      taxa do N3.

Prova da SC-009 sem rodar nada: a célula inferida não está em `espacosKr["n4:"]`, não é insumo de
`combinar()` e não chega a `montarFicha()`. Remover a linha da tela não muda número nenhum — se
mudar, a invariante 1 do §1 do data-model foi violada.

Conferência da origem do número, direto na fonte (leitura, sem escrita):

```bash
psql "$ATMA_DATABASE_URL" -c \
  "SELECT count(*) FILTER (WHERE paciente_lead_id IS NULL) AS sem_lead, count(*) AS total
   FROM orcamentos WHERE criado_em::date BETWEEN '<INICIO>' AND '<FIM>';"
```

`sem_lead` tem de ser exatamente o número exibido. Em 02/09 eram 2 de 7.

---

## 6. Varredura do portfólio (SC-003)

Percorrer as fichas dos 17 projetos com `perfil` e confirmar que **nenhum** canal sem fonte exibe
`0`. Um `0` numa linha de canal de projeto sem `ga4` é o defeito central da casa de volta.

---

## 7. Deploy

`main` faz auto-deploy por push (Princípio IV). **Fora** de 23:30–01:00 e 08:00–08:45 BRT.
A conferência é sempre no HTML servido pelo EasyPanel, nunca em `next dev` — mesma régua da 011 e
da 012.
