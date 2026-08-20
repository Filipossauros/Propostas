import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { construirWorkbookResultados } from "./exportarResultados";
import { avaliarProcedimento } from "../core/avaliacaoProcedimento";
import { LOTES_EXEMPLO, declaracoesExemplo } from "../core/exemplo";
import { proporAgrupamentos } from "../core/reconciliacao";

function resultadoDoExemplo() {
  const declaracoes = declaracoesExemplo(LOTES_EXEMPLO);
  const grupos = proporAgrupamentos(declaracoes.map((d) => d.declaracao.identificacao.entidadeConcorrente));
  return avaliarProcedimento(LOTES_EXEMPLO, declaracoes, grupos);
}

function linhas(wb: XLSX.WorkBook, folha: string): unknown[][] {
  return XLSX.utils.sheet_to_json(wb.Sheets[folha], { header: 1 }) as unknown[][];
}

describe("construirWorkbookResultados", () => {
  const wb = construirWorkbookResultados(resultadoDoExemplo(), LOTES_EXEMPLO);

  it("traz as folhas agregadas e as desagregadas", () => {
    expect(wb.SheetNames).toEqual([
      "Procedimento",
      "Resumo por lote",
      "Perfis",
      "Elementos",
      "Requisitos",
      "Alertas",
      "Traço de apuramento",
    ]);
  });

  it("resume uma linha por lote e concorrente", () => {
    const [cabecalho, ...corpo] = linhas(wb, "Resumo por lote");
    expect(cabecalho).toContain("Situação");
    // Dois lotes, dois concorrentes em cada.
    expect(corpo).toHaveLength(4);
  });

  it("desagrega os meses apurados por requisito de cada elemento", () => {
    const [cabecalho, ...corpo] = linhas(wb, "Requisitos");
    expect(cabecalho).toContain("Meses apurados");
    expect(corpo.length).toBeGreaterThan(0);
    expect(corpo.every((l) => typeof l[5] === "number")).toBe(true);
  });

  it("deixa o traço de apuramento reconstituível, com períodos admitidos", () => {
    const [, ...corpo] = linhas(wb, "Traço de apuramento");
    expect(corpo.some((l) => l[6] === "Admitido")).toBe(true);
  });

  it("regista na capa se a limitação de um lote por concorrente está ativa", () => {
    const capa = linhas(wb, "Procedimento");
    expect(capa.find((l) => l[0] === "Um lote por concorrente")?.[1]).toBe("Sim");
  });
});
