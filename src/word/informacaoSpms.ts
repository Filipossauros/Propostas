// As informações da organização, no seu modelo formal: o pedido de assunção de
// encargos plurianuais e a manifestação de necessidades.
//
// São a mesma informação vista de dois sítios, e por isso o mesmo documento com
// duas variantes: o enquadramento, o anexo técnico e o bloco de assinatura são
// comuns; o que muda é o assunto, o que a análise mostra do preço base e o que
// a conclusão pede. Qual dos dois sai decide-se pelo procedimento — com
// encargos plurianuais é um pedido de autorização para os assumir; sem eles, a
// despesa cabe no ano e o que há a fazer é manifestar a necessidade.
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
import { alineasDoItem, marcaDeAlinea, textoDoItem } from "../core/documento";
import type { LotesJSON } from "../core/types";
import {
  blocosAnexoTecnico,
  blocosDivisaoPorLotes,
  blocosEncargosPlurianuais,
  tabelaPrecoBase,
} from "../core/cadernoEncargos";
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

/** Um item de lista, com marca e avanço — sem `numbering.xml` à mistura. */
function itemDeLista(marca: string, texto: string, avanco = 284): string {
  return paragrafo([run(marca), tabulador(), run(texto)], {
    antes: 40,
    depois: 40,
    ind: avanco,
    pendente: avanco,
  });
}

/**
 * Uma lista do documento estruturado, numerada ou com marcas.
 *
 * A numeração sai por extenso, e não de `numbering.xml`: as normas remetem
 * umas para as outras pelo número («nos termos do n.º 2»), e um número que o
 * Word recalcule ao editar deixaria a remissão a apontar para outro sítio.
 */
function lista(bloco: Extract<BlocoDocumento, { tipo: "lista" }>): string {
  return bloco.itens
    .map((item, i) => {
      const marca = bloco.numerada ? `${i + 1}.` : "•";
      return (
        itemDeLista(marca, textoDoItem(item)) +
        alineasDoItem(item)
          .map((texto, j) => itemDeLista(marcaDeAlinea(j), texto, 624))
          .join("")
      );
    })
    .join("");
}

// --------------------------------------------------------------------------
// Tabelas
// --------------------------------------------------------------------------

/**
 * O conteúdo de uma célula: texto simples, texto com uma segunda linha suave,
 * ou várias linhas do mesmo peso.
 */
type LinhaDeCelula = string | { texto: string; suave: string } | { linhas: string[] };

interface OpcoesCelula {
  cabecalho?: boolean;
  direita?: boolean;
  sz?: number;
}

function conteudoEmRuns(conteudo: LinhaDeCelula, cabecalho: boolean, sz: number): string[] {
  if (typeof conteudo === "string") return [run(conteudo, { negrito: cabecalho, sz })];

  // Várias linhas do mesmo peso, separadas por quebras: é como os números de
  // procedimento cabem numa coluna estreita sem se partirem a meio.
  if ("linhas" in conteudo) {
    return conteudo.linhas.flatMap((linha, i) =>
      i === 0 ? [run(linha, { negrito: cabecalho, sz })] : [quebra(), run(linha, { negrito: cabecalho, sz })],
    );
  }

  return [
    run(conteudo.texto, { negrito: cabecalho, sz }),
    quebra(),
    run(conteudo.suave, { sz: sz - 2, cor: SUAVE }),
  ];
}

