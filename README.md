# Propostas

Ferramenta interna para preparar e avaliar a componente de experiência profissional de um
procedimento de contratação pública com o preço como critério único.

Aplicação 100% cliente: sem backend e sem qualquer chamada de rede. Os ficheiros de propostas
em avaliação nunca saem do posto de trabalho.

## Os três módulos

O fluxo acompanha três papéis distintos, que raramente são a mesma pessoa:

| Módulo | Quem usa | O que faz | Saídas |
|---|---|---|---|
| **1 · Perfis** | Elemento técnico | Define os requisitos mínimos de experiência, o conteúdo funcional e as certificações de cada perfil | Formulário Excel (uma folha por perfil), JSON com todos os perfis |
| **2 · Lotes** | Responsável do procedimento | Agrupa perfis em lotes e atribui horas, preço/hora e n.º mínimo de elementos | Documento Word, JSON do agrupamento, pedido de parecer eAvalia, formulários de declaração (um Excel por lote) |
| **3 · Avaliação** | Júri | Apura o cumprimento dos requisitos em todos os lotes de uma vez | Relatório Excel com o agregado, o desagregado por requisito, o traço de apuramento e uma folha por concorrente; JSON de resultados |
| **4 · Ordenação** | Júri | Ordena pelo preço as propostas admitidas em cada lote | O relatório do Módulo 3, mais a ordenação de cada lote e os vencedores |

Quem define os perfis não sabe ainda o número do procedimento nem como os lotes serão
agrupados — por isso o Módulo 1 não os pede. No formulário entregue ao candidato, o número
do procedimento é sempre campo de preenchimento livre; o lote vem pré-preenchido e bloqueado
quando o formulário é gerado a partir de um lote já definido no Módulo 2, e fica em branco
quando é gerado no Módulo 1.

### Um catálogo de perfis, partilhado

Os perfis vivem num único catálogo, partilhado pelos Módulos 1 e 2. Carregar um ficheiro no
Módulo 2 acrescenta os perfis a esse catálogo, e corrigir um requisito no Módulo 1 reflete-se
de imediato no lote onde o perfil já esteja atribuído — não há cópias a divergir. É o `id` de
cada perfil, preservado na importação e na exportação, que sustenta essa correspondência;
duplicar um perfil dá-lhe identidade nova, precisamente para que passe a ser outro.

## Experimentar

Cada módulo tem um botão **Carregar exemplo** que preenche tudo com dados realistas.
Os mesmos dados estão em `exemplos/` como ficheiros JSON:

- `exemplos/perfis-exemplo.json` — quatro perfis, para o Módulo 1.
- `exemplos/lotes-exemplo.json` — dois lotes com quatro perfis, para os Módulos 2 e 3.

São gerados a partir de `src/core/exemplo.ts` (fonte única) com `npm run exemplos`.

### Preço base

O preço base de cada perfil dentro de um lote é
`n.º mínimo de elementos × horas × preço unitário/hora`, sem IVA.

### Duas regras que atravessam a aplicação

**Nenhuma data pode ser posterior ao mês corrente.** Experiência ainda por
decorrer não é experiência adquirida. O formulário Excel trava-a na validação
(com `TODAY()`, para o teto acompanhar o preenchimento) e o Módulo 3 volta a
impô-la no apuramento — é este último que decide, porque a validação do Excel
pode sempre ser contornada.

**Um lote por concorrente**, quando ativada no Módulo 2. A regra sai no
documento Word com título próprio, e é aplicada em dois tempos, porque em dois
tempos chega a informação de que depende:

- No **Módulo 3** ainda não há preço — o formulário de declaração não o traz —,
  pelo que não se pode dizer quem fica com o quê. Assinala-se apenas o
  *impedimento potencial*: quem é admitido em mais do que um lote só pode ficar
  com um deles. Ninguém é excluído por esta via.
- No **Módulo 4**, com os preços na mão, os lotes decidem-se pela ordem
  crescente do número: quem vence o lote 1 sai da corrida nos seguintes, ainda
  que aí apresente o preço mais baixo.

### Os perfis normalizados

O Módulo 1 tem um ponto de partida além do «Novo perfil»: o catálogo de
perfis-base da entidade (`src/core/perfisNormalizados.ts`), com o conteúdo
funcional e os requisitos transversais de cada um.
São os perfis iguais em todos os procedimentos; o que varia — os requisitos
tecnológicos específicos do projeto — acrescenta-se depois, a cada perfil.

