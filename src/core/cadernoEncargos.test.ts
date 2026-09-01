import { describe, expect, it } from "vitest";
import { blocosDivisaoPorLotes, documentoRegrasEPrecoBase } from "./cadernoEncargos";
import { normalizarLotesGuardados } from "./lotes";
import { documentoParaTexto, partesDoParagrafo } from "./documento";
import { LOTES_EXEMPLO } from "./exemplo";
import { certificacoes, itens, lotesComPerfis, perfil, requisito } from "./fixtures";
import { ATIVIDADE_FIXA, ROTULO_CERTIFICACOES, mesesDeAnos } from "./types";
import type { LotesJSON } from "./types";

describe("documentoRegrasEPrecoBase", () => {
  // O exemplo leva pedido de encargos plurianuais, que substitui a tabela do
  // preço base pela dos anos. Estes testes são sobre o documento sem pedido.
  const SEM_PLURIANUAL: LotesJSON = {
    ...LOTES_EXEMPLO,
    encargosPlurianuais: { ...LOTES_EXEMPLO.encargosPlurianuais, ativo: false },
  };
  const doc = documentoRegrasEPrecoBase(SEM_PLURIANUAL);
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

  it("com pedido plurianual, a tabela do preço base dá lugar à dos anos", () => {
    const comPedido = documentoParaTexto(documentoRegrasEPrecoBase(LOTES_EXEMPLO));

    expect(comPedido).toContain("Pedido de encargos plurianuais");
    expect(comPedido).not.toContain("Preço base (c/ IVA)");
    // O preço base do procedimento continua a constar, porque é elemento da peça.
    expect(comPedido).toContain("O preço base do procedimento é de");
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

  it("indica o n.º de projetos por formulário, que é do procedimento", () => {
    const config = { ...lotesComPerfis([{ numero: "1", perfis: [perfil()] }]), nBlocos: 15 };

    expect(documentoParaTexto(documentoRegrasEPrecoBase(config))).toContain("comporta 15 Projetos");
  });

  it("só aparece quando a opção está ativa, e com título próprio", () => {
    const semLimite = { ...LOTES_EXEMPLO, umLotePorConcorrente: false };
    const titulo = "Regras de Adjudicação dos Lotes";

    expect(documentoParaTexto(documentoRegrasEPrecoBase(LOTES_EXEMPLO))).toContain(titulo);
    expect(documentoParaTexto(documentoRegrasEPrecoBase(semLimite))).not.toContain(titulo);
  });

  it("remete para a ordem de preferência da proposta, que é o que decide quem fica com o quê", () => {
    const texto = documentoParaTexto(documentoRegrasEPrecoBase(LOTES_EXEMPLO));

    expect(texto).toContain("A adjudicação está limitada a 1 (um) lote por concorrente");
    expect(texto).toContain("«ordem de preferência» indicada na proposta do concorrente");
  });

  it("as causas de relação especial vão em alíneas, sem quebrar a série dos números", () => {
    const texto = documentoParaTexto(documentoRegrasEPrecoBase(LOTES_EXEMPLO));

    expect(texto).toContain("3. Sem prejuízo do disposto no n.º 2");
    expect(texto).toMatch(/i\. Se encontrarem em relação de simples participação/);
    expect(texto).toMatch(/iii\. Estarem sujeitos ao controlo ou influência dominante/);
    // A alínea não gasta um número: a regra seguinte é a 4.
    expect(texto).toContain("4. Sempre que, da aplicação do critério de adjudicação");
  });

  it("a ordem sequencial nomeia os lotes que o procedimento tem, e não três fixos", () => {
    // O exemplo tem dois lotes: a norma não pode falar de um terceiro.
    const texto = documentoParaTexto(documentoRegrasEPrecoBase(LOTES_EXEMPLO));

    expect(texto).toContain("escolhe-se o adjudicatário do Lote 1 em primeiro lugar, e, por fim, o adjudicatário do Lote 2");
    expect(texto).not.toContain("Lote 3");
  });

  it("com um lote só, não há exceção do último lote a apresentar", () => {
    const umLote = { ...lotesComPerfis([{ numero: "1", perfis: [perfil()] }]), umLotePorConcorrente: true };
    const texto = documentoParaTexto(documentoRegrasEPrecoBase(umLote));

    expect(texto).toContain("Regras de Adjudicação dos Lotes");
    expect(texto).not.toContain("só tenha sido apresentada uma proposta sem motivos de exclusão");
  });
});

describe("preço base", () => {
  it("a frase do preço base vai assinalada, para sair a negrito no Word", () => {
    const blocos = documentoRegrasEPrecoBase(LOTES_EXEMPLO).blocos;
    const frase = blocos.find((b) => b.tipo === "paragrafo" && b.texto.startsWith("O preço base do procedimento"));

    expect(frase?.tipo).toBe("paragrafo");
    expect(frase?.tipo === "paragrafo" && frase.destaque).toBe(true);
  });
});

describe("n.º mínimo de elementos por perfil", () => {
  const frase = (config = LOTES_EXEMPLO) =>
    documentoRegrasEPrecoBase(config).blocos.find(
      (b) => b.tipo === "paragrafo" && b.texto.startsWith("O concorrente apresenta, para este perfil"),
    );

  it("a frase do n.º mínimo vai destacada, e o resto do parágrafo não", () => {
    const bloco = frase();
    expect(bloco?.tipo).toBe("paragrafo");
    const partes = bloco?.tipo === "paragrafo" ? partesDoParagrafo(bloco) : [];

    expect(partes).toHaveLength(2);
    expect(partes[0].destaque).toBe(true);
    expect(partes[0].texto).toMatch(/^O concorrente apresenta, para este perfil, um mínimo de \d+ elementos?\.$/);
    expect(partes[1].destaque).toBeUndefined();
    expect(partes[1].texto).toContain("Cada elemento proposto satisfaz");
  });

  it("o texto do parágrafo é a junção das partes, e não uma cópia à parte", () => {
    const bloco = frase();
    const partes = bloco?.tipo === "paragrafo" ? partesDoParagrafo(bloco) : [];

    expect(bloco?.tipo === "paragrafo" && bloco.texto).toBe(partes.map((p) => p.texto).join(""));
  });

  it("a saída em texto simples continua a ler a frase inteira", () => {
    expect(documentoParaTexto(documentoRegrasEPrecoBase(LOTES_EXEMPLO))).toContain(
      "O concorrente apresenta, para este perfil, um mínimo de 2 elementos. Cada elemento proposto satisfaz",
    );
  });
});

describe("divisão por lotes", () => {
  it("dá uma linha por lote, com as horas e o preço base", () => {
    const texto = documentoParaTexto(documentoRegrasEPrecoBase(LOTES_EXEMPLO));

    expect(texto).toContain("Divisão por lotes");
    expect(texto).toContain("A determinação dos lotes para efeito de adjudicação é a seguinte:");
    for (const coluna of ["Lote n.º", "Descrição", "Total horas", "Preço base (s/ IVA)"]) {
      expect(texto).toContain(coluna);
    }
    for (const lote of LOTES_EXEMPLO.lotes) expect(texto).toContain(lote.designacao);
  });

  it("as horas de um lote contam os elementos de cada perfil", () => {
    const config = normalizarLotesGuardados({
      ...lotesComPerfis([{ numero: "1", perfis: [perfil()] }]),
      encargosPlurianuais: { ativo: false, anoInicio: 2027 },
    });
    // A fixture dá 100 horas e 2 elementos: 200 horas de trabalho no lote.
    config.lotes[0].perfis[0].horas = 100;
    config.lotes[0].perfis[0].nMinimoElementos = 2;

    const linhas = blocosDivisaoPorLotes(config).find((b) => b.tipo === "tabela")!;
    expect(linhas.linhas[0][2].texto).toBe("200");
  });

  it("as tabelas de preço base deixam de levar subtotais por lote", () => {
    const texto = documentoParaTexto(documentoRegrasEPrecoBase(LOTES_EXEMPLO));
    expect(texto).not.toContain("Subtotal do lote");
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
    // A atividade de fecho não se guarda no perfil, mas fecha sempre a tabela.
    expect(tabela!.tipo === "tabela" ? tabela!.linhas.map((l) => l[0].texto) : []).toEqual([
      "Primeira atividade",
      "Segunda atividade",
      ATIVIDADE_FIXA,
    ]);
  });
});

describe("certificações do perfil", () => {
  function tabelaDeCertificacoes(...designacoes: string[]) {
    const config = lotesComPerfis([
      { numero: "1", perfis: [perfil({ certificacoes: certificacoes(...designacoes) })] },
    ]);
    return documentoRegrasEPrecoBase(config).blocos.find(
      (b) => b.tipo === "tabela" && b.colunas[0].titulo === ROTULO_CERTIFICACOES,
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

    expect(indice(ROTULO_CERTIFICACOES)).toBeGreaterThan(indice("Requisito"));
  });
});

describe("normas de nulidade da experiência", () => {
  const texto = documentoParaTexto(documentoRegrasEPrecoBase(LOTES_EXEMPLO));

  it("não repete meses sobrepostos entre projetos declarados para o mesmo requisito", () => {
    expect(texto).toContain("contabilizados apenas uma vez");
  });

  it("não admite experiência para além do mês do preenchimento", () => {
    expect(texto).toContain("para além do mês e ano em que o Resumo Curricular é submetido");
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

  /** A tabela dos requisitos, se existir: vem logo a seguir à das condições. */
  function tabelaDosRequisitos(posto: Partial<LotesJSON["postoTrabalho"]> = {}) {
    const blocos = documento(posto).blocos;
    const condicoes = blocos.findIndex((b) => b.tipo === "tabela" && b.colunas[0].titulo === "Condição");
    const seguinte = blocos[condicoes + 1];
    return seguinte?.tipo === "tabela" ? seguinte : undefined;
  }

  it("os requisitos do equipamento saem em tabela, um por linha", () => {
    const tabela = tabelaDosRequisitos();

    expect(tabela).toBeDefined();
    expect(tabela!.tipo === "tabela" ? tabela!.linhas.map((l) => l[0].texto) : []).toContain("32 GB de memória RAM;");
  });

  it("a introdução encabeça a tabela, em vez de ficar solta por cima dela", () => {
    const tabela = tabelaDosRequisitos();

    expect(tabela!.tipo === "tabela" ? tabela!.colunas[0].titulo : "").toBe(
      "Posto de trabalho os seguintes requisitos mínimos:",
    );
    expect(tabela!.tipo === "tabela" ? tabela!.legenda : "nenhuma").toBeUndefined();
    expect(documentoParaTexto(documento())).not.toContain("Computador com mínimo:");
  });

  it("sem introdução, encabeça a tabela o nome do campo", () => {
    const tabela = tabelaDosRequisitos({ requisitosEquipamento: "Wi-Fi 6.\n32 GB de memória RAM;" });

    expect(tabela!.tipo === "tabela" ? tabela!.colunas[0].titulo : "").toBe(
      "Requisitos mínimos do equipamento do prestador",
    );
    expect(tabela!.tipo === "tabela" ? tabela!.linhas.length : 0).toBe(2);
  });

  it("sem equipamento do prestador não há requisitos a exigir-lhe", () => {
    expect(tabelaDosRequisitos({ equipamento: "Equipamentos da SPMS" })).toBeUndefined();
  });
});
