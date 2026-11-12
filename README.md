# Manifestações de Necessidades

Ferramenta interna para preparar e analisar a componente de experiência profissional de um
procedimento de contratação pública com o preço como critério único.

Aplicação 100% cliente: sem backend e sem qualquer chamada de rede. Os ficheiros de propostas
em análise nunca saem do posto de trabalho.

## A página inicial

A aplicação abre numa página inicial com quatro grupos de módulos, cada um num cartão:

- **Pedido de serviços de bolsa de horas** — 1 Projeto, 2 Perfis, 3 Lotes.
- **Pedido de licenciamento** — 1 Produto, L1 Licenças, L2 Condições e L3 Pedido.
- **Análise de propostas** — 4 Análise, 5 Ordenação.
- **Orçamento** — Vista Geral da Unidade e Vista Geral da Direção.

Em cada módulo, o topo tem «← Página inicial», o grupo em que se está e os passos do grupo, para ir
de um módulo ao seguinte. O endereço da página guarda onde se está (`#bolsa/perfis`): o botão
«retroceder» do navegador funciona e recarregar não volta ao início.

## Os cinco módulos

O fluxo acompanha papéis distintos, que raramente são a mesma pessoa:

| Módulo | Quem usa | O que faz | Saídas |
|---|---|---|---|
| **1 · Projeto** | Responsável do projeto | Identifica o projeto (nome e descrição) e justifica a aquisição: objetivos, benefícios e riscos da não contratação | Nenhuma própria: segue nos ficheiros dos perfis e dos lotes |
| **2 · Perfis** | Elemento técnico | Define os requisitos mínimos de experiência, o conteúdo funcional e as certificações de cada perfil | Excel de resumo (uma folha por perfil), JSON com todos os perfis |
| **3 · Lotes** | Responsável do procedimento | Agrupa perfis em lotes e atribui horas, preço/hora e n.º mínimo de elementos | Documento Word, JSON do agrupamento, pedido de parecer eAvalia, formulários de declaração (um Excel por lote) |
| **4 · Análise** | Júri | Apura o cumprimento dos requisitos em todos os lotes de uma vez | Relatório Excel com o agregado, o desagregado por requisito, o traço de apuramento e uma folha por concorrente; JSON de resultados |
| **5 · Ordenação** | Júri | Ordena pelo preço as propostas admitidas em cada lote | O relatório do Módulo 4, mais a ordenação de cada lote e os vencedores |

Quem define os perfis não sabe ainda o número do procedimento nem como os lotes serão
agrupados — por isso o Módulo 2 não os pede. No formulário entregue ao candidato, o número
do procedimento é sempre campo de preenchimento livre; o lote vem pré-preenchido e bloqueado
quando o formulário é gerado a partir de um lote já definido no Módulo 3, e fica em branco
quando é gerado no Módulo 2.

O projeto tem ficheiro próprio («Descarregar projeto (JSON)», no Módulo 1), só com o nome, a
descrição, os objetivos, os benefícios e os riscos. «Importar projeto (JSON)» aceita esse ficheiro e
também o JSON dos perfis ou dos lotes, de onde tira só o projeto. O projeto continua a ir dentro do
JSON dos perfis e do dos lotes, e ao importar um desses ficheiros nos Módulos 2 e 3 é adotado se o
Módulo 1 ainda estiver em branco. Cada módulo tem o seu «Carregar exemplo» e o
seu «Recomeçar», que só tocam no que é desse módulo.

### Um catálogo de perfis, partilhado

Os perfis vivem num único catálogo, partilhado pelos Módulos 2 e 3. Carregar um ficheiro no
Módulo 3 acrescenta os perfis a esse catálogo, e corrigir um requisito no Módulo 2 reflete-se
de imediato no lote onde o perfil já esteja atribuído — não há cópias a divergir. É o `id` de
cada perfil, preservado na importação e na exportação, que sustenta essa correspondência;
duplicar um perfil dá-lhe identidade nova, precisamente para que passe a ser outro.

## Experimentar

Cada módulo tem um botão **Carregar exemplo** que preenche tudo com dados realistas.
Os mesmos dados estão em `exemplos/` como ficheiros JSON:

- `exemplos/perfis-exemplo.json` — quatro perfis, para o Módulo 2.
- `exemplos/lotes-exemplo.json` — dois lotes com quatro perfis, para os Módulos 3 e 4.