O ficheiro é gerado a partir do Excel dos perfis-base, e não reescrito à mão:
a redação dos requisitos é matéria das peças do procedimento, e o sítio onde se
altera é o ficheiro de origem. Os identificadores são estáveis (`pn1`, `pn2`, …),
pelo que voltar a carregar o catálogo atualiza os perfis que já estejam num lote,
em vez de criar cópias ao lado — a mesma regra da importação de ficheiros JSON.

O catálogo não traz preços. O preço/hora é decisão de cada procedimento e
escreve-se à mão no Módulo 2, ao colocar o perfil no lote — como sempre foi, e
para todos os perfis por igual.

### O nome do procedimento

Não se escreve: forma-se a partir do nome do projeto, precedido de «Aquisição de
Serviços de Desenvolvimento e Manutenção do projeto». O campo do Módulo 2 mostra-o e não o
deixa editar, e o nome altera-se alterando o do projeto, no Módulo 1. É uma peça
que aparece no documento Word, no agrupamento e no pedido de parecer: escrita
três vezes à mão, mais tarde ou mais cedo ficaria diferente numa delas.

Sem nome de projeto não há nome de procedimento — fica vazio, e não meio nome.
Pela mesma razão, «Recomeçar» no Módulo 1 apaga também o nome do projeto: sem
dados, a aplicação apresenta-se como na primeira vez, e o nome de um projeto
anterior num campo preenchido é o género de resto que acaba dentro de uma peça.

### A palavra-passe dos exemplos

Carregar exemplos substitui o trabalho em curso por dados fictícios, e o pior não
é perder o que estava feito — é ficar sem saber se o que está no ecrã é o
procedimento ou o exemplo. Por isso os botões «Carregar exemplo» pedem uma
palavra-passe (`src/ui/ProtecaoExemplos.tsx`), uma vez por separador aberto. É uma
caixa da própria página, e não o `prompt()` do navegador, por uma razão simples:
o `prompt()` mostra a olho nu o que se escreve.

Não é segurança, e não se faz passar por isso: a aplicação corre inteira no
navegador, sem servidor nenhum, pelo que a palavra-passe está no código que o
navegador descarrega. É um travão contra o clique distraído, e é só isso.

### O posto de trabalho

O documento Word leva uma secção com as condições de execução, em tabela e só
com o que ficou escolhido: as opções ponderadas e postas de lado ficam no
rascunho, não no documento que vincula.

O regime vem primeiro porque comanda o resto: em regime remoto não há local a
indicar, e a linha do local nem chega a existir. O mesmo vale para os requisitos
do equipamento, que só saem quando o equipamento é do prestador — é a ele que se
exigem.

O texto dos requisitos tem um valor de partida, e é editável. Quando esse valor
de partida muda, quem tem um agrupamento guardado — no navegador ou em ficheiro
— continuaria com o antigo para sempre: quem nunca lhe mexeu não escolheu aquele
texto, aceitou o que lhe deram. Por isso, ao reabrir, um texto de partida antigo
que ninguém tenha tocado passa ao atual (`requisitosEquipamentoAtualizados`);
um texto ajustado à mão fica como está, e há um «repor o texto de partida» para
quem se arrepender.

Nada disto é opcional: o posto de trabalho vai para o Caderno de Encargos e
vincula quem executa, pelo que um local por indicar, um «Outro» sem sítio ou os
requisitos do equipamento em branco travam os descarregamentos do Módulo 2, como
qualquer outra questão por resolver. Só se exige o que a escolha do regime e do
equipamento tornou aplicável.

### O pedido de parecer eAvalia

O Módulo 2 preenche o modelo oficial do pedido de parecer prévio
(`src/excel/modelos/`), que é ficheiro de terceiros: sai como entrou, com oito
células escritas — o nome do projeto no objeto da aquisição, três respostas de
alinhamento tecnológico com as datas que as acompanham, e a conformidade com o
Quadro Nacional de Referência para a Cibersegurança, que vai sempre como «Não
aplicável». Esta última é a única resposta que se escreve por cima do que o
modelo trazia: não é decisão que se tome procedimento a procedimento, e por isso
não se pergunta. As restantes medidas vão como já vêm no modelo.

