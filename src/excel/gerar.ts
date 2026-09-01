// Geração do formulário de declaração de experiência em Excel (PLANO.md secção 5).
// Usa exceljs (e não SheetJS) para a escrita: estilos de célula, validação de
// dados e proteção de folha sem palavra-passe só existem na versão gratuita
// do exceljs — no SheetJS ("xlsx") esses recursos são exclusivos da versão Pro.

import ExcelJS from "exceljs";
import type { EspecificacaoFormulario } from "../core/types";
import {
  COR_BRANCO,
  COR_CAMPO_BG,
  COR_CAMPO_BLOQUEADO_BG,
  COR_CAMPO_BLOQUEADO_TEXTO,
  COR_CAMPO_BORDA,
  COR_CAMPO_TEXTO,
  COR_FAIXA,
  COR_NOTA_BG,
  COR_NOTA_TEXTO,
  COR_ROTULO_BG,
  COR_ROTULO_TEXTO,
  COR_SUBCABECALHO,
  fillSolido,
} from "./estilo";
import {
  CAMPOS_IDENTIFICACAO,
  LINHA_ASSINATURA,
  LINHA_BRANCO_APOS_IDENTIFICACAO,
  LINHA_DECLARACAO_VERACIDADE,
  LINHA_FAIXA_IDENTIFICACAO,
  LINHA_SUBTITULO,
  LINHA_TITULO,
  LISTAS_SIM_NAO_MAIUSC,
  NOME_FOLHA_LEIAME,
  NOME_FOLHA_LISTAS,
  nomeFolhaPerfil,
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
} from "./layout";

/** Alturas de linha, para o formulário respirar em vez de se colar todo. */
const ALTURA_TITULO = 26;
const ALTURA_SUBTITULO = 20;
const ALTURA_FAIXA = 22;
const ALTURA_IDENTIFICACAO = 20;
const ALTURA_CAMPO = 20;
const ALTURA_CABECALHO_DATAS = 16;
const ALTURA_SUBCABECALHO = 32;
const ALTURA_REQUISITO = 20;
const ALTURA_SEPARADOR = 8;

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

function aplicarFaixa(sheet: ExcelJS.Worksheet, linha: number, texto: string): void {
  sheet.mergeCells(linha, 1, linha, 8);
  const cell = sheet.getCell(linha, 1);
  cell.value = texto;
  cell.fill = fillSolido(COR_FAIXA);
  cell.font = { bold: true, color: { argb: COR_BRANCO }, size: 11 };
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  cell.protection = { locked: true };
  for (let c = 1; c <= 8; c++) sheet.getCell(linha, c).protection = { locked: true };
  sheet.getRow(linha).height = ALTURA_FAIXA;
}

function aplicarRotulo(cell: ExcelJS.Cell, texto: string): void {
  cell.value = texto;
  cell.fill = fillSolido(COR_ROTULO_BG);
  cell.font = { bold: true, size: 10, color: { argb: COR_ROTULO_TEXTO } };
  cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };
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

/**
 * Cabeçalho pequeno ("Mês"/"Ano") por cima de uma célula de data do projeto.
 *
 * Deliberadamente mais discreto do que o subcabeçalho dos requisitos: são dois
 * níveis diferentes da hierarquia e, com o mesmo azul forte nos dois, o bloco
 * ficava com duas faixas a competir pela mesma atenção.
 */
