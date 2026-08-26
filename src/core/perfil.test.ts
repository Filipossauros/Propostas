import { describe, expect, it } from "vitest";
import {
  ErroImportacao,
  duplicarPerfil,
  gerarTextoCadernoEncargos,
  importarPerfisJSON,
  lerTipoConfiguracao,
  perfisParaJSON,
  validarNomeProjeto,
  validarPerfil,
  validarPerfis,
  conteudoFuncionalDoPerfil,
} from "./perfil";
import { ATIVIDADE_FIXA } from "./types";
import { lotesParaJSON } from "./lotes";
import { itens, lotesComPerfis, perfil, requisito } from "./fixtures";

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

describe("validarPerfis", () => {
  it("aceita um conjunto de perfis distintos", () => {
    expect(validarPerfis([perfil({ perfil: "A" }), perfil({ perfil: "B" })])).toHaveLength(0);
  });

  it("exige pelo menos um perfil", () => {
    expect(validarPerfis([]).some((e) => e.campo === "perfis")).toBe(true);
  });

  it("rejeita designações de perfil repetidas — é a designação que dá nome à folha", () => {
    const erros = validarPerfis([perfil({ perfil: "Igual" }), perfil({ perfil: "Igual" })]);
    expect(erros.some((e) => e.mensagem.includes("repetida"))).toBe(true);
  });

  it("propaga os erros de cada perfil, identificando-o", () => {
    const erros = validarPerfis([perfil({ perfil: "Analista", requisitos: [] })]);
    expect(erros.some((e) => e.mensagem.startsWith("Analista:"))).toBe(true);
  });
});

describe("validarNomeProjeto", () => {
  it("aceita um nome preenchido", () => {
    expect(validarNomeProjeto("Modernização")).toHaveLength(0);
  });

  it("exige o nome do projeto, que dá nome a todos os ficheiros", () => {
    expect(validarNomeProjeto("   ").some((e) => e.campo === "nomeProjeto")).toBe(true);
  });
});

describe("duplicarPerfil", () => {
  it("dá identidade nova ao perfil e aos seus requisitos", () => {
    const original = perfil({ requisitos: [requisito("r1", 12, "Java")] });
    const copia = duplicarPerfil(original);

    expect(copia.id).not.toBe(original.id);
    expect(copia.requisitos[0].id).not.toBe(original.requisitos[0].id);
    expect(copia.requisitos[0].designacao).toBe("Java");
  });

  it("distingue a cópia pela designação, para não colidir com o original", () => {
    expect(duplicarPerfil(perfil({ perfil: "Analista" })).perfil).toBe("Analista (cópia)");
  });
});

describe("importação/exportação de perfis", () => {
  it("repõe o estado completo (ida e volta), com vários perfis e o nome do projeto", () => {
    const originais = [perfil({ perfil: "A" }), perfil({ perfil: "B" })];
    const importado = importarPerfisJSON(perfisParaJSON(originais, "Projeto X", "Uma descrição"));

    expect(importado.perfis).toEqual(originais);
    expect(importado.nomeProjeto).toBe("Projeto X");
  });

  it("aceita um ficheiro de perfil isolado, das versões anteriores", () => {
    const isolado = JSON.stringify(perfil({ perfil: "Antigo" }));
    const importado = importarPerfisJSON(isolado);

    expect(importado.perfis.map((p) => p.perfil)).toEqual(["Antigo"]);
    expect(importado.nomeProjeto).toBe("");
  });

  it("dá identidade a um perfil de ficheiro anterior, que não a tinha", () => {
    const semId = { ...perfil({ perfil: "Sem id" }) } as Record<string, unknown>;
    delete semId.id;

    const [importado] = importarPerfisJSON(JSON.stringify(semId)).perfis;
    expect(typeof importado.id).toBe("string");
    expect(importado.id).not.toBe("");
  });

  it("rejeita schemaVersion desconhecida", () => {
    const antigo = JSON.stringify({ ...perfil(), schemaVersion: "1.0" });
    expect(() => importarPerfisJSON(antigo)).toThrow(ErroImportacao);
  });

  it("rejeita JSON inválido", () => {
    expect(() => importarPerfisJSON("{ isto não é json")).toThrow(ErroImportacao);
  });

  it("rejeita um ficheiro de lotes carregado como perfil", () => {
    const lotes = lotesParaJSON(lotesComPerfis([{ numero: "1", perfis: [perfil()] }]));
    expect(() => importarPerfisJSON(lotes)).toThrow(/não um perfil/i);
  });
});

describe("lerTipoConfiguracao", () => {
  it("distingue perfis de lotes", () => {
    expect(lerTipoConfiguracao(perfisParaJSON([perfil()], "Projeto X", "Uma descrição"))).toBe("perfis");
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

describe("atividade de fecho do conteúdo funcional", () => {
  it("não se guarda no perfil, mas fecha sempre a lista", () => {
    const p = perfil({ conteudoFuncional: itens("Levantamento de requisitos") });

    expect(p.conteudoFuncional.map((i) => i.designacao)).toEqual(["Levantamento de requisitos"]);
    expect(conteudoFuncionalDoPerfil(p)).toEqual(["Levantamento de requisitos", ATIVIDADE_FIXA]);
  });

  it("um ficheiro que a trazia guardada não a leva duas vezes", () => {
    const guardado = perfil({ conteudoFuncional: itens("Levantamento de requisitos", ATIVIDADE_FIXA) });
    const [lido] = importarPerfisJSON(perfisParaJSON([guardado], "Projeto", "Uma descrição")).perfis;

    expect(lido.conteudoFuncional.map((i) => i.designacao)).toEqual(["Levantamento de requisitos"]);
    expect(conteudoFuncionalDoPerfil(lido)).toEqual(["Levantamento de requisitos", ATIVIDADE_FIXA]);
  });

  it("e um perfil que só a tenha continua a precisar de uma atividade própria", () => {
    const so = perfil({ conteudoFuncional: itens(ATIVIDADE_FIXA) });
    const [lido] = importarPerfisJSON(perfisParaJSON([so], "Projeto", "Uma descrição")).perfis;

    expect(validarPerfil(lido).map((e) => e.campo)).toContain("conteudoFuncional");
  });

  it("com uma atividade própria, o conteúdo funcional está completo", () => {
    expect(validarPerfil(perfil({ conteudoFuncional: itens("Uma atividade") })).map((e) => e.campo)).not.toContain(
      "conteudoFuncional",
    );
  });
});
