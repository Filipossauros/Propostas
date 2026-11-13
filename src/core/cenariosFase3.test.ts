import { describe, expect, it } from "vitest";
import {
  aplicarCenario,
  comHorasNoAno,
  comPassoDeHoras,
  comPessoas,
  comProjetoCortado,
  comProjetoReposto,
  comQuantidade,
  comRetirada,
  horasDaEntrada,
  horasNoCenario,
  normalizarCenarios,
  novoCenario,
  projetoTodoCortado,
} from "./cenarios";
import { orcamentoInicial, valorDoProjeto, type OrcamentoUnidade, type ProjetoVistaGeral } from "./vistaGeral";

/** Um perfil com 2 pessoas, 1 680 h/ano por elemento a 10 €/h (12,30 c/ IVA), e duas licenças. */
function orcamento(): OrcamentoUnidade {
  const bolsa: ProjetoVistaGeral = {
    id: "b",
    nome: "Bolsa",
    anoInicio: 2027,
    internos: [],
    entradas: [
      {
        id: "p",
        lote: "1",
        perfil: "Programador",
        pessoas: 2,
        valorHoraSemIva: 10,
        valorHoraComIva: 12.3,
        horasPorAno: [1680, 1680, 0],
        totaisPorAno: [2 * 1680 * 12.3, 2 * 1680 * 12.3, 0],
      },
    ],
  };
  const lic: ProjetoVistaGeral = {
    id: "l",
    nome: "Licenças",
    anoInicio: 2027,
    internos: [],
    entradas: [
      {
        id: "u",
        tipo: "licenca",
        lote: "1",
        perfil: "Plataforma",
        pessoas: 0,
        quantidade: 1200,
        quantidadeAjustavel: true,
        valorHoraSemIva: 10,
        valorHoraComIva: 12.3,
        totaisPorAno: [12000, 12000, 12000],
      },
      {
        id: "g",
        tipo: "licenca",
        lote: "2",
        perfil: "Base de dados",
        pessoas: 0,
        quantidade: 1,
        valorHoraSemIva: 5000,
        valorHoraComIva: 6150,
        totaisPorAno: [6150, 0, 0],
      },
    ],
  };
  return { ...orcamentoInicial(), projetos: [bolsa, lic] };
}

describe("cenários — horas por ano, em passos de 8 h", () => {
  it("−8 / +8 por elemento, sem passar das horas do orçamento nem de zero", () => {
    const o = orcamento();
    const [b] = o.projetos;
    const e = b.entradas[0];
    let c = comPassoDeHoras(novoCenario("C"), b, e, 0, -1);
    expect(horasNoCenario(c, b, e)).toEqual([1672, 1680, 0]);
    c = comPassoDeHoras(c, b, e, 0, 1);
    expect(c.cortes).toEqual([]); // de volta ao orçamento: nada se guarda
    c = comPassoDeHoras(c, b, e, 0, 1);
    expect(horasNoCenario(c, b, e)[0]).toBe(1680);
    c = comHorasNoAno(c, b, e, 1, 3);
    expect(horasNoCenario(c, b, e)[1]).toBe(0);
    expect(comPassoDeHoras(c, b, e, 1, -1).cortes[0].horasPorAno?.[1]).toBe(0);
  });

  it("o que se escreve arredonda-se a múltiplos de 8, e o passo acerta valores fora dele", () => {
    const o = orcamento();
    const [b] = o.projetos;
    const e = { ...b.entradas[0], horasPorAno: [1685, 1680, 0] };
    expect(horasNoCenario(comHorasNoAno(novoCenario("C"), b, e, 0, 1003), b, e)[0]).toBe(1000);
    expect(horasNoCenario(comHorasNoAno(novoCenario("C"), b, e, 0, 9999), b, e)[0]).toBe(1685);
    expect(horasNoCenario(comPassoDeHoras(novoCenario("C"), b, e, 0, -1), b, e)[0]).toBe(1680);
  });

  it("o valor de cada ano acompanha as horas, as pessoas e o valor hora", () => {
    const o = orcamento();
    const [b] = o.projetos;
    let c = comHorasNoAno(novoCenario("C"), b, b.entradas[0], 0, 840);
    c = comPessoas(c, b, b.entradas[0], 1);
    const linha = aplicarCenario(o, c).projetos[0].entradas[0];
    expect(linha.totaisPorAno[0]).toBeCloseTo(1 * 840 * 12.3, 6);
    expect(linha.totaisPorAno[1]).toBeCloseTo(1 * 1680 * 12.3, 6);
    expect(linha.horasPorAno).toEqual([840, 1680, 0]);
  });

  it("os orçamentos anteriores, sem horas guardadas, tiram-nas do valor", () => {
    const e = { ...orcamento().projetos[0].entradas[0] };
    delete e.horasPorAno;
    expect(horasDaEntrada(e)).toEqual([1680, 1680, 0]);
  });
});

describe("cenários — licenças", () => {
  it("a quantidade corta o valor na proporção; retirar tira-o todo", () => {
    const o = orcamento();
    const l = o.projetos[1];
    let c = comQuantidade(novoCenario("C"), l, l.entradas[0], 1000);
    expect(aplicarCenario(o, c).projetos[1].entradas[0].totaisPorAno[0]).toBeCloseTo(10000, 6);
    expect(comQuantidade(c, l, l.entradas[0], 5000).cortes[0]?.quantidade).toBeUndefined();
    c = comRetirada(c, l, l.entradas[1], true);
    expect(valorDoProjeto(aplicarCenario(o, c).projetos[1])).toBeCloseTo(30000, 6);
  });

  it("cortar e repor o projeto retiram e repõem as licenças; a quantidade alterada fica", () => {
    const o = orcamento();
    const l = o.projetos[1];
    let c = comQuantidade(novoCenario("C"), l, l.entradas[0], 600);
    c = comProjetoCortado(c, l);
    expect(projetoTodoCortado(c, l)).toBe(true);
    expect(valorDoProjeto(aplicarCenario(o, c).projetos[1])).toBe(0);
    c = comProjetoReposto(c, l);
    expect(projetoTodoCortado(c, l)).toBe(false);
    expect(c.cortes.map((x) => [x.perfil, x.quantidade, x.retirada])).toEqual([["Plataforma", 600, undefined]]);
  });

  it("os cortes novos vão e vêm no ficheiro", () => {
    const o = orcamento();
    const [b, l] = o.projetos;
    let c = comHorasNoAno(novoCenario("C"), b, b.entradas[0], 0, 800);
    c = comQuantidade(c, l, l.entradas[0], 10);
    c = comRetirada(c, l, l.entradas[1], true);
    expect(normalizarCenarios(JSON.parse(JSON.stringify([c])))[0].cortes).toEqual(c.cortes);
  });
});
