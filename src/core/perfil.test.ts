import { describe, expect, it } from "vitest";
import {
  ErroImportacao,
  gerarTextoCadernoEncargos,
  importarPerfilJSON,
  lerTipoConfiguracao,
  perfilParaJSON,
  validarPerfil,
} from "./perfil";
import { lotesParaJSON } from "./lotes";
import { lotesComPerfis, perfil, requisito } from "./fixtures";

describe("validarPerfil", () => {
  it("aceita um perfil válido", () => {
    expect(validarPerfil(perfil())).toHaveLength(0);
  });

  it("não exige qualquer identificação de procedimento — nesta fase ainda não existe", () => {
    expect(Object.keys(perfil())).not.toContain("procedimento");
    expect(validarPerfil(perfil())).toHaveLength(0);
  });

  it("exige a designação do perfil", () => {
    expect(validarPerfil(perfil({ perfil: "" })).some((e) => e.campo === "perfil")).toBe(true);
  });

  it("rejeita designações de requisito repetidas", () => {
    const repetidos = [requisito("r1", 12, "Java"), requisito("r2", 24, "Java")];
    const erros = validarPerfil(perfil({ requisitos: repetidos }));
    expect(erros.some((e) => e.mensagem.includes("repetida"))).toBe(true);
  });

  it("rejeita meses mínimos inválidos", () => {
    const erros = validarPerfil(perfil({ requisitos: [requisito("r1", 0)] }));
    expect(erros.some((e) => e.campo.includes("mesesMinimos"))).toBe(true);
  });

  it("exige pelo menos um requisito", () => {
    expect(validarPerfil(perfil({ requisitos: [] })).some((e) => e.campo === "requisitos")).toBe(true);
  });
});

describe("importação/exportação de perfil", () => {
  it("repõe o estado completo (ida e volta)", () => {
    const original = perfil();
    expect(importarPerfilJSON(perfilParaJSON(original))).toEqual(original);
  });

  it("rejeita schemaVersion desconhecida", () => {
    const antigo = JSON.stringify({ ...perfil(), schemaVersion: "1.0" });
    expect(() => importarPerfilJSON(antigo)).toThrow(ErroImportacao);
  });

  it("rejeita JSON inválido", () => {
    expect(() => importarPerfilJSON("{ isto não é json")).toThrow(ErroImportacao);
  });

  it("rejeita um ficheiro de lotes carregado como perfil", () => {
    const lotes = lotesParaJSON(lotesComPerfis([{ numero: "1", perfis: [perfil()] }]));
    expect(() => importarPerfilJSON(lotes)).toThrow(/não um perfil/i);
  });
});

describe("lerTipoConfiguracao", () => {
  it("distingue perfil de lotes", () => {
    expect(lerTipoConfiguracao(perfilParaJSON(perfil()))).toBe("perfil");
    expect(lerTipoConfiguracao(lotesParaJSON(lotesComPerfis([{ numero: "1", perfis: [perfil()] }])))).toBe("lotes");
  });
});

describe("gerarTextoCadernoEncargos", () => {
  it("agrupa por exigência, em anos com o equivalente em meses", () => {
    const requisitos = [
      requisito("r1", 120, "Desenvolvimento de software (geral)"),
      requisito("r2", 60, "Java (versão 8 ou superior)"),
      requisito("r3", 60, "Desenvolvimento de APIs"),
    ];

    expect(gerarTextoCadernoEncargos(requisitos)).toBe(
      "Experiência mínima de 10 anos (120 meses) em:\n" +
        "  - Desenvolvimento de software (geral)\n\n" +
        "Experiência mínima de 5 anos (60 meses) em:\n" +
        "  - Java (versão 8 ou superior)\n" +
        "  - Desenvolvimento de APIs",
    );
  });
});
