// @vitest-environment jsdom
//
// As peças do pedido de licenciamento: o eAvalia com a folha «Custos -
// Licenciamento», o mapa de quantidades e preços e a manifestação em Word. O
// jsdom só por causa do DOMParser, com que se confirma que o XML continua bem
// formado.
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import { gerarEavaliaLicenciamentoBlob } from "../excel/eavalia";
import { gerarWorkbookMapaPrecos } from "../excel/mapaPrecos";
import { gerarManifestacaoLicenciamentoBlob } from "../word/manifestacaoLicenciamento";
import { ficheirosDoPedidoLicenciamento } from "./pacotes";
import {
  comMargemLicenciamento,
  lotesEfetivos,
  pedidoLicenciamentoExemplo,
  pedidoLicenciamentoExemploSoftware,
  type PedidoLicenciamento,
} from "../core/licenciamento";
import modeloBase64 from "../excel/modelos/Pedido_PPP_eavalia.xlsx?base64";

const QUANDO = new Date("2026-11-11T10:00:00");
const CUSTOS = "xl/worksheets/sheet5.xml";
const SERVICOS = "xl/worksheets/sheet4.xml";

/** O exemplo de software: aberto à concorrência, uma subscrição e uma licença perpétua com manutenção. */
function exemplo(alteracoes: Partial<PedidoLicenciamento> = {}): PedidoLicenciamento {
  return { ...pedidoLicenciamentoExemploSoftware(2027), numeroInformacao: "I/9/2026", ...alteracoes };
}

/** O exemplo da SNOMED CT: licença determinada de terminologia, nacional, em subscrição anual. */
function snomed(): PedidoLicenciamento {
  return { ...pedidoLicenciamentoExemplo(2027), numeroInformacao: "I/9/2026" };
}

async function celula(zip: JSZip, folha: string, ref: string): Promise<string> {
  const xml = await zip.file(folha)!.async("string");
  const m = new RegExp(`<c r="${ref}"[^>]*(?:/>|>[\\s\\S]*?</c>)`).exec(xml);
  return m === null ? "" : m[0];
}

function bemFormado(xml: string): boolean {
  return new DOMParser().parseFromString(xml, "application/xml").getElementsByTagName("parsererror").length === 0;
}

describe("eAvalia do licenciamento", () => {
  it("preenche a folha «Custos - Licenciamento», um bloco por produto", async () => {
    const zip = await JSZip.loadAsync(await (await gerarEavaliaLicenciamentoBlob(exemplo(), QUANDO)).arrayBuffer());
    expect(await celula(zip, CUSTOS, "B5")).toContain("Submissão à concorrência");
    expect(await celula(zip, CUSTOS, "B7")).toContain("Subscrição ou SaaS");
    expect(await celula(zip, CUSTOS, "B9")).toContain("Gestão Documental");
    expect(await celula(zip, CUSTOS, "B13")).toContain(">Sim<");
    expect(await celula(zip, CUSTOS, "B18")).toContain("Aquisição novas licenças");
    // Subscrição: o preço do período inteiro (14,50 € × 36 meses).
    expect(await celula(zip, CUSTOS, "B20")).toContain("<v>522</v>");
    expect(await celula(zip, CUSTOS, "B22")).toContain("<v>1200</v>");
    expect(await celula(zip, CUSTOS, "B24")).toContain("<v>626400</v>");
    // Perpétua: o segundo bloco, com a manutenção à parte.
    expect(await celula(zip, CUSTOS, "E7")).toContain(">Licenças<");
    expect(await celula(zip, CUSTOS, "E24")).toContain("<v>121600</v>");
    expect(await celula(zip, CUSTOS, "E40")).toContain("<v>80256</v>");
    expect(await celula(zip, CUSTOS, "E42")).toContain("<v>0</v>");
    expect(await celula(zip, CUSTOS, "E46")).toMatch(/<f>[^<]+<\/f><v>80256<\/v>/);
    expect(await zip.file(CUSTOS)!.async("string")).toContain('<c r="H5" s="17"/>');
    expect(bemFormado(await zip.file(CUSTOS)!.async("string"))).toBe(true);
  });

  it("licença determinada: tipo de solução escolhido, consulta ao mercado «Não», preço anual × anos", async () => {
    const zip = await JSZip.loadAsync(await (await gerarEavaliaLicenciamentoBlob(snomed(), QUANDO)).arrayBuffer());
    expect(await celula(zip, CUSTOS, "B5")).toContain("Software Proprietário sem alternativas");
    expect(await celula(zip, CUSTOS, "B11")).toContain("SNOMED International");
    expect(await celula(zip, CUSTOS, "B13")).toContain(">Não<");
    expect(await celula(zip, CUSTOS, "B18")).toContain("Actualizações/Upgrades/Correções");
    expect(await celula(zip, CUSTOS, "B20")).toContain("<v>360000</v>");
    expect(await celula(zip, CUSTOS, "B22")).toContain("<v>1</v>");
  });

  it("o alinhamento tecnológico sai todo «Não aplicável»", async () => {
    const zip = await JSZip.loadAsync(await (await gerarEavaliaLicenciamentoBlob(snomed(), QUANDO)).arrayBuffer());
    const xml = await zip.file("xl/worksheets/sheet3.xml")!.async("string");
    const respostas = [...xml.matchAll(/<c r="E\d+"[^>]*t="inlineStr"><is><t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]);
    expect(respostas.length).toBeGreaterThan(5);
    expect(new Set(respostas)).toEqual(new Set(["Não aplicável"]));
    expect(await celula(zip, "xl/worksheets/sheet2.xml", "B17")).toContain("SNOMED CT");
  });

  it("deixa a folha «Custos - Serviços» como o modelo a traz", async () => {
    const zip = await JSZip.loadAsync(await (await gerarEavaliaLicenciamentoBlob(exemplo(), QUANDO)).arrayBuffer());
    const modelo = await JSZip.loadAsync(Buffer.from(modeloBase64, "base64"));
    expect(await zip.file(SERVICOS)!.async("string")).toBe(await modelo.file(SERVICOS)!.async("string"));
    expect(await zip.file("xl/workbook.xml")!.async("string")).toBe(await modelo.file("xl/workbook.xml")!.async("string"));
  });

  it("um produto «Solução Software Livre» vai para a secção do código aberto", async () => {
    const pedido = exemplo();
    pedido.natureza = "determinado";
    pedido.licencas[1] = { ...pedido.licencas[1], eavalia: { ...pedido.licencas[1].eavalia, tipoSolucao: "Solução Software Livre" } };
    const zip = await JSZip.loadAsync(await (await gerarEavaliaLicenciamentoBlob(pedido, QUANDO)).arrayBuffer());
    expect(await celula(zip, CUSTOS, "B66")).toContain(">Licenças<");
    expect(await celula(zip, CUSTOS, "B84")).toMatch(/<f>[^<]+<\/f><v>121600<\/v>/);
    expect(await zip.file(CUSTOS)!.async("string")).toContain('<c r="E5" s="17"/>');
  });
});

