// A manifestação de necessidades no modelo da DAG (CCP, setembro de 2026).
//
// Parte do modelo Word fornecido pela organização — cabeçalho, rodapé
// numerado, caixa de parecer, estilos — e reconstrói o corpo com o conteúdo
// que a aplicação já sabe produzir, pela estrutura do modelo: dez secções com
// os parágrafos numerados em série, a conclusão em proposta de deliberação, e
// os anexos (memória de cálculo, especificações técnicas, resumos curriculares
// e as duas folhas do eAvalia).
//
// As tabelas são as da aplicação, e não as do modelo: o quadro do preço base,
// o da divisão por lotes, os dos requisitos e o do posto de trabalho saem como
// saíam na informação anterior, só no tipo de letra do novo modelo.
//
// A numeração sai por extenso, e não de `numbering.xml`: os números ficam no
// texto, iguais em qualquer leitor e no PDF desenhado a partir deste Word.

import JSZip from "jszip";
import type { BlocoDocumento, Coluna } from "../core/documento";
import { alineasDoItem, escalaDasImagens, marcaDeAlinea, partesDoParagrafo, textoDoItem } from "../core/documento";
import type { LotesJSON } from "../core/types";
import { beneficiosDoProjeto } from "../core/justificacao";
import {
  blocosAnexoTecnico,
  blocosDivisaoPorLotes,
  blocosEncargosPlurianuais,
} from "../core/cadernoEncargos";
import {
  anosPlurianuais,
  formatarMoeda,
  formatarNumero,
  horasContratadas,
  horasPorAnoDe,
  totaisPorAnoPlurianual,
  totalProcedimento,
} from "../core/lotes";
import { conteudoFuncionalDoPerfil } from "../core/perfil";
import { anexoDosResumos, type ImagemDaFolha } from "../core/resumoCurricular";
import modeloBase64 from "./modelos/Manifestacao_Necessidades.docx?base64";
import modeloAnteriorBase64 from "./modelos/Pedido_Encargos_Plurianuais.docx?base64";
import { dataPorExtenso, RATES_DE_REFERENCIA, rodapeComLinhaUnica } from "./informacaoSpms";
import { gerarEavaliaBlob } from "../excel/eavalia";
import { lerFolhaDoAlinhamento } from "../excel/folhaDoAlinhamento";
import { paginasDoAlinhamento, type PaginaDaFolha } from "../excel/imagemDoAlinhamento";
import { lerFolhaDosCustos, numeroRomano, recursosDoProcedimento } from "../excel/custosServicos";

// --------------------------------------------------------------------------
// Os dados próprios da manifestação
// --------------------------------------------------------------------------

export interface QuestaoDeSustentabilidade {
  pergunta: string;
  resposta: boolean;
  justificacao: string;
}

/** O que a manifestação pede para lá do que o Módulo 1 e o Módulo 2 já têm. */
export interface DadosManifestacao {
  /** Objetivos da aquisição — enquadramento, n.º 1. */
  objetivos: string[];
  /** Margem prudencial, em percentagem. 0 exige justificação. */
  margemPrudencial: number;
  /** Fundamento da margem: com 0 %, porque não se aplica; acima, porque se aplica. */
  justificacaoMargem: string;
  beneficiarios: string;
  riscosExecucao: string;
  mitigacao: string;
  conclusaoCustoBeneficio: string;
  sustentabilidade: QuestaoDeSustentabilidade[];
  /** Só com um lote: porque não se divide. */
  justificacaoNaoDivisao: string;
  /** Serviços anteriores de natureza similar em que assenta o volume de horas. Facultativo. */
  servicosAnteriores: string;
  juri: { diretor: string; coordenador: string; gestorProjeto: string };
  /** A unidade (coordenação) do coordenador: assina, e integra o júri. */
  unidade: string;
}

export const DIRECAO = "Direção de Arquitetura, Negócio e Análise de Dados";

/** O fundamento da margem a 0 %, por omissão. */
export const JUSTIFICACAO_SEM_MARGEM =
  "Não foi aplicada margem prudencial autónoma ao valor estimado. Os valores unitários por hora considerados " +
  "correspondem à média das rates das propostas apresentadas nos últimos procedimentos aquisitivos de natureza " +
  "equivalente promovidos pela SPMS, E.P.E., refletindo, por isso, os preços efetivamente praticados no mercado e a " +
  "dispersão de valores entre concorrentes. Considera-se, assim, que a margem prudencial se encontra incorporada nos " +
  "valores unitários adotados, os quais asseguram, com razoabilidade, a suficiência do valor estimado para a " +
  "satisfação da necessidade identificada.";

/** O fundamento de uma margem acima de 0 %, por omissão. */
export function justificacaoComMargem(margem: number): string {
  return (
    `A margem prudencial de ${formatarNumero(margem)} % destina-se a acautelar a variação dos preços de mercado ao ` +
    "longo dos anos de execução do contrato, designadamente por efeito da inflação e da evolução das remunerações " +
    "dos perfis técnicos especializados, e é aplicada ao valor unitário por hora de cada perfil, refletindo-se em " +
    "todos os valores por perfil, por lote e por ano apresentados na presente informação."
  );
}

// --------------------------------------------------------------------------
// A margem prudencial
// --------------------------------------------------------------------------

function centimos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * O agrupamento com a margem já aplicada: o valor hora de cada perfil cresce
 * na percentagem da margem, arredondado ao cêntimo, e com ele tudo o que dele
 * decorre — o valor do perfil, do lote, de cada ano e do procedimento. É o
 * que faz os quadros todos baterem certo com o valor estimado.
 */
export function comMargemPrudencial(config: LotesJSON, margem: number): LotesJSON {
  if (!(margem > 0)) return config;
  return {
    ...config,
    lotes: config.lotes.map((lote) => ({
      ...lote,
      perfis: lote.perfis.map((entrada) => ({ ...entrada, valorHora: centimos(entrada.valorHora * (1 + margem / 100)) })),
    })),
  };
}

// --------------------------------------------------------------------------
// Tipografia
// --------------------------------------------------------------------------

const LETRA = "Calibri";
const CORPO = 22;
const TABELA = 18;
const ANOS = 16;
const POR_PREENCHER = "C00000";
const SUAVE = "595959";
const CINZA = "EDF1F5";
const LARGURA = 9356;
const RFONTS = `<w:rFonts w:ascii="${LETRA}" w:eastAsia="${LETRA}" w:hAnsi="${LETRA}" w:cs="${LETRA}"/>`;
const QUEBRA_DE_PAGINA = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

/** O recuo do texto numerado e o das alíneas, como no modelo. */
const RECUO = 720;
const RECUO_ALINEA = 1440;

