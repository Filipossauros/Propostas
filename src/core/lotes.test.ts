import { describe, expect, it } from "vitest";
import {
  gerarTextoCadernoEncargosLotes,
  importarLotesJSON,
  linhasTabelaValores,
  lotesIniciais,
  lotesParaJSON,
  totalLote,
  totalProcedimento,
  validarLotes,
} from "./lotes";
import { ErroImportacao } from "./perfil";
import { lotesComPerfis, perfil, requisito } from "./fixtures";
import type { LotesJSON } from "./types";

function lotesExemplo(): LotesJSON {
  return lotesComPerfis([
    { numero: "1", perfis: [perfil({ perfil: "Programador Sénior" })] },
    { numero: "2", perfis: [perfil({ perfil: "Analista" })] },
  ]);
}

describe("validarLotes", () => {
  it("aceita um agrupamento completo", () => {
    expect(validarLotes(lotesExemplo())).toHaveLength(0);
  });

  it("exige pelo menos um lote", () => {
    expect(validarLotes(lotesIniciais()).some((e) => e.campo === "lotes")).toBe(true);
  });

  it("rejeita números de lote repetidos", () => {
    const config = lotesExemplo();
    config.lotes[1].numero = config.lotes[0].numero;
    expect(validarLotes(config).some((e) => e.mensagem.includes("repetido"))).toBe(true);
  });

  it("exige horas e valor/hora positivos", () => {
    const config = lotesExemplo();
    config.lotes[0].perfis[0].horas = 0;
    config.lotes[0].perfis[0].valorHora = -5;

    const erros = validarLotes(config);
    expect(erros.some((e) => e.campo.includes("horas"))).toBe(true);
    expect(erros.some((e) => e.campo.includes("valorHora"))).toBe(true);
  });

  it("exige um lote com pelo menos um perfil", () => {
    const config = lotesExemplo();
    config.lotes[0].perfis = [];
    expect(validarLotes(config).some((e) => e.campo.includes("perfis"))).toBe(true);
  });
});

describe("preço base", () => {
  it("calcula o valor de cada perfil como horas × valor/hora", () => {
    const linhas = linhasTabelaValores(lotesExemplo());
    expect(linhas).toHaveLength(2);
    expect(linhas[0].valor).toBe(100 * 50);
  });

  it("o n.º mínimo de elementos não multiplica o preço — é admissibilidade, não quantidade", () => {
    const config = lotesExemplo();
    config.lotes[0].perfis[0].nMinimoElementos = 7;
    expect(linhasTabelaValores(config)[0].valor).toBe(100 * 50);
  });

  it("soma por lote e por procedimento", () => {
    const config = lotesExemplo();
    expect(totalLote(config.lotes[0])).toBe(5000);
    expect(totalProcedimento(config)).toBe(10000);
  });
});

describe("importação/exportação de lotes", () => {
  it("repõe o estado completo (ida e volta)", () => {
    const original = lotesExemplo();
    expect(importarLotesJSON(lotesParaJSON(original))).toEqual(original);
  });

  it("rejeita um ficheiro de perfil carregado como lotes", () => {
    expect(() => importarLotesJSON(JSON.stringify(perfil()))).toThrow(/não um agrupamento/i);
  });

  it("rejeita schemaVersion desconhecida", () => {
    const antigo = JSON.stringify({ ...lotesExemplo(), schemaVersion: "1.0" });
    expect(() => importarLotesJSON(antigo)).toThrow(ErroImportacao);
  });
});

describe("gerarTextoCadernoEncargosLotes", () => {
  it("inclui, por lote, o perfil, os parâmetros económicos e os requisitos", () => {
    const config = lotesComPerfis([
      {
        numero: "1",
        perfis: [perfil({ perfil: "Programador Sénior", requisitos: [requisito("r1", 60, "Java")] })],
      },
    ]);

    const texto = gerarTextoCadernoEncargosLotes(config);
    expect(texto).toContain("LOTE 1");
    expect(texto).toContain("Perfil: Programador Sénior");
    expect(texto).toContain("Número mínimo de elementos a apresentar: 2");
    expect(texto).toContain("Experiência mínima de 60 meses em:");
    expect(texto).toContain("  - Java");
    expect(texto).toContain("Preço base total do procedimento");
  });

  it("devolve texto vazio quando não há lotes", () => {
    expect(gerarTextoCadernoEncargosLotes(lotesIniciais())).toBe("");
  });
});
