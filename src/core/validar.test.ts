import { describe, expect, it } from "vitest";
import { blocoPreenchido, validarDeclaracao } from "./validar";
import type { Bloco, ConfiguracaoJSON, Declaracao, LinhaRequisito, MesAno } from "./types";

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
    cliente: "",
    projeto: "",
    funcao: "",
    projInicio: null,
    projFim: null,
    emCurso: null,
    linhas: [linha()],
    ...opts,
  };
}

function declaracao(opts: Partial<Declaracao> = {}): Declaracao {
  return {
    ficheiro: "teste.xlsx",
    identificacao: { nome: "João Silva", documento: "1234", entidadeConcorrente: "ABC, Lda.", procedimento: "20270001", lote: "1", perfil: "Perfil Teste" },
    blocos: [bloco()],
    alertas: [],
    ...opts,
  };
}

describe("blocoPreenchido", () => {
  it("bloco totalmente vazio não é considerado preenchido", () => {
    expect(blocoPreenchido(bloco())).toBe(false);
  });
  it("cliente preenchido conta como preenchido", () => {
    expect(blocoPreenchido(bloco({ cliente: "ACME" }))).toBe(true);
  });
});

describe("validarDeclaracao", () => {
  it("não gera alertas para uma declaração coerente", () => {
    const d = declaracao({
      blocos: [bloco({ cliente: "ACME", projeto: "Projeto X", projInicio: ma(2020, 1), projFim: ma(2020, 12) })],
    });
    const validado = validarDeclaracao(d, config());
    expect(validado.alertas).toHaveLength(0);
  });

  it("assinala identificação incompleta", () => {
    const d = declaracao({ identificacao: { ...declaracao().identificacao, nome: "" } });
    const validado = validarDeclaracao(d, config());
    expect(validado.alertas.some((a) => a.tipo === "identificacaoIncompleta")).toBe(true);
  });

  it("assinala campo obrigatório em branco em bloco preenchido", () => {
    const d = declaracao({
      blocos: [bloco({ cliente: "ACME", linhas: [linha({ declara: null })] })],
    });
    const validado = validarDeclaracao(d, config());
    expect(validado.alertas.some((a) => a.tipo === "campoObrigatorioBranco")).toBe(true);
  });

  it("não assinala campo obrigatório em branco em bloco vazio", () => {
    const d = declaracao({ blocos: [bloco({ linhas: [linha({ declara: null })] })] });
    const validado = validarDeclaracao(d, config());
    expect(validado.alertas.some((a) => a.tipo === "campoObrigatorioBranco")).toBe(false);
  });

  it("assinala datas incoerentes quando o início do projeto é posterior ao fim", () => {
    const d = declaracao({
      blocos: [bloco({ cliente: "ACME", projInicio: ma(2023, 12), projFim: ma(2023, 1) })],
    });
    const validado = validarDeclaracao(d, config());
    expect(validado.alertas.some((a) => a.tipo === "datasIncoerentes")).toBe(true);
  });

  it("assinala período fora do projeto a partir do apuramento (Regra A)", () => {
    const d = declaracao({
      blocos: [
        bloco({
          cliente: "ACME",
          projInicio: ma(2020, 1),
          projFim: ma(2023, 12),
          linhas: [linha({ inicio: ma(2019, 1), fim: ma(2019, 12) })],
        }),
      ],
    });
    const validado = validarDeclaracao(d, config());
    expect(validado.alertas.some((a) => a.tipo === "periodoForaDoProjeto")).toBe(true);
  });

  it("assinala ano fora do intervalo admitido", () => {
    const d = declaracao({
      blocos: [bloco({ cliente: "ACME", projInicio: ma(1899, 1), projFim: ma(2000, 12) })],
    });
    const validado = validarDeclaracao(d, config());
    expect(validado.alertas.some((a) => a.tipo === "datasIncoerentes")).toBe(true);
  });

  it("preserva os alertas estruturais já presentes na declaração", () => {
    const d = declaracao({ alertas: [{ tipo: "estruturaIncompativel", mensagem: "teste" }] });
    const validado = validarDeclaracao(d, config());
    expect(validado.alertas.some((a) => a.tipo === "estruturaIncompativel")).toBe(true);
  });
});
