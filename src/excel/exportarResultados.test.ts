import { describe, expect, it } from "vitest";
import type ExcelJS from "exceljs";
import { construirWorkbookResultados } from "./exportarResultados";
import { avaliarProcedimento } from "../core/avaliacaoProcedimento";
import { LOTES_EXEMPLO, declaracoesExemplo } from "../core/exemplo";
import { proporAgrupamentos } from "../core/reconciliacao";
import { chavePreco, ordenarPropostas } from "../core/ordenacao";

function resultadoDoExemplo() {
  const declaracoes = declaracoesExemplo(LOTES_EXEMPLO);
  const grupos = proporAgrupamentos(declaracoes.map((d) => d.declaracao.identificacao.entidadeConcorrente));
  return avaliarProcedimento(LOTES_EXEMPLO, declaracoes, grupos);
}

/** O cabeçalho de uma folha de dados está sempre na linha 4 — ver `estilo.ts`. */
const LINHA_CABECALHO = 4;

function folha(wb: ExcelJS.Workbook, nome: string): ExcelJS.Worksheet {
  const encontrada = wb.getWorksheet(nome);
  if (encontrada === undefined) throw new Error(`Folha "${nome}" inexistente.`);
  return encontrada;
}

function cabecalho(wb: ExcelJS.Workbook, nome: string): string[] {
  const valores = folha(wb, nome).getRow(LINHA_CABECALHO).values as unknown[];
  return valores.slice(1).map((v) => String(v ?? ""));
}

function corpo(wb: ExcelJS.Workbook, nome: string): unknown[][] {
  const sheet = folha(wb, nome);
  const linhas: unknown[][] = [];
  for (let i = LINHA_CABECALHO + 1; i <= sheet.rowCount; i++) {
    linhas.push((sheet.getRow(i).values as unknown[]).slice(1));
  }
  return linhas;
}

describe("construirWorkbookResultados", () => {
  const wb = construirWorkbookResultados(resultadoDoExemplo(), LOTES_EXEMPLO);
  const nomes = wb.worksheets.map((s) => s.name);

  it("traz as folhas agregadas, as desagregadas e uma folha por concorrente", () => {
    expect(nomes).toEqual([
      "Procedimento",
      "Resumo por lote",
      "Elementos",
      "Requisitos",
      "Alertas",
      "Traço de apuramento",
      "Alfa Sistemas, S.A.",
      "Beta Consultores, Lda.",
    ]);
  });

  it("resume uma linha por lote e concorrente", () => {
    expect(cabecalho(wb, "Resumo por lote")).toContain("Situação");
    // Dois lotes, dois concorrentes em cada.
    expect(corpo(wb, "Resumo por lote")).toHaveLength(4);
  });

  it("desagrega os meses apurados por requisito de cada elemento", () => {
    expect(cabecalho(wb, "Requisitos")).toContain("Meses apurados");
    const linhas = corpo(wb, "Requisitos");
    expect(linhas.length).toBeGreaterThan(0);
    expect(linhas.every((l) => typeof l[5] === "number")).toBe(true);
  });

  it("deixa o traço de apuramento reconstituível, com períodos admitidos", () => {
    expect(corpo(wb, "Traço de apuramento").some((l) => l[6] === "Admitido")).toBe(true);
  });

  it("dá a cada concorrente uma folha só com os perfis da sua proposta", () => {
    const sheet = folha(wb, "Alfa Sistemas, S.A.");

    expect(sheet.getCell(2, 1).value).toBe("Alfa Sistemas, S.A.");
    expect(cabecalho(wb, "Alfa Sistemas, S.A.")).toContain("N.º mínimo exigido");
    // Os quatro perfis dos dois lotes a que a Alfa se apresentou.
    expect(corpo(wb, "Alfa Sistemas, S.A.")).toHaveLength(4);
  });

  it("regista na capa se a limitação de um lote por concorrente está ativa", () => {
    const capa = folha(wb, "Procedimento");
    const linha = [1, 2, 3, 4, 5, 6, 7, 8].find((i) => capa.getCell(i, 1).value === "Um lote por concorrente");

    expect(linha).toBeDefined();
    expect(capa.getCell(linha!, 2).value).toBe("Sim");
  });
});