describe("mapa de quantidades e preços", () => {
  it("aberta: o concorrente identifica o produto; o total é fórmula", async () => {
    const pedido = comMargemLicenciamento(exemplo());
    const lote = lotesEfetivos(pedido)[0];
    const livro = gerarWorkbookMapaPrecos(pedido, lote);
    const folha = livro.worksheets[0];
    const cabecalho = (folha.getRow(6).values as ExcelJS.CellValue[]).filter(Boolean);
    expect(cabecalho).toContain("Produto proposto");
    expect(cabecalho).toContain("Fabricante / titular");
    expect(folha.getCell(7, 2).value).toBe("Plataforma de gestão documental");
    const total = folha.getRow(7).getCell(cabecalho.indexOf("Total (s/ IVA)") + 1).value as { formula: string };
    expect(total.formula).toMatch(/^IF\(/);
    await livro.xlsx.writeBuffer();
  });

  it("a manutenção em linha própria é uma segunda linha, com preço anual × anos", () => {
    const pedido = exemplo();
    const folha = gerarWorkbookMapaPrecos(pedido, lotesEfetivos(pedido)[1]).worksheets[0];
    expect(folha.getCell(7, 2).value).toBe("Sistema de gestão de base de dados relacional — licenças perpétuas");
    expect(folha.getCell(8, 2).value).toBe("Manutenção e suporte — Sistema de gestão de base de dados relacional");
    const cabecalho = (folha.getRow(6).values as ExcelJS.CellValue[]).filter(Boolean);
    expect(folha.getRow(8).getCell(cabecalho.indexOf("Períodos") + 1).value).toBe(3);
  });

  it("licença determinada: sem colunas do produto proposto", () => {
    const pedido = snomed();
    const folha = gerarWorkbookMapaPrecos(pedido, lotesEfetivos(pedido)[0]).worksheets[0];
    const cabecalho = (folha.getRow(6).values as ExcelJS.CellValue[]).filter(Boolean);
    expect(cabecalho).not.toContain("Produto proposto");
    expect(folha.getCell(7, 2).value).toBe("Afiliação nacional SNOMED International — SNOMED International");
    expect(folha.getCell(2, 2).value).toBe("Aquisição de Licenciamento de SNOMED CT");
  });
});

describe("manifestação de necessidades do licenciamento", () => {
  async function textoDe(pedido: PedidoLicenciamento): Promise<string> {
    const zip = await JSZip.loadAsync(await (await gerarManifestacaoLicenciamentoBlob(pedido, QUANDO)).arrayBuffer());
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(bemFormado(xml)).toBe(true);
    return xml
      .replace(/<w:tab\/>/g, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/[\u00a0\u202f]/g, " ");
  }

  it("aberta: requisitos mínimos, condições e o preço como único aspeto", async () => {
    const texto = await textoDe(exemplo());
    expect(texto).toContain("MANIFESTAÇÃO DE NECESSIDADES PARA A AQUISIÇÃO DE LICENCIAMENTO DE ARQUIVO DIGITAL");
    expect(texto).toContain("828 256,00 €");
    expect(texto).toContain("Requisitos funcionais mínimos");
    expect(texto).toContain("Fluxos de aprovação configuráveis sem programação");
    expect(texto).toContain("sem referência a marca");
    expect(texto).toContain("Suporte técnico e níveis de serviço (SLA)");
    // As penalizações são facultativas, e vêm desligadas.
    expect(texto).not.toContain("artigo 329.º do CCP");
    expect(texto).toContain("O preço é o único aspeto da execução do contrato submetido à concorrência");
    expect(texto).toContain("Anexo V – Custos - Licenciamento (eAvalia)");
    expect(texto).toContain("Manutenção e suporte — Sistema de gestão de base de dados relacional");
    expect(texto).toContain("Disponibilidade do serviço");
  });

  it("licença determinada de terminologia (SNOMED CT): identificação, fundamento e condições adaptadas", async () => {
    const texto = await textoDe(snomed());
    expect(texto).toContain("AQUISIÇÃO DE LICENCIAMENTO DE SNOMED CT");
    expect(texto).toContain("Identificação das licenças");
    expect(texto).toContain("Direitos exclusivos do fabricante ou titular");
    expect(texto).toContain("Atualizações e novas edições");
    expect(texto).toContain("Terminologia, norma ou conteúdo");
    expect(texto).toContain("Gestor do Produto SNOMED CT");
    expect(texto).not.toContain("Requisitos funcionais mínimos");
    expect(texto).not.toContain("Disponibilidade do serviço");
    expect(texto).not.toContain("ambientes não produtivos");
    expect(texto).not.toContain("comunicação prévia");
  });

  it("as condições desligadas não saem", async () => {
    const pedido = exemplo();
    pedido.condicoes = { ...pedido.condicoes, disponibilidade: { ...pedido.condicoes.disponibilidade, ligada: false } };
    expect(await textoDe(pedido)).not.toContain("Disponibilidade do serviço");
  });

  it("as penalizações saem quando ligadas", async () => {
    const pedido = exemplo();
    pedido.condicoes = { ...pedido.condicoes, penalizacoes: { ...pedido.condicoes.penalizacoes, ligada: true } };
    const texto = await textoDe(pedido);
    expect(texto).toContain("artigo 329.º do CCP");
    expect(texto).toContain("as penalizações aí previstas");
  });

  it("beneficiários e benefícios operacionais editados saem; a rastreabilidade não", async () => {
    const pedido = snomed();
    pedido.beneficiarios = "Os serviços de codificação clínica.";
    pedido.beneficiosOperacionais = "Menos erros de codificação.";
    const texto = await textoDe(pedido);
    expect(texto).toContain("Beneficiários: Os serviços de codificação clínica.");
    expect(texto).toContain("Benefícios operacionais: Menos erros de codificação.");
    expect(texto).not.toContain("Rastreabilidade da execução");
  });

  it("os pressupostos só falam dos tipos de licença escolhidos; o direito de uso é facultativo", async () => {
    const snomed1 = snomed();
    snomed1.condicoes = { ...snomed1.condicoes, direitoUso: { ...snomed1.condicoes.direitoUso, ligada: false } };
    const texto = await textoDe(snomed1);
    expect(texto).toContain("os períodos são os anos do período");
    expect(texto).not.toContain("licença perpétua");
    expect(texto).not.toContain("consulta preliminar ao mercado");
    expect(texto).not.toContain("Direito de uso e transmissão");
    const software = await textoDe(exemplo());
    expect(software).toContain("A manutenção da licença perpétua tem linha própria");
    expect(software).toContain("Direito de uso e transmissão");
  });

  it("a origem do preço leva a referência", async () => {
    const texto = await textoDe(snomed());
    expect(texto).toContain("Orçamento do fabricante, titular ou distribuidor");
    expect(texto).toContain("SNOMED International; ref. Fatura pró-forma da afiliação");
    expect(texto).toContain("15/10/2026");
  });

  it("o sublicenciamento e a transmissão saem quando escolhidos", async () => {
    const pedido = snomed();
    pedido.condicoes = { ...pedido.condicoes, direitoUso: { ...pedido.condicoes.direitoUso, sublicenciamento: true } };
    const texto = await textoDe(pedido);
    expect(texto).toContain("pode sublicenciar");
    expect(texto).toContain("transmitidas, por inteiro e sem custo");
  });

  it("o pacote leva Word, eAvalia, um mapa por lote e o JSON", async () => {
    const nomes = (await ficheirosDoPedidoLicenciamento(exemplo(), QUANDO)).map((f) => f.nome);
    expect(nomes).toEqual([
      "Arquivo_Digital_Manifestacao_de_Necessidades_Licenciamento.docx",
      "Pedido_PPP_eavalia_Arquivo_Digital.xlsx",
      "Mapas de quantidades e precos/Arquivo_Digital_Mapa_de_Precos_Lote_1.xlsx",
      "Mapas de quantidades e precos/Arquivo_Digital_Mapa_de_Precos_Lote_2.xlsx",
      "Arquivo_Digital_Pedido_Licenciamento.json",
    ]);
  });
});
