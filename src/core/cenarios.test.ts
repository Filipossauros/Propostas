import { describe, expect, it } from "vitest";
import {
  alteracoesSemEfeito,
  aplicarCenario,
  comInternoMovido,
  comPessoas,
  comValorHora,
  comProjetoCortado,
  comProjetoReposto,
  duplicarCenario,
  nomeLivre,
  normalizarCenarios,
  novoCenario,
  pessoasNoCenario,
  semAlteracoesSemEfeito,
  valorHoraNoCenario,
} from "./cenarios";
import {
  importarOrcamentoJSON,
  internosDoProjeto,
  orcamentoParaJSON,
  pessoasDaUnidade,
  totaisPorAnoDaUnidade,
  type OrcamentoUnidade,
} from "./vistaGeral";
import { SCHEMA_VERSION_ATUAL } from "./types";

/** Dois projetos: A com 3 programadores e 1 arquiteto, B com 2 analistas; um interno em cada. */
function orcamento(): OrcamentoUnidade {
  return {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    tipo: "orcamentoUnidade",
    unidade: "UPACE",
    cenarios: [],
    aprovacoes: [],
    projetos: [
      {
        id: "pa",
        nome: "A",
        anoInicio: 2027,
        entradas: [
          {
            id: "a1",
            lote: "1",
            perfil: "Programador",
            pessoas: 3,
            valorHoraSemIva: 40,
            valorHoraComIva: 49.2,
            totaisPorAno: [300, 150, 150],
          },
          {
            id: "a2",
            lote: "2",
            perfil: "Arquiteto",
            pessoas: 1,
            valorHoraSemIva: 50,
            valorHoraComIva: 61.5,
            totaisPorAno: [100, 50, 50],
          },
        ],
        internos: [{ id: "i1", nome: "Ana" }],
      },
      {
        id: "pb",
        nome: "B",
        anoInicio: 2027,
        entradas: [
          {
            id: "b1",
            lote: "1",
            perfil: "Analista",
            pessoas: 2,
            valorHoraSemIva: 30,
            valorHoraComIva: 36.9,
            totaisPorAno: [200, 0, 0],
          },
        ],
        internos: [{ id: "i2", nome: "Rui" }],
      },
    ],
  };
}

describe("cortes de pessoas", () => {
  it("sem cortes, o cenário é igual ao orçamento", () => {
    const o = orcamento();
    const c = aplicarCenario(o, novoCenario("Igual"));
    expect(totaisPorAnoDaUnidade(c)).toEqual(totaisPorAnoDaUnidade(o));
    expect(pessoasDaUnidade(c)).toBe(pessoasDaUnidade(o));
  });

  it("o valor da linha é o valor por pessoa × as pessoas que ficam", () => {
    const o = orcamento();
    const [a] = o.projetos;
    const c = comPessoas(novoCenario("X"), a, a.entradas[0], 2);
    const noCenario = aplicarCenario(o, c);

    expect(noCenario.projetos[0].entradas[0].pessoas).toBe(2);
    expect(noCenario.projetos[0].entradas[0].totaisPorAno).toEqual([200, 100, 100]);
    expect(pessoasDaUnidade(noCenario)).toBe(pessoasDaUnidade(o) - 1);
  });

  it("só pessoas inteiras, entre zero e as do orçamento", () => {
    const o = orcamento();
    const [a] = o.projetos;
    const entrada = a.entradas[0];
    expect(pessoasNoCenario(comPessoas(novoCenario("X"), a, entrada, 7), a, entrada)).toBe(3);
    expect(pessoasNoCenario(comPessoas(novoCenario("X"), a, entrada, -2), a, entrada)).toBe(0);
    expect(pessoasNoCenario(comPessoas(novoCenario("X"), a, entrada, 1.6), a, entrada)).toBe(2);
  });

  it("repor todas as pessoas de uma linha deixa de guardar o corte", () => {
    const o = orcamento();
    const [a] = o.projetos;
    const cortado = comPessoas(novoCenario("X"), a, a.entradas[0], 1);
    expect(comPessoas(cortado, a, a.entradas[0], 3).cortes).toEqual([]);
  });

  it("cortar e repor um projeto inteiro", () => {
    const o = orcamento();
    const [a] = o.projetos;
    const cortado = comProjetoCortado(novoCenario("X"), a);
    const noCenario = aplicarCenario(o, cortado);
    expect(noCenario.projetos[0].entradas.every((e) => e.pessoas === 0)).toBe(true);
    expect(totaisPorAnoDaUnidade(noCenario)).toEqual([200, 0, 0]);
    expect(comProjetoReposto(cortado, a).cortes).toEqual([]);
  });

  it("o orçamento não é alterado", () => {
    const o = orcamento();
    const antes = JSON.stringify(o);
    aplicarCenario(o, comProjetoCortado(novoCenario("X"), o.projetos[0]));
    expect(JSON.stringify(o)).toBe(antes);
  });

  it("o corte sobrevive a reimportar o projeto: liga-se por projeto, lote e perfil", () => {
    const o = orcamento();
    const [a] = o.projetos;
    const c = comPessoas(novoCenario("X"), a, a.entradas[0], 1);
    const reimportado = structuredClone(o);
    reimportado.projetos[0].entradas = reimportado.projetos[0].entradas.map((e) => ({ ...e, id: `${e.id}-novo` }));
    expect(aplicarCenario(reimportado, c).projetos[0].entradas[0].pessoas).toBe(1);
  });

  it("com `semLinhasCortadas`, as linhas sem ninguém saem", () => {
    const o = orcamento();
    const [a] = o.projetos;
    const c = comPessoas(novoCenario("X"), a, a.entradas[1], 0);
    expect(aplicarCenario(o, c).projetos[0].entradas).toHaveLength(2);
    expect(aplicarCenario(o, c, { semLinhasCortadas: true }).projetos[0].entradas).toHaveLength(1);
  });
});

