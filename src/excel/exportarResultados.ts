// Exportação Excel dos resultados de avaliação — PLANO.md 7.3, cinco folhas.
// Usa SheetJS (xlsx): são folhas de dados tabulares, sem necessidade dos
// recursos (estilos, validação, proteção) que aqui obrigaram a exceljs.

import * as XLSX from "xlsx";
import type { ConfiguracaoAvaliacao, MesAno } from "../core/types";
import type { ResultadoConcorrente, ResultadoElemento } from "../core/agregacao";
import { requisitosFalhados } from "../core/agregacao";

function formatarMesAno(data: MesAno | null): string {
  if (data === null) return "";
  return `${String(data.mes).padStart(2, "0")}/${data.ano}`;
}

function formatarCumpre(cumpre: boolean): string {
  return cumpre ? "Cumpre" : "Não cumpre";
}

function folhaResumoConcorrentes(resultados: ResultadoConcorrente[]): XLSX.WorkSheet {
  const cabecalho = ["Concorrente", "N.º de elementos", "N.º mínimo suficiente?", "Cumpre", "N.º de alertas"];
  const linhas = resultados.map((r) => [
    r.concorrente,
    r.nElementos,
    r.nElementosSuficiente ? "Sim" : "Não",
    formatarCumpre(r.cumpre),
    r.nAlertas,
  ]);
  return XLSX.utils.aoa_to_sheet([cabecalho, ...linhas]);
}

function folhaResumoElementos(resultados: ResultadoConcorrente[], config: ConfiguracaoAvaliacao): XLSX.WorkSheet {
  const cabecalho = ["Elemento", "Ficheiro", "Concorrente", "Cumpre", "Requisitos falhados"];
  const linhas: (string | number)[][] = [];
  for (const concorrente of resultados) {
    for (const elemento of concorrente.elementos) {
      linhas.push([
        elemento.declaracao.identificacao.nome,
        elemento.declaracao.ficheiro,
        elemento.concorrente,
        formatarCumpre(elemento.apuramento.cumpre),
        requisitosFalhados(elemento.apuramento, config).join("; "),
      ]);
    }
  }
  return XLSX.utils.aoa_to_sheet([cabecalho, ...linhas]);
}

function folhaDetalhe(resultados: ResultadoConcorrente[], config: ConfiguracaoAvaliacao): XLSX.WorkSheet {
  const cabecalho = ["Elemento", "Concorrente", "Requisito", "Meses apurados", "Meses mínimos", "Cumpre"];
  const designacaoPorId = new Map(config.requisitos.map((r) => [r.id, r.designacao]));
  const linhas: (string | number)[][] = [];

  for (const concorrente of resultados) {
    for (const elemento of concorrente.elementos) {
      for (const req of elemento.apuramento.requisitos) {
        linhas.push([
          elemento.declaracao.identificacao.nome,
          elemento.concorrente,
          designacaoPorId.get(req.requisitoId) ?? req.requisitoId,
          req.mesesApurados,
          req.mesesMinimos,
          formatarCumpre(req.cumpre),
        ]);
      }
    }
  }
  return XLSX.utils.aoa_to_sheet([cabecalho, ...linhas]);
}

function folhaTracoApuramento(resultados: ResultadoConcorrente[], config: ConfiguracaoAvaliacao): XLSX.WorkSheet {
  const cabecalho = [
    "Elemento",
    "Concorrente",
    "Requisito",
    "Bloco",
    "Situação",
    "Origem",
    "Início",
    "Fim",
    "Motivo (se descartado)",
  ];
  const designacaoPorId = new Map(config.requisitos.map((r) => [r.id, r.designacao]));
  const linhas: (string | number)[][] = [];

  for (const concorrente of resultados) {
    for (const elemento of concorrente.elementos) {
      for (const req of elemento.apuramento.requisitos) {
        const requisitoNome = designacaoPorId.get(req.requisitoId) ?? req.requisitoId;

        for (const periodo of req.periodosAdmitidos) {
          linhas.push([
            elemento.declaracao.identificacao.nome,
            elemento.concorrente,
            requisitoNome,
            periodo.blocoIndice,
            "Considerado",
            periodo.origem === "linha" ? "Datas próprias da linha" : "Herdado do projeto",
            formatarMesAno(periodo.inicio),
            formatarMesAno(periodo.fim),
            "",
          ]);
        }

        for (const descarte of req.periodosDescartados) {
          linhas.push([
            elemento.declaracao.identificacao.nome,
            elemento.concorrente,
            requisitoNome,
            descarte.blocoIndice,
            "Desconsiderado",
            "",
            "",
            "",
            descarte.motivo,
          ]);
        }
      }
    }
  }
  return XLSX.utils.aoa_to_sheet([cabecalho, ...linhas]);
}

function folhaAlertas(resultados: ResultadoConcorrente[]): XLSX.WorkSheet {
  const cabecalho = ["Ficheiro", "Concorrente", "Tipo de alerta", "Mensagem", "Bloco", "Requisito"];
  const linhas: (string | number)[][] = [];

  const elementos: ResultadoElemento[] = resultados.flatMap((r) => r.elementos);
  for (const elemento of elementos) {
    for (const alerta of elemento.alertas) {
      linhas.push([
        elemento.declaracao.ficheiro,
        elemento.concorrente,
        alerta.tipo,
        alerta.mensagem,
        alerta.blocoIndice ?? "",
        alerta.requisitoId ?? "",
      ]);
    }
  }
  return XLSX.utils.aoa_to_sheet([cabecalho, ...linhas]);
}

/** Gera o workbook de resultados com as 5 folhas descritas em 7.3. */
export function gerarWorkbookResultados(
  resultados: ResultadoConcorrente[],
  config: ConfiguracaoAvaliacao,
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, folhaResumoConcorrentes(resultados), "Resumo por concorrente");
  XLSX.utils.book_append_sheet(wb, folhaResumoElementos(resultados, config), "Resumo por elemento");
  XLSX.utils.book_append_sheet(wb, folhaDetalhe(resultados, config), "Detalhe elemento x requisito");
  XLSX.utils.book_append_sheet(wb, folhaTracoApuramento(resultados, config), "Traço de apuramento");
  XLSX.utils.book_append_sheet(wb, folhaAlertas(resultados), "Alertas");
  return wb;
}

export function gerarResultadosBlob(resultados: ResultadoConcorrente[], config: ConfiguracaoAvaliacao): Blob {
  const wb = gerarWorkbookResultados(resultados, config);
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