São gerados a partir de `src/core/exemplo.ts` (fonte única) com `npm run exemplos`.

### Valor estimado

O valor estimado de cada perfil dentro de um lote é
`n.º mínimo de elementos × horas × preço unitário/hora`, sem IVA.

### Regras que atravessam a aplicação

**Nenhuma experiência pode ir além da data-limite de apresentação de
propostas** (n.º 13 das regras). Experiência ainda por decorrer não é experiência
adquirida; e um projeto ainda em curso considera-se terminado na data-limite
(n.º 4). A data-limite indica-se no Módulo 4, antes de apurar, e é o teto das
datas declaradas: o período que se prolongue para além do seu mês não conta. O
formulário Excel não tem teto — quando é gerado a data-limite ainda não se
conhece —, só aceita meses e anos inteiros, sem casas decimais.

**O Resumo Curricular** tem, por perfil, uma folha principal com 15 projetos e
uma folha de experiência adicional com outros 15, que continua a numeração; o
Módulo 4 lê as duas. Um mês ou ano com casas decimais não é arredondado: a data
não conta e fica assinalada. Um projeto sem início ou fim do projeto não conta;
um projeto sem cliente/entidade, projeto ou função conta, mas fica assinalado, e
o júri pode — sem evidências pedidas ao concorrente (n.º 14) — não o considerar.

**Um lote por concorrente**, quando ativada no Módulo 3. A regra sai no
documento Word com título próprio, e é aplicada em dois tempos, porque em dois
tempos chega a informação de que depende:

- No **Módulo 4** ainda não há preço — o formulário de declaração não o traz —,
  pelo que não se pode dizer quem fica com o quê. Assinala-se apenas o
  *impedimento potencial*: quem é admitido em mais do que um lote só pode ficar
  com um deles. Ninguém é excluído por esta via.
- No **Módulo 5**, com os preços na mão, os lotes decidem-se pela ordem
  crescente do número: quem vence o lote 1 sai da corrida nos seguintes, ainda
  que aí apresente o preço mais baixo.

### O que sai de cada módulo em Excel

São dois ficheiros com propósitos opostos, e convém não os confundir.

O do **Módulo 2** é o registo de quem prepara o procedimento: uma folha por
perfil, com os requisitos e a exigência em anos e meses, as certificações e o
conteúdo funcional. Serve para conferir e para arquivar o que ficou escrito. Leva
as certificações, que o formulário não pode levar, e não tem um único campo por
preencher — daí não ter amarelo nenhum, que nesta aplicação é a cor reservada ao
que alguém escreve.

O do **Módulo 3** é o formulário que os concorrentes preenchem, um por lote, com
os blocos de projeto e as validações. Só existe depois de haver lotes, porque é
o lote que o identifica.

### A atividade que fecha o conteúdo funcional

A cláusula «Outras atividades de natureza análoga às descritas…» é a mesma em
todos os perfis e não se guarda em nenhum: acrescenta-se no fim, onde quer que o
conteúdo funcional saia. Guardá-la como as outras era admitir que alguém a
apagasse num perfil e não noutro, e ficar com peças a dizer coisas diferentes
sobre a mesma matéria. No editor aparece como última linha, sem botões; ao
importar um ficheiro que a trazia guardada, é retirada, para não sair duas vezes.

Cada perfil tem de ter pelo menos uma atividade própria além dela: uma lista só
com a cláusula de fecho não descreve trabalho nenhum.

### Os perfis normalizados

O Módulo 2 tem um ponto de partida além do «Novo perfil»: o catálogo de
perfis-base da entidade (`src/core/perfisNormalizados.ts`), com o conteúdo
funcional, os requisitos transversais e — onde as haja — as formações ou
certificações exigidas.
São os perfis iguais em todos os procedimentos; o que varia — os requisitos
tecnológicos específicos do projeto — acrescenta-se depois, a cada perfil.

O ficheiro é gerado a partir do Excel dos perfis-base (versão v3, com a folha
das formações/certificações), e não reescrito à mão:
a redação dos requisitos é matéria das peças do procedimento, e o sítio onde se
altera é o ficheiro de origem. Os identificadores são estáveis (`pn1`, `pn2`, …),
pelo que voltar a carregar o catálogo atualiza os perfis que já estejam num lote,
em vez de criar cópias ao lado — a mesma regra da importação de ficheiros JSON.

