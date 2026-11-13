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
  ehLinhaDeLicenca,
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
import { aplicarCenario, type Cenario } from "../core/cenarios";
import { prepararImpressao } from "./impressao";
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
      // Uma licença não tem pessoas nem rate: só o valor de cada ano.
      ehLinhaDeLicenca(entrada)
        ? texto(`${entrada.perfil} (licença${entrada.quantidadePorExtenso ? ` · ${entrada.quantidadePorExtenso}` : ""})`)
        : texto(entrada.perfil),
      { valor: ehLinhaDeLicenca(entrada) ? null : entrada.pessoas },
      moeda(ehLinhaDeLicenca(entrada) ? null : entrada.valorHoraComIva),
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
  folhaDoDetalhe(
    livro,
    orcamento,
    "Detalhe por projeto",
    livro.title,
    "Uma linha por perfil e por elemento interno. Cada elemento interno conta uma pessoa, ao lado dos " +
      "elementos exigidos em cada perfil. Valores com IVA incluído.",
  );

  // Os cenários de corte vêm a seguir ao orçamento: primeiro a comparação, que
  // responde à pergunta de quem os fez, e depois o detalhe de cada um.
  if (orcamento.cenarios.length > 0) {
    folhaDaComparacao(livro, orcamento);
    const usados = new Set(livro.worksheets.map((f) => f.name));
    orcamento.cenarios.forEach((cenario, i) => {
      const nome = nomeDaFolhaDoCenario(cenario, i, usados);
      usados.add(nome);
      folhaDoDetalhe(
        livro,
        aplicarCenario(orcamento, cenario),
        nome,
        `Cenário «${cenario.nome}»${livro.title ? ` — ${livro.title}` : ""}`,
        "Cenário de corte: as pessoas que ficam em cada linha e o valor correspondente (valor por pessoa × " +
          "pessoas que ficam). Os elementos internos aparecem no projeto em que ficam no cenário. Valores com " +
          "IVA incluído.",
      );
    });
  }
  return livro;
}

/** O Excel não aceita nas folhas nomes com mais de 31 carateres nem `[]:*?/\`. */
function nomeDaFolhaDoCenario(cenario: Cenario, i: number, usados: Set<string>): string {
  const limpo = cenario.nome.replace(/[[\]:*?/\\]/g, " ").trim();
  const base = `Cenário ${i + 1}${limpo ? ` — ${limpo}` : ""}`.slice(0, 31).trim();
  let nome = base;
  for (let n = 2; usados.has(nome); n++) nome = `${base.slice(0, 27)} (${n})`;
  return nome;
}

/** Uma linha por leitura — o orçamento e cada cenário —, com as pessoas e o valor de cada ano. */
function folhaDaComparacao(livro: ExcelJS.Workbook, orcamento: OrcamentoUnidade): void {
  const anos = anosDoOrcamento(orcamento);
  const folha = livro.addWorksheet("Comparação", { views: [{ showGridLines: false }] });
  const titulos = [
    "Leitura",
    "Elementos externos",
    "Elementos internos",
    "Total de pessoas",
    ...anos.map((ano) => `Total € c/ IVA\n${ano}`),
    "Total € s/ IVA",
    "Diferença € s/ IVA",
    "Diferença %",
  ];
  folha.columns = [
    { width: 34 },
    { width: 14 },
    { width: 14 },
    { width: 12 },
    ...anos.map(() => ({ width: 18 })),
    { width: 18 },
    { width: 18 },
    { width: 13 },
  ];

  let linha = 1;
  faixa(folha, linha++, titulos.length, `Comparação de cenários${livro.title ? ` — ${livro.title}` : ""}`);
  nota(
    folha,
    linha++,
    titulos.length,
    "O orçamento e cada cenário de corte lado a lado. A diferença é a do cenário em relação ao orçamento, sem IVA.",
  );
  linha++;
  const linhaCabecalho = linha;
  cabecalho(folha, linha++, titulos);

  const soma = (v: number[]) => v.reduce((a, b) => a + b, 0);
  const semIvaDoOrcamento = soma(totaisPorAnoDaUnidadeSemIva(orcamento));
  const leituras: Array<{ nome: string; orcamento: OrcamentoUnidade }> = [
    { nome: "Orçamento", orcamento },
    ...orcamento.cenarios.map((c) => ({ nome: `Cenário: ${c.nome}`, orcamento: aplicarCenario(orcamento, c) })),
  ];

  leituras.forEach((l, i) => {
    const semIva = soma(totaisPorAnoDaUnidadeSemIva(l.orcamento));
    const dif = semIva - semIvaDoOrcamento;
    escreverLinha(
      folha,
      linha++,
      [
        texto(l.nome),
        { valor: externosDaUnidade(l.orcamento) },
        { valor: internosDaUnidade(l.orcamento) },
        { valor: pessoasDaUnidade(l.orcamento) },
        ...totaisPorAnoDaUnidade(l.orcamento).map((v) => moeda(v)),
        moeda(semIva),
        moeda(i === 0 ? null : dif),
        i === 0 || semIvaDoOrcamento === 0
          ? { valor: null }
          : { valor: (dif / semIvaDoOrcamento) * 100, formato: PERCENTAGEM },
      ],
      i % 2 === 1,
    );
  });

  folha.views = [{ state: "frozen", ySplit: linhaCabecalho, xSplit: 1, showGridLines: false }];
  prepararImpressao(folha, { repetirAte: linhaCabecalho });
}

/** A folha do detalhe: uma linha por perfil e por elemento interno, projeto a projeto. */
function folhaDoDetalhe(
  livro: ExcelJS.Workbook,
  orcamento: OrcamentoUnidade,
  nomeDaFolha: string,
  titulo: string,
  explicacao: string,
): void {
  const anos = anosDoOrcamento(orcamento);
  const folha = livro.addWorksheet(nomeDaFolha, { views: [{ showGridLines: false }] });

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
  faixa(folha, linha++, titulos.length, titulo);
  nota(folha, linha++, titulos.length, explicacao);
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
  prepararImpressao(folha, { repetirAte: linhaCabecalho });
  if (ultimaLinha >= primeiraLinha) {
    folha.autoFilter = {
      from: { row: linhaCabecalho, column: 1 },
      to: { row: ultimaLinha, column: titulos.length },
    };
  }
}

/**
 * A folha do resumo: um projeto por linha, e só o que se compara entre eles.
 *
 * Vem primeiro no livro porque é a que responde à pergunta de quem o abre —
 * onde está a equipa. O detalhe fica na folha seguinte, para quem quiser ver
 * de que é feita cada linha.
 */
function folhaDoResumo(livro: ExcelJS.Workbook, orcamento: OrcamentoUnidade): void {
  const folha = livro.addWorksheet("Resumo geral", { views: [{ showGridLines: false }] });
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
  prepararImpressao(folha, { repetirAte: linhaCabecalho });
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

export async function gerarVistaGeralBlob(orcamento: OrcamentoUnidade): Promise<Blob> {
  const dados = await gerarWorkbookVistaGeral(orcamento).xlsx.writeBuffer();
  return new Blob([dados], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
