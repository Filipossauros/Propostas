import { describe, expect, it } from "vitest";
import {
  ErroImportacaoConfig,
  configuracaoParaJSON,
  gerarTextoCadernoEncargos,
  importarConfiguracaoJSON,
  sugereAgrupamento,
  validarConfiguracao,
} from "./configuracao";
import type { ConfiguracaoJSON } from "./types";

function configExemplo(): ConfiguracaoJSON {
  return {
    schemaVersion: "1.0",
    templateVersion: "5.0",
    procedimento: "20270001",
    lote: "1",
    perfil: "Arquiteto / Programador Sénior — Integração",
    nMinimoElementos: 2,
    dataLimitePropostas: "2027-03-31",
    nBlocos: 15,
    requisitos: [
      { id: "r1", designacao: "Desenvolvimento de software (geral)", versaoMinima: null, mesesMinimos: 120 },
      { id: "r2", designacao: "Java (versão 8 ou superior)", versaoMinima: "8", mesesMinimos: 60 },
      { id: "r3", designacao: "Desenvolvimento de APIs", versaoMinima: null, mesesMinimos: 60 },
    ],
  };
}

describe("sugereAgrupamento", () => {
  it("deteta vírgulas", () => {
    expect(sugereAgrupamento("Java, C# ou Python")).toBe(true);
    expect(sugereAgrupamento("Java, C#")).toBe(true);
  });
  it("deteta ' ou '", () => {
    expect(sugereAgrupamento("Java ou C#")).toBe(true);
  });
  it("não assinala designações simples", () => {
    expect(sugereAgrupamento("Java (versão 8 ou superior)")).toBe(true); // contém " ou "
    expect(sugereAgrupamento("Desenvolvimento de APIs")).toBe(false);
  });
});

describe("validarConfiguracao", () => {
  it("aceita uma configuração válida", () => {
    expect(validarConfiguracao(configExemplo())).toHaveLength(0);
  });

  it("rejeita designações repetidas", () => {
    const config = configExemplo();
    config.requisitos[1].designacao = config.requisitos[0].designacao;
    const erros = validarConfiguracao(config);
    expect(erros.some((e) => e.mensagem.includes("repetida"))).toBe(true);
  });

  it("rejeita meses mínimos inválidos", () => {
    const config = configExemplo();
    config.requisitos[0].mesesMinimos = 0;
    const erros = validarConfiguracao(config);
    expect(erros.some((e) => e.campo.includes("mesesMinimos"))).toBe(true);
  });

  it("rejeita campos de configuração vazios", () => {
    const config = configExemplo();
    config.procedimento = "";
    expect(validarConfiguracao(config).some((e) => e.campo === "procedimento")).toBe(true);
  });
});

describe("importação/exportação JSON", () => {
  it("repõe o estado completo (round-trip)", () => {
    const config = configExemplo();
    const reimportado = importarConfiguracaoJSON(configuracaoParaJSON(config));
    expect(reimportado).toEqual(config);
  });

  it("rejeita schemaVersion desconhecida", () => {
    const config = { ...configExemplo(), schemaVersion: "9.9" };
    expect(() => importarConfiguracaoJSON(JSON.stringify(config))).toThrow(ErroImportacaoConfig);
  });

  it("rejeita JSON inválido", () => {
    expect(() => importarConfiguracaoJSON("{ isto não é json")).toThrow(ErroImportacaoConfig);
  });
});

describe("gerarTextoCadernoEncargos", () => {
  it("agrupa por meses mínimos, do maior para o menor", () => {
    const texto = gerarTextoCadernoEncargos(configExemplo().requisitos);
    expect(texto).toBe(
      "Experiência mínima de 120 meses em:\n" +
        "  - Desenvolvimento de software (geral)\n\n" +
        "Experiência mínima de 60 meses em:\n" +
        "  - Java (versão 8 ou superior)\n" +
        "  - Desenvolvimento de APIs",
    );
  });
});
