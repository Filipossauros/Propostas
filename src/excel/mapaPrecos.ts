// O mapa de quantidades e preços de um lote do pedido de licenciamento.
//
// É o que o concorrente preenche e junta à proposta: o preço é o único aspeto
// submetido à concorrência, e as quantidades, a métrica e o período são os do
// caderno de encargos — fixos, bloqueados. Só se escreve nas células amarelas:
// o preço unitário de cada linha e, numa aquisição aberta à concorrência, o
// produto que se propõe (designação, fabricante e versão).
//
// Cada licença é uma linha; a licença perpétua com a manutenção em linha
// própria dá duas — as licenças e a manutenção e suporte, com preço anual.
//
// O total de cada linha (quantidade × preço × períodos) e o do lote são
// fórmulas: quem preenche vê a conta feita, e quem analisa sabe que não foi
// escrita à mão.

import ExcelJS from "exceljs";
import type { LoteLicenca, PedidoLicenciamento } from "../core/licenciamento";
import {
  anosDoPedido,
  designacaoDoLote,
  linhasDoMapa,
  lotesEfetivos,
  nomeProcedimentoLicenciamento,
  type Licenca,
  type LinhaDoMapa,
} from "../core/licenciamento";
import {
  COR_CAMPO_BG,
  COR_CAMPO_BLOQUEADO_BG,
  COR_CAMPO_BLOQUEADO_TEXTO,
  COR_CAMPO_BORDA,
  COR_CAMPO_TEXTO,
  COR_BRANCO,
  COR_FAIXA,
  COR_GRELHA,
  COR_NOTA_BG,
  COR_NOTA_TEXTO,
  COR_ROTULO_BG,
  COR_ROTULO_TEXTO,
  COR_SUBCABECALHO,
  contorno,
  fillSolido,
} from "./estilo";
import { prepararImpressao } from "./impressao";

const MOEDA = '#,##0.00 "€"';

interface Coluna {
  titulo: string;
  largura: number;
}

/** As linhas do mapa de um lote, pela ordem das licenças. */
export function linhasDoLote(pedido: PedidoLicenciamento, lote: LoteLicenca): LinhaDoMapa[] {
  const porId = new Map(pedido.licencas.map((l) => [l.id, l]));
  const nAnos = anosDoPedido(pedido).length;
  return lote.licencaIds
    .map((id) => porId.get(id))
    .filter((l): l is Licenca => l !== undefined)
    .flatMap((l) => linhasDoMapa(l, pedido.natureza, nAnos));
}

