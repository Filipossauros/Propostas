// A folha «Alinhamento Tecnológico» do eAvalia, lida para ser desenhada.
//
// O Word leva a folha em imagem, e a imagem tem de ser a do ficheiro que segue
// com ela — as respostas escritas, a largura das colunas, as fusões, as cores e
// as caixas que o formulário acende conforme a resposta. Em vez de redesenhar a
// folha à mão, lê-se tudo isso do próprio xlsx gerado: se o modelo mudar, a
// imagem muda com ele.
//
// Aqui só se lê — sem canvas —, para poder correr e ser testado fora do
// browser. O desenho está em `imagemDoAlinhamento.ts`.

import JSZip from "jszip";
import { ErroModeloEavalia, FOLHA_ALINHAMENTO } from "./eavaliaModelo";

export interface Borda {
  cor: string;
  /** Em píxeis: 1 para `thin`, 2 para `medium`, 3 para `thick`. */
  espessura: number;
}

export interface EstiloDeCelula {
  /** Cor de fundo, em #RRGGBB, quando há. */
  fundo?: string;
  /** O padrão `lightGray` do Excel: um pontilhado cinzento, que o formulário usa para «não se aplica». */
  pontilhado?: boolean;
  cor: string;
  negrito: boolean;
  italico: boolean;
  /** Em pontos, como no Excel. */
  tamanho: number;
  horizontal: "left" | "center" | "right";
  vertical: "top" | "middle" | "bottom";
  quebra: boolean;
  bordas: { esquerda?: Borda; direita?: Borda; cima?: Borda; baixo?: Borda };
}

/** Uma célula a desenhar — ou uma fusão de células, que se desenha como uma só. */
export interface CelulaDaFolha {
  /** Linha e coluna do canto superior esquerdo, a contar de 0. */
  linha: number;
  coluna: number;
  /** Última linha e última coluna que ocupa (iguais às primeiras, sem fusão). */
  ateLinha: number;
  ateColuna: number;
  texto: string;
  estilo: EstiloDeCelula;
}

export interface FolhaDesenhavel {
  /** Largura de cada coluna, em píxeis a 96 ppp. */
  larguras: number[];
  /** Altura de cada linha, em píxeis a 96 ppp. */
  alturas: number[];
  celulas: CelulaDaFolha[];
}

// --------------------------------------------------------------------------
// Referências de células
// --------------------------------------------------------------------------

function indiceDaColuna(letras: string): number {
  return [...letras].reduce((n, letra) => n * 26 + (letra.charCodeAt(0) - 64), 0) - 1;
}

function lerRef(ref: string): { linha: number; coluna: number } {
  const m = /^\$?([A-Z]+)\$?(\d+)$/.exec(ref.trim());
  if (m === null) throw new ErroModeloEavalia(`Referência de célula inesperada no modelo eAvalia: ${ref}`);
  return { coluna: indiceDaColuna(m[1]), linha: Number(m[2]) - 1 };
}

function atributo(xml: string, nome: string): string | undefined {
  return new RegExp(`\\b${nome}="([^"]*)"`).exec(xml)?.[1];
}

