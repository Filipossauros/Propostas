import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { gerarWorkbookVistaGeral } from "./vistaGeral";
import { criarLote, criarPerfilEmLote, lotesIniciais } from "../core/lotes";
import {
  comInterno,
  comProjeto,
  orcamentoInicial,
  projetoDeAgrupamento,
  type OrcamentoUnidade,
} from "../core/vistaGeral";
import { perfil } from "../core/fixtures";
import type { LotesJSON } from "../core/types";

function agrupamento(nome: string, anoInicio: number, perfis: Array<{ lote: string; perfil: string; pessoas: number }>) {
  const config: LotesJSON = lotesIniciais();
  config.nomeProjeto = nome;
  config.taxaIva = 23;
  config.encargosPlurianuais = { ativo: true, anoInicio };
  config.lotes = perfis.map((p) => {
    const lote = criarLote(p.lote);
    const entrada = criarPerfilEmLote(perfil({ perfil: p.perfil }));
    lote.perfis = [{ ...entrada, nMinimoElementos: p.pessoas, valorHora: 100, horasPorAno: [1000, 500, 0], horas: 1500 }];
    return lote;
  });
  return config;
}

function comDoisProjetos(): OrcamentoUnidade {
  let orcamento = comProjeto(
    orcamentoInicial(),
    projetoDeAgrupamento(agrupamento("SClínico", 2027, [{ lote: "1", perfil: "Programador", pessoas: 2 }])),
  );
  orcamento = comProjeto(
    orcamento,
    projetoDeAgrupamento(agrupamento("RSE", 2028, [{ lote: "1", perfil: "Arquiteto", pessoas: 1 }])),
  );
  orcamento = comInterno(orcamento, orcamento.projetos[0].id, "Ana Silva");
  return { ...orcamento, unidade: "Unidade de Sistemas" };
}

/** Os valores de uma folha, linha a linha, sem depender de coordenadas exatas. */
function linhasDaFolha(folha: ExcelJS.Worksheet): string[][] {
  const linhas: string[][] = [];
  folha.eachRow((linha) => {
    const valores: string[] = [];
    linha.eachCell({ includeEmpty: true }, (celula) => valores.push(String(celula.value ?? "")));
    linhas.push(valores);
  });
  return linhas;
}

