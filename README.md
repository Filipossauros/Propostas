# Propostas

Ferramenta interna para preparar e avaliar a componente de experiência profissional de um
procedimento de contratação pública com o preço como critério único.

Aplicação 100% cliente: sem backend e sem qualquer chamada de rede. Os ficheiros de propostas
em avaliação nunca saem do posto de trabalho.

## Os três módulos

O fluxo acompanha três papéis distintos, que raramente são a mesma pessoa:

| Módulo | Quem usa | O que faz | Saídas |
|---|---|---|---|
| **1 · Perfis** | Elemento técnico | Define os requisitos mínimos de experiência de cada perfil | Formulário Excel (uma folha por perfil), JSON com todos os perfis |
| **2 · Lotes** | Responsável do procedimento | Agrupa perfis em lotes e atribui horas, preço/hora e n.º mínimo de elementos | Documento Word, JSON do agrupamento, formulários de declaração (um Excel por lote) |
| **3 · Avaliação** | Júri | Apura o cumprimento dos requisitos nas declarações recebidas | Relatório Excel de 5 folhas, incluindo o traço de apuramento |

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
