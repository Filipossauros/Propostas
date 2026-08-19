import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { configAvaliacao, perfil, requisito } from "../core/fixtures";
import { CAMPOS_IDENTIFICACAO, alturaBloco, linhaInicialBloco } from "./layout";
import { gerarWorkbookDeclaracao } from "./gerar";
import { lerDeclaracaoExcel } from "./ler";

function perfilExemplo() {
  return perfil({
    perfil: "Arquiteto / Programador Sénior — Integração",
    nBlocos: 3,
    requisitos: [
      requisito("r1", 120, "Desenvolvimento de software (geral)"),
      requisito("r2", 60, "Java (versão 8 ou superior)"),
      requisito("r3", 60, "Desenvolvimento de APIs"),
    ],
  });
}

describe("gerarWorkbookDeclaracao", () => {
  it("gera as 3 folhas com os nomes e visibilidade esperados", () => {
    const wb = gerarWorkbookDeclaracao(perfilExemplo());

    expect(wb.worksheets.map((s) => s.name)).toEqual(["Leia-me", "Listas", "Experiência"]);
    expect(wb.getWorksheet("Listas")!.state).toBe("hidden");
    expect(wb.getWorksheet("Experiência")!.state).not.toBe("hidden");
  });

  it("não inclui qualquer campo de lote na identificação", () => {
    const sheet = gerarWorkbookDeclaracao(perfilExemplo()).getWorksheet("Experiência")!;

    expect(CAMPOS_IDENTIFICACAO.map((c) => c.campo)).not.toContain("lote");
    for (const { linha, rotulo } of CAMPOS_IDENTIFICACAO) {
      expect(sheet.getCell(linha, 1).value).toBe(rotulo);
      expect(String(sheet.getCell(linha, 1).value)).not.toMatch(/lote/i);
    }
  });

  it("o subtítulo é só o perfil — nem procedimento nem lote existem nesta fase", () => {
    const sheet = gerarWorkbookDeclaracao(perfilExemplo()).getWorksheet("Experiência")!;
    expect(sheet.getCell(2, 1).value).toBe("Arquiteto / Programador Sénior — Integração");
  });

  it("mantém o procedimento como campo que o candidato preenche", () => {
    const sheet = gerarWorkbookDeclaracao(perfilExemplo()).getWorksheet("Experiência")!;
    const linhaProcedimento = CAMPOS_IDENTIFICACAO.find((c) => c.campo === "procedimento")!;

    expect(sheet.getCell(linhaProcedimento.linha, 1).value).toBe("Procedimento n.º");
    expect(sheet.getCell(linhaProcedimento.linha, 2).value).toBeFalsy();
  });

  it("coloca as faixas de bloco e as designações nas âncoras corretas", () => {
    const p = perfilExemplo();
    const sheet = gerarWorkbookDeclaracao(p).getWorksheet("Experiência")!;
    const nReq = p.requisitos.length;

    for (let i = 1; i <= p.nBlocos; i++) {
      const linhaInicial = linhaInicialBloco(i, nReq);
      expect(sheet.getCell(linhaInicial, 1).value).toBe(`PROJETO ${i}`);
      p.requisitos.forEach((req, idx) => {
        expect(sheet.getCell(linhaInicial + 5 + idx, 1).value).toBe(req.designacao);
      });
    }

    expect(alturaBloco(nReq)).toBe(7 + nReq);
  });

  it("não gera qualquer folha de metadados", () => {
    const nomes = gerarWorkbookDeclaracao(perfilExemplo()).worksheets.map((s) => s.name.toLowerCase());
    for (const nome of nomes) {
      expect(nome).not.toMatch(/metadado|config|__/);
    }
  });

  it("o ficheiro gerado é lido de volta pelo parser sem alertas estruturais", async () => {
    const p = perfilExemplo();
    const buffer = await gerarWorkbookDeclaracao(p).xlsx.writeBuffer();
    const config = configAvaliacao({ nBlocos: p.nBlocos, requisitos: p.requisitos });

    const { declaracao, estruturaValida } = lerDeclaracaoExcel(
      "teste.xlsx",
      XLSX.read(buffer, { type: "array" }),
      config,
    );

    expect(estruturaValida).toBe(true);
    expect(declaracao.alertas).toHaveLength(0);
    expect(declaracao.blocos).toHaveLength(p.nBlocos);
    expect(declaracao.blocos[0].linhas.map((l) => l.requisitoId)).toEqual(p.requisitos.map((r) => r.id));
  });

  it("assinala requisitos divergentes quando a configuração não corresponde ao ficheiro", async () => {
    const buffer = await gerarWorkbookDeclaracao(perfilExemplo()).xlsx.writeBuffer();
    const outraConfig = configAvaliacao({ nBlocos: 3, requisitos: [requisito("x1", 12, "Outra coisa")] });

    const { estruturaValida, declaracao } = lerDeclaracaoExcel(
      "teste.xlsx",
      XLSX.read(buffer, { type: "array" }),
      outraConfig,
    );

    expect(estruturaValida).toBe(false);
    expect(declaracao.alertas.some((a) => a.tipo === "requisitosDivergentes")).toBe(true);
  });
});
