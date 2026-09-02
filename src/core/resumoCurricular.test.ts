import { describe, expect, it } from "vitest";
import { blocosResumosCurriculares, folhasDoAnexo, TITULO_ANEXO_RESUMOS } from "./resumoCurricular";
import { documentoRegrasEPrecoBase } from "./cadernoEncargos";
import { documentoParaTexto } from "./documento";
import { lotesComPerfis, perfil, requisito } from "./fixtures";
import { TEXTO_NOTA_BLOCO, TEXTO_DECLARACAO_VERACIDADE } from "../excel/layout";
import type { BlocoDocumento } from "./documento";

const CONFIG = lotesComPerfis([
  { numero: "1", perfis: [perfil({ perfil: "Analista", requisitos: [requisito("r1", 12, "Requisito A")] })] },
  { numero: "2", perfis: [perfil({ perfil: "Gestor", requisitos: [requisito("r2", 24, "Requisito B")] })] },
]);

function titulos(blocos: BlocoDocumento[]): string[] {
  return blocos.filter((b) => b.tipo === "titulo").map((b) => (b.tipo === "titulo" ? b.texto : ""));
}

describe("blocosResumosCurriculares", () => {
  const blocos = blocosResumosCurriculares(CONFIG);

  it("reproduz uma folha por perfil de cada lote", () => {
    expect(folhasDoAnexo(CONFIG).map((f) => f.perfil)).toEqual(["Analista", "Gestor"]);
    expect(titulos(blocos)).toContain("Resumo Curricular — Analista");
    expect(titulos(blocos)).toContain("Resumo Curricular — Gestor");
  });

  it("separa as folhas por quebra de página, sem quebra antes da primeira", () => {
    expect(blocos.filter((b) => b.tipo === "quebraDePagina")).toHaveLength(1);

    const primeiraQuebra = blocos.findIndex((b) => b.tipo === "quebraDePagina");
    const segundaFolha = blocos.findIndex(
      (b) => b.tipo === "titulo" && b.texto === "Resumo Curricular — Gestor",
    );
    expect(primeiraQuebra).toBeLessThan(segundaFolha);
    expect(segundaFolha - primeiraQuebra).toBe(1);
  });

  it("reproduz um só bloco de projeto, e diz que o ficheiro comporta os restantes", () => {
    expect(titulos(blocos).filter((t) => t.startsWith("PROJETO"))).toEqual(["PROJETO 1", "PROJETO 1"]);
    expect(documentoParaTexto({ titulo: "x", blocos })).toContain(
      `O ficheiro comporta ${CONFIG.nBlocos} Projetos por perfil`,
    );
  });

  it("traz a identificação com o perfil e o lote já preenchidos", () => {
    const texto = documentoParaTexto({ titulo: "x", blocos });
    expect(texto).toContain("Perfil a que se candidata");
    expect(texto).toContain("Entidade concorrente");
    expect(texto).toContain("Designação do lote");
    expect(texto).toContain("Lote 1");
    expect(texto).toContain("Assinatura digital do perfil");
    expect(texto).toContain(TEXTO_DECLARACAO_VERACIDADE);
  });

  it("lista os requisitos do perfil, com as colunas do formulário", () => {
    const tabelas = blocos.filter((b) => b.tipo === "tabela");
    const requisitos = tabelas.find(
      (b) => b.tipo === "tabela" && b.colunas[0].titulo === "Requisito",
    );
    expect(requisitos?.tipo === "tabela" ? requisitos.colunas.map((c) => c.titulo) : []).toEqual([
      "Requisito",
      "Declara experiência?",
      "Início da experiência — Mês",
      "Início da experiência — Ano",
      "Fim da experiência — Mês",
      "Fim da experiência — Ano",
    ]);
    expect(requisitos?.tipo === "tabela" ? requisitos.linhas.map((l) => l[0].texto) : []).toEqual([
      "Requisito A",
    ]);
  });

  it("fecha cada folha com a nota do bloco", () => {
    expect(blocos.filter((b) => b.tipo === "nota" && b.texto === TEXTO_NOTA_BLOCO)).toHaveLength(2);
  });

  it("não existe quando não há perfis em lote algum", () => {
    expect(blocosResumosCurriculares(lotesComPerfis([{ numero: "1", perfis: [] }]))).toEqual([]);
  });
});

describe("anexo dos resumos no documento das regras", () => {
  it("entra no fim, com título próprio e numa página nova", () => {
    const blocos = documentoRegrasEPrecoBase(CONFIG).blocos;
    const titulo = blocos.findIndex((b) => b.tipo === "titulo" && b.texto === TITULO_ANEXO_RESUMOS);

    expect(titulo).toBeGreaterThan(0);
    expect(blocos[titulo - 1].tipo).toBe("quebraDePagina");
    expect(titulos(blocos.slice(titulo))).toContain("Resumo Curricular — Analista");
  });
});
