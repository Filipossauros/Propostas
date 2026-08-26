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
    // O assunto identifica o procedimento, que é o que dá entrada no circuito.
    expect(texto).toContain(
      "Pedido de Assunção de Encargos Plurianuais para Aquisição de Serviços de Manutenção do SClínico.",
    );
    expect(texto).toContain("insere-se o Projeto SClínico");
  });

  it("sem nome de procedimento, o assunto cai no nome do projeto", async () => {
    const texto = await textoDoDocumento(exemplo({ nomeProjeto: "SClínico", nomeProcedimento: "" }));

    expect(texto).toContain("Pedido de Assunção de Encargos Plurianuais para SClínico.");
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
    expect(texto).toContain("assunção de encargos plurianuais 2026 e anos subsequentes");
    expect(texto).toContain("do início do contrato, 2026, e aos dois anos económicos seguintes, 2027 e 2028");
    expect(texto).toMatch(/O preço base do procedimento é de .+, sem IVA, correspondendo a .+ com IVA/);
  });

  it("leva o anexo técnico completo", async () => {
    const texto = await textoDoDocumento(exemplo());

    expect(texto).toContain("Requisitos mínimos de experiência profissional");
    expect(texto).toContain("Programador Sénior — Java");
    expect(texto).toContain("Posto de trabalho");
    expect(texto).toContain("Limitação de adjudicação a um lote por concorrente");
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
    expect(texto).not.toContain("2.2.");
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
