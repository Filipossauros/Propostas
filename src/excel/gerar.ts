// Geração do formulário de declaração de experiência em Excel (PLANO.md secção 5).
// Usa exceljs (e não SheetJS) para a escrita: estilos de célula, validação de
// dados e proteção de folha sem palavra-passe só existem na versão gratuita
// do exceljs — no SheetJS ("xlsx") esses recursos são exclusivos da versão Pro.

import ExcelJS from "exceljs";
import type { EspecificacaoFormulario } from "../core/types";
import {
  CAMPOS_IDENTIFICACAO,
  LINHA_ASSINATURA,
  LINHA_BRANCO_APOS_IDENTIFICACAO,
  LINHA_DECLARACAO_VERACIDADE,
  LINHA_FAIXA_IDENTIFICACAO,
  LINHA_SUBTITULO,
  LINHA_TITULO,
  LISTAS_MESES,
  LISTAS_SIM_NAO_MAIUSC,
  NOME_FOLHA_EXPERIENCIA,
  NOME_FOLHA_LEIAME,
  NOME_FOLHA_LISTAS,
  OFFSET_CABECALHO_DATAS_PROJETO,
  OFFSET_CLIENTE_PROJETO,
  OFFSET_DATAS_PROJETO,
  OFFSET_FUNCAO,
  OFFSET_PRIMEIRA_LINHA_REQUISITO,
  OFFSET_SUBCABECALHO,
  ROTULO_ASSINATURA,
  TEXTO_DECLARACAO_VERACIDADE,
  TEXTO_DISCLAIMER_PROJETO_EM_CURSO,
  TEXTO_NOTA_BLOCO,
  TEXTO_ROTULO_CLIENTE,
  TEXTO_ROTULO_FIM_PROJETO,
  TEXTO_ROTULO_FUNCAO,
  TEXTO_ROTULO_INICIO_PROJETO,
  TEXTO_ROTULO_PROJETO,
  TEXTO_CABECALHO_ANO,
  TEXTO_CABECALHO_MES,
  TEXTO_SUBCABECALHO_DECLARA,
  TEXTO_SUBCABECALHO_FIM_ANO,
  TEXTO_SUBCABECALHO_FIM_MES,
  TEXTO_SUBCABECALHO_INICIO_ANO,
  TEXTO_SUBCABECALHO_INICIO_MES,
  TEXTO_SUBCABECALHO_REQUISITO,
  linhaInicialBloco,
  offsetBrancoBloco,
  offsetNotaBloco,
  tituloFaixaBloco,
  ANO_MINIMO,
  ANO_MAXIMO,
} from "./layout";

const COR_FAIXA = "FF1F4E78";
const COR_SUBCABECALHO = "FF2E75B6";
const COR_ROTULO_BG = "FFF2F2F2";
const COR_CAMPO_BG = "FFFAF0DC";
const COR_CAMPO_TEXTO = "FF1F4E78";
const COR_CAMPO_BORDA = "FFB99C5E";
const COR_CAMPO_BLOQUEADO_BG = "FFE9ECF1";
const COR_CAMPO_BLOQUEADO_TEXTO = "FF3B4A5A";
const COR_NOTA_BG = "FFEFF3F6";
const COR_BRANCO = "FFFFFFFF";

const COLUNAS: Array<{ largura: number }> = [
  { largura: 30 }, // A
  { largura: 16 }, // B
  { largura: 11 }, // C
  { largura: 22 }, // D
  { largura: 16 }, // E
  { largura: 11 }, // F
  { largura: 16 }, // G
  { largura: 16 }, // H
];

