import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { corpoDoPedido, dataPorExtenso, gerarPedidoPlurianualBlob } from "./pedidoPlurianual";
import { LOTES_EXEMPLO } from "../core/exemplo";
import { normalizarLotesGuardados } from "../core/lotes";
import type { LotesJSON } from "../core/types";

function exemplo(alteracoes: Partial<LotesJSON> = {}): LotesJSON {
  return normalizarLotesGuardados({ ...LOTES_EXEMPLO, ...alteracoes });
}

/** O texto do documento gerado, sem marcação, para procurar sem coordenadas. */
async function textoDoDocumento(config: LotesJSON, quando = new Date("2026-08-26T10:00:00")): Promise<string> {
  const blob = await gerarPedidoPlurianualBlob(config, quando);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file("word/document.xml")!.async("string");
  return xml.replace(/<[^>]+>/g, "");
}

async function xmlDoDocumento(config: LotesJSON): Promise<string> {
  const blob = await gerarPedidoPlurianualBlob(config, new Date("2026-08-26T10:00:00"));
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return zip.file("word/document.xml")!.async("string");
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
    const texto = await textoDoDocumento(exemplo({ nomeProjeto: "SClínico" }));

    expect(texto).toContain("26 de agosto de 2026");
    expect(texto).toContain("Pedido de Assunção de Encargos Plurianuais para o projeto SClínico.");
    expect(texto).toContain("insere-se o Projeto SClínico");
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

    for (const marca of ["[n.º do documento]", "[descrição do projeto]", "[está / não está]"]) {
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

  it("um agrupamento sem pedido plurianual gera o documento à mesma", async () => {
    const config = exemplo();
    config.encargosPlurianuais = { ativo: false, anoInicio: 2026 };
    const texto = await textoDoDocumento(config);

    expect(texto).toContain("IV – Anexo Técnico");
    expect(texto).toContain("O preço base do procedimento é de");
  });

  it("o corpo não escapa o XML do modelo que reaproveita", () => {
    const modelo = "<w:body><w:tbl><w:t>Parecer</w:t></w:tbl><w:sectPr/></w:body>";
    const corpo = corpoDoPedido(exemplo(), modelo, new Date("2026-08-26T10:00:00"));

    expect(corpo).toContain("<w:t>Parecer</w:t>");
    expect(corpo).not.toContain("&lt;w:tbl&gt;");
  });
});
