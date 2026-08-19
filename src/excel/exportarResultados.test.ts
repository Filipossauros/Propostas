import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { apurarEAgregar } from "../core/agregacao";
import type { Bloco, ConfiguracaoJSON, Declaracao, LinhaRequisito, MesAno } from "../core/types";
import { gerarWorkbookResultados } from "./exportarResultados";

function ma(ano: number, mes: number): MesAno {
  return { ano, mes };
}

function config(): ConfiguracaoJSON {
  return {
    schemaVersion: "1.0",
    templateVersion: "5.0",
    procedimento: "20270001",
    lote: "1",
    perfil: "Perfil Teste",
    nMinimoElementos: 1,
    dataLimitePropostas: "2027-03-31",
    nBlocos: 1,
    requisitos: [{ id: "r1", designacao: "Requisito 1", versaoMinima: null, mesesMinimos: 12 }],
  };
}

function linha(opts: Partial<LinhaRequisito> = {}): LinhaRequisito {
  return { requisitoId: "r1", declara: "SIM", inicio: null, fim: null, ...opts };
}

function bloco(opts: Partial<Bloco> = {}): Bloco {
  return {
    indice: 1,
    cliente: "ACME",
    projeto: "Projeto",
    funcao: "Função",
    projInicio: ma(2020, 1),
    projFim: ma(2020, 12),
    emCurso: null,
    linhas: [linha()],
    ...opts,
  };
}

function declaracao(): Declaracao {
  return {
    ficheiro: "ana.xlsx",
    identificacao: { nome: "Ana", documento: "1", entidadeConcorrente: "ABC", procedimento: "20270001", lote: "1", perfil: "Perfil Teste" },
    blocos: [bloco()],
    alertas: [],
  };
}

describe("gerarWorkbookResultados", () => {
  it("gera as 5 folhas com os nomes esperados", () => {
    const resultados = apurarEAgregar([declaracao()], config(), []);
    const wb = gerarWorkbookResultados(resultados, config());
    expect(wb.SheetNames).toEqual([
      "Resumo por concorrente",
      "Resumo por elemento",
      "Detalhe elemento x requisito",
      "Traço de apuramento",
      "Alertas",
    ]);
  });

  it("a folha de resumo por concorrente reflete o apuramento", () => {
    const resultados = apurarEAgregar([declaracao()], config(), []);
    const wb = gerarWorkbookResultados(resultados, config());
    const linhas = XLSX.utils.sheet_to_json(wb.Sheets["Resumo por concorrente"], { header: 1 }) as unknown[][];
    expect(linhas[0]).toEqual(["Concorrente", "N.º de elementos", "N.º mínimo suficiente?", "Cumpre", "N.º de alertas"]);
    expect(linhas[1]).toEqual(["ABC", 1, "Sim", "Cumpre", 0]);
  });

  it("a folha de traço de apuramento lista os períodos considerados", () => {
    const resultados = apurarEAgregar([declaracao()], config(), []);
    const wb = gerarWorkbookResultados(resultados, config());
    const linhas = XLSX.utils.sheet_to_json(wb.Sheets["Traço de apuramento"], { header: 1 }) as unknown[][];
    expect(linhas).toHaveLength(2); // cabeçalho + 1 período admitido
    expect(linhas[1][4]).toBe("Considerado");
  });
});
