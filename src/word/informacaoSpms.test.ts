import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  corpoDaInformacao,
  dataPorExtenso,
  gerarManifestacaoNecessidadesBlob,
  gerarPedidoPlurianualBlob,
} from "./informacaoSpms";
import { LOTES_EXEMPLO } from "../core/exemplo";
import { normalizarLotesGuardados } from "../core/lotes";
import type { LotesJSON } from "../core/types";

function exemplo(alteracoes: Partial<LotesJSON> = {}): LotesJSON {
  return normalizarLotesGuardados({ ...LOTES_EXEMPLO, ...alteracoes });
}

const QUANDO = new Date("2026-08-26T10:00:00");

async function xmlDe(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return zip.file("word/document.xml")!.async("string");
}

/** O texto do documento gerado, sem marcação, para procurar sem coordenadas. */
async function textoDoDocumento(config: LotesJSON, quando = QUANDO): Promise<string> {
  return (await xmlDe(await gerarPedidoPlurianualBlob(config, quando))).replace(/<[^>]+>/g, "");
}

async function xmlDoDocumento(config: LotesJSON): Promise<string> {
  return xmlDe(await gerarPedidoPlurianualBlob(config, QUANDO));
}

/** O mesmo, para a manifestação de necessidades. */
async function textoDaManifestacao(config: LotesJSON, quando = QUANDO): Promise<string> {
  return (await xmlDe(await gerarManifestacaoNecessidadesBlob(config, quando))).replace(/<[^>]+>/g, "");
}

async function xmlDaManifestacao(config: LotesJSON): Promise<string> {
  return xmlDe(await gerarManifestacaoNecessidadesBlob(config, QUANDO));
}

/** Um agrupamento sem pedido plurianual: é o que dá origem à manifestação. */
function semPlurianual(): LotesJSON {
  const config = exemplo();
  config.encargosPlurianuais = { ativo: false, anoInicio: 2026 };
  return config;
}

describe("dataPorExtenso", () => {
  it("escreve a data em português", () => {
    expect(dataPorExtenso(new Date("2026-08-26T10:00:00"))).toBe("26 de agosto de 2026");
    expect(dataPorExtenso(new Date("2027-01-01T10:00:00"))).toBe("1 de janeiro de 2027");
  });
});

