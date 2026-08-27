// A vista geral da unidade, em Excel.
//
// Duas folhas, como os dois quadros do ecrã: o resumo geral, que se lê de
// relance, e o detalhe por projeto, que se filtra e cruza. Mesmo vocabulário
// visual dos outros ficheiros gerados: faixa azul no topo, cabeçalho claro,
// bandas alternadas. Sem campos amarelos — aqui não há nada a preencher.
//
// Sem células unidas, ao contrário do ecrã: uma folha destas acaba sempre a ser
// filtrada e cruzada em tabela dinâmica, e células unidas partem as duas coisas.
// O nome do projeto e os seus totais repetem-se em cada linha, e são as bandas
// alternadas — uma por projeto — que dizem onde acaba um e começa o seguinte.

import ExcelJS from "exceljs";
import {
  anosDoOrcamento,
  externosDaUnidade,
  externosDoProjeto,
  internosDaUnidade,
  internosDoProjeto,
  percentagemNaUnidade,
  pessoasDaUnidade,
  pessoasDoProjeto,
  totaisPorAnoDaUnidade,
  totaisPorAnoDaUnidadeSemIva,
  valorDaEntradaNoAno,
  type OrcamentoUnidade,
  type ProjetoVistaGeral,
} from "../core/vistaGeral";
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
const MOEDA = '#,##0.00\\ "€"';
const PERCENTAGEM = '0.0\\ "%"';

/** Uma célula da folha, já reduzida a valor — a folha não recalcula nada. */
interface Celula {
  valor: string | number | null;
  formato?: string;
  esquerda?: boolean;
  italico?: boolean;
}

function texto(valor: string, italico = false): Celula {
  return { valor, esquerda: true, italico };
}

function moeda(valor: number | null): Celula {
  return { valor, formato: MOEDA };
}

/**
 * As linhas de um projeto: um perfil de cada vez, e depois quem é da casa.
 *
 * Um projeto a que se tenham apagado os perfis todos continua a dar uma linha:
 * as pessoas internas e a fatia da unidade que ocupa não deixam de existir por
 * o contrato ter saído da vista.
 */
function linhasDoProjeto(projeto: ProjetoVistaGeral, anos: number[]): Celula[][] {
  const doMeio: Celula[][] = [
    ...projeto.entradas.map((entrada) => [
      { valor: entrada.lote },
      texto(entrada.perfil),
      { valor: entrada.pessoas },
      moeda(entrada.valorHoraComIva),
      ...anos.map((ano) => moeda(valorDaEntradaNoAno(projeto, entrada, ano))),
    ]),
    ...projeto.internos.map((interno) => [
      { valor: null },
      texto(`${interno.nome} (interno)`, true),
      { valor: 1 },
      moeda(null),
      ...anos.map(() => moeda(null)),
    ]),
  ];

  const linhas =
    doMeio.length > 0
      ? doMeio
      : [
          [
            { valor: null },
            texto("(sem perfis nem elementos internos)", true),
            { valor: null },
            moeda(null),
            ...anos.map(() => moeda(null)),
          ],
        ];

  // O nome do projeto repete-se em cada linha: ver a nota do topo sobre filtros.
  return linhas.map((meio) => [texto(projeto.nome), ...meio]);
}