export function gerarWorkbookMapaPrecos(pedido: PedidoLicenciamento, lote: LoteLicenca): ExcelJS.Workbook {
  const livro = new ExcelJS.Workbook();
  livro.creator = "Manifestações de Necessidades";
  const folha = livro.addWorksheet(`Lote ${lote.numero}`, { views: [{ state: "frozen", ySplit: 6 }] });
  const aberta = pedido.natureza === "aberta";
  const linhas = linhasDoLote(pedido, lote);

  const colunas: Coluna[] = [
    { titulo: "N.º", largura: 14 },
    { titulo: "Linha (caderno de encargos)", largura: 40 },
    ...(aberta
      ? [
          { titulo: "Produto proposto", largura: 26 },
          { titulo: "Fabricante / titular", largura: 20 },
          { titulo: "Versão / edição", largura: 14 },
        ]
      : []),
    { titulo: "Métrica", largura: 22 },
    { titulo: "Quantidade", largura: 12 },
    { titulo: "Períodos", largura: 10 },
    { titulo: "Unidade de preço", largura: 26 },
    { titulo: "Preço unitário (s/ IVA)", largura: 18 },
    { titulo: "Total (s/ IVA)", largura: 18 },
  ];
  colunas.forEach((c, i) => (folha.getColumn(i + 1).width = c.largura));
  const n = colunas.length;
  const col = (titulo: string) => colunas.findIndex((c) => c.titulo === titulo) + 1;
  const letra = (c: number) => folha.getColumn(c).letter;

  // Faixa, identificação e instruções.
  folha.mergeCells(1, 1, 1, n);
  const faixa = folha.getCell(1, 1);
  faixa.value = "Mapa de quantidades e preços";
  faixa.font = { bold: true, size: 14, color: { argb: COR_BRANCO } };
  faixa.fill = fillSolido(COR_FAIXA);
  faixa.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  folha.getRow(1).height = 26;

  const identificacao = (linha: number, rotulo: string, valor: string) => {
    folha.mergeCells(linha, 2, linha, n);
    const r = folha.getCell(linha, 1);
    r.value = rotulo;
    r.font = { bold: true, color: { argb: COR_ROTULO_TEXTO } };
    r.fill = fillSolido(COR_ROTULO_BG);
    const v = folha.getCell(linha, 2);
    v.value = valor;
    v.font = { color: { argb: COR_ROTULO_TEXTO } };
    v.alignment = { wrapText: true, vertical: "middle" };
  };
  identificacao(2, "Procedimento", nomeProcedimentoLicenciamento(pedido.nomeProduto));
  identificacao(3, "Lote", `Lote ${lote.numero} — ${designacaoDoLote(lote, pedido)}`);

  folha.mergeCells(4, 1, 4, n);
  const nota = folha.getCell(4, 1);
  nota.value =
    "Preencha apenas as células a amarelo. O preço é o único aspeto submetido à concorrência: as quantidades, a " +
    "métrica e o período são os do caderno de encargos e não se alteram. Preços sem IVA, em euros, com duas casas " +
    "decimais. O total de cada linha é quantidade × preço unitário × períodos." +
    (aberta ? " Identifique, em cada linha de licença, o produto proposto, o fabricante e a versão ou edição." : "");
  nota.font = { italic: true, size: 9, color: { argb: COR_NOTA_TEXTO } };
  nota.fill = fillSolido(COR_NOTA_BG);
  nota.alignment = { wrapText: true, vertical: "top" };
  folha.getRow(4).height = 42;

  // Cabeçalho da tabela.
  const CABECALHO = 6;
  colunas.forEach((c, i) => {
    const cel = folha.getCell(CABECALHO, i + 1);
    cel.value = c.titulo;
    cel.font = { bold: true, color: { argb: COR_BRANCO } };
    cel.fill = fillSolido(COR_SUBCABECALHO);
    cel.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
    cel.border = contorno(COR_GRELHA);
  });
  folha.getRow(CABECALHO).height = 32;

  const bloqueada = (cel: ExcelJS.Cell) => {
    cel.fill = fillSolido(COR_CAMPO_BLOQUEADO_BG);
    cel.font = { color: { argb: COR_CAMPO_BLOQUEADO_TEXTO } };
    cel.border = contorno(COR_GRELHA);
    cel.alignment = { wrapText: true, vertical: "middle" };
    cel.protection = { locked: true };
  };
  const aPreencher = (cel: ExcelJS.Cell) => {
    cel.fill = fillSolido(COR_CAMPO_BG);
    cel.font = { color: { argb: COR_CAMPO_TEXTO } };
    cel.border = contorno(COR_CAMPO_BORDA);
    cel.alignment = { wrapText: true, vertical: "middle" };
    cel.protection = { locked: false };
  };

  const primeira = CABECALHO + 1;
  linhas.forEach((linha, i) => {
    const r = primeira + i;
    const valores: Record<string, ExcelJS.CellValue> = {
      "N.º": i + 1,
      "Linha (caderno de encargos)": linha.designacao,
      Métrica: linha.metrica,
      Quantidade: linha.quantidade,
      Períodos: linha.periodos,
      "Unidade de preço": linha.unidade,
    };
    colunas.forEach((c, j) => {
      const cel = folha.getCell(r, j + 1);
      if (c.titulo in valores) {
        cel.value = valores[c.titulo];
        bloqueada(cel);
      }
    });
    for (const titulo of ["Produto proposto", "Fabricante / titular", "Versão / edição"]) {
      if (col(titulo) === 0) continue;
      const cel = folha.getCell(r, col(titulo));
      // A linha da manutenção é do produto da linha anterior, e o serviço não é um produto: não se identificam.
      if (linha.tipo === "licenca") aPreencher(cel);
      else {
        cel.value = "—";
        bloqueada(cel);
      }
    }
    const preco = folha.getCell(r, col("Preço unitário (s/ IVA)"));
    aPreencher(preco);
    preco.numFmt = MOEDA;
    preco.dataValidation = {
      type: "decimal",
      operator: "greaterThan",
      formulae: [0],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Preço unitário",
      error: "Indique um valor positivo, sem IVA.",
    };

    const qtd = `${letra(col("Quantidade"))}${r}`;
    const periodos = `${letra(col("Períodos"))}${r}`;
    const pu = `${letra(col("Preço unitário (s/ IVA)"))}${r}`;
    const total = folha.getCell(r, col("Total (s/ IVA)"));
    total.value = { formula: `IF(${pu}="","",${qtd}*${pu}*${periodos})` };
    bloqueada(total);
    total.numFmt = MOEDA;
    total.font = { bold: true, color: { argb: COR_CAMPO_BLOQUEADO_TEXTO } };
  });

  // O total do lote.
  const ultima = primeira + linhas.length - 1;
  const linhaTotal = ultima + 1;
  const colTotal = col("Total (s/ IVA)");
  folha.mergeCells(linhaTotal, 1, linhaTotal, colTotal - 1);
  const rotulo = folha.getCell(linhaTotal, 1);
  rotulo.value = "Preço total do lote (s/ IVA)";
  rotulo.font = { bold: true, color: { argb: COR_ROTULO_TEXTO } };
  rotulo.fill = fillSolido(COR_ROTULO_BG);
  rotulo.alignment = { horizontal: "right" };
  const soma = folha.getCell(linhaTotal, colTotal);
  soma.value = { formula: `SUM(${letra(colTotal)}${primeira}:${letra(colTotal)}${ultima})` };
  soma.numFmt = MOEDA;
  soma.font = { bold: true, color: { argb: COR_ROTULO_TEXTO } };
  soma.fill = fillSolido(COR_ROTULO_BG);
  soma.border = contorno(COR_GRELHA);

  prepararImpressao(folha, { repetirAte: CABECALHO });
  folha.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: true,
    formatRows: true,
    insertRows: false,
    insertColumns: false,
    deleteRows: false,
    deleteColumns: false,
  });
  return livro;
}

export async function gerarMapaPrecosBlob(pedido: PedidoLicenciamento, lote: LoteLicenca): Promise<Blob> {
  const dados = await gerarWorkbookMapaPrecos(pedido, lote).xlsx.writeBuffer();
  return new Blob([dados], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/** Os lotes que levam mapa: todos os que têm licenças. */
export function lotesComMapa(pedido: PedidoLicenciamento): LoteLicenca[] {
  return lotesEfetivos(pedido).filter((l) => l.licencaIds.length > 0);
}