function esc(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface OpcoesRun {
  negrito?: boolean;
  italico?: boolean;
  sz?: number;
  cor?: string;
  maiusculas?: boolean;
}

function run(texto: string, { negrito, italico, sz = CORPO, cor, maiusculas }: OpcoesRun = {}): string {
  let rpr = `<w:rPr>${RFONTS}`;
  if (negrito) rpr += "<w:b/>";
  if (italico) rpr += "<w:i/>";
  if (maiusculas) rpr += "<w:caps/>";
  if (cor) rpr += `<w:color w:val="${cor}"/>`;
  rpr += `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:lang w:val="pt-PT"/></w:rPr>`;
  return `<w:r>${rpr}<w:t xml:space="preserve">${esc(texto)}</w:t></w:r>`;
}

function tabulador(sz = CORPO): string {
  return `<w:r><w:rPr>${RFONTS}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:tab/></w:r>`;
}

function quebra(): string {
  return "<w:r><w:br/></w:r>";
}

function marcador(texto: string): string {
  return run(`[${texto}]`, { negrito: true, cor: POR_PREENCHER });
}

interface OpcoesParagrafo {
  jc?: "both" | "left" | "right" | "center";
  antes?: number;
  depois?: number;
  ind?: number;
  pendente?: number;
  comOSeguinte?: boolean;
  novaPagina?: boolean;
  entrelinha?: number;
}

function paragrafo(conteudo: string | string[], opcoes: OpcoesParagrafo = {}): string {
  const {
    jc = "both",
    antes = 0,
    depois = 160,
    ind = 0,
    pendente = 0,
    comOSeguinte = false,
    novaPagina = false,
    entrelinha = 300,
  } = opcoes;
  const runs = typeof conteudo === "string" ? [run(conteudo)] : conteudo;

  let ppr = '<w:pPr><w:pStyle w:val="Normal"/>';
  if (comOSeguinte) ppr += "<w:keepNext/>";
  if (novaPagina) ppr += "<w:pageBreakBefore/>";
  if (ind && pendente) ppr += `<w:tabs><w:tab w:val="left" w:pos="${ind}"/></w:tabs>`;
  ppr += `<w:spacing w:before="${antes}" w:after="${depois}" w:line="${entrelinha}" w:lineRule="auto"/>`;
  if (ind) ppr += pendente ? `<w:ind w:left="${ind}" w:hanging="${pendente}"/>` : `<w:ind w:left="${ind}"/>`;
  ppr += `<w:jc w:val="${jc}"/></w:pPr>`;
  return `<w:p>${ppr}${runs.join("")}</w:p>`;
}

function vazio(depois = 0): string {
  return (
    '<w:p><w:pPr><w:pStyle w:val="Normal"/>' +
    `<w:spacing w:before="0" w:after="${depois}" w:line="240" w:lineRule="auto"/></w:pPr></w:p>`
  );
}

/** «III.  VALOR ESTIMADO E MEMÓRIA DE CÁLCULO» — as secções do modelo. */
function seccao(numero: number, texto: string): string {
  return paragrafo([run(`${numeroRomano(numero)}.`, { negrito: true }), tabulador(), run(texto.toUpperCase(), { negrito: true })], {
    jc: "left",
    antes: 360,
    depois: 160,
    ind: RECUO,
    pendente: RECUO,
    comOSeguinte: true,
  });
}

/** Um título dentro de um anexo, a negrito. */
function subtitulo(texto: string, nivel: 1 | 2 = 1): string {
  return paragrafo([run(texto, { negrito: true, italico: nivel === 2, sz: nivel === 1 ? CORPO : TABELA + 2 })], {
    jc: "left",
    antes: nivel === 1 ? 240 : 160,
    depois: 120,
    comOSeguinte: true,
  });
}

/** Um ponto numerado: «6.  Para efeitos dos artigos 17.º …». */
function numerado(marca: string, conteudo: string | string[], opcoes: OpcoesParagrafo = {}): string {
  const runs = typeof conteudo === "string" ? [run(conteudo)] : conteudo;
  return paragrafo([run(marca), tabulador(), ...runs], { ind: RECUO, pendente: 360, ...opcoes });
}

/** Uma alínea, um degrau abaixo do ponto: «a.  …». */
function alinea(marca: string, conteudo: string | string[], ind = RECUO_ALINEA): string {
  const runs = typeof conteudo === "string" ? [run(conteudo)] : conteudo;
  return paragrafo([run(marca), tabulador(), ...runs], { ind, pendente: 360, depois: 80 });
}

/** Texto alinhado com o texto dos pontos numerados, sem número. */
function recuado(conteudo: string | string[], opcoes: OpcoesParagrafo = {}): string {
  return paragrafo(conteudo, { ind: RECUO, ...opcoes });
}

/** «a., b., c.» — e o último com ponto final, os outros com ponto e vírgula. */
function comPontuacao(itens: string[]): string[] {
  return itens.map((item, i) => {
    const limpo = item.trim().replace(/[.;]+$/, "");
    return `${limpo}${i === itens.length - 1 ? "." : ";"}`;
  });
}

function letra(i: number): string {
  return String.fromCharCode(97 + i);
}

// --------------------------------------------------------------------------
// Tabelas (a estrutura da aplicação, no tipo de letra do modelo)
// --------------------------------------------------------------------------

type LinhaDeCelula = string | { texto: string; suave: string } | { linhas: string[] };

function conteudoEmRuns(conteudo: LinhaDeCelula, cabecalho: boolean, sz: number, negrito: boolean): string[] {
  const forte = cabecalho || negrito;
  if (typeof conteudo === "string") return [run(conteudo, { negrito: forte, sz })];
  if ("linhas" in conteudo) {
    return conteudo.linhas.flatMap((l, i) =>
      i === 0 ? [run(l, { negrito: forte, sz })] : [quebra(), run(l, { negrito: forte, sz })],
    );
  }
  return [run(conteudo.texto, { negrito: forte, sz }), quebra(), run(conteudo.suave, { sz: sz - 2, cor: SUAVE })];
}

function celula(
  conteudo: LinhaDeCelula,
  largura: number,
  { cabecalho = false, direita = false, sz = TABELA, negrito = false } = {},
): string {
  const sombra = cabecalho ? `<w:shd w:val="clear" w:color="auto" w:fill="${CINZA}"/>` : "";
  return (
    `<w:tc><w:tcPr><w:tcW w:w="${largura}" w:type="dxa"/>${sombra}<w:vAlign w:val="center"/></w:tcPr>` +
    paragrafo(conteudoEmRuns(conteudo, cabecalho, sz, negrito), {
      jc: direita ? "right" : "left",
      antes: 40,
      depois: 40,
      entrelinha: 240,
      // O cabeçalho nunca fica sozinho no fundo de uma página.
      comOSeguinte: cabecalho,
    }) +
    "</w:tc>"
  );
}

function tabela(
  colunas: Coluna[],
  linhas: LinhaDeCelula[][],
  { legenda, sz = TABELA, destaques = [] as boolean[] }: { legenda?: string; sz?: number; destaques?: boolean[] } = {},
): string {
  const pesos = colunas.map((c) => c.peso ?? 100 / colunas.length);
  const total = pesos.reduce((s, p) => s + p, 0);
  const larguras = pesos.map((p) => Math.round((LARGURA * p) / total));
  larguras[larguras.length - 1] += LARGURA - larguras.reduce((s, w) => s + w, 0);
  const bordas = ["top", "left", "bottom", "right", "insideH", "insideV"]
    .map((lado) => `<w:${lado} w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>`)
    .join("");

  let xml =
    "<w:tbl><w:tblPr>" +
    `<w:tblW w:w="${LARGURA}" w:type="dxa"/><w:tblBorders>${bordas}</w:tblBorders>` +
    '<w:tblLayout w:type="fixed"/>' +
    '<w:tblCellMar><w:left w:w="85" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar>' +
    "</w:tblPr><w:tblGrid>" +
    larguras.map((w) => `<w:gridCol w:w="${w}"/>`).join("") +
    "</w:tblGrid>" +
    "<w:tr><w:trPr><w:tblHeader/></w:trPr>" +
    colunas
      .map((c, i) => celula(c.titulo, larguras[i], { cabecalho: true, sz, direita: c.alinhamento === "direita" }))
      .join("") +
    "</w:tr>";
  linhas.forEach((linha, r) => {
    xml +=
      "<w:tr>" +
      linha
        .map((c, i) =>
          celula(c, larguras[i], { sz, direita: colunas[i]?.alinhamento === "direita", negrito: destaques[r] === true }),
        )
        .join("") +
      "</w:tr>";
  });
  xml += "</w:tbl>";
  return (
    xml +
    (legenda
      ? paragrafo([run(legenda, { italico: true, sz: TABELA })], { jc: "left", antes: 60, depois: 200, entrelinha: 240 })
      : vazio(160))
  );
}

function tabelaDoBloco(bloco: Extract<BlocoDocumento, { tipo: "tabela" }>, sz = TABELA): string {
  return tabela(
    bloco.colunas,
    bloco.linhas.map((l) => l.map((c) => c.texto)),
    { legenda: bloco.legenda, sz, destaques: bloco.linhas.map((l) => l.some((c) => c.destaque === true)) },
  );
}

/**
 * O quadro dos anos, com as horas por baixo do valor: são oito colunas numa
 * página de retrato, e «181 843,20 € (1760 h)» numa linha só partia-se em três.
 */
function tabelaPlurianual(bloco: Extract<BlocoDocumento, { tipo: "tabela" }>): string {
  const folga: Record<string, number> = { Perfil: 21, Lotes: 8 };
  const colunas = bloco.colunas.map((c) => ({ ...c, peso: folga[c.titulo] ?? c.peso }));
  const linhas = bloco.linhas.map((linha) =>
    linha.map((c): LinhaDeCelula => {
      const m = /^(.+?) \((\d[\d\s]*) h\)$/.exec(c.texto);
      return m === null ? c.texto : { texto: m[1], suave: `${m[2]} h` };
    }),
  );
  return tabela(colunas, linhas, {
    legenda: bloco.legenda,
    sz: ANOS,
    destaques: bloco.linhas.map((l) => l.some((c) => c.destaque === true)),
  });
}

function lista(bloco: Extract<BlocoDocumento, { tipo: "lista" }>, ind = RECUO): string {
  return bloco.itens
    .map((item, i) => {
      const marca = bloco.numerada ? `${i + 1}.` : "•";
      return (
        paragrafo([run(marca), tabulador(), run(textoDoItem(item))], { ind, pendente: 360, depois: 80 }) +
        alineasDoItem(item)
          .map((texto, j) => paragrafo([run(marcaDeAlinea(j)), tabulador(), run(texto)], { ind: ind + 504, pendente: 504, depois: 80 }))
          .join("")
      );
    })
    .join("");
}

/** Os blocos da aplicação, no corpo da manifestação. Os títulos descem a subtítulos. */
function renderizar(bloco: BlocoDocumento): string {
  switch (bloco.tipo) {
    case "titulo":
      return subtitulo(bloco.texto, bloco.nivel === 1 ? 1 : 2);
    case "paragrafo":
      return paragrafo(partesDoParagrafo(bloco).map((p) => run(p.texto, { negrito: p.destaque })));
    case "nota":
      return paragrafo([run(bloco.texto, { italico: true, sz: TABELA })], { jc: "left" });
    case "lista":
      return lista(bloco);
    case "tabela":
      return tabelaDoBloco(bloco);
    case "quebraDePagina":
      return QUEBRA_DE_PAGINA;
    case "imagem":
      throw new Error("Uma imagem não se desenha no corpo.");
  }
}

// --------------------------------------------------------------------------
// Blocos herdados dos modelos
// --------------------------------------------------------------------------

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

function soCalibri(xml: string): string {
  return xml
    .replace(/<w:rFonts[^/]*\/>/g, RFONTS)
    .replace(/<w:rPr>(?!<w:rFonts)/g, `<w:rPr>${RFONTS}`)
    .replace(/<w:pStyle w:val="Normal0"\/>/g, '<w:pStyle w:val="Normal"/>');
}

function juntoAoSeguinte(xml: string): string {
  const total = [...xml.matchAll(/<w:pPr>/g)].length;
  let n = 0;
  return xml.replace(/<w:pPr>(<w:pStyle [^>]*\/>)?/g, (inteiro, estilo: string | undefined) => {
    n += 1;
    if (n === total || inteiro.includes("keepNext")) return inteiro;
    return `<w:pPr>${estilo ?? ""}<w:keepNext/>`;
  });
}

function entre(texto: string, abre: string, fecha: string): string {
  const i = texto.indexOf(abre);
  return texto.slice(i, texto.indexOf(fecha, i) + fecha.length);
}

/**
 * O bloco de assinatura da informação anterior, com quem assina: o coordenador
 * indicado no júri, por cima de «(Coordenador)», e a unidade por baixo da
 * direção.
 */
function assinatura(modeloAnterior: string, dados: DadosManifestacao): string {
  const i = modeloAnterior.lastIndexOf("<w:tbl>");
  const tabelaAnterior = modeloAnterior.slice(i, modeloAnterior.indexOf("</w:tbl>", i) + "</w:tbl>".length);
  const nome = dados.juri.coordenador.trim();
  const unidade = dados.unidade.trim();
  return soCalibri(semCampos(tabelaAnterior))
    .replace(/<w:t>Filipe Mealha<\/w:t>/, `<w:t xml:space="preserve">${esc(nome === "" ? "[nome do coordenador]" : nome)}</w:t>`)
    .replace(
      /<w:t xml:space="preserve">Unidade de Planeamento,[^<]*<\/w:t>/,
      `<w:t xml:space="preserve">${esc(unidade === "" ? "[unidade]" : unidade)}</w:t>`,
    );
}

/** N.º, Data, N.º orçamento e Assunto. */
function tabelaIdentificacao(numero: string, data: string, assunto: string): string {
  const campo = (rotulo: string, valor: string[]): string =>
    paragrafo([run(rotulo, { sz: TABELA }), tabulador(TABELA), ...valor], { jc: "left", depois: 80 });
  const semBordas =
    '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/>' +
    '<w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>';
  const linha = (a: string, b: string) =>
    `<w:tr><w:tc><w:tcPr><w:tcW w:w="4455" w:type="dxa"/></w:tcPr>${a}</w:tc>` +
    `<w:tc><w:tcPr><w:tcW w:w="4901" w:type="dxa"/></w:tcPr>${b}</w:tc></w:tr>`;
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${LARGURA}" w:type="dxa"/>${semBordas}<w:tblLayout w:type="fixed"/>` +
    '<w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
    '<w:tblGrid><w:gridCol w:w="4455"/><w:gridCol w:w="4901"/></w:tblGrid>' +
    linha(
      campo("N.º:", [numero === "" ? marcador("n.º do documento") : run(numero, { negrito: true, sz: TABELA })]),
      campo("Data:", [run(data, { negrito: true, sz: TABELA })]),
    ) +
    linha(campo("N.º orçamento:", [marcador("n.º de orçamento")]), vazio()) +
    `<w:tr><w:tc><w:tcPr><w:tcW w:w="${LARGURA}" w:type="dxa"/><w:gridSpan w:val="2"/></w:tcPr>` +
    campo("Assunto:", [run(assunto, { negrito: true, sz: TABELA })]) +
    "</w:tc></w:tr></w:tbl>"
  );
}

