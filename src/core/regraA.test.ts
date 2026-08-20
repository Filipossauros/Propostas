import { describe, expect, it } from "vitest";
import { apurarRequisito, contarMesesInclusive, paraMesInt } from "./regraA";
import type { Bloco, LinhaRequisito, MesAno, Requisito } from "./types";

/** Teto usado na maioria dos testes: distante, para não interferir com o que se está a medir. */
const dataLimitePadrao: MesAno = { ano: 2099, mes: 12 };

function ma(ano: number, mes: number): MesAno {
  return { ano, mes };
}

function requisito(id = "r1", mesesMinimos = 0): Requisito {
  return { id, designacao: `Requisito ${id}`, mesesMinimos };
}

function linha(
  requisitoId: string,
  opts: {
    declara?: LinhaRequisito["declara"];
    inicio?: MesAno | null;
    fim?: MesAno | null;
    inicioIncompleto?: boolean;
    fimIncompleto?: boolean;
  } = {},
): LinhaRequisito {
  return {
    requisitoId,
    declara: "declara" in opts ? opts.declara! : "SIM",
    inicio: opts.inicio ?? null,
    fim: opts.fim ?? null,
    inicioIncompleto: opts.inicioIncompleto ?? false,
    fimIncompleto: opts.fimIncompleto ?? false,
  };
}

function bloco(
  indice: number,
  opts: {
    cliente?: string;
    projeto?: string;
    funcao?: string;
    projInicio?: MesAno | null;
    projFim?: MesAno | null;
    linhas: LinhaRequisito[];
  },
): Bloco {
  return {
    indice,
    cliente: opts.cliente ?? "Cliente Teste",
    projeto: opts.projeto ?? "Projeto Teste",
    funcao: opts.funcao ?? "Função Teste",
    projInicio: opts.projInicio ?? null,
    projFim: opts.projFim ?? null,
    linhas: opts.linhas,
  };
}

describe("contarMesesInclusive", () => {
  it("conta os dois extremos", () => {
    expect(contarMesesInclusive(paraMesInt(ma(2021, 3)), paraMesInt(ma(2023, 9)))).toBe(31);
  });
});

