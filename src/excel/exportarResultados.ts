// Relatório Excel dos resultados de avaliação — todos os lotes de uma vez.
//
// Usa exceljs, e não SheetJS, pela mesma razão que o formulário: é preciso
// formatar. Um relatório que sai do júri para outras mãos tem de se ler sem
// ninguém ter de alargar colunas ou adivinhar onde acaba um lote — e partilha
// com o formulário o mesmo vocabulário visual, que vive em `estilo.ts`.

import ExcelJS from "exceljs";
import type { LotesJSON, MesAno } from "../core/types";
import type {
  ResultadoConcorrenteLote,
  ResultadoLote,
  ResultadoProcedimento,
} from "../core/avaliacaoProcedimento";
import { requisitosFalhados } from "../core/avaliacaoProcedimento";
import type { Ordenacao } from "../core/ordenacao";
import { REGRA_UM_LOTE } from "../core/ordenacao";
import { anosDeMeses } from "../core/types";
import {
  COR_AVISO_BG,
  COR_AVISO_TEXTO,
  COR_BRANCO,
  COR_CAMPO_BLOQUEADO_BG,
  COR_CAMPO_BLOQUEADO_TEXTO,
  COR_CUMPRE_BG,
  COR_CUMPRE_TEXTO,
  COR_FAIXA,
  COR_FALHA_BG,
  COR_FALHA_TEXTO,
  COR_GRELHA,
  COR_LINHA_ALTERNADA,
  COR_NOTA_BG,
  COR_NOTA_TEXTO,
  COR_ROTULO_BG,
  COR_ROTULO_TEXTO,
  COR_SUBCABECALHO,
  contorno,
  fillSolido,
} from "./estilo";

// --------------------------------------------------------------------------
// Construção de folhas tabulares
// --------------------------------------------------------------------------

type Valor = string | number;

/** Como uma célula se destaca. Só o resultado se pinta; o resto é texto. */
type Realce = "cumpre" | "falha" | "aviso";

interface Celula {
  valor: Valor;
  realce?: Realce;
}

type Linha = (Valor | Celula)[];

function cel(valor: Valor, realce?: Realce): Celula {
  return { valor, realce };
}

/** "Sim"/"Não" com o realce que lhes corresponde — é o que o olho procura. */
function sim(valor: boolean): Celula {
  return cel(valor ? "Sim" : "Não", valor ? "cumpre" : "falha");
}

interface Coluna {
  titulo: string;
  largura: number;
  /** Números e contagens alinham à direita; o resto fica à esquerda. */
  numerico?: boolean;
  /** Colunas de texto longo (mensagens, listas de requisitos) quebram linha. */
  quebra?: boolean;
}

const REALCES: Record<Realce, { fundo: string; texto: string }> = {
  cumpre: { fundo: COR_CUMPRE_BG, texto: COR_CUMPRE_TEXTO },
  falha: { fundo: COR_FALHA_BG, texto: COR_FALHA_TEXTO },
  aviso: { fundo: COR_AVISO_BG, texto: COR_AVISO_TEXTO },
};

const LINHA_TITULO = 1;
const LINHA_SUBTITULO = 2;
const LINHA_CABECALHO = 4;

function normalizar(entrada: Valor | Celula): Celula {
  return typeof entrada === "object" ? entrada : { valor: entrada };
}

/**
 * Uma folha de dados: título, subtítulo, cabeçalho fixo e corpo em zebra.
 *
 * O cabeçalho fica congelado e com filtro: um relatório de avaliação lê-se a
 * procurar ("mostra-me quem não cumpre"), e não de fio a pavio.
 */
