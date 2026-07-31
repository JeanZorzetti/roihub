# Áreas de protocolo — taxonomia da camada 0

> Registro vivo, aberto em 31/07/2026. É a ontologia que
> [`rag-arquitetura.md`](rag-arquitetura.md) chama de camada 0: a chave de roteamento de
> toda consulta e o eixo que não dá para trocar depois sem reindexar.

## Três regras que definem a taxonomia

**1. Área só é área se a violação puder ser detectada, atribuída e corrigida.**
Se não existe checagem possível, não é protocolo — é página de wiki. Protocolo que ninguém
verifica é decoração, e com 35 empresas verificação manual não existe.

**2. A granularidade mora no protocolo, não na área.**
Poucas áreas (~13), muitos protocolos. Área é chave de roteamento: com 40 áreas ninguém
acerta o filtro da consulta. Com 13, o roteamento é trivial e a granularidade vem de
`SEO-04`, `SEO-05`, `SEO-06`.

**3. Aplicabilidade é eixo separado, não sub-área.**
`Astro + nginx devolve 301 para http://` é área **SEO**, mas se aplica só a
`stack:astro + infra:nginx`. Isso é aresta no grafo (`aplica-se-a`), não uma sub-área
"SEO-Astro". Sem essa separação a taxonomia explode e cada stack nova duplica a árvore.

---

## As 13 áreas com lastro no histórico

Contagem = protocolos **tipados e verificáveis** em `data/protocolos/`, escritos na primeira
ingestão (31/07/2026). É a prova de que a área é real: cada uma custou incidente. A coluna
"estimado" é o chute de 31/07 antes da tipagem, mantido porque a diferença é informação:
onde ela cresceu, a área estava subdimensionada.

| Cód. | Área | Pergunta que ela responde | Estimado | Tipado |
|---|---|---|---|---|
| **DEP** | Deploy e publicação | "O que eu preciso conferir para dizer que subiu?" | ~9 | **16** |
| **SEO** | Indexação e busca | "O Google está vendo, rastreando e indexando?" | ~8 | **6** |
| **UI** | Frontend e design | "Isso tem cara de produto ou de template?" | ~8 | **11** |
| **VER** | Evidência e verificação | "Isso que eu acabei de medir prova o quê?" | ~7 | **7** |
| **AGT** | Automação e agentes | "Posso automatizar isso, com o quê, e sem risco de ban?" | ~7 | **12** |
| **INT** | Integração e APIs de terceiro | "Por que a credencial/API do fornecedor falhou?" | ~6 | **7** |
| **DNS** | Domínio e DNS | "O nome resolve, tem cert, e aponta para o lugar certo?" | ~5 | **6** |
| **SEC** | Segurança e segredos | "O que está exposto que eu acho que está fechado?" | ~5 | **6** |
| **DAT** | Dados e migração | "A migração/consulta faz o que eu acho que faz?" | ~4 | **4** |
| **PRF** | Performance | "Está lento por quê, e essa medição é confiável?" | ~4 | **4** |
| **CNT** | Conteúdo e editorial | "O que publica sozinho pode publicar isso?" | ~4 | **10** |
| **PRT** | Portfólio e ciclo de vida | "Esse projeto continua ou morre, e por qual número?" | ~4 | **6** |
| **GEO** | Presença em IA | "ChatGPT/Perplexity/Gemini me citam?" | 1 | **2** |

**Total: 97 protocolos** — não os "~65" estimados na abertura deste doc nem os "~85" do
handoff. As duas áreas que mais cresceram explicam a diferença: **CNT** (o protocolo editorial
estava **em código**, no prompt de `lib/autopublish-clients.ts`, e nunca tinha sido escrito
como norma) e **DEP** (a operação da Vercel sozinha rende 6 protocolos). Triagem completa e o
que ficou de fora: [`protocolos-triagem.md`](protocolos-triagem.md).

### Notas sobre as escolhas menos óbvias

**VER (Evidência e verificação) é área, não método.** É a classe de lição mais repetida do
histórico e a mais cara: `curl -k` esconde erro de cert, landing em 200 com backend
NXDOMAIN, sitemap em 200 devolvendo HTML, `vercel project ls` não provando queda, site em
200 não indexado, 1 run de PSI decidindo nada, card de agenda com premissa não verificada.
São todas o mesmo protocolo: **o que conta como prova**. Merece área própria porque atravessa
todas as outras e porque é a que mais evita retrabalho.

**DNS separado de DEP.** Parecem a mesma coisa até o Clerk da Atma morrer por causa de uma
limpeza de NXDOMAIN — site em 200, auth 100% morta. Operação de DNS tem disciplina própria e
falha independente do deploy.

**GEO separado de SEO** apesar do lastro fino (1 playbook). São disciplinas diferentes:
otimizar para ranquear ≠ otimizar para ser citado. Vai engordar, e fundir agora obrigaria
a separar depois — que é justamente o que a camada 0 não permite barato.