function celula(conteudo: LinhaDeCelula, largura: number, { cabecalho, direita, sz = TABELA }: OpcoesCelula = {}): string {
  const sombra = cabecalho ? `<w:shd w:val="clear" w:color="auto" w:fill="${CINZA}"/>` : "";
  const runs = conteudoEmRuns(conteudo, cabecalho === true, sz);

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
      return paragrafo([run(bloco.texto, { negrito: bloco.destaque })]);
    case "nota":
      return paragrafo([run(bloco.texto, { italico: true, sz: TABELA })], { jc: "left" });
    case "lista":
      return lista(bloco);
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
 *
 * A manifestação de necessidades leva ainda o n.º de orçamento, entre o n.º do
 * documento e o assunto: é o cabimento a que a despesa vai, e a aplicação não
 * o sabe.
 */
function tabelaIdentificacao(data: string, assunto: string, comOrcamento: boolean): string {
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
    "</w:tr>" +
    (comOrcamento
      ? "<w:tr>" +
        `<w:tc><w:tcPr><w:tcW w:w="4455" w:type="dxa"/></w:tcPr>` +
        campo("N.º orçamento:", [marcador("n.º de orçamento")]) +
        "</w:tc>" +
        `<w:tc><w:tcPr><w:tcW w:w="4901" w:type="dxa"/></w:tcPr>${vazio()}</w:tc>` +
        "</w:tr>"
      : "") +
    "<w:tr>" +
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

/**
 * Qual das duas informações se está a escrever.
 *
 * `plurianual` pede autorização para assumir encargos em anos futuros;
 * `manifestacao` dá conta de uma necessidade cuja despesa cabe num ano só.
 */
export type Variante = "plurianual" | "manifestacao";

/**
 * As rates dos concursos anteriores que fundamentam os valores hora usados.
 *
 * É um quadro de referência da organização, e não algo que a aplicação apure:
 * vem dos procedimentos já realizados, e atualiza-se aqui quando houver mais.
 */
const RATES_DE_REFERENCIA: Array<{
  perfil: string;
  procedimentos: string[];
  propostas: string;
  base: string;
  media: string;
  diferenca: string;
}> = [
  {
    perfil: "Analista Funcional",
    procedimentos: ["20260065", "20260066", "20260080"],
    propostas: "28",
    base: "54,10 €/h",
    media: "26,22 €/h",
    diferenca: "52%",
  },
  { perfil: "Arquiteto de Sistemas", procedimentos: ["20260080"], propostas: "4", base: "59,51 €/h", media: "47,31 €/h", diferenca: "20%" },
  { perfil: "Backend — Java data access", procedimentos: ["20260065"], propostas: "6", base: "54,10 €/h", media: "29,29 €/h", diferenca: "46%" },
  { perfil: "Backend — System Integration", procedimentos: ["20260080"], propostas: "4", base: "54,10 €/h", media: "27,30 €/h", diferenca: "50%" },
  {
    perfil: "Consultor de Administração de Sistemas e Observabilidade",
    procedimentos: ["20260081"],
    propostas: "1",
    base: "54,10 €/h",
    media: "28,12 €/h",
    diferenca: "48%",
  },
  { perfil: "Frontend", procedimentos: ["20260081"], propostas: "7", base: "54,10 €/h", media: "27,50 €/h", diferenca: "49%" },
  {
    perfil: "Tester",
    procedimentos: ["20260065", "20260066", "20260080", "20260081"],
    propostas: "23",
    base: "27,05 €/h",
    media: "22,60 €/h",
    diferenca: "16%",
  },
  { perfil: "UX-UI Designer", procedimentos: ["20260066"], propostas: "13", base: "54,10 €/h", media: "27,64 €/h", diferenca: "49%" },
  { perfil: "Gestor de Projeto", procedimentos: ["20230160"], propostas: "6", base: "40,50 €/h", media: "34,13 €/h", diferenca: "16%" },
  { perfil: "Developer de Integração", procedimentos: ["20230160"], propostas: "4", base: "35,14 €/h", media: "30,08 €/h", diferenca: "14%" },
];

/**
 * O quadro das rates de referência.
 *
 * Seis colunas numa página de retrato: sai a 8 pt, como a dos anos, e os
 * números de procedimento vão um por linha dentro da célula — lado a lado
 * partiam-se a meio do número.
 */
function tabelaDeRates(): string {
  return tabela(
    [
      { titulo: "Perfil", peso: 24 },
      { titulo: "Procedimento(s)", peso: 13 },
      { titulo: "N.º propostas admitidas", alinhamento: "direita", peso: 12 },
      { titulo: "Rate do valor base do procedimento (€/h)", alinhamento: "direita", peso: 17 },
      { titulo: "Rate média das propostas (€/h)", alinhamento: "direita", peso: 17 },
      { titulo: "Diferença da rate média para valor base", alinhamento: "direita", peso: 17 },
    ],
    RATES_DE_REFERENCIA.map((r) => [
      r.perfil,
      { linhas: r.procedimentos },
      r.propostas,
      r.base,
      r.media,
      r.diferenca,
    ]),
    { sz: ANOS },
  );
}

/** As duas frases da conclusão da manifestação que fixam o tipo de procedimento. */
const OPCOES_DE_PROCEDIMENTO: Array<{ opcao: string; sim: boolean; sufixo?: string }> = [
  { opcao: "Concurso Público", sim: true },
  {
    opcao:
      "Acordo Quadro para Prestação de Serviços de Consultadoria em Tecnologias de Informação e " +
      "Comunicação (TIC)",
    sim: false,
    sufixo: "Identifique o lote ____",
  },
];

const VAZIA = "\u25a1";

/** O que fica por fazer depois da autorização — igual nas duas informações. */
const REMESSA =
  "Caso seja superiormente autorizado deverá a presente informação ser remetida à Direção de Administração " +
  "Geral, por forma a instruir os respetivos processos inerentes à contratação, mediante o disposto no anexo " +
  "técnico da presente informação.";

/** O avanço das linhas de escolha: um tabulador do Word, 1,25 cm. */
const TABULACAO = 709;

/**
 * Uma linha de escolha da conclusão: a opção, e o NÃO/SIM já assinalado.
 *
 * Avançada um tabulador em relação ao texto corrido, para se ler como resposta
 * à pergunta que a antecede e não como mais um parágrafo. O avanço vale também
 * para as linhas seguintes de uma opção que não caiba numa só, ou a segunda
 * linha voltaria à margem e desfazia o bloco.
 *
 * Alinhada à esquerda e não justificada — justificar esticaria os espaços entre
 * «NÃO», a caixa e o «SIM» até a linha deixar de se ler como um par de opções.
 */
function escolha({ opcao, sim, sufixo }: { opcao: string; sim: boolean; sufixo?: string }): string {
  const marca = (assinalado: boolean) => run(assinalado ? "X" : VAZIA, { negrito: true });
  return paragrafo(
    [
      run(`${opcao}   NÃO   `),
      marca(!sim),
      run("   SIM   "),
      marca(sim),
      ...(sufixo === undefined ? [] : [run(`   ${sufixo}`)]),
    ],
    { jc: "left", antes: 60, depois: 60, ind: TABULACAO },
  );
}

/** O corpo completo do documento, em XML. */
export function corpoDaInformacao(
  config: LotesJSON,
  modelo: string,
  quando: Date,
  variante: Variante = "plurianual",
): string {
  const manifestacao = variante === "manifestacao";
  const projeto = config.nomeProjeto.trim() === "" ? "(projeto sem nome)" : config.nomeProjeto.trim();
  // O assunto identifica o procedimento, e não o projeto: é o procedimento que
  // dá entrada no circuito de decisão. Sem nome de procedimento — que é
  // derivado do do projeto — cai no do projeto, que é o que há.
  const procedimento = config.nomeProcedimento.trim() === "" ? projeto : config.nomeProcedimento.trim();
  const descricao = config.descricaoProjeto.trim();
  const anos = anosPlurianuais(config.encargosPlurianuais.anoInicio);
  /** O triénio, como se escreve no assunto e nos títulos: 2026-2028. */
  const trienio = `${anos[0]}-${anos[anos.length - 1]}`;
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
      manifestacao
        ? `Manifestação de necessidades para ${procedimento}.`
        : `${procedimento} para o triénio ${trienio}.`,
      manifestacao,
    ),
  );

  p.push(titulo("I – Enquadramento"));
  p.push(
    paragrafo(
      "O Regulamento Interno aprovado por Deliberação do Conselho de Administração da SPMS, E.P.E. em " +
        "25/09/2025, clarifica as várias atribuições que estão adstritas à Direção de Arquitetura, Negócio e " +
        "Análise de Dados bem como à Coordenação de Planeamento, Arquitetura, Conformidade e Engenharia.",
    ),
  );
  p.push(
    paragrafo([
      run("Assim, no âmbito destas atribuições insere-se o Projeto "),
      run(projeto, { negrito: true }),
      run(". Este projeto visa "),
      descricao === "" ? marcador("descrição do projeto") : run(descricao),
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

  if (manifestacao) {
    // Sem encargos plurianuais não há histórico de procedimentos a enquadrar: a
    // análise é só o que se vai gastar, e passa a ser o ponto 2.1.
    p.push(titulo("2.1. Encargos previstos", 2));
    p.push(
      paragrafo(
        "Para realizar os objetivos preconizados e face à inexistência de recursos internos na SPMS que possam " +
          "desenvolver as atividades importa adquirir serviços na área dos sistemas de informação, através de " +
          "Bolsa de Horas nos termos que se expõem. Os valores hora apresentados foram apurados através do valor " +
          "médio das propostas obtidas no último concurso público realizado pela SPMS, E.P.E. para adquirir " +
          "serviços desta natureza.",
      ),
    );
    p.push(tabelaDoBloco(tabelaPrecoBase(config)));
  } else {
    p.push(titulo("2.1. Encargos com o projeto planeados para o ano corrente/transato", 2));
    p.push(paragrafo("Para assegurar estes serviços foram desenvolvidos os seguintes procedimentos:"));
    p.push(
      paragrafo(
        [
          marcador(
            "tabela dos procedimentos do ano corrente/transato: n.º de procedimento, objeto, adjudicatário e valor",
          ),
        ],
        { jc: "left" },
      ),
    );
    p.push(titulo(`2.2. Encargos previstos para o triénio ${trienio}`, 2));

    // Os parágrafos de enquadramento e a tabela são os mesmos que a aplicação
    // produz no seu próprio Word: uma fonte só, para não divergirem.
    for (const bloco of blocosEncargosPlurianuais(config)) {
      if (bloco.tipo === "paragrafo" && bloco.texto.startsWith("O preço base")) continue;
      if (bloco.tipo === "titulo") continue;
      if (bloco.tipo === "tabela") {
        p.push(tabelaPlurianual(bloco));
        continue;
      }
      p.push(renderizarNoCorpo(bloco));
    }
  }

  // A negrito: é o número que se procura ao folhear a informação.
  p.push(
    paragrafo([
      run(
        `O preço base do procedimento é de ${formatarMoeda(total.semIva)}, sem IVA, correspondendo a ` +
          `${formatarMoeda(total.comIva)} com IVA à taxa legal em vigor.`,
        { negrito: true },
      ),
    ]),
  );

  // A justificação das rates vem a seguir ao preço base, e não antes do quadro
  // dos anos: é o preço base que ela fundamenta.
  if (!manifestacao) {
    p.push(
      paragrafo(
        "Os valores hora foram apurados através do valor médio das propostas obtidas nos últimos concursos " +
          "realizados pela SPMS, E.P.E. para adquirir serviços de natureza equivalente, mediante a seguinte tabela:",
      ),
    );
    p.push(tabelaDeRates());
  }

  // A divisão por lotes é o que se adjudica: fecha a análise, depois de o preço
  // base do procedimento estar fixado.
  p.push(titulo(manifestacao ? "2.2. Divisão por lotes" : "2.3. Divisão por lotes", 2));
  for (const bloco of blocosDivisaoPorLotes(config)) p.push(renderizarNoCorpo(bloco));

  p.push(titulo("III – Conclusão"));
  if (manifestacao) {
    p.push(
      paragrafo(
        "Assim solicita-se autorização para proceder à aquisição da prestação de serviços nos termos supra " +
          "expostos, ao abrigo de:",
      ),
    );
    for (const opcao of OPCOES_DE_PROCEDIMENTO) p.push(escolha(opcao));
  } else {
    p.push(
      paragrafo(
        "Atentos os factos supra elencados, torna-se necessário desencadear os procedimentos necessários para " +
          "obter a autorização para assunção de encargos plurianuais nos termos constantes no quadro supra.",
      ),
    );
  }
  // A frase de fecho é a mesma nas duas: o que segue para a Direção de
  // Administração Geral é o mesmo processo, seja o que o precede um pedido ou
  // uma manifestação.
  p.push(paragrafo(REMESSA));
  p.push(vazio(240));
  p.push(paragrafo("À consideração superior,", { jc: "left", depois: 240 }));
  p.push(herdado(assinatura));

  p.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
  p.push(titulo("IV – Anexo Técnico"));
  for (const bloco of blocosAnexoTecnico(config)) p.push(renderizar(bloco));

  return p.join("");
}

/** No corpo da informação os parágrafos saem tal e qual; os títulos ficam de fora. */
function renderizarNoCorpo(bloco: BlocoDocumento): string {
  if (bloco.tipo !== "paragrafo") return renderizar(bloco);
  return paragrafo([run(bloco.texto, { negrito: bloco.destaque })]);
}

// --------------------------------------------------------------------------
// Montagem do ficheiro
// --------------------------------------------------------------------------

const CAMINHO_DOCUMENTO = "word/document.xml";

async function gerarInformacaoBlob(config: LotesJSON, quando: Date, variante: Variante): Promise<Blob> {
  const zip = await JSZip.loadAsync(modeloBase64, { base64: true });
  const modelo = await zip.file(CAMINHO_DOCUMENTO)!.async("string");

  const sect = entre(modelo, "<w:sectPr", "</w:sectPr>");
  const corpo = corpoDaInformacao(config, modelo, quando, variante) + sect;
  const inicio = modelo.indexOf("<w:body>") + "<w:body>".length;
  const fim = modelo.lastIndexOf("</w:body>");

  zip.file(CAMINHO_DOCUMENTO, modelo.slice(0, inicio) + corpo + modelo.slice(fim));
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export function gerarPedidoPlurianualBlob(config: LotesJSON, quando = new Date()): Promise<Blob> {
  return gerarInformacaoBlob(config, quando, "plurianual");
}

export function gerarManifestacaoNecessidadesBlob(config: LotesJSON, quando = new Date()): Promise<Blob> {
  return gerarInformacaoBlob(config, quando, "manifestacao");
}
