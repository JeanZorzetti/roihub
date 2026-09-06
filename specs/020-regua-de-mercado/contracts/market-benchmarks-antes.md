# `market_benchmarks` — o estado ANTES da 020

**Transcrição literal, tirada da base da Atma em 06/09/2026, antes de qualquer escrita desta spec.**
Existe para satisfazer a **FR-015** (a operação é reversível) e porque estas 12 linhas são o registro
de um erro que toda esta família de specs cita.

Todas as 12 têm `created_at = 2026-07-30T20:41:59.826Z` — foram semeadas de uma vez, no mesmo
segundo, e nunca revisadas. Todas as 12 têm `source = "A definir - aguardando pesquisa de mercado"`.

| id | category | metric_key | metric_name | metric_value | metric_unit | description | source |
|---|---|---|---|---|---|---|---|
| 1 | SEO | `ctr_medio` | CTR Médio | 3.50 | % | Taxa de cliques média em resultados orgânicos do Google para o setor de ortodontia digital | A definir - aguardando pesquisa de mercado |
| 2 | SEO | `posicao_media` | Posição Média Google | 8.00 | posição | Posição média no Google para keywords principais do setor | A definir - aguardando pesquisa de mercado |
| 3 | SEO | `impressao_to_click` | Impressões → Cliques | 3.50 | % | Taxa de conversão de impressões para cliques | A definir - aguardando pesquisa de mercado |
| 4 | CONVERSAO | `click_to_cadastro` | Cliques → Cadastro | 5.00 | % | Taxa de conversão de cliques no site para cadastro/lead | A definir - aguardando pesquisa de mercado |
| 5 | CONVERSAO | `cadastro_to_agendamento` | Cadastro → Agendamento | 40.00 | % | Taxa de conversão de cadastros para agendamentos | A definir - aguardando pesquisa de mercado |
| 6 | CONVERSAO | `agendamento_to_comparecimento` | Agendamento → Comparecimento | 70.00 | % | Taxa de comparecimento em avaliações agendadas | A definir - aguardando pesquisa de mercado |
| 7 | CONVERSAO | `comparecimento_to_conversao` | Avaliação Inicial → Conversão | 35.00 | % | Taxa de conversão de avaliação inicial para início de tratamento | A definir - aguardando pesquisa de mercado |
| 8 | CONVERSAO | `taxa_cancelamento` | Taxa de Cancelamento | 15.00 | % | Taxa de cancelamento ao longo do funil | A definir - aguardando pesquisa de mercado |
| 9 | GERAL | `click_to_conversao` | Conversão Total (Cliques → Convertido) | 1.20 | % | Taxa de conversão end-to-end: cliques até conversão final | A definir - aguardando pesquisa de mercado |
| 10 | GERAL | `tempo_medio_funil` | Tempo Médio do Funil | 14.00 | dias | Tempo médio da primeira visita até conversão | A definir - aguardando pesquisa de mercado |
| 11 | GERAL | `bounce_rate` | Taxa de Rejeição | 55.00 | % | Taxa de rejeição média em sites do setor | A definir - aguardando pesquisa de mercado |
| 12 | GERAL | `cac_medio` | CAC Médio | 800.00 | R$ | Custo de Aquisição de Cliente médio no setor | A definir - aguardando pesquisa de mercado |

---

## O que há de errado, linha a linha

Três defeitos distintos, e vale separá-los porque o conserto de cada um é diferente.

### A. Sem fonte — todas as 12

`source = "A definir - aguardando pesquisa de mercado"` em 12 de 12. O campo existe, foi preenchido
com uma promessa, e a promessa nunca foi cumprida em **38 dias** de produção.

### B. Números redondos — 12 de 12

`3,50 · 8,00 · 3,50 · 5,00 · 40,00 · 70,00 · 35,00 · 15,00 · 1,20 · 14,00 · 55,00 · 800,00`.
Nenhuma medição do mundo real produz doze valores redondos seguidos. É a assinatura de chute.

### C. Degrau que a Atma não tem — 7 de 12