describe("formatação do relatório", () => {
  const wb = construirWorkbookResultados(resultadoDoExemplo(), LOTES_EXEMPLO);

  it("cada folha de dados tem título, cabeçalho fixo e filtro", () => {
    const sheet = folha(wb, "Resumo por lote");

    expect(String(sheet.getCell(1, 1).value)).toBe("RESUMO POR LOTE E CONCORRENTE");
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: LINHA_CABECALHO });
    expect(sheet.autoFilter).toBeDefined();
  });

  it("o cabeçalho vem no azul do formulário, a branco e a negrito", () => {
    const cell = folha(wb, "Resumo por lote").getCell(LINHA_CABECALHO, 1);

    expect(cell.font).toMatchObject({ bold: true, color: { argb: "FFFFFFFF" } });
    expect(cell.fill).toMatchObject({ fgColor: { argb: "FF2E75B6" } });
  });

  it("as colunas têm largura definida, para nada sair cortado", () => {
    const sheet = folha(wb, "Requisitos");
    for (let i = 1; i <= 9; i++) expect(sheet.getColumn(i).width).toBeGreaterThan(0);
  });

  it("quem não cumpre fica marcado a vermelho, e quem cumpre a verde", () => {
    const sheet = folha(wb, "Resumo por lote");
    const situacoes = corpo(wb, "Resumo por lote").map((l, idx) => ({
      texto: String(l[3]),
      cor: (sheet.getCell(LINHA_CABECALHO + 1 + idx, 4).font ?? {}).color?.argb,
    }));

    expect(situacoes.find((s) => s.texto === "Sim")?.cor).toBe("FF1B6E3C");
    expect(situacoes.find((s) => s.texto === "Não")?.cor).toBe("FFB3261E");
  });
});

describe("relatório com a ordenação do Módulo 4", () => {
  const resultado = resultadoDoExemplo();

  function comOrdenacao() {
    const precos: Record<string, number> = {};
    for (const lote of resultado.lotes) {
      lote.concorrentes
        .filter((c) => c.admitido)
        .forEach((c, idx) => {
          precos[chavePreco(lote.loteId, c.concorrente)] = 100 + idx * 10;
        });
    }
    return construirWorkbookResultados(resultado, LOTES_EXEMPLO, ordenarPropostas(resultado, precos));
  }

  it("sem ordenação, o relatório é o do Módulo 3", () => {
    const nomes = construirWorkbookResultados(resultado, LOTES_EXEMPLO).worksheets.map((s) => s.name);
    expect(nomes).not.toContain("Ordenação por lote");
    expect(nomes).not.toContain("Vencedores");
  });

  it("com ordenação, acrescenta as folhas da ordenação e dos vencedores", () => {
    const nomes = comOrdenacao().worksheets.map((s) => s.name);

    expect(nomes).toContain("Ordenação por lote");
    expect(nomes).toContain("Vencedores");
    // As folhas do Módulo 3 continuam todas lá.
    expect(nomes).toContain("Traço de apuramento");
    expect(nomes).toContain("Alfa Sistemas, S.A.");
  });

  it("a folha dos vencedores traz um lote por linha", () => {
    const wb = comOrdenacao();
    expect(cabecalho(wb, "Vencedores")).toContain("Preço proposto (s/ IVA)");
    // Uma linha por lote. A nota da regra vem depois, e não é uma linha de dados.
    const numerosDeLote = corpo(wb, "Vencedores").map((l) => String(l[0]));
    expect(numerosDeLote.filter((n) => n === "1" || n === "2")).toEqual(["1", "2"]);
  });

  it("a regra de um lote por concorrente sai por extenso na folha", () => {
    const texto = corpo(comOrdenacao(), "Vencedores")
      .flat()
      .map((c) => String(c ?? ""))
      .join(" ");
    expect(texto).toContain("ordem crescente do número");
  });

  it("os preços saem formatados como euros", () => {
    const sheet = folha(comOrdenacao(), "Ordenação por lote");
    expect(sheet.getCell(LINHA_CABECALHO + 1, 5).numFmt).toContain("€");
  });
});