// --------------------------------------------------------------------------
// Os números
// --------------------------------------------------------------------------

interface Numeros {
  anos: number[];
  meses: number;
  horasPorAno: number[];
  horasTotal: number;
  /** Sem IVA, sem margem. */
  referencia: number;
  /** Sem IVA, com margem: o valor estimado do contrato. */
  estimado: number;
  estimadoComIva: number;
  porAno: number[];
  perfis: number;
  lotes: number;
}

function numeros(original: LotesJSON, config: LotesJSON): Numeros {
  const anos = anosPlurianuais(config.encargosPlurianuais.anoInicio);
  const entradas = config.lotes.flatMap((l) => l.perfis);
  const horasPorAno = anos.map((_, i) => entradas.reduce((s, e) => s + e.nMinimoElementos * horasPorAnoDe(e, true)[i], 0));
  const iva = totalProcedimento(config);
  // O valor de cada ano, sem IVA: a tabela dos anos da aplicação dá-o com IVA.
  const taxa = 1 + (config.taxaIva ?? 23) / 100;
  return {
    anos,
    meses: anos.length * 12,
    horasPorAno,
    horasTotal: horasPorAno.reduce((s, h) => s + h, 0),
    referencia: totalProcedimento(original).semIva,
    estimado: iva.semIva,
    estimadoComIva: iva.comIva,
    porAno: totaisPorAnoPlurianual(config).map((v) => centimos(v / taxa)),
    perfis: new Set(entradas.map((e) => e.perfil.id)).size,
    lotes: config.lotes.length,
  };
}

