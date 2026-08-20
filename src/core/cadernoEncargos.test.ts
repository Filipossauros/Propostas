import { describe, expect, it } from "vitest";
import { documentoRegrasEPrecoBase } from "./cadernoEncargos";
import { documentoParaTexto } from "./documento";
import { LOTES_EXEMPLO } from "./exemplo";
import { lotesComPerfis, perfil, requisito } from "./fixtures";
import { mesesDeAnos } from "./types";

describe("documentoRegrasEPrecoBase", () => {
  const doc = documentoRegrasEPrecoBase(LOTES_EXEMPLO);
  const texto = documentoParaTexto(doc);

  it("tem um único título, o das regras", () => {
    expect(doc.titulo).toBe("Regras de comprovação e apuramento da experiência profissional");
    expect(doc.subtitulo).toBeUndefined();
  });

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
    const gerado = documentoParaTexto(documentoRegrasEPrecoBase(config));

    expect(gerado).toContain("10 anos");
    expect(gerado).toContain("120");
  });

  it("cobre preço base, requisitos, comprovação, exclusão e regra de apuramento", () => {
    expect(texto).toContain("Preço base");
    expect(texto).toContain("Requisitos mínimos de experiência profissional");
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
    expect(documentoParaTexto(documentoRegrasEPrecoBase(config))).toContain("comporta 15 blocos");
  });

  it("evita afirmar um n.º de blocos quando os perfis divergem", () => {
    const config = lotesComPerfis([
      { numero: "1", perfis: [perfil({ nBlocos: 15 }), perfil({ perfil: "Outro", nBlocos: 20 })] },
    ]);
    const gerado = documentoParaTexto(documentoRegrasEPrecoBase(config));

    expect(gerado).not.toContain("comporta 15 blocos");
    expect(gerado).toContain("número de blocos de projeto nele previsto");
  });
});

describe("normas de nulidade da experiência", () => {
  const texto = documentoParaTexto(documentoRegrasEPrecoBase(LOTES_EXEMPLO));

  it("não repete meses sobrepostos entre projetos declarados para o mesmo requisito", () => {
    expect(texto).toContain("contabilizados apenas uma vez");
  });

  it("não admite experiência para além da data limite de apresentação de propostas", () => {
    expect(texto).toContain("data limite fixada para a apresentação das propostas");
  });

  it("anula a experiência do bloco de projeto incompleto", () => {
    expect(texto).toContain("não identifique o cliente ou entidade");
  });

  it("anula a experiência da linha com datas parcialmente preenchidas", () => {
    expect(texto).toContain("parcialmente preenchidos");
  });

  it("trata o requisito sem SIM/NÃO como experiência não declarada, e não como causa de exclusão", () => {
    expect(texto).toContain("não contenha a indicação «SIM» ou «NÃO»");
    expect(texto).not.toContain("A existência, em bloco de projeto preenchido");
  });

  it("manda datar o fim do projeto em curso pelo mês do preenchimento", () => {
    expect(texto).toContain("indica-se como fim do projeto o mês e o ano em que o formulário é preenchido");
  });
});

describe("documentoParaTexto", () => {
  it("desenha as tabelas com molduras, para serem legíveis em texto simples", () => {
    const texto = documentoParaTexto(documentoRegrasEPrecoBase(LOTES_EXEMPLO));
    expect(texto).toMatch(/\+-+\+/);
    expect(texto).toMatch(/\|.+\|/);
  });
});