function desescapar(texto: string): string {
  return texto
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** O texto de um `<si>` ou de um `<is>`: todos os `<t>`, rich text incluído. */
function textoDosT(xml: string): string {
  return desescapar((xml.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join(""));
}

// --------------------------------------------------------------------------
// Cores
// --------------------------------------------------------------------------

/** Os temas contam lt1, dk1, lt2, dk2 por esta ordem, ao contrário do XML do tema. */
function paletaDoTema(tema: string | undefined): string[] {
  const esquema = tema === undefined ? "" : (/<a:clrScheme[\s\S]*?<\/a:clrScheme>/.exec(tema)?.[0] ?? "");
  const cor = (nome: string, omissao: string) => {
    const bloco = new RegExp(`<a:${nome}>([\\s\\S]*?)</a:${nome}>`).exec(esquema)?.[1] ?? "";
    return `#${atributo(bloco, "lastClr") ?? atributo(bloco, "val") ?? omissao}`;
  };
  return [
    cor("lt1", "FFFFFF"),
    cor("dk1", "000000"),
    cor("lt2", "E8E8E8"),
    cor("dk2", "0E2841"),
    ...["accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"].map((n) =>
      cor(n, "000000"),
    ),
  ];
}

/** O `tint` do Excel: aclara (positivo) ou escurece (negativo) na luminosidade HSL. */
function comTint(hex: string, tint: number): string {
  if (tint === 0) return hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  l = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r1, g1, b1].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/** Uma cor do Excel (`rgb`, `theme` com `tint`, `indexed`), em #RRGGBB. */
function lerCor(xml: string | undefined, paleta: string[], omissao = "#000000"): string {
  if (xml === undefined) return omissao;
  const rgb = atributo(xml, "rgb");
  if (rgb !== undefined) return `#${rgb.slice(-6).toUpperCase()}`;
  const tema = atributo(xml, "theme");
  if (tema !== undefined) return comTint(paleta[Number(tema)] ?? omissao, Number(atributo(xml, "tint") ?? 0));
  // 64 é a «cor do sistema»: o texto, preto. Os restantes índices não aparecem no modelo.
  return omissao;
}

// --------------------------------------------------------------------------
// Estilos
// --------------------------------------------------------------------------

interface Fonte {
  cor: string;
  negrito: boolean;
  italico: boolean;
  tamanho: number;
}

type Bordas = EstiloDeCelula["bordas"];

interface Preenchimento {
  fundo?: string;
  pontilhado?: boolean;
}

const ESPESSURAS: Record<string, number> = { hair: 1, thin: 1, dotted: 1, dashed: 1, medium: 2, double: 3, thick: 3 };

function lerBordas(xml: string, paleta: string[]): Bordas {
  const lado = (nome: string): Borda | undefined => {
    const m = new RegExp(`<${nome}\\b([^>]*)(?:/>|>([\\s\\S]*?)</${nome}>)`).exec(xml);
    const estilo = m === null ? undefined : atributo(m[1], "style");
    if (m === null || estilo === undefined || estilo === "none") return undefined;
    return { cor: lerCor(/<color\b[^>]*\/>/.exec(m[2] ?? "")?.[0], paleta), espessura: ESPESSURAS[estilo] ?? 1 };
  };
  return { esquerda: lado("left"), direita: lado("right"), cima: lado("top"), baixo: lado("bottom") };
}

function lerFonte(xml: string, paleta: string[]): Fonte {
  return {
    cor: lerCor(/<color\b[^>]*\/>/.exec(xml)?.[0], paleta),
    negrito: /<b\/>|<b val="(?:1|true)"\/>/.test(xml),
    italico: /<i\/>|<i val="(?:1|true)"\/>/.test(xml),
    tamanho: Number(atributo(/<sz\b[^>]*\/>/.exec(xml)?.[0] ?? "", "val") ?? 11),
  };
}

/**
 * O fundo de um `fill`. Nas células é o `fgColor` de um padrão sólido; nas
 * regras condicionais (`dxf`) é o `bgColor`, e o padrão vem subentendido.
 */
function lerPreenchimento(xml: string, paleta: string[], condicional: boolean): Preenchimento {
  const padrao = atributo(/<patternFill\b[^>]*>/.exec(xml)?.[0] ?? "", "patternType");
  if (padrao === "lightGray" || padrao === "gray125") return { pontilhado: true };
  if (padrao === "none") return {};
  const origem = /<(?:fgColor|bgColor)\b[^>]*\/>/g;
  const cores = [...xml.matchAll(origem)].map((m) => m[0]);
  const escolhida = condicional ? cores.find((c) => c.startsWith("<bgColor")) : cores.find((c) => c.startsWith("<fgColor"));
  if (escolhida === undefined || (!condicional && padrao === undefined)) return {};
  return { fundo: lerCor(escolhida, paleta, "#FFFFFF") };
}

interface Xf {
  fonte: Fonte;
  preenchimento: Preenchimento;
  bordas: Bordas;
  horizontal: EstiloDeCelula["horizontal"];
  vertical: EstiloDeCelula["vertical"];
  quebra: boolean;
  data: boolean;
}

function elementos(xml: string, bloco: string, elemento: string): string[] {
  const conteudo = new RegExp(`<${bloco}\\b[^>]*>([\\s\\S]*?)</${bloco}>`).exec(xml)?.[1] ?? "";
  return conteudo.match(new RegExp(`<${elemento}\\b[^>]*/>|<${elemento}\\b[^>]*>[\\s\\S]*?</${elemento}>`, "g")) ?? [];
}

/** Os formatos de data: os internos (14 a 22, 45 a 47) e os próprios que falem em dias, meses ou anos. */
function formatosDeData(estilos: string): Set<number> {
  const datas = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
  for (const fmt of elementos(estilos, "numFmts", "numFmt")) {
    const codigo = desescapar(atributo(fmt, "formatCode") ?? "").replace(/"[^"]*"|\[[^\]]*\]/g, "");
    if (/[dmy]/i.test(codigo)) datas.add(Number(atributo(fmt, "numFmtId")));
  }
  return datas;
}

function lerEstilos(estilos: string, paleta: string[]): { xfs: Xf[]; dxfs: Array<Preenchimento & { bordas: Bordas }> } {
  const fontes = elementos(estilos, "fonts", "font").map((f) => lerFonte(f, paleta));
  const fills = elementos(estilos, "fills", "fill").map((f) => lerPreenchimento(f, paleta, false));
  const bordas = elementos(estilos, "borders", "border").map((b) => lerBordas(b, paleta));
  const datas = formatosDeData(estilos);

  const xfs = elementos(estilos, "cellXfs", "xf").map((xf): Xf => {
    const alinhamento = /<alignment\b[^>]*\/>/.exec(xf)?.[0] ?? "";
    const horizontal = atributo(alinhamento, "horizontal");
    const vertical = atributo(alinhamento, "vertical");
    return {
      fonte: fontes[Number(atributo(xf, "fontId") ?? 0)] ?? fontes[0],
      preenchimento: fills[Number(atributo(xf, "fillId") ?? 0)] ?? {},
      bordas: bordas[Number(atributo(xf, "borderId") ?? 0)] ?? {},
      horizontal: horizontal === "center" || horizontal === "right" ? horizontal : "left",
      // O Excel alinha ao fundo quando nada diz.
      vertical: vertical === "center" ? "middle" : vertical === "top" ? "top" : "bottom",
      quebra: atributo(alinhamento, "wrapText") === "1",
      data: datas.has(Number(atributo(xf, "numFmtId") ?? 0)),
    };
  });

  const dxfs = elementos(estilos, "dxfs", "dxf").map((dxf) => ({
    ...lerPreenchimento(dxf, paleta, true),
    bordas: lerBordas(dxf, paleta),
  }));

  return { xfs, dxfs };
}

// --------------------------------------------------------------------------
// Formatação condicional
// --------------------------------------------------------------------------

interface Regra {
  prioridade: number;
  dxf: number;
  /** Diz se a regra se aplica, dados os valores das células da folha. */
  aplica: (valorDe: (ref: string) => string) => boolean;
}

/**
 * As duas formas de fórmula que o formulário usa: `E6=""` e
 * `OR(E6="a",E6="b",…)`. Comparam sem distinguir maiúsculas, como o Excel —
 * a regra diz «Já Cumpre» e a lista de escolha escreve «Já cumpre».
 *
 * Uma fórmula de outra forma não é interpretada: a regra fica por aplicar, e a
 * célula sai com o seu estilo próprio, que é o que se vê num Excel sem ela.
 */
function interpretar(formula: string): Regra["aplica"] | null {
  const comparacao = /^\s*(\$?[A-Z]+\$?\d+)\s*=\s*"([^"]*)"\s*$/;
  const partes = /^\s*OR\((.*)\)\s*$/i.exec(formula)?.[1].split(",") ?? [formula];
  const testes = partes.map((p) => comparacao.exec(desescapar(p)));
  if (testes.some((t) => t === null)) return null;
  return (valorDe) =>
    testes.some((t) => valorDe(t![1].replace(/\$/g, "")).trim().toLowerCase() === t![2].trim().toLowerCase());
}

