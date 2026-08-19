# Propostas

Ferramenta interna para (1) definir requisitos mínimos de experiência de um lote/perfil e
gerar o formulário de declaração a entregar aos concorrentes, e (2) avaliar automaticamente
as declarações recebidas quanto ao cumprimento desses mínimos.

Aplicação 100% cliente: sem backend, sem chamadas de rede, sem persistência de dados entre
sessões. Ficheiros de propostas em avaliação nunca saem do posto de trabalho.

## Desenvolvimento

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm test         # testes do núcleo de cálculo (Vitest)
npm run build    # build de produção (pasta dist/)
```

## Estrutura

- `src/core/` — núcleo de cálculo puro (Regra A), validação e tipos partilhados.
- `src/excel/` — geração (exceljs) e leitura (SheetJS) de ficheiros Excel.
- `src/pdf/` — comparador PDF ↔ Excel (pdf.js).
- `src/modulo1/` — UI de definição de requisitos.
- `src/modulo2/` — UI de avaliação de declarações.

## Fases de implementação

1. Núcleo de cálculo (Regra A) + parser Excel — concluída.
2. Módulo 1 — definição de requisitos — concluída.
3. Módulo 2 — avaliação — concluída.
4. Comparador PDF ↔ Excel — concluída.

## Implantação (GitHub Pages)

O workflow `.github/workflows/deploy-pages.yml` compila e publica a pasta `dist/` no
GitHub Pages a cada push para `main` ou `claude/app-development-3g3pv9` (ou manualmente,
via "Run workflow" no separador Actions). Os caminhos de build são relativos
(`base: './'`), pelo que o mesmo `dist/` também funciona aberto localmente a partir do
disco.
