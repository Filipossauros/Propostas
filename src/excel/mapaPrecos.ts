// O mapa de quantidades e preços de um lote do pedido de licenciamento.
//
// É o que o concorrente preenche e junta à proposta: o preço é o único aspeto
// submetido à concorrência, e as quantidades, a métrica e o período são os do
// caderno de encargos — fixos, bloqueados. Só se escreve nas células amarelas:
// o preço unitário de cada produto e, numa aquisição aberta à concorrência, o
// produto que se propõe (designação, fabricante e versão).
//
// O total de cada linha e o do lote são fórmulas: quem preenche vê a conta
// feita, e quem analisa sabe que não foi escrita à mão.

import ExcelJS from "exceljs";
import type { PedidoLicenciamento, ProdutoLicenca } from "../core/licenciamento";
import {
  designacaoDoLote,
  lotesEfetivos,
  METRICAS,
  nomeDoProduto,
  nomeProcedimentoLicenciamento,
  type LoteLicenca,
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

/** O que a coluna «Unidade de preço» diz de cada produto. */
export function unidadeDePreco(p: ProdutoLicenca): string {
  if (p.direitoUso === "temporario") return "€ por licença e por mês";
  return p.manutencao === "aParte" ? "€ por licença (perpétua)" : "€ por licença (perpétua, com manutenção)";
}

/** O multiplicador do preço: os meses, na subscrição; 1, na licença perpétua. */
export function mesesDoPreco(p: ProdutoLicenca): number {
  return p.direitoUso === "temporario" ? p.periodoMeses : 1;
}

export function gerarWorkbookMapaPrecos(pedido: PedidoLicenciamento, lote: LoteLicenca): ExcelJS.Workbook {
  const livro = new ExcelJS.Workbook();
  livro.creator = "Manifestações de Necessidades";
  const folha = livro.addWorksheet(`Lote ${lote.numero}`, { views: [{ state: "frozen", ySplit: 6 }] });
  const aberta = pedido.natureza === "aberta";
  const porId = new Map(pedido.produtos.map((p) => [p.id, p]));
  const produtos = lote.produtoIds.map((id) => porId.get(id)).filter((p): p is ProdutoLicenca => p !== undefined);
  const comManutencao = produtos.some((p) => p.direitoUso === "perpetuo" && p.manutencao === "aParte");

  const colunas: Coluna[] = [
    { titulo: "N.º", largura: 6 },
    { titulo: "Produto (caderno de encargos)", largura: 38 },
    ...(aberta
      ? [
          { titulo: "Produto proposto", largura: 26 },
          { titulo: "Fabricante", largura: 20 },
          { titulo: "Versão / edição", largura: 14 },
        ]
      : []),
    { titulo: "Métrica", largura: 22 },
    { titulo: "Quantidade", largura: 12 },
    { titulo: "Meses", largura: 9 },
    { titulo: "Unidade de preço", largura: 24 },
    { titulo: "Preço unitário (s/ IVA)", largura: 18 },
    ...(comManutencao ? [{ titulo: "Manutenção anual (% do valor das licenças)", largura: 18 }] : []),
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
  folha.getColumn(1).width = Math.max(colunas[0].largura, 14);
  identificacao(2, "Procedimento", nomeProcedimentoLicenciamento(pedido.nomeProjeto));
  identificacao(3, "Lote", `Lote ${lote.numero} — ${designacaoDoLote(lote, pedido)}`);

  folha.mergeCells(4, 1, 4, n);
  const nota = folha.getCell(4, 1);
  nota.value =
    "Preencha apenas as células a amarelo. O preço é o único aspeto submetido à concorrência: as quantidades, a " +
    "métrica e o período são os do caderno de encargos e não se alteram. Preços sem IVA, em euros, com duas casas " +
    "decimais." +
    (aberta ? " Identifique, em cada linha, o produto proposto, o fabricante e a versão ou edição." : "");
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
  produtos.forEach((p, i) => {
    const linha = primeira + i;
    const valores: Record<string, ExcelJS.CellValue> = {
      "N.º": i + 1,
      "Produto (caderno de encargos)": nomeDoProduto(p, pedido.natureza) || "Produto",
      Métrica: p.metrica === "" ? "" : METRICAS[p.metrica].plural,
      Quantidade: p.quantidade,
      Meses: mesesDoPreco(p),
      "Unidade de preço": unidadeDePreco(p),
    };
    colunas.forEach((c, j) => {
      const cel = folha.getCell(linha, j + 1);
      if (c.titulo in valores) {
        cel.value = valores[c.titulo];
        bloqueada(cel);
      }
    });
    for (const titulo of ["Produto proposto", "Fabricante", "Versão / edição"]) {
      if (col(titulo) > 0) aPreencher(folha.getCell(linha, col(titulo)));
    }
    const preco = folha.getCell(linha, col("Preço unitário (s/ IVA)"));
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

    const qtd = `${letra(col("Quantidade"))}${linha}`;
    const meses = `${letra(col("Meses"))}${linha}`;
    const pu = `${letra(col("Preço unitário (s/ IVA)"))}${linha}`;
    let formula = `IF(${pu}="","",${qtd}*${pu}*${meses})`;
    if (comManutencao) {
      const manut = folha.getCell(linha, col("Manutenção anual (% do valor das licenças)"));
      if (p.direitoUso === "perpetuo" && p.manutencao === "aParte") {
        aPreencher(manut);
        manut.numFmt = '0.00"%"';
        const m = `${letra(col("Manutenção anual (% do valor das licenças)"))}${linha}`;
        formula = `IF(${pu}="","",${qtd}*${pu}*(1+N(${m})/100*${p.periodoMeses}/12))`;
      } else {
        manut.value = "—";
        bloqueada(manut);
      }
    }
    const total = folha.getCell(linha, col("Total (s/ IVA)"));
    total.value = { formula };
    bloqueada(total);
    total.numFmt = MOEDA;
    total.font = { bold: true, color: { argb: COR_CAMPO_BLOQUEADO_TEXTO } };
  });

  // O total do lote.
  const ultima = primeira + produtos.length - 1;
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

  if (comManutencao) {
    folha.mergeCells(linhaTotal + 2, 1, linhaTotal + 2, n);
    const nm = folha.getCell(linhaTotal + 2, 1);
    nm.value =
      "Nas licenças perpétuas com manutenção à parte, indique a percentagem anual da manutenção sobre o valor das " +
      "licenças; o total inclui a manutenção de todo o período do contrato.";
    nm.font = { italic: true, size: 9, color: { argb: COR_NOTA_TEXTO } };
    nm.alignment = { wrapText: true };
    folha.getRow(linhaTotal + 2).height = 28;
  }

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

/** Os lotes que levam mapa: todos os que têm produtos. */
export function lotesComMapa(pedido: PedidoLicenciamento): LoteLicenca[] {
  return lotesEfetivos(pedido).filter((l) => l.produtoIds.length > 0);
}