describe("Regra A — casos de teste obrigatórios", () => {
  it("1. 03/2021–09/2023 = 31 meses", () => {
    const b = bloco(1, {
      projInicio: ma(2021, 3),
      projFim: ma(2023, 9),
      linhas: [linha("r1")],
    });
    const resultado = apurarRequisito([b], requisito("r1", 31), dataLimitePadrao);
    expect(resultado.mesesApurados).toBe(31);
    expect(resultado.cumpre).toBe(true);
  });

  it("2. 03/2021–03/2021 = 1 mês", () => {
    const b = bloco(1, {
      projInicio: ma(2021, 3),
      projFim: ma(2021, 3),
      linhas: [linha("r1")],
    });
    const resultado = apurarRequisito([b], requisito("r1", 1), dataLimitePadrao);
    expect(resultado.mesesApurados).toBe(1);
  });

  it("3. dois blocos, mesmo requisito, sobreposição: 01/2024–12/2025 + 06/2025–12/2025 = 24 meses", () => {
    const b1 = bloco(1, { projInicio: ma(2024, 1), projFim: ma(2025, 12), linhas: [linha("r1")] });
    const b2 = bloco(2, { projInicio: ma(2025, 6), projFim: ma(2025, 12), linhas: [linha("r1")] });
    const resultado = apurarRequisito([b1, b2], requisito("r1", 0), dataLimitePadrao);
    expect(resultado.mesesApurados).toBe(24);
  });

  it("4. dois requisitos no mesmo bloco 01/2024–12/2025 = 24 meses cada", () => {
    const b = bloco(1, {
      projInicio: ma(2024, 1),
      projFim: ma(2025, 12),
      linhas: [linha("r1"), linha("r2")],
    });
    const r1 = apurarRequisito([b], requisito("r1", 0), dataLimitePadrao);
    const r2 = apurarRequisito([b], requisito("r2", 0), dataLimitePadrao);
    expect(r1.mesesApurados).toBe(24);
    expect(r2.mesesApurados).toBe(24);
  });

  it("5. linha sem datas, projeto 01/2020–12/2022 = 36 meses", () => {
    const b = bloco(1, {
      projInicio: ma(2020, 1),
      projFim: ma(2022, 12),
      linhas: [linha("r1")],
    });
    const resultado = apurarRequisito([b], requisito("r1", 0), dataLimitePadrao);
    expect(resultado.mesesApurados).toBe(36);
    expect(resultado.periodosDescartados).toHaveLength(0);
  });

  it("6. linha 01/2023–12/2023 dentro de projeto 01/2020–12/2023 = 12 meses", () => {
    const b = bloco(1, {
      projInicio: ma(2020, 1),
      projFim: ma(2023, 12),
      linhas: [linha("r1", { inicio: ma(2023, 1), fim: ma(2023, 12) })],
    });
    const resultado = apurarRequisito([b], requisito("r1", 0), dataLimitePadrao);
    expect(resultado.mesesApurados).toBe(12);
  });

  it("7. linha 01/2019–12/2019 em projeto 01/2020–12/2023 = 0 meses + alerta (fora do período)", () => {
    const b = bloco(1, {
      projInicio: ma(2020, 1),
      projFim: ma(2023, 12),
      linhas: [linha("r1", { inicio: ma(2019, 1), fim: ma(2019, 12) })],
    });
    const resultado = apurarRequisito([b], requisito("r1", 0), dataLimitePadrao);
    expect(resultado.mesesApurados).toBe(0);
    expect(resultado.periodosDescartados).toHaveLength(1);
    expect(resultado.periodosDescartados[0].motivo).toMatch(/fora do período/i);
  });

  it("8. projeto \"em curso\" declarado com o mês/ano do preenchimento como fim (01/2026–03/2027, data limite 31/03/2027) = 15 meses", () => {
    // Não existe campo "em curso": o disclaimer do formulário instrui a
    // colocar o mês/ano de preenchimento como fim do projeto.
    const dataLimite = ma(2027, 3);
    const b = bloco(1, {
      projInicio: ma(2026, 1),
      projFim: ma(2027, 3),
      linhas: [linha("r1")],
    });
    const resultado = apurarRequisito([b], requisito("r1", 0), dataLimite);
    expect(resultado.mesesApurados).toBe(15);
  });

  it("9. intervalos disjuntos 01/2020–06/2020 + 01/2022–06/2022 = 12 meses", () => {
    const b1 = bloco(1, { projInicio: ma(2020, 1), projFim: ma(2020, 6), linhas: [linha("r1")] });
    const b2 = bloco(2, { projInicio: ma(2022, 1), projFim: ma(2022, 6), linhas: [linha("r1")] });
    const resultado = apurarRequisito([b1, b2], requisito("r1", 0), dataLimitePadrao);
    expect(resultado.mesesApurados).toBe(12);
  });

  it("10. início posterior ao fim = 0 meses + alerta", () => {
    const b = bloco(1, {
      projInicio: ma(2023, 12),
      projFim: ma(2023, 1),
      linhas: [linha("r1")],
    });
    const resultado = apurarRequisito([b], requisito("r1", 0), dataLimitePadrao);
    expect(resultado.mesesApurados).toBe(0);
    expect(resultado.periodosDescartados).toHaveLength(1);
    expect(resultado.periodosDescartados[0].motivo).toMatch(/posterior ao fim/i);
  });
});

describe("Regra A — comportamentos adicionais", () => {
  it("linhas com declara = NÃO são ignoradas no cálculo", () => {
    const b = bloco(1, {
      projInicio: ma(2020, 1),
      projFim: ma(2020, 12),
      linhas: [linha("r1", { declara: "NÃO" })],
    });
    const resultado = apurarRequisito([b], requisito("r1", 0), dataLimitePadrao);
    expect(resultado.mesesApurados).toBe(0);
    expect(resultado.periodosDescartados).toHaveLength(0);
    expect(resultado.periodosAdmitidos).toHaveLength(0);
  });

  it("linhas com declara em branco são ignoradas no cálculo (mas geram alerta noutro nível)", () => {
    const b = bloco(1, {
      projInicio: ma(2020, 1),
      projFim: ma(2020, 12),
      linhas: [linha("r1", { declara: null })],
    });
    const resultado = apurarRequisito([b], requisito("r1", 0), dataLimitePadrao);
    expect(resultado.mesesApurados).toBe(0);
  });

  it("cumpre compara mesesApurados >= mesesMinimos", () => {
    const b = bloco(1, { projInicio: ma(2020, 1), projFim: ma(2020, 12), linhas: [linha("r1")] });
    expect(apurarRequisito([b], requisito("r1", 12), dataLimitePadrao).cumpre).toBe(true);
    expect(apurarRequisito([b], requisito("r1", 13), dataLimitePadrao).cumpre).toBe(false);
  });
});

