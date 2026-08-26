// Pedido de assunção de encargos plurianuais, no modelo formal da organização.
//
// Ao contrário do documento gerado em `gerarDocx.ts`, que nasce de uma folha em
// branco, este parte de um modelo Word fornecido pela organização — com o
// logótipo, o cabeçalho, o rodapé numerado, a caixa de parecer e o bloco de
// assinatura. Dele aproveitam-se essas partes tal e qual, e o corpo é
// reconstruído com o conteúdo que a aplicação já sabe produzir.
//
// Daí não se usar a biblioteca `docx`, que só escreve documentos novos: abre-se
// o ZIP, substitui-se `word/document.xml`, e tudo o resto — imagens, estilos,
// cabeçalho, rodapé — volta a fechar-se intacto.

import JSZip from "jszip";
import type { BlocoDocumento, Celula, Coluna } from "../core/documento";
import type { LotesJSON } from "../core/types";
import { blocosAnexoTecnico, blocosEncargosPlurianuais } from "../core/cadernoEncargos";
import { anosPlurianuais, formatarMoeda, totalProcedimento } from "../core/lotes";
import modeloBase64 from "./modelos/Pedido_Encargos_Plurianuais.docx?base64";

// --------------------------------------------------------------------------
// Tipografia
// --------------------------------------------------------------------------
//
// Uma só família e quatro tamanhos, em todo o documento: 11 pt nos títulos de
// secção, 10 pt no texto corrido, 9 pt nas tabelas e 8 pt na tabela dos anos,
// que é a única com oito colunas. O modelo trazia Arial e Calibri misturados,
// e tamanhos a saltar entre 9 e 10 pt na mesma linha.
const LETRA = "Arial";
const CORPO = 20;
const TABELA = 18;
const TITULO = 22;
const ANOS = 16;

/** O que a aplicação não sabe e fica a cargo de quem assina, a vermelho. */
const POR_PREENCHER = "C00000";
const SUAVE = "595959";
const CINZA = "EDF1F5";

/** Área útil da página do modelo: 11906 − 1701 − 849, em DXA. */
const LARGURA = 9356;

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const RFONTS = `<w:rFonts w:ascii="${LETRA}" w:eastAsia="${LETRA}" w:hAnsi="${LETRA}" w:cs="${LETRA}"/>`;

