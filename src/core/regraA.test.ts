import { describe, expect, it } from "vitest";
import { apurarRequisito, contarMesesInclusive, paraMesInt } from "./regraA";
import type { Bloco, LinhaRequisito, MesAno, Requisito } from "./types";

const dataLimitePadrao: MesAno = { ano: 2099, mes: 12 };

function ma(ano: number, mes: number): MesAno {
  return { ano, mes };
}

function requisito(id = "r1", mesesMinimos = 0): Requisito {
  return { id, designacao: `Requisito ${id}`, mesesMinimos };
}

function linha(
  requisitoId: string,
  opts: { declara?: LinhaRequisito["declara"]; inicio?: MesAno | null; fim?: MesAno | null } = {},
): LinhaRequisito {
  return {
    requisitoId,
    declara: opts.declara ?? "SIM",
    inicio: opts.inicio ?? null,
    fim: opts.fim ?? null,
  };
}

function bloco(
  indice: number,
  opts: {
    projInicio?: MesAno | null;
    projFim?: MesAno | null;
    emCurso?: Bloco["emCurso"];
    linhas: LinhaRequisito[];
  },
): Bloco {
  return {
    indice,
    cliente: "Cliente Teste",
    projeto: "Projeto Teste",
    funcao: "Função Teste",
    projInicio: opts.projInicio ?? null,
    projFim: opts.projFim ?? null,
    emCurso: opts.emCurso ?? null,
    linhas: opts.linhas,
  };
}

describe("contarMesesInclusive", () => {
  it("conta os dois extremos", () => {
    expect(contarMesesInclusive(paraMesInt(ma(2021, 3)), paraMesInt(ma(2023, 9)))).toBe(31);
  });
});

describe("Regra A — casos de teste obrigatórios (PLANO.md 6.3)", () => {
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

  it("8. projeto em curso desde 01/2026, data limite 31/03/2027 = 15 meses", () => {
    const dataLimite = ma(2027, 3);
    const b = bloco(1, {
      projInicio: ma(2026, 1),
      projFim: null,
      emCurso: "Sim",
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

  it("cumpre compara mesesApurados >= mesesMinimos", () => {
    const b = bloco(1, { projInicio: ma(2020, 1), projFim: ma(2020, 12), linhas: [linha("r1")] });
    expect(apurarRequisito([b], requisito("r1", 12), dataLimitePadrao).cumpre).toBe(true);
    expect(apurarRequisito([b], requisito("r1", 13), dataLimitePadrao).cumpre).toBe(false);
  });
});