describe("Regra A — bloco de projeto incompleto anula a experiência declarada", () => {
  it("cliente/entidade em falta descarta a linha, mesmo com datas coerentes", () => {
    const b = bloco(1, { cliente: "", projInicio: ma(2020, 1), projFim: ma(2020, 12), linhas: [linha("r1")] });
    const resultado = apurarRequisito([b], requisito("r1", 0), dataLimitePadrao);
    expect(resultado.mesesApurados).toBe(0);
    expect(resultado.periodosDescartados[0].motivo).toMatch(/incompleto/i);
  });

  it("projeto ou função em falta descarta a linha", () => {
    const semProjeto = bloco(1, { projeto: "", projInicio: ma(2020, 1), projFim: ma(2020, 12), linhas: [linha("r1")] });
    const semFuncao = bloco(2, { funcao: "", projInicio: ma(2020, 1), projFim: ma(2020, 12), linhas: [linha("r2")] });
    expect(apurarRequisito([semProjeto], requisito("r1", 0), dataLimitePadrao).mesesApurados).toBe(0);
    expect(apurarRequisito([semFuncao], requisito("r2", 0), dataLimitePadrao).mesesApurados).toBe(0);
  });

  it("datas do projeto em falta descartam a linha, ainda que a linha tenha datas próprias", () => {
    const b = bloco(1, {
      projInicio: null,
      projFim: null,
      linhas: [linha("r1", { inicio: ma(2020, 1), fim: ma(2020, 12) })],
    });
    const resultado = apurarRequisito([b], requisito("r1", 0), dataLimitePadrao);
    expect(resultado.mesesApurados).toBe(0);
    expect(resultado.periodosDescartados[0].motivo).toMatch(/incompleto/i);
  });
});

describe("Regra A — datas de experiência parcialmente preenchidas anulam a linha", () => {
  it("início com mês sem ano (inicioIncompleto) descarta a linha, em vez de herdar o projeto", () => {
    const b = bloco(1, {
      projInicio: ma(2020, 1),
      projFim: ma(2020, 12),
      linhas: [linha("r1", { inicioIncompleto: true })],
    });
    const resultado = apurarRequisito([b], requisito("r1", 0), dataLimitePadrao);
    expect(resultado.mesesApurados).toBe(0);
    expect(resultado.periodosDescartados[0].motivo).toMatch(/incompleto/i);
  });

  it("fim com ano sem mês (fimIncompleto) descarta a linha", () => {
    const b = bloco(1, {
      projInicio: ma(2020, 1),
      projFim: ma(2020, 12),
      linhas: [linha("r1", { inicio: ma(2020, 3), fimIncompleto: true })],
    });
    const resultado = apurarRequisito([b], requisito("r1", 0), dataLimitePadrao);
    expect(resultado.mesesApurados).toBe(0);
  });
});

describe("Regra A — nenhuma experiência pode ir além do mês corrente", () => {
  it("fim exatamente na data limite é admitido (fronteira)", () => {
    const dataLimite = ma(2027, 3);
    const b = bloco(1, { projInicio: ma(2026, 1), projFim: ma(2027, 3), linhas: [linha("r1")] });
    const resultado = apurarRequisito([b], requisito("r1", 0), dataLimite);
    expect(resultado.mesesApurados).toBe(15);
    expect(resultado.periodosDescartados).toHaveLength(0);
  });

  it("fim posterior ao mês corrente é descartado, mesmo estando dentro do período do projeto", () => {
    const dataLimite = ma(2027, 3);
    const b = bloco(1, { projInicio: ma(2026, 1), projFim: ma(2027, 6), linhas: [linha("r1")] });
    const resultado = apurarRequisito([b], requisito("r1", 0), dataLimite);
    expect(resultado.mesesApurados).toBe(0);
    expect(resultado.periodosDescartados[0].motivo).toMatch(/mês corrente/i);
  });
});
