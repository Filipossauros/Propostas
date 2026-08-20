import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import type { EspecificacaoFormulario } from "../core/types";
import { configAvaliacao, requisito } from "../core/fixtures";
import { PERFIS_EXEMPLO } from "../core/exemplo";
import { CAMPOS_IDENTIFICACAO, alturaBloco, linhaInicialBloco, nomeFolhaPerfil } from "./layout";
import { gerarWorkbookDeclaracao } from "./gerar";
import { lerDeclaracaoExcel } from "./ler";

const NOME_PERFIL = "Arquiteto / Programador Sénior — Integração";

function perfilExemplo(overrides: Partial<EspecificacaoFormulario> = {}): EspecificacaoFormulario {
  return {
    perfil: NOME_PERFIL,
    nBlocos: 3,
    requisitos: [
      requisito("r1", 120, "Desenvolvimento de software (geral)"),
      requisito("r2", 60, "Java (versão 8 ou superior)"),
      requisito("r3", 60, "Desenvolvimento de APIs"),
    ],
    ...overrides,
  };
}

/** A folha do perfil, procurada pelo nome que o gerador lhe dá. */
function folhaDe(wb: ReturnType<typeof gerarWorkbookDeclaracao>, designacao = NOME_PERFIL) {
  return wb.getWorksheet(nomeFolhaPerfil(designacao))!;
}