function lerRegras(folha: string): Map<string, Regra[]> {
  const porCelula = new Map<string, Regra[]>();
  for (const bloco of folha.matchAll(/<conditionalFormatting\b[^>]*sqref="([^"]*)"[^>]*>([\s\S]*?)<\/conditionalFormatting>/g)) {
    const regras: Regra[] = [];
    for (const regra of bloco[2].matchAll(/<cfRule\b([^>]*)>([\s\S]*?)<\/cfRule>/g)) {
      if (atributo(regra[1], "type") !== "expression") continue;
      const formula = /<formula>([\s\S]*?)<\/formula>/.exec(regra[2])?.[1];
      const aplica = formula === undefined ? null : interpretar(formula);
      const dxf = atributo(regra[1], "dxfId");
      if (aplica === null || dxf === undefined) continue;
      regras.push({ prioridade: Number(atributo(regra[1], "priority") ?? 0), dxf: Number(dxf), aplica });
    }
    for (const ref of bloco[1].split(/\s+/).filter((r) => r !== "" && !r.includes(":"))) {
      porCelula.set(ref, [...(porCelula.get(ref) ?? []), ...regras].sort((a, b) => a.prioridade - b.prioridade));
    }
  }
  return porCelula;
}

// --------------------------------------------------------------------------
// A folha
// --------------------------------------------------------------------------

