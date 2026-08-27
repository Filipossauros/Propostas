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

function folhas(orcamento: OrcamentoUnidade) {
  const livro = gerarWorkbookVistaGeral(orcamento);
  return { livro, resumo: livro.worksheets[0], detalhe: livro.worksheets[1] };
}

describe("gerarWorkbookVistaGeral", () => {
  it("tem duas folhas, o resumo primeiro", () => {
    const { livro } = folhas(comDoisProjetos());
    expect(livro.worksheets.map((f) => f.name)).toEqual(["Resumo geral", "Detalhe por projeto"]);
    expect(livro.title).toBe("Vista geral — Unidade de Sistemas");
  });

  describe("folha do resumo", () => {
    it("é só sobre pessoas: sem coluna de valor", () => {
      const { resumo } = folhas(comDoisProjetos());
      const cabecalho = linhasDaFolha(resumo).find((l) => l[0] === "Projeto")!;

      expect(cabecalho).toEqual(["Projeto", "Elementos externos", "Elementos internos", "Total", "% na unidade"]);
      expect(cabecalho.some((t) => t.includes("Valor"))).toBe(false);
    });

    it("um projeto por linha, com externos, internos, total e fatia da unidade", () => {
      const { resumo } = folhas(comDoisProjetos());
      const linhas = linhasDaFolha(resumo);

      // 3 pessoas no SClínico (2 do perfil + 1 interno) e 1 no RSE, em 4.
      const sclinico = linhas.find((l) => l[0] === "SClínico")!;
      expect([sclinico[1], sclinico[2], sclinico[3]].map(Number)).toEqual([2, 1, 3]);
      expect(Number(sclinico[4])).toBeCloseTo(75, 6);

      const rse = linhas.find((l) => l[0] === "RSE")!;
      expect([rse[1], rse[2], rse[3]].map(Number)).toEqual([1, 0, 1]);
      expect(Number(rse[4])).toBeCloseTo(25, 6);
    });

    it("fecha com o total da unidade", () => {
      const { resumo } = folhas(comDoisProjetos());
      const total = linhasDaFolha(resumo).find((l) => l[0] === "Total da unidade")!;

      expect([total[1], total[2], total[3]].map(Number)).toEqual([3, 1, 4]);
      expect(Number(total[4])).toBe(100);
    });

    it("os números saem com formato, e não como texto", () => {
      const { resumo } = folhas(comDoisProjetos());
      const linha = linhaCom(resumo, "SClínico");

      for (const coluna of [2, 3, 4]) expect(typeof resumo.getCell(linha, coluna).value).toBe("number");
      expect(resumo.getCell(linha, 5).numFmt).toContain("%");
      // E nenhuma coluna em euros: o resumo deixou de falar de dinheiro.
      expect([2, 3, 4, 5].some((c) => (resumo.getCell(linha, c).numFmt ?? "").includes("€"))).toBe(false);
    });
  });

  describe("folha do detalhe", () => {
    it("leva as colunas pedidas, sem a rate sem IVA e sem as do projeto", () => {
      const { detalhe } = folhas(comDoisProjetos());
      const cabecalho = linhasDaFolha(detalhe).find((l) => l[0] === "Projeto")!;

      expect(cabecalho.slice(0, 5)).toEqual(["Projeto", "Lotes", "Perfil", "Pessoas", "Rate (€/h) c/ IVA"]);
      expect(cabecalho.some((t) => t.includes("s/ IVA"))).toBe(false);
      expect(cabecalho.some((t) => t === "Total Pessoas" || t === "% na unidade")).toBe(false);
      // 2027 a 2030: o primeiro projeto começa em 2027, o segundo em 2028.
      expect(cabecalho.filter((t) => t.startsWith("Total € c/ IVA"))).toEqual([
        "Total € c/ IVA\n(11 meses)\n2027",
        "Total € c/ IVA\n(11 meses)\n2028",
        "Total € c/ IVA\n(11 meses)\n2029",
        "Total € c/ IVA\n(11 meses)\n2030",
      ]);
    });

    it("uma linha por perfil e por elemento interno, com o projeto em cada uma", () => {
      const { detalhe } = folhas(comDoisProjetos());
      const doSClinico = linhasDaFolha(detalhe).filter((l) => l[0] === "SClínico");

      expect(doSClinico).toHaveLength(2);
      expect(doSClinico.map((l) => l[2])).toEqual(["Programador", "Ana Silva (interno)"]);
      // A coluna «Pessoas» é agora a quarta; o lote fica em branco no interno.
      expect(doSClinico.map((l) => l[3])).toEqual(["2", "1"]);
      expect(doSClinico.map((l) => l[1])).toEqual(["1", ""]);
    });

    it("os valores dos anos são números, e caem nos anos do projeto", () => {
      const { detalhe } = folhas(comDoisProjetos());
      const linha = linhasDaFolha(detalhe).find((l) => l[0] === "SClínico" && l[2] === "Programador")!;

      // Colunas 6 a 9 são 2027, 2028, 2029 e 2030. O projeto começa em 2027.
      expect(Number(linha[5])).toBeCloseTo(246_000, 5);
      expect(Number(linha[6])).toBeCloseTo(123_000, 5);
      expect(Number(linha[7])).toBe(0);
      expect(linha[8]).toBe("");
    });

    it("a rate que sai é a que tem IVA", () => {
      const { detalhe } = folhas(comDoisProjetos());
      const linha = linhaCom(detalhe, "SClínico");
      expect(Number(detalhe.getCell(linha, 5).value)).toBeCloseTo(123, 6);
      expect(detalhe.getCell(linha, 5).numFmt).toContain("€");
    });

    it("fecha com o total da unidade por ano, com IVA e sem IVA", () => {
      const orcamento = comDoisProjetos();
      const { detalhe } = folhas(orcamento);
      const linhas = linhasDaFolha(detalhe);

      const comIva = linhas.find((l) => l[0] === "Total da unidade (c/ IVA)")!;
      const semIva = linhas.find((l) => l[0] === "Total da unidade (s/ IVA)")!;
      // O sem IVA vem logo a seguir, e não a meio da tabela.
      expect(linhas.indexOf(semIva)).toBe(linhas.indexOf(comIva) + 1);

      const soma = (linha: string[]) => [5, 6, 7, 8].reduce((s, i) => s + Number(linha[i] || 0), 0);
      expect(soma(comIva)).toBeGreaterThan(0);
      // A taxa do exemplo é de 23%: o sem IVA é o com IVA a dividir por 1,23.
      expect(soma(semIva)).toBeCloseTo(soma(comIva) / 1.23, 5);
    });

    it("só o total leva as duas versões; as linhas dos perfis continuam com uma", () => {
      const { detalhe } = folhas(comDoisProjetos());
      const linhas = linhasDaFolha(detalhe);

      expect(linhas.filter((l) => l[0].startsWith("Total da unidade"))).toHaveLength(2);
      expect(linhas.filter((l) => l.some((c) => c.includes("s/ IVA")))).toHaveLength(1);
    });
  });

  it("um orçamento vazio dá duas folhas legíveis, sem linhas", () => {
    const { resumo, detalhe } = folhas(orcamentoInicial());

    expect(linhasDaFolha(resumo).find((l) => l[0] === "Total da unidade")).toBeDefined();
    const cabecalho = linhasDaFolha(detalhe).find((l) => l[0] === "Projeto")!;
    expect(cabecalho.filter((t) => t.startsWith("Total € c/ IVA"))).toEqual([]);
  });

  it("um projeto sem perfis continua a ocupar uma linha em cada folha", () => {
    let orcamento = comProjeto(orcamentoInicial(), projetoDeAgrupamento(agrupamento("Vazio", 2027, [])));
    orcamento = comInterno(orcamento, orcamento.projetos[0].id, "Ana Silva");
    const { resumo, detalhe } = folhas(orcamento);

    // Sem perfis não há externos; o interno registado é o total do projeto.
    const noResumo = linhasDaFolha(resumo).find((l) => l[0] === "Vazio")!;
    expect([noResumo[1], noResumo[2], noResumo[3]].map(Number)).toEqual([0, 1, 1]);

    const noDetalhe = linhasDaFolha(detalhe).filter((l) => l[0] === "Vazio");
    expect(noDetalhe).toHaveLength(1);
    expect(noDetalhe[0][2]).toBe("Ana Silva (interno)");
  });
});

/** O número da linha cuja primeira célula tem este texto. */
function linhaCom(folha: ExcelJS.Worksheet, texto: string): number {
  for (let n = 1; n <= folha.rowCount; n++) {
    if (folha.getCell(n, 1).value === texto) return n;
  }
  throw new Error(`sem linha para "${texto}"`);
}
