// Renderização de um Documento estruturado para .docx, com tabelas a sério.
// Destina-se a ser colado num pedido de informação interno ou na minuta das
// peças do procedimento.

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  PageOrientation,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { Alinhamento, BlocoDocumento, Celula, Coluna, Documento } from "../core/documento";
import { alineasDoItem, escalaDasImagens, marcaDeAlinea, partesDoParagrafo, textoDoItem } from "../core/documento";

const AZUL = "1F4E78";
const MARGEM = 1134;

/** A4, em DXA — a mesma folha nas duas orientações. */
const A4_CURTO = 11906;
const A4_LONGO = 16838;

/** Uma polegada tem 1440 DXA e 96 píxeis: é assim que a imagem cabe na página. */
const DXA_POR_PIXEL = 1440 / 96;

/** A área útil da página deitada, em píxeis: é lá que as folhas do anexo cabem. */
function areaEmPaisagem(): { largura: number; altura: number } {
  return {
    largura: (A4_LONGO - 2 * MARGEM) / DXA_POR_PIXEL,
    altura: (A4_CURTO - 2 * MARGEM) / DXA_POR_PIXEL,
  };
}
const AZUL_CLARO = "2E75B6";
const CINZA = "F2F2F2";
const BORDA = "BFBFBF";

function alinhamentoDocx(a: Alinhamento | undefined) {
  if (a === "direita") return AlignmentType.RIGHT;
  if (a === "centro") return AlignmentType.CENTER;
  return AlignmentType.LEFT;
}

function bordaFina() {
  return { style: BorderStyle.SINGLE, size: 4, color: BORDA };
}

function bordasCelula() {
  return { top: bordaFina(), bottom: bordaFina(), left: bordaFina(), right: bordaFina() };
}

function celulaCabecalho(coluna: Coluna): TableCell {
  return new TableCell({
    width: { size: coluna.peso ?? 100, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: AZUL, color: "auto" },
    borders: bordasCelula(),
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment: alinhamentoDocx(coluna.alinhamento),
        children: [new TextRun({ text: coluna.titulo, bold: true, color: "FFFFFF", size: 18 })],
      }),
    ],
  });
}

function celulaCorpo(valor: Celula, coluna: Coluna): TableCell {
  return new TableCell({
    width: { size: coluna.peso ?? 100, type: WidthType.PERCENTAGE },
    borders: bordasCelula(),
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    shading: valor.destaque ? { type: ShadingType.CLEAR, fill: CINZA, color: "auto" } : undefined,
    children: [
      new Paragraph({
        alignment: alinhamentoDocx(valor.alinhamento ?? coluna.alinhamento),
        children: [new TextRun({ text: valor.texto, bold: valor.destaque, size: 18 })],
      }),
    ],
  });
}

function tabelaDocx(bloco: Extract<BlocoDocumento, { tipo: "tabela" }>): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: bloco.colunas.map(celulaCabecalho) }),
      ...bloco.linhas.map(
        (linha) =>
          new TableRow({
            children: bloco.colunas.map((coluna, i) => celulaCorpo(linha[i] ?? { texto: "" }, coluna)),
          }),
      ),
    ],
  });
}