function esc(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface OpcoesRun {
  negrito?: boolean;
  italico?: boolean;
  sz?: number;
  cor?: string;
}

function run(texto: string, { negrito, italico, sz = CORPO, cor }: OpcoesRun = {}): string {
  let rpr = `<w:rPr>${RFONTS}`;
  if (negrito) rpr += "<w:b/>";
  if (italico) rpr += "<w:i/>";
  if (cor) rpr += `<w:color w:val="${cor}"/>`;
  rpr += `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:lang w:val="pt-PT"/></w:rPr>`;
  return `<w:r>${rpr}<w:t xml:space="preserve">${esc(texto)}</w:t></w:r>`;
}

/** Um tabulador a sério — `w:tab` —, e não um caractere de tabulação solto. */
function tabulador(sz = CORPO): string {
  return `<w:r><w:rPr>${RFONTS}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:tab/></w:r>`;
}

function quebra(): string {
  return "<w:r><w:br/></w:r>";
}

interface OpcoesParagrafo {
  jc?: "both" | "left" | "right" | "center";
  antes?: number;
  depois?: number;
  ind?: number;
  pendente?: number;
  borda?: boolean;
}

function paragrafo(conteudo: string | string[], opcoes: OpcoesParagrafo = {}): string {
  const { jc = "both", antes = 120, depois = 120, ind = 0, pendente = 0, borda = false } = opcoes;
  const runs = typeof conteudo === "string" ? [run(conteudo)] : conteudo;

  // A ordem dos filhos de `w:pPr` é imposta pelo esquema: pBdr antes de tabs,
  // tabs antes de spacing, spacing antes de ind, ind antes de jc.
  let ppr = '<w:pPr><w:pStyle w:val="Normal0"/>';
  if (borda) ppr += '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="BFBFBF"/></w:pBdr>';
  if (ind && pendente) ppr += `<w:tabs><w:tab w:val="left" w:pos="${ind}"/></w:tabs>`;
  ppr += `<w:spacing w:before="${antes}" w:after="${depois}" w:line="259" w:lineRule="auto"/>`;
  if (ind) ppr += pendente ? `<w:ind w:left="${ind}" w:hanging="${pendente}"/>` : `<w:ind w:left="${ind}"/>`;
  ppr += `<w:jc w:val="${jc}"/></w:pPr>`;

  return `<w:p>${ppr}${runs.join("")}</w:p>`;
}

function vazio(depois = 0): string {
  return (
    '<w:p><w:pPr><w:pStyle w:val="Normal0"/>' +
    `<w:spacing w:before="0" w:after="${depois}" w:line="240" w:lineRule="auto"/></w:pPr></w:p>`
  );
}

/**
 * Os títulos, em três níveis.
 *
 * Os do modelo (I, II, III, IV) ficam a 11 pt; os que vêm do anexo técnico
 * descem um degrau, para não competirem com o «IV – Anexo Técnico» que os
 * encabeça.
 */
function titulo(texto: string, nivel: 1 | 2 | 3 = 1, borda = false): string {
  const sz = nivel === 1 ? TITULO : CORPO;
  const antes = { 1: 360, 2: 280, 3: 200 }[nivel];
  return paragrafo([run(texto, { negrito: true, italico: nivel === 3, sz })], {
    jc: "left",
    antes,
    depois: 120,
    borda,
  });
}

function marcador(texto: string): string {
  return run(`[${texto}]`, { negrito: true, cor: POR_PREENCHER });
}

/** Uma alínea, com marca e avanço — sem `numbering.xml` à mistura. */
function alinea(texto: string): string {
  return paragrafo([run("•"), tabulador(), run(texto)], { antes: 40, depois: 40, ind: 284, pendente: 284 });
}

// --------------------------------------------------------------------------
// Tabelas
// --------------------------------------------------------------------------

/** Uma linha de célula: texto simples, ou texto com uma segunda linha suave. */
type LinhaDeCelula = string | { texto: string; suave: string };

interface OpcoesCelula {
  cabecalho?: boolean;
  direita?: boolean;
  sz?: number;
}

function celula(conteudo: LinhaDeCelula, largura: number, { cabecalho, direita, sz = TABELA }: OpcoesCelula = {}): string {
  const sombra = cabecalho ? `<w:shd w:val="clear" w:color="auto" w:fill="${CINZA}"/>` : "";
  const runs =
    typeof conteudo === "string"
      ? [run(conteudo, { negrito: cabecalho, sz })]
      : [
          run(conteudo.texto, { negrito: cabecalho, sz }),
          quebra(),
          run(conteudo.suave, { sz: sz - 2, cor: SUAVE }),
        ];

  return (
    `<w:tc><w:tcPr><w:tcW w:w="${largura}" w:type="dxa"/>${sombra}` +
    `<w:vAlign w:val="center"/></w:tcPr>` +
    paragrafo(runs, { jc: direita ? "right" : "left", antes: 40, depois: 40 }) +
    "</w:tc>"
  );
}

/**
 * Uma tabela com cabeçalho sombreado e larguras proporcionais aos pesos.
 *
 * As larguras vão em DXA na grelha e em cada célula — é o par que faz a tabela
 * sair igual no Word e nos leitores que não seguem a grelha.
 */
function tabela(
  colunas: Coluna[],
  linhas: LinhaDeCelula[][],
  { legenda, sz = TABELA }: { legenda?: string; sz?: number } = {},
): string {
  const pesos = colunas.map((c) => c.peso ?? 100 / colunas.length);
  const total = pesos.reduce((soma, p) => soma + p, 0);
  const larguras = pesos.map((p) => Math.round((LARGURA * p) / total));
  larguras[larguras.length - 1] += LARGURA - larguras.reduce((soma, w) => soma + w, 0);

  const bordas = ["top", "left", "bottom", "right", "insideH", "insideV"]
    .map((lado) => `<w:${lado} w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>`)
    .join("");

  let xml =
    "<w:tbl><w:tblPr>" +
    '<w:tblStyle w:val="TabelacomGrelha"/>' +
    `<w:tblW w:w="${LARGURA}" w:type="dxa"/>` +
    `<w:tblBorders>${bordas}</w:tblBorders>` +
    '<w:tblLayout w:type="fixed"/>' +
    '<w:tblCellMar><w:left w:w="85" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar>' +
    '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="0"' +
    ' w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>' +
    "</w:tblPr><w:tblGrid>" +
    larguras.map((w) => `<w:gridCol w:w="${w}"/>`).join("") +
    "</w:tblGrid>";

  // O cabeçalho repete-se no topo de cada página em que a tabela continue.
  xml +=
    "<w:tr><w:trPr><w:tblHeader/></w:trPr>" +
    colunas
      .map((c, i) => celula(c.titulo, larguras[i], { cabecalho: true, sz, direita: c.alinhamento === "direita" }))
      .join("") +
    "</w:tr>";

  for (const linha of linhas) {
    xml +=
      "<w:tr>" +
      linha.map((c, i) => celula(c, larguras[i], { sz, direita: colunas[i]?.alinhamento === "direita" })).join("") +
      "</w:tr>";
  }

  xml += "</w:tbl>";
  return xml + (legenda ? paragrafo([run(legenda, { italico: true, sz: TABELA })], { jc: "left", antes: 60, depois: 180 }) : vazio(120));
}

function textoDaCelula(c: Celula): string {
  return c.texto;
}

function tabelaDoBloco(bloco: Extract<BlocoDocumento, { tipo: "tabela" }>): string {
  return tabela(bloco.colunas, bloco.linhas.map((l) => l.map(textoDaCelula)), { legenda: bloco.legenda });
}

/**
 * A tabela dos anos, com as horas por baixo do valor.
 *
 * São oito colunas numa página A4 de retrato: com o valor e as horas na mesma
 * linha, «181 843,20 € (1760 h)» parte-se em três e a tabela fica ilegível.
 * As colunas «Pessoas» e «Lotes» ganham folga à custa das dos anos, ou partem
 * a meio da palavra.
 */
function tabelaPlurianual(bloco: Extract<BlocoDocumento, { tipo: "tabela" }>): string {
  const folga: Record<string, number> = { Pessoas: 9, Perfil: 21, Lotes: 8 };
  const colunas = bloco.colunas.map((c) => ({ ...c, peso: folga[c.titulo] ?? c.peso }));

  const linhas = bloco.linhas.map((linha) =>
    linha.map((c): LinhaDeCelula => {
      const m = /^(.+?) \((\d[\d  ]*) h\)$/.exec(c.texto);
      return m === null ? c.texto : { texto: m[1], suave: `${m[2]} h` };
    }),
  );
  return tabela(colunas, linhas, { legenda: bloco.legenda, sz: ANOS });
}

function renderizar(bloco: BlocoDocumento): string {
  switch (bloco.tipo) {
    case "titulo":
      // Um degrau abaixo do «IV – Anexo Técnico»: 1 → 2, 2 → 3, 3 → 3.
      return bloco.nivel === 1 ? titulo(bloco.texto, 2, true) : titulo(bloco.texto, 3);
    case "paragrafo":
      return paragrafo(bloco.texto);
    case "nota":
      return paragrafo([run(bloco.texto, { italico: true, sz: TABELA })], { jc: "left" });
    case "lista":
      return bloco.itens.map(alinea).join("");
    case "tabela":
      return tabelaDoBloco(bloco);
  }
}

// --------------------------------------------------------------------------
// Blocos herdados do modelo
// --------------------------------------------------------------------------

/**
 * Achata os `w:sdt` — os campos de formulário — no texto que já contêm.
 *
 * No modelo vêm todos com `showingPlcHdr`, o que os faz aparecer no Word como
 * caixas cinzentas de marcador: é o que se via à frente do número, da data e do
 * objeto, e também no bloco de assinatura. Achatados, ficam texto normal.
 */
function semCampos(xml: string): string {
  let saida = xml;
  for (let i = saida.indexOf("<w:sdt>"); i !== -1; i = saida.indexOf("<w:sdt>")) {
    const abre = saida.indexOf("<w:sdtContent>", i) + "<w:sdtContent>".length;
    const fecha = saida.indexOf("</w:sdtContent>", abre);
    const fim = saida.indexOf("</w:sdt>", fecha) + "</w:sdt>".length;
    saida = saida.slice(0, i) + saida.slice(abre, fecha) + saida.slice(fim);
  }
  return saida;
}

/**
 * Uma só família também nos blocos vindos do modelo, que alternava Arial,
 * Calibri e o tipo de letra do tema conforme o parágrafo.
 */
function soArial(xml: string): string {
  return xml
    .replace(/<w:rFonts[^/]*\/>/g, RFONTS)
    .replace(/<w:rPr>(?!<w:rFonts)/g, `<w:rPr>${RFONTS}`)
    // 7 pt no bloco de assinatura: sobe para os 9 pt do resto das tabelas.
    .replace(/<w:sz w:val="14"\/>/g, `<w:sz w:val="${TABELA}"/>`)
    .replace(/<w:szCs w:val="14"\/>/g, `<w:szCs w:val="${TABELA}"/>`);
}

function herdado(xml: string): string {
  return soArial(semCampos(xml));
}

// --------------------------------------------------------------------------
// Corpo
// --------------------------------------------------------------------------

export function dataPorExtenso(quando: Date): string {
  return `${quando.getDate()} de ${MESES[quando.getMonth()]} de ${quando.getFullYear()}`;
}

/**
 * N.º, Data e Assunto — em texto corrido, sem os campos de formulário.
 *
 * A tabela é reconstruída em vez de aproveitada: os três campos do modelo eram
 * `w:sdt` e o que aqui se quer é texto que se leia igual em qualquer leitor.
 */
function tabelaIdentificacao(data: string, assunto: string): string {
  const campo = (rotulo: string, valor: string[]): string =>
    paragrafo([run(rotulo, { sz: TABELA }), tabulador(TABELA), ...valor], { jc: "left" });

  const semBordas =
    "<w:tblBorders><w:top w:val=\"nil\"/><w:left w:val=\"nil\"/><w:bottom w:val=\"nil\"/>" +
    "<w:right w:val=\"nil\"/><w:insideH w:val=\"nil\"/><w:insideV w:val=\"nil\"/></w:tblBorders>";

  return (
    "<w:tbl><w:tblPr>" +
    `<w:tblW w:w="${LARGURA}" w:type="dxa"/>${semBordas}` +
    '<w:tblLayout w:type="fixed"/>' +
    '<w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>' +
    "</w:tblPr>" +
    '<w:tblGrid><w:gridCol w:w="4455"/><w:gridCol w:w="4901"/></w:tblGrid>' +
    "<w:tr>" +
    `<w:tc><w:tcPr><w:tcW w:w="4455" w:type="dxa"/></w:tcPr>${campo("N.º:", [marcador("n.º do documento")])}</w:tc>` +
    `<w:tc><w:tcPr><w:tcW w:w="4901" w:type="dxa"/></w:tcPr>${campo("Data:", [run(data, { negrito: true, sz: TABELA })])}</w:tc>` +
    "</w:tr><w:tr>" +
    `<w:tc><w:tcPr><w:tcW w:w="${LARGURA}" w:type="dxa"/><w:gridSpan w:val="2"/></w:tcPr>` +
    campo("Assunto:", [run(assunto, { negrito: true, sz: TABELA })]) +
    "</w:tc></w:tr></w:tbl>"
  );
}

function entre(texto: string, abre: string, fecha: string, desde = 0): string {
  const i = texto.indexOf(abre, desde);
  const j = texto.indexOf(fecha, i) + fecha.length;
  return texto.slice(i, j);
}

function ultimaTabela(xml: string): string {
  const i = xml.lastIndexOf("<w:tbl>");
  return xml.slice(i, xml.indexOf("</w:tbl>", i) + "</w:tbl>".length);
}

/** O corpo completo do documento, em XML. */
export function corpoDoPedido(config: LotesJSON, modelo: string, quando: Date): string {
  const projeto = config.nomeProjeto.trim() === "" ? "(projeto sem nome)" : config.nomeProjeto.trim();
  const anos = anosPlurianuais(config.encargosPlurianuais.anoInicio);
  const total = totalProcedimento(config);

  // Do modelo aproveitam-se as duas tabelas que são identidade da organização:
  // a caixa de parecer, no topo, e o bloco de assinatura, no fim.
  const parecer = entre(modelo, "<w:tbl>", "</w:tbl>");
  const assinatura = ultimaTabela(modelo);

  const p: string[] = [];
  p.push(herdado(parecer));
  p.push(vazio(120));
  p.push(
    tabelaIdentificacao(
      dataPorExtenso(quando),
      `Pedido de Assunção de Encargos Plurianuais para o projeto ${projeto}.`,
    ),
  );

  p.push(titulo("I – Enquadramento"));
  p.push(
    paragrafo(
      "O Regulamento Interno aprovado por Deliberação do Conselho de Administração da SPMS, E.P.E. em " +
        "14/08/2019, clarifica as várias atribuições que estão adstritas à Direção de Arquitetura, Negócio e " +
        "Análise de Dados bem como à Coordenação de Planeamento, Arquitetura, Conformidade e Engenharia.",
    ),
  );
  p.push(
    paragrafo([
      run("Assim, no âmbito destas atribuições insere-se o Projeto "),
      run(projeto, { negrito: true }),
      run(". Este projeto visa "),
      marcador("descrição do projeto"),
      run("."),
    ]),
  );
  p.push(
    paragrafo([
      run("O Projeto "),
      marcador("está / não está"),
      run(" integrado no contrato programa com a ACSS."),
    ]),
  );

  p.push(titulo("II – Análise"));
  p.push(titulo("2.1. Encargos com o projeto planeados para o ano corrente/transato", 2));
  p.push(paragrafo("Para assegurar estes serviços foram desenvolvidos os seguintes procedimentos:"));
  p.push(
    paragrafo(
      [marcador("tabela dos procedimentos do ano corrente/transato: n.º de procedimento, objeto, adjudicatário e valor")],
      { jc: "left" },
    ),
  );

  p.push(
    titulo(`2.2. Encargos previstos através da assunção de encargos plurianuais ${anos[0]} e anos subsequentes`, 2),
  );

  // Os parágrafos de enquadramento e a tabela são os mesmos que a aplicação
  // produz no seu próprio Word: uma fonte só, para não divergirem.
  const plurianuais = blocosEncargosPlurianuais(config);
  for (const bloco of plurianuais) {
    if (bloco.tipo === "paragrafo" && bloco.texto.startsWith("O preço base")) continue;
    if (bloco.tipo === "titulo") continue;
    if (bloco.tipo === "tabela") {
      p.push(
        paragrafo(
          "Os valores hora apresentados foram apurados através do valor médio das propostas obtidas no último " +
            "concurso público realizado pela SPMS, E.P.E. para adquirir serviços desta natureza.",
        ),
      );
      p.push(tabelaPlurianual(bloco));
      continue;
    }
    p.push(renderizarNoCorpo(bloco));
  }
  p.push(
    paragrafo(
      `O preço base do procedimento é de ${formatarMoeda(total.semIva)}, sem IVA, correspondendo a ` +
        `${formatarMoeda(total.comIva)} com IVA à taxa legal em vigor.`,
    ),
  );

  p.push(titulo("III – Conclusão"));
  p.push(
    paragrafo(
      "Atentos os factos supra elencados, torna-se necessário desencadear os procedimentos necessários para " +
        "obter a autorização para assunção de encargos plurianuais nos termos constantes no quadro supra.",
    ),
  );
  p.push(
    paragrafo(
      "Caso seja superiormente autorizado deverá a presente informação ser remetida à Direção de Administração " +
        "Geral, por forma a instruir os respetivos processos inerentes à contratação, mediante o anexo técnico e " +
        "formulários de declaração de experiência profissional.",
    ),
  );
  p.push(vazio(240));
  p.push(paragrafo("À consideração superior,", { jc: "left", depois: 240 }));
  p.push(herdado(assinatura));

  p.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
  p.push(titulo("IV – Anexo Técnico"));
  for (const bloco of blocosAnexoTecnico(config)) p.push(renderizar(bloco));

  return p.join("");
}

/** No corpo do pedido os parágrafos saem tal e qual; os títulos ficam de fora. */
function renderizarNoCorpo(bloco: BlocoDocumento): string {
  return bloco.tipo === "paragrafo" ? paragrafo(bloco.texto) : renderizar(bloco);
}

// --------------------------------------------------------------------------
// Montagem do ficheiro
// --------------------------------------------------------------------------

const CAMINHO_DOCUMENTO = "word/document.xml";

export async function gerarPedidoPlurianualBlob(config: LotesJSON, quando = new Date()): Promise<Blob> {
  const zip = await JSZip.loadAsync(modeloBase64, { base64: true });
  const modelo = await zip.file(CAMINHO_DOCUMENTO)!.async("string");

  const sect = entre(modelo, "<w:sectPr", "</w:sectPr>");
  const corpo = corpoDoPedido(config, modelo, quando) + sect;
  const inicio = modelo.indexOf("<w:body>") + "<w:body>".length;
  const fim = modelo.lastIndexOf("</w:body>");

  zip.file(CAMINHO_DOCUMENTO, modelo.slice(0, inicio) + corpo + modelo.slice(fim));
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
