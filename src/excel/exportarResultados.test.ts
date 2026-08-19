import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { apurarEAgregar } from "../core/agregacao";
import { configAvaliacao, declaracao } from "../core/fixtures";
import { gerarWorkbookResultados } from "./exportarResultados";

function resultados() {
  return apurarEAgregar([declaracao({ identificacao: { nome: "Ana" } as never })], configAvaliacao(), []);
}

describe("gerarWorkbookResultados", () => {
  it("gera as 5 folhas com os nomes esperados", () => {
    const wb = gerarWorkbookResultados(resultados(), configAvaliacao());

    expect(wb.SheetNames).toEqual([
      "Resumo por concorrente",
      "Resumo por elemento",
      "Detalhe elemento x requisito",
      "Traço de apuramento",
      "Alertas",
    ]);
  });

  it("a folha de resumo por concorrente reflete o apuramento", () => {
    const wb = gerarWorkbookResultados(resultados(), configAvaliacao());
    const linhas = XLSX.utils.sheet_to_json(wb.Sheets["Resumo por concorrente"], { header: 1 }) as unknown[][];

    expect(linhas[0]).toEqual([
      "Concorrente",
      "N.º de elementos",
      "N.º mínimo suficiente?",
      "Cumpre",
      "N.º de alertas",
    ]);
    expect(linhas[1]).toEqual(["ABC, Lda.", 1, "Sim", "Cumpre", 0]);
  });

  it("a folha de traço de apuramento lista os períodos considerados", () => {
    const wb = gerarWorkbookResultados(resultados(), configAvaliacao());
    const linhas = XLSX.utils.sheet_to_json(wb.Sheets["Traço de apuramento"], { header: 1 }) as unknown[][];

    expect(linhas).toHaveLength(2); // cabeçalho + 1 período admitido
    expect(linhas[1][4]).toBe("Considerado");
  });
});