describe("gerarWorkbookVistaGeral", () => {
  it("tem uma folha só, com o nome da unidade no título", () => {
    const livro = gerarWorkbookVistaGeral(comDoisProjetos());
    expect(livro.worksheets).toHaveLength(1);
    expect(livro.worksheets[0].name).toBe("Vista geral");
    expect(livro.title).toBe("Vista geral — Unidade de Sistemas");
  });

  it("leva as colunas pedidas, com os anos absolutos do orçamento", () => {
    const folha = gerarWorkbookVistaGeral(comDoisProjetos()).worksheets[0];
    const cabecalho = linhasDaFolha(folha).find((l) => l[0] === "Projeto")!;

    expect(cabecalho.slice(0, 6)).toEqual([
      "Projeto",
      "Pessoas",
      "Perfil",
      "Rate (€/h) s/ IVA",
      "Rate (€/h) c/ IVA",
      "Lotes",
    ]);
    // 2027 a 2030: o primeiro projeto começa em 2027, o segundo em 2028.
    expect(cabecalho.filter((t) => t.startsWith("Total € c/ IVA"))).toEqual([
      "Total € c/ IVA\n(11 meses)\n2027",
      "Total € c/ IVA\n(11 meses)\n2028",
      "Total € c/ IVA\n(11 meses)\n2029",
      "Total € c/ IVA\n(11 meses)\n2030",
    ]);
    expect(cabecalho.slice(-4)).toEqual(["Total Pessoas", "% na unidade", "Valor por projeto", "Lotes do projeto"]);
  });

  it("uma linha por perfil e por elemento interno, com o projeto em cada uma", () => {
    const folha = gerarWorkbookVistaGeral(comDoisProjetos()).worksheets[0];
    const linhas = linhasDaFolha(folha);

    const doSClinico = linhas.filter((l) => l[0] === "SClínico");
    expect(doSClinico).toHaveLength(2);
    expect(doSClinico.map((l) => l[2])).toEqual(["Programador", "Ana Silva (interno)"]);
    // O total de pessoas do projeto repete-se em cada linha: 2 do perfil + 1 interno.
    expect(doSClinico.map((l) => l[l.length - 4])).toEqual(["3", "3"]);
  });

  it("os valores dos anos são números, e caem nos anos do projeto", () => {
    const folha = gerarWorkbookVistaGeral(comDoisProjetos()).worksheets[0];
    const linhaSClinico = linhasDaFolha(folha).find((l) => l[0] === "SClínico" && l[2] === "Programador")!;

    // Colunas 7 a 10 são 2027, 2028, 2029 e 2030. O projeto começa em 2027.
    expect(Number(linhaSClinico[6])).toBeCloseTo(246_000, 5);
    expect(Number(linhaSClinico[7])).toBeCloseTo(123_000, 5);
    expect(Number(linhaSClinico[8])).toBe(0);
    expect(linhaSClinico[9]).toBe("");
  });

  it("fecha com o total da unidade", () => {
    const orcamento = comDoisProjetos();
    const folha = gerarWorkbookVistaGeral(orcamento).worksheets[0];
    const total = linhasDaFolha(folha).find((l) => l[0] === "Total da unidade")!;

    // 4 pessoas: 2 + 1 interno no SClínico, 1 no RSE.
    expect(Number(total[total.length - 4])).toBe(4);
    expect(Number(total[total.length - 3])).toBe(100);
    expect(Number(total[total.length - 2])).toBeCloseTo(
      Number(total[6]) + Number(total[7]) + Number(total[8]) + Number(total[9]),
      5,
    );
  });

  it("os euros e a percentagem saem com formato de número, e não como texto", () => {
    const folha = gerarWorkbookVistaGeral(comDoisProjetos()).worksheets[0];
    let linha = 0;
    for (let n = 1; n <= folha.rowCount; n++) {
      if (folha.getCell(n, 1).value === "SClínico") {
        linha = n;
        break;
      }
    }
    expect(linha).toBeGreaterThan(0);

    expect(folha.getCell(linha, 7).numFmt).toContain("€");
    expect(typeof folha.getCell(linha, 7).value).toBe("number");
    // Com quatro anos: 11 é o total de pessoas, 12 a percentagem, 13 o valor do projeto.
    expect(folha.getCell(linha, 12).numFmt).toContain("%");
    expect(typeof folha.getCell(linha, 12).value).toBe("number");
    expect(folha.getCell(linha, 13).numFmt).toContain("€");
  });

  it("um orçamento vazio dá uma folha legível, sem anos e sem linhas", () => {
    const folha = gerarWorkbookVistaGeral(orcamentoInicial()).worksheets[0];
    const linhas = linhasDaFolha(folha);

    const cabecalho = linhas.find((l) => l[0] === "Projeto")!;
    expect(cabecalho.filter((t) => t.startsWith("Total € c/ IVA"))).toEqual([]);
    expect(linhas.find((l) => l[0] === "Total da unidade")).toBeDefined();
  });

  it("um projeto sem perfis continua a ocupar uma linha, com as suas pessoas", () => {
    let orcamento = comProjeto(orcamentoInicial(), projetoDeAgrupamento(agrupamento("Vazio", 2027, [])));
    orcamento = comInterno(orcamento, orcamento.projetos[0].id, "Ana Silva");

    const linhas = linhasDaFolha(gerarWorkbookVistaGeral(orcamento).worksheets[0]);
    const doVazio = linhas.filter((l) => l[0] === "Vazio");
    expect(doVazio).toHaveLength(1);
    expect(doVazio[0][2]).toBe("Ana Silva (interno)");
    expect(Number(doVazio[0][doVazio[0].length - 4])).toBe(1);
  });
});
