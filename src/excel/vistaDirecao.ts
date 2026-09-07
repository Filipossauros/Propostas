// A vista geral da direção, em Excel.
//
// Três folhas, como os três quadros do ecrã: o resumo por unidade, o detalhe
// por projeto e as rates praticadas por perfil. Leva o que estiver filtrado no
// ecrã — quem descarrega está a levar o que está a ver.
//
// Como na folha da unidade, sem células unidas nas linhas de dados: uma folha
// destas acaba sempre em tabela dinâmica, e a unidade repete-se em cada linha
// para que a coluna se possa agrupar e filtrar.

import ExcelJS from "exceljs";
import {
  externosDaUnidade,
  externosDoProjeto,
  internosDaUnidade,
  internosDoProjeto,
  pessoasDaUnidade,
  pessoasDoProjeto,
  valorDaEntradaNoAno,
  type OrcamentoUnidade,
  type ProjetoVistaGeral,
} from "../core/vistaGeral";
import {
  anosDaDirecao,
  externosDaDirecao,
  internosDaDirecao,
  nomeDaUnidade,
  percentagemNaDirecao,
  percentagemNaSuaUnidade,
  pessoasDaDirecao,
  ratesPorPerfil,
  totaisPorAnoDaDirecao,
  totaisPorAnoDaDirecaoSemIva,
  type VistaDirecao,
} from "../core/vistaGeralDirecao";
import {
  cabecalho,
  escreverLinha,
  faixa,
  faixaDeTotais,
  moeda,
  MOEDA,
  nota,
  PERCENTAGEM,
  texto,
  type Celula,
} from "./folhaDeVista";
import { prepararImpressao } from "./impressao";

export function gerarWorkbookVistaDirecao(vista: VistaDirecao): ExcelJS.Workbook {
  const livro = new ExcelJS.Workbook();
  livro.creator = "Propostas";
  livro.created = new Date();
  const direcao = vista.direcao.trim();
  livro.title = direcao === "" ? "Vista geral da direção" : `Vista geral da direção — ${direcao}`;

  const anos = anosDaDirecao(vista);
  folhaDoResumo(livro, vista);
  folhaDoDetalhe(livro, vista, anos);
  folhaDasRates(livro, vista, anos);

  return livro;
}

/**
 * O resumo: uma unidade por linha, e por baixo dela os seus projetos.
 *
 * Os projetos vêm recuados na coluna da unidade, e não numa coluna própria: é
 * a mesma leitura do ecrã — abrir uma unidade para ver de que é feita — e
 * poupa uma coluna que ficaria vazia em metade das linhas.
 */
function folhaDoResumo(livro: ExcelJS.Workbook, vista: VistaDirecao): void {
  const folha = livro.addWorksheet("Resumo por unidade", { views: [{ showGridLines: false }] });
  const titulos = ["Unidade / Projeto", "Elementos externos", "Elementos internos", "Total", "% na direção"];
  folha.columns = [{ width: 46 }, { width: 20 }, { width: 20 }, { width: 12 }, { width: 15 }];

  let linha = 1;
  faixa(folha, linha++, titulos.length, livro.title ?? "Resumo por unidade");
  nota(
    folha,
    linha++,
    titulos.length,
    "Os elementos externos são os exigidos aos concorrentes nos perfis; os internos são as pessoas da casa " +
      "afetas aos projetos, registadas na Vista Geral de cada unidade. O peso é calculado sobre o total de " +
      "elementos da direção, e não tem em consideração o valor de cada unidade, uma vez que apenas são " +
      "contabilizados custos de FSE. Nas linhas de projeto, a percentagem é a fatia da sua unidade.",
  );
  linha++;

  const linhaCabecalho = linha;
  cabecalho(folha, linha++, titulos);

  let banda = false;
  for (const unidade of vista.unidades) {
    escreverLinha(
      folha,
      linha++,
      [
        texto(nomeDaUnidade(unidade)),
        { valor: externosDaUnidade(unidade) },
        { valor: internosDaUnidade(unidade) },
        { valor: pessoasDaUnidade(unidade) },
        { valor: percentagemNaDirecao(vista, unidade), formato: PERCENTAGEM },
      ],
      banda,
    );

    for (const projeto of unidade.projetos) {
      escreverLinha(
        folha,
        linha++,
        [
          texto(`    ${projeto.nome}`, true),
          { valor: externosDoProjeto(projeto) },
          { valor: internosDoProjeto(projeto) },
          { valor: pessoasDoProjeto(projeto) },
          { valor: percentagemNaSuaUnidade(unidade, projeto), formato: PERCENTAGEM },
        ],
        banda,
      );
    }
    // Alterna por unidade: o que se procura de relance é onde acaba uma
    // unidade e começa a seguinte.
    banda = !banda;
  }

  const pessoas = pessoasDaDirecao(vista);
  faixaDeTotais(folha, linha, titulos.length, [
    { coluna: 1, valor: "Total da direção" },
    { coluna: 2, valor: externosDaDirecao(vista) },
    { coluna: 3, valor: internosDaDirecao(vista) },
    { coluna: 4, valor: pessoas },
    { coluna: 5, valor: pessoas === 0 ? 0 : 100, formato: PERCENTAGEM },
  ]);

  folha.views = [{ state: "frozen", ySplit: linhaCabecalho, showGridLines: false }];
  prepararImpressao(folha, { repetirAte: linhaCabecalho });
}

