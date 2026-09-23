# Research — 055

## D1. A leitura "na marca" vem do form, não é recalculada na action

- **Decisão**: a página põe num campo oculto o texto de cada motivo da entrada (`{chave: texto}`), e a
  action grava isso. `lerMarca()` valida: objeto de strings, chaves do `REGRAS`, texto até 300
  caracteres, no máximo 32 chaves.
- **Por quê**: recalcular exigiria a action refazer a abertura inteira do mapa (GSC, crawl, CrUX), o
  que viola a 054/SC-005 do lado da gravação e custa segundos por clique. O form é da casa, atrás do
  basic auth; o risco é texto errado numa linha de exibição, e a validação limita isso.
- **Alternativa rejeitada**: guardar só o número (`valor`). A entrada precisa mostrar a frase lida
  ("73,7% (30 de 114 fora do índice)"), e o número cru não carrega o denominador.

## D2. Datas em BRT, como `YYYY-MM-DD`, com os helpers que a agenda já tem

- **Decisão**: `hoje` é `todaySP()` e `reler` é `addDaysISO(hoje, dias)`, os dois de `lib/agenda.mjs`,
  já usados e testados pela agenda. Vencida é `hoje >= reler`.
- **Alternativa rejeitada**: uma `somarDias()` nova no `proxima-acao.mjs` — seria a segunda cópia de
  uma função que o hub já tem.
- **Por quê**: o dono lê "reler em 07/10" no calendário dele. Um `Date` do servidor em UTC viraria o
  dia às 21:00 BRT.

## D3. Prazo por botão de opção, um clique no padrão

- **Decisão**: o form de marca tem um `<select name="dias">` com 7, 14 e 28 dias (14 selecionado) e um
  botão por responsável (`name="responsavel"`), como o seletor de dono da agenda. Com o padrão, marcar
  é um clique; com outro prazo, dois (SC-005 pede no máximo três).
- **Por quê**: a página não tem JS no cliente, e a agenda já provou o padrão de um botão por pessoa.
- **Alternativa rejeitada**: `<input type="date">`. Três opções cobrem o caso real (novo rastreio leva
  de 1 a 4 semanas) e evitam data no passado por construção.

## D4. O degrau vazio conta as folhas pelo caminho folha → alavanca → degrau

- **Decisão**: uma folha pertence ao degrau da alavanca da regra dela. `checklistGsc` (regra `null`)
  não pertence a degrau nenhum. A contagem separa **sem disparo** (`sem-acao` com leitura; o glossário proíbe "dentro" para sem ação), **a amostra não
  decide** e **sem leitura**, e agrupa os motivos de sem leitura com o nome das folhas.
- **Por quê**: "procedimento, sem número" também é `sem-acao` na 054, e contar isso como "dentro"
  seria o mesmo defeito que abriu esta spec.

## D5. Marca de alavanca sem disparo: some, exceto se a leitura falhou

- **Decisão**: se a alavanca marcada não tem disparo hoje e alguma folha da leitura guardada está
  `sem-leitura`, a entrada continua, aguardando, com "leitura de hoje falhou" e o motivo. Se todas
  estão dentro, a entrada some (FR-008).
- **Por quê**: sem isso, o GSC fora do ar no dia faz a entrada sumir como se tivesse resolvido.

## D6. Uma linha por (projeto, alavanca), sobrescrita a cada marca

- **Decisão**: PK `(projeto, alavanca)`; marcar de novo substitui; desfazer é `DELETE`.
- **Por quê**: o estado que a tela precisa é o atual. Histórico de marcas não tem leitor. Mesmo
  desenho do `hub_acao_dono`: ausência de marca é ausência de linha.
