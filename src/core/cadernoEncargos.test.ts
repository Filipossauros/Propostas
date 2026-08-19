import { describe, expect, it } from "vitest";
import { documentoCadernoEncargos, documentoProgramaConcurso } from "./cadernoEncargos";
import { documentoParaTexto } from "./documento";
import { LOTES_EXEMPLO } from "./exemplo";
import { lotesComPerfis, perfil, requisito } from "./fixtures";
import { mesesDeAnos } from "./types";

describe("documentoCadernoEncargos", () => {
  const doc = documentoCadernoEncargos(LOTES_EXEMPLO);

  it("apresenta o preço base numa tabela, com e sem IVA", () => {
    const tabela = doc.blocos.find((b) => b.tipo === "tabela");
    expect(tabela).toBeDefined();

    const titulos = tabela!.tipo === "tabela" ? tabela!.colunas.map((c) => c.titulo) : [];
    expect(titulos).toContain("Preço/hora (s/ IVA)");
    expect(titulos).toContain("Preço base (s/ IVA)");
    expect(titulos).toContain("Preço base (c/ IVA)");
  });

  it("diz explicitamente que os preços unitários são sem IVA", () => {
    const tabela = doc.blocos.find((b) => b.tipo === "tabela");
    expect(tabela!.tipo === "tabela" ? tabela!.legenda : "").toMatch(/sem IVA/i);
  });

  it("exprime a exigência em anos e em meses", () => {
    const config = lotesComPerfis([
      { numero: "1", perfis: [perfil({ requisitos: [requisito("r1", mesesDeAnos(10), "Java")] })] },
    ]);
    const texto = documentoParaTexto(documentoCadernoEncargos(config));

    expect(texto).toContain("10 anos");
    expect(texto).toContain("120");
  });
});

describe("documentoProgramaConcurso", () => {
  const texto = documentoParaTexto(documentoProgramaConcurso(LOTES_EXEMPLO));

  it("cobre comprovação, exclusão e regra de apuramento", () => {
    expect(texto).toContain("Comprovação da experiência profissional");
    expect(texto).toContain("Exclusão");
    expect(texto).toContain("Regra de apuramento da experiência");
  });

  it("não estrutura o conteúdo em artigos — isso fica para a redação das peças", () => {
    expect(texto).not.toMatch(/Artigo\s*\[?\s*\]?\s*\.º/i);
  });

  it("não invoca versões mínimas de requisito, que o modelo já não tem", () => {
    expect(texto).not.toMatch(/versão mínima/i);
  });

  it("indica o n.º de blocos quando é igual em todos os perfis", () => {
    const config = lotesComPerfis([{ numero: "1", perfis: [perfil({ nBlocos: 15 })] }]);
    expect(documentoParaTexto(documentoProgramaConcurso(config))).toContain("comporta 15 blocos");
  });

  it("evita afirmar um n.º de blocos quando os perfis divergem", () => {
    const config = lotesComPerfis([
      { numero: "1", perfis: [perfil({ nBlocos: 15 }), perfil({ perfil: "Outro", nBlocos: 20 })] },
    ]);
    const gerado = documentoParaTexto(documentoProgramaConcurso(config));

    expect(gerado).not.toContain("comporta 15 blocos");
    expect(gerado).toContain("número de blocos de projeto nele previsto");
  });

  it("inclui os exemplos de apuramento das normas", () => {
    expect(texto).toContain("31 meses");
    expect(texto).toContain("contados uma única vez");
  });
});

describe("documentoParaTexto", () => {
  it("desenha as tabelas com molduras, para serem legíveis em texto simples", () => {
    const texto = documentoParaTexto(documentoCadernoEncargos(LOTES_EXEMPLO));
    expect(texto).toMatch(/\+-+\+/);
    expect(texto).toMatch(/\|.+\|/);
  });
});