O catálogo não traz preços. O preço/hora é decisão de cada procedimento e
escreve-se à mão no Módulo 3, ao colocar o perfil no lote — como sempre foi, e
para todos os perfis por igual.

### O nome do procedimento

Não se escreve: forma-se a partir do nome do projeto, precedido de «Aquisição de
Serviços de Desenvolvimento e Manutenção do projeto». O campo do Módulo 3 mostra-o e não o
deixa editar, e o nome altera-se alterando o do projeto, no Módulo 1. É uma peça
que aparece no documento Word, no agrupamento e no pedido de parecer: escrita
três vezes à mão, mais tarde ou mais cedo ficaria diferente numa delas.

Sem nome de projeto não há nome de procedimento — fica vazio, e não meio nome.
Pela mesma razão, «Recomeçar» no Módulo 1 apaga o nome do projeto com o resto da identificação: sem
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
requisitos do equipamento em branco travam os descarregamentos do Módulo 3, como
qualquer outra questão por resolver. Só se exige o que a escolha do regime e do
equipamento tornou aplicável.

### Os encargos plurianuais

Quando a execução do contrato atravessa mais do que um ano económico, a despesa
dos anos seguintes carece de autorização prévia. A opção nos parâmetros do
procedimento abre o campo do ano de início — apenas o ano corrente ou o seguinte,
porque não se pede hoje autorização para uma despesa que só começa depois — e os
anos do pedido são esse e os dois a seguir.

**As horas passam a escrever-se ano a ano, nos lotes.** É a única alteração ao
que já se fazia: em vez de um total por perfil, três campos, um por ano
económico. O total do perfil é a soma, e é dele que sai o valor estimado como sempre
saiu — não há um número que possa discordar do outro, porque só existe um.

Um ano a zero é uma decisão, não um lapso: significa que o perfil não é
contratado nesse ano, tipicamente por estar coberto por um contrato ainda em
vigor. É o caso que motiva a repartição — lançar um plurianual de três anos em
que um perfil só entra no segundo, enquanto os restantes correm nos três. O
resumo e o documento Word levam as horas ao lado do valor de cada ano, para que
um zero se leia como o que é.

Sem a opção ligada, tudo fica exatamente como estava: um campo de horas por
perfil e a tabela do valor estimado de sempre. Com ela ligada, a tabela dos anos
**substitui** a do valor estimado — no resumo do Módulo 3 e no documento Word. Ou
uma, ou outra: dizem o mesmo valor estimado por caminhos diferentes, e apresentá-las
juntas obrigava a lê-las uma contra a outra. A tabela dos anos leva os subtotais
de cada lote, e o resumo é só de leitura, como sempre foi.

A tabela dos anos exprime-se toda com IVA, pelo que o valor estimado do procedimento
— que é elemento da peça — sai numa linha própria por baixo dela, sem IVA e com
IVA.

### A manifestação de necessidades

O ZIP do Módulo 3 leva a informação do procedimento no modelo da DAG para o
novo CCP — a manifestação de necessidades —, em Word e, com o n.º da informação
preenchido, também em PDF. Substitui o pedido de encargos plurianuais e a
manifestação anterior: a repartição por anos vai dentro dela, no Anexo I.

Segue as dez secções do modelo, com os parágrafos numerados em série, e os
anexos: I — memória descritiva e de cálculo; III — especificações técnicas, com
as regras de adjudicação dos lotes e de apuramento da experiência a fechar; IV —
os Resumos Curriculares; V e VI — as duas folhas do eAvalia. O Anexo II
(fundamentação acima de 5 M€) não é gerado: acima desse valor a informação
assinala-o a vermelho. As tabelas são as da aplicação.

O conteúdo vem do que já está escrito: os **objetivos da aquisição**, os
benefícios e os riscos do Módulo 1; os lotes, o posto de trabalho e o eAvalia do
Módulo 3. Os textos da avaliação custo-benefício (beneficiários, riscos da
execução, mitigação) e da sustentabilidade são fixos, os mesmos em todas as
manifestações desta natureza. O **júri técnico** — diretor, coordenador,
unidade e gestor de projeto — escreve-se no Módulo 3: o coordenador assina a
informação, e a unidade sai na assinatura por baixo da direção.

