// Exportação do agrupamento em lotes para Excel — Módulo 2.
//
// Usa exceljs (e não SheetJS) porque estas folhas são para ler e apresentar:
// precisam de cabeçalhos destacados, larguras de coluna, formato de moeda,
// linhas de total e painéis fixos.

import ExcelJS from "exceljs";
import type { LotesJSON } from "../core/types";
import { formatarNumero, linhasTabelaValores, taxaIva, totalLote, totalProcedimento } from "../core/lotes";
import { agruparPorExigencia } from "../core/perfil";
import { documentoCadernoEncargos, documentoProgramaConcurso } from "../core/cadernoEncargos";
import { documentoParaTexto } from "../core/documento";

const AZUL = "FF1F4E78";
const AZUL_CLARO = "FF2E75B6";
const CINZA = "FFF2F2F2";
const BRANCO = "FFFFFFFF";
const BORDA = "FFBFBFBF";

const FORMATO_MOEDA = '#,##0.00\\ "€"';
const FORMATO_NUMERO = "#,##0";

function bordaFina(): Partial<ExcelJS.Borders> {
  const lado = { style: "thin" as const, color: { argb: BORDA } };
  return { top: lado, bottom: lado, left: lado, right: lado };
}

function preencher(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

interface Coluna {
  titulo: string;
  largura: number;
  formato?: string;
}

function escreverCabecalho(sheet: ExcelJS.Worksheet, linha: number, colunas: Coluna[]): void {
  colunas.forEach((coluna, idx) => {
    const cell = sheet.getCell(linha, idx + 1);
    cell.value = coluna.titulo;
    cell.fill = preencher(AZUL);
    cell.font = { bold: true, color: { argb: BRANCO }, size: 10 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = bordaFina();
    sheet.getColumn(idx + 1).width = coluna.largura;
  });
  sheet.getRow(linha).height = 30;
}

function escreverLinha(
  sheet: ExcelJS.Worksheet,
  linha: number,
  colunas: Coluna[],
  valores: (string | number | null)[],
  opcoes: { destaque?: boolean } = {},
): void {
  colunas.forEach((coluna, idx) => {
    const cell = sheet.getCell(linha, idx + 1);
    const valor = valores[idx];
    if (valor !== null && valor !== undefined && valor !== "") cell.value = valor;
    if (coluna.formato && typeof valor === "number") cell.numFmt = coluna.formato;
    cell.border = bordaFina();
    cell.alignment = { vertical: "middle", wrapText: true };
    if (opcoes.destaque) {
      cell.fill = preencher(CINZA);
      cell.font = { bold: true, size: 10 };
    } else {
      cell.font = { size: 10 };
    }
  });
}

function folhaPrecoBase(wb: ExcelJS.Workbook, config: LotesJSON): void {
  const sheet = wb.addWorksheet("Preço base");
  const taxa = taxaIva(config);

  const colunas: Coluna[] = [
    { titulo: "Lote", largura: 8 },
    { titulo: "Designação do lote", largura: 30 },
    { titulo: "Perfil", largura: 34 },
    { titulo: "N.º mínimo de elementos", largura: 14 },
    { titulo: "Horas", largura: 12, formato: FORMATO_NUMERO },
    { titulo: "Preço/hora (s/ IVA)", largura: 16, formato: FORMATO_MOEDA },
    { titulo: "Preço base (s/ IVA)", largura: 18, formato: FORMATO_MOEDA },
    { titulo: `IVA (${formatarNumero(taxa)}%)`, largura: 16, formato: FORMATO_MOEDA },
    { titulo: "Preço base (c/ IVA)", largura: 18, formato: FORMATO_MOEDA },
  ];

  sheet.mergeCells(1, 1, 1, colunas.length);
  const titulo = sheet.getCell(1, 1);
  titulo.value = "Preço base por lote e perfil";
  titulo.font = { bold: true, size: 14, color: { argb: AZUL } };

  sheet.mergeCells(2, 1, 2, colunas.length);
  const nota = sheet.getCell(2, 1);
  nota.value =
    `Todos os preços unitários por hora são apresentados SEM IVA. A taxa de IVA aplicada é de ${formatarNumero(taxa)}%. ` +
    "O n.º mínimo de elementos é condição de admissibilidade e não multiplica o preço base.";
  nota.font = { italic: true, size: 9 };
  nota.alignment = { wrapText: true, vertical: "middle" };
  sheet.getRow(2).height = 28;

  const linhaCabecalho = 4;
  escreverCabecalho(sheet, linhaCabecalho, colunas);

  let linha = linhaCabecalho + 1;
  for (const l of linhasTabelaValores(config)) {
    escreverLinha(sheet, linha++, colunas, [
      l.lote,
      l.loteDesignacao,
      l.perfil,
      l.nMinimoElementos,
      l.horas,
      l.valorHora,
      l.valores.semIva,
      l.valores.iva,
      l.valores.comIva,
    ]);
  }

  linha++;
  for (const lote of config.lotes) {
    const total = totalLote(lote, taxa);
    escreverLinha(
      sheet,
      linha++,
      colunas,
      [lote.numero, "", `Subtotal do lote ${lote.numero}`, "", "", "", total.semIva, total.iva, total.comIva],
      { destaque: true },
    );
  }

  const total = totalProcedimento(config);
  escreverLinha(
    sheet,
    linha,
    colunas,
    ["", "", "Preço base total do procedimento", "", "", "", total.semIva, total.iva, total.comIva],
    { destaque: true },
  );

  sheet.views = [{ state: "frozen", ySplit: linhaCabecalho }];
}

function folhaRequisitos(wb: ExcelJS.Workbook, config: LotesJSON): void {
  const sheet = wb.addWorksheet("Requisitos por perfil");

  const colunas: Coluna[] = [
    { titulo: "Lote", largura: 8 },
    { titulo: "Perfil", largura: 34 },
    { titulo: "Requisito", largura: 52 },
    { titulo: "Experiência mínima (anos)", largura: 14, formato: FORMATO_NUMERO },
    { titulo: "Equivalente (meses)", largura: 14, formato: FORMATO_NUMERO },
  ];

  sheet.mergeCells(1, 1, 1, colunas.length);
  const titulo = sheet.getCell(1, 1);
  titulo.value = "Requisitos mínimos de experiência profissional";
  titulo.font = { bold: true, size: 14, color: { argb: AZUL } };

  const linhaCabecalho = 3;
  escreverCabecalho(sheet, linhaCabecalho, colunas);

  let linha = linhaCabecalho + 1;
  for (const lote of config.lotes) {
    for (const entrada of lote.perfis) {
      for (const grupo of agruparPorExigencia(entrada.perfil.requisitos)) {
        for (const designacao of grupo.designacoes) {
          escreverLinha(sheet, linha++, colunas, [
            lote.numero,
            entrada.perfil.perfil,
            designacao,
            grupo.anosMinimos,
            grupo.mesesMinimos,
          ]);
        }
      }
    }
  }

  sheet.views = [{ state: "frozen", ySplit: linhaCabecalho }];
}

/** Folha de texto corrido, para quem prefira copiar daqui em vez do Word. */
function folhaTexto(wb: ExcelJS.Workbook, nome: string, texto: string): void {
  const sheet = wb.addWorksheet(nome);
  sheet.getColumn(1).width = 120;

  texto.split("\n").forEach((linhaTexto, idx) => {
    const cell = sheet.getCell(idx + 1, 1);
    cell.value = linhaTexto;
    cell.font = { name: "Consolas", size: 10 };
    cell.alignment = { vertical: "top" };
  });

  const titulo = sheet.getCell(1, 1);
  titulo.font = { name: "Calibri", bold: true, size: 13, color: { argb: AZUL_CLARO } };
}

export function construirWorkbookLotes(config: LotesJSON): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Propostas";
  wb.created = new Date();

  folhaPrecoBase(wb, config);
  folhaRequisitos(wb, config);
  folhaTexto(wb, "Caderno de encargos", documentoParaTexto(documentoCadernoEncargos(config)));
  folhaTexto(wb, "Programa do concurso", documentoParaTexto(documentoProgramaConcurso(config)));

  return wb;
}

export async function gerarLotesBlob(config: LotesJSON): Promise<Blob> {
  const buffer = await construirWorkbookLotes(config).xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
