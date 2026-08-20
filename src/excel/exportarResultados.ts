// Exportação Excel dos resultados de avaliação — todos os lotes de uma vez.
// Usa SheetJS (xlsx): são folhas de dados tabulares, sem necessidade dos
// recursos (estilos, validação, proteção) que aqui obrigaram a exceljs.

import * as XLSX from "xlsx";
import type { LotesJSON } from "../core/types";
import type {
  ResultadoConcorrenteLote,
  ResultadoLote,
  ResultadoProcedimento,
} from "../core/avaliacaoProcedimento";
import { requisitosFalhados } from "../core/avaliacaoProcedimento";
import { anosDeMeses } from "../core/types";

type Linha = (string | number)[];

function sim(valor: boolean): string {
  return valor ? "Sim" : "Não";
}

/** Situação final do concorrente no lote, já com a limitação de um lote aplicada. */
function situacao(c: ResultadoConcorrenteLote): string {
  if (c.impedidoPeloLote !== null) return `Impedido — já ficou com o lote ${c.impedidoPeloLote}`;
  return c.cumpreRequisitos ? "Cumpre" : "Não cumpre";
}

function porLoteEConcorrente<T>(
  lotes: ResultadoLote[],
  fn: (lote: ResultadoLote, concorrente: ResultadoConcorrenteLote) => T[],
): T[] {
  return lotes.flatMap((lote) => lote.concorrentes.flatMap((c) => fn(lote, c)));
}

/** Uma linha por lote e concorrente: a leitura de topo do procedimento. */
function folhaResumo(resultado: ResultadoProcedimento): XLSX.WorkSheet {
  const cabecalho = [
    "Lote",
    "Designação do lote",
    "Concorrente",
    "Cumpre os requisitos",
    "Situação",
    "N.º de alertas",
  ];
  const linhas: Linha[] = porLoteEConcorrente(resultado.lotes, (lote, c) => [
    [lote.numero, lote.designacao, c.concorrente, sim(c.cumpreRequisitos), situacao(c), c.nAlertas],
  ]);
  return XLSX.utils.aoa_to_sheet([cabecalho, ...linhas]);
}

/** Todos os concorrentes do procedimento, por ordem alfabética e sem repetições. */
function concorrentesDoProcedimento(resultado: ResultadoProcedimento): string[] {
  const nomes = new Set<string>();
  for (const lote of resultado.lotes) for (const c of lote.concorrentes) nomes.add(c.concorrente);
  return [...nomes].sort((a, b) => a.localeCompare(b, "pt"));
}

/** Caracteres que o formato Excel não admite num nome de folha. */
const PROIBIDOS_EM_NOME_DE_FOLHA = /[:\\/?*[\]]/g;

/**
 * Nome de folha para um concorrente: sem caracteres proibidos e com 31
 * caracteres no máximo, que é o limite do formato. Dois nomes longos podem
 * ficar iguais depois do corte — daí o sufixo numérico.
 */
function nomeDeFolha(concorrente: string, jaUsados: Set<string>): string {
  const limpo = concorrente.replace(PROIBIDOS_EM_NOME_DE_FOLHA, " ").replace(/\s+/g, " ").trim();
  const base = limpo === "" ? "Concorrente" : limpo;

  let nome = base.slice(0, 31);
  for (let n = 2; jaUsados.has(nome); n++) {
    const sufixo = ` (${n})`;
    nome = base.slice(0, 31 - sufixo.length) + sufixo;
  }
  jaUsados.add(nome);
  return nome;
}

/**
 * Os perfis de um concorrente, em folha própria.
 *
 * Uma folha por concorrente, e não uma folha com todos: é assim que se imprime
 * ou se envia a apreciação de uma proposta sem levar atrás as das concorrentes.
 * O nome vai na primeira linha porque o nome da folha pode ter sido cortado.
 */
function folhaPerfisDoConcorrente(resultado: ResultadoProcedimento, concorrente: string): XLSX.WorkSheet {
  const cabecalho = [
    "Lote",
    "Designação do lote",
    "Perfil",
    "N.º de elementos",
    "N.º mínimo exigido",
    "N.º suficiente",
    "Todos os elementos cumprem",
    "Cumpre",
  ];

  const linhas: Linha[] = resultado.lotes.flatMap((lote) => {
    const c = lote.concorrentes.find((x) => x.concorrente === concorrente);
    if (c === undefined) return [];
    return c.perfis.map((p) => [
      lote.numero,
      lote.designacao,
      p.perfil,
      p.nElementos,
      p.nMinimoElementos,
      sim(p.nElementosSuficiente),
      sim(p.todosElementosCumprem),
      sim(p.cumpre),
    ]);
  });

  return XLSX.utils.aoa_to_sheet([["Concorrente", concorrente], [], cabecalho, ...linhas]);
}

