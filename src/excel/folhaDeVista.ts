// O vocabulário visual das folhas de vista — a da unidade e a da direção.
//
// As duas folhas são a mesma coisa a alturas diferentes: faixa azul no topo,
// nota, cabeçalho claro, linhas em banda e uma faixa de totais no fim. Escrito
// uma vez, as duas não podem divergir — e a terceira, quando vier, herda-o.
//
// Sem células unidas nas linhas de dados, de propósito: uma folha destas acaba
// sempre a ser filtrada e cruzada em tabela dinâmica, e células unidas partem
// as duas coisas.

import type ExcelJS from "exceljs";
import {
  COR_BRANCO,
  COR_FAIXA,
  COR_GRELHA,
  COR_LINHA_ALTERNADA,
  COR_NOTA_TEXTO,
  COR_ROTULO_BG,
  COR_ROTULO_TEXTO,
  COR_SUBCABECALHO,
  contorno,
  fillSolido,
} from "./estilo";

export const LETRA = "Calibri";
export const MOEDA = '#,##0.00\\ "€"';
export const PERCENTAGEM = '0.0\\ "%"';

/** Uma célula da folha, já reduzida a valor — a folha não recalcula nada. */
export interface Celula {
  valor: string | number | null;
  formato?: string;
  esquerda?: boolean;
  italico?: boolean;
}

export function texto(valor: string, italico = false): Celula {
  return { valor, esquerda: true, italico };
}

export function moeda(valor: number | null): Celula {
  return { valor, formato: MOEDA };
}

export function faixa(folha: ExcelJS.Worksheet, linha: number, nColunas: number, valor: string): void {
  folha.mergeCells(linha, 1, linha, nColunas);
  const celula = folha.getCell(linha, 1);
  celula.value = valor;
  celula.font = { name: LETRA, size: 14, bold: true, color: { argb: COR_BRANCO } };
  celula.fill = fillSolido(COR_FAIXA);
  celula.alignment = { vertical: "middle", indent: 1 };
  folha.getRow(linha).height = 28;
}

export function nota(folha: ExcelJS.Worksheet, linha: number, nColunas: number, valor: string): void {
  folha.mergeCells(linha, 1, linha, nColunas);
  const celula = folha.getCell(linha, 1);
  celula.value = valor;
  celula.font = { name: LETRA, size: 9, italic: true, color: { argb: COR_NOTA_TEXTO } };
  celula.alignment = { vertical: "middle", wrapText: true, indent: 1 };
  folha.getRow(linha).height = 26;
}

export function cabecalho(folha: ExcelJS.Worksheet, linha: number, titulos: string[]): void {
  titulos.forEach((titulo, i) => {
    const celula = folha.getCell(linha, i + 1);
    celula.value = titulo;
    celula.font = { name: LETRA, size: 10, bold: true, color: { argb: COR_ROTULO_TEXTO } };
    celula.fill = fillSolido(COR_ROTULO_BG);
    celula.border = contorno(COR_GRELHA);
    celula.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  folha.getRow(linha).height = 46;
}

export function escreverLinha(folha: ExcelJS.Worksheet, linha: number, celulas: Celula[], banda: boolean): void {
  celulas.forEach((c, i) => {
    const celula = folha.getCell(linha, i + 1);
    celula.value = c.valor;
    celula.font = { name: LETRA, size: 10, italic: c.italico === true };
    celula.border = contorno(COR_GRELHA);
    celula.alignment = {
      vertical: "middle",
      horizontal: c.esquerda === true ? "left" : "center",
      wrapText: true,
      indent: c.esquerda === true ? 1 : 0,
    };
    if (c.formato !== undefined && typeof c.valor === "number") celula.numFmt = c.formato;
    if (banda) celula.fill = fillSolido(COR_LINHA_ALTERNADA);
  });
  folha.getRow(linha).height = 20;
}

interface ValorDeTotal {
  coluna: number;
  valor: string | number;
  formato?: string;
}

export function faixaDeTotais(folha: ExcelJS.Worksheet, linha: number, nColunas: number, valores: ValorDeTotal[]): void {
  // A faixa cobre a linha toda, mesmo as colunas sem número.
  for (let coluna = 1; coluna <= nColunas; coluna++) {
    const celula = folha.getCell(linha, coluna);
    celula.fill = fillSolido(COR_SUBCABECALHO);
    celula.border = contorno(COR_GRELHA);
  }

  for (const v of valores) {
    const celula = folha.getCell(linha, v.coluna);
    celula.value = v.valor;
    celula.font = { name: LETRA, size: 11, bold: true, color: { argb: COR_BRANCO } };
    celula.alignment = {
      vertical: "middle",
      horizontal: typeof v.valor === "string" ? "left" : "center",
      indent: typeof v.valor === "string" ? 1 : 0,
    };
    if (v.formato !== undefined && typeof v.valor === "number") celula.numFmt = v.formato;
  }
  folha.getRow(linha).height = 24;
}