/** Largura de uma coluna do Excel, em píxeis: a fórmula do próprio Excel. */
function larguraDeColuna(caracteres: number): number {
  return Math.round(caracteres * 7 + 5);
}

function alturaDeLinha(pontos: number): number {
  return Math.round((pontos * 96) / 72);
}

/** Uma data do Excel (dias desde 30/12/1899), como se escreve cá: dd/mm/aaaa. */
function dataPorExtenso(serie: number): string {
  const data = new Date(Date.UTC(1899, 11, 30) + Math.round(serie) * 86_400_000);
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${dois(data.getUTCDate())}/${dois(data.getUTCMonth() + 1)}/${data.getUTCFullYear()}`;
}

/**
 * Lê a folha do alinhamento de um eAvalia gerado.
 *
 * Só as colunas e as linhas que o formulário usa — as que a dimensão da folha
 * declara —, e cada fusão como uma célula só.
 */
export async function lerFolhaDoAlinhamento(xlsx: Uint8Array | ArrayBuffer): Promise<FolhaDesenhavel> {
  const zip = await JSZip.loadAsync(xlsx);
  const [folha, estilosXml, cadeiasXml, temaXml] = await Promise.all(
    [FOLHA_ALINHAMENTO, "xl/styles.xml", "xl/sharedStrings.xml", "xl/theme/theme1.xml"].map(
      (nome) => zip.file(nome)?.async("string"),
    ),
  );
  if (folha === undefined || estilosXml === undefined) {
    throw new ErroModeloEavalia("O eAvalia gerado não tem a folha do alinhamento tecnológico.");
  }

  const paleta = paletaDoTema(temaXml);
  const { xfs, dxfs } = lerEstilos(estilosXml, paleta);
  const cadeias = (cadeiasXml?.match(/<si>[\s\S]*?<\/si>|<si\/>/g) ?? []).map(textoDosT);

  const dimensao = atributo(/<dimension\b[^>]*\/>/.exec(folha)?.[0] ?? "", "ref") ?? "A1:F1";
  const fim = lerRef(dimensao.split(":").pop()!);
  const nColunas = fim.coluna + 1;
  const nLinhas = fim.linha + 1;

  // Larguras: as das `<col>`, e a omissão da folha nas que não tenham.
  const omissaoColuna = Number(atributo(folha, "defaultColWidth") ?? 8.43);
  const larguras = Array.from({ length: nColunas }, () => larguraDeColuna(omissaoColuna));
  for (const col of folha.match(/<col\b[^>]*\/>/g) ?? []) {
    const [min, max] = [Number(atributo(col, "min")), Number(atributo(col, "max"))];
    for (let c = min; c <= Math.min(max, nColunas); c++) larguras[c - 1] = larguraDeColuna(Number(atributo(col, "width")));
  }

  // Alturas, e as células com o seu estilo e valor.
  const omissaoLinha = Number(atributo(folha, "defaultRowHeight") ?? 15);
  const alturas = Array.from({ length: nLinhas }, () => alturaDeLinha(omissaoLinha));
  const valores = new Map<string, string>();
  const estiloDe = new Map<string, number>();

  for (const linha of folha.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g)) {
    const atributos = linha[1] ?? linha[3];
    const r = Number(atributo(atributos, "r")) - 1;
    if (r >= nLinhas) continue;
    const ht = atributo(atributos, "ht");
    if (ht !== undefined) alturas[r] = alturaDeLinha(Number(ht));
    if (atributo(atributos, "hidden") === "1") alturas[r] = 0;

    for (const c of (linha[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = atributo(c[1], "r")!;
      const s = Number(atributo(c[1], "s") ?? 0);
      estiloDe.set(ref, s);
      const tipo = atributo(c[1], "t");
      const corpo = c[2] ?? "";
      const v = /<v>([\s\S]*?)<\/v>/.exec(corpo)?.[1];
      let texto = "";
      if (tipo === "s" && v !== undefined) texto = cadeias[Number(v)] ?? "";
      else if (tipo === "inlineStr") texto = textoDosT(/<is>([\s\S]*?)<\/is>/.exec(corpo)?.[1] ?? "");
      else if (v !== undefined) texto = xfs[s]?.data && tipo === undefined ? dataPorExtenso(Number(v)) : desescapar(v);
      valores.set(ref, texto);
    }
  }

  // As fusões: a célula do canto fica com o espaço todo, e as outras deixam de se desenhar.
  const fusoes = [...folha.matchAll(/<mergeCell ref="([A-Z]+\d+):([A-Z]+\d+)"\/>/g)].map((m) => ({
    de: lerRef(m[1]),
    ate: lerRef(m[2]),
  }));
  const absorvidas = new Set<string>();
  const fusaoDe = new Map<string, { linha: number; coluna: number }>();
  for (const { de, ate } of fusoes) {
    for (let r = de.linha; r <= ate.linha; r++) {
      for (let c = de.coluna; c <= ate.coluna; c++) {
        if (r !== de.linha || c !== de.coluna) absorvidas.add(`${r}:${c}`);
      }
    }
    fusaoDe.set(`${de.linha}:${de.coluna}`, ate);
  }

  const regras = lerRegras(folha);
  const valorDe = (ref: string) => valores.get(ref) ?? "";
  const refDe = (r: number, c: number) => `${String.fromCharCode(65 + c)}${r + 1}`;

  const estiloFinal = (r: number, c: number): EstiloDeCelula => {
    const ref = refDe(r, c);
    const xf = xfs[estiloDe.get(ref) ?? 0] ?? xfs[0];
    const base: EstiloDeCelula = {
      ...xf.preenchimento,
      cor: xf.fonte.cor,
      negrito: xf.fonte.negrito,
      italico: xf.fonte.italico,
      tamanho: xf.fonte.tamanho,
      horizontal: xf.horizontal,
      vertical: xf.vertical,
      quebra: xf.quebra,
      bordas: { ...xf.bordas },
    };
    // A primeira regra que se aplique, pela prioridade — como o Excel quando
    // nenhuma pede para parar as seguintes.
    const regra = (regras.get(ref) ?? []).find((r) => r.aplica(valorDe));
    const dxf = regra === undefined ? undefined : dxfs[regra.dxf];
    if (dxf === undefined) return base;
    const bordas = { ...base.bordas };
    for (const lado of ["esquerda", "direita", "cima", "baixo"] as const) {
      if (dxf.bordas[lado] !== undefined) bordas[lado] = dxf.bordas[lado];
    }
    return {
      ...base,
      fundo: dxf.fundo ?? (dxf.pontilhado ? undefined : base.fundo),
      pontilhado: dxf.pontilhado ?? base.pontilhado,
      bordas,
    };
  };

  const celulas: CelulaDaFolha[] = [];
  for (let r = 0; r < nLinhas; r++) {
    for (let c = 0; c < nColunas; c++) {
      if (absorvidas.has(`${r}:${c}`)) continue;
      const ate = fusaoDe.get(`${r}:${c}`) ?? { linha: r, coluna: c };
      const estilo = estiloFinal(r, c);

      // Numa fusão, cada lado do contorno é o das células que lá estão: a de
      // baixo à esquerda dá a borda de baixo, a de cima à direita a da direita.
      if (ate.linha !== r || ate.coluna !== c) {
        estilo.bordas = {
          esquerda: estiloFinal(r, c).bordas.esquerda,
          cima: estiloFinal(r, c).bordas.cima,
          direita: estiloFinal(r, ate.coluna).bordas.direita,
          baixo: estiloFinal(ate.linha, c).bordas.baixo,
        };
      }

      celulas.push({ linha: r, coluna: c, ateLinha: ate.linha, ateColuna: ate.coluna, texto: valorDe(refDe(r, c)), estilo });
    }
  }

  return { larguras, alturas, celulas };
}
