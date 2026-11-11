import { describe, expect, it } from "vitest";
import { importarProjetoJSON, projetoParaJSON } from "./projetoJSON";
import { ErroImportacao, perfisParaJSON } from "./perfil";
import { lotesParaJSON } from "./lotes";
import { JUSTIFICACAO_EXEMPLO, LOTES_EXEMPLO, PERFIS_EXEMPLO } from "./exemplo";
import { justificacaoInicial } from "./justificacao";

describe("ficheiro do projeto", () => {
  it("leva só a caracterização, e volta igual", () => {
    const texto = projetoParaJSON("Projeto X", "fazer X", JUSTIFICACAO_EXEMPLO);
    const bruto = JSON.parse(texto);
    expect(bruto.tipo).toBe("projeto");
    expect(Object.keys(bruto).sort()).toEqual(
      ["descricaoProjeto", "justificacao", "nomeProjeto", "schemaVersion", "tipo"].sort(),
    );
    expect(importarProjetoJSON(texto)).toEqual({
      nomeProjeto: "Projeto X",
      descricaoProjeto: "fazer X",
      justificacao: JUSTIFICACAO_EXEMPLO,
      origem: "projeto",
    });
  });

  it("tira o projeto do JSON dos perfis", () => {
    const texto = perfisParaJSON(PERFIS_EXEMPLO, "Dos perfis", "desc", JUSTIFICACAO_EXEMPLO);
    expect(importarProjetoJSON(texto)).toMatchObject({ nomeProjeto: "Dos perfis", origem: "perfis" });
  });

  it("tira o projeto do JSON dos lotes", () => {
    const texto = lotesParaJSON({ ...LOTES_EXEMPLO, nomeProjeto: "Dos lotes", descricaoProjeto: "d" });
    expect(importarProjetoJSON(texto)).toMatchObject({
      nomeProjeto: "Dos lotes",
      descricaoProjeto: "d",
      origem: "lotes",
    });
  });

  it("um ficheiro do projeto sem listas abre com as listas vazias", () => {
    const { justificacao: _j, ...sem } = JSON.parse(projetoParaJSON("P", "d", JUSTIFICACAO_EXEMPLO));
    expect(importarProjetoJSON(JSON.stringify(sem)).justificacao).toEqual(justificacaoInicial());
  });

  it("recusa outros ficheiros com uma mensagem clara", () => {
    expect(() => importarProjetoJSON("não é json")).toThrow(ErroImportacao);
    expect(() => importarProjetoJSON(JSON.stringify({ tipo: "orcamentoUnidade" }))).toThrow(
      /projeto, dos perfis ou dos lotes/,
    );
    expect(() =>
      importarProjetoJSON(JSON.stringify({ tipo: "projeto", schemaVersion: "0.1", nomeProjeto: "x" })),
    ).toThrow(/Versão de esquema/);
  });
});
