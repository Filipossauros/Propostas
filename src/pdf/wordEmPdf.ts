// A informação em PDF, desenhada a partir do próprio Word.
//
// Não há no browser quem converta um .docx em PDF, e esta aplicação não fala
// com serviço nenhum. Por isso o PDF é composto aqui: lê-se o documento Word
// que vai no pacote — o mesmo ficheiro, e não uma reconstrução à parte — e
// desenha-se página a página. O conteúdo é por isso o do Word, palavra por
// palavra; a paginação é feita por este código, e as quebras de linha e de
// página podem não coincidir ao milímetro com as que o Word faria.
//
// Lê o subconjunto de WordprocessingML que a aplicação produz, e o que o
// modelo da organização traz no cabeçalho e no rodapé: parágrafos (estilos,
// espaçamentos, avanços, tabulações, alinhamento e justificação, bordas,
// quebras e secções), texto (negrito, itálico, tamanho, cor, maiúsculas),
// tabelas (grelha, colunas fundidas, margens, sombreados, bordas e linhas de
// cabeçalho repetidas), imagens, e no cabeçalho as figuras e caixas de texto
// posicionadas. O texto sai em Helvetica, que tem as medidas do Arial.

import JSZip from "jszip";
import {
  degrees,
  PDFDocument,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setWordSpacing,
  StandardFonts,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";

// --------------------------------------------------------------------------
// Unidades
// --------------------------------------------------------------------------

/** O Word mede em vigésimos de ponto (twips/dxa); o PDF em pontos. */
const pt = (twips: number) => twips / 20;
/** As figuras medem-se em EMU: 12 700 por ponto. */
const ptDeEmu = (emu: number) => emu / 12700;

/** A altura de uma linha em espaçamento simples, para o Arial: ascendente, descendente e entrelinha. */
const LINHA_SIMPLES = 1.15;
const ASCENDENTE = 0.905;
const DESCENDENTE = 0.212;

// --------------------------------------------------------------------------
// XML
// --------------------------------------------------------------------------

function filhos(el: Element | null | undefined, nome?: string): Element[] {
  if (!el) return [];
  const todos = Array.from(el.children);
  return nome === undefined ? todos : todos.filter((c) => c.tagName === nome);
}

function filho(el: Element | null | undefined, nome: string): Element | null {
  return filhos(el, nome)[0] ?? null;
}

function numero(el: Element | null | undefined, atributo: string): number | undefined {
  const v = el?.getAttribute(atributo);
  return v === null || v === undefined || v === "" ? undefined : Number(v);
}

/** Os interruptores do Word: presentes valem sim, a não ser que digam `0`, `false` ou `off`. */
function ligado(el: Element | null): boolean | undefined {
  if (el === null) return undefined;
  const v = el.getAttribute("w:val");
  return !(v === "0" || v === "false" || v === "off");
}

/** Se um elemento está dentro de outro com este nome. */
function dentroDe(el: Element, nome: string): boolean {
  for (let p = el.parentElement; p !== null; p = p.parentElement) if (p.tagName === nome) return true;
  return false;
}

function analisar(xml: string): Document {
  return new DOMParser().parseFromString(xml, "application/xml");
}

// --------------------------------------------------------------------------
// Propriedades de texto e de parágrafo
// --------------------------------------------------------------------------

interface PropsTexto {
  negrito: boolean;
  italico: boolean;
  /** Em pontos. */
  tamanho: number;
  cor: string;
  maiusculas: boolean;
  sublinhado: boolean;
}

interface Tabulacao {
  pos: number;
  tipo: string;
}

interface Borda {
  espessura: number;
  cor: string;
  espaco: number;
}

interface PropsParagrafo {
  antes: number;
  depois: number;
  linha: number;
  regra: "auto" | "exact" | "atLeast";
  jc: "left" | "center" | "right" | "both";
  esquerda: number;
  direita: number;
  /** Positivo: a primeira linha começa mais à direita; negativo: avanço pendente. */
  primeira: number;
  tabs: Tabulacao[];
  bordaCima?: Borda;
  bordaBaixo?: Borda;
  quebraAntes: boolean;
  comOSeguinte: boolean;
  /** O aspeto do texto: omissões e estilos, sobre o qual cada troço aplica o seu. */
  texto: PropsTexto;
  /**
   * O da marca de parágrafo — o `rPr` dentro do `pPr`. Só vale para a própria
   * marca: dá a altura de um parágrafo vazio, e não se estende ao texto (o
   * modelo põe maiúsculas na marca da assinatura, e o texto não as tem).
   */
  marca: PropsTexto;
}

const TEXTO_BASE: PropsTexto = {
  negrito: false,
  italico: false,
  tamanho: 11,
  cor: "000000",
  maiusculas: false,
  sublinhado: false,
};

function aplicarRPr(base: PropsTexto, rPr: Element | null): PropsTexto {
  if (rPr === null) return base;
  const r = { ...base };
  const b = ligado(filho(rPr, "w:b"));
  if (b !== undefined) r.negrito = b;
  const i = ligado(filho(rPr, "w:i"));
  if (i !== undefined) r.italico = i;
  const caps = ligado(filho(rPr, "w:caps"));
  if (caps !== undefined) r.maiusculas = caps;
  const sz = numero(filho(rPr, "w:sz"), "w:val");
  if (sz !== undefined) r.tamanho = sz / 2;
  const cor = filho(rPr, "w:color")?.getAttribute("w:val");
  if (cor) r.cor = cor === "auto" ? "000000" : cor;
  const u = filho(rPr, "w:u")?.getAttribute("w:val");
  if (u !== undefined) r.sublinhado = u !== null && u !== "none";
  return r;
}

function lerBorda(el: Element | null): Borda | undefined | null {
  if (el === null) return undefined;
  const val = el.getAttribute("w:val");
  if (val === "nil" || val === "none") return null;
  const cor = el.getAttribute("w:color");
  return {
    espessura: Math.max(0.25, (numero(el, "w:sz") ?? 4) / 8),
    cor: !cor || cor === "auto" ? "000000" : cor,
    espaco: numero(el, "w:space") ?? 0,
  };
}

function aplicarPPr(base: PropsParagrafo, pPr: Element | null): PropsParagrafo {
  if (pPr === null) return base;
  const p = { ...base };

  const espacamento = filho(pPr, "w:spacing");
  if (espacamento) {
    p.antes = numero(espacamento, "w:before") ?? p.antes;
    p.depois = numero(espacamento, "w:after") ?? p.depois;
    const linha = numero(espacamento, "w:line");
    if (linha !== undefined) {
      p.linha = linha;
      const regra = espacamento.getAttribute("w:lineRule");
      p.regra = regra === "exact" || regra === "atLeast" ? regra : "auto";
    }
  }

  const jc = filho(pPr, "w:jc")?.getAttribute("w:val");
  if (jc) p.jc = jc === "both" || jc === "distribute" ? "both" : jc === "center" ? "center" : jc === "right" || jc === "end" ? "right" : "left";

  const ind = filho(pPr, "w:ind");
  if (ind) {
    p.esquerda = numero(ind, "w:left") ?? numero(ind, "w:start") ?? p.esquerda;
    p.direita = numero(ind, "w:right") ?? numero(ind, "w:end") ?? p.direita;
    const pendente = numero(ind, "w:hanging");
    const primeira = numero(ind, "w:firstLine");
    if (pendente !== undefined) p.primeira = -pendente;
    else if (primeira !== undefined) p.primeira = primeira;
  }

  const tabs = filho(pPr, "w:tabs");
  if (tabs) {
    const novas = filhos(tabs, "w:tab").map((t) => ({ pos: numero(t, "w:pos") ?? 0, tipo: t.getAttribute("w:val") ?? "left" }));
    p.tabs = [...p.tabs.filter((t) => !novas.some((n) => n.pos === t.pos)), ...novas.filter((n) => n.tipo !== "clear")];
  }

  const bordas = filho(pPr, "w:pBdr");
  if (bordas) {
    const cima = lerBorda(filho(bordas, "w:top"));
    const baixo = lerBorda(filho(bordas, "w:bottom"));
    if (cima !== undefined) p.bordaCima = cima ?? undefined;
    if (baixo !== undefined) p.bordaBaixo = baixo ?? undefined;
  }

  const quebra = ligado(filho(pPr, "w:pageBreakBefore"));
  if (quebra !== undefined) p.quebraAntes = quebra;
  const seguinte = ligado(filho(pPr, "w:keepNext"));
  if (seguinte !== undefined) p.comOSeguinte = seguinte;

  p.marca = aplicarRPr(p.marca, filho(pPr, "w:rPr"));
  return p;
}

// --------------------------------------------------------------------------
// Estilos
// --------------------------------------------------------------------------

interface Estilo {
  baseadoEm?: string;
  pPr: Element | null;
  rPr: Element | null;
  tblPr: Element | null;
}

class Estilos {
  private readonly porId = new Map<string, Estilo>();
  private readonly paragrafoPorOmissao?: string;
  readonly base: PropsParagrafo;

  constructor(xml: string | undefined) {
    const doc = xml === undefined ? null : analisar(xml);
    const raiz = doc?.documentElement ?? null;
    let paragrafoPorOmissao: string | undefined;

    for (const estilo of filhos(raiz, "w:style")) {
      const id = estilo.getAttribute("w:styleId") ?? "";
      this.porId.set(id, {
        baseadoEm: filho(estilo, "w:basedOn")?.getAttribute("w:val") ?? undefined,
        pPr: filho(estilo, "w:pPr"),
        rPr: filho(estilo, "w:rPr"),
        tblPr: filho(estilo, "w:tblPr"),
      });
      if (estilo.getAttribute("w:type") === "paragraph" && estilo.getAttribute("w:default") === "1") paragrafoPorOmissao = id;
    }
    this.paragrafoPorOmissao = paragrafoPorOmissao;

    const omissao = filho(raiz, "w:docDefaults");
    const inicial: PropsParagrafo = {
      antes: 0,
      depois: 0,
      linha: 240,
      regra: "auto",
      jc: "left",
      esquerda: 0,
      direita: 0,
      primeira: 0,
      tabs: [],
      quebraAntes: false,
      comOSeguinte: false,
      texto: TEXTO_BASE,
      marca: TEXTO_BASE,
    };
    const doDocumento = aplicarRPr(TEXTO_BASE, filho(filho(omissao, "w:rPrDefault"), "w:rPr"));
    const comTexto = { ...inicial, texto: doDocumento, marca: doDocumento };
    this.base = aplicarPPr(comTexto, filho(filho(omissao, "w:pPrDefault"), "w:pPr"));
  }

  /** A cadeia de um estilo, da raiz para ele. */
  private cadeia(id: string | undefined): Estilo[] {
    const cadeia: Estilo[] = [];
    const vistos = new Set<string>();
    while (id !== undefined && !vistos.has(id)) {
      vistos.add(id);
      const estilo = this.porId.get(id);
      if (estilo === undefined) break;
      cadeia.unshift(estilo);
      id = estilo.baseadoEm;
    }
    return cadeia;
  }

  /** As propriedades de um parágrafo: omissões, estilo da tabela, estilo do parágrafo e as suas. */
  paragrafo(pPr: Element | null, estiloDaTabela?: string): PropsParagrafo {
    let p = this.base;
    const doEstilo = (e: Estilo) => {
      p = aplicarPPr(p, e.pPr);
      p = { ...p, texto: aplicarRPr(p.texto, e.rPr), marca: aplicarRPr(p.marca, e.rPr) };
    };
    this.cadeia(estiloDaTabela).forEach(doEstilo);
    this.cadeia(filho(pPr, "w:pStyle")?.getAttribute("w:val") ?? this.paragrafoPorOmissao).forEach(doEstilo);
    return aplicarPPr(p, pPr);
  }

  /** As propriedades de um troço de texto, sobre as do seu parágrafo. */
  texto(base: PropsTexto, rPr: Element | null): PropsTexto {
    let t = base;
    const id = filho(rPr, "w:rStyle")?.getAttribute("w:val");
    for (const e of this.cadeia(id ?? undefined)) t = aplicarRPr(t, e.rPr);
    return aplicarRPr(t, rPr);
  }

  /** As propriedades de tabela de um estilo, da raiz para ele. */
  tabela(id: string | undefined): Element[] {
    return this.cadeia(id)
      .map((e) => e.tblPr)
      .filter((t): t is Element => t !== null);
  }
}

// --------------------------------------------------------------------------
// Tipos de letra
// --------------------------------------------------------------------------

interface Letras {
  normal: PDFFont;
  negrito: PDFFont;
  italico: PDFFont;
  negritoItalico: PDFFont;
}

function letraDe(letras: Letras, t: PropsTexto): PDFFont {
  if (t.negrito && t.italico) return letras.negritoItalico;
  if (t.negrito) return letras.negrito;
  if (t.italico) return letras.italico;
  return letras.normal;
}

/**
 * O texto nos caracteres que as letras padrão do PDF têm (WinAnsi).
 *
 * O português cabe todo — acentos, «», –, —, €, º —; o resto troca-se pelo
 * equivalente mais próximo, para nenhum carácter fazer falhar o documento.
 */
const TROCAS: Record<string, string> = {
  " ": " ",
  " ": " ",
  " ": " ",
  "−": "-",
  "‐": "-",
  "‑": "-",
  "→": "->",
  "←": "<-",
  "≥": ">=",
  "≤": "<=",
  "≈": "~",
  "✓": "v",
  "✗": "x",
  "­": "",
};

function limpar(texto: string, letra: PDFFont): string {
  const conjunto = new Set(letra.getCharacterSet());
  return [...texto]
    .map((c) => {
      const troca = TROCAS[c] ?? c;
      return [...troca].every((x) => conjunto.has(x.codePointAt(0)!)) ? troca : "?";
    })
    .join("");
}

function corPdf(hex: string) {
  const n = parseInt(hex.length === 6 ? hex : "000000", 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// --------------------------------------------------------------------------
// O que se desenha
// --------------------------------------------------------------------------

/** Uma operação de desenho, em pontos, com a origem no canto superior esquerdo da página. */
type Desenho =
  | {
      tipo: "texto";
      x: number;
      y: number;
      texto: string;
      letra: PDFFont;
      tamanho: number;
      cor: string;
      espacoPalavra: number;
      sublinhado: boolean;
      largura: number;
      /** Texto a ler de baixo para cima, como na nota vertical do cabeçalho. */
      rodado?: boolean;
    }
  | { tipo: "linha"; x1: number; y1: number; x2: number; y2: number; espessura: number; cor: string }
  | { tipo: "fundo"; x: number; y: number; largura: number; altura: number; cor: string }
  | { tipo: "imagem"; x: number; y: number; largura: number; altura: number; imagem: PDFImage };

function deslocar(d: Desenho, dx: number, dy: number): Desenho {
  switch (d.tipo) {
    case "texto":
    case "fundo":
    case "imagem":
      return { ...d, x: d.x + dx, y: d.y + dy };
    case "linha":
      return { ...d, x1: d.x1 + dx, y1: d.y1 + dy, x2: d.x2 + dx, y2: d.y2 + dy };
  }
}

// --------------------------------------------------------------------------
// Parágrafos: do XML às linhas
// --------------------------------------------------------------------------

type Atomo =
  | { tipo: "palavra"; texto: string; t: PropsTexto; largura: number }
  | { tipo: "espaco"; t: PropsTexto; largura: number }
  | { tipo: "tab"; t: PropsTexto; largura?: number }
  | { tipo: "quebra" }
  | { tipo: "pagina" }
  | { tipo: "imagem"; largura: number; altura: number; imagem: PDFImage }
  /** A caixa de escolha (□): as letras padrão do PDF não a têm, desenha-se. */
  | { tipo: "caixa"; t: PropsTexto; largura: number };

/** As caixas de escolha que o documento escreve como carácter. */
const CAIXAS = /([\u25A1\u2610])/;

interface Linha {
  atomos: Atomo[];
  /** Posição x de cada átomo, relativa à margem esquerda da coluna. */
  xs: number[];
  altura: number;
  linhaBase: number;
  /** Largura extra de cada espaço, na justificação. */
  extra: number;
  /** A página muda antes desta linha. */
  paginaAntes: boolean;
}

interface Contexto {
  estilos: Estilos;
  letras: Letras;
  imagem: (relacao: string) => PDFImage | undefined;
  /** O valor de um campo (PAGE, NUMPAGES…), quando a composição o sabe. */
  campo?: (instrucao: string) => string | undefined;
  tabPorOmissao: number;
}

/** Os átomos de um parágrafo: palavras, espaços, tabulações, quebras e imagens. */
function atomosDe(p: Element, props: PropsParagrafo, ctx: Contexto): Atomo[] {
  const atomos: Atomo[] = [];
  const texto = (conteudo: string, t: PropsTexto): void => {
    if (CAIXAS.test(conteudo)) {
      for (const parte of conteudo.split(CAIXAS)) {
        if (CAIXAS.test(parte)) atomos.push({ tipo: "caixa", t, largura: t.tamanho * 0.78 });
        else if (parte !== "") texto(parte, t);
      }
      return;
    }
    const letra = letraDe(ctx.letras, t);
    const limpo = limpar(t.maiusculas ? conteudo.toUpperCase() : conteudo, letra);
    for (const parte of limpo.split(/( )/)) {
      if (parte === "") continue;
      if (parte === " ") atomos.push({ tipo: "espaco", t, largura: letra.widthOfTextAtSize(" ", t.tamanho) });
      else atomos.push({ tipo: "palavra", texto: parte, t, largura: letra.widthOfTextAtSize(parte, t.tamanho) });
    }
  };

  // Campos: o que está entre `begin` e `separate` é a instrução, entre
  // `separate` e `end` o resultado guardado. Quando a composição sabe o valor
  // (o número da página), escreve-o em vez do resultado.
  let estado: "fora" | "instrucao" | "resultado" = "fora";
  let instrucao = "";
  let substituido = false;

  const percorrer = (el: Element) => {
    for (const c of filhos(el)) {
      if (c.tagName === "w:r") run(c);
      else if (c.tagName === "w:hyperlink" || c.tagName === "w:smartTag" || c.tagName === "w:ins" || c.tagName === "w:sdt" || c.tagName === "w:sdtContent" || c.tagName === "w:fldSimple") percorrer(c);
    }
  };

  const run = (r: Element) => {
    const t = ctx.estilos.texto(props.texto, filho(r, "w:rPr"));
    for (const c of filhos(r)) {
      switch (c.tagName) {
        case "w:fldChar": {
          const tipo = c.getAttribute("w:fldCharType");
          if (tipo === "begin") {
            estado = "instrucao";
            instrucao = "";
            substituido = false;
          } else if (tipo === "separate") {
            estado = "resultado";
          } else if (tipo === "end") {
            estado = "fora";
          }
          break;
        }
        case "w:instrText":
          instrucao += c.textContent ?? "";
          break;
        case "w:t": {
          if (estado === "instrucao") break;
          if (estado === "resultado") {
            const valor = ctx.campo?.(instrucao.trim().split(/\s+/)[0]?.toUpperCase() ?? "");
            if (valor !== undefined) {
              if (!substituido) texto(valor, t);
              substituido = true;
              break;
            }
          }
          texto(c.textContent ?? "", t);
          break;
        }
        case "w:tab":
          atomos.push({ tipo: "tab", t });
          break;
        case "w:br":
          atomos.push(c.getAttribute("w:type") === "page" ? { tipo: "pagina" } : { tipo: "quebra" });
          break;
        case "w:cr":
          atomos.push({ tipo: "quebra" });
          break;
        case "w:noBreakHyphen":
          texto("-", t);
          break;
        case "w:drawing": {
          const inline = filho(c, "wp:inline");
          if (inline === null) break;
          const extensao = filho(inline, "wp:extent");
          const blip = inline.getElementsByTagName("a:blip")[0];
          const imagem = blip ? ctx.imagem(blip.getAttribute("r:embed") ?? "") : undefined;
          if (imagem && extensao) {
            atomos.push({
              tipo: "imagem",
              largura: ptDeEmu(numero(extensao, "cx") ?? 0),
              altura: ptDeEmu(numero(extensao, "cy") ?? 0),
              imagem,
            });
          }
          break;
        }
      }
    }
  };

  percorrer(p);
  return atomos;
}

function alturaDeTexto(t: PropsTexto): number {
  return t.tamanho * LINHA_SIMPLES;
}

/** A altura de uma linha e a posição da linha de base, conforme a regra de espaçamento. */
function medidasDaLinha(atomos: Atomo[], props: PropsParagrafo): { altura: number; linhaBase: number } {
  let ascendente = 0;
  let descendente = 0;
  let natural = 0;
  for (const a of atomos) {
    if (a.tipo === "imagem") {
      ascendente = Math.max(ascendente, a.altura);
      natural = Math.max(natural, a.altura);
    } else if (a.tipo === "palavra" || a.tipo === "espaco" || a.tipo === "tab" || a.tipo === "caixa") {
      ascendente = Math.max(ascendente, a.t.tamanho * ASCENDENTE);
      descendente = Math.max(descendente, a.t.tamanho * DESCENDENTE);
      natural = Math.max(natural, alturaDeTexto(a.t));
    }
  }
  if (natural === 0) {
    natural = alturaDeTexto(props.marca);
    ascendente = props.marca.tamanho * ASCENDENTE;
    descendente = props.marca.tamanho * DESCENDENTE;
  }

  let altura: number;
  if (props.regra === "exact") altura = pt(props.linha);
  else if (props.regra === "atLeast") altura = Math.max(natural, pt(props.linha));
  else altura = natural * (props.linha / 240);

  // O espaço a mais das entrelinhas múltiplas fica por cima do texto.
  return { altura, linhaBase: altura - descendente - Math.max(0, (natural - ascendente - descendente) / 2) };
}

/** As paragens de tabulação a partir de uma posição, em pontos desde a margem. */
function proximaTabulacao(x: number, props: PropsParagrafo, ctx: Contexto): number {
  const explicitas = props.tabs.map((t) => pt(t.pos)).filter((p) => p > x + 0.01).sort((a, b) => a - b);
  // Um avanço pendente funciona como paragem: é aí que o texto de uma alínea começa.
  const pendente = props.primeira < 0 && pt(props.esquerda) > x + 0.01 ? [pt(props.esquerda)] : [];
  const candidatas = [...explicitas, ...pendente].sort((a, b) => a - b);
  if (candidatas.length > 0) return candidatas[0];
  const passo = pt(ctx.tabPorOmissao);
  return (Math.floor(x / passo) + 1) * passo;
}

/** Parte o parágrafo em linhas, numa coluna de `largura` pontos. */
function comporLinhas(atomos: Atomo[], props: PropsParagrafo, largura: number, ctx: Contexto): Linha[] {
  const esquerda = pt(props.esquerda);
  const direita = largura - pt(props.direita);
  const linhas: Linha[] = [];
  let atual: Atomo[] = [];
  let xs: number[] = [];
  let paginaAntes = false;
  let primeira = true;
  let x = esquerda + pt(props.primeira);

  const inicioDaLinha = () => (primeira ? esquerda + pt(props.primeira) : esquerda);

  const fechar = (forcada: boolean) => {
    // Os espaços do fim da linha não contam nem se justificam.
    while (atual.length > 0 && atual[atual.length - 1].tipo === "espaco") {
      atual.pop();
      xs.pop();
    }
    const { altura, linhaBase } = medidasDaLinha(atual, props);
    const ocupado = atual.length === 0 ? inicioDaLinha() : xs[xs.length - 1] + larguraDoAtomo(atual[atual.length - 1]);
    let extra = 0;
    const livre = direita - ocupado;
    let deslocamento = 0;
    if (props.jc === "center") deslocamento = livre / 2;
    else if (props.jc === "right") deslocamento = livre;
    else if (props.jc === "both" && !forcada) {
      // Só os espaços depois da última tabulação se esticam: antes dela, o
      // texto está preso à paragem.
      const ultimaTab = atual.map((a) => a.tipo).lastIndexOf("tab");
      const espacos = atual.filter((a, i) => a.tipo === "espaco" && i > ultimaTab).length;
      if (espacos > 0 && livre > 0) extra = livre / espacos;
    }
    if (extra > 0) {
      let acumulado = 0;
      const ultimaTab = atual.map((a) => a.tipo).lastIndexOf("tab");
      xs = xs.map((xi, i) => {
        const r = xi + acumulado;
        if (atual[i].tipo === "espaco" && i > ultimaTab) acumulado += extra;
        return r;
      });
    }
    linhas.push({ atomos: atual, xs: xs.map((xi) => xi + deslocamento), altura, linhaBase, extra, paginaAntes });
    atual = [];
    xs = [];
    paginaAntes = false;
    primeira = false;
    x = inicioDaLinha();
  };

  for (let i = 0; i < atomos.length; i++) {
    const a = atomos[i];
    if (a.tipo === "quebra") {
      fechar(true);
      continue;
    }
    if (a.tipo === "pagina") {
      if (atual.length > 0) fechar(true);
      paginaAntes = true;
      continue;
    }
    if (a.tipo === "tab") {
      const destino = proximaTabulacao(x, props, ctx);
      atual.push(a);
      xs.push(x);
      x = Math.min(Math.max(destino, x), direita);
      // O x do átomo seguinte é o da paragem: guarda-se a largura da tabulação.
      a.largura = x - xs[xs.length - 1];
      continue;
    }

    const w = larguraDoAtomo(a);
    if (a.tipo !== "espaco" && x + w > direita + 0.01 && atual.some((b) => b.tipo !== "espaco")) {
      fechar(false);
    }
    if (a.tipo === "espaco" && atual.length === 0 && !primeira) continue;

    // Uma palavra maior do que a linha inteira parte-se à letra.
    if (a.tipo === "palavra" && w > direita - x + 0.01 && atual.length === 0) {
      const letra = letraDe(ctx.letras, a.t);
      let pedaco = "";
      for (const c of a.texto) {
        if (letra.widthOfTextAtSize(pedaco + c, a.t.tamanho) > direita - x && pedaco !== "") {
          atual.push({ ...a, texto: pedaco, largura: letra.widthOfTextAtSize(pedaco, a.t.tamanho) });
          xs.push(x);
          fechar(false);
          pedaco = "";
        }
        pedaco += c;
      }
      const resto = { ...a, texto: pedaco, largura: letra.widthOfTextAtSize(pedaco, a.t.tamanho) };
      atual.push(resto);
      xs.push(x);
      x += resto.largura;
      continue;
    }

    atual.push(a);
    xs.push(x);
    x += w;
  }
  fechar(true);
  return linhas;
}

function larguraDoAtomo(a: Atomo): number {
  if (a.tipo === "palavra" || a.tipo === "espaco" || a.tipo === "imagem" || a.tipo === "caixa") return a.largura;
  if (a.tipo === "tab") return a.largura ?? 0;
  return 0;
}

/** Os desenhos de uma linha, com a origem no topo da linha e na margem da coluna. */
function desenharLinha(linha: Linha, ctx: Contexto): Desenho[] {
  const desenhos: Desenho[] = [];
  const base = linha.linhaBase;
  let i = 0;
  while (i < linha.atomos.length) {
    const a = linha.atomos[i];
    if (a.tipo === "imagem") {
      desenhos.push({ tipo: "imagem", x: linha.xs[i], y: base - a.altura, largura: a.largura, altura: a.altura, imagem: a.imagem });
      i++;
      continue;
    }
    if (a.tipo === "caixa") {
      // Um quadrado do tamanho de uma maiúscula, assente na linha de base.
      const lado = a.t.tamanho * 0.62;
      const x = linha.xs[i] + (a.largura - lado) / 2;
      const y = base - lado;
      const cor = a.t.cor;
      const e = Math.max(0.5, a.t.tamanho / 16);
      desenhos.push(
        { tipo: "linha", x1: x, y1: y, x2: x + lado, y2: y, espessura: e, cor },
        { tipo: "linha", x1: x, y1: y + lado, x2: x + lado, y2: y + lado, espessura: e, cor },
        { tipo: "linha", x1: x, y1: y, x2: x, y2: y + lado, espessura: e, cor },
        { tipo: "linha", x1: x + lado, y1: y, x2: x + lado, y2: y + lado, espessura: e, cor },
      );
      i++;
      continue;
    }
    if (a.tipo !== "palavra" && a.tipo !== "espaco") {
      i++;
      continue;
    }
    // Um troço: palavras e espaços seguidos com o mesmo aspeto, desenhados de uma vez.
    const t = a.t;
    const inicio = i;
    let texto = "";
    while (i < linha.atomos.length) {
      const b = linha.atomos[i];
      if ((b.tipo !== "palavra" && b.tipo !== "espaco") || b.t !== t) break;
      texto += b.tipo === "espaco" ? " " : b.texto;
      i++;
    }
    if (texto.trim() === "") continue;
    const letra = letraDe(ctx.letras, t);
    const fim = linha.xs[i - 1] + larguraDoAtomo(linha.atomos[i - 1]);
    desenhos.push({
      tipo: "texto",
      x: linha.xs[inicio],
      y: base,
      texto,
      letra,
      tamanho: t.tamanho,
      cor: t.cor,
      espacoPalavra: linha.extra,
      sublinhado: t.sublinhado,
      largura: fim - linha.xs[inicio],
    });
  }
  return desenhos;
}

// --------------------------------------------------------------------------
// A página e a composição em fluxo
// --------------------------------------------------------------------------

interface Seccao {
  largura: number;
  altura: number;
  cima: number;
  baixo: number;
  esquerda: number;
  direita: number;
  cabecalho: number;
  rodape: number;
}

interface Pagina {
  seccao: Seccao;
  desenhos: Desenho[];
}

function lerSeccao(sectPr: Element | null): Seccao {
  const tamanho = filho(sectPr, "w:pgSz");
  const margens = filho(sectPr, "w:pgMar");
  return {
    largura: pt(numero(tamanho, "w:w") ?? 11906),
    altura: pt(numero(tamanho, "w:h") ?? 16838),
    cima: pt(numero(margens, "w:top") ?? 1440),
    baixo: pt(numero(margens, "w:bottom") ?? 1440),
    esquerda: pt(numero(margens, "w:left") ?? 1440),
    direita: pt(numero(margens, "w:right") ?? 1440),
    cabecalho: pt(numero(margens, "w:header") ?? 720),
    rodape: pt(numero(margens, "w:footer") ?? 720),
  };
}

/**
 * Onde o texto vai caindo: a página atual, a altura já ocupada, e a mudança de
 * página quando o que vem a seguir não cabe.
 */
class Fluxo {
  readonly paginas: Pagina[] = [];
  private seccao!: Seccao;
  y = 0;

  novaSeccao(seccao: Seccao): void {
    this.seccao = seccao;
    this.novaPagina();
  }

  novaPagina(): void {
    this.paginas.push({ seccao: this.seccao, desenhos: [] });
    this.y = this.seccao.cima;
  }

  get topoDaPagina(): number {
    return this.seccao.cima;
  }

  get noTopo(): boolean {
    return Math.abs(this.y - this.seccao.cima) < 0.01;
  }

  get fundo(): number {
    return this.seccao.altura - this.seccao.baixo;
  }

  get esquerda(): number {
    return this.seccao.esquerda;
  }

  get largura(): number {
    return this.seccao.largura - this.seccao.esquerda - this.seccao.direita;
  }

  cabe(altura: number): boolean {
    return this.y + altura <= this.fundo + 0.01;
  }

  desenhar(d: Desenho[]): void {
    this.paginas[this.paginas.length - 1].desenhos.push(...d);
  }
}

/** Um parágrafo já partido em linhas, pronto a ser posto numa coluna. */
interface ParagrafoComposto {
  props: PropsParagrafo;
  linhas: Linha[];
}

function comporParagrafo(p: Element, ctx: Contexto, largura: number, estiloDaTabela?: string): ParagrafoComposto {
  const props = ctx.estilos.paragrafo(filho(p, "w:pPr"), estiloDaTabela);
  return { props, linhas: comporLinhas(atomosDe(p, props, ctx), props, largura, ctx) };
}

function alturaDoParagrafo({ props, linhas }: ParagrafoComposto): number {
  const bordas = (props.bordaCima ? props.bordaCima.espaco + props.bordaCima.espessura : 0) +
    (props.bordaBaixo ? props.bordaBaixo.espaco + props.bordaBaixo.espessura : 0);
  return pt(props.antes) + linhas.reduce((s, l) => s + l.altura, 0) + bordas + pt(props.depois);
}

/** Um parágrafo numa coluna sem paginação (célula, cabeçalho, rodapé): desenhos relativos ao topo. */
function paragrafoEmBloco(c: ParagrafoComposto, largura: number, ctx: Contexto): { desenhos: Desenho[]; altura: number } {
  const desenhos: Desenho[] = [];
  let y = pt(c.props.antes);
  if (c.props.bordaCima) {
    desenhos.push({ tipo: "linha", x1: pt(c.props.esquerda), y1: y, x2: largura - pt(c.props.direita), y2: y, espessura: c.props.bordaCima.espessura, cor: c.props.bordaCima.cor });
    y += c.props.bordaCima.espessura + c.props.bordaCima.espaco;
  }
  for (const linha of c.linhas) {
    desenhos.push(...desenharLinha(linha, ctx).map((d) => deslocar(d, 0, y)));
    y += linha.altura;
  }
  if (c.props.bordaBaixo) {
    y += c.props.bordaBaixo.espaco;
    desenhos.push({ tipo: "linha", x1: pt(c.props.esquerda), y1: y, x2: largura - pt(c.props.direita), y2: y, espessura: c.props.bordaBaixo.espessura, cor: c.props.bordaBaixo.cor });
    y += c.props.bordaBaixo.espessura;
  }
  return { desenhos, altura: y + pt(c.props.depois) };
}

/** Um parágrafo no fluxo da página, linha a linha, a mudar de página quando é preciso. */
function paragrafoNoFluxo(c: ParagrafoComposto, fluxo: Fluxo, ctx: Contexto, alturaDoSeguinte: number): void {
  const { props } = c;
  if (props.quebraAntes && !fluxo.noTopo) fluxo.novaPagina();

  // Com o seguinte: o parágrafo inteiro e a primeira linha do que vem depois
  // têm de caber juntos; senão começam os dois na página seguinte.
  if (props.comOSeguinte && !fluxo.noTopo && !fluxo.cabe(alturaDoParagrafo(c) + alturaDoSeguinte)) fluxo.novaPagina();

  // O espaço antes não se põe no topo de uma página — o Word também o come.
  if (!fluxo.noTopo) fluxo.y += pt(props.antes);

  const x0 = fluxo.esquerda;
  const largura = fluxo.largura;
  if (props.bordaCima) {
    fluxo.desenhar([{ tipo: "linha", x1: x0 + pt(props.esquerda), y1: fluxo.y, x2: x0 + largura - pt(props.direita), y2: fluxo.y, espessura: props.bordaCima.espessura, cor: props.bordaCima.cor }]);
    fluxo.y += props.bordaCima.espessura + props.bordaCima.espaco;
  }
  for (const linha of c.linhas) {
    if (linha.paginaAntes) fluxo.novaPagina();
    if (!fluxo.cabe(linha.altura) && !fluxo.noTopo) fluxo.novaPagina();
    fluxo.desenhar(desenharLinha(linha, ctx).map((d) => deslocar(d, x0, fluxo.y)));
    fluxo.y += linha.altura;
  }
  if (props.bordaBaixo) {
    fluxo.y += props.bordaBaixo.espaco;
    fluxo.desenhar([{ tipo: "linha", x1: x0 + pt(props.esquerda), y1: fluxo.y, x2: x0 + largura - pt(props.direita), y2: fluxo.y, espessura: props.bordaBaixo.espessura, cor: props.bordaBaixo.cor }]);
    fluxo.y += props.bordaBaixo.espessura;
  }
  fluxo.y += pt(props.depois);
}

// --------------------------------------------------------------------------
// Tabelas
// --------------------------------------------------------------------------

interface BordasDaTabela {
  cima?: Borda;
  baixo?: Borda;
  esquerda?: Borda;
  direita?: Borda;
  dentroH?: Borda;
  dentroV?: Borda;
}

function lerBordasDaTabela(tblBorders: Element | null, base: BordasDaTabela): BordasDaTabela {
  if (tblBorders === null) return base;
  const r = { ...base };
  const lados: Array<[keyof BordasDaTabela, string[]]> = [
    ["cima", ["w:top"]],
    ["baixo", ["w:bottom"]],
    ["esquerda", ["w:left", "w:start"]],
    ["direita", ["w:right", "w:end"]],
    ["dentroH", ["w:insideH"]],
    ["dentroV", ["w:insideV"]],
  ];
  for (const [lado, nomes] of lados) {
    for (const nome of nomes) {
      const b = lerBorda(filho(tblBorders, nome));
      if (b !== undefined) r[lado] = b ?? undefined;
    }
  }
  return r;
}

interface Celula {
  x: number;
  largura: number;
  conteudo: Desenho[];
  alturaConteudo: number;
  fundo?: string;
  vertical: "top" | "center" | "bottom";
  bordas: { cima?: Borda | null; baixo?: Borda | null; esquerda?: Borda | null; direita?: Borda | null };
  primeira: boolean;
  ultima: boolean;
}

interface LinhaDaTabela {
  celulas: Celula[];
  altura: number;
  cabecalho: boolean;
  /** Algum parágrafo da linha fica com o seguinte: a linha não se separa da próxima. */
  comASeguinte: boolean;
}

function comporTabela(tbl: Element, ctx: Contexto, larguraDisponivel: number): { linhas: LinhaDaTabela[]; bordas: BordasDaTabela; x: number } {
  const tblPr = filho(tbl, "w:tblPr");
  const estilo = filho(tblPr, "w:tblStyle")?.getAttribute("w:val") ?? undefined;
  const doEstilo = ctx.estilos.tabela(estilo);

  let bordas: BordasDaTabela = {};
  let margens = { cima: 0, baixo: 0, esquerda: pt(108), direita: pt(108) };
  const aplicarMargens = (mar: Element | null) => {
    if (mar === null) return;
    margens = {
      cima: pt(numero(filho(mar, "w:top"), "w:w") ?? margens.cima * 20),
      baixo: pt(numero(filho(mar, "w:bottom"), "w:w") ?? margens.baixo * 20),
      esquerda: pt(numero(filho(mar, "w:left") ?? filho(mar, "w:start"), "w:w") ?? margens.esquerda * 20),
      direita: pt(numero(filho(mar, "w:right") ?? filho(mar, "w:end"), "w:w") ?? margens.direita * 20),
    };
  };
  for (const p of [...doEstilo, tblPr].filter((e): e is Element => e !== null)) {
    bordas = lerBordasDaTabela(filho(p, "w:tblBorders"), bordas);
    aplicarMargens(filho(p, "w:tblCellMar"));
  }

  const grelha = filhos(filho(tbl, "w:tblGrid"), "w:gridCol").map((g) => pt(numero(g, "w:w") ?? 0));
  const larguraTotal = grelha.reduce((s, w) => s + w, 0);
  const jc = filho(tblPr, "w:jc")?.getAttribute("w:val");
  const recuo = pt(numero(filho(tblPr, "w:tblInd"), "w:w") ?? 0);
  const x = jc === "center" ? (larguraDisponivel - larguraTotal) / 2 : jc === "right" ? larguraDisponivel - larguraTotal : recuo;

  const trs = filhos(tbl, "w:tr");
  const linhas: LinhaDaTabela[] = trs.map((tr) => {
    const trPr = filho(tr, "w:trPr");
    const alturaPedida = filho(trPr, "w:trHeight");
    let coluna = 0;
    let comASeguinte = false;
    const tcs = filhos(tr, "w:tc");
    const celulas: Celula[] = tcs.map((tc, i) => {
      const tcPr = filho(tc, "w:tcPr");
      const span = numero(filho(tcPr, "w:gridSpan"), "w:val") ?? 1;
      const xCel = grelha.slice(0, coluna).reduce((s, w) => s + w, 0);
      const largura = grelha.slice(coluna, coluna + span).reduce((s, w) => s + w, 0) || pt(numero(filho(tcPr, "w:tcW"), "w:w") ?? 0);
      coluna += span;

      const util = Math.max(1, largura - margens.esquerda - margens.direita);
      const conteudo: Desenho[] = [];
      let y = 0;
      for (const bloco of filhos(tc)) {
        if (bloco.tagName === "w:p") {
          const composto = comporParagrafo(bloco, ctx, util, estilo);
          if (composto.props.comOSeguinte) comASeguinte = true;
          const r = paragrafoEmBloco(composto, util, ctx);
          conteudo.push(...r.desenhos.map((d) => deslocar(d, 0, y)));
          y += r.altura;
        } else if (bloco.tagName === "w:tbl") {
          const interna = tabelaEmBloco(bloco, ctx, util);
          conteudo.push(...interna.desenhos.map((d) => deslocar(d, 0, y)));
          y += interna.altura;
        }
      }

      const bordasCel = filho(tcPr, "w:tcBorders");
      const shd = filho(tcPr, "w:shd")?.getAttribute("w:fill");
      const valign = filho(tcPr, "w:vAlign")?.getAttribute("w:val");
      return {
        x: xCel,
        largura,
        conteudo,
        alturaConteudo: y,
        fundo: shd && shd !== "auto" ? shd : undefined,
        vertical: valign === "center" ? "center" : valign === "bottom" ? "bottom" : "top",
        bordas: {
          cima: lerBorda(filho(bordasCel, "w:top")),
          baixo: lerBorda(filho(bordasCel, "w:bottom")),
          esquerda: lerBorda(filho(bordasCel, "w:left") ?? filho(bordasCel, "w:start")),
          direita: lerBorda(filho(bordasCel, "w:right") ?? filho(bordasCel, "w:end")),
        },
        primeira: i === 0,
        ultima: i === tcs.length - 1,
      };
    });

    const conteudo = Math.max(0, ...celulas.map((c) => c.alturaConteudo + margens.cima + margens.baixo));
    const pedida = pt(numero(alturaPedida, "w:val") ?? 0);
    const regra = alturaPedida?.getAttribute("w:hRule");
    const altura = regra === "exact" ? pedida : Math.max(conteudo, pedida);

    // O conteúdo passa a estar na posição final dentro da linha.
    for (const c of celulas) {
      const livre = altura - margens.cima - margens.baixo - c.alturaConteudo;
      const dy = margens.cima + (c.vertical === "center" ? livre / 2 : c.vertical === "bottom" ? livre : 0);
      c.conteudo = c.conteudo.map((d) => deslocar(d, c.x + margens.esquerda, dy));
    }
    return { celulas, altura, cabecalho: ligado(filho(trPr, "w:tblHeader")) === true, comASeguinte };
  });

  return { linhas, bordas, x };
}

/** Os desenhos de uma linha da tabela, com a origem no seu canto superior esquerdo. */
function desenharLinhaDaTabela(linha: LinhaDaTabela, bordas: BordasDaTabela, primeiraDaTabela: boolean, ultimaDaTabela: boolean): Desenho[] {
  const fundos: Desenho[] = [];
  const conteudo: Desenho[] = [];
  const tracos: Desenho[] = [];
  const traco = (b: Borda | null | undefined, x1: number, y1: number, x2: number, y2: number) => {
    if (b) tracos.push({ tipo: "linha", x1, y1, x2, y2, espessura: b.espessura, cor: b.cor });
  };
  for (const c of linha.celulas) {
    if (c.fundo) fundos.push({ tipo: "fundo", x: c.x, y: 0, largura: c.largura, altura: linha.altura, cor: c.fundo });
    conteudo.push(...c.conteudo);
    const escolher = (propria: Borda | null | undefined, daTabela: Borda | undefined) => (propria === undefined ? daTabela : propria);
    traco(escolher(c.bordas.cima, primeiraDaTabela ? bordas.cima : bordas.dentroH), c.x, 0, c.x + c.largura, 0);
    traco(escolher(c.bordas.baixo, ultimaDaTabela ? bordas.baixo : bordas.dentroH), c.x, linha.altura, c.x + c.largura, linha.altura);
    traco(escolher(c.bordas.esquerda, c.primeira ? bordas.esquerda : bordas.dentroV), c.x, 0, c.x, linha.altura);
    traco(escolher(c.bordas.direita, c.ultima ? bordas.direita : bordas.dentroV), c.x + c.largura, 0, c.x + c.largura, linha.altura);
  }
  return [...fundos, ...conteudo, ...tracos];
}

/** Uma tabela dentro de uma célula: sem paginação. */
function tabelaEmBloco(tbl: Element, ctx: Contexto, largura: number): { desenhos: Desenho[]; altura: number } {
  const { linhas, bordas, x } = comporTabela(tbl, ctx, largura);
  const desenhos: Desenho[] = [];
  let y = 0;
  linhas.forEach((l, i) => {
    desenhos.push(...desenharLinhaDaTabela(l, bordas, i === 0, i === linhas.length - 1).map((d) => deslocar(d, x, y)));
    y += l.altura;
  });
  return { desenhos, altura: y };
}

/** A altura de uma linha e das seguintes que ficam presas a ela. */
function alturaDaCadeia(linhas: LinhaDaTabela[], desde: number): number {
  let altura = 0;
  for (let k = desde; k < linhas.length; k++) {
    altura += linhas[k].altura;
    if (!linhas[k].comASeguinte) break;
  }
  return altura;
}

/** Uma tabela no fluxo: as linhas que não cabem passam à página seguinte, e o cabeçalho repete-se. */
function tabelaNoFluxo(tbl: Element, fluxo: Fluxo, ctx: Contexto): void {
  const { linhas, bordas, x } = comporTabela(tbl, ctx, fluxo.largura);
  const cabecalho: LinhaDaTabela[] = [];
  for (const l of linhas) {
    if (!l.cabecalho) break;
    cabecalho.push(l);
  }
  const alturaDoCabecalho = cabecalho.reduce((s, l) => s + l.altura, 0);

  linhas.forEach((l, i) => {
    // A linha e as que ficam presas a ela — como as da assinatura — passam
    // juntas para a página seguinte, se não couberem aqui.
    const cadeia = alturaDaCadeia(linhas, i);
    const cabeNumaPagina = cadeia <= fluxo.fundo - fluxo.topoDaPagina;
    if ((!fluxo.cabe(l.altura) || (cabeNumaPagina && !fluxo.cabe(cadeia))) && !fluxo.noTopo) {
      // A última linha antes da quebra fecha com a borda de baixo.
      fluxo.novaPagina();
      if (!l.cabecalho && cabecalho.length > 0 && fluxo.cabe(alturaDoCabecalho + l.altura)) {
        cabecalho.forEach((h, j) => {
          fluxo.desenhar(desenharLinhaDaTabela(h, bordas, j === 0, false).map((d) => deslocar(d, fluxo.esquerda + x, fluxo.y)));
          fluxo.y += h.altura;
        });
      }
    }
    fluxo.desenhar(desenharLinhaDaTabela(l, bordas, i === 0, i === linhas.length - 1).map((d) => deslocar(d, fluxo.esquerda + x, fluxo.y)));
    fluxo.y += l.altura;
  });
}

/** A altura da primeira linha de um bloco — para o «manter com o seguinte». */
function alturaDoInicio(bloco: Element | undefined, ctx: Contexto, largura: number): number {
  if (bloco === undefined) return 0;
  if (bloco.tagName === "w:p") {
    const c = comporParagrafo(bloco, ctx, largura);
    return pt(c.props.antes) + (c.linhas[0]?.altura ?? 0);
  }
  if (bloco.tagName === "w:tbl") {
    const { linhas } = comporTabela(bloco, ctx, largura);
    return Math.max(alturaDaCadeia(linhas, 0), linhas.slice(0, 2).reduce((s, l) => s + l.altura, 0));
  }
  return 0;
}

// --------------------------------------------------------------------------
// Cabeçalho e rodapé
// --------------------------------------------------------------------------

interface Parte {
  corpo: Element;
  imagem: (relacao: string) => PDFImage | undefined;
}

/** Figuras e caixas de texto posicionadas no cabeçalho: o logótipo e a nota vertical da lateral. */
function desenharAncoras(parte: Parte, seccao: Seccao, ctx: Contexto): Desenho[] {
  const desenhos: Desenho[] = [];
  let yParagrafo = seccao.cabecalho;
  for (const p of filhos(parte.corpo, "w:p")) {
    for (const ancora of Array.from(p.getElementsByTagName("wp:anchor"))) {
      // As caixas de texto vêm duas vezes — a moderna e a de recurso (VML): lê-se a moderna.
      if (dentroDe(ancora, "mc:Fallback")) continue;
      const h = filho(ancora, "wp:positionH");
      const v = filho(ancora, "wp:positionV");
      const ext = filho(ancora, "wp:extent");
      const largura = ptDeEmu(numero(ext, "cx") ?? 0);
      const altura = ptDeEmu(numero(ext, "cy") ?? 0);
      const dx = ptDeEmu(Number(filho(h, "wp:posOffset")?.textContent ?? 0));
      const dy = ptDeEmu(Number(filho(v, "wp:posOffset")?.textContent ?? 0));
      const origemX = { page: 0, margin: seccao.esquerda }[h?.getAttribute("relativeFrom") ?? ""] ?? seccao.esquerda;
      const origemY = { page: 0, margin: seccao.cima }[v?.getAttribute("relativeFrom") ?? ""] ?? yParagrafo;
      const x = origemX + dx;
      const y = origemY + dy;

      const blip = ancora.getElementsByTagName("a:blip")[0];
      if (blip) {
        const imagem = parte.imagem(blip.getAttribute("r:embed") ?? "");
        if (imagem) desenhos.push({ tipo: "imagem", x, y, largura, altura, imagem });
        continue;
      }

      const caixa = ancora.getElementsByTagName("w:txbxContent")[0];
      if (!caixa) continue;
      const corpo = ancora.getElementsByTagName("wps:bodyPr")[0];
      const vertical = corpo?.getAttribute("vert");
      const recuoE = ptDeEmu(numero(corpo, "lIns") ?? 91440);
      const recuoC = ptDeEmu(numero(corpo, "tIns") ?? 45720);
      const linhas = filhos(caixa, "w:p").map((q) => {
        const props = ctx.estilos.paragrafo(filho(q, "w:pPr"));
        const texto = atomosDe(q, props, ctx).map((a) => (a.tipo === "palavra" ? a.texto : a.tipo === "espaco" ? " " : "")).join("");
        const t = atomosDe(q, props, ctx).find((a) => a.tipo === "palavra");
        return { texto, t: t && t.tipo === "palavra" ? t.t : props.texto };
      });

      if (vertical === "vert270") {
        // Texto a ler de baixo para cima, a primeira linha junto ao lado esquerdo.
        let coluna = x + recuoE;
        for (const l of linhas) {
          coluna += l.t.tamanho * ASCENDENTE;
          if (l.texto.trim() !== "") {
            desenhos.push({
              tipo: "texto",
              x: coluna,
              y: y + altura - recuoC,
              texto: l.texto,
              letra: letraDe(ctx.letras, l.t),
              tamanho: l.t.tamanho,
              cor: l.t.cor,
              espacoPalavra: 0,
              sublinhado: false,
              largura: 0,
              rodado: true,
            });
          }
          coluna += l.t.tamanho * (LINHA_SIMPLES - ASCENDENTE);
        }
      } else {
        let linhaY = y + recuoC;
        for (const l of linhas) {
          linhaY += l.t.tamanho * ASCENDENTE;
          if (l.texto.trim() !== "") {
            desenhos.push({ tipo: "texto", x: x + recuoE, y: linhaY, texto: l.texto, letra: letraDe(ctx.letras, l.t), tamanho: l.t.tamanho, cor: l.t.cor, espacoPalavra: 0, sublinhado: false, largura: 0 });
          }
          linhaY += l.t.tamanho * (LINHA_SIMPLES - ASCENDENTE);
        }
      }
    }
    const props = ctx.estilos.paragrafo(filho(p, "w:pPr"));
    yParagrafo += medidasDaLinha([], props).altura + pt(props.antes) + pt(props.depois);
  }
  return desenhos;
}

/** O cabeçalho ou o rodapé de uma página: parágrafos na largura do texto, e os em moldura no seu sítio. */
function desenharParte(parte: Parte, seccao: Seccao, ctx: Contexto, rodape: boolean): Desenho[] {
  const largura = seccao.largura - seccao.esquerda - seccao.direita;
  const ctxParte = { ...ctx, imagem: parte.imagem };
  const desenhos: Desenho[] = [];
  const fluxo: Desenho[] = [];
  const molduras: Array<{ desenhos: Desenho[]; altura: number; x: number; y: number }> = [];
  let y = 0;

  for (const bloco of filhos(parte.corpo)) {
    if (bloco.tagName === "w:tbl") {
      const t = tabelaEmBloco(bloco, ctxParte, largura);
      fluxo.push(...t.desenhos.map((d) => deslocar(d, 0, y)));
      y += t.altura;
      continue;
    }
    if (bloco.tagName !== "w:p") continue;
    const pPr = filho(bloco, "w:pPr");
    const moldura = filho(pPr, "w:framePr");
    const composto = comporParagrafo(bloco, ctxParte, moldura ? pt(numero(moldura, "w:w") ?? 1000) : largura);
    // As figuras posicionadas desenham-se à parte; aqui só conta o texto.
    const r = paragrafoEmBloco(composto, moldura ? pt(numero(moldura, "w:w") ?? 1000) : largura, ctxParte);
    if (moldura) {
      const mx = numero(moldura, "w:x");
      const my = numero(moldura, "w:y");
      const hAncora = moldura.getAttribute("w:hAnchor");
      const vAncora = moldura.getAttribute("w:vAnchor");
      const ox = hAncora === "page" ? 0 : seccao.esquerda;
      const oy = vAncora === "page" ? 0 : seccao.cima;
      molduras.push({ desenhos: r.desenhos, altura: r.altura, x: ox + pt(mx ?? 0), y: oy + pt(my ?? 0) });
      continue;
    }
    fluxo.push(...r.desenhos.map((d) => deslocar(d, 0, y)));
    y += r.altura;
  }

  // O rodapé acaba à distância do fundo que o modelo lhe dá; o cabeçalho começa à do topo.
  const topo = rodape ? seccao.altura - seccao.rodape - y : seccao.cabecalho;
  desenhos.push(...fluxo.map((d) => deslocar(d, seccao.esquerda, topo)));

  // O número de página vem numa moldura posta em coordenadas de página de pé.
  // Numa página deitada cairia fora dela — o Word deixa-o por mostrar —; aqui
  // fica logo acima do rodapé, que é onde está nas outras páginas.
  for (const m of molduras) {
    const limite = rodape ? topo - m.altura : seccao.altura - m.altura;
    desenhos.push(...m.desenhos.map((d) => deslocar(d, Math.min(m.x, seccao.largura - seccao.direita), Math.min(m.y, limite))));
  }
  if (!rodape) desenhos.push(...desenharAncoras(parte, seccao, ctxParte));
  return desenhos;
}

// --------------------------------------------------------------------------
// O documento
// --------------------------------------------------------------------------

async function lerRelacoes(zip: JSZip, parte: string): Promise<Map<string, string>> {
  const caminho = parte.replace(/([^/]+)$/, "_rels/$1.rels");
  const xml = await zip.file(caminho)?.async("string");
  const mapa = new Map<string, string>();
  if (xml === undefined) return mapa;
  for (const r of Array.from(analisar(xml).documentElement.children)) {
    const alvo = r.getAttribute("Target") ?? "";
    mapa.set(r.getAttribute("Id") ?? "", alvo.startsWith("/") ? alvo.slice(1) : `word/${alvo.replace(/^\.\//, "")}`);
  }
  return mapa;
}

/** As imagens de uma parte, embebidas no PDF uma vez só cada. */
async function imagensDe(zip: JSZip, relacoes: Map<string, string>, pdf: PDFDocument, cache: Map<string, PDFImage>): Promise<(id: string) => PDFImage | undefined> {
  const porId = new Map<string, PDFImage>();
  for (const [id, alvo] of relacoes) {
    if (!/\.(png|jpe?g)$/i.test(alvo)) continue;
    let imagem = cache.get(alvo);
    if (imagem === undefined) {
      const dados = await zip.file(alvo)?.async("uint8array");
      if (dados === undefined) continue;
      imagem = /\.png$/i.test(alvo) ? await pdf.embedPng(dados) : await pdf.embedJpg(dados);
      cache.set(alvo, imagem);
    }
    porId.set(id, imagem);
  }
  return (id) => porId.get(id);
}

/** Desenha as operações de uma página. */
function pintar(pagina: PDFPage, desenhos: Desenho[], altura: number): void {
  for (const d of desenhos) {
    switch (d.tipo) {
      case "fundo":
        pagina.drawRectangle({ x: d.x, y: altura - d.y - d.altura, width: d.largura, height: d.altura, color: corPdf(d.cor) });
        break;
      case "linha":
        pagina.drawLine({ start: { x: d.x1, y: altura - d.y1 }, end: { x: d.x2, y: altura - d.y2 }, thickness: d.espessura, color: corPdf(d.cor) });
        break;
      case "imagem":
        pagina.drawImage(d.imagem, { x: d.x, y: altura - d.y - d.altura, width: d.largura, height: d.altura });
        break;
      case "texto": {
        if (d.espacoPalavra > 0) pagina.pushOperators(pushGraphicsState(), setWordSpacing(d.espacoPalavra));
        pagina.drawText(d.texto, {
          x: d.x,
          y: altura - d.y,
          size: d.tamanho,
          font: d.letra,
          color: corPdf(d.cor),
          ...(d.rodado ? { rotate: degrees(90) } : {}),
        });
        if (d.espacoPalavra > 0) pagina.pushOperators(popGraphicsState());
        if (d.sublinhado) {
          const y = altura - d.y - d.tamanho * 0.12;
          pagina.drawLine({ start: { x: d.x, y }, end: { x: d.x + d.largura, y }, thickness: d.tamanho * 0.06, color: corPdf(d.cor) });
        }
        break;
      }
    }
  }
}

/**
 * O PDF de um documento Word.
 *
 * `titulo` vai para as propriedades do PDF — é o que o leitor mostra na barra.
 */
export async function wordEmPdf(docx: Uint8Array | ArrayBuffer | Blob, titulo = ""): Promise<Uint8Array> {
  const bytes = docx instanceof Blob ? new Uint8Array(await docx.arrayBuffer()) : docx;
  const zip = await JSZip.loadAsync(bytes);
  const xmlDocumento = await zip.file("word/document.xml")?.async("string");
  if (xmlDocumento === undefined) throw new Error("O ficheiro Word não tem documento.");

  const pdf = await PDFDocument.create();
  pdf.setTitle(titulo);
  pdf.setLanguage("pt-PT");
  pdf.setProducer("Propostas");
  pdf.setCreator("Propostas");

  const letras: Letras = {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    negrito: await pdf.embedFont(StandardFonts.HelveticaBold),
    italico: await pdf.embedFont(StandardFonts.HelveticaOblique),
    negritoItalico: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
  };
  const estilos = new Estilos(await zip.file("word/styles.xml")?.async("string"));
  const definicoes = await zip.file("word/settings.xml")?.async("string");
  const tabPorOmissao = Number(/<w:defaultTabStop w:val="(\d+)"/.exec(definicoes ?? "")?.[1] ?? 720);

  const cache = new Map<string, PDFImage>();
  const relacoes = await lerRelacoes(zip, "word/document.xml");
  const ctx: Contexto = {
    estilos,
    letras,
    imagem: await imagensDe(zip, relacoes, pdf, cache),
    tabPorOmissao,
  };

  const corpo = analisar(xmlDocumento).getElementsByTagName("w:body")[0];
  const blocos = filhos(corpo);

  // As secções: cada uma acaba no parágrafo que traz o seu `sectPr`, e a última no do corpo.
  const seccoes: Array<{ sectPr: Element | null; blocos: Element[] }> = [];
  let atuais: Element[] = [];
  for (const bloco of blocos) {
    if (bloco.tagName === "w:sectPr") {
      seccoes.push({ sectPr: bloco, blocos: atuais });
      atuais = [];
      continue;
    }
    if (bloco.tagName !== "w:p" && bloco.tagName !== "w:tbl") continue;
    atuais.push(bloco);
    const fecho = bloco.tagName === "w:p" ? filho(filho(bloco, "w:pPr"), "w:sectPr") : null;
    if (fecho !== null) {
      seccoes.push({ sectPr: fecho, blocos: atuais });
      atuais = [];
    }
  }
  if (atuais.length > 0) seccoes.push({ sectPr: seccoes[seccoes.length - 1]?.sectPr ?? null, blocos: atuais });

  // O corpo, secção a secção.
  const fluxo = new Fluxo();
  const partesDaSeccao: Array<{ cabecalho?: string; rodape?: string }> = [];
  for (const s of seccoes) {
    const seccao = lerSeccao(s.sectPr);
    const antes = fluxo.paginas.length;
    fluxo.novaSeccao(seccao);
    s.blocos.forEach((bloco, i) => {
      if (bloco.tagName === "w:tbl") {
        tabelaNoFluxo(bloco, fluxo, ctx);
        return;
      }
      const composto = comporParagrafo(bloco, ctx, fluxo.largura);
      // Um parágrafo vazio que só fecha a secção não ocupa página nenhuma.
      const soFecha = filho(filho(bloco, "w:pPr"), "w:sectPr") !== null && composto.linhas.every((l) => l.atomos.length === 0);
      if (soFecha) return;
      const seguinte = composto.props.comOSeguinte ? alturaDoInicio(s.blocos[i + 1], ctx, fluxo.largura) : 0;
      paragrafoNoFluxo(composto, fluxo, ctx, seguinte);
    });
    const refs = (tipo: string) =>
      filhos(s.sectPr, tipo).find((r) => r.getAttribute("w:type") === "default")?.getAttribute("r:id") ?? undefined;
    for (let i = antes; i < fluxo.paginas.length; i++) {
      partesDaSeccao[i] = { cabecalho: refs("w:headerReference"), rodape: refs("w:footerReference") };
    }
  }

  // Cabeçalhos e rodapés, que só se desenham agora: o «n/N» precisa do total.
  const partes = new Map<string, Parte>();
  const parte = async (id: string | undefined): Promise<Parte | undefined> => {
    if (id === undefined) return undefined;
    if (partes.has(id)) return partes.get(id);
    const alvo = relacoes.get(id);
    const xml = alvo === undefined ? undefined : await zip.file(alvo)?.async("string");
    if (alvo === undefined || xml === undefined) return undefined;
    const lida: Parte = {
      corpo: analisar(xml).documentElement,
      imagem: await imagensDe(zip, await lerRelacoes(zip, alvo), pdf, cache),
    };
    partes.set(id, lida);
    return lida;
  };

  const total = fluxo.paginas.length;
  for (let i = 0; i < total; i++) {
    const { seccao, desenhos } = fluxo.paginas[i];
    const pagina = pdf.addPage([seccao.largura, seccao.altura]);
    const ctxPagina: Contexto = {
      ...ctx,
      campo: (instrucao) => (instrucao === "PAGE" ? String(i + 1) : instrucao === "NUMPAGES" ? String(total) : undefined),
    };
    const refs = partesDaSeccao[i] ?? {};
    const cabecalho = await parte(refs.cabecalho);
    const rodape = await parte(refs.rodape);
    if (cabecalho) pintar(pagina, desenharParte(cabecalho, seccao, ctxPagina, false), seccao.altura);
    if (rodape) pintar(pagina, desenharParte(rodape, seccao, ctxPagina, true), seccao.altura);
    pintar(pagina, desenhos, seccao.altura);
  }

  return pdf.save();
}