function blocoParaDocx(bloco: BlocoDocumento, escala = 1): (Paragraph | Table)[] {
  switch (bloco.tipo) {
    case "titulo":
      return [
        new Paragraph({
          heading:
            bloco.nivel === 1 ? HeadingLevel.HEADING_1 : bloco.nivel === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
          spacing: { before: 280, after: 120 },
          children: [
            new TextRun({
              text: bloco.texto,
              bold: true,
              color: bloco.nivel === 1 ? AZUL : AZUL_CLARO,
              size: bloco.nivel === 1 ? 28 : bloco.nivel === 2 ? 24 : 22,
            }),
          ],
        }),
      ];

    case "paragrafo":
      return [
        new Paragraph({
          spacing: { after: 120 },
          alignment: AlignmentType.JUSTIFIED,
          children: partesDoParagrafo(bloco).map(
            (parte) => new TextRun({ text: parte.texto, size: 20, bold: parte.destaque }),
          ),
        }),
      ];

    case "nota":
      return [
        new Paragraph({
          spacing: { before: 200, after: 120 },
          alignment: AlignmentType.JUSTIFIED,
          border: { left: { style: BorderStyle.SINGLE, size: 12, color: AZUL_CLARO, space: 8 } },
          children: [new TextRun({ text: bloco.texto, italics: true, size: 18 })],
        }),
      ];

    case "lista":
      return bloco.itens.flatMap((item, i) => [
        new Paragraph({
          spacing: { after: 80 },
          alignment: AlignmentType.JUSTIFIED,
          indent: { left: 360, hanging: 360 },
          children: [
            new TextRun({ text: bloco.numerada ? `${i + 1}. ` : "• ", size: 20 }),
            new TextRun({ text: textoDoItem(item), size: 20 }),
          ],
        }),
        // As alíneas avançam mais um degrau, sem número próprio na série.
        ...alineasDoItem(item).map(
          (alinea, j) =>
            new Paragraph({
              spacing: { after: 60 },
              alignment: AlignmentType.JUSTIFIED,
              indent: { left: 720, hanging: 360 },
              children: [
                new TextRun({ text: `${marcaDeAlinea(j)} `, size: 20 }),
                new TextRun({ text: alinea, size: 20 }),
              ],
            }),
        ),
      ]);

    case "tabela": {
      const partes: (Paragraph | Table)[] = [];
      if (bloco.legenda) {
        partes.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: bloco.legenda, italics: true, size: 18 })],
          }),
        );
      }
      partes.push(tabelaDocx(bloco));
      partes.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
      return partes;
    }

    case "quebraDePagina":
      return [new Paragraph({ children: [new PageBreak()] })];

    case "imagem":
      return [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 0 },
          children: [
            new ImageRun({
              type: "png",
              data: bloco.dados,
              altText: { name: bloco.descricao, description: bloco.descricao, title: bloco.descricao },
              // Arredonda-se para baixo: meio píxel a mais e a folha já não
              // cabe na altura da página, e o Word empurra-a para a seguinte.
              transformation: {
                width: Math.floor(bloco.largura * escala),
                height: Math.floor(bloco.altura * escala),
              },
            }),
          ],
        }),
      ];
  }
}

export function construirDocx(documentos: Documento[]): Document {
  const filhos: (Paragraph | Table)[] = [];
  const emPaisagem: (Paragraph | Table)[] = [];

  documentos.forEach((doc, idx) => {
    if (idx > 0) {
      filhos.push(new Paragraph({ pageBreakBefore: true, children: [] }));
    }

    filhos.push(
      new Paragraph({
        spacing: { after: doc.subtitulo ? 40 : 240 },
        children: [new TextRun({ text: doc.titulo, bold: true, size: 34, color: AZUL })],
      }),
    );

    if (doc.subtitulo) {
      filhos.push(
        new Paragraph({
          spacing: { after: 240 },
          children: [new TextRun({ text: doc.subtitulo, italics: true, size: 20, color: "595959" })],
        }),
      );
    }

    for (const bloco of doc.blocos) filhos.push(...blocoParaDocx(bloco));

    // A secção horizontal é comum a todos os documentos do ficheiro: são
    // páginas de anexo, e uma secção por documento espalhava-as pelo meio.
    const area = areaEmPaisagem();
    const escala = escalaDasImagens(doc.blocosEmPaisagem ?? [], area.largura, area.altura);
    for (const bloco of doc.blocosEmPaisagem ?? []) emPaisagem.push(...blocoParaDocx(bloco, escala));
  });

  return new Document({
    creator: "Propostas",
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 20 } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_CURTO, height: A4_LONGO, orientation: PageOrientation.PORTRAIT },
            margin: { top: MARGEM, bottom: MARGEM, left: MARGEM, right: MARGEM },
          },
        },
        children: filhos,
      },
      // As folhas do anexo são mais largas do que altas: numa página vertical
      // sairiam reduzidas a pouco mais de metade.
      ...(emPaisagem.length === 0
        ? []
        : [
            {
              properties: {
                page: {
                  // As medidas vão em retrato nas duas secções: é a orientação
                  // que as troca, e trocá-las aqui desfazia a troca.
                  size: { width: A4_CURTO, height: A4_LONGO, orientation: PageOrientation.LANDSCAPE },
                  margin: { top: MARGEM, bottom: MARGEM, left: MARGEM, right: MARGEM },
                },
              },
              children: emPaisagem,
            },
          ]),
    ],
  });
}

export async function gerarDocxBlob(documentos: Documento[]): Promise<Blob> {
  return Packer.toBlob(construirDocx(documentos));
}
