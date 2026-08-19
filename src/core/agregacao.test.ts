import { describe, expect, it } from "vitest";
import { apurarEAgregar, requisitosFalhados } from "./agregacao";
import { proporAgrupamentos } from "./reconciliacao";
import type { Bloco, ConfiguracaoJSON, Declaracao, LinhaRequisito, MesAno } from "./types";

function ma(ano: number, mes: number): MesAno {
  return { ano, mes };
}

function config(nMinimoElementos = 2): ConfiguracaoJSON {
  return {
    schemaVersion: "1.0",
    templateVersion: "5.0",
    procedimento: "20270001",
    lote: "1",
    perfil: "Perfil Teste",
    nMinimoElementos,
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

function declaracao(nome: string, entidade: string, opts: Partial<Declaracao> = {}): Declaracao {
  return {
    ficheiro: `${nome}.xlsx`,
    identificacao: { nome, documento: "1", entidadeConcorrente: entidade, procedimento: "20270001", lote: "1", perfil: "Perfil Teste" },
    blocos: [bloco()],
    alertas: [],
    ...opts,
  };
}

describe("apurarEAgregar", () => {
  it("agrega elementos da mesma entidade e verifica n.º mínimo", () => {
    const declaracoes = [declaracao("Ana", "ABC"), declaracao("Bruno", "ABC")];
    const resultado = apurarEAgregar(declaracoes, config(2), []);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].nElementos).toBe(2);
    expect(resultado[0].nElementosSuficiente).toBe(true);
    expect(resultado[0].todosElementosCumprem).toBe(true);
    expect(resultado[0].cumpre).toBe(true);
  });

  it("assinala insuficiência de elementos separadamente do mérito", () => {
    const declaracoes = [declaracao("Ana", "ABC")];
    const resultado = apurarEAgregar(declaracoes, config(2), []);
    expect(resultado[0].nElementosSuficiente).toBe(false);
    expect(resultado[0].todosElementosCumprem).toBe(true);
    expect(resultado[0].cumpre).toBe(false);
  });

  it("concorrente não cumpre se um elemento não cumprir, mesmo com n.º suficiente", () => {
    const declaracoes = [
      declaracao("Ana", "ABC"),
      declaracao("Bruno", "ABC", {
        blocos: [bloco({ linhas: [linha({ declara: "NÃO" })] })],
      }),
    ];
    const resultado = apurarEAgregar(declaracoes, config(2), []);
    expect(resultado[0].todosElementosCumprem).toBe(false);
    expect(resultado[0].cumpre).toBe(false);
  });

  it("aplica a reconciliação de nomes de entidade antes de agregar", () => {
    const declaracoes = [declaracao("Ana", "ABC"), declaracao("Bruno", "ABC, S.A.")];
    const grupos = proporAgrupamentos(["ABC", "ABC, S.A."]);
    const resultado = apurarEAgregar(declaracoes, config(2), grupos);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].nElementos).toBe(2);
  });

  it("sem reconciliação, nomes distintos não são agregados", () => {
    const declaracoes = [declaracao("Ana", "ABC"), declaracao("Bruno", "ABC, S.A.")];
    const resultado = apurarEAgregar(declaracoes, config(2), []);
    expect(resultado).toHaveLength(2);
  });
});

describe("requisitosFalhados", () => {
  it("lista as designações dos requisitos não cumpridos", () => {
    const declaracoes = [declaracao("Ana", "ABC", { blocos: [bloco({ linhas: [linha({ declara: "NÃO" })] })] })];
    const resultado = apurarEAgregar(declaracoes, config(1), []);
    const falhados = requisitosFalhados(resultado[0].elementos[0].apuramento, config(1));
    expect(falhados).toEqual(["Requisito 1"]);
  });
});