**Valor hora de referência.** No Módulo 3, antes dos lotes, uma tabela visível e
editável fundamenta, de forma genérica, os valores hora — sem ligação perfil a
perfil: o preço/hora de cada perfil continua a escrever-se no lote. A base é a
**rate média das propostas** dos últimos procedimentos (perfil, procedimentos,
propostas admitidas, rate do valor base, mais alta e média; a diferença da média
para o valor base calcula-se), os **valores anteriormente adjudicados** (perfil,
procedimento ou contrato, ano e valor hora adjudicado), ou **ambos**. Parte do
quadro de referência da SPMS, que se pode repor. Sai no Anexo I da manifestação
(ponto 3), com o parágrafo e a tabela da base escolhida.

**Margem prudencial.** A 0 % (por omissão), a margem considera-se incorporada nos
valores hora, e o fundamento — obrigatório — di-lo, conforme a base da tabela de
referência (rate média, valores adjudicados, ou ambos). Acima de 0 %, a margem
aplica-se ao valor hora de cada perfil, arredondado ao cêntimo, e passa a todos
os valores: perfis, lotes, anos, valor estimado, eAvalia, o resumo do Módulo 3 e a
vista geral. O JSON do agrupamento guarda os valores de referência e a margem à
parte.

### O pedido de parecer eAvalia

O Módulo 3 preenche o modelo oficial do pedido de parecer prévio
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

A folha **«Custos - Serviços»**, que o modelo traz oculta, passa a ver-se e sai
preenchida: um bloco «Recurso» por perfil em cada lote, com o tipo de serviço e
a designação do perfil escolhidos no Módulo 2 (as listas fechadas da folha
«Backup» do modelo, letra a letra), o nome do perfil como descrição, o preço/hora
e as horas de todos os elementos e de todos os anos do Módulo 3. O custo total é
a fórmula do modelo, escrita com o resultado; somados, os blocos dão o valor estimado
sem IVA. Havendo mais perfis do que os onze blocos do modelo, acrescentam-se
blocos iguais ao último, como a nota da folha pede. A informação (Word e PDF)
reproduz esta folha num anexo próprio, a seguir ao do alinhamento tecnológico.

As três respostas são de preenchimento obrigatório. Não é a aplicação a exigi-lo:
o pedido de parecer segue com elas, e uma medida por responder deixaria a célula
em branco no formulário oficial — pelo que, enquanto faltar alguma, o Módulo 3
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
despercebida. Por isso o Módulo 4, ao carregar o agrupamento, assinala cada
perfil que a exija — chamada de atenção, não verificação.

## O pedido de licenciamento

Aquisição de licenças em que **o preço é o único aspeto submetido à concorrência**: tudo o resto —
requisitos, métrica, manutenção, níveis de serviço — são termos e condições do contrato. O que se adquire
é um **produto**, que pode ser software, mas também uma terminologia como a SNOMED CT, uma norma ou um
conteúdo.

| Módulo | Quem usa | O que faz |
|---|---|---|
| **1 · Produto** | Responsável do produto | Nome, descrição, objetivos, benefícios e riscos da não aquisição, e os beneficiários da avaliação custo-benefício (com texto por omissão, editável). Os benefícios operacionais não se mostram: formam-se a partir dos benefícios do produto. Dados próprios do licenciamento: não mexem no projeto da bolsa de horas |
| **L1 · Licenças** | Responsável do produto, com a área técnica | Natureza da aquisição (e, na aberta, o convite a entidades escolhidas) e, por licença: descrição ou identificação, tipo de licenciamento, classificação eAvalia, métrica, quantidade e preço de referência (unitário ou global) |
| **L2 · Condições** | Responsável do produto | Âmbito, manutenção, suporte técnico, níveis de serviço (SLA), disponibilidade (SaaS), penalizações e prazo, mais condições próprias |
| **L3 · Pedido** | Responsável do procedimento | Lotes, encargos plurianuais, IVA e margem prudencial, júri e Anexo Técnico |

**Natureza da aquisição.** **Aberta à concorrência**: cada licença descreve-se sem marca (designação e
requisitos mínimos, funcionais e técnicos, numa só lista, linha a linha) e o concorrente identifica o
produto no mapa de preços. **Confiada a determinada entidade** (a expressão do art.º 24.º, n.º 1, alínea
e), do CCP): identifica-se a licença, o fabricante ou titular dos direitos e a versão, e fundamenta-se a
escolha (plataforma instalada, direitos exclusivos, renovação).

