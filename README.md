# Propostas

Ferramenta interna para preparar e avaliar a componente de experiência profissional de um
procedimento de contratação pública com o preço como critério único.

Aplicação 100% cliente: sem backend e sem qualquer chamada de rede. Os ficheiros de propostas
em avaliação nunca saem do posto de trabalho.

## Os três módulos

O fluxo acompanha três papéis distintos, que raramente são a mesma pessoa:

| Módulo | Quem usa | O que faz | Saídas |
|---|---|---|---|
| **1 · Perfil** | Elemento técnico | Define os requisitos mínimos de experiência de um perfil | Formulário Excel, JSON do perfil, texto para o caderno de encargos |
| **2 · Lotes** | Responsável do procedimento | Agrupa perfis em lotes e atribui horas, preço/hora e n.º mínimo de elementos | Excel (tabela + requisitos + texto), JSON do agrupamento, formulário por perfil |
| **3 · Avaliação** | Júri | Apura o cumprimento dos requisitos nas declarações recebidas | Relatório Excel de 5 folhas, incluindo o traço de apuramento |

Quem define o perfil não sabe ainda o número do procedimento nem como os lotes serão
agrupados — por isso nem o Módulo 1 nem o Módulo 2 os pedem, e o formulário gerado não
contém qualquer campo de lote. O número do procedimento aparece apenas como campo de
identificação que o próprio candidato preenche ao entregar a declaração.

No fim do Módulo 1 pode enviar o perfil diretamente para o Módulo 2, sem passar por
ficheiro. A importação por ficheiro continua disponível no Módulo 2, para quando o
agrupamento é feito por outra pessoa ou noutro momento.

## Experimentar

Cada módulo tem um botão **Carregar exemplo** que preenche tudo com dados realistas.
Os mesmos dados estão em `exemplos/` como ficheiros JSON:

- `exemplos/perfil-exemplo.json` — um perfil, para o Módulo 1.
- `exemplos/lotes-exemplo.json` — dois lotes com quatro perfis, para os Módulos 2 e 3.

São gerados a partir de `src/core/exemplo.ts` (fonte única) com `npm run exemplos`.

### Preço base

O preço base de cada perfil dentro de um lote é `horas × preço unitário/hora`. O n.º mínimo
de elementos **não** multiplica esse valor: é uma condição de admissibilidade da proposta
(quantos currículos o concorrente tem de apresentar), não uma quantidade contratada.

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

O trabalho de configuração — o perfil em edição (Módulo 1) e o agrupamento de lotes
(Módulo 2) — é guardado no `localStorage` do navegador e reaparece na sessão seguinte.

As declarações carregadas no Módulo 3 **nunca** são guardadas: contêm dados pessoais de
candidatos e vivem apenas em memória, desaparecendo ao fechar o separador.

## Desenvolvimento

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm test         # testes do núcleo de cálculo (Vitest)
npm run build    # build de produção (pasta dist/)
```

### Estrutura

- `src/core/` — núcleo de cálculo puro (Regra A), perfis, lotes, validação e agregação.
- `src/excel/` — geração (exceljs) e leitura (SheetJS) de ficheiros Excel.
- `src/pdf/` — comparador PDF ↔ Excel (pdf.js).
- `src/modulo1/`, `src/modulo2/`, `src/modulo3/` — interface de cada módulo.
- `src/ui/` — componentes partilhados.

## Implantação (GitHub Pages)

O workflow `.github/workflows/deploy-pages.yml` compila e publica a pasta `dist/` no
GitHub Pages a cada push para `main` ou `claude/app-development-3g3pv9` (ou manualmente,
via "Run workflow" no separador Actions). Os caminhos de build são relativos
(`base: './'`), pelo que o mesmo `dist/` também funciona aberto localmente a partir do disco.