**PRT (Portfólio) é área operacional, não estratégia solta.** Gates com número e data
(`sirius ≥ 5 cliques não-branded/28d até 31/08`, `tapepro ≥ 300 imp/28d até 19/10`),
kill D+90/180/270, WIP ≤ 3, "chave = URL do site, não o repo", "todo host vivo tem nome de
produto". Tudo isso é verificável — logo é protocolo.

---

## As 5 lacunas — áreas sem uma única memória

Franqueza: com 35 empresas, a ausência aqui é mais perigosa que qualquer protocolo mal
escrito nas 13 acima. Nenhuma dessas tem lastro porque **nunca deu problema ainda**, não
porque não importa.

| Cód. | Área | Por que a ausência é o risco |
|---|---|---|
| **BKP** | Backup e recuperação | Zero memórias. 35 projetos, vários com Postgres em VPS. Não existe registro de backup testado — e backup que nunca foi restaurado não é backup. |
| **CST** | Custo de infra | Zero memórias. EasyPanel + Vercel + VPS + domínios × 35. Ninguém sabe o custo por projeto, então "matar projeto" não tem denominador. |
| **OBS** | Observabilidade e alerta | Zero memórias. Hoje quebra se descobre olhando. Distinto de VER: **VER é como provar quando você olha; OBS é ser avisado sem olhar.** |
| **PRV** | Privacidade e dado pessoal | Zero memórias. Sirius e Estetia são CRM — dado de cliente e de clínica. Atma é ortodontia. LGPD não é opcional aí. |
| **A11Y** | Acessibilidade | Zero memórias, apesar do MCP de a11y instalado. Vira exigência conforme os projetos B2B amadurecem. |

Recomendação: abrir as cinco como áreas **vazias e declaradas** desde o início. Área vazia
com nome é uma pergunta aberta visível; área inexistente é um ponto cego.

---

## O registro de protocolo (unidade granular)

Um protocolo é um registro versionado, não um parágrafo.

⚠️ **O YAML abaixo é só legibilidade.** A implementação é **JSON**, um arquivo por protocolo
em `data/protocolos/<AREA>-<NN>.json` — o Node 22 não tem parser de YAML nativo e este repo
não adiciona dependência para isso. O `area` gravado é o **código em maiúsculas** (`SEO`), não
o slug minúsculo do exemplo, para que `id`, nome de arquivo e área concordem — é o que
`test/protocolos.test.mjs` cobra. O `SEO-04` do exemplo existe e é literalmente este.

```yaml
id: SEO-04
area: seo
titulo: Indexação se prova por URL Inspection, nunca por status HTTP
norma: >
  Antes de afirmar que uma URL está indexada, consultar a URL Inspection API.
  Status 200 e sitemap aceito não são prova. Impressões caindo com posição
  MELHORANDO é desindexação, não perda de ranking.
motivo: >
  Atma perdeu 98% das impressões com o site respondendo 200 o tempo todo.
  Detectado só pela URL Inspection; reversível em 24h após resubmit do sitemap.
verificacao:
  tipo: automatica
  como: scripts/inspect-url.mjs --project <slug>
  frequencia: semanal
  falha_significa: bloqueia
aplica_se_a:
  stack: ["*"]
  infra: ["*"]
  superficie: [site]
excecoes:
  - "errors:1 no sitemap NÃO é bloqueio de indexação (fabrica, 31/07: 24/26 indexadas)"
origem: [site_200_is_not_indexed_url_inspection]
valid_from: 2026-07-30
valid_to: null
```

Os campos que fazem o sistema funcionar, e por quê:

- **`verificacao.como`** — sem comando, o protocolo não entra no robô de conformidade e o
  manifesto do projeto não consegue declarar aderência. É o campo que separa protocolo de
  anotação.
- **`aplica_se_a`** — vira aresta no grafo. É o que responde *"quais dos meus 35 têm esse
  problema"* sem varrer os 35.
- **`excecoes`** — o histórico mostra que protocolo sem exceção derruba tarefa boa: o
  `errors: 1` do sitemap do `fabrica` viraria bloqueio falso.
- **`valid_from` / `valid_to`** — o modelo bitemporal da camada 0. Protocolo revogado sai de
  circulação e continua auditável.
- **`origem`** — procedência. Resposta sem procedência é resposta que o agente re-deriva.

## Como popular

Ordem recomendada, e o motivo:

1. ✅ **Extrair os protocolos que já existem** nas memórias e handoffs — feito em 31/07/2026,
   **97 registros**. Nada novo foi inventado nessa fase.
2. ✅ **Escrever `verificacao.como` para cada um.** Feito, e é o campo que o teste cobra.
3. **Só então abrir as 5 lacunas**, escrevendo do zero, com a checagem definida antes da
   norma. ← **próximo passo desta camada**, ainda não começado.

Escrever área nova antes de tipar o que já foi aprendido caro é descartar o ativo mais
valioso do portfólio.