function folhaElementos(resultado: ResultadoProcedimento): XLSX.WorkSheet {
  const cabecalho = ["Lote", "Concorrente", "Perfil", "Elemento", "Ficheiro", "Cumpre", "Requisitos falhados"];
  const linhas: Linha[] = porLoteEConcorrente(resultado.lotes, (lote, c) =>
    c.perfis.flatMap((p) =>
      p.elementos.map((e) => [
        lote.numero,
        c.concorrente,
        p.perfil,
        e.declaracao.identificacao.nome,
        e.declaracao.ficheiro,
        sim(e.apuramento.cumpre),
        requisitosFalhados(e.apuramento, p.requisitos).join("; "),
      ]),
    ),
  );
  return XLSX.utils.aoa_to_sheet([cabecalho, ...linhas]);
}

/** O desagregado: uma linha por requisito de cada elemento, com os meses apurados. */
function folhaRequisitos(resultado: ResultadoProcedimento): XLSX.WorkSheet {
  const cabecalho = [
    "Lote",
    "Concorrente",
    "Perfil",
    "Elemento",
    "Requisito",
    "Meses apurados",
    "Meses mínimos",
    "Anos mínimos",
    "Cumpre",
  ];
  const linhas: Linha[] = porLoteEConcorrente(resultado.lotes, (lote, c) =>
    c.perfis.flatMap((p) => {
      const porId = new Map(p.requisitos.map((r) => [r.id, r.designacao]));
      return p.elementos.flatMap((e) =>
        e.apuramento.requisitos.map((r) => [
          lote.numero,
          c.concorrente,
          p.perfil,
          e.declaracao.identificacao.nome,
          porId.get(r.requisitoId) ?? r.requisitoId,
          r.mesesApurados,
          r.mesesMinimos,
          anosDeMeses(r.mesesMinimos),
          sim(r.cumpre),
        ]),
      );
    }),
  );
  return XLSX.utils.aoa_to_sheet([cabecalho, ...linhas]);
}

function folhaAlertas(resultado: ResultadoProcedimento): XLSX.WorkSheet {
  const cabecalho = ["Lote", "Concorrente", "Perfil", "Elemento", "Tipo", "Alerta"];
  const linhas: Linha[] = porLoteEConcorrente(resultado.lotes, (lote, c) =>
    c.perfis.flatMap((p) =>
      p.elementos.flatMap((e) =>
        e.alertas.map((a) => [
          lote.numero,
          c.concorrente,
          p.perfil,
          e.declaracao.identificacao.nome,
          a.tipo,
          a.mensagem,
        ]),
      ),
    ),
  );
  return XLSX.utils.aoa_to_sheet([cabecalho, ...linhas]);
}

export function construirWorkbookResultados(
  resultado: ResultadoProcedimento,
  config: LotesJSON,
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const capa = XLSX.utils.aoa_to_sheet([
    ["Projeto", config.nomeProjeto],
    ["Procedimento", config.nomeProcedimento],
    ["Um lote por concorrente", sim(resultado.umLotePorConcorrente)],
    ["Lotes avaliados", resultado.lotes.length],
    [],
    ["Este relatório sinaliza o cumprimento dos requisitos mínimos. A decisão é do júri."],
  ]);

  XLSX.utils.book_append_sheet(wb, capa, "Procedimento");
  XLSX.utils.book_append_sheet(wb, folhaResumo(resultado), "Resumo por lote");
  XLSX.utils.book_append_sheet(wb, folhaElementos(resultado), "Elementos");
  XLSX.utils.book_append_sheet(wb, folhaRequisitos(resultado), "Requisitos");
  XLSX.utils.book_append_sheet(wb, folhaAlertas(resultado), "Alertas");

  const usados = new Set<string>();
  for (const concorrente of concorrentesDoProcedimento(resultado)) {
    XLSX.utils.book_append_sheet(
      wb,
      folhaPerfisDoConcorrente(resultado, concorrente),
      nomeDeFolha(concorrente, usados),
    );
  }

  return wb;
}

export function gerarResultadosBlob(resultado: ResultadoProcedimento, config: LotesJSON): Blob {
  const buffer = XLSX.write(construirWorkbookResultados(resultado, config), {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer;
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