function adicionarFolhaTabela(
  wb: ExcelJS.Workbook,
  opcoes: { nome: string; titulo: string; subtitulo: string; colunas: Coluna[]; linhas: Linha[]; vazio?: string },
): ExcelJS.Worksheet {
  const { nome, titulo, subtitulo, colunas, linhas } = opcoes;
  const sheet = wb.addWorksheet(nome);
  const nColunas = colunas.length;

  colunas.forEach((c, idx) => {
    sheet.getColumn(idx + 1).width = c.largura;
  });

  sheet.mergeCells(LINHA_TITULO, 1, LINHA_TITULO, nColunas);
  const celulaTitulo = sheet.getCell(LINHA_TITULO, 1);
  celulaTitulo.value = titulo.toUpperCase();
  celulaTitulo.font = { bold: true, size: 13, color: { argb: COR_FAIXA } };
  celulaTitulo.alignment = { horizontal: "left", vertical: "middle" };
  sheet.getRow(LINHA_TITULO).height = 24;

  sheet.mergeCells(LINHA_SUBTITULO, 1, LINHA_SUBTITULO, nColunas);
  const celulaSubtitulo = sheet.getCell(LINHA_SUBTITULO, 1);
  celulaSubtitulo.value = subtitulo;
  celulaSubtitulo.font = { italic: true, size: 10, color: { argb: COR_ROTULO_TEXTO } };
  celulaSubtitulo.alignment = { horizontal: "left", vertical: "middle" };
  sheet.getRow(LINHA_SUBTITULO).height = 18;

  const cabecalho = sheet.getRow(LINHA_CABECALHO);
  colunas.forEach((coluna, idx) => {
    const cell = cabecalho.getCell(idx + 1);
    cell.value = coluna.titulo;
    cell.fill = fillSolido(COR_SUBCABECALHO);
    cell.font = { bold: true, size: 10, color: { argb: COR_BRANCO } };
    cell.alignment = {
      horizontal: coluna.numerico ? "right" : "left",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = contorno(COR_BRANCO);
  });
  cabecalho.height = 28;

  linhas.forEach((linha, idxLinha) => {
    const row = sheet.getRow(LINHA_CABECALHO + 1 + idxLinha);
    const alternada = idxLinha % 2 === 1;

    colunas.forEach((coluna, idxColuna) => {
      const { valor, realce } = normalizar(linha[idxColuna] ?? "");
      const cell = row.getCell(idxColuna + 1);
      cell.value = valor;
      cell.font = realce
        ? { size: 10, bold: true, color: { argb: REALCES[realce].texto } }
        : { size: 10, color: { argb: COR_CAMPO_BLOQUEADO_TEXTO } };
      cell.fill = fillSolido(
        realce ? REALCES[realce].fundo : alternada ? COR_LINHA_ALTERNADA : COR_BRANCO,
      );
      cell.alignment = {
        horizontal: coluna.numerico ? "right" : "left",
        vertical: "middle",
        wrapText: coluna.quebra === true,
      };
      cell.border = contorno(COR_GRELHA);
    });
  });

  if (linhas.length === 0) {
    sheet.mergeCells(LINHA_CABECALHO + 1, 1, LINHA_CABECALHO + 1, nColunas);
    const cell = sheet.getCell(LINHA_CABECALHO + 1, 1);
    cell.value = opcoes.vazio ?? "Sem registos.";
    cell.fill = fillSolido(COR_NOTA_BG);
    cell.font = { italic: true, size: 10, color: { argb: COR_NOTA_TEXTO } };
    cell.alignment = { horizontal: "left", vertical: "middle" };
    cell.border = contorno(COR_GRELHA);
  }

  sheet.views = [{ state: "frozen", ySplit: LINHA_CABECALHO }];
  sheet.autoFilter = {
    from: { row: LINHA_CABECALHO, column: 1 },
    to: { row: LINHA_CABECALHO + Math.max(linhas.length, 1), column: nColunas },
  };

  return sheet;
}

// --------------------------------------------------------------------------
// Conteúdo das folhas
// --------------------------------------------------------------------------

function formatarMesAno(data: MesAno | null): string {
  return data === null ? "" : `${String(data.mes).padStart(2, "0")}/${data.ano}`;
}

/** Situação do concorrente no lote: admitido ou não, e nada mais. */
function situacao(c: ResultadoConcorrenteLote): Celula {
  return c.admitido ? cel("Admitido", "cumpre") : cel("Não admitido", "falha");
}

/**
 * Impedimento potencial: os outros lotes em que o mesmo concorrente também é
 * admitido. Não é uma exclusão — qual dos lotes lhe fica decide-se pelo preço.
 */
function potencialImpedimento(c: ResultadoConcorrenteLote): Celula {
  if (c.potencialImpedimento.length === 0) return cel("");
  const lotes = c.potencialImpedimento.join(", ");
  return cel(
    `Também admitido ${c.potencialImpedimento.length === 1 ? `no lote ${lotes}` : `nos lotes ${lotes}`}: ` +
      `só pode ficar com um`,
    "aviso",
  );
}

function porLoteEConcorrente<T>(
  lotes: ResultadoLote[],
  fn: (lote: ResultadoLote, concorrente: ResultadoConcorrenteLote) => T[],
): T[] {
  return lotes.flatMap((lote) => lote.concorrentes.flatMap((c) => fn(lote, c)));
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

/** A capa: o que este relatório é e sobre que procedimento incide. */
function construirCapa(wb: ExcelJS.Workbook, resultado: ResultadoProcedimento, config: LotesJSON): void {
  const sheet = wb.addWorksheet("Procedimento");
  sheet.getColumn(1).width = 34;
  sheet.getColumn(2).width = 62;

  sheet.mergeCells(1, 1, 1, 2);
  const titulo = sheet.getCell(1, 1);
  titulo.value = "RELATÓRIO DE AVALIAÇÃO DA EXPERIÊNCIA PROFISSIONAL";
  titulo.font = { bold: true, size: 14, color: { argb: COR_FAIXA } };
  titulo.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 26;

  const campos: Array<[string, string | number]> = [
    ["Projeto", config.nomeProjeto],
    ["Procedimento", config.nomeProcedimento],
    ["Lotes avaliados", resultado.lotes.length],
    ["Concorrentes", concorrentesDoProcedimento(resultado).length],
    ["Um lote por concorrente", resultado.umLotePorConcorrente ? "Sim" : "Não"],
    ["Declarações por atribuir", resultado.naoAtribuidas.length],
  ];

  campos.forEach(([rotulo, valor], idx) => {
    const linha = 3 + idx;
    const celulaRotulo = sheet.getCell(linha, 1);
    celulaRotulo.value = rotulo;
    celulaRotulo.fill = fillSolido(COR_ROTULO_BG);
    celulaRotulo.font = { bold: true, size: 10, color: { argb: COR_ROTULO_TEXTO } };
    celulaRotulo.alignment = { horizontal: "left", vertical: "middle" };
    celulaRotulo.border = contorno(COR_GRELHA);

    const celulaValor = sheet.getCell(linha, 2);
    celulaValor.value = valor;
    celulaValor.fill = fillSolido(COR_CAMPO_BLOQUEADO_BG);
    celulaValor.font = { size: 10, color: { argb: COR_CAMPO_BLOQUEADO_TEXTO } };
    celulaValor.alignment = { horizontal: "left", vertical: "middle" };
    celulaValor.border = contorno(COR_GRELHA);
    sheet.getRow(linha).height = 20;
  });

  const linhaNota = 3 + campos.length + 1;
  sheet.mergeCells(linhaNota, 1, linhaNota, 2);
  const nota = sheet.getCell(linhaNota, 1);
  nota.value =
    "Este relatório sinaliza o cumprimento dos requisitos mínimos de experiência, e nada mais. " +
    "A adjudicação decide-se pelo preço, que não consta do formulário de declaração: por isso um concorrente " +
    "admitido em mais do que um lote é aqui assinalado como impedimento potencial, e não como impedido. " +
    "As certificações eventualmente exigidas também não são apuradas: verificam-se nas peças da proposta.";
  nota.fill = fillSolido(COR_NOTA_BG);
  nota.font = { italic: true, size: 9, color: { argb: COR_NOTA_TEXTO } };
  nota.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  nota.border = contorno(COR_GRELHA);
  sheet.getRow(linhaNota).height = 66;
}

function adicionarResumo(wb: ExcelJS.Workbook, resultado: ResultadoProcedimento, subtitulo: string): void {
  adicionarFolhaTabela(wb, {
    nome: "Resumo por lote",
    titulo: "Resumo por lote e concorrente",
    subtitulo,
    colunas: [
      { titulo: "Lote", largura: 8, numerico: true },
      { titulo: "Designação do lote", largura: 30 },
      { titulo: "Concorrente", largura: 32 },
      { titulo: "Cumpre os requisitos", largura: 20 },
      { titulo: "Situação", largura: 16 },
      { titulo: "Impedimento potencial", largura: 40, quebra: true },
      { titulo: "N.º de alertas", largura: 14, numerico: true },
    ],
    linhas: porLoteEConcorrente(resultado.lotes, (lote, c) => [
      [
        lote.numero,
        lote.designacao,
        c.concorrente,
        sim(c.cumpreRequisitos),
        situacao(c),
        potencialImpedimento(c),
        c.nAlertas,
      ],
    ]),
    vazio: "Nenhum concorrente se apresentou a qualquer lote.",
  });
}

/**
 * Os perfis de um concorrente, em folha própria.
 *
 * Uma folha por concorrente, e não uma folha com todos: é assim que se imprime
 * ou se envia a apreciação de uma proposta sem levar atrás as das concorrentes.
 */
function adicionarFolhaDoConcorrente(
  wb: ExcelJS.Workbook,
  resultado: ResultadoProcedimento,
  concorrente: string,
  nome: string,
): void {
  adicionarFolhaTabela(wb, {
    nome,
    titulo: "Apreciação por perfil",
    subtitulo: concorrente,
    colunas: [
      { titulo: "Lote", largura: 8, numerico: true },
      { titulo: "Designação do lote", largura: 28 },
      { titulo: "Perfil", largura: 34 },
      { titulo: "N.º de elementos", largura: 15, numerico: true },
      { titulo: "N.º mínimo exigido", largura: 15, numerico: true },
      { titulo: "N.º suficiente", largura: 13 },
      { titulo: "Todos os elementos cumprem", largura: 20 },
      { titulo: "Cumpre", largura: 11 },
    ],
    linhas: resultado.lotes.flatMap((lote) => {
      const c = lote.concorrentes.find((x) => x.concorrente === concorrente);
      if (c === undefined) return [];
      return c.perfis.map((p): Linha => [
        lote.numero,
        lote.designacao,
        p.perfil,
        p.nElementos,
        p.nMinimoElementos,
        sim(p.nElementosSuficiente),
        sim(p.todosElementosCumprem),
        sim(p.cumpre),
      ]);
    }),
    vazio: "Este concorrente não se apresentou a nenhum lote.",
  });
}

function adicionarElementos(wb: ExcelJS.Workbook, resultado: ResultadoProcedimento, subtitulo: string): void {
  adicionarFolhaTabela(wb, {
    nome: "Elementos",
    titulo: "Elementos propostos",
    subtitulo,
    colunas: [
      { titulo: "Lote", largura: 8, numerico: true },
      { titulo: "Concorrente", largura: 30 },
      { titulo: "Perfil", largura: 32 },
      { titulo: "Elemento", largura: 30 },
      { titulo: "Ficheiro", largura: 30 },
      { titulo: "Cumpre", largura: 11 },
      { titulo: "Requisitos falhados", largura: 44, quebra: true },
    ],
    linhas: porLoteEConcorrente(resultado.lotes, (lote, c) =>
      c.perfis.flatMap((p) =>
        p.elementos.map((e): Linha => [
          lote.numero,
          c.concorrente,
          p.perfil,
          e.declaracao.identificacao.nome,
          e.declaracao.ficheiro,
          sim(e.apuramento.cumpre),
          requisitosFalhados(e.apuramento, p.requisitos).join("; "),
        ]),
      ),
    ),
    vazio: "Nenhum elemento foi apresentado.",
  });
}

/** O desagregado: uma linha por requisito de cada elemento, com os meses apurados. */
function adicionarRequisitos(wb: ExcelJS.Workbook, resultado: ResultadoProcedimento, subtitulo: string): void {
  adicionarFolhaTabela(wb, {
    nome: "Requisitos",
    titulo: "Apuramento requisito a requisito",
    subtitulo,
    colunas: [
      { titulo: "Lote", largura: 8, numerico: true },
      { titulo: "Concorrente", largura: 28 },
      { titulo: "Perfil", largura: 30 },
      { titulo: "Elemento", largura: 28 },
      { titulo: "Requisito", largura: 40, quebra: true },
      { titulo: "Meses apurados", largura: 14, numerico: true },
      { titulo: "Meses mínimos", largura: 14, numerico: true },
      { titulo: "Anos mínimos", largura: 13, numerico: true },
      { titulo: "Cumpre", largura: 11 },
    ],
    linhas: porLoteEConcorrente(resultado.lotes, (lote, c) =>
      c.perfis.flatMap((p) => {
        const porId = new Map(p.requisitos.map((r) => [r.id, r.designacao]));
        return p.elementos.flatMap((e) =>
          e.apuramento.requisitos.map((r): Linha => [
            lote.numero,
            c.concorrente,
            p.perfil,
            e.declaracao.identificacao.nome,
            porId.get(r.requisitoId) ?? r.requisitoId,
            cel(r.mesesApurados, r.cumpre ? "cumpre" : "falha"),
            r.mesesMinimos,
            anosDeMeses(r.mesesMinimos),
            sim(r.cumpre),
          ]),
        );
      }),
    ),
    vazio: "Nenhum requisito foi apurado.",
  });
}

function adicionarAlertas(wb: ExcelJS.Workbook, resultado: ResultadoProcedimento, subtitulo: string): void {
  adicionarFolhaTabela(wb, {
    nome: "Alertas",
    titulo: "Alertas de leitura e de coerência",
    subtitulo,
    colunas: [
      { titulo: "Lote", largura: 8, numerico: true },
      { titulo: "Concorrente", largura: 28 },
      { titulo: "Perfil", largura: 28 },
      { titulo: "Elemento", largura: 28 },
      { titulo: "Tipo", largura: 24 },
      { titulo: "Alerta", largura: 70, quebra: true },
    ],
    linhas: porLoteEConcorrente(resultado.lotes, (lote, c) =>
      c.perfis.flatMap((p) =>
        p.elementos.flatMap((e) =>
          e.alertas.map((a): Linha => [
            lote.numero,
            c.concorrente,
            p.perfil,
            e.declaracao.identificacao.nome,
            a.tipo,
            cel(a.mensagem, "aviso"),
          ]),
        ),
      ),
    ),
    vazio: "Nenhum alerta. Todas as declarações foram lidas sem reservas.",
  });
}

/**
 * Traço do apuramento: os períodos que entraram e os que foram descartados.
 * É o que permite a um terceiro reconstituir a contagem à mão.
 */
function adicionarTraco(wb: ExcelJS.Workbook, resultado: ResultadoProcedimento, subtitulo: string): void {
  adicionarFolhaTabela(wb, {
    nome: "Traço de apuramento",
    titulo: "Traço do apuramento, período a período",
    subtitulo: `${subtitulo} · permite reconstituir a contagem à mão`,
    colunas: [
      { titulo: "Lote", largura: 8, numerico: true },
      { titulo: "Concorrente", largura: 26 },
      { titulo: "Perfil", largura: 26 },
      { titulo: "Elemento", largura: 26 },
      { titulo: "Requisito", largura: 34, quebra: true },
      { titulo: "Bloco", largura: 8, numerico: true },
      { titulo: "Situação", largura: 13 },
      { titulo: "Início", largura: 11, numerico: true },
      { titulo: "Fim", largura: 11, numerico: true },
      { titulo: "Origem / motivo", largura: 40, quebra: true },
    ],
    linhas: porLoteEConcorrente(resultado.lotes, (lote, c) =>
      c.perfis.flatMap((p) => {
        const porId = new Map(p.requisitos.map((r) => [r.id, r.designacao]));
        return p.elementos.flatMap((e) =>
          e.apuramento.requisitos.flatMap((r) => {
            const designacao = porId.get(r.requisitoId) ?? r.requisitoId;
            const nome = e.declaracao.identificacao.nome;
            return [
              ...r.periodosAdmitidos.map((periodo): Linha => [
                lote.numero,
                c.concorrente,
                p.perfil,
                nome,
                designacao,
                periodo.blocoIndice,
                cel("Admitido", "cumpre"),
                formatarMesAno(periodo.inicio),
                formatarMesAno(periodo.fim),
                periodo.origem === "linha" ? "Datas da linha" : "Período do projeto",
              ]),
              ...r.periodosDescartados.map((descarte): Linha => [
                lote.numero,
                c.concorrente,
                p.perfil,
                nome,
                designacao,
                descarte.blocoIndice,
                cel("Descartado", "falha"),
                "",
                "",
                cel(descarte.motivo, "aviso"),
              ]),
            ];
          }),
        );
      }),
    ),
    vazio: "Nenhum período foi apurado.",
  });
}

// --------------------------------------------------------------------------
// Ordenação das propostas — Módulo 4
// --------------------------------------------------------------------------

function preco(valor: number | null): Valor {
  return valor === null ? "" : valor;
}

function situacaoDaProposta(p: Ordenacao["lotes"][number]["propostas"][number]): Celula {
  if (p.impedidaPeloLote !== null) return cel(`Impedida — venceu o lote ${p.impedidaPeloLote}`, "aviso");
  if (p.preco === null) return cel("Sem preço indicado", "aviso");
  return p.vencedora ? cel("Vencedora", "cumpre") : cel("Ordenada");
}

/** A ordenação inteira: todas as propostas admitidas, por lote e por preço. */
function adicionarOrdenacao(wb: ExcelJS.Workbook, ordenacao: Ordenacao, subtitulo: string): void {
  const sheet = adicionarFolhaTabela(wb, {
    nome: "Ordenação por lote",
    titulo: "Ordenação das propostas pelo preço",
    subtitulo: ordenacao.umLotePorConcorrente ? `${subtitulo} · um lote por concorrente` : subtitulo,
    colunas: [
      { titulo: "Lote", largura: 8, numerico: true },
      { titulo: "Designação do lote", largura: 30 },
      { titulo: "Posição", largura: 10, numerico: true },
      { titulo: "Concorrente", largura: 34 },
      { titulo: "Preço proposto (s/ IVA)", largura: 20, numerico: true },
      { titulo: "Situação", largura: 34, quebra: true },
      { titulo: "Empate no preço", largura: 15 },
    ],
    linhas: ordenacao.lotes.flatMap((lote) =>
      lote.propostas.map((p): Linha => [
        lote.numero,
        lote.designacao,
        p.posicao ?? "",
        p.concorrente,
        preco(p.preco),
        situacaoDaProposta(p),
        p.empatada ? cel("Sim", "aviso") : "Não",
      ]),
    ),
    vazio: "Nenhuma proposta admitida a ordenar.",
  });

  formatarComoMoeda(sheet, 5, ordenacao.lotes.reduce((soma, l) => soma + l.propostas.length, 0));

  if (ordenacao.umLotePorConcorrente) adicionarNotaDaRegra(sheet, 7);
}

/** Só os vencedores: a leitura que a decisão do procedimento precisa. */
function adicionarVencedores(wb: ExcelJS.Workbook, ordenacao: Ordenacao, subtitulo: string): void {
  const vencedores = ordenacao.lotes.flatMap((lote) => {
    const vencedora = lote.propostas.find((p) => p.vencedora);
    return [
      [
        lote.numero,
        lote.designacao,
        vencedora?.concorrente ?? cel("Sem proposta vencedora", "falha"),
        preco(vencedora?.preco ?? null),
        vencedora?.empatada === true ? cel("Sim", "aviso") : "Não",
      ] as Linha,
    ];
  });

  const sheet = adicionarFolhaTabela(wb, {
    nome: "Vencedores",
    titulo: "Proposta vencedora de cada lote",
    subtitulo,
    colunas: [
      { titulo: "Lote", largura: 8, numerico: true },
      { titulo: "Designação do lote", largura: 34 },
      { titulo: "Concorrente", largura: 36 },
      { titulo: "Preço proposto (s/ IVA)", largura: 20, numerico: true },
      { titulo: "Empate no preço", largura: 15 },
    ],
    linhas: vencedores,
    vazio: "Nenhum lote tem proposta vencedora.",
  });

  formatarComoMoeda(sheet, 4, vencedores.length);

  if (ordenacao.umLotePorConcorrente) adicionarNotaDaRegra(sheet, 5);
}

/** Euros com duas casas, para os preços se lerem como preços. */
function formatarComoMoeda(sheet: ExcelJS.Worksheet, coluna: number, nLinhas: number): void {
  for (let i = 0; i < nLinhas; i++) {
    sheet.getCell(LINHA_CABECALHO + 1 + i, coluna).numFmt = '#,##0.00 "€"';
  }
}

/**
 * A regra sai por extenso na folha, e não só na aplicação: quem receber o
 * ficheiro tem de perceber por que razão o preço mais baixo de um lote pode
 * não ser o vencedor.
 */
function adicionarNotaDaRegra(sheet: ExcelJS.Worksheet, nColunas: number): void {
  const linha = sheet.rowCount + 2;
  sheet.mergeCells(linha, 1, linha, nColunas);
  const cell = sheet.getCell(linha, 1);
  cell.value = REGRA_UM_LOTE;
  cell.fill = fillSolido(COR_NOTA_BG);
  cell.font = { italic: true, size: 9, color: { argb: COR_NOTA_TEXTO } };
  cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  cell.border = contorno(COR_GRELHA);
  sheet.getRow(linha).height = 40;
}

// --------------------------------------------------------------------------
// Livro
// --------------------------------------------------------------------------

export function construirWorkbookResultados(
  resultado: ResultadoProcedimento,
  config: LotesJSON,
  /** Quando presente, o relatório leva também a ordenação das propostas (Módulo 4). */
  ordenacao?: Ordenacao,
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Propostas";
  wb.created = new Date();

  const subtitulo = [config.nomeProjeto, config.nomeProcedimento].filter((t) => t.trim() !== "").join(" · ");

  construirCapa(wb, resultado, config);
  adicionarResumo(wb, resultado, subtitulo);
  adicionarElementos(wb, resultado, subtitulo);
  adicionarRequisitos(wb, resultado, subtitulo);
  adicionarAlertas(wb, resultado, subtitulo);
  adicionarTraco(wb, resultado, subtitulo);

  // A ordenação vem logo a seguir ao resumo, e antes do detalhe: é a leitura
  // que a decisão do procedimento precisa.
  if (ordenacao !== undefined) {
    adicionarOrdenacao(wb, ordenacao, subtitulo);
    adicionarVencedores(wb, ordenacao, subtitulo);
  }

  const usados = new Set<string>();
  for (const concorrente of concorrentesDoProcedimento(resultado)) {
    adicionarFolhaDoConcorrente(wb, resultado, concorrente, nomeDeFolha(concorrente, usados));
  }

  return wb;
}

export async function gerarResultadosBlob(
  resultado: ResultadoProcedimento,
  config: LotesJSON,
  ordenacao?: Ordenacao,
): Promise<Blob> {
  const buffer = await construirWorkbookResultados(resultado, config, ordenacao).xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
