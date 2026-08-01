# Os três números do §6, lidos um a um antes de virarem tarefa (01/08/2026)

**Contexto:** a frente do detector de defasagem foi **congelada** nesta sessão (decisão no topo do
handoff). O que sobrou de sessão foi para o §6 — `D-83`, `D-84` e `D-85`, os três fatos que
saíram da camada `estado` por LIGAÇÃO em 01/08 e cujos números **nunca tinham sido lidos linha a
linha**. A regra da casa é que a primeira leitura de um check mede o CHECK; aqui ela foi aplicada
aos três antes de qualquer um virar tarefa.

Zero LLM, zero pool nas três verificações.

**Resultado curto: os três checks estão certos, mas só DOIS dos três números são tarefa.** O
terceiro — o mais alarmante — é histórico e o conserto já foi entregue.

---

## 1. `D-83` — GEO-01 em 28 de 35 e DEP-08 em 11 de 15: reais

`node --env-file=.env scripts/conformidade.mjs` → **41 violações em 35 projetos**.

Número grande é o formato de um check quebrado (`repo` sem o dono deu 404 em 35 de 35; 5 das 46
violações da primeira corrida do conformidade eram o check errado). Por isso os dois foram
conferidos à mão, fora do script:

| norma | placar | conferido contra | veredito |
|---|---|---|---|
| `GEO-01` | 28 falham · 7 passam · 0 n/a | `curl` de `robots.txt` e `llms.txt` em 4 hosts | **real** |
| `DEP-08` | 11 falham · 4 passam · 20 n/a | `curl -D -` em 4 projetos `next` | **real** |

**O que absolve o check de `GEO-01`:** o `orion` serve `User-Agent: GPTBot` no `robots.txt` e é o
único cujo detalhe sai como **`sem llms.txt` apenas**, sem a metade do GPTBot. O check distingue as
duas faltas, então não está reprovando por atacado. Nos outros três hosts conferidos
(`atma`, `vertice`, `meridian`) o `llms.txt` responde **404 servindo o HTML da SPA/404 page** — que
é exatamente a razão de o check julgar o CORPO e não o status, igual ao `VER-02`.

**O que absolve o check de `DEP-08`:** `curl -sSL -D -` em `compass`, `vertice`, `orion` e
`verticemarketing` devolve `HTTP/1.1 200 OK` e **nenhuma** das três linhas
(`x-frame-options`, `x-content-type-options`, `referrer-policy`). O detalhe do check diz "nenhum dos
três headers do next.config" e é literalmente o que chega na borda.

⚠️ **`GEO-01` tem uma absolvição embutida que o placar não mostra:** a falta "robots.txt sem GPTBot"
só é acusada quando o `robots.txt` **existe** (`!ctx.robots.erro`). Host sem `robots.txt` nenhum não
é acusado por essa metade — o check erra para o lado leniente, não para o lado que infla. Os 28 são
piso.

⚠️ **`DEP-08` tem 20 `n/a`, e `n/a` não é aprovação:** é "não é `next`". O placar honesto é
**11 de 15 projetos `next` sem header de segurança nenhum**, não 11 de 35.

**Tarefa? Sim, e é cara:** o conserto de `GEO-01` são 28 repositórios e o de `DEP-08` são 11. Nenhum
dos dois é edição neste repo. Ficam nomeados, não feitos.

---

## 2. `D-84` — 12 homes fora do índice: o apurador está certo, a prosa do handoff estava errada

`node --env-file=.env scripts/dourado-estado.mjs --estado tudo` → **22 de 34 homes inspecionáveis no
índice**.

O handoff de 01/08 já registrava que a versão anterior errou o detalhe. A apuração viva confirma a
correção, item por item:

| host | o que o handoff velho dizia | o que a API devolve |
|---|---|---|
| `lumina` | `URL is unknown to Google` | **`Discovered - currently not indexed`** |
| `orcaobra` | — | `URL is unknown to Google` |
| `pathfinder` | — | `URL is unknown to Google` |

Os `URL is unknown` são **dois**, não um, e a `lumina` não é um deles.

**`portfolio` continua fora da conta e isso está certo:** ele mora em
`portfolio-three-mu-lfixsylpsz.vercel.app`, host de fornecedor que fica fora de toda propriedade do
Search Console. A `ressalva` do apurador já diz a frase inteira — *"sem propriedade" NÃO é "fora do
índice": é "não há onde olhar"*. É falta de domínio próprio, não sinal de SEO, e por isso o
denominador é 34 e não 35.

**Tarefa? Sim, e é a mais barata das três**, porque 6 dos 12 estão em `Discovered - currently not
indexed` — estado que responde a link interno e sitemap, não a conserto de código.

---

