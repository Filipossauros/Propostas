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

  it("traz as folhas agregadas, as desagregadas e uma folha de perfis por concorrente", () => {
    expect(wb.SheetNames).toEqual([
      "Procedimento",
      "Resumo por lote",
      "Elementos",
      "Requisitos",
      "Alertas",
      "Alfa Sistemas, S.A.",
      "Beta Consultores, Lda.",
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

  it("dá a cada concorrente uma folha só com os perfis da sua proposta", () => {
    const [identificacao, , cabecalho, ...corpo] = linhas(wb, "Alfa Sistemas, S.A.");

    expect(identificacao).toEqual(["Concorrente", "Alfa Sistemas, S.A."]);
    expect(cabecalho).toContain("N.º mínimo exigido");
    // Os quatro perfis dos dois lotes a que a Alfa se apresentou.
    expect(corpo).toHaveLength(4);
    expect(corpo.every((l) => l[2] !== "")).toBe(true);
  });

  it("regista na capa se a limitação de um lote por concorrente está ativa", () => {
    const capa = linhas(wb, "Procedimento");
    expect(capa.find((l) => l[0] === "Um lote por concorrente")?.[1]).toBe("Sim");
  });
});
