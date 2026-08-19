// Exportação da tabela de lotes/perfis para Excel — Módulo 2.
// Folha de dados tabulares, por isso SheetJS chega (ao contrário do formulário
// de declaração, que precisa de estilos, validação e proteção via exceljs).

import * as XLSX from "xlsx";
import type { LotesJSON } from "../core/types";
import { linhasTabelaValores, totalLote, totalProcedimento } from "../core/lotes";
import { gerarTextoCadernoEncargosLotes } from "../core/lotes";

function folhaTabela(config: LotesJSON): XLSX.WorkSheet {
  const cabecalho = [
    "Lote",
    "Designação do lote",
    "Perfil",
    "N.º mínimo de elementos",
    "Horas",
    "Preço unitário/hora (EUR)",
    "Preço base (EUR)",
  ];

  const linhas: (string | number)[][] = linhasTabelaValores(config).map((l) => [
    l.lote,
    l.loteDesignacao,
    l.perfil,
    l.nMinimoElementos,
    l.horas,
    l.valorHora,
    l.valor,
  ]);

  const subtotais: (string | number)[][] = config.lotes.map((lote) => [
    lote.numero,
    "",
    `Subtotal do lote ${lote.numero}`,
    "",
    "",
    "",
    totalLote(lote),
  ]);

  const total: (string | number)[] = ["", "", "Preço base total do procedimento", "", "", "", totalProcedimento(config)];

  return XLSX.utils.aoa_to_sheet([cabecalho, ...linhas, [], ...subtotais, [], total]);
}

function folhaRequisitos(config: LotesJSON): XLSX.WorkSheet {
  const cabecalho = ["Lote", "Perfil", "Requisito", "Meses mínimos"];
  const linhas: (string | number)[][] = [];

  for (const lote of config.lotes) {
    for (const entrada of lote.perfis) {
      for (const requisito of entrada.perfil.requisitos) {
        linhas.push([lote.numero, entrada.perfil.perfil, requisito.designacao, requisito.mesesMinimos]);
      }
    }
  }

  return XLSX.utils.aoa_to_sheet([cabecalho, ...linhas]);
}

function folhaCadernoEncargos(config: LotesJSON): XLSX.WorkSheet {
  const linhas = gerarTextoCadernoEncargosLotes(config)
    .split("\n")
    .map((linha) => [linha]);
  return XLSX.utils.aoa_to_sheet(linhas);
}

export function gerarWorkbookLotes(config: LotesJSON): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, folhaTabela(config), "Lotes e preço base");
  XLSX.utils.book_append_sheet(wb, folhaRequisitos(config), "Requisitos por perfil");
  XLSX.utils.book_append_sheet(wb, folhaCadernoEncargos(config), "Caderno de encargos");
  return wb;
}

export function gerarLotesBlob(config: LotesJSON): Blob {
  const buffer = XLSX.write(gerarWorkbookLotes(config), { bookType: "xlsx", type: "array" });
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
