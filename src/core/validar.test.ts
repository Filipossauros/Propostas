import { describe, expect, it } from "vitest";
import { blocoPreenchido, validarDeclaracao } from "./validar";
import { bloco, configAvaliacao, declaracao, linha, ma } from "./fixtures";

describe("blocoPreenchido", () => {
  it("bloco totalmente vazio não é considerado preenchido", () => {
    const vazio = bloco({ cliente: "", projeto: "", funcao: "", projInicio: null, projFim: null });
    expect(blocoPreenchido(vazio)).toBe(false);
  });

  it("qualquer elemento identificativo torna o bloco preenchido", () => {
    const soCliente = bloco({ cliente: "ACME", projeto: "", funcao: "", projInicio: null, projFim: null });
    expect(blocoPreenchido(soCliente)).toBe(true);
  });
});

describe("validarDeclaracao", () => {
  it("não gera alertas para uma declaração coerente", () => {
    expect(validarDeclaracao(declaracao(), configAvaliacao()).alertas).toHaveLength(0);
  });

  it("assinala identificação incompleta", () => {
    const d = declaracao({ identificacao: { nome: "" } as never });
    const alertas = validarDeclaracao(d, configAvaliacao()).alertas;
    expect(alertas.some((a) => a.tipo === "identificacaoIncompleta")).toBe(true);
  });

  it("assinala campo obrigatório em branco em bloco preenchido", () => {
    const d = declaracao({ blocos: [bloco({ linhas: [linha({ declara: null })] })] });
    const alertas = validarDeclaracao(d, configAvaliacao()).alertas;
    expect(alertas.some((a) => a.tipo === "campoObrigatorioBranco")).toBe(true);
  });

  it("não assinala campo obrigatório em branco em bloco vazio", () => {
    const vazio = bloco({
      cliente: "",
      projeto: "",
      funcao: "",
      projInicio: null,
      projFim: null,
      linhas: [linha({ declara: null })],
    });
    const alertas = validarDeclaracao(declaracao({ blocos: [vazio] }), configAvaliacao()).alertas;
    expect(alertas.some((a) => a.tipo === "campoObrigatorioBranco")).toBe(false);
  });

  it("assinala início do projeto posterior ao fim", () => {
    const d = declaracao({ blocos: [bloco({ projInicio: ma(2023, 12), projFim: ma(2023, 1) })] });
    const alertas = validarDeclaracao(d, configAvaliacao()).alertas;
    expect(alertas.some((a) => a.tipo === "datasIncoerentes")).toBe(true);
  });

  it("assinala período fora do projeto a partir do apuramento (Regra A)", () => {
    const d = declaracao({
      blocos: [
        bloco({
          projInicio: ma(2020, 1),
          projFim: ma(2023, 12),
          linhas: [linha({ inicio: ma(2019, 1), fim: ma(2019, 12) })],
        }),
      ],
    });
    const alertas = validarDeclaracao(d, configAvaliacao()).alertas;
    expect(alertas.some((a) => a.tipo === "periodoForaDoProjeto")).toBe(true);
  });

  it("assinala ano fora do intervalo admitido", () => {
    const d = declaracao({ blocos: [bloco({ projInicio: ma(1899, 1), projFim: ma(2000, 12) })] });
    const alertas = validarDeclaracao(d, configAvaliacao()).alertas;
    expect(alertas.some((a) => a.tipo === "datasIncoerentes")).toBe(true);
  });

  it("preserva os alertas estruturais já presentes na declaração", () => {
    const d = declaracao({ alertas: [{ tipo: "estruturaIncompativel", mensagem: "teste" }] });
    const alertas = validarDeclaracao(d, configAvaliacao()).alertas;
    expect(alertas.some((a) => a.tipo === "estruturaIncompativel")).toBe(true);
  });
});