describe("internos", () => {
  it("não se cortam: mudam de projeto, e o total de pessoas mantém-se", () => {
    const o = orcamento();
    const c = comInternoMovido(novoCenario("X"), "i1", "A", "B");
    const noCenario = aplicarCenario(o, c);

    expect(internosDoProjeto(noCenario.projetos[0])).toBe(0);
    expect(noCenario.projetos[1].internos.map((i) => i.nome)).toEqual(["Rui", "Ana"]);
    expect(pessoasDaUnidade(noCenario)).toBe(pessoasDaUnidade(o));
  });

  it("devolvê-lo ao projeto de origem desfaz o movimento", () => {
    const movido = comInternoMovido(novoCenario("X"), "i1", "A", "B");
    expect(comInternoMovido(movido, "i1", "A", "A").movimentos).toEqual([]);
  });

  it("um destino que deixou de existir é ignorado e assinalado", () => {
    const o = orcamento();
    const c = comInternoMovido(novoCenario("X"), "i1", "A", "Projeto apagado");
    expect(aplicarCenario(o, c).projetos[0].internos.map((i) => i.nome)).toEqual(["Ana"]);
    expect(alteracoesSemEfeito(o, c)).toBe(1);
    expect(semAlteracoesSemEfeito(o, c).movimentos).toEqual([]);
  });
});

describe("alterações sem efeito", () => {
  it("um corte numa linha que já não existe não se aplica e é assinalado", () => {
    const o = orcamento();
    const c = { ...novoCenario("X"), cortes: [{ projeto: "A", lote: "9", perfil: "Fantasma", ficam: 0 }] };
    expect(alteracoesSemEfeito(o, c)).toBe(1);
    expect(totaisPorAnoDaUnidade(aplicarCenario(o, c))).toEqual(totaisPorAnoDaUnidade(o));
    expect(semAlteracoesSemEfeito(o, c).cortes).toEqual([]);
  });
});

describe("nomes e cópias", () => {
  it("dá nomes livres", () => {
    expect(nomeLivre([])).toBe("Cenário 1");
    expect(nomeLivre([novoCenario("Cenário 1")])).toBe("Cenário 2");
  });

  it("duplicar dá outro cenário, com os mesmos cortes", () => {
    const o = orcamento();
    const c = comPessoas(novoCenario("X"), o.projetos[0], o.projetos[0].entradas[0], 1);
    const copia = duplicarCenario(c, "Y");
    expect(copia.id).not.toBe(c.id);
    expect(copia.cortes).toEqual(c.cortes);
  });
});