**Convite a entidades específicas.** Na aquisição aberta, pode dirigir-se o convite a entidades escolhidas
(consulta prévia, art.ºs 112.º a 114.º do CCP): indica-se o motivo e as entidades, linha a linha — pelo
menos três, sem repetições. No Word, sai o motivo e uma tabela com as entidades a convidar. As verificações
do art.º 113.º (limites à escolha e entidades especialmente relacionadas) ficam com a equipa de
contratação.

**Serviço associado.** Uma linha pode ser um serviço com preço próprio (suporte para adaptar a plataforma,
configuração, formação): tem designação, atividades e um preço global, no mesmo lote. Não é uma licença:
não tem direito de uso, métrica nem classificação eAvalia, e no eAvalia o valor soma-se à linha
«Instalação, configuração, atualização» da licença do mesmo lote.

**Tipo de licenciamento.** Objeto da licença (software; terminologia, norma ou conteúdo; ou outro, por
extenso), direito de uso (subscrição ou perpétuo), modalidade e manutenção. Na licença perpétua, a
manutenção pode estar incluída, não ser contratada ou ter **linha própria** no mapa de preços, com preço
anual, no mesmo procedimento e lote.

**Classificação eAvalia.** Só se escolhem o âmbito e, na prestação confiada a determinada entidade, o tipo de solução (com a
explicação de cada um). O resto não se mostra e decorre das escolhas: na aberta, «Submissão à concorrência» e consulta ao
mercado «Sim»; na confiada a determinada entidade, consulta «Não», salvo com consulta preliminar; o tipo vem do direito de uso (subscrição → «Subscrição ou
SaaS»; perpétuo → «Licenças»); o tipo de licenciamento vem da modalidade (aquisição e alargamento →
«Aquisição novas licenças»; renovação e upgrade → «Actualizações/Upgrades/Correções»). As medidas do
«Alinhamento Tecnológico» saem todas «Não aplicável».

**Métricas.** Utilizador nomeado, utilizador concorrente, unidade de volume (com a unidade concreta
escrita à mão, por exemplo «GB de armazenamento»), licença nacional e licença institucional. As duas
últimas têm sempre quantidade 1. As métricas de equipamento (dispositivo, core, instância) e o pacote
saíram: nos pedidos anteriores que as usavam, a métrica fica por escolher.

**Forma do preço.** **Preço unitário**: quantidade × preço unitário. **Preço global**: indica-se só o preço
final; a quantidade descreve a dimensão da licença («até 250 utilizadores concorrentes») e não multiplica o
preço — no mapa de preços e no eAvalia a linha tem quantidade 1, e o concorrente cota um valor único.

**Valor estimado.** Subscrição: quantidade × preço (mensal ou anual) × meses ou anos, repartido pelos meses
de cada ano a partir de janeiro do ano de início. Licença perpétua: quantidade × preço no primeiro ano,
mais a manutenção em linha própria (percentagem anual de referência sobre o valor das licenças) pelo
período. No preço global, a quantidade conta 1. Os pressupostos do cálculo, no Word, só
falam dos tipos de licença que o pedido tem, e o fundamento da margem a 0 % só nomeia as origens de preço
escolhidas (texto por omissão, editável e reponível no L3). O período vai até
36 meses (art.º 48.º do CCP); acima de 12 pede encargos plurianuais; com preço anual, só anos completos.
Cada licença tem uma origem do preço de referência, com os campos que permitem verificá-la: contrato em
vigor ou procedimento anterior (n.º, ano, preço de então), orçamento do fabricante, titular ou
distribuidor (entidade, data, referência), consulta preliminar ao mercado (data, entidades consultadas,
respostas, critério), tabela pública (ligação, data, desconto) ou contratos semelhantes no portal BASE
(ligações). Uma segunda origem, facultativa, confirma a primeira. Os preços de referência indicam-se sempre em euros **com IVA**; a
aplicação mostra o valor sem IVA à taxa do L3 (que é o que entra nos cálculos, no eAvalia e no mapa de preços) e
recalcula-o quando a taxa muda. Cada preço pode levar uma nota facultativa. No Word,
as origens saem num quadro (licença, origem, referência, data), seguido das notas aos preços. A consulta ao mercado do eAvalia é «Sim»
na aquisição aberta e sempre que o preço venha de uma consulta preliminar.

