# Data Model: Avisos — 027

Nada novo vai para banco relacional. O único dado persistido é o estado do vigia, numa chave do
Workers KV.

## Aviso de evento (em trânsito, origem → hub)

Corpo de `POST /api/avisos/evento` (contrato em [contracts/avisos.md](contracts/avisos.md)).

| Campo | Regra | Origem do valor |
|---|---|---|
| `projeto` | `atma` · `roilabs` · `coopluz` | fixo em cada repositório |
| `titulo` | obrigatório, até 120 caracteres; o hub acrescenta ` · <Projeto>` se o nome não estiver nele | a origem, com emoji |
| `texto` | opcional, até 3.500 caracteres; quebras de linha preservadas | a origem, só valores |
| `caminho` | opcional; `^/[A-Za-z0-9/_-]*$`, até 200 caracteres | a origem |
| `acao` | opcional, até 40 caracteres; padrão "Abrir no painel" | a origem |

Base do link, fixa no hub:

| Projeto | Nome no título | Base |
|---|---|---|
| `atma` | Atma | `https://atmaadmin.roilabs.com.br` |
| `roilabs` | ROI Labs | `https://app.roilabs.com.br` |
| `coopluz` | Coopluz | `https://admin.autogestor.roilabs.com.br` |

## Eventos por origem

| Evento | Repositório | Dispara quando | Campos no aviso | Nunca entra |
|---|---|---|---|---|
| Lead novo · Vértice | roihub | `insertLead` → `created` e pipeline `verticemarketing` | nome, canal, e-mail, telefone | metadata comportamental |
| Lead novo · Coopluz | coopluz | `gravarLead` → `created` | nome, página (`Solucao.nome`), WhatsApp, conta de luz ou cidade | ip, user agent, referer |
| Lead novo · Atma | atma | `INSERT patient_leads` e `!req.isAdmin` | nome, e-mail, telefone, cidade | observações |
| Pedido de parceria · Atma | atma | `INSERT crm_leads` pelo site | nome, clínica, cidade/UF, e-mail, telefone | CRO, mensagem, valor da parte clínica |
| Alertas existentes · ROI Labs | ROI Labs (`app/`) | todo `sendAlert` | título e corpo do alerta | — |
| Pagamento devolvido · ROI Labs | ROI Labs (`app/`) | `refunded`/`charged_back` e pedido ainda não `reembolsado` | nome, WhatsApp, total, tipo | — |
| Renovação recusada · ROI Labs | ROI Labs (`app/`) | falha de renovação com `setarJanela` | nome, WhatsApp, assinatura (`slug`), data do cancelamento automático | — |
| Assinatura cancelada · ROI Labs | ROI Labs (`app/`) | `cancelarAssinatura` pelo token do cliente ou pela varredura | nome, WhatsApp, assinatura, quem cancelou | — |
| Fora do ar / De volta · Atma | roihub (`vigia/`) | transição do vigia | motivo, início, duração | — |

## Estado do vigia (Workers KV, chave `atma`)

```json
{ "foraDesde": 1789140720000, "motivo": "sem resposta", "avisado": false }
```

Sem a chave, o alvo está no ar e sem pendência. A chave é removida quando o alvo volta.

| Campo | Tipo | Significado |
|---|---|---|
| `foraDesde` | epoch ms | horário da 1ª checagem ruim da queda atual |
| `motivo` | `"sem resposta"` · `"erro <status>"` · `"sem banco de dados"` · `"resposta inesperada"` | motivo da 1ª checagem ruim |
| `avisado` | boolean | o aviso de queda já foi aceito pelo Telegram |

### Transições (`passo(estado, checagem, agora)`)

| Estado | Checagem | Aviso | Novo estado |
|---|---|---|---|
| sem chave | ok | — | sem chave (não grava) |
| sem chave | ruim | — | `{ foraDesde: agora, motivo, avisado: false }` |
| fora, não avisado, `agora − foraDesde < 10 min` | ruim | — | igual (não grava) |
| fora, não avisado, `agora − foraDesde ≥ 10 min` | ruim | **queda** (motivo, `foraDesde`) | `avisado: true` (grava só se o envio foi aceito) |
| fora, avisado | ruim | — | igual (não grava) |
| fora, não avisado | ok | — | sem chave (oscilação curta, em silêncio) |
| fora, avisado | ok | **volta** (`agora − foraDesde`, `foraDesde`, `agora`) | sem chave (remove só se o envio foi aceito) |

`passo` é pura: recebe `agora` e devolve `{ estado, aviso, mudou }`. O Worker grava quando
`mudou`, e, se houver aviso, só depois de o Telegram aceitá-lo.

### Checagem (`checar(url, fetchImpl)`)

| Resultado do `GET` | `ok` | `motivo` |
|---|---|---|
| exceção ou mais de 10 s | false | `sem resposta` |
| status fora de 2xx | false | `erro <status>` |
| 2xx, corpo que não é JSON (página do proxy, por exemplo) | false | `resposta inesperada` |
| 2xx, JSON sem `status: "OK"` | false | `sem banco de dados` |
| 2xx com `status: "OK"` | true | — |