describe("guardar e voltar a abrir", () => {
  it("os cenários viajam no JSON da Vista Geral", () => {
    const o = orcamento();
    o.cenarios = [
      comInternoMovido(comPessoas(novoCenario("X"), o.projetos[0], o.projetos[0].entradas[0], 1), "i1", "A", "B"),
    ];
    const relido = importarOrcamentoJSON(orcamentoParaJSON(o));
    expect(relido.cenarios).toEqual(o.cenarios);
  });

  it("um ficheiro antigo, sem cenários, abre com a lista vazia", () => {
    const { cenarios: _ignorado, ...antigo } = orcamento();
    expect(importarOrcamentoJSON(JSON.stringify(antigo)).cenarios).toEqual([]);
  });

  it("descarta o que não se percebe", () => {
    expect(
      normalizarCenarios([
        null,
        { nome: "Bom", cortes: [{ projeto: "A", lote: "1", perfil: "P", ficam: -1 }, { ficam: 2 }], movimentos: [{}] },
      ]),
    ).toMatchObject([{ nome: "Bom", cortes: [{ projeto: "", lote: "", perfil: "", ficam: 2 }], movimentos: [] }]);
  });
});

describe("valor hora no cenário", () => {
  it("o valor da linha acompanha o novo valor hora, com o mesmo IVA", () => {
    const o = orcamento();
    const [a] = o.projetos;
    // Programador: 40 €/h s/ IVA (49,20 c/ IVA) → 30 €/h.
    const c = comValorHora(novoCenario("X"), a, a.entradas[0], 30);
    const linha = aplicarCenario(o, c).projetos[0].entradas[0];

    expect(linha.valorHoraSemIva).toBe(30);
    expect(linha.valorHoraComIva).toBe(36.9);
    expect(linha.totaisPorAno).toEqual([225, 112.5, 112.5]);
  });

  it("combina com o corte de pessoas, em qualquer ordem", () => {
    const o = orcamento();
    const [a] = o.projetos;
    const e = a.entradas[0];
    const primeiro = comPessoas(comValorHora(novoCenario("X"), a, e, 20), a, e, 1);
    const segundo = comValorHora(comPessoas(novoCenario("X"), a, e, 1), a, e, 20);
    for (const c of [primeiro, segundo]) {
      // 300 × 1/3 × 20/40
      expect(aplicarCenario(o, c).projetos[0].entradas[0].totaisPorAno[0]).toBeCloseTo(50, 6);
    }
  });

  it("repor as pessoas do projeto mantém o valor hora alterado", () => {
    const o = orcamento();
    const [a] = o.projetos;
    const c = comProjetoReposto(comProjetoCortado(comValorHora(novoCenario("X"), a, a.entradas[0], 35), a), a);
    expect(pessoasNoCenario(c, a, a.entradas[0])).toBe(3);
    expect(valorHoraNoCenario(c, a, a.entradas[0])).toBe(35);
  });

  it("voltar ao valor do orçamento, com as pessoas todas, deixa de guardar a linha", () => {
    const o = orcamento();
    const [a] = o.projetos;
    const c = comValorHora(comValorHora(novoCenario("X"), a, a.entradas[0], 35), a, a.entradas[0], 40);
    expect(c.cortes).toEqual([]);
  });

  it("em cêntimos e nunca negativo; o que não é número repõe o do orçamento", () => {
    const o = orcamento();
    const [a] = o.projetos;
    const e = a.entradas[0];
    expect(valorHoraNoCenario(comValorHora(novoCenario("X"), a, e, 33.337), a, e)).toBe(33.34);
    expect(valorHoraNoCenario(comValorHora(novoCenario("X"), a, e, -5), a, e)).toBe(0);
    expect(valorHoraNoCenario(comValorHora(novoCenario("X"), a, e, Number.NaN), a, e)).toBe(40);
  });

  it("viaja no JSON", () => {
    const o = orcamento();
    o.cenarios = [comValorHora(novoCenario("X"), o.projetos[0], o.projetos[0].entradas[0], 35)];
    expect(importarOrcamentoJSON(orcamentoParaJSON(o)).cenarios[0].cortes[0]).toEqual({
      projeto: "A",
      lote: "1",
      perfil: "Programador",
      ficam: 3,
      valorHoraSemIva: 35,
    });
  });
});