function enumerar(itens: string[]): string {
  return itens.length <= 1 ? itens.join("") : `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/** «a prestação de serviços de desenvolvimento e manutenção …», a partir do nome do procedimento. */
function objetoDaAquisicao(config: LotesJSON): string {
  const nome = (config.nomeProcedimento.trim() || `Aquisição de serviços para o projeto ${config.nomeProjeto}`).replace(
    /^aquisição de\s+/i,
    "",
  );
  const minusculo = nome.charAt(0).toLowerCase() + nome.slice(1);
  return `${minusculo}${/projeto/i.test(nome) ? "" : ` do projeto ${config.nomeProjeto.trim()}`}`;
}

// --------------------------------------------------------------------------
// O corpo
// --------------------------------------------------------------------------

function corpo(
  original: LotesJSON,
  config: LotesJSON,
  dados: DadosManifestacao,
  modelo: string,
  modeloAnterior: string,
  quando: Date,
  imagens: ImagemDaFolha[],
): string {
  const n = numeros(original, config);
  const objeto = objetoDaAquisicao(config);
  const projeto = config.nomeProjeto.trim();
  const margem = dados.margemPrudencial > 0 ? dados.margemPrudencial : 0;
  const justificacaoMargem =
    dados.justificacaoMargem.trim() || (margem > 0 ? justificacaoComMargem(margem) : JUSTIFICACAO_SEM_MARGEM);
  const periodo = `1 de janeiro de ${n.anos[0]} a 31 de dezembro de ${n.anos[n.anos.length - 1]}`;
  const temResumos = anexoDosResumos(config, imagens).corpo.length > 0;

  const p: string[] = [];
  let ponto = 0;
  const proximo = () => `${++ponto}.`;

  // A caixa de parecer do modelo, e a identificação.
  p.push(soCalibri(entre(modelo.slice(modelo.indexOf("<w:body>")), "<w:tbl>", "</w:tbl>")));
  p.push(vazio(240));
  p.push(
    tabelaIdentificacao(
      config.numeroInformacao.trim(),
      dataPorExtenso(quando),
      `MANIFESTAÇÃO DE NECESSIDADES PARA A AQUISIÇÃO DE ${objeto.toUpperCase()}`,
    ),
  );

  // I. Enquadramento
  p.push(seccao(1, "Enquadramento"));
  p.push(
    numerado(proximo(), [
      run(`A presente informação visa concretizar o pedido de aquisição de ${objeto}, que possibilitará atingir os seguintes objetivos:`),
    ]),
  );
  const objetivos = dados.objetivos.filter((o) => o.trim() !== "");
  if (objetivos.length === 0) p.push(alinea("a.", [marcador("objetivos da aquisição")]));
  else comPontuacao(objetivos).forEach((o, i) => p.push(alinea(`${letra(i)}.`, o)));

  // II. Identificação da necessidade
  p.push(seccao(2, "Identificação clara, objetiva e funcional da necessidade"));
  p.push(
    numerado(
      proximo(),
      "Para efeitos do artigo 35.º-D do Código dos Contratos Públicos, na redação conferida pelo Decreto-Lei n.º " +
        `177/2026, de 4 de setembro, a necessidade a satisfazer consiste em assegurar, durante ${n.meses} meses, ` +
        `a prestação de ${objeto}, na modalidade de Bolsa de Horas.`,
    ),
  );
  p.push(
    numerado(
      proximo(),
      "A presente necessidade foi objeto de análise funcional prévia, tendo-se concluído que corresponde a uma " +
        "necessidade efetiva, atual e devidamente identificada, não sendo suscetível de satisfação através de " +
        "recursos próprios da SPMS.",
    ),
  );
  p.push(numerado(proximo(), "A presente aquisição comporta os seguintes benefícios:", { depois: 80 }));
  comPontuacao(beneficiosDoProjeto(config.justificacao).map((b) => b.designacao)).forEach((b, i) =>
    p.push(alinea(`${letra(i)}.`, b)),
  );
  p.push(numerado(proximo(), "Concluindo assim que a necessidade visa:", { depois: 80, antes: 80 }));
  const descricao = config.descricaoProjeto.trim();
  p.push(
    alinea(
      "a.",
      descricao === ""
        ? [marcador("descrição do projeto")]
        : `${descricao.charAt(0).toUpperCase()}${descricao.slice(1).replace(/[.;]+$/, "")}.`,
    ),
  );

  // III. Valor estimado
  p.push(seccao(3, "Valor estimado e memória de cálculo"));
  p.push(
    numerado(proximo(), [
      run("Para efeitos dos artigos 17.º e 17.º-B do CCP, o valor estimado do contrato corresponde a "),
      run(formatarMoeda(n.estimado), { negrito: true }),
      run(
        ", sem IVA, determinado com base em critérios económicos objetivos, designadamente o número de horas " +
          `estimado e o custo unitário médio apurado${
            margem > 0 ? `, acrescido de uma margem prudencial de ${formatarNumero(margem)} %` : ""
          }, nos termos da memória descritiva e de cálculo constante do Anexo I.`,
      ),
    ]),
  );
  p.push(numerado(proximo(), justificacaoMargem));
  const linhasCalculo: string[][] = [
    ["Número total de horas estimado", `${formatarNumero(n.horasTotal)} h`],
    ["Custo unitário médio ponderado (s/ IVA)", `${formatarMoeda(n.horasTotal === 0 ? 0 : n.referencia / n.horasTotal)}/h`],
    ["Custo de referência (s/ IVA)", formatarMoeda(n.referencia)],
    [
      "Margem prudencial",
      margem > 0
        ? `${formatarNumero(margem)} % (${formatarMoeda(n.estimado - n.referencia)})`
        : "0 % (incorporada nos valores unitários)",
    ],
    ["Valor estimado do contrato (s/ IVA)", formatarMoeda(n.estimado)],
    [`Valor estimado do contrato (c/ IVA a ${config.taxaIva} %)`, formatarMoeda(n.estimadoComIva)],
  ];
  p.push(
    tabela(
      [
        { titulo: "Elemento de cálculo", peso: 60 },
        { titulo: "Valor", alinhamento: "direita", peso: 40 },
      ],
      linhasCalculo,
      { destaques: linhasCalculo.map((_, i) => i === 4) },
    ),
  );
  if (n.estimado >= 5_000_000) {
    p.push(recuado([marcador("valor igual ou superior a 5 M€: juntar o Anexo II – Fundamentação de valor superior a 5 M€")]));
  }

  // IV. Avaliação custo-benefício
  p.push(seccao(4, "Avaliação custo-benefício"));
  p.push(
    paragrafo("Atento o valor estimado e para efeitos do artigo 36.º do CCP, apresenta-se a seguinte avaliação custo-benefício:"),
  );
  const horasAno = enumerar(n.anos.map((ano, i) => `${formatarNumero(n.horasPorAno[i])} horas em ${ano}`));
  const anoMaximo = Math.max(...n.porAno);
  const beneficiosOperacionais = beneficiosDoProjeto(config.justificacao)
    .map((b) => b.designacao.trim().replace(/^Permitirá\s+/i, "").replace(/[.;]+$/, ""))
    .map((b) => b.charAt(0).toLowerCase() + b.slice(1));
  const criterios: Array<[string, string]> = [
    ["Beneficiários", dados.beneficiarios],
    [
      "Utilização prevista",
      `bolsa de ${formatarNumero(n.horasTotal)} horas (${horasAno}), repartidas por ${n.perfis} ${
        n.perfis === 1 ? "perfil" : "perfis"
      } e ${n.lotes} ${n.lotes === 1 ? "lote" : "lotes"}, a consumir em função das necessidades efetivas do projeto.`,
    ],
    ["Benefícios operacionais", `${beneficiosOperacionais.join("; ")}.`],
    [
      "Custos",
      `encargo anual máximo de ${formatarMoeda(anoMaximo)}, sem IVA, e encargo máximo global de ${formatarMoeda(
        n.estimado,
      )}, sem IVA.`,
    ],
    ["Riscos", dados.riscosExecucao],
    ["Mitigação", dados.mitigacao],
  ];
  criterios.forEach(([rotulo, texto], i) =>
    p.push(
      alinea(`${letra(i)})`, [run(`${rotulo}: `), texto.trim() === "" ? marcador(rotulo.toLowerCase()) : run(texto.trim())], RECUO),
    ),
  );
  p.push(paragrafo(dados.conclusaoCustoBeneficio, { antes: 120 }));

  // V. Sustentabilidade
  p.push(seccao(5, "Sustentabilidade e contratação estratégica"));
  dados.sustentabilidade.forEach((q, i) =>
    p.push(
      alinea(
        `${letra(i)})`,
        [
          run(`${q.pergunta} `),
          run(q.resposta ? "Sim." : "Não.", { negrito: true }),
          run(" "),
          q.justificacao.trim() === "" ? marcador("justificação") : run(q.justificacao.trim()),
        ],
        RECUO,
      ),
    ),
  );

  // VI. Divisão em lotes — o texto da aplicação.
  p.push(seccao(6, "Divisão em lotes"));
  if (config.lotes.length <= 1) {
    p.push(paragrafo(dados.justificacaoNaoDivisao));
  } else {
    p.push(paragrafo("O procedimento é configurado por lotes, nos seguintes termos:", { depois: 80 }));
    config.lotes.forEach((lote) =>
      p.push(recuado(`O Lote ${lote.numero} corresponde a ${lote.designacao.trim()}.`, { depois: 80 })),
    );
  }
  for (const bloco of blocosDivisaoPorLotes(config)) p.push(renderizar(bloco));
  if (config.lotes.length > 1) {
    p.push(
      paragrafo([
        run("Condições da adjudicação por lotes: ", { negrito: true }),
        run(
          config.umLotePorConcorrente
            ? "não se pretende o mesmo adjudicatário em mais do que um lote, nos termos das regras de adjudicação dos lotes constantes do Anexo III."
            : "não existe qualquer condicionante, sendo indiferente a ordem pela qual ocorre a adjudicação.",
        ),
      ]),
    );
  }

  // VII. Gestão, monitorização e controlo
  p.push(seccao(7, "Gestão, monitorização e controlo"));
  p.push(
    paragrafo(
      "Atenta a natureza da prestação de serviços, executada na modalidade de Bolsa de Horas em que o prestador " +
        "disponibiliza recursos com os perfis e a experiência fixados, sob a orientação técnica da entidade " +
        "adjudicante, não são aplicáveis níveis de serviço (SLA) nem penalizações associadas a resultados.",
    ),
  );
  p.push(
    paragrafo(
      "O acompanhamento e o controlo da execução são assegurados pelo gestor do contrato, com base nos relatórios " +
        "mensais de atividade, a apresentar pelo adjudicatário no modelo a fornecer pela entidade adjudicante, que " +
        "discriminam as atividades realizadas e as horas prestadas por cada recurso. Os relatórios são remetidos ao " +
        "gestor do contrato até ao 5.º dia útil do mês seguinte e acompanham a respetiva fatura.",
    ),
  );

  // VIII. Riscos da não contratação
  p.push(seccao(8, "Riscos da não contratação"));
  p.push(paragrafo("Caso não seja adjudicada a aquisição em apreço, as suas consequências serão as seguintes:", { depois: 80 }));
  const riscos = config.justificacao.riscos.map((r) => r.designacao).filter((r) => r.trim() !== "");
  if (riscos.length === 0) p.push(alinea("a.", [marcador("riscos da não contratação")], RECUO));
  else comPontuacao(riscos).forEach((r, i) => p.push(alinea(`${letra(i)}.`, r, RECUO)));

  // IX. Júri técnico
  p.push(seccao(9, "Júri técnico"));
  p.push(
    paragrafo(
      "Na componente técnica deverão ser nomeados os seguintes elementos para integrarem o júri do procedimento:",
      { depois: 80 },
    ),
  );
  const nome = (valor: string, falta: string) => (valor.trim() === "" ? marcador(falta) : run(valor.trim()));
  p.push(alinea("a)", [nome(dados.juri.diretor, "nome do diretor"), run(` – Diretor da ${DIRECAO}`)], RECUO));
  p.push(alinea("b)", [nome(dados.juri.coordenador, "nome do coordenador"), run(" – Coordenador da "), nome(dados.unidade, "unidade")], RECUO));
  p.push(alinea("c)", [nome(dados.juri.gestorProjeto, "nome do gestor de projeto"), run(` – Gestor do Projeto ${projeto}`)], RECUO));

  // X. Conclusão
  p.push(seccao(10, "Conclusão"));
  p.push(paragrafo("Face ao exposto, propõe-se que o Conselho de Administração delibere:", { depois: 80 }));
  const reparticao = enumerar(n.anos.map((ano, i) => `${formatarMoeda(n.porAno[i])} em ${ano}`));
  const deliberacoes = [
    `Reconhecer a necessidade de assegurar a prestação de ${objeto}, no período de ${periodo};`,
    `Aprovar o valor estimado máximo de ${formatarMoeda(n.estimado)}, sem IVA, calculado nos termos da memória descritiva e de cálculo constante do Anexo I;`,
    `Autorizar a realização da despesa até ao valor máximo referido, acrescido de IVA à taxa legal em vigor, com a repartição anual máxima de ${reparticao}, sem IVA;`,
    "Aprovar o conteúdo da presente manifestação de necessidades;",
    "Seja remetido o conteúdo da presente informação à Direção de Administração Geral, para acompanhamento e adoção das diligências procedimentais necessárias.",
  ];
  deliberacoes.forEach((d, i) => p.push(paragrafo([run(`${letra(i)})`), tabulador(), run(d)], { ind: 680, pendente: 680, depois: 120 })));
  p.push(vazio(240));
  p.push(paragrafo("À consideração superior,", { jc: "left", depois: 240, comOSeguinte: true }));
  p.push(juntoAoSeguinte(assinatura(modeloAnterior, dados)));

  // A lista dos anexos.
  p.push(paragrafo([run("Anexos:")], { antes: 360, depois: 80, comOSeguinte: true }));
  const anexos = [
    "Anexo I – Memória descritiva e de cálculo do dimensionamento financeiro dos serviços",
    ...(n.estimado >= 5_000_000 ? ["Anexo II – Fundamentação de valor superior a 5 M€"] : []),
    "Anexo III – Especificações técnicas",
    ...(temResumos ? ["Anexo IV – Modelos de apresentação da experiência profissional (Resumos Curriculares)"] : []),
    `Anexo ${temResumos ? "V" : "IV"} – Alinhamento Tecnológico (eAvalia)`,
    `Anexo ${temResumos ? "VI" : "V"} – Custos - Serviços (eAvalia)`,
  ];
  anexos.forEach((a, i) => p.push(alinea(`${letra(i)})`, [run(a, { sz: TABELA + 2 })], RECUO)));

  // Anexo I — memória descritiva e de cálculo
  p.push(paragrafo([run("Anexo I – Memória descritiva e de cálculo do dimensionamento financeiro dos serviços", { negrito: true })], { jc: "center", novaPagina: true, depois: 240 }));
  p.push(paragrafo([run("Sumário executivo:", { negrito: true })], { comOSeguinte: true }));
  p.push(numerado("1.", [run("Objeto", { negrito: true })], { comOSeguinte: true, depois: 80 }));
  p.push(
    recuado(
      `Aquisição de ${objeto}, na modalidade de Bolsa de Horas, pelo período de ${n.meses} meses (${periodo}), ` +
        `com o valor estimado de ${formatarMoeda(n.estimado)}, sem IVA.`,
    ),
  );
  p.push(numerado("2.", [run("Pressupostos dos cálculos", { negrito: true })], { comOSeguinte: true, depois: 80 }));
  // Os parágrafos e o quadro dos anos da informação anterior: o enquadramento
  // do período, a repartição das horas e os encargos por ano, com IVA.
  for (const bloco of blocosEncargosPlurianuais(config)) {
    if (bloco.tipo === "titulo") continue;
    if (bloco.tipo === "paragrafo" && bloco.destaque === true) continue;
    if (bloco.tipo === "tabela") p.push(tabelaPlurianual(bloco));
    else if (bloco.tipo === "paragrafo") p.push(recuado(bloco.texto));
  }
  if (margem > 0) {
    const linhas = original.lotes.flatMap((lote, li) =>
      lote.perfis.map((e, pi) => [
        lote.numero,
        e.perfil.perfil,
        `${formatarMoeda(e.valorHora)}/h`,
        `${formatarNumero(margem)} %`,
        `${formatarMoeda(config.lotes[li].perfis[pi].valorHora)}/h`,
      ]),
    );
    p.push(
      tabela(
        [
          { titulo: "Lote", alinhamento: "direita", peso: 8 },
          { titulo: "Perfil", peso: 38 },
          { titulo: "Valor hora de referência (s/ IVA)", alinhamento: "direita", peso: 20 },
          { titulo: "Margem prudencial", alinhamento: "direita", peso: 14 },
          { titulo: "Valor hora considerado (s/ IVA)", alinhamento: "direita", peso: 20 },
        ],
        linhas,
        { legenda: "Valor hora de cada perfil, antes e depois da margem prudencial." },
      ),
    );
  }

  p.push(numerado("3.", [run("Natureza do volume e da margem", { negrito: true })], { comOSeguinte: true, depois: 80 }));
  const servicos = dados.servicosAnteriores.trim();
  p.push(
    recuado(
      "O número de horas foi determinado de acordo com a estimativa do esforço associado ao desenvolvimento das " +
        "tarefas inerentes à prestação de serviços, tendo em consideração a prestação de serviços anteriores de " +
        `natureza similar${servicos === "" ? "" : `, designadamente ${servicos.replace(/[.;]+$/, "")}`}.`,
    ),
  );
  p.push(
    recuado(
      "Relativamente ao valor unitário, o mesmo foi apurado de acordo com o valor médio das propostas obtidas nos " +
        "últimos concursos públicos realizados pela SPMS, E.P.E. para a aquisição de serviços de natureza " +
        "equivalente, mediante a seguinte tabela:",
    ),
  );
  p.push(
    tabela(
      [
        { titulo: "Perfil", peso: 22 },
        { titulo: "Procedimento(s)", peso: 11 },
        { titulo: "N.º propostas admitidas", alinhamento: "direita", peso: 10 },
        { titulo: "Rate do valor base do procedimento (€/h)", alinhamento: "direita", peso: 15 },
        { titulo: "Rate mais alta válida (proposta) (€/h)", alinhamento: "direita", peso: 14 },
        { titulo: "Rate média das propostas (€/h)", alinhamento: "direita", peso: 14 },
        { titulo: "Diferença da rate média para valor base", alinhamento: "direita", peso: 14 },
      ],
      RATES_DE_REFERENCIA.map((r) => [r.perfil, { linhas: r.procedimentos }, r.propostas, r.base, r.maisAlta, r.media, r.diferenca]),
      { sz: ANOS },
    ),
  );
  p.push(recuado(justificacaoMargem));
  p.push(numerado("4.", [run("Rastreabilidade da execução", { negrito: true })], { comOSeguinte: true, depois: 80 }));
  p.push(
    recuado(
      "A execução deverá permitir a reconciliação entre as horas prestadas por cada recurso, as horas faturadas, o " +
        "valor hora aplicável a cada perfil e os limites financeiros anuais, assegurando o respetivo registo " +
        "documental, designadamente através dos relatórios mensais de atividade, e a preparação de evidência " +
        "adequada para controlo interno, auditoria e fiscalização.",
    ),
  );

  // Anexo III — especificações técnicas
  const numeroInf = config.numeroInformacao.trim();
  const dia = (d: number) => String(d).padStart(2, "0");
  p.push(
    paragrafo(
      [
        run(
          `ANEXO III À INFORMAÇÃO N.º ${numeroInf === "" ? "_________" : numeroInf} DE ${dia(quando.getDate())}/${dia(
            quando.getMonth() + 1,
          )}/${quando.getFullYear()}`,
          { negrito: true },
        ),
      ],
      { jc: "center", novaPagina: true, depois: 80 },
    ),
  );
  p.push(paragrafo([run("Especificações Técnicas", { negrito: true })], { jc: "center", depois: 240 }));

  const anexoTecnico = blocosAnexoTecnico(config);
  const seccaoDoAnexo = (tituloInicial: string): BlocoDocumento[] => {
    const i = anexoTecnico.findIndex((b) => b.tipo === "titulo" && b.nivel === 1 && b.texto === tituloInicial);
    if (i === -1) return [];
    const fim = anexoTecnico.findIndex((b, j) => j > i && b.tipo === "titulo" && b.nivel === 1);
    return anexoTecnico.slice(i + 1, fim === -1 ? undefined : fim);
  };

  p.push(numerado("1.", [run("Descrição", { negrito: true })], { comOSeguinte: true, depois: 80 }));
  p.push(
    recuado(
      descricao === ""
        ? [marcador("descrição do projeto")]
        : [run(`O Projeto ${projeto} visa ${descricao.replace(/[.;]+$/, "")}.`)],
    ),
  );
  p.push(numerado("2.", [run("Prazo de execução", { negrito: true })], { comOSeguinte: true, depois: 80 }));
  p.push(recuado(`${n.meses} meses, de ${periodo}.`));
  p.push(numerado("3.", [run("Prazo de entrega", { negrito: true })], { comOSeguinte: true, depois: 80 }));
  p.push(recuado("Não aplicável, por se tratar de uma prestação de serviços."));
  p.push(numerado("4.", [run("Local e modo de prestação de serviços", { negrito: true })], { comOSeguinte: true, depois: 80 }));
  for (const bloco of seccaoDoAnexo("Posto de trabalho")) p.push(renderizar(bloco));
  p.push(numerado("5.", [run("Equipa", { negrito: true })], { comOSeguinte: true, depois: 80 }));
  {
    const linhas: string[][] = [];
    config.lotes.forEach((lote) =>
      lote.perfis.forEach((e) => {
        const horas = horasPorAnoDe(e, true);
        linhas.push([
          lote.numero,
          e.perfil.perfil,
          String(e.nMinimoElementos),
          `${formatarMoeda(e.valorHora)}`,
          ...horas.map((h) => formatarNumero(h)),
          formatarNumero(horasContratadas(e, true)),
        ]);
      }),
    );
    p.push(
      tabela(
        [
          { titulo: "Lote", alinhamento: "direita", peso: 6 },
          { titulo: "Perfil", peso: 30 },
          { titulo: "N.º mínimo de recursos", alinhamento: "direita", peso: 11 },
          { titulo: "Valor/hora (s/ IVA)", alinhamento: "direita", peso: 12 },
          ...n.anos.map((ano) => ({ titulo: `N.º horas ${ano}`, alinhamento: "direita" as const, peso: 10 })),
          { titulo: "N.º total de horas", alinhamento: "direita", peso: 11 },
        ],
        linhas,
        { legenda: "Horas por recurso; o encargo de cada perfil resulta do n.º mínimo de recursos × horas × valor/hora." },
      ),
    );
  }
  p.push(numerado("6.", [run("Requisitos técnicos obrigatórios por perfil", { negrito: true })], { comOSeguinte: true, depois: 80 }));
  for (const bloco of seccaoDoAnexo("Requisitos mínimos de experiência profissional")) {
    if (bloco.tipo === "tabela" && bloco.colunas[0]?.titulo === "Conteúdo Funcional do Perfil") continue;
    p.push(renderizar(bloco));
  }
  p.push(numerado("7.", [run("Descrição dos serviços a prestar", { negrito: true })], { comOSeguinte: true, depois: 80 }));
  config.lotes.forEach((lote) =>
    lote.perfis.forEach((e) => {
      p.push(subtitulo(`Lote ${lote.numero} — ${e.perfil.perfil}`, 2));
      p.push(tabela([{ titulo: "Conteúdo Funcional do Perfil", peso: 100 }], conteudoFuncionalDoPerfil(e.perfil).map((a) => [a])));
    }),
  );
  p.push(numerado("8.", [run("Entregáveis", { negrito: true })], { comOSeguinte: true, depois: 80 }));
  p.push(
    recuado(
      "O acompanhamento da prestação de serviços terá por base os relatórios mensais de atividade, a apresentar pelo " +
        "adjudicatário no modelo a fornecer pela entidade adjudicante, com a indicação expressa dos serviços " +
        "prestados e das horas consumidas por cada recurso, bem como a documentação técnica atualizada das " +
        "alterações e funcionalidades implementadas. O relatório é enviado ao gestor de projeto da entidade " +
        "adjudicante até ao 5.º dia útil do mês seguinte e é anexado à fatura.",
    ),
  );
  const naoAplicavel =
    "Não aplicável. A prestação de serviços é executada na modalidade de Bolsa de Horas, sob a orientação técnica " +
    "da entidade adjudicante, sendo o acompanhamento assegurado pelos relatórios mensais de atividade referidos no " +
    "ponto 8.";
  ["SLA’s e níveis de serviço", "Indicadores de desempenho", "Mecanismos de monitorização", "Modelo de reporte"].forEach(
    (t, i) => {
      p.push(numerado(`${9 + i}.`, [run(t, { negrito: true })], { comOSeguinte: true, depois: 80 }));
      p.push(recuado(i === 3 ? "Relatórios mensais de atividade, no modelo a fornecer pela entidade adjudicante (ver ponto 8)." : naoAplicavel));
    },
  );
  let pontoAnexo = 13;
  const regrasAdjudicacao = seccaoDoAnexo("Regras de Adjudicação dos Lotes");
  if (regrasAdjudicacao.length > 0) {
    p.push(numerado(`${pontoAnexo++}.`, [run("Regras de adjudicação dos lotes", { negrito: true })], { comOSeguinte: true, depois: 80 }));
    for (const bloco of regrasAdjudicacao) p.push(bloco.tipo === "lista" ? lista(bloco, RECUO_ALINEA) : renderizar(bloco));
  }
  p.push(numerado(`${pontoAnexo}.`, [run("Regras de apuramento da experiência", { negrito: true })], { comOSeguinte: true, depois: 80 }));
  for (const bloco of seccaoDoAnexo("Regras de apuramento da experiência")) {
    p.push(bloco.tipo === "lista" ? lista(bloco, RECUO_ALINEA) : renderizar(bloco));
  }

  // Anexo IV — os resumos (a abertura; as folhas vão na secção deitada).
  const resumos = anexoDosResumos(config, imagens);
  if (resumos.corpo.length > 0) {
    p.push(
      paragrafo([run("Anexo IV – Modelos de apresentação da experiência profissional (Resumos Curriculares)", { negrito: true })], {
        jc: "center",
        novaPagina: true,
        depois: 240,
        comOSeguinte: true,
      }),
    );
    for (const bloco of resumos.corpo) p.push(renderizar(bloco));
  }
  return p.join("");
}

// --------------------------------------------------------------------------
// Imagens e montagem
// --------------------------------------------------------------------------

const EMU_POR_PIXEL = 914400 / 96;
const DXA_POR_PIXEL = 1440 / 96;
const LARGURA_EM_PAISAGEM = 16838 - 1701 - 849;
const ALTURA_EM_PAISAGEM = 11906 - 1970 - 1417 - 240;
const LARGURA_EM_RETRATO = 11906 - 1701 - 849;
const ALTURA_EM_RETRATO = 16838 - 1970 - 1417 - 240;
const RESERVA_DO_TITULO = 1800;
const TIPO_IMAGEM = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";

function paragrafoDeImagem(cx: number, cy: number, nome: string, id: number, relacao: string, novaPagina: boolean, fechaSeccao = ""): string {
  const desenho =
    "<w:drawing>" +
    '<wp:inline distT="0" distB="0" distL="0" distR="0">' +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    '<wp:effectExtent l="0" t="0" r="0" b="0"/>' +
    `<wp:docPr id="${id}" name="${esc(nome)}" descr="${esc(nome)}"/>` +
    '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
    '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    `<pic:nvPicPr><pic:cNvPr id="${id}" name="${esc(nome)}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${relacao}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
    "</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>";
  return (
    `<w:p><w:pPr><w:pStyle w:val="Normal"/>${novaPagina ? "<w:pageBreakBefore/>" : ""}` +
    '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>' +
    `<w:jc w:val="center"/>${fechaSeccao}</w:pPr><w:r>${desenho}</w:r></w:p>`
  );
}

