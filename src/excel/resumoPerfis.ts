// Resumo dos perfis definidos no Módulo 1, em Excel.
//
// Não é o formulário que os concorrentes preenchem — esse sai do Módulo 2, já
// com os lotes. É o registo de quem prepara o procedimento: uma folha por
// perfil, com o que ficou escrito nele, para conferir e para arquivar.
//
// Daí não ter campos amarelos: aqui não há nada a preencher. O amarelo continua
// reservado ao formulário, que é onde alguém escreve.

import ExcelJS from "exceljs";
import type { PerfilJSON } from "../core/types";
import { ROTULO_CERTIFICACAO, ROTULO_CERTIFICACOES, anosDeMeses } from "../core/types";
import { certificacoesDoPerfil, conteudoFuncionalDoPerfil } from "../core/perfil";
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

const LETRA = "Calibri";

/** Nome de folha admissível: 31 caracteres e sem os que o Excel recusa. */
function nomeDeFolha(designacao: string, indice: number, usados: Set<string>): string {
  const limpo = designacao.replace(/[[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim();
  const base = (limpo === "" ? `Perfil ${indice}` : limpo).slice(0, 31);

  let nome = base;
  let n = 2;
  while (usados.has(nome.toLowerCase())) {
    const sufixo = ` (${n++})`;
    nome = base.slice(0, 31 - sufixo.length) + sufixo;
  }
  usados.add(nome.toLowerCase());
  return nome;
}

function faixa(folha: ExcelJS.Worksheet, linha: number, texto: string): void {
  folha.mergeCells(linha, 1, linha, 3);
  const celula = folha.getCell(linha, 1);
  celula.value = texto;
  celula.font = { name: LETRA, size: 13, bold: true, color: { argb: COR_BRANCO } };
  celula.fill = fillSolido(COR_FAIXA);
  celula.alignment = { vertical: "middle", indent: 1 };
  folha.getRow(linha).height = 26;
}

function subcabecalho(folha: ExcelJS.Worksheet, linha: number, texto: string): void {
  folha.mergeCells(linha, 1, linha, 3);
  const celula = folha.getCell(linha, 1);
  celula.value = texto;
  celula.font = { name: LETRA, size: 11, bold: true, color: { argb: COR_BRANCO } };
  celula.fill = fillSolido(COR_SUBCABECALHO);
  celula.alignment = { vertical: "middle", indent: 1 };
  folha.getRow(linha).height = 20;
}

/** Tabela de uma coluna só: a célula ocupa a largura toda, sem colunas vazias ao lado. */
function cabecalhoLargo(folha: ExcelJS.Worksheet, linha: number, titulo: string): void {
  folha.mergeCells(linha, 1, linha, 3);
  const celula = folha.getCell(linha, 1);
  celula.value = titulo;
  celula.font = { name: LETRA, size: 10, bold: true, color: { argb: COR_ROTULO_TEXTO } };
  celula.fill = fillSolido(COR_ROTULO_BG);
  celula.border = contorno(COR_GRELHA);
  celula.alignment = { vertical: "middle", indent: 1 };
  folha.getRow(linha).height = 22;
}

function linhaLarga(folha: ExcelJS.Worksheet, linha: number, texto: string, par: boolean): void {
  folha.mergeCells(linha, 1, linha, 3);
  const celula = folha.getCell(linha, 1);
  celula.value = texto;
  celula.font = { name: LETRA, size: 10 };
  celula.border = contorno(COR_GRELHA);
  celula.alignment = { vertical: "top", wrapText: true, indent: 1 };
  if (par) celula.fill = fillSolido(COR_LINHA_ALTERNADA);
}

function cabecalhoDeTabela(folha: ExcelJS.Worksheet, linha: number, titulos: string[]): void {
  titulos.forEach((titulo, i) => {
    const celula = folha.getCell(linha, i + 1);
    celula.value = titulo;
    celula.font = { name: LETRA, size: 10, bold: true, color: { argb: COR_ROTULO_TEXTO } };
    celula.fill = fillSolido(COR_ROTULO_BG);
    celula.border = contorno(COR_GRELHA);
    celula.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center", wrapText: true, indent: 1 };
  });
  folha.getRow(linha).height = 22;
}

/** Uma linha de tabela, com a primeira coluna em texto e as restantes centradas. */
function linhaDeTabela(folha: ExcelJS.Worksheet, linha: number, valores: Array<string | number>, par: boolean): void {
  valores.forEach((valor, i) => {
    const celula = folha.getCell(linha, i + 1);
    celula.value = valor;
    celula.font = { name: LETRA, size: 10 };
    celula.border = contorno(COR_GRELHA);
    celula.alignment = { vertical: "top", horizontal: i === 0 ? "left" : "center", wrapText: true, indent: 1 };
    if (par) celula.fill = fillSolido(COR_LINHA_ALTERNADA);
  });
}

function nota(folha: ExcelJS.Worksheet, linha: number, texto: string): void {
  folha.mergeCells(linha, 1, linha, 3);
  const celula = folha.getCell(linha, 1);
  celula.value = texto;
  celula.font = { name: LETRA, size: 9, italic: true, color: { argb: COR_NOTA_TEXTO } };
  celula.alignment = { vertical: "middle", wrapText: true, indent: 1 };
  folha.getRow(linha).height = 18;
}

function folhaDoPerfil(livro: ExcelJS.Workbook, perfil: PerfilJSON, nome: string): void {
  const folha = livro.addWorksheet(nome, {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  folha.columns = [{ width: 78 }, { width: 14 }, { width: 14 }];

  let linha = 1;
  faixa(folha, linha++, perfil.perfil || "(perfil sem designação)");
  linha++;

  subcabecalho(folha, linha++, "Requisitos mínimos de experiência profissional");
  cabecalhoDeTabela(folha, linha++, ["Requisito", "Anos", "Meses"]);
  if (perfil.requisitos.length === 0) {
    linhaLarga(folha, linha++, "(sem requisitos definidos)", false);
  } else {
    perfil.requisitos.forEach((requisito, i) => {
      linhaDeTabela(
        folha,
        linha++,
        [requisito.designacao, anosDeMeses(requisito.mesesMinimos), requisito.mesesMinimos],
        i % 2 === 1,
      );
    });
  }
  linha++;

  const certificacoes = certificacoesDoPerfil(perfil);
  subcabecalho(folha, linha++, `${ROTULO_CERTIFICACOES} exigidas`);
  if (certificacoes.length === 0) {
    nota(folha, linha++, "Este perfil não exige formação nem certificação.");
  } else {
    cabecalhoLargo(folha, linha++, ROTULO_CERTIFICACAO);
    certificacoes.forEach((certificacao, i) => {
      linhaLarga(folha, linha++, certificacao, i % 2 === 1);
    });
    nota(folha, linha++, "Verificadas fora desta ferramenta, contra as peças da proposta.");
  }
  linha++;

  subcabecalho(folha, linha++, "Conteúdo funcional");
  cabecalhoLargo(folha, linha++, "Atividade");
  conteudoFuncionalDoPerfil(perfil).forEach((atividade, i) => {
    linhaLarga(folha, linha++, atividade, i % 2 === 1);
  });

  // A faixa fica visível ao rolar: com muitos requisitos, perde-se de vista de
  // que perfil é a folha.
  folha.views = [{ state: "frozen", ySplit: 1, showGridLines: false }];
}

export function gerarWorkbookResumoPerfis(perfis: PerfilJSON[], nomeProjeto: string): ExcelJS.Workbook {
  const livro = new ExcelJS.Workbook();
  livro.creator = "Propostas";
  livro.created = new Date();
  if (nomeProjeto.trim() !== "") livro.title = `Perfis — ${nomeProjeto.trim()}`;

  const usados = new Set<string>();
  perfis.forEach((perfil, i) => folhaDoPerfil(livro, perfil, nomeDeFolha(perfil.perfil, i + 1, usados)));
  return livro;
}

export async function gerarResumoPerfisBlob(perfis: PerfilJSON[], nomeProjeto: string): Promise<Blob> {
  const dados = await gerarWorkbookResumoPerfis(perfis, nomeProjeto).xlsx.writeBuffer();
  return new Blob([dados], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
