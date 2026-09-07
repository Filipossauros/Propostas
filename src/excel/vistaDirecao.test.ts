import { describe, expect, it } from "vitest";
import type ExcelJS from "exceljs";
import { gerarWorkbookVistaDirecao } from "./vistaDirecao";
import { comUnidade, vistaDirecaoInicial } from "../core/vistaGeralDirecao";
import { orcamentoInicial, type OrcamentoUnidade } from "../core/vistaGeral";
import { gerarId } from "../core/id";

function unidade(nome: string, rate: number, pessoas: number): OrcamentoUnidade {
  return {
    ...orcamentoInicial(),
    unidade: nome,
    projetos: [
      {
        id: gerarId(),
        nome: `Projeto da ${nome}`,
        anoInicio: 2026,
        entradas: [
          {
            id: gerarId(),
            lote: "1",
            perfil: "Programador",
            pessoas,
            valorHoraSemIva: rate,
            valorHoraComIva: rate * 1.23,
            totaisPorAno: [1000, 500, 0],
          },
        ],
        internos: [{ id: gerarId(), nome: "Ana" }],
      },
    ],
  };
}

const VISTA = comUnidade(comUnidade({ ...vistaDirecaoInicial(), direcao: "DSI" }, unidade("A", 40, 2)), unidade("B", 50, 1));
const LIVRO = gerarWorkbookVistaDirecao(VISTA);

function folha(nome: string): ExcelJS.Worksheet {
  const encontrada = LIVRO.getWorksheet(nome);
  if (encontrada === undefined) throw new Error(`Folha "${nome}" inexistente.`);
  return encontrada;
}

/** O texto de uma coluna, da primeira linha de dados para baixo. */
function coluna(nome: string, indice: number): string[] {
  const valores: string[] = [];
  folha(nome).eachRow((linha, numero) => {
    if (numero <= 4) return;
    const valor = linha.getCell(indice).value;
    valores.push(valor === null || valor === undefined ? "" : String(valor));
  });
  return valores;
}

describe("Excel da Vista Geral da Direção", () => {
  it("tem as três folhas, na ordem em que se leem", () => {
    expect(LIVRO.worksheets.map((f) => f.name)).toEqual([
      "Resumo por unidade",
      "Projetos e valores",
      "Perfis e rates",
    ]);
  });

  it("o resumo traz cada unidade e, recuados, os seus projetos", () => {
    expect(coluna("Resumo por unidade", 1)).toEqual([
      "A",
      "    Projeto da A",
      "B",
      "    Projeto da B",
      "Total da direção",
    ]);
  });

  it("o detalhe repete a unidade em cada linha, para a folha se poder filtrar", () => {
    // Duas linhas por unidade: o perfil contratado e o elemento interno.
    expect(coluna("Projetos e valores", 1).slice(0, 4)).toEqual(["A", "A", "B", "B"]);
    expect(coluna("Projetos e valores", 4).slice(0, 4)).toEqual([
      "Programador",
      "Ana (interno)",
      "Programador",
      "Ana (interno)",
    ]);
  });

  it("o detalhe fecha com o total da direção, com e sem IVA", () => {
    const rotulos = coluna("Projetos e valores", 1);
    expect(rotulos.slice(-2)).toEqual(["Total da direção (c/ IVA)", "Total da direção (s/ IVA)"]);
  });

  it("as rates trazem o perfil e, por baixo, cada contratação que o praticou", () => {
    expect(coluna("Perfis e rates", 1)).toEqual(["Programador", "    Programador", "    Programador"]);
    expect(coluna("Perfis e rates", 6).slice(1)).toEqual(["40", "50"]);
  });

  it("todas as folhas saem preparadas para imprimir deitadas", () => {
    for (const f of LIVRO.worksheets) {
      expect(f.pageSetup.orientation).toBe("landscape");
      expect(f.pageSetup.fitToWidth).toBe(1);
    }
  });
});