function paginasDeImagem(
  paginas: PaginaDaFolha[],
  nome: string,
  ids: { docPr: number; relacao: string; ficheiro: string },
  relacao: (id: string, ficheiro: string, dados: Uint8Array) => string,
): string {
  return paginas
    .map((pagina, i) =>
      paragrafoDeImagem(
        pagina.largura * EMU_POR_PIXEL,
        pagina.altura * EMU_POR_PIXEL,
        `${nome} (${i + 1}/${paginas.length})`,
        ids.docPr + i,
        relacao(`${ids.relacao}${i + 1}`, `${ids.ficheiro}${i + 1}.png`, pagina.dados),
        i > 0,
      ),
    )
    .join("");
}

/** O cabeçalho sem as linhas «Template DAG» e «Setembro de 2026» — os parágrafos ficam, vazios. */
export function semVersaoDoModelo(cabecalho: string): string {
  return cabecalho.replace(/<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?(?:Template DAG|Setembro de)[\s\S]*?<\/w:p>/g, (paragrafo) =>
    paragrafo.replace(/<w:r\b[^>]*>(?:(?!<\/w:r>)[\s\S])*?<\/w:r>/g, ""),
  );
}

function decodificar(base64: string): Uint8Array {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

export async function gerarManifestacaoBlob(
  original: LotesJSON,
  dados: DadosManifestacao,
  quando = new Date(),
  imagens: ImagemDaFolha[] = [],
): Promise<Blob> {
  const config = comMargemPrudencial(original, dados.margemPrudencial);
  const zip = await JSZip.loadAsync(modeloBase64, { base64: true });
  const modelo = await zip.file("word/document.xml")!.async("string");
  const anterior = await (await JSZip.loadAsync(decodificar(modeloAnteriorBase64))).file("word/document.xml")!.async("string");

  // A secção do modelo que traz o cabeçalho e o rodapé — a primeira; as
  // seguintes herdam-nos no Word e não os repetem.
  const primeira = modelo.indexOf("<w:headerReference");
  const inicioSect = modelo.lastIndexOf("<w:sectPr", primeira);
  const sect = modelo.slice(inicioSect, modelo.indexOf("</w:sectPr>", inicioSect) + "</w:sectPr>".length);
  const sectPaisagem = sect.replace(/<w:pgSz[^>]*\/>/, '<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>');

  const relacoesNovas: string[] = [];
  const relacao = (id: string, ficheiro: string, dados: Uint8Array) => {
    zip.file(`word/media/${ficheiro}`, dados);
    relacoesNovas.push(`<Relationship Id="${id}" Type="${TIPO_IMAGEM}" Target="media/${ficheiro}"/>`);
    return id;
  };

  let xml = corpo(original, config, dados, modelo, anterior, quando, imagens);
  const resumos = anexoDosResumos(config, imagens);
  const temResumos = resumos.corpo.length > 0;

  // As folhas dos resumos, deitadas.
  if (resumos.paisagem.length > 0) {
    const escala = escalaDasImagens(
      imagens.map((imagem) => ({ tipo: "imagem", ...imagem, descricao: imagem.perfil })),
      LARGURA_EM_PAISAGEM / DXA_POR_PIXEL,
      ALTURA_EM_PAISAGEM / DXA_POR_PIXEL,
    );
    xml +=
      `<w:p><w:pPr>${sect}</w:pPr></w:p>` +
      imagens
        .map((imagem, i) =>
          paragrafoDeImagem(
            Math.floor(imagem.largura * escala) * EMU_POR_PIXEL,
            Math.floor(imagem.altura * escala) * EMU_POR_PIXEL,
            `Resumo Curricular — ${imagem.perfil}`,
            i + 1,
            relacao(`rIdResumo${i + 1}`, `resumo${i + 1}.png`, imagem.dados),
            i > 0,
            i === imagens.length - 1 ? sectPaisagem : "",
          ),
        )
        .join("");
  }

  // As duas folhas do eAvalia, de pé.
  const eavalia = new Uint8Array(await (await gerarEavaliaBlob(config, quando)).arrayBuffer());
  const espaco = {
    largura: LARGURA_EM_RETRATO / DXA_POR_PIXEL,
    alturaPrimeira: (ALTURA_EM_RETRATO - RESERVA_DO_TITULO) / DXA_POR_PIXEL,
    alturaSeguintes: ALTURA_EM_RETRATO / DXA_POR_PIXEL,
  };
  const alinhamento = await paginasDoAlinhamento(await lerFolhaDoAlinhamento(eavalia), espaco);
  const recursos = recursosDoProcedimento(config);
  const custos = await paginasDoAlinhamento(await lerFolhaDosCustos(eavalia, recursos.length), espaco);
  const [nAlinhamento, nCustos] = temResumos ? ["V", "VI"] : ["IV", "V"];

  const tituloAnexo = (texto: string) =>
    paragrafo([run(texto, { negrito: true })], { jc: "center", novaPagina: true, depois: 240, comOSeguinte: true });
  xml += tituloAnexo(`Anexo ${nAlinhamento} – Alinhamento Tecnológico (eAvalia)`);
  xml += paragrafo(
    "Reprodução da folha «Alinhamento Tecnológico» do pedido de parecer prévio eAvalia que acompanha a presente " +
      "informação, com as respostas às medidas de alinhamento tecnológico.",
  );
  xml += alinhamento.length > 0
    ? paginasDeImagem(alinhamento, "eAvalia — Alinhamento Tecnológico", { docPr: 1000, relacao: "rIdEavalia", ficheiro: "eavalia" }, relacao)
    : paragrafo([marcador("folha do alinhamento tecnológico — desenhada no browser")]);
  xml += tituloAnexo(`Anexo ${nCustos} – Custos - Serviços (eAvalia)`);
  xml += paragrafo(
    "Reprodução da folha «Custos - Serviços» do pedido de parecer prévio eAvalia que acompanha a presente " +
      "informação, com o tipo de serviço, a designação, o preço por hora e as horas de cada perfil a contratar.",
  );
  xml += custos.length > 0
    ? paginasDeImagem(custos, "eAvalia — Custos - Serviços", { docPr: 2000, relacao: "rIdCustos", ficheiro: "custos" }, relacao)
    : tabela(
        [
          { titulo: "Recurso", peso: 8 },
          { titulo: "Tipo", peso: 17 },
          { titulo: "Perfil", peso: 17 },
          { titulo: "Descrição", peso: 22 },
          { titulo: "Valor/hora", alinhamento: "direita", peso: 11 },
          { titulo: "N.º horas", alinhamento: "direita", peso: 10 },
          { titulo: "Custo total", alinhamento: "direita", peso: 15 },
        ],
        recursos.map((r, i) => [
          numeroRomano(i + 1),
          r.tipo,
          r.perfil,
          r.descricao,
          formatarMoeda(r.valorHora),
          formatarNumero(r.horas),
          formatarMoeda(r.valorHora * r.horas),
        ]),
      );
  xml += sect;

  if (relacoesNovas.length > 0) {
    const caminho = "word/_rels/document.xml.rels";
    const relacoes = await zip.file(caminho)!.async("string");
    zip.file(caminho, relacoes.replace("</Relationships>", `${relacoesNovas.join("")}</Relationships>`));
    const tipos = await zip.file("[Content_Types].xml")!.async("string");
    if (!/Extension="png"/i.test(tipos)) {
      zip.file("[Content_Types].xml", tipos.replace("<Types", "<Types").replace(/(<Types[^>]*>)/, '$1<Default Extension="png" ContentType="image/png"/>'));
    }
  }

  const inicio = modelo.indexOf("<w:body>") + "<w:body>".length;
  const fim = modelo.lastIndexOf("</w:body>");
  zip.file("word/document.xml", modelo.slice(0, inicio) + xml + modelo.slice(fim));

  // O cabeçalho do modelo traz a marca da versão do template («Template DAG /
  // Setembro de 2026»): é do modelo, não da informação, e sai.
  const cabecalho = zip.file("word/header1.xml");
  if (cabecalho !== null) zip.file("word/header1.xml", semVersaoDoModelo(await cabecalho.async("string")));

  const rodape = zip.file("word/footer1.xml");
  if (rodape !== null) zip.file("word/footer1.xml", rodapeComLinhaUnica(await rodape.async("string")));

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