describe("gerarWorkbookDeclaracao", () => {
  it("gera Leia-me, Listas oculta e uma folha para o perfil", () => {
    const wb = gerarWorkbookDeclaracao([perfilExemplo()]);

    expect(wb.worksheets.map((s) => s.name)).toEqual(["Leia-me", "Listas", nomeFolhaPerfil(NOME_PERFIL)]);
    expect(wb.getWorksheet("Listas")!.state).toBe("hidden");
    expect(folhaDe(wb).state).not.toBe("hidden");
  });

  it("gera uma folha por perfil, num ficheiro único", () => {
    const wb = gerarWorkbookDeclaracao([
      perfilExemplo({ perfil: "Programador" }),
      perfilExemplo({ perfil: "Analista" }),
    ]);

    expect(wb.worksheets.map((s) => s.name)).toEqual(["Leia-me", "Listas", "Programador", "Analista"]);
  });

  it("lista os perfis no Leia-me quando há mais do que um", () => {
    const wb = gerarWorkbookDeclaracao([
      perfilExemplo({ perfil: "Programador" }),
      perfilExemplo({ perfil: "Analista" }),
    ]);
    const leiaMe = wb.getWorksheet("Leia-me")!;
    const texto = leiaMe.getSheetValues().flat().join("\n");

    expect(texto).toContain("Programador");
    expect(texto).toContain("Analista");
  });

  it("recusa gerar um formulário sem perfis", () => {
    expect(() => gerarWorkbookDeclaracao([])).toThrow(/sem perfis|não há perfis/i);
  });

  it("mostra os rótulos de identificação nas âncoras certas", () => {
    const sheet = folhaDe(gerarWorkbookDeclaracao([perfilExemplo()]));

    for (const { linha, rotulo } of CAMPOS_IDENTIFICACAO) {
      expect(sheet.getCell(linha, 1).value).toBe(rotulo);
    }
  });

  it("pré-preenche e bloqueia o campo Perfil, sempre — o candidato não o edita", () => {
    const sheet = folhaDe(gerarWorkbookDeclaracao([perfilExemplo()]));
    const linhaPerfil = CAMPOS_IDENTIFICACAO.find((c) => c.campo === "perfil")!;

    expect(sheet.getCell(linhaPerfil.linha, 2).value).toBe(NOME_PERFIL);
  });

  it("deixa os campos de lote em branco e editáveis quando o formulário vem do Módulo 1", () => {
    const sheet = folhaDe(gerarWorkbookDeclaracao([perfilExemplo()]));

    for (const campo of ["lote", "loteDesignacao"] as const) {
      const linha = CAMPOS_IDENTIFICACAO.find((c) => c.campo === campo)!.linha;
      expect(sheet.getCell(linha, 2).value).toBeFalsy();
      expect(sheet.getCell(linha, 2).protection?.locked).toBe(false);
    }
  });

  it("pré-preenche e bloqueia o número e a designação do lote quando o formulário vem do Módulo 2", () => {
    const especificacao = perfilExemplo({ lote: "3", loteDesignacao: "Integração e dados" });
    const sheet = folhaDe(gerarWorkbookDeclaracao([especificacao]));
    const linhaLote = CAMPOS_IDENTIFICACAO.find((c) => c.campo === "lote")!;
    const linhaDesignacao = CAMPOS_IDENTIFICACAO.find((c) => c.campo === "loteDesignacao")!;

    expect(sheet.getCell(linhaLote.linha, 2).value).toBe("3");
    expect(sheet.getCell(linhaLote.linha, 2).protection?.locked).not.toBe(false);
    expect(sheet.getCell(linhaDesignacao.linha, 2).value).toBe("Integração e dados");
    expect(sheet.getCell(linhaDesignacao.linha, 2).protection?.locked).not.toBe(false);
  });

  it("o subtítulo é só o perfil — é por ele que a folha é localizada na leitura", () => {
    expect(folhaDe(gerarWorkbookDeclaracao([perfilExemplo()])).getCell(2, 1).value).toBe(NOME_PERFIL);
  });

  it("mantém o procedimento como campo que o candidato preenche", () => {
    const sheet = folhaDe(gerarWorkbookDeclaracao([perfilExemplo()]));
    const linhaProcedimento = CAMPOS_IDENTIFICACAO.find((c) => c.campo === "procedimento")!;

    expect(sheet.getCell(linhaProcedimento.linha, 1).value).toBe("Procedimento n.º");
    expect(sheet.getCell(linhaProcedimento.linha, 2).value).toBeFalsy();
  });

  it("coloca as faixas de bloco e as designações nas âncoras corretas", () => {
    const p = perfilExemplo();
    const sheet = folhaDe(gerarWorkbookDeclaracao([p]));
    const nReq = p.requisitos.length;

    for (let i = 1; i <= p.nBlocos; i++) {
      const linhaInicial = linhaInicialBloco(i, nReq);
      expect(sheet.getCell(linhaInicial, 1).value).toBe(`PROJETO ${i}`);
      p.requisitos.forEach((req, idx) => {
        expect(sheet.getCell(linhaInicial + 6 + idx, 1).value).toBe(req.designacao);
      });
    }

    expect(alturaBloco(nReq)).toBe(8 + nReq);
  });

  it("não gera qualquer folha de metadados", () => {
    const nomes = gerarWorkbookDeclaracao([perfilExemplo()]).worksheets.map((s) => s.name.toLowerCase());
    for (const nome of nomes) {
      expect(nome).not.toMatch(/metadado|config|__/);
    }
  });

  it("o ficheiro gerado é lido de volta pelo parser sem alertas estruturais", async () => {
    const p = perfilExemplo();
    const buffer = await gerarWorkbookDeclaracao([p]).xlsx.writeBuffer();
    const config = configAvaliacao({ perfil: p.perfil, nBlocos: p.nBlocos, requisitos: p.requisitos });

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

  it("num ficheiro com vários perfis, o parser lê a folha do perfil que está a avaliar", async () => {
    const analista = perfilExemplo({ perfil: "Analista", requisitos: [requisito("a1", 24, "Análise funcional")] });
    const buffer = await gerarWorkbookDeclaracao([perfilExemplo({ perfil: "Programador" }), analista]).xlsx.writeBuffer();

    const { declaracao, estruturaValida } = lerDeclaracaoExcel(
      "teste.xlsx",
      XLSX.read(buffer, { type: "array" }),
      configAvaliacao({ perfil: "Analista", nBlocos: analista.nBlocos, requisitos: analista.requisitos }),
    );

    expect(estruturaValida).toBe(true);
    expect(declaracao.identificacao.perfil).toBe("Analista");
    expect(declaracao.blocos[0].linhas.map((l) => l.requisitoId)).toEqual(["a1"]);
  });

  it("assinala requisitos divergentes quando a configuração não corresponde ao ficheiro", async () => {
    const buffer = await gerarWorkbookDeclaracao([perfilExemplo()]).xlsx.writeBuffer();
    const outraConfig = configAvaliacao({
      perfil: NOME_PERFIL,
      nBlocos: 3,
      requisitos: [requisito("x1", 12, "Outra coisa")],
    });

    const { estruturaValida, declaracao } = lerDeclaracaoExcel(
      "teste.xlsx",
      XLSX.read(buffer, { type: "array" }),
      outraConfig,
    );

    expect(estruturaValida).toBe(false);
    expect(declaracao.alertas.some((a) => a.tipo === "requisitosDivergentes")).toBe(true);
  });
});

describe("matéria que não chega ao formulário", () => {
  /** Todo o texto de todas as folhas do livro, incluindo o Leia-me. */
  function textoDoLivro(wb: ReturnType<typeof gerarWorkbookDeclaracao>): string {
    return wb.worksheets.map((folha) => folha.getSheetValues().flat().join("\n")).join("\n");
  }

  it("não leva as certificações exigidas, que se verificam fora desta ferramenta", () => {
    const comCertificacao = PERFIS_EXEMPLO.filter((p) => p.certificacoes.length > 0);
    expect(comCertificacao.length).toBeGreaterThan(0);

    const wb = gerarWorkbookDeclaracao(
      PERFIS_EXEMPLO.map((p) => ({ perfil: p.perfil, nBlocos: p.nBlocos, requisitos: p.requisitos })),
    );
    const texto = textoDoLivro(wb);

    for (const p of comCertificacao) {
      for (const certificacao of p.certificacoes) {
        expect(texto).not.toContain(certificacao.designacao);
      }
    }
  });

  it("também não leva o conteúdo funcional, pela mesma razão", () => {
    const wb = gerarWorkbookDeclaracao(
      PERFIS_EXEMPLO.map((p) => ({ perfil: p.perfil, nBlocos: p.nBlocos, requisitos: p.requisitos })),
    );
    const texto = textoDoLivro(wb);

    for (const p of PERFIS_EXEMPLO) {
      expect(texto).not.toContain(p.conteudoFuncional.split(";")[0].trim());
    }
  });
});

describe("nomeFolhaPerfil", () => {
  it("trunca aos 31 carateres que o Excel admite", () => {
    expect(nomeFolhaPerfil("a".repeat(60))).toHaveLength(31);
  });

  it("substitui os carateres que o Excel não admite em nomes de folha", () => {
    expect(nomeFolhaPerfil("Dados: [ETL] / BI")).not.toMatch(/[:\\/?*[\]]/);
  });

  it("distingue designações que colidem depois de truncadas", () => {
    const usados = new Set<string>();
    const primeiro = nomeFolhaPerfil("b".repeat(40), usados);
    const segundo = nomeFolhaPerfil("b".repeat(40), usados);

    expect(segundo).not.toBe(primeiro);
    expect(segundo.length).toBeLessThanOrEqual(31);
  });
});
