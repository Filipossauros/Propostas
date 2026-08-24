import { describe, expect, it } from "vitest";
import { documentoRegrasEPrecoBase } from "./cadernoEncargos";
import { documentoParaTexto } from "./documento";
import { LOTES_EXEMPLO } from "./exemplo";
import { certificacoes, itens, lotesComPerfis, perfil, requisito } from "./fixtures";
import { mesesDeAnos } from "./types";
import type { LotesJSON } from "./types";

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

  it("reúne todas as regras sob um único título", () => {
    const titulos = doc.blocos.filter((b) => b.tipo === "titulo").map((b) => (b.tipo === "titulo" ? b.texto : ""));

    expect(titulos).toEqual(expect.arrayContaining(["Regras de apuramento da experiência"]));
    for (const removido of [
      "Comprovação da experiência profissional",
      "Exclusão",
      "Correspondência dos períodos declarados",
      "Regra de apuramento da experiência",
    ]) {
      expect(titulos).not.toContain(removido);
    }
  });

  it("as regras de apuramento vão numa única lista numerada, em sequência", () => {
    const idx = doc.blocos.findIndex((b) => b.tipo === "titulo" && b.texto === "Regras de apuramento da experiência");
    const aSeguir = doc.blocos.slice(idx + 1);

    expect(aSeguir.filter((b) => b.tipo === "lista")).toHaveLength(1);
    expect(aSeguir[0].tipo === "lista" && aSeguir[0].numerada).toBe(true);
  });

  it("mantém o preço base e os requisitos como secções próprias", () => {
    expect(texto).toContain("Preço base");
    expect(texto).toContain("Requisitos mínimos de experiência profissional");
  });

  it("conserva as matérias das secções que deixaram de ter título próprio", () => {
    expect(texto).toContain("São excluídas as propostas");
    expect(texto).toContain("tempo de dedicação efetiva");
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

describe("limitação de um lote por concorrente", () => {
  it("só aparece quando a opção está ativa, e com título próprio", () => {
    const semLimite = { ...LOTES_EXEMPLO, umLotePorConcorrente: false };
    const titulo = "Limitação de adjudicação a um lote por concorrente";

    expect(documentoParaTexto(documentoRegrasEPrecoBase(LOTES_EXEMPLO))).toContain(titulo);
    expect(documentoParaTexto(documentoRegrasEPrecoBase(semLimite))).not.toContain(titulo);
  });

  it("fixa a ordem de apreciação, que é o que decide quem fica com o quê", () => {
    expect(documentoParaTexto(documentoRegrasEPrecoBase(LOTES_EXEMPLO))).toContain(
      "ordem crescente do número do lote",
    );
  });
});

describe("conteúdo funcional do perfil", () => {
  it("sai numa tabela própria, uma atividade por linha", () => {
    const config = lotesComPerfis([
      { numero: "1", perfis: [perfil({ conteudoFuncional: itens("Primeira atividade", "Segunda atividade") })] },
    ]);
    const doc = documentoRegrasEPrecoBase(config);
    const tabela = doc.blocos.find(
      (b) => b.tipo === "tabela" && b.colunas[0].titulo === "Conteúdo Funcional do Perfil",
    );

    expect(tabela).toBeDefined();
    expect(tabela!.tipo === "tabela" ? tabela!.linhas.map((l) => l[0].texto) : []).toEqual([
      "Primeira atividade",
      "Segunda atividade",
    ]);
  });
});

describe("certificações do perfil", () => {
  function tabelaDeCertificacoes(...designacoes: string[]) {
    const config = lotesComPerfis([
      { numero: "1", perfis: [perfil({ certificacoes: certificacoes(...designacoes) })] },
    ]);
    return documentoRegrasEPrecoBase(config).blocos.find(
      (b) => b.tipo === "tabela" && b.colunas[0].titulo === "Certificações",
    );
  }

  it("saem numa tabela própria, uma certificação por linha", () => {
    const tabela = tabelaDeCertificacoes("Certificação A", "Certificação B");

    expect(tabela).toBeDefined();
    expect(tabela!.tipo === "tabela" ? tabela!.linhas.map((l) => l[0].texto) : []).toEqual([
      "Certificação A",
      "Certificação B",
    ]);
  });

  it("o campo é opcional: sem certificações não há tabela", () => {
    expect(tabelaDeCertificacoes()).toBeUndefined();
  });

  it("a tabela fica abaixo da dos requisitos mínimos", () => {
    const config = lotesComPerfis([
      { numero: "1", perfis: [perfil({ certificacoes: certificacoes("Certificação A") })] },
    ]);
    const blocos = documentoRegrasEPrecoBase(config).blocos;
    const indice = (titulo: string) =>
      blocos.findIndex((b) => b.tipo === "tabela" && b.colunas[0].titulo === titulo);

    expect(indice("Certificações")).toBeGreaterThan(indice("Requisito"));
  });
});

describe("normas de nulidade da experiência", () => {
  const texto = documentoParaTexto(documentoRegrasEPrecoBase(LOTES_EXEMPLO));

  it("não repete meses sobrepostos entre projetos declarados para o mesmo requisito", () => {
    expect(texto).toContain("contabilizados apenas uma vez");
  });

  it("não admite experiência para além do mês do preenchimento", () => {
    expect(texto).toContain("para além do mês e ano em que o formulário é preenchido");
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

describe("posto de trabalho", () => {
  function documento(posto: Partial<LotesJSON["postoTrabalho"]> = {}) {
    const base = lotesComPerfis([{ numero: "1", perfis: [perfil()] }]);
    return documentoRegrasEPrecoBase({ ...base, postoTrabalho: { ...base.postoTrabalho, ...posto } });
  }

  /** A tabela que se segue ao título "Posto de trabalho". */
  function tabelaDasCondicoes(doc: ReturnType<typeof documento>) {
    const blocos = doc.blocos;
    const idx = blocos.findIndex((b) => b.tipo === "titulo" && b.texto === "Posto de trabalho");
    const seguinte = blocos[idx + 1];
    if (seguinte?.tipo !== "tabela") throw new Error("o posto de trabalho não sai em tabela");
    return seguinte;
  }

  function condicoes(doc: ReturnType<typeof documento>): Record<string, string> {
    return Object.fromEntries(tabelaDasCondicoes(doc).linhas.map((l) => [l[0].texto, l[1].texto]));
  }

  it("sai como secção própria do documento", () => {
    expect(documento().blocos.some((b) => b.tipo === "titulo" && b.texto === "Posto de trabalho")).toBe(true);
  });

  it("sai em tabela, e só com o que ficou escolhido", () => {
    const tabela = tabelaDasCondicoes(documento());

    expect(tabela.colunas.map((c) => c.titulo)).toEqual(["Condição", "Opção fixada"]);
    expect(condicoes(documento())).toEqual({
      "Regime da prestação de serviços": "Híbrido",
      "Local da prestação de serviços": "Lisboa; Porto",
      "Equipamentos para os recursos": "Equipamentos do Prestador",
    });
  });

  it("as opções postas de lado não vão ao documento", () => {
    const texto = documentoParaTexto(documento());

    expect(texto).not.toContain("Presencial");
    expect(texto).not.toContain("Maia");
    expect(texto).not.toContain("Equipamentos da SPMS");
  });

  it("o regime vem antes do local: é ele que decide se há local", () => {
    const linhas = tabelaDasCondicoes(documento()).linhas.map((l) => l[0].texto);

    expect(linhas.indexOf("Regime da prestação de serviços")).toBeLessThan(
      linhas.indexOf("Local da prestação de serviços"),
    );
  });

  it("em regime remoto não há local a indicar", () => {
    expect(Object.keys(condicoes(documento({ regime: "Remoto" })))).toEqual([
      "Regime da prestação de serviços",
      "Equipamentos para os recursos",
    ]);
  });

  it("o local 'Outro' leva consigo o sítio indicado", () => {
    const doc = documento({ locais: ["Porto", "Outro"], outroLocal: "Coimbra" });

    expect(condicoes(doc)["Local da prestação de serviços"]).toBe("Porto; Outro: Coimbra");
  });

  it("um local por indicar é dito, e não deixado em branco", () => {
    expect(condicoes(documento({ locais: [] }))["Local da prestação de serviços"]).toBe("(por indicar)");
  });

  it("os requisitos do equipamento saem em tabela, um por linha", () => {
    const tabela = documento().blocos.find(
      (b) => b.tipo === "tabela" && b.colunas[0].titulo === "Requisitos mínimos do equipamento do prestador",
    );

    expect(tabela).toBeDefined();
    expect(tabela!.tipo === "tabela" ? tabela!.legenda : "").toBe("Computador com mínimo:");
    expect(tabela!.tipo === "tabela" ? tabela!.linhas.map((l) => l[0].texto) : []).toContain("32 GB de memória RAM");
  });

  it("sem equipamento do prestador não há requisitos a exigir-lhe", () => {
    const blocos = documento({ equipamento: "Equipamentos da SPMS" }).blocos;

    expect(
      blocos.some((b) => b.tipo === "tabela" && b.colunas[0].titulo.startsWith("Requisitos mínimos")),
    ).toBe(false);
  });
});