function aplicarCabecalhoData(cell: ExcelJS.Cell, texto: string): void {
  cell.value = texto;
  cell.fill = fillSolido(COR_ROTULO_BG);
  cell.font = { bold: true, size: 8, color: { argb: COR_ROTULO_TEXTO } };
  cell.alignment = { vertical: "middle", horizontal: "center" };
  cell.protection = { locked: true };
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

/** Endereço A1 de uma célula, para compor fórmulas de validação. */
function endereco(linha: number, coluna: number): string {
  return `${String.fromCharCode(64 + coluna)}${linha}`;
}

/**
 * Mês, com o teto do mês corrente.
 *
 * A fórmula usa TODAY() em vez de uma data fixa para o teto acompanhar o
 * momento do preenchimento — o formulário é distribuído uma vez e preenchido
 * ao longo de semanas. A validação do Excel é um guarda de conveniência: o
 * apuramento do Módulo 3 volta a impor a mesma regra, e é esse que decide.
 */
function validarMes(sheet: ExcelJS.Worksheet, linha: number, coluna: number, colunaAno: number): void {
  const cell = sheet.getCell(linha, coluna);
  const mes = endereco(linha, coluna);
  const ano = endereco(linha, colunaAno);
  cell.dataValidation = {
    type: "custom",
    allowBlank: true,
    formulae: [
      `AND(${mes}>=1,${mes}<=12,OR(${ano}="",${ano}<YEAR(TODAY()),${mes}<=MONTH(TODAY())))`,
    ],
    showErrorMessage: true,
    errorStyle: "error",
    errorTitle: "Mês inválido",
    error: "Indique um mês de 1 a 12. Nenhuma data pode ser posterior ao mês e ano atuais.",
  };
}

/** Ano, com o teto do ano corrente — ver `validarMes`. */
function validarAno(sheet: ExcelJS.Worksheet, linha: number, coluna: number): void {
  const cell = sheet.getCell(linha, coluna);
  const ref = endereco(linha, coluna);
  cell.dataValidation = {
    type: "custom",
    allowBlank: true,
    formulae: [`AND(${ref}>=${ANO_MINIMO},${ref}<=YEAR(TODAY()))`],
    showErrorMessage: true,
    errorStyle: "error",
    errorTitle: "Ano inválido",
    error: `Indique um ano entre ${ANO_MINIMO} e o ano atual. Nenhuma data pode ser posterior ao mês e ano atuais.`,
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

function construirFolhaLeiame(wb: ExcelJS.Workbook, folhas: Array<{ nome: string; perfil: string }>): void {
  const sheet = wb.addWorksheet(NOME_FOLHA_LEIAME);
  sheet.getColumn(1).width = 110;

  const umPerfil = folhas.length === 1;
  const indice = umPerfil
    ? [{ texto: folhas[0].perfil }]
    : [
        { texto: "Este ficheiro tem uma folha por perfil. Preencha apenas a folha do perfil a que se candidata:" },
        ...folhas.map((f) => ({ texto: `    • ${f.perfil}  →  folha "${f.nome}"` })),
      ];

  const linhas: Array<{ texto: string; titulo?: boolean }> = [
    { texto: "RESUMO CURRICULAR — INSTRUÇÕES DE PREENCHIMENTO", titulo: true },
    { texto: "" },
    ...indice,
    { texto: "" },
    {
      texto: umPerfil
        ? `1. Preencha primeiro os dados de identificação, no topo da folha "${folhas[0].nome}". Todos os campos são de preenchimento obrigatório.`
        : "1. Preencha primeiro os dados de identificação, no topo da folha do perfil a que se candidata. Todos os campos são de preenchimento obrigatório.",
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
        "4. Nenhuma data pode ser posterior ao mês e ano em que o formulário é preenchido: experiência ainda por acontecer não é considerada.",
    },
    {
      texto:
        "5. Não é permitido inserir nem eliminar linhas ou colunas. Utilize apenas os blocos disponibilizados no ficheiro.",
    },
    {
      texto:
        "6. Após concluir o preenchimento, assine digitalmente o documento e submeta o PDF resultante nos termos do procedimento.",
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

function construirFolhaExperiencia(
  wb: ExcelJS.Workbook,
  config: EspecificacaoFormulario,
  nomeFolha: string,
): void {
  const sheet = wb.addWorksheet(nomeFolha);
  COLUNAS.forEach((c, idx) => {
    sheet.getColumn(idx + 1).width = c.largura;
  });

  sheet.mergeCells(LINHA_TITULO, 1, LINHA_TITULO, 8);
  const tituloCell = sheet.getCell(LINHA_TITULO, 1);
  tituloCell.value = "RESUMO CURRICULAR";
  tituloCell.font = { bold: true, size: 14, color: { argb: COR_FAIXA } };
  tituloCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(LINHA_TITULO).height = ALTURA_TITULO;

  // O subtítulo é a designação do perfil, e é por ele que o Módulo 3 localiza
  // esta folha ao ler a declaração — ver `encontrarFolhaExperiencia`.
  sheet.mergeCells(LINHA_SUBTITULO, 1, LINHA_SUBTITULO, 8);
  const subtituloCell = sheet.getCell(LINHA_SUBTITULO, 1);
  subtituloCell.value = subtitulo(config);
  subtituloCell.font = { italic: true, size: 11, color: { argb: COR_ROTULO_TEXTO } };
  subtituloCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(LINHA_SUBTITULO).height = ALTURA_SUBTITULO;

  aplicarFaixa(sheet, LINHA_FAIXA_IDENTIFICACAO, "IDENTIFICAÇÃO DO CANDIDATO");

  for (const { linha, rotulo, campo: nomeCampo } of CAMPOS_IDENTIFICACAO) {
    aplicarRotulo(sheet.getCell(linha, 1), rotulo);
    sheet.mergeCells(linha, 2, linha, 8);
    const campo = sheet.getCell(linha, 2);

    if (nomeCampo === "perfil") {
      aplicarCampoBloqueado(campo, config.perfil);
    } else if (nomeCampo === "lote" && config.lote) {
      aplicarCampoBloqueado(campo, config.lote);
    } else if (nomeCampo === "loteDesignacao" && config.loteDesignacao) {
      aplicarCampoBloqueado(campo, config.loteDesignacao);
    } else {
      aplicarCampoEditavel(campo);
      validarTexto(campo);
    }
    sheet.getRow(linha).height = ALTURA_IDENTIFICACAO;
  }

  sheet.mergeCells(LINHA_DECLARACAO_VERACIDADE, 1, LINHA_DECLARACAO_VERACIDADE, 8);
  const declaracaoCell = sheet.getCell(LINHA_DECLARACAO_VERACIDADE, 1);
  declaracaoCell.value = TEXTO_DECLARACAO_VERACIDADE;
  declaracaoCell.fill = fillSolido(COR_NOTA_BG);
  declaracaoCell.alignment = { wrapText: true, vertical: "middle", indent: 1 };
  declaracaoCell.font = { italic: true, size: 9, color: { argb: COR_NOTA_TEXTO } };
  declaracaoCell.protection = { locked: true };
  sheet.getRow(LINHA_DECLARACAO_VERACIDADE).height = 32;

  aplicarRotulo(sheet.getCell(LINHA_ASSINATURA, 1), ROTULO_ASSINATURA);
  sheet.mergeCells(LINHA_ASSINATURA, 2, LINHA_ASSINATURA, 8);
  aplicarCampoEditavel(sheet.getCell(LINHA_ASSINATURA, 2));
  sheet.getRow(LINHA_ASSINATURA).height = ALTURA_CAMPO;

  sheet.getRow(LINHA_BRANCO_APOS_IDENTIFICACAO).height = ALTURA_SEPARADOR;

  const nRequisitos = config.requisitos.length;
  for (let i = 1; i <= config.nBlocos; i++) {
    const linhaInicial = linhaInicialBloco(i, nRequisitos);

    aplicarFaixa(sheet, linhaInicial, tituloFaixaBloco(i));

    const linhaClienteProjeto = linhaInicial + OFFSET_CLIENTE_PROJETO;
    sheet.getRow(linhaClienteProjeto).height = ALTURA_CAMPO;
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
    sheet.getRow(linhaFuncao).height = ALTURA_CAMPO;
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
    sheet.getRow(linhaCabecalhoDatas).height = ALTURA_CABECALHO_DATAS;

    const linhaDatas = linhaInicial + OFFSET_DATAS_PROJETO;
    aplicarRotulo(sheet.getCell(linhaDatas, 1), TEXTO_ROTULO_INICIO_PROJETO);
    aplicarCampoEditavel(sheet.getCell(linhaDatas, 2), "center");
    validarMes(sheet, linhaDatas, 2, 3);
    aplicarCampoEditavel(sheet.getCell(linhaDatas, 3), "center");
    validarAno(sheet, linhaDatas, 3);

    aplicarRotulo(sheet.getCell(linhaDatas, 4), TEXTO_ROTULO_FIM_PROJETO);
    aplicarCampoEditavel(sheet.getCell(linhaDatas, 5), "center");
    validarMes(sheet, linhaDatas, 5, 6);
    aplicarCampoEditavel(sheet.getCell(linhaDatas, 6), "center");
    validarAno(sheet, linhaDatas, 6);

    sheet.mergeCells(linhaDatas, 7, linhaDatas, 8);
    const disclaimerEmCurso = sheet.getCell(linhaDatas, 7);
    disclaimerEmCurso.value = TEXTO_DISCLAIMER_PROJETO_EM_CURSO;
    disclaimerEmCurso.fill = fillSolido(COR_NOTA_BG);
    disclaimerEmCurso.font = { italic: true, size: 8, color: { argb: COR_NOTA_TEXTO } };
    disclaimerEmCurso.alignment = { wrapText: true, vertical: "middle", indent: 1 };
    disclaimerEmCurso.protection = { locked: true };
    sheet.getRow(linhaDatas).height = 40;

    const linhaSub = linhaInicial + OFFSET_SUBCABECALHO;
    sheet.mergeCells(linhaSub, 1, linhaSub, 3);
    aplicarSubcabecalho(sheet.getCell(linhaSub, 1), TEXTO_SUBCABECALHO_REQUISITO);
    aplicarSubcabecalho(sheet.getCell(linhaSub, 4), TEXTO_SUBCABECALHO_DECLARA);
    aplicarSubcabecalho(sheet.getCell(linhaSub, 5), TEXTO_SUBCABECALHO_INICIO_MES);
    aplicarSubcabecalho(sheet.getCell(linhaSub, 6), TEXTO_SUBCABECALHO_INICIO_ANO);
    aplicarSubcabecalho(sheet.getCell(linhaSub, 7), TEXTO_SUBCABECALHO_FIM_MES);
    aplicarSubcabecalho(sheet.getCell(linhaSub, 8), TEXTO_SUBCABECALHO_FIM_ANO);
    sheet.getRow(linhaSub).height = ALTURA_SUBCABECALHO;

    config.requisitos.forEach((requisito, idxReq) => {
      const linhaReq = linhaInicial + OFFSET_PRIMEIRA_LINHA_REQUISITO + idxReq;
      sheet.getRow(linhaReq).height = ALTURA_REQUISITO;
      sheet.mergeCells(linhaReq, 1, linhaReq, 3);
      aplicarRotulo(sheet.getCell(linhaReq, 1), requisito.designacao);
      sheet.getCell(linhaReq, 1).alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };

      const declaraCell = sheet.getCell(linhaReq, 4);
      aplicarCampoEditavel(declaraCell, "center");
      validarDeclara(declaraCell);

      for (const [colMes, colAno] of [
        [5, 6],
        [7, 8],
      ] as const) {
        aplicarCampoEditavel(sheet.getCell(linhaReq, colMes), "center");
        validarMes(sheet, linhaReq, colMes, colAno);
        aplicarCampoEditavel(sheet.getCell(linhaReq, colAno), "center");
        validarAno(sheet, linhaReq, colAno);
      }
    });

    const linhaNota = linhaInicial + offsetNotaBloco(nRequisitos);
    sheet.mergeCells(linhaNota, 1, linhaNota, 8);
    const notaCell = sheet.getCell(linhaNota, 1);
    notaCell.value = TEXTO_NOTA_BLOCO;
    notaCell.fill = fillSolido(COR_NOTA_BG);
    notaCell.font = { italic: true, size: 9, color: { argb: COR_NOTA_TEXTO } };
    notaCell.alignment = { wrapText: true, vertical: "middle", indent: 1 };
    notaCell.protection = { locked: true };
    sheet.getRow(linhaNota).height = 34;

    sheet.getRow(linhaInicial + offsetBrancoBloco(nRequisitos)).height = ALTURA_SEPARADOR;
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

/**
 * Gera o workbook do formulário: "Leia-me", "Listas" (oculta) e uma folha por
 * perfil. Um ficheiro único, mesmo quando os perfis são vários — o candidato
 * recebe um só anexo e preenche a folha do perfil a que se candidata.
 */
export function gerarWorkbookDeclaracao(especificacoes: EspecificacaoFormulario[]): ExcelJS.Workbook {
  if (especificacoes.length === 0) {
    throw new Error("Não há perfis para gerar o formulário.");
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Propostas";
  wb.created = new Date();

  const usados = new Set<string>();
  const folhas = especificacoes.map((config) => ({
    config,
    nome: nomeFolhaPerfil(config.perfil, usados),
    perfil: config.perfil,
  }));

  construirFolhaLeiame(wb, folhas);
  construirFolhaListas(wb);
  for (const folha of folhas) construirFolhaExperiencia(wb, folha.config, folha.nome);

  return wb;
}

export async function gerarDeclaracaoExcelBlob(especificacoes: EspecificacaoFormulario[]): Promise<Blob> {
  const wb = gerarWorkbookDeclaracao(especificacoes);
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
