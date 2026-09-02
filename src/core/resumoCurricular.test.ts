import { describe, expect, it } from "vitest";
import { anexoDosResumos, folhasDoAnexo, TITULO_ANEXO_RESUMOS, type ImagemDaFolha } from "./resumoCurricular";
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

describe("anexoDosResumos, sem imagens", () => {
  const blocos = anexoDosResumos(CONFIG).corpo;

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
    expect(anexoDosResumos(lotesComPerfis([{ numero: "1", perfis: [] }]))).toEqual({ corpo: [], paisagem: [] });
  });
});

describe("anexoDosResumos, com as folhas em imagem", () => {
  const imagens: ImagemDaFolha[] = folhasDoAnexo(CONFIG).map((folha) => ({
    perfil: folha.perfil,
    dados: new Uint8Array([1, 2, 3]),
    largura: 1006,
    altura: 673,
  }));
  const anexo = anexoDosResumos(CONFIG, imagens);

  it("deixa no corpo só a abertura, e as folhas em paisagem", () => {
    expect(anexo.corpo).toHaveLength(1);
    expect(anexo.corpo[0].tipo).toBe("paragrafo");
    expect(anexo.paisagem.filter((b) => b.tipo === "imagem")).toHaveLength(2);
  });

  it("põe uma quebra de página entre folhas, e nenhuma tabela", () => {
    expect(anexo.paisagem.filter((b) => b.tipo === "quebraDePagina")).toHaveLength(1);
    expect(anexo.paisagem.some((b) => b.tipo === "tabela")).toBe(false);
  });

  it("identifica cada imagem pelo perfil que reproduz", () => {
    expect(anexo.paisagem.filter((b) => b.tipo === "imagem").map((b) => (b.tipo === "imagem" ? b.descricao : ""))).toEqual([
      "Resumo Curricular — Analista",
      "Resumo Curricular — Gestor",
    ]);
  });

  it("volta às tabelas quando as imagens não cobrem todas as folhas", () => {
    expect(anexoDosResumos(CONFIG, imagens.slice(0, 1)).paisagem).toEqual([]);
    expect(anexoDosResumos(CONFIG, imagens.slice(0, 1)).corpo.some((b) => b.tipo === "tabela")).toBe(true);
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

  it("com imagens, as folhas vão para a secção em paisagem", () => {
    const imagens: ImagemDaFolha[] = folhasDoAnexo(CONFIG).map((folha) => ({
      perfil: folha.perfil,
      dados: new Uint8Array([1]),
      largura: 1006,
      altura: 673,
    }));
    const doc = documentoRegrasEPrecoBase(CONFIG, imagens);

    expect(titulos(doc.blocos)).toContain(TITULO_ANEXO_RESUMOS);
    expect(doc.blocosEmPaisagem?.filter((b) => b.tipo === "imagem")).toHaveLength(2);
    expect(titulos(doc.blocos)).not.toContain("Resumo Curricular — Analista");
  });
});