function fillSolido(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function aplicarFaixa(sheet: ExcelJS.Worksheet, linha: number, texto: string): void {
  sheet.mergeCells(linha, 1, linha, 8);
  const cell = sheet.getCell(linha, 1);
  cell.value = texto;
  cell.fill = fillSolido(COR_FAIXA);
  cell.font = { bold: true, color: { argb: COR_BRANCO }, size: 11 };
  cell.alignment = { vertical: "middle", horizontal: "left" };
  cell.protection = { locked: true };
  for (let c = 1; c <= 8; c++) sheet.getCell(linha, c).protection = { locked: true };
}

function aplicarRotulo(cell: ExcelJS.Cell, texto: string): void {
  cell.value = texto;
  cell.fill = fillSolido(COR_ROTULO_BG);
  cell.font = { bold: true, size: 10 };
  cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  cell.protection = { locked: true };
}

/**
 * Campo preenchível pelo candidato.
 *
 * A caixa fechada (bordas nos quatro lados) é deliberada: com um simples
 * sublinhado, as colunas de mês e de ano liam-se como um campo único e não era
 * claro qual delas correspondia a que rótulo.
 */
function aplicarCampoEditavel(cell: ExcelJS.Cell, alinhamento: "left" | "center" = "left"): void {
  const lado = { style: "thin" as const, color: { argb: COR_CAMPO_BORDA } };
  cell.fill = fillSolido(COR_CAMPO_BG);
  cell.font = { color: { argb: COR_CAMPO_TEXTO }, size: 10 };
  cell.alignment = { vertical: "middle", horizontal: alinhamento };
  cell.border = { top: lado, bottom: lado, left: lado, right: lado };
  cell.protection = { locked: false };
}

/** Campo pré-preenchido e bloqueado: o candidato não o edita — vem definido pela entidade emitente. */
function aplicarCampoBloqueado(cell: ExcelJS.Cell, valor: string, alinhamento: "left" | "center" = "left"): void {
  cell.value = valor;
  cell.fill = fillSolido(COR_CAMPO_BLOQUEADO_BG);
  cell.font = { color: { argb: COR_CAMPO_BLOQUEADO_TEXTO }, size: 10, italic: true };
  cell.alignment = { vertical: "middle", horizontal: alinhamento };
  cell.protection = { locked: true };
}

/** Cabeçalho pequeno ("Mês"/"Ano") por cima de uma célula de data — mesmo tratamento do subcabeçalho dos requisitos. */
function aplicarCabecalhoData(cell: ExcelJS.Cell, texto: string): void {
  aplicarSubcabecalho(cell, texto);
}

function aplicarSubcabecalho(cell: ExcelJS.Cell, texto: string): void {
  cell.value = texto;
  cell.fill = fillSolido(COR_SUBCABECALHO);
  cell.font = { bold: true, color: { argb: COR_BRANCO }, size: 10 };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = {
    top: { style: "thin", color: { argb: COR_BRANCO } },
    bottom: { style: "thin", color: { argb: COR_BRANCO } },
    left: { style: "thin", color: { argb: COR_BRANCO } },
    right: { style: "thin", color: { argb: COR_BRANCO } },
  };
  cell.protection = { locked: true };
}

function validarMes(cell: ExcelJS.Cell): void {
  cell.dataValidation = {
    type: "list",
    allowBlank: true,
    formulae: [`${NOME_FOLHA_LISTAS}!$${LISTAS_MESES.col}$${LISTAS_MESES.primeiraLinha}:$${LISTAS_MESES.col}$${LISTAS_MESES.ultimaLinha}`],
    showErrorMessage: true,
    errorStyle: "error",
    errorTitle: "Mês inválido",
    error: "Selecione um mês da lista (1 a 12) ou deixe em branco.",
  };
}

function validarAno(cell: ExcelJS.Cell): void {
  cell.dataValidation = {
    type: "whole",
    operator: "between",
    allowBlank: true,
    formulae: [ANO_MINIMO, ANO_MAXIMO],
    showErrorMessage: true,
    errorStyle: "error",
    errorTitle: "Ano inválido",
    error: `Indique um ano entre ${ANO_MINIMO} e ${ANO_MAXIMO}, ou deixe em branco.`,
  };
}

function validarDeclara(cell: ExcelJS.Cell): void {
  cell.dataValidation = {
    type: "list",
    allowBlank: false,
    formulae: [`${NOME_FOLHA_LISTAS}!$${LISTAS_SIM_NAO_MAIUSC.col}$${LISTAS_SIM_NAO_MAIUSC.primeiraLinha}:$${LISTAS_SIM_NAO_MAIUSC.col}$${LISTAS_SIM_NAO_MAIUSC.ultimaLinha}`],
    showErrorMessage: true,
    errorStyle: "error",
    errorTitle: "Campo obrigatório",
    error: 'Indique "SIM" ou "NÃO" — este campo é de preenchimento obrigatório.',
  };
}

function validarTexto(cell: ExcelJS.Cell): void {
  cell.dataValidation = {
    type: "textLength",
    operator: "between",
    allowBlank: true,
    formulae: [1, 120],
    showErrorMessage: true,
    errorStyle: "error",
    errorTitle: "Texto inválido",
    error: "O texto deve ter entre 1 e 120 carateres, ou ficar em branco.",
  };
}

/**
 * Subtítulo do formulário: apenas o perfil.
 *
 * Nem o procedimento nem o lote aparecem aqui — na fase em que o formulário é
 * desenhado, nenhum dos dois está decidido. O procedimento existe adiante, como
 * campo de identificação que o candidato preenche.
 */
function subtitulo(config: EspecificacaoFormulario): string {
  return config.perfil;
}

function construirFolhaLeiame(wb: ExcelJS.Workbook, config: EspecificacaoFormulario): void {
  const sheet = wb.addWorksheet(NOME_FOLHA_LEIAME);
  sheet.getColumn(1).width = 110;

  const linhas: Array<{ texto: string; titulo?: boolean }> = [
    { texto: "DECLARAÇÃO DE EXPERIÊNCIA PROFISSIONAL — INSTRUÇÕES DE PREENCHIMENTO", titulo: true },
    { texto: "" },
    { texto: subtitulo(config) },
    { texto: "" },
    {
      texto:
        "1. Preencha primeiro os dados de identificação, no topo da folha \"Experiência\". Todos os campos são de preenchimento obrigatório.",
    },
    {
      texto:
        "2. Cada bloco \"PROJETO n\" corresponde a um projeto distinto. Preencha o cliente/entidade, o projeto, a função desempenhada e o período de execução (mês e ano de início e de fim).",
    },
    {
      texto:
        "3. Para cada requisito listado dentro do bloco, indique se declara experiência nesse projeto (\"SIM\" ou \"NÃO\" — obrigatório). As datas de início/fim da experiência só devem ser preenchidas quando forem diferentes do período do projeto; em branco, considera-se que a experiência decorreu durante todo o período do projeto.",
    },
    {
      texto:
        "4. Não é permitido inserir nem eliminar linhas ou colunas. Utilize apenas os blocos disponibilizados no ficheiro.",
    },
    {
      texto:
        "5. Após concluir o preenchimento, assine digitalmente o documento com assinatura digital qualificada e submeta o PDF resultante nos termos do procedimento.",
    },
  ];

  linhas.forEach((l, idx) => {
    const row = idx + 1;
    const cell = sheet.getCell(row, 1);
    cell.value = l.texto;
    cell.alignment = { wrapText: true, vertical: "top" };
    if (l.titulo) cell.font = { bold: true, size: 13 };
  });
}

function construirFolhaListas(wb: ExcelJS.Workbook): void {
  const sheet = wb.addWorksheet(NOME_FOLHA_LISTAS, { state: "hidden" });
  sheet.getCell(`B1`).value = "Sim/Não";
  sheet.getCell(`B2`).value = "Sim";
  sheet.getCell(`B3`).value = "Não";
  sheet.getCell(`C1`).value = "SIM/NÃO";
  sheet.getCell(`C2`).value = "SIM";
  sheet.getCell(`C3`).value = "NÃO";
  sheet.getCell(`D1`).value = "Mês";
  for (let m = 1; m <= 12; m++) {
    sheet.getCell(m + 1, 4).value = m;
  }
}

function construirFolhaExperiencia(wb: ExcelJS.Workbook, config: EspecificacaoFormulario): void {
  const sheet = wb.addWorksheet(NOME_FOLHA_EXPERIENCIA);
  COLUNAS.forEach((c, idx) => {
    sheet.getColumn(idx + 1).width = c.largura;
  });

  sheet.mergeCells(LINHA_TITULO, 1, LINHA_TITULO, 8);
  const tituloCell = sheet.getCell(LINHA_TITULO, 1);
  tituloCell.value = "DECLARAÇÃO DE EXPERIÊNCIA PROFISSIONAL";
  tituloCell.font = { bold: true, size: 14 };
  tituloCell.alignment = { horizontal: "center" };

  sheet.mergeCells(LINHA_SUBTITULO, 1, LINHA_SUBTITULO, 8);
  const subtituloCell = sheet.getCell(LINHA_SUBTITULO, 1);
  subtituloCell.value = subtitulo(config);
  subtituloCell.font = { italic: true, size: 11 };
  subtituloCell.alignment = { horizontal: "center" };

  aplicarFaixa(sheet, LINHA_FAIXA_IDENTIFICACAO, "IDENTIFICAÇÃO DO CANDIDATO");

  for (const { linha, rotulo, campo: nomeCampo } of CAMPOS_IDENTIFICACAO) {
    aplicarRotulo(sheet.getCell(linha, 1), rotulo);
    sheet.mergeCells(linha, 2, linha, 8);
    const campo = sheet.getCell(linha, 2);

    if (nomeCampo === "perfil") {
      aplicarCampoBloqueado(campo, config.perfil);
    } else if (nomeCampo === "lote" && config.lote) {
      aplicarCampoBloqueado(campo, config.lote);
    } else {
      aplicarCampoEditavel(campo);
      validarTexto(campo);
    }
  }

  sheet.mergeCells(LINHA_DECLARACAO_VERACIDADE, 1, LINHA_DECLARACAO_VERACIDADE, 8);
  const declaracaoCell = sheet.getCell(LINHA_DECLARACAO_VERACIDADE, 1);
  declaracaoCell.value = TEXTO_DECLARACAO_VERACIDADE;
  declaracaoCell.alignment = { wrapText: true, vertical: "middle" };
  declaracaoCell.font = { italic: true, size: 9 };
  declaracaoCell.protection = { locked: true };
  sheet.getRow(LINHA_DECLARACAO_VERACIDADE).height = 45;

  aplicarRotulo(sheet.getCell(LINHA_ASSINATURA, 1), ROTULO_ASSINATURA);
  sheet.mergeCells(LINHA_ASSINATURA, 2, LINHA_ASSINATURA, 8);
  aplicarCampoEditavel(sheet.getCell(LINHA_ASSINATURA, 2));

  void LINHA_BRANCO_APOS_IDENTIFICACAO; // linha em branco: nenhuma célula a preencher

  const nRequisitos = config.requisitos.length;
  for (let i = 1; i <= config.nBlocos; i++) {
    const linhaInicial = linhaInicialBloco(i, nRequisitos);

    aplicarFaixa(sheet, linhaInicial, tituloFaixaBloco(i));

    const linhaClienteProjeto = linhaInicial + OFFSET_CLIENTE_PROJETO;
    aplicarRotulo(sheet.getCell(linhaClienteProjeto, 1), TEXTO_ROTULO_CLIENTE);
    sheet.mergeCells(linhaClienteProjeto, 2, linhaClienteProjeto, 3);
    const campoCliente = sheet.getCell(linhaClienteProjeto, 2);
    aplicarCampoEditavel(campoCliente);
    validarTexto(campoCliente);

    aplicarRotulo(sheet.getCell(linhaClienteProjeto, 4), TEXTO_ROTULO_PROJETO);
    sheet.mergeCells(linhaClienteProjeto, 5, linhaClienteProjeto, 8);
    const campoProjeto = sheet.getCell(linhaClienteProjeto, 5);
    aplicarCampoEditavel(campoProjeto);
    validarTexto(campoProjeto);

    const linhaFuncao = linhaInicial + OFFSET_FUNCAO;
    aplicarRotulo(sheet.getCell(linhaFuncao, 1), TEXTO_ROTULO_FUNCAO);
    sheet.mergeCells(linhaFuncao, 2, linhaFuncao, 8);
    const campoFuncao = sheet.getCell(linhaFuncao, 2);
    aplicarCampoEditavel(campoFuncao);
    validarTexto(campoFuncao);

    const linhaCabecalhoDatas = linhaInicial + OFFSET_CABECALHO_DATAS_PROJETO;
    aplicarCabecalhoData(sheet.getCell(linhaCabecalhoDatas, 2), TEXTO_CABECALHO_MES);
    aplicarCabecalhoData(sheet.getCell(linhaCabecalhoDatas, 3), TEXTO_CABECALHO_ANO);
    aplicarCabecalhoData(sheet.getCell(linhaCabecalhoDatas, 5), TEXTO_CABECALHO_MES);
    aplicarCabecalhoData(sheet.getCell(linhaCabecalhoDatas, 6), TEXTO_CABECALHO_ANO);
    sheet.mergeCells(linhaCabecalhoDatas, 7, linhaCabecalhoDatas, 8);

    const linhaDatas = linhaInicial + OFFSET_DATAS_PROJETO;
    aplicarRotulo(sheet.getCell(linhaDatas, 1), TEXTO_ROTULO_INICIO_PROJETO);
    const inicioMes = sheet.getCell(linhaDatas, 2);
    aplicarCampoEditavel(inicioMes, "center");
    validarMes(inicioMes);
    const inicioAno = sheet.getCell(linhaDatas, 3);
    aplicarCampoEditavel(inicioAno, "center");
    validarAno(inicioAno);

    aplicarRotulo(sheet.getCell(linhaDatas, 4), TEXTO_ROTULO_FIM_PROJETO);
    const fimMes = sheet.getCell(linhaDatas, 5);
    aplicarCampoEditavel(fimMes, "center");
    validarMes(fimMes);
    const fimAno = sheet.getCell(linhaDatas, 6);
    aplicarCampoEditavel(fimAno, "center");
    validarAno(fimAno);

    sheet.mergeCells(linhaDatas, 7, linhaDatas, 8);
    const disclaimerEmCurso = sheet.getCell(linhaDatas, 7);
    disclaimerEmCurso.value = TEXTO_DISCLAIMER_PROJETO_EM_CURSO;
    disclaimerEmCurso.font = { italic: true, size: 8 };
    disclaimerEmCurso.alignment = { wrapText: true, vertical: "middle" };
    disclaimerEmCurso.protection = { locked: true };
    sheet.getRow(linhaDatas).height = 42;

    const linhaSub = linhaInicial + OFFSET_SUBCABECALHO;
    sheet.mergeCells(linhaSub, 1, linhaSub, 3);
    aplicarSubcabecalho(sheet.getCell(linhaSub, 1), TEXTO_SUBCABECALHO_REQUISITO);
    aplicarSubcabecalho(sheet.getCell(linhaSub, 4), TEXTO_SUBCABECALHO_DECLARA);
    aplicarSubcabecalho(sheet.getCell(linhaSub, 5), TEXTO_SUBCABECALHO_INICIO_MES);
    aplicarSubcabecalho(sheet.getCell(linhaSub, 6), TEXTO_SUBCABECALHO_INICIO_ANO);
    aplicarSubcabecalho(sheet.getCell(linhaSub, 7), TEXTO_SUBCABECALHO_FIM_MES);
    aplicarSubcabecalho(sheet.getCell(linhaSub, 8), TEXTO_SUBCABECALHO_FIM_ANO);
    sheet.getRow(linhaSub).height = 32;

    config.requisitos.forEach((requisito, idxReq) => {
      const linhaReq = linhaInicial + OFFSET_PRIMEIRA_LINHA_REQUISITO + idxReq;
      sheet.mergeCells(linhaReq, 1, linhaReq, 3);
      aplicarRotulo(sheet.getCell(linhaReq, 1), requisito.designacao);
      sheet.getCell(linhaReq, 1).alignment = { vertical: "middle", horizontal: "left", wrapText: true };

      const declaraCell = sheet.getCell(linhaReq, 4);
      aplicarCampoEditavel(declaraCell, "center");
      validarDeclara(declaraCell);

      const inicioReqMes = sheet.getCell(linhaReq, 5);
      aplicarCampoEditavel(inicioReqMes, "center");
      validarMes(inicioReqMes);
      const inicioReqAno = sheet.getCell(linhaReq, 6);
      aplicarCampoEditavel(inicioReqAno, "center");
      validarAno(inicioReqAno);

      const fimReqMes = sheet.getCell(linhaReq, 7);
      aplicarCampoEditavel(fimReqMes, "center");
      validarMes(fimReqMes);
      const fimReqAno = sheet.getCell(linhaReq, 8);
      aplicarCampoEditavel(fimReqAno, "center");
      validarAno(fimReqAno);
    });

    const linhaNota = linhaInicial + offsetNotaBloco(nRequisitos);
    sheet.mergeCells(linhaNota, 1, linhaNota, 8);
    const notaCell = sheet.getCell(linhaNota, 1);
    notaCell.value = TEXTO_NOTA_BLOCO;
    notaCell.fill = fillSolido(COR_NOTA_BG);
    notaCell.font = { italic: true, size: 9 };
    notaCell.alignment = { wrapText: true, vertical: "middle" };
    notaCell.protection = { locked: true };
    sheet.getRow(linhaNota).height = 30;

    void offsetBrancoBloco(nRequisitos); // linha em branco: nenhuma célula a preencher
  }

  sheet.views = [{ state: "frozen", ySplit: LINHA_FAIXA_IDENTIFICACAO }];

  sheet.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: true,
    formatColumns: true,
    formatRows: true,
    insertRows: false,
    insertColumns: false,
    insertHyperlinks: false,
    deleteRows: false,
    deleteColumns: false,
    sort: false,
    autoFilter: false,
    pivotTables: false,
  });
}

/** Gera o workbook completo (3 folhas) a partir da configuração — PLANO.md secção 5. */
export function gerarWorkbookDeclaracao(config: EspecificacaoFormulario): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Propostas";
  wb.created = new Date();

  construirFolhaLeiame(wb, config);
  construirFolhaListas(wb);
  construirFolhaExperiencia(wb, config);

  return wb;
}

export async function gerarDeclaracaoExcelBlob(config: EspecificacaoFormulario): Promise<Blob> {
  const wb = gerarWorkbookDeclaracao(config);
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
