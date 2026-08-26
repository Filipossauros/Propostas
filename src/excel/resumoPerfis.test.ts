import { describe, expect, it } from "vitest";
import { gerarWorkbookResumoPerfis } from "./resumoPerfis";
import { PERFIS_EXEMPLO } from "../core/exemplo";
import { perfil, requisito, itens, certificacoes } from "../core/fixtures";
import { ATIVIDADE_FIXA, mesesDeAnos } from "../core/types";

/** Todo o texto de uma folha, para procurar sem depender de coordenadas. */
function textoDaFolha(livro: ReturnType<typeof gerarWorkbookResumoPerfis>, nome: string): string {
  const folha = livro.worksheets.find((f) => f.name === nome)!;
  return folha
    .getSheetValues()
    .flat()
    .map((v) => String(v ?? ""))
    .join("\n");
}

describe("gerarWorkbookResumoPerfis", () => {
  it("uma folha por perfil, com o nome do perfil", () => {
    const livro = gerarWorkbookResumoPerfis(PERFIS_EXEMPLO, "Projeto");

    expect(livro.worksheets).toHaveLength(PERFIS_EXEMPLO.length);
    expect(livro.worksheets[0].name).toBe(PERFIS_EXEMPLO[0].perfil.slice(0, 31));
  });

  it("leva os requisitos com a exigência em anos e em meses", () => {
    const p = perfil({
      perfil: "Analista",
      requisitos: [requisito("r1", mesesDeAnos(3), "Análise funcional")],
    });
    const texto = textoDaFolha(gerarWorkbookResumoPerfis([p], "Projeto"), "Analista");

    expect(texto).toContain("Análise funcional");
    expect(texto).toContain("3");
    expect(texto).toContain("36");
  });

  it("leva o conteúdo funcional, com a atividade de fecho", () => {
    const p = perfil({ perfil: "Analista", conteudoFuncional: itens("Levantamento de requisitos") });
    const texto = textoDaFolha(gerarWorkbookResumoPerfis([p], "Projeto"), "Analista");

    expect(texto).toContain("Levantamento de requisitos");
    expect(texto).toContain(ATIVIDADE_FIXA);
  });

  it("leva as formações e certificações — ao contrário do formulário, que as não pode levar", () => {
    const p = perfil({ perfil: "Arquiteto", certificacoes: certificacoes("TOGAF") });
    const texto = textoDaFolha(gerarWorkbookResumoPerfis([p], "Projeto"), "Arquiteto");

    expect(texto).toContain("TOGAF");
  });

  it("e diz quando não há nenhuma, em vez de deixar a secção em branco", () => {
    const p = perfil({ perfil: "Tester", certificacoes: [] });

    expect(textoDaFolha(gerarWorkbookResumoPerfis([p], "Projeto"), "Tester")).toContain(
      "Este perfil não exige formação nem certificação.",
    );
  });

  it("não leva nada de preencher: não é o formulário dos concorrentes", () => {
    const texto = gerarWorkbookResumoPerfis(PERFIS_EXEMPLO, "Projeto")
      .worksheets.map((f) => f.getSheetValues().flat().join("\n"))
      .join("\n");

    expect(texto).not.toContain("Bloco de projeto");
    expect(texto).not.toContain("SIM");
    expect(texto).not.toMatch(/nome do candidato/i);
  });

  it("nomes de folha admissíveis: sem os caracteres que o Excel recusa e até 31", () => {
    const livro = gerarWorkbookResumoPerfis(
      [perfil({ perfil: "Arquiteto / Programador [Sénior] — Integração e Dados" })],
      "Projeto",
    );

    expect(livro.worksheets[0].name).toHaveLength(31);
    expect(livro.worksheets[0].name).not.toMatch(/[[\]:*?/\\]/);
  });

  it("dois perfis com o mesmo nome não colidem numa folha só", () => {
    const livro = gerarWorkbookResumoPerfis([perfil({ perfil: "Tester" }), perfil({ perfil: "Tester" })], "Projeto");

    expect(livro.worksheets.map((f) => f.name)).toEqual(["Tester", "Tester (2)"]);
  });

  it("um perfil sem designação continua a ter folha", () => {
    expect(gerarWorkbookResumoPerfis([perfil({ perfil: "" })], "Projeto").worksheets[0].name).toBe("Perfil 1");
  });
});
