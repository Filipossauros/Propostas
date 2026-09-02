import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import type ExcelJS from "exceljs";
import { gerarWorkbookDeclaracao } from "./gerar";
import { gerarWorkbookResumoPerfis } from "./resumoPerfis";
import { gerarWorkbookVistaGeral } from "./vistaGeral";
import { construirWorkbookResultados } from "./exportarResultados";
import { avaliarProcedimento } from "../core/avaliacaoProcedimento";
import { LOTES_EXEMPLO, declaracoesExemplo } from "../core/exemplo";
import { proporAgrupamentos } from "../core/reconciliacao";
import { especificacao, perfisEmLotes } from "../core/lotes";
import { orcamentoInicial } from "../core/vistaGeral";

/** As folhas que o Excel esconde não se imprimem, e não têm de ser preparadas. */
function folhasVisiveis(wb: ExcelJS.Workbook): ExcelJS.Worksheet[] {
  const visiveis: ExcelJS.Worksheet[] = [];
  wb.eachSheet((folha) => {
    if (folha.state !== "hidden") visiveis.push(folha);
  });
  return visiveis;
}

function resultadoDoExemplo() {
  const declaracoes = declaracoesExemplo(LOTES_EXEMPLO);
  const grupos = proporAgrupamentos(declaracoes.map((d) => d.declaracao.identificacao.entidadeConcorrente));
  return avaliarProcedimento(LOTES_EXEMPLO, declaracoes, grupos);
}

const RESUMOS = gerarWorkbookDeclaracao(
  LOTES_EXEMPLO.lotes.flatMap((lote) =>
    lote.perfis.map((entrada) => especificacao(entrada.perfil, LOTES_EXEMPLO.nBlocos, lote)),
  ),
);

const LIVROS: Array<[string, ExcelJS.Workbook]> = [
  ["Resumos Curriculares", RESUMOS],
  ["Perfis", gerarWorkbookResumoPerfis(perfisEmLotes(LOTES_EXEMPLO), "Projeto")],
  ["Resultados", construirWorkbookResultados(resultadoDoExemplo(), LOTES_EXEMPLO)],
];

describe("impressão das folhas geradas", () => {
  it.each(LIVROS)("%s: todas as folhas saem deitadas e numa página de largura", (_nome, wb) => {
    for (const folha of folhasVisiveis(wb)) {
      expect(folha.pageSetup.orientation).toBe("landscape");
      expect(folha.pageSetup.fitToPage).toBe(true);
      expect(folha.pageSetup.fitToWidth).toBe(1);
      // Altura livre: o que é comprido continua nas páginas seguintes.
      expect(folha.pageSetup.fitToHeight).toBe(0);
    }
  });

  it("a vista geral também, nas duas folhas", () => {
    for (const folha of folhasVisiveis(gerarWorkbookVistaGeral(orcamentoDoExemplo()))) {
      expect(folha.pageSetup.orientation).toBe("landscape");
      expect(folha.pageSetup.fitToWidth).toBe(1);
    }
  });

  it("repete o título e o perfil no topo de cada página do Resumo Curricular", () => {
    // A primeira folha visível é o «Leia-me»; a seguinte é já a de um perfil.
    const folha = folhasVisiveis(RESUMOS)[1];
    expect(folha.pageSetup.printTitlesRow).toBe("1:2");
  });

  /**
   * O `fitToWidth` só vale se o ficheiro trouxer `pageSetUpPr fitToPage`: sem
   * essa marca no `sheetPr`, o Excel ignora o ajuste e volta à escala natural.
   */
  it("o ficheiro escrito traz a marca que faz o Excel respeitar o ajuste", async () => {
    const zip = await JSZip.loadAsync(await RESUMOS.xlsx.writeBuffer());
    // As folhas saem no ficheiro pela ordem em que estão no livro; a oculta das
    // listas não se imprime e fica de fora.
    const visiveis: number[] = [];
    let ordem = 0;
    RESUMOS.eachSheet((folha) => {
      ordem++;
      if (folha.state !== "hidden") visiveis.push(ordem);
    });
    expect(visiveis.length).toBeGreaterThan(0);

    for (const i of visiveis) {
      const xml = await zip.file(`xl/worksheets/sheet${i}.xml`)!.async("string");
      expect(xml).toContain('fitToPage="1"');
      expect(xml).toMatch(/<pageSetup[^>]*orientation="landscape"/);
    }
  });
});

function orcamentoDoExemplo() {
  // Basta a unidade vazia: as duas folhas são construídas na mesma, e é a
  // preparação delas que aqui se testa.
  return { ...orcamentoInicial(), unidade: "Unidade" };
}
