import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import type { ConfiguracaoJSON } from "../core/types";
import { alturaBloco, linhaInicialBloco } from "./layout";
import { gerarWorkbookDeclaracao } from "./gerar";
import { lerDeclaracaoExcel } from "./ler";

function configExemplo(): ConfiguracaoJSON {
  return {
    schemaVersion: "1.0",
    templateVersion: "5.0",
    procedimento: "20270001",
    lote: "1",
    perfil: "Arquiteto / Programador Sénior — Integração",
    nMinimoElementos: 2,
    dataLimitePropostas: "2027-03-31",
    nBlocos: 3,
    requisitos: [
      { id: "r1", designacao: "Desenvolvimento de software (geral)", versaoMinima: null, mesesMinimos: 120 },
      { id: "r2", designacao: "Java (versão 8 ou superior)", versaoMinima: "8", mesesMinimos: 60 },
      { id: "r3", designacao: "Desenvolvimento de APIs", versaoMinima: null, mesesMinimos: 60 },
    ],
  };
}

describe("gerarWorkbookDeclaracao", () => {
  it("gera as 3 folhas com os nomes e visibilidade esperados", () => {
    const wb = gerarWorkbookDeclaracao(configExemplo());
    const nomes = wb.worksheets.map((s) => s.name);
    expect(nomes).toEqual(["Leia-me", "Listas", "Experiência"]);
    expect(wb.getWorksheet("Listas")!.state).toBe("hidden");
    expect(wb.getWorksheet("Leia-me")!.state).not.toBe("hidden");
    expect(wb.getWorksheet("Experiência")!.state).not.toBe("hidden");
  });

  it("coloca as faixas de bloco e as designações de requisito nas âncoras corretas", () => {
    const config = configExemplo();
    const wb = gerarWorkbookDeclaracao(config);
    const sheet = wb.getWorksheet("Experiência")!;
    const nReq = config.requisitos.length;

    for (let i = 1; i <= config.nBlocos; i++) {
      const linhaInicial = linhaInicialBloco(i, nReq);
      expect(sheet.getCell(linhaInicial, 1).value).toBe(`PROJETO ${i}`);
      config.requisitos.forEach((req, idx) => {
        const linhaReq = linhaInicial + 5 + idx;
        expect(sheet.getCell(linhaReq, 1).value).toBe(req.designacao);
      });
    }

    expect(alturaBloco(nReq)).toBe(7 + nReq);
  });

  it("as folhas do ficheiro gerado não contêm qualquer folha de metadados", () => {
    const wb = gerarWorkbookDeclaracao(configExemplo());
    const nomes = wb.worksheets.map((s) => s.name.toLowerCase());
    for (const nome of nomes) {
      expect(nome).not.toMatch(/metadado|config|__/);
    }
  });

  it("o ficheiro gerado é lido de volta pelo parser sem alertas estruturais", async () => {
    const config = configExemplo();
    const wb = gerarWorkbookDeclaracao(config);
    const buffer = await wb.xlsx.writeBuffer();

    const workbookLido = XLSX.read(buffer, { type: "array" });
    const { declaracao, estruturaValida } = lerDeclaracaoExcel("teste.xlsx", workbookLido, config);

    expect(estruturaValida).toBe(true);
    expect(declaracao.alertas).toHaveLength(0);
    expect(declaracao.blocos).toHaveLength(config.nBlocos);
    expect(declaracao.blocos[0].linhas.map((l) => l.requisitoId)).toEqual(
      config.requisitos.map((r) => r.id),
    );
  });
});