A data só acompanha as respostas que assumem um compromisso futuro («Cumpre
Totalmente», «Cumpre Parcialmente»). É regra do próprio formulário, escrita na
formatação condicional da célula da data: quem já cumpre não tem data por que se
comprometer, e a quem não se aplica não há data a pedir.

É por isso que este ficheiro não passa pelo exceljs, que o reescreveria por
inteiro a partir da sua própria leitura: abre-se o ZIP, escrevem-se as células
nos dois XML que as contêm, e fecha-se com as restantes entradas intactas. Um
teste confirma-o — só essas duas folhas mudam, byte a byte. As respostas
oferecidas na interface são exatamente as da lista de validação do formulário,
porque um valor de fora seria recusado por ele.

As três respostas são de preenchimento obrigatório. Não é a aplicação a exigi-lo:
o pedido de parecer segue com elas, e uma medida por responder deixaria a célula
em branco no formulário oficial — pelo que, enquanto faltar alguma, o Módulo 2
não deixa descarregar nada.

### O que não passa pelo Excel

O **conteúdo funcional** e as **certificações** de um perfil saem apenas no
documento Word, cada um em tabela própria por baixo dos requisitos. Ambos são
listas, uma entrada por linha, como os requisitos: cada atividade e cada
certificação é uma unidade autónoma, e vírgulas e pontos e vírgulas fazem parte
do nome ("Oracle Certified Professional, Java SE") em vez de o separarem. Nenhum dos
dois é matéria que o candidato declare no formulário: o primeiro descreve o
trabalho a contratar, e a certificação verifica-se contra as peças da proposta,
fora desta ferramenta. Pedi-los em Excel só produziria respostas que ninguém
apuraria.

Como a certificação não entra em nenhum quadro do apuramento, o risco é passar
despercebida. Por isso o Módulo 3, ao carregar o agrupamento, assinala cada
perfil que a exija — chamada de atenção, não verificação.

## Princípios

- **Determinismo total.** Nenhum uso de IA em qualquer ponto do fluxo. O mesmo input produz
  sempre o mesmo output, e todo o apuramento é reconstituível à mão a partir do relatório.
- **Os critérios nunca vêm do ficheiro do concorrente.** Requisitos e mínimos são lidos
  exclusivamente da configuração guardada pela entidade adjudicante.
- **A aplicação sinaliza, não decide.** Situações de exclusão são apresentadas como alertas.
  A aplicação nunca exclui uma proposta por iniciativa própria.
- **Nunca valida assinaturas digitais.** Essa validação faz-se com ferramentas próprias
  (Autenticação.gov, Adobe).

## Persistência

O trabalho de configuração — o catálogo de perfis (Módulo 1) e o agrupamento de lotes
(Módulo 2) — é guardado no `localStorage` do navegador e reaparece na sessão seguinte.

As declarações carregadas no Módulo 3, o apuramento que delas resulta e os preços
indicados no Módulo 4 **nunca** são guardados: contêm dados pessoais de candidatos
e matéria de proposta, e vivem apenas em memória, desaparecendo ao fechar o
separador. O mesmo vale para o JSON de resultados e para o relatório Excel — são
descarregamentos deliberados, e devem ser guardados com o cuidado devido.

## Desenvolvimento

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm test         # testes do núcleo de cálculo (Vitest)
npm run build    # build de produção (pasta dist/)
```

### Estrutura

- `src/core/` — núcleo de cálculo puro (Regra A), perfis, lotes, validação e agregação.
- `src/excel/` — geração do formulário e do relatório (exceljs), leitura de declarações (SheetJS)
  e preenchimento do modelo eAvalia (`eavalia.ts`, sobre o ZIP). O vocabulário visual dos dois
  ficheiros gerados vive em `src/excel/estilo.ts`: é a partilha que os faz parecer da mesma casa.
- `src/pdf/` — comparador PDF ↔ Excel (pdf.js).
- `src/modulo1/` … `src/modulo4/` — interface de cada módulo.
- `src/ui/` — componentes partilhados.

## Implantação (GitHub Pages)

O workflow `.github/workflows/deploy-pages.yml` compila e publica a pasta `dist/` no
GitHub Pages a cada push para `main` ou `claude/app-development-3g3pv9` (ou manualmente,
via "Run workflow" no separador Actions). Os caminhos de build são relativos
(`base: './'`), pelo que o mesmo `dist/` também funciona aberto localmente a partir do disco.
