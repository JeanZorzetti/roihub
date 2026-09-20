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
| Fronteira de migração | o dia em que a assinatura muda DENTRO do conjunto declarado | corte da série, série encerrada | gráfico de semanas em /okr/<slug>/aquisicao (029) — a série segue viva dos dois lados |