/** O detalhe: uma linha por perfil e por elemento interno, com a unidade ao lado. */
function folhaDoDetalhe(livro: ExcelJS.Workbook, vista: VistaDirecao, anos: number[]): void {
  const folha = livro.addWorksheet("Projetos e valores", { views: [{ showGridLines: false }] });
  const titulos = [
    "Unidade",
    "Projeto",
    "Lotes",
    "Perfil",
    "Pessoas",
    "Rate (€/h) c/ IVA",
    ...anos.map((ano) => `Total € c/ IVA\n(11 meses)\n${ano}`),
  ];
  folha.columns = [
    { width: 30 },
    { width: 30 },
    { width: 8 },
    { width: 36 },
    { width: 9 },
    { width: 16 },
    ...anos.map(() => ({ width: 18 })),
  ];

  let linha = 1;
  faixa(folha, linha++, titulos.length, livro.title ?? "Projetos e valores");
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
  for (const unidade of vista.unidades) {
    for (const projeto of unidade.projetos) {
      for (const celulas of linhasDoProjeto(unidade, projeto, anos)) {
        escreverLinha(folha, linha++, celulas, banda);
      }
    }
    banda = !banda;
  }

  const primeiraLinha = linhaCabecalho + 1;
  const ultimaLinha = linha - 1;

  const totais: Array<{ rotulo: string; valores: number[] }> = [
    { rotulo: "Total da direção (c/ IVA)", valores: totaisPorAnoDaDirecao(vista, anos) },
    { rotulo: "Total da direção (s/ IVA)", valores: totaisPorAnoDaDirecaoSemIva(vista, anos) },
  ];
  totais.forEach((t, i) => {
    // O rótulo ocupa as colunas que não somam nada, até à das rates.
    folha.mergeCells(linha + i, 1, linha + i, 6);
    faixaDeTotais(folha, linha + i, titulos.length, [
      { coluna: 1, valor: t.rotulo },
      ...t.valores.map((total, j) => ({ coluna: 7 + j, valor: total, formato: MOEDA })),
    ]);
  });

  folha.views = [{ state: "frozen", ySplit: linhaCabecalho, xSplit: 2, showGridLines: false }];
  prepararImpressao(folha, { repetirAte: linhaCabecalho });
  if (ultimaLinha >= primeiraLinha) {
    folha.autoFilter = {
      from: { row: linhaCabecalho, column: 1 },
      to: { row: ultimaLinha, column: titulos.length },
    };
  }
}

function linhasDoProjeto(unidade: OrcamentoUnidade, projeto: ProjetoVistaGeral, anos: number[]): Celula[][] {
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

  // A unidade e o projeto repetem-se em cada linha: ver a nota do topo.
  return doMeio.map((meio) => [texto(nomeDaUnidade(unidade)), texto(projeto.nome), ...meio]);
}

/** As rates: um perfil por linha, e por baixo cada contratação que o praticou. */
function folhaDasRates(livro: ExcelJS.Workbook, vista: VistaDirecao, anos: number[]): void {
  const folha = livro.addWorksheet("Perfis e rates", { views: [{ showGridLines: false }] });
  const titulos = [
    "Perfil",
    "Unidade",
    "Projeto",
    "Lote",
    "Pessoas",
    "Rate (€/h) s/ IVA",
    "Rate (€/h) c/ IVA",
  ];
  folha.columns = [
    { width: 36 },
    { width: 30 },
    { width: 30 },
    { width: 8 },
    { width: 9 },
    { width: 17 },
    { width: 17 },
  ];

  let linha = 1;
  faixa(folha, linha++, titulos.length, livro.title ?? "Perfis e rates");
  nota(
    folha,
    linha++,
    titulos.length,
    "As rates a que cada perfil foi contratado em toda a direção. A linha do perfil traz a rate média, " +
      "ponderada pelas pessoas; as linhas seguintes trazem cada contratação, com a rate que nela foi praticada.",
  );
  linha++;

  const linhaCabecalho = linha;
  cabecalho(folha, linha++, titulos);

  let banda = false;
  for (const perfil of ratesPorPerfil(vista, anos)) {
    escreverLinha(
      folha,
      linha++,
      [
        texto(perfil.perfil),
        texto(`${perfil.usos.length} contratação(ões) em ${perfil.unidades} unidade(s)`, true),
        { valor: null },
        { valor: null },
        { valor: perfil.pessoas },
        { valor: perfil.mediaSemIva, formato: MOEDA },
        { valor: perfil.mediaComIva, formato: MOEDA },
      ],
      banda,
    );

    for (const uso of perfil.usos) {
      escreverLinha(
        folha,
        linha++,
        [
          texto(`    ${perfil.perfil}`, true),
          texto(uso.unidade),
          texto(uso.projeto),
          { valor: uso.lote },
          { valor: uso.pessoas },
          { valor: uso.valorHoraSemIva, formato: MOEDA },
          { valor: uso.valorHoraComIva, formato: MOEDA },
        ],
        banda,
      );
    }
    banda = !banda;
  }

  folha.views = [{ state: "frozen", ySplit: linhaCabecalho, showGridLines: false }];
  prepararImpressao(folha, { repetirAte: linhaCabecalho });
}

export async function gerarVistaDirecaoBlob(vista: VistaDirecao): Promise<Blob> {
  const dados = await gerarWorkbookVistaDirecao(vista).xlsx.writeBuffer();
  return new Blob([dados], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