export function gerarWorkbookVistaGeral(orcamento: OrcamentoUnidade): ExcelJS.Workbook {
  const livro = new ExcelJS.Workbook();
  livro.creator = "Propostas";
  livro.created = new Date();
  const unidade = orcamento.unidade.trim();
  livro.title = unidade === "" ? "Vista geral" : `Vista geral — ${unidade}`;

  folhaDoResumo(livro, orcamento);

  const anos = anosDoOrcamento(orcamento);
  const folha = livro.addWorksheet("Detalhe por projeto", {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const titulos = [
    "Projeto",
    "Lotes",
    "Perfil",
    "Pessoas",
    "Rate (€/h) c/ IVA",
    ...anos.map((ano) => `Total € c/ IVA\n(11 meses)\n${ano}`),
  ];
  folha.columns = [
    { width: 30 },
    { width: 8 },
    { width: 36 },
    { width: 9 },
    { width: 16 },
    ...anos.map(() => ({ width: 18 })),
  ];

  let linha = 1;
  faixa(folha, linha++, titulos.length, livro.title);
  nota(
    folha,
    linha++,
    titulos.length,
    "Uma linha por perfil e por elemento interno. Cada elemento interno conta uma pessoa, ao lado dos " +
      "elementos exigidos em cada perfil. Valores com IVA incluído.",
  );
  linha++;

  const linhaCabecalho = linha;
  cabecalho(folha, linha++, titulos);

  let banda = false;
  for (const projeto of orcamento.projetos) {
    for (const celulas of linhasDoProjeto(projeto, anos)) {
      escreverLinha(folha, linha++, celulas, banda);
    }
    // Alterna por projeto, e não por linha: o que se procura distinguir de
    // relance é onde acaba um projeto e começa o seguinte.
    banda = !banda;
  }

  const primeiraLinha = linhaCabecalho + 1;
  const ultimaLinha = linha - 1;
  totais(folha, linha++, orcamento, titulos.length);

  // O cabeçalho e a coluna do projeto ficam à vista ao rolar: com uma dezena de
  // projetos, sem eles não se sabe que ano é cada coluna nem de quem é a linha.
  folha.views = [{ state: "frozen", ySplit: linhaCabecalho, xSplit: 1, showGridLines: false }];
  if (ultimaLinha >= primeiraLinha) {
    folha.autoFilter = {
      from: { row: linhaCabecalho, column: 1 },
      to: { row: ultimaLinha, column: titulos.length },
    };
  }
  return livro;
}

/**
 * A folha do resumo: um projeto por linha, e só o que se compara entre eles.
 *
 * Vem primeiro no livro porque é a que responde à pergunta de quem o abre —
 * onde está a equipa. O detalhe fica na folha seguinte, para quem quiser ver
 * de que é feita cada linha.
 */
function folhaDoResumo(livro: ExcelJS.Workbook, orcamento: OrcamentoUnidade): void {
  const folha = livro.addWorksheet("Resumo geral", {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const titulos = ["Projeto", "Elementos externos", "Elementos internos", "Total", "% na unidade"];
  folha.columns = [{ width: 40 }, { width: 20 }, { width: 20 }, { width: 12 }, { width: 15 }];

  let linha = 1;
  faixa(folha, linha++, titulos.length, livro.title ?? "Resumo geral");
  nota(
    folha,
    linha++,
    titulos.length,
    "Os elementos externos são os exigidos aos concorrentes nos perfis; os internos são as pessoas da unidade " +
      "afetas ao projeto. O peso na unidade é calculado tendo por base o total de elementos (internos e externos) " +
      "por projeto, e não tem em consideração o valor por projeto, uma vez que apenas são contabilizados custos " +
      "de FSE.",
  );
  linha++;

  const linhaCabecalho = linha;
  cabecalho(folha, linha++, titulos);

  orcamento.projetos.forEach((projeto, i) => {
    escreverLinha(
      folha,
      linha++,
      [
        texto(projeto.nome),
        { valor: externosDoProjeto(projeto) },
        { valor: internosDoProjeto(projeto) },
        { valor: pessoasDoProjeto(projeto) },
        { valor: percentagemNaUnidade(orcamento, projeto), formato: PERCENTAGEM },
      ],
      i % 2 === 1,
    );
  });

  const pessoas = pessoasDaUnidade(orcamento);
  faixaDeTotais(folha, linha, titulos.length, [
    { coluna: 1, valor: "Total da unidade" },
    { coluna: 2, valor: externosDaUnidade(orcamento) },
    { coluna: 3, valor: internosDaUnidade(orcamento) },
    { coluna: 4, valor: pessoas },
    { coluna: 5, valor: pessoas === 0 ? 0 : 100, formato: PERCENTAGEM },
  ]);

  folha.views = [{ state: "frozen", ySplit: linhaCabecalho, showGridLines: false }];
}

function faixa(folha: ExcelJS.Worksheet, linha: number, nColunas: number, valor: string): void {
  folha.mergeCells(linha, 1, linha, nColunas);
  const celula = folha.getCell(linha, 1);
  celula.value = valor;
  celula.font = { name: LETRA, size: 14, bold: true, color: { argb: COR_BRANCO } };
  celula.fill = fillSolido(COR_FAIXA);
  celula.alignment = { vertical: "middle", indent: 1 };
  folha.getRow(linha).height = 28;
}

function nota(folha: ExcelJS.Worksheet, linha: number, nColunas: number, valor: string): void {
  folha.mergeCells(linha, 1, linha, nColunas);
  const celula = folha.getCell(linha, 1);
  celula.value = valor;
  celula.font = { name: LETRA, size: 9, italic: true, color: { argb: COR_NOTA_TEXTO } };
  celula.alignment = { vertical: "middle", wrapText: true, indent: 1 };
  folha.getRow(linha).height = 26;
}

function cabecalho(folha: ExcelJS.Worksheet, linha: number, titulos: string[]): void {
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

function escreverLinha(folha: ExcelJS.Worksheet, linha: number, celulas: Celula[], banda: boolean): void {
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

/**
 * O total da unidade, em duas linhas: com IVA e sem IVA.
 *
 * A tabela toda se exprime com IVA, que é o que se compara entre projetos. O
 * valor sem IVA é o que instrui o processo, e aparece só aqui — em cada linha
 * dobrava a altura da folha para responder a uma pergunta que só se faz no fim.
 */
function totais(folha: ExcelJS.Worksheet, linha: number, orcamento: OrcamentoUnidade, nColunas: number): void {
  const linhas: Array<{ rotulo: string; valores: number[] }> = [
    { rotulo: "Total da unidade (c/ IVA)", valores: totaisPorAnoDaUnidade(orcamento) },
    { rotulo: "Total da unidade (s/ IVA)", valores: totaisPorAnoDaUnidadeSemIva(orcamento) },
  ];

  linhas.forEach((l, i) => {
    // O rótulo ocupa as colunas do projeto e do perfil, que não somam nada.
    folha.mergeCells(linha + i, 1, linha + i, 5);
    faixaDeTotais(folha, linha + i, nColunas, [
      { coluna: 1, valor: l.rotulo },
      ...l.valores.map((total, j) => ({ coluna: 6 + j, valor: total, formato: MOEDA })),
    ]);
  });
}

interface ValorDeTotal {
  coluna: number;
  valor: string | number;
  formato?: string;
}

function faixaDeTotais(folha: ExcelJS.Worksheet, linha: number, nColunas: number, valores: ValorDeTotal[]): void {
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

export async function gerarVistaGeralBlob(orcamento: OrcamentoUnidade): Promise<Blob> {
  const dados = await gerarWorkbookVistaGeral(orcamento).xlsx.writeBuffer();
  return new Blob([dados], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
