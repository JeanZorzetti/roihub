# Glossário

Termos com dono no hub. Antes de nomear aviso, botão ou rótulo, procure aqui; termo novo entra aqui
no mesmo commit que o usa.

| Termo | Usar | Nunca | Onde aparece |
|---|---|---|---|
| Lead novo | "Lead novo · <produto>" | novo contato, oportunidade, conversão | título do aviso de lead no Telegram (026) |
| Ticket novo | "Ticket novo · <produto>" | ticket aberto, chamado, solicitação | título do aviso de ticket no Telegram (026) |
| Cliente respondeu | "Cliente respondeu · <produto>" | nova mensagem, atualização no ticket | título do aviso de resposta no Telegram (026) |
| Responder no painel | link dos avisos de ticket | ver ticket, clique aqui | Telegram (026) |
| Abrir no CRM do hub | link do aviso de lead | ver lead, clique aqui | Telegram (026) |
| Prioridade | baixa · normal · alta · urgente | LOW, NORMAL, HIGH, URGENT | aviso de ticket — os mesmos rótulos do painel dos produtos |
| Categoria | Bug · Dúvida · Sugestão · Financeiro · Onboarding · Outro | BUG, QUESTION, FEATURE_REQUEST, BILLING | aviso de ticket — os mesmos rótulos do painel dos produtos |
| Pedido de parceria | "Pedido de parceria · Atma" | novo parceiro, parceiro cadastrado | aviso da Atma no Telegram (027) — ninguém virou parceiro ainda |
| Fora do ar | "Fora do ar · <projeto>" + motivo em português | DOWN, status ERROR, offline | aviso do vigia (027) |
| De volta | "De volta · <projeto>" + quanto tempo ficou fora | UP, online, restabelecido | aviso do vigia (027) |
| Abrir a checagem | link dos avisos do vigia | ver health, clique aqui | Telegram (027) |
| Abrir no painel | link padrão dos avisos de evento | ver lead, clique aqui | Telegram (027); o ROI Labs mantém "Abrir no admin", o texto dos e-mails dele |
| Pagamento devolvido | "↩️ Pagamento devolvido" | reembolsado, refunded | alerta do ROI Labs (027) |
| Contestação no cartão | "⚠️ Contestação no cartão" | chargeback, charged_back | alerta do ROI Labs (027) — pede ação diferente da devolução |
| Renovação recusada | "⚠️ Renovação recusada" + data do cancelamento automático | ciclo falhou, falha de renovação | alerta do ROI Labs (027) |
| Assinatura cancelada | "⛔ Assinatura cancelada" + quem cancelou | assinatura encerrada, churn | alerta do ROI Labs (027) |
| Assinatura de hosts | os hosts somados num dia, ordenados e unidos por `+` | host da série, domínio do projeto | coluna `host` de `hub_gsc_dia` (029) e linha "hosts somados" dos blocos de série e de consultas de /okr/<slug>/aquisicao (030, 031 — a mesma frase, do componente `HostsDaLeitura`) — uma assinatura de um host é o caso comum, não um caso especial: a tela cala |
| Host sem propriedade | "sem propriedade no Search Console e fora da soma" + o host | host encerrado, domínio morto, host que falhou | blocos de série e de consultas de /okr/<slug>/aquisicao (030, 031) — ausência estrutural, que pede criar a propriedade; não é "Search Console indisponível", falha de agora que pede tentar de novo |
| Credencial do Search Console ausente | "a credencial do Search Console não está configurada neste ambiente" | sem propriedade, sem acesso, o nome da variável de ambiente | /gsc/mapa e blocos de /okr/<slug>/aquisicao (033) — ausência de infraestrutura, que pede configurar o ambiente de execução; não é "sem propriedade", que pede criar a propriedade. As duas eram a mesma frase até 20/09/2026 |
| Nenhum host declarado | "nenhum host declarado para este projeto" | sem propriedade, projeto sem site | mesmas telas (033) — o card não declara URL, e o conserto é o card, não o Search Console |
| Fronteira de migração | o dia em que a assinatura muda DENTRO do conjunto declarado | corte da série, série encerrada | gráfico de semanas em /okr/<slug>/aquisicao (029) — a série segue viva dos dois lados |
| Leitura por página | "leitura por página" — uma linha por URL, completa | dimensão page, gscPaginas, leitura de URL | bloco de consultas de /okr/<slug>/aquisicao (032) — alimenta TODA medida que afirma algo sobre uma URL: Índice de Conformidade, URLs com impressão, Active Index Ratio, a lista abaixo do benchmark e a amostra do Pass Rate |
| Leitura por termo | "leitura por termo" — uma linha por consulta e URL, parcial | dimensão query, gscConsultas, leitura de consulta | bloco de consultas de /okr/<slug>/aquisicao (032) — alimenta TODA medida que afirma algo sobre uma consulta, e só ela carrega o selo "piso, não total": o Search Console omite as consultas raras (10.395 de 24.664 impressões na Atma, 19/09/2026) |
| Base da medida | "<n> impressões · leitura por página" ou "· leitura por termo", ao lado de cada leitura | total, amostra, denominador | bloco de consultas de /okr/<slug>/aquisicao (032) — duas bases convivem na mesma lista, e sem a declaração a diferença entre duas linhas vizinhas lê como bug; `null` quando a leitura não respondeu, nunca 0 por ausência |
| Próxima ação | "→ <verbo> · <leitura> · <meta ou régua>" na folha; entrada do bloco "O que fazer primeiro" | recomendação, insight, tarefa, sugestão | /gsc/mapa/<slug> (054) — só existe quando a regra da folha dispara; o verbo é o da alavanca (`lib/proxima-acao.mjs#ALAVANCAS`) |
| Sem ação | "sem ação · <leitura>" | ok, dentro, aprovado, ✓, atinge | folha do mapa (054) — a regra não pediu trabalho; em folha ◇ não é veredito, e nunca é usado para ausência (ausência é "∅ sem ação · <motivo>") |
| Meta do board, sem fonte | "◇ meta do board, sem fonte" | régua, benchmark, limite | ação disparada por meta sem fonte (054, decisão do dono Q1) — dispara trabalho, nunca veredito; "régua" só com origem ◆ |
| Degrau | "1 · Índice", "2 · Desempenho", "3 · Página certa para o termo", "4 · Posição", "5 · Snippet" | etapa, fase, prioridade, nível | bloco "O que fazer primeiro" (054) — a ordem de ataque; o número é a ordem |