## 3. `D-85` — os 33,6% de OK do `roilabs.com.br` são HISTÓRICOS, e o conserto já foi entregue

Este é o número que parecia o pior da casa: **2596 requisições em 28 dias, OK em 33,6%** — o host
com mais crawl do portfólio e a pior taxa. A `ressalva` do apurador manda datar antes de caçar bug,
e datar foi o que dissolveu o achado.

### 3.1 A quebra por resposta diz que não é 404 nem redirect

`docs/Crawl-stats/roilabs.com.br/…-2026-07-25/Response table.csv`:

| resposta | fatia |
|---|---|
| **DNS error** | **53,5%** |
| OK (200) | 33,6% |
| Moved permanently (301) | 4,9% |
| Not found (404) | 4,4% |
| Page could not be reached | 2,7% |
| Moved temporarily (302) | 0,8% |
| robots.txt not available | 0,1% |
| Server error (5XX) | **0,02%** |

Mais da metade do crawl morreu **antes de chegar a um servidor**. `File type` fecha a conta pelo
outro lado: **60,7% "Unknown (failed requests)"**. Não há bug de aplicação aqui — 5xx é 0,02%.

### 3.2 Os 19 hosts resolvem HOJE, e 17 servem

Resolvidos e pedidos um a um (`Resolve-DnsName` + `curl`), os 19 hosts da `Hosts table.csv`:

- **0 NXDOMAIN.** Os 14 aposentados respondem `301` para o sucessor (`sirius` → `siriuscrm.com.br`,
  `sofiaia` → `polarisia.com.br`, `alibi`/`jbadvocacia`/`andorinha`/`clerk.atma` → `roilabs.com.br`).
- **8 servem `200`** (`atma`, `pathfinder`, `orion`, `vertice`, `atmaapi`, `goiania`, `tapepro`,
  apex) e 2 servem `307` para `/admin` (`atmaadmin`, `app`).
- **2 falham**, e as duas no handshake TLS: `www.sirius.roilabs.com.br` (698 req) e
  `www.goiania.roilabs.com.br` (4 req).

O export é de **2026-07-25 e cobre 90 dias** — a janela engole inteira a limpeza NXDOMAIN dos
subdomínios aposentados. `scripts/cloudflare-redirects.mjs` fechou esse buraco (o cabeçalho dele
registra os **76,6%** de crawl em host que não resolvia), e `--verify` reproduz o estado bom sem
token nenhum.

> **O 33,6% mede o mês de junho, não o dia de hoje.** Caçar bug nele seria caçar um bug já
> consertado — o modo de falha exato contra o qual a `ressalva` avisa.

### 3.3 As duas falhas que sobram são conhecidas, esperadas e PAGAS

`www.sirius` e `www.goiania` dão `ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE`, e não é regressão: o
certificado Universal da Cloudflare cobre **apex + um label**, então `www.<sub>.roilabs.com.br`
falha por construção. O comentário em `cloudflare-redirects.mjs:164` já diz isso e nomeia o preço —
Total TLS / ACM, pago. **`DNS-05` do conformidade também os exclui de propósito**, pelo mesmo
motivo, e é por isso que este achado não aparece em nenhum placar: os dois checks concordam em não
olhar.

**Tarefa? Não.** É decisão de gastar (ACM) contra 702 requisições de crawl em hosts que ninguém
digita. Fica registrado, não agendado.

---

## 4. O que esta leitura mudou

| # | número | check | é tarefa? |
|---|---|---|---|
| `D-83` | GEO-01 28/35 · DEP-08 11/15 | **certo**, conferido fora do script | **sim** — 28 + 11 repos, fora deste repo |
| `D-84` | 12 de 34 fora do índice | **certo**, e corrige a prosa do handoff velho | **sim** — 6 são `Discovered` |
| `D-85` | OK 33,6% no `roilabs.com.br` | **certo**, e o número é de junho | **não** — já consertado |

**Nenhum dos três checks precisou de conserto.** É a primeira vez em oito leituras de primeira
corrida nesta base que isso acontece — e a explicação provável não é sorte: os três já tinham
rodado como script antes de virarem fato apurável, então a "primeira corrida" deles foi a
agregação, não a medição. **A novidade era só a agregação**, exatamente como o handoff previu.

⚠️ **O que continua sem régua:** o export do Crawl Stats é commitado à mão. O apurado do `D-85`
envelhece sozinho e nada no repo avisa — a `ressalva` diz a data do arquivo, o que é o mínimo, mas
ninguém é acordado quando ela fica velha. Um export novo desta propriedade diria em uma corrida se
os 33,6% viraram os ~95% dos vizinhos; sem ele, esta página é a única coisa que impede o número de
ser lido como falha de hoje.
