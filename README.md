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

### O posto de trabalho

O documento Word leva uma secção com as condições de execução, em tabela e só
com o que ficou escolhido: as opções ponderadas e postas de lado ficam no
rascunho, não no documento que vincula.

O regime vem primeiro porque comanda o resto: em regime remoto não há local a
indicar, e a linha do local nem chega a existir. O mesmo vale para os requisitos
do equipamento, que só saem quando o equipamento é do prestador — é a ele que se
exigem.

### O pedido de parecer eAvalia

O Módulo 2 preenche o modelo oficial do pedido de parecer prévio
(`src/excel/modelos/`), que é ficheiro de terceiros: sai como entrou, com sete
células escritas — o nome do projeto no objeto da aquisição, três respostas de
alinhamento tecnológico e as datas que as acompanham. As restantes medidas vão
como já vêm no modelo.

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