describe("gerarPedidoPlurianualBlob", () => {
  it("mantém do modelo tudo o que não é o corpo", async () => {
    const zip = await JSZip.loadAsync(await (await gerarPedidoPlurianualBlob(exemplo())).arrayBuffer());
    const nomes = Object.keys(zip.files);

    // O logótipo, o cabeçalho, o rodapé e os estilos vêm do modelo e não se tocam.
    expect(nomes).toContain("word/header1.xml");
    expect(nomes).toContain("word/footer1.xml");
    expect(nomes).toContain("word/styles.xml");
    expect(nomes.some((n) => n.startsWith("word/media/"))).toBe(true);
  });

  it("leva as quatro secções do modelo, por esta ordem", async () => {
    const texto = await textoDoDocumento(exemplo());
    const secoes = ["I – Enquadramento", "II – Análise", "III – Conclusão", "IV – Anexo Técnico"];
    const posicoes = secoes.map((s) => texto.indexOf(s));

    expect(posicoes.every((p) => p > 0)).toBe(true);
    expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b));
  });

  it("preenche a data de geração, o assunto e o nome do projeto", async () => {
    const texto = await textoDoDocumento(
      exemplo({ nomeProjeto: "SClínico", nomeProcedimento: "Aquisição de Serviços de Manutenção do SClínico" }),
    );

    expect(texto).toContain("26 de agosto de 2026");
    // O assunto identifica o procedimento e o triénio que ele cobre.
    expect(texto).toMatch(/Aquisição de Serviços de Manutenção do SClínico para o triénio 20\d\d-20\d\d\./);
    expect(texto).toContain("insere-se o Projeto SClínico");
  });

  it("sem nome de procedimento, o assunto cai no nome do projeto", async () => {
    const texto = await textoDoDocumento(exemplo({ nomeProjeto: "SClínico", nomeProcedimento: "" }));

    expect(texto).toMatch(/SClínico para o triénio 20\d\d-20\d\d\./);
  });

  it("escreve a descrição do projeto onde antes ficava o marcador", async () => {
    const texto = await textoDoDocumento(exemplo({ descricaoProjeto: "unificar os registos clínicos" }));

    expect(texto).toContain("Este projeto visa unificar os registos clínicos.");
    expect(texto).not.toContain("[descrição do projeto]");
  });

  it("sem descrição, deixa o marcador a vermelho em vez de uma frase truncada", async () => {
    const xml = await xmlDoDocumento(exemplo({ descricaoProjeto: "   " }));

    expect(xml).toContain("[descrição do projeto]");
  });

  it("leva os três anos económicos e o preço base do procedimento", async () => {
    const texto = await textoDoDocumento(exemplo());

    // O exemplo começa em 2026.
    expect(texto).toContain("2.2. Encargos previstos para o triénio 2026-2028");
    expect(texto).toContain("do início do contrato, 2026, e aos dois anos económicos seguintes, 2027 e 2028");
    expect(texto).toMatch(/O preço base do procedimento é de .+, sem IVA, correspondendo a .+ com IVA/);
  });

  it("o preço base sai a negrito, nos dois documentos", async () => {
    const negrito = (xml: string) => {
      // O parágrafo do preço base, e o <w:b/> que lhe dá o peso.
      const i = xml.indexOf("O preço base do procedimento é de");
      const inicio = xml.lastIndexOf("<w:p>", i);
      return xml.slice(inicio, i).includes("<w:b/>");
    };

    expect(negrito(await xmlDoDocumento(exemplo()))).toBe(true);
    expect(negrito(await xmlDaManifestacao(semPlurianual()))).toBe(true);
  });

  it("o n.º mínimo de elementos sai a negrito, e a frase seguinte não", async () => {
    const xml = await xmlDoDocumento(exemplo());
    const i = xml.indexOf("O concorrente apresenta, para este perfil");
    const paragrafo = xml.slice(xml.lastIndexOf("<w:p>", i), xml.indexOf("</w:p>", i));

    // Duas partes no mesmo parágrafo: a primeira com peso, a segunda sem.
    expect(paragrafo.slice(0, paragrafo.indexOf("O concorrente"))).toContain("<w:b/>");
    const segunda = paragrafo.slice(paragrafo.indexOf("Cada elemento proposto"));
    expect(paragrafo.slice(paragrafo.indexOf("elementos."), paragrafo.indexOf("Cada elemento"))).not.toContain(
      "<w:b/>",
    );
    expect(segunda).not.toContain("<w:b/>");
  });

  it("a justificação das rates vem depois do preço base, com o quadro de referência", async () => {
    const texto = await textoDoDocumento(exemplo());

    const frase =
      "Os valores hora foram apurados através do valor médio das propostas obtidas nos últimos concursos " +
      "realizados pela SPMS, E.P.E. para adquirir serviços de natureza equivalente, mediante a seguinte tabela:";
    expect(texto).toContain(frase);
    // E já não onde estava, antes do quadro dos anos.
    expect(texto).not.toContain("obtidas no último concurso público realizado pela SPMS");
    expect(texto.indexOf("O preço base do procedimento é de")).toBeLessThan(texto.indexOf(frase));

    // O quadro traz os dez perfis de referência, com os procedimentos.
    for (const coluna of ["Procedimento(s)", "N.º propostas admitidas", "Rate média das propostas (€/h)"]) {
      expect(texto).toContain(coluna);
    }
    expect(texto).toContain("Consultor de Administração de Sistemas e Observabilidade");
    expect(texto).toContain("20260065");
    expect(texto).toContain("20230160");
  });

  it("a manifestação não leva o quadro das rates", async () => {
    expect(await textoDaManifestacao(semPlurianual())).not.toContain("mediante a seguinte tabela:");
  });

  it("a tabela dos anos leva o lote à frente e o n.º mínimo de elementos", async () => {
    const texto = await textoDoDocumento(exemplo());
    const cabecalho = texto.slice(texto.indexOf("LotesPerfil") >= 0 ? texto.indexOf("LotesPerfil") : 0);

    expect(texto).toContain("LotesPerfil");
    expect(texto).toContain("N.º mín. elementos");
    expect(texto).not.toContain("PessoasPerfil");
    void cabecalho;
  });

  it("a tabela dos anos deixou de levar subtotais por lote", async () => {
    const texto = await textoDoDocumento(exemplo());

    expect(texto).not.toContain("Subtotal do lote");
    // O total a assumir continua lá: é o que o pedido pede.
    expect(texto).toContain("Total a assumir");
  });

  it("a divisão por lotes fecha a análise, nos dois documentos", async () => {
    const doPedido = await textoDoDocumento(exemplo());
    expect(doPedido).toContain("2.3. Divisão por lotes");
    expect(doPedido).toContain("A determinação dos lotes para efeito de adjudicação é a seguinte:");
    expect(doPedido.indexOf("O preço base do procedimento é de")).toBeLessThan(
      doPedido.indexOf("2.3. Divisão por lotes"),
    );
    expect(doPedido.indexOf("2.3. Divisão por lotes")).toBeLessThan(doPedido.indexOf("III – Conclusão"));

    const daManifestacao = await textoDaManifestacao(semPlurianual());
    expect(daManifestacao).toContain("2.2. Divisão por lotes");
  });

  it("as regras de adjudicação saem numeradas, com as alíneas por baixo", async () => {
    const texto = await textoDoDocumento(exemplo());

    expect(texto).toContain("Regras de Adjudicação dos Lotes");
    // Numeradas de verdade — a marca e o texto ficam colados quando se tira a
    // marcação, porque o que os separa no documento é um tabulador a sério.
    expect(texto).toContain("1.Não pode ser adjudicado mais de um lote ao mesmo Concorrente");
    expect(texto).toContain("i.Se encontrarem em relação de simples participação");
    expect(texto).toContain("2.Sempre que, da aplicação do critério de adjudicação");
    expect(texto).toContain("3.As regras previstas nos n.os 1 e 2");
    // E já não com marcas, que não servem uma norma que remete para números.
    expect(texto).not.toContain("•Não pode ser adjudicado");
  });

  it("as duas regras da preferência estão a seguir ao quadro dos lotes, e não nas regras", async () => {
    const texto = await textoDoDocumento(exemplo());

    const preferencia = "A adjudicação está limitada a 1 (um) lote por concorrente, de acordo com a «ordem de " +
      "preferência» indicada no modelo de apresentação de proposta";
    expect(texto).toContain(preferencia);
    // Depois da legenda do quadro, e antes das regras de adjudicação.
    expect(texto.indexOf("o preço base é sem IVA.")).toBeLessThan(texto.indexOf(preferencia));
    expect(texto.indexOf(preferencia)).toBeLessThan(texto.indexOf("Regras de Adjudicação dos Lotes"));
    // E em parágrafo corrido, sem número: a numeração é da secção seguinte.
    expect(texto).not.toContain(`1.${preferencia.slice(0, 30)}`);
  });

  it("as regras de apuramento falam do Resumo Curricular e de assinatura sem «qualificada»", async () => {
    const texto = await textoDoDocumento(exemplo());

    expect(texto).toContain("o concorrente apresenta, relativamente a cada elemento proposto, o Resumo Curricular");
    expect(texto).toContain("mediante assinatura eletrónica.");
    expect(texto).not.toContain("qualificada");
    expect(texto).not.toContain("formulário de declaração de experiência profissional");
  });

  it("leva o anexo técnico completo", async () => {
    const texto = await textoDoDocumento(exemplo());

    expect(texto).toContain("Requisitos mínimos de experiência profissional");
    expect(texto).toContain("Programador Sénior — Java");
    expect(texto).toContain("Posto de trabalho");
    expect(texto).toContain("Regras de Adjudicação dos Lotes");
    expect(texto).toContain("Regras de apuramento da experiência");
  });

  it("assinala a vermelho o que a aplicação não sabe", async () => {
    const xml = await xmlDoDocumento(exemplo());

    for (const marca of ["[n.º do documento]", "[está / não está]"]) {
      expect(xml).toContain(marca);
    }
    expect(xml).toContain('<w:color w:val="C00000"/>');
  });

  it("não deixa campos de formulário nem texto de marcador do Word", async () => {
    const xml = await xmlDoDocumento(exemplo());

    expect(xml).not.toContain("<w:sdt>");
    expect(xml).not.toContain("Click or tap");
  });

  it("normaliza o documento a um só tipo de letra", async () => {
    const xml = await xmlDoDocumento(exemplo());
    const familias = [...xml.matchAll(/w:ascii="([^"]+)"/g)].map((m) => m[1]);

    expect([...new Set(familias)]).toEqual(["Arial"]);
  });

  it("põe as horas numa linha própria, por baixo do valor do ano", async () => {
    const xml = await xmlDoDocumento(exemplo());

    // O valor e as horas ficam em runs distintos, separados por uma quebra.
    expect(xml).toMatch(/181[^<]*843,20[^<]*€<\/w:t><\/w:r><w:r><w:br\/><\/w:r>/);
    expect(xml).toContain("1760 h");
  });

  it("mantém o bloco de assinatura do modelo", async () => {
    const texto = await textoDoDocumento(exemplo());

    expect(texto).toContain("Direção de Arquitetura, Negócio e Análise de Dados");
    expect(texto).toContain("(Coordenador)");
  });

  it("o corpo é XML equilibrado: tantas aberturas como fechos", async () => {
    const zip = await JSZip.loadAsync(await (await gerarPedidoPlurianualBlob(exemplo())).arrayBuffer());
    const xml = await zip.file("word/document.xml")!.async("string");

    for (const etiqueta of ["w:p", "w:tbl", "w:tr", "w:tc", "w:r"]) {
      const abre = (xml.match(new RegExp(`<${etiqueta}[ >]`, "g")) ?? []).length;
      const fecha = (xml.match(new RegExp(`</${etiqueta}>`, "g")) ?? []).length;
      expect({ etiqueta, abre, fecha }).toEqual({ etiqueta, abre: fecha, fecha });
    }
  });


  it("o corpo não escapa o XML do modelo que reaproveita", () => {
    const modelo = "<w:body><w:tbl><w:t>Parecer</w:t></w:tbl><w:sectPr/></w:body>";
    const corpo = corpoDaInformacao(exemplo(), modelo, new Date("2026-08-26T10:00:00"));

    expect(corpo).toContain("<w:t>Parecer</w:t>");
    expect(corpo).not.toContain("&lt;w:tbl&gt;");
  });
});