| id | metric_key | por que não é da Atma |
|---|---|---|
| 5 | `cadastro_to_agendamento` | a Atma **nunca agendou consulta** |
| 6 | `agendamento_to_comparecimento` | idem — não há agendamento para comparecer |
| 7 | `comparecimento_to_conversao` | idem — não há avaliação inicial |
| 8 | `taxa_cancelamento` | não é degrau; `patient_leads.status` tem `cancelado`, mas a cadeia não o modela |
| 10 | `tempo_medio_funil` | velocidade é a **spec 021**, não régua |
| 11 | `bounce_rate` | não é degrau da cadeia |
| 12 | `cac_medio` | a Atma **não gasta em mídia** — o canal é 100% SEO |

Estes 7 não voltam em nenhuma forma (FR-014).

### As 5 restantes, e o que acontece com cada uma

| id | metric_key | destino na 020 |
|---|---|---|
| 1 | `ctr_medio` | ⏳ vira o veredito **condicional** de `impressão→clique` (funde com a 3) |
| 2 | `posicao_media` | ❌ removida — posição não é degrau; é a **condição** da linha 1 |
| 3 | `impressao_to_click` | ⏳ é o mesmo degrau da 1; sobra **uma** entrada, condicional |
| 4 | `click_to_cadastro` | 🚫 vira **recusa estrutural** (GA4 × GSC — FR-009) |
| 9 | `click_to_conversao` | ❌ removida — é a **cadeia inteira**, e comparar degrau contra cadeia é o que a trava nº 1 proíbe |

---

## Como reverter, se for preciso

```sql
-- Reconstrói o estado de 06/09/2026. Só use se a 020 for revertida por inteiro.
-- Os ids são preservados; a sequência precisa ser reajustada depois.
INSERT INTO market_benchmarks
  (id, category, metric_key, metric_name, metric_value, metric_unit, description, source)
VALUES
  (1,'SEO','ctr_medio','CTR Médio',3.50,'%','Taxa de cliques média em resultados orgânicos do Google para o setor de ortodontia digital','A definir - aguardando pesquisa de mercado'),
  (2,'SEO','posicao_media','Posição Média Google',8.00,'posição','Posição média no Google para keywords principais do setor','A definir - aguardando pesquisa de mercado'),
  (3,'SEO','impressao_to_click','Impressões → Cliques',3.50,'%','Taxa de conversão de impressões para cliques','A definir - aguardando pesquisa de mercado'),
  (4,'CONVERSAO','click_to_cadastro','Cliques → Cadastro',5.00,'%','Taxa de conversão de cliques no site para cadastro/lead','A definir - aguardando pesquisa de mercado'),
  (5,'CONVERSAO','cadastro_to_agendamento','Cadastro → Agendamento',40.00,'%','Taxa de conversão de cadastros para agendamentos','A definir - aguardando pesquisa de mercado'),
  (6,'CONVERSAO','agendamento_to_comparecimento','Agendamento → Comparecimento',70.00,'%','Taxa de comparecimento em avaliações agendadas','A definir - aguardando pesquisa de mercado'),
  (7,'CONVERSAO','comparecimento_to_conversao','Avaliação Inicial → Conversão',35.00,'%','Taxa de conversão de avaliação inicial para início de tratamento','A definir - aguardando pesquisa de mercado'),
  (8,'CONVERSAO','taxa_cancelamento','Taxa de Cancelamento',15.00,'%','Taxa de cancelamento ao longo do funil','A definir - aguardando pesquisa de mercado'),
  (9,'GERAL','click_to_conversao','Conversão Total (Cliques → Convertido)',1.20,'%','Taxa de conversão end-to-end: cliques até conversão final','A definir - aguardando pesquisa de mercado'),
  (10,'GERAL','tempo_medio_funil','Tempo Médio do Funil',14.00,'dias','Tempo médio da primeira visita até conversão','A definir - aguardando pesquisa de mercado'),
  (11,'GERAL','bounce_rate','Taxa de Rejeição',55.00,'%','Taxa de rejeição média em sites do setor','A definir - aguardando pesquisa de mercado'),
  (12,'GERAL','cac_medio','CAC Médio',800.00,'R$','Custo de Aquisição de Cliente médio no setor','A definir - aguardando pesquisa de mercado');
```

⚠️ Reverter **restaura o veredito falso**. Este bloco existe para satisfazer a FR-015, não porque a
reversão seja desejável.