**Condições.** Os textos por omissão acompanham as licenças do L1 (software, terminologia, subscrição,
perpétua, licença nacional) enquanto não forem alterados à mão. As que não se aplicam ficam assinaladas:
a disponibilidade só existe no software em subscrição; os ambientes de teste sem custo, só no software. As penalizações são facultativas e vêm
desligadas: podem ficar para a formulação do contrato; a penalização por hora de atraso aplica-se ao
primeiro nível de serviço. O suporte técnico tem o texto e o horário; os **níveis de serviço (SLA)** são um
bloco à parte, facultativo (ligado por omissão, e só com suporte), numa tabela editável — nível,
descrição, tempos máximos de resposta e de resolução —, com três níveis por omissão (crítica, alta,
normal), que se podem alterar, acrescentar ou retirar. Já não há entregáveis nem entidades abrangidas:
o que for preciso escreve-se nas condições próprias. O horário de suporte é dias úteis, 7 dias por
semana ou personalizado, com as horas editáveis (das 00:00 às 23:59 é o dia inteiro).

**O Anexo Técnico (ZIP)** leva a manifestação de necessidades no modelo da DAG (Word e, com o n.º da
informação e o n.º de orçamento, PDF), o pedido eAvalia com a folha **«Custos - Licenciamento»** preenchida
(«Custos - Serviços» fica como o modelo a traz), um **mapa de quantidades e preços** em Excel por lote e o
JSON do pedido. O pedido fica guardado neste navegador (`propostas.v2.licenciamento`); um pedido da versão
anterior é convertido ao abrir. A ordenação das propostas de licenciamento e as vistas gerais ainda não o
leem.

## As vistas gerais e os cenários de corte

A **Vista Geral da Unidade** junta os JSON de lotes dos projetos de uma unidade: pessoas, valores por
ano e o peso de cada projeto. Tem duas leituras:

- **Orçamento** — os projetos tal como foram agrupados, com os elementos internos registados à mão.
- **Cenários de corte** — variações do orçamento, que nunca o alteram. Em cada cenário retiram-se
  pessoas inteiras, linha a linha (− / +), ou um projeto inteiro, e pode alterar-se o valor hora (sem
  IVA) de cada perfil; o valor de cada linha acompanha as pessoas que ficam e o novo valor hora, com as
  mesmas horas e o mesmo IVA. Os elementos internos não se cortam, mas podem passar para outro projeto. O cenário mostra pessoas e valores por ano ao lado dos do orçamento, com a diferença.

Cada cenário guarda só os cortes, ligados ao nome do projeto, ao lote e ao perfil, e não aos
identificadores internos das linhas: reimportar um projeto corrigido mantém os cortes. O que deixar de
ter onde se aplicar é assinalado. Os cenários viajam no JSON da Vista Geral, e o Excel leva uma folha
«Comparação» e o detalhe de cada cenário.

Na **Vista Geral da Direção**, cada unidade que traga cenários pode entrar com um deles em vez do
orçamento; totais, tabelas e ficheiros passam a usá-lo, sem as linhas que ficaram sem ninguém.

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

O trabalho de configuração — o catálogo de perfis (Módulo 2) e o agrupamento de lotes
(Módulo 3) — é guardado no `localStorage` do navegador e reaparece na sessão seguinte.

As declarações carregadas no Módulo 4, o apuramento que delas resulta e os preços
indicados no Módulo 5 **nunca** são guardados: contêm dados pessoais de candidatos
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
- `src/licenciamento/` — interface do pedido de licenciamento (L1, L2, L3); o núcleo está em
  `src/core/licenciamento.ts`, a folha eAvalia em `src/excel/custosLicenciamento.ts`, os mapas de
  preços em `src/excel/mapaPrecos.ts` e a manifestação em `src/word/manifestacaoLicenciamento.ts`.
- `src/ui/` — componentes partilhados.

## Implantação (GitHub Pages)

O workflow `.github/workflows/deploy-pages.yml` compila e publica a pasta `dist/` no
GitHub Pages a cada push para `main` ou `claude/app-development-3g3pv9` (ou manualmente,
via "Run workflow" no separador Actions). Os caminhos de build são relativos
(`base: './'`), pelo que o mesmo `dist/` também funciona aberto localmente a partir do disco.