describe("gerarManifestacaoNecessidadesBlob", () => {
  it("leva as mesmas quatro secções, e o modelo por baixo", async () => {
    const zip = await JSZip.loadAsync(await (await gerarManifestacaoNecessidadesBlob(semPlurianual())).arrayBuffer());
    expect(Object.keys(zip.files)).toContain("word/header1.xml");

    const texto = await textoDaManifestacao(semPlurianual());
    const posicoes = ["I – Enquadramento", "II – Análise", "III – Conclusão", "IV – Anexo Técnico"].map((s) =>
      texto.indexOf(s),
    );
    expect(posicoes.every((p) => p > 0)).toBe(true);
    expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b));
  });

  it("o assunto é a manifestação de necessidades, pelo nome do procedimento", async () => {
    const config = semPlurianual();
    config.nomeProcedimento = "Aquisição de Serviços de Manutenção do SClínico";
    const texto = await textoDaManifestacao(config);

    expect(texto).toContain("Manifestação de necessidades para Aquisição de Serviços de Manutenção do SClínico.");
    expect(texto).not.toContain("Pedido de Assunção de Encargos Plurianuais");
  });

  it("pede o n.º de orçamento, por baixo do n.º do documento e da data", async () => {
    const texto = await textoDaManifestacao(semPlurianual());

    expect(texto).toContain("N.º orçamento:");
    // A ordem dos campos do cabeçalho: n.º, data, n.º de orçamento, assunto.
    const posicoes = ["N.º:", "Data:", "N.º orçamento:", "Assunto:"].map((s) => texto.indexOf(s));
    expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b));

    // E é campo por preencher: sai a vermelho, como o n.º do documento.
    expect(await xmlDaManifestacao(semPlurianual())).toContain("[n.º de orçamento]");
  });

  it("o pedido de encargos plurianuais não leva o n.º de orçamento", async () => {
    expect(await textoDoDocumento(exemplo())).not.toContain("N.º orçamento");
  });

  it("a análise tem um ponto só, e já não o dos procedimentos do ano corrente", async () => {
    const texto = await textoDaManifestacao(semPlurianual());

    expect(texto).toContain("2.1. Encargos previstos");
    expect(texto).not.toContain("Encargos com o projeto planeados para o ano corrente/transato");
    expect(texto).not.toContain("Para assegurar estes serviços foram desenvolvidos os seguintes procedimentos:");
    expect(texto).not.toContain("[tabela dos procedimentos do ano corrente/transato");
    // O 2.2 que resta é a divisão por lotes, e não os encargos plurianuais.
    expect(texto).toContain("2.2. Divisão por lotes");
    expect(texto).not.toContain("2.3. ");
  });

  it("o enquadramento dos encargos é o da bolsa de horas, e não o dos anos económicos", async () => {
    const texto = await textoDaManifestacao(semPlurianual());

    expect(texto).toContain(
      "Para realizar os objetivos preconizados e face à inexistência de recursos internos na SPMS",
    );
    expect(texto).toContain("através de Bolsa de Horas nos termos que se expõem.");
    expect(texto).toContain("valor médio das propostas obtidas no último concurso público");
    expect(texto).not.toContain("A execução do contrato em período superior a 12 meses");
    expect(texto).not.toContain("Os encargos a assumir respeitam ao ano económico do início do contrato");
    expect(texto).not.toContain("As horas contratadas para cada perfil repartem-se pelos anos económicos");
  });

  it("a tabela é a do resumo do procedimento, e não a dos anos", async () => {
    const texto = await textoDaManifestacao(semPlurianual());

    // As colunas do resumo: n.º mín. de elementos, horas, preço/hora e preço base.
    for (const coluna of ["N.º mín. elementos", "Horas", "Preço/hora (s/ IVA)", "Preço base (c/ IVA)"]) {
      expect(texto).toContain(coluna);
    }
    expect(texto).toContain("Preço base total do procedimento");
    // E nenhuma coluna de ano económico.
    expect(texto).not.toMatch(/Total € c\/ IVA 20\d\d/);
  });

  it("a frase do preço base fica a seguir à tabela", async () => {
    const texto = await textoDaManifestacao(semPlurianual());

    expect(texto).toMatch(/O preço base do procedimento é de .+, sem IVA, correspondendo a .+ com IVA/);
    expect(texto.indexOf("Preço base total do procedimento")).toBeLessThan(
      texto.indexOf("O preço base do procedimento é de"),
    );
  });

  it("a conclusão pede autorização e fixa o tipo de procedimento", async () => {
    const texto = await textoDaManifestacao(semPlurianual());

    expect(texto).toContain("Assim solicita-se autorização para proceder à aquisição da prestação de serviços");
    expect(texto).toContain("Concurso Público   NÃO   \u25a1   SIM   X");
    expect(texto).toContain(
      "Acordo Quadro para Prestação de Serviços de Consultadoria em Tecnologias de Informação e " +
        "Comunicação (TIC)   NÃO   X   SIM   \u25a1   Identifique o lote ____",
    );
    expect(texto).not.toContain("obter a autorização para assunção de encargos plurianuais");
  });

  it("fecha com a mesma frase de remessa do pedido", async () => {
    const remessa =
      "Caso seja superiormente autorizado deverá a presente informação ser remetida à Direção de Administração " +
      "Geral, por forma a instruir os respetivos processos inerentes à contratação, mediante o disposto no anexo " +
      "técnico da presente informação.";

    expect(await textoDaManifestacao(semPlurianual())).toContain(remessa);
    expect(await textoDoDocumento(exemplo())).toContain(remessa);
  });

  it("leva o anexo técnico completo, como o pedido", async () => {
    const texto = await textoDaManifestacao(semPlurianual());

    expect(texto).toContain("Requisitos mínimos de experiência profissional");
    expect(texto).toContain("Programador Sénior — Java");
    expect(texto).toContain("Regras de apuramento da experiência");
  });

  it("o corpo é XML equilibrado: tantas aberturas como fechos", async () => {
    const xml = await xmlDaManifestacao(semPlurianual());

    for (const etiqueta of ["w:p", "w:tbl", "w:tr", "w:tc", "w:r"]) {
      const abre = (xml.match(new RegExp(`<${etiqueta}[ >]`, "g")) ?? []).length;
      const fecha = (xml.match(new RegExp(`</${etiqueta}>`, "g")) ?? []).length;
      expect({ etiqueta, abre, fecha }).toEqual({ etiqueta, abre: fecha, fecha });
    }
  });

  it("normaliza o documento a um só tipo de letra", async () => {
    const xml = await xmlDaManifestacao(semPlurianual());
    expect([...new Set([...xml.matchAll(/w:ascii="([^"]+)"/g)].map((m) => m[1]))]).toEqual(["Arial"]);
  });
});
