// Modelo de documento estruturado.
//
// O conteúdo do caderno de encargos e do programa do concurso é construído uma
// única vez como blocos, e depois vertido para Word (com tabelas a sério), para
// Excel e para texto simples. Assim os três nunca divergem entre si.

export type Alinhamento = "esquerda" | "direita" | "centro";

export interface Celula {
  texto: string;
  alinhamento?: Alinhamento;
  /** Realce visual, para linhas de subtotal e total. */
  destaque?: boolean;
}

export interface Coluna {
  titulo: string;
  alinhamento?: Alinhamento;
  /** Largura relativa, usada no Word e no Excel. */
  peso?: number;
}

/** Uma caixa de seleção do documento: o que se oferecia, e o que ficou marcado. */
export interface Opcao {
  texto: string;
  marcada: boolean;
}

export type BlocoDocumento =
  | { tipo: "titulo"; nivel: 1 | 2 | 3; texto: string }
  | { tipo: "paragrafo"; texto: string }
  | { tipo: "nota"; texto: string }
  | { tipo: "lista"; itens: string[]; numerada?: boolean }
  /**
   * Lista de caixas de seleção, com as marcadas e as não marcadas.
   *
   * As não marcadas saem também, e não só as escolhidas: o documento reproduz
   * um formulário, e quem o lê tem de ver o que foi ponderado e não escolhido
   * — é isso que distingue uma opção rejeitada de uma esquecida.
   */
  | { tipo: "opcoes"; itens: Opcao[] }
  | { tipo: "tabela"; legenda?: string; colunas: Coluna[]; linhas: Celula[][] };

export const MARCA_MARCADA = "☒";
export const MARCA_VAZIA = "☐";

export function opcao(texto: string, marcada: boolean): Opcao {
  return { texto, marcada };
}

export interface Documento {
  titulo: string;
  subtitulo?: string;
  blocos: BlocoDocumento[];
}

export function celula(texto: string, alinhamento?: Alinhamento, destaque?: boolean): Celula {
  return { texto, alinhamento, destaque };
}

// --------------------------------------------------------------------------
// Renderização para texto simples
// --------------------------------------------------------------------------

function larguraVisual(texto: string): number {
  return [...texto].length;
}

function alinhar(texto: string, largura: number, alinhamento: Alinhamento = "esquerda"): string {
  const espaco = Math.max(0, largura - larguraVisual(texto));
  if (alinhamento === "direita") return " ".repeat(espaco) + texto;
  if (alinhamento === "centro") {
    const esquerda = Math.floor(espaco / 2);
    return " ".repeat(esquerda) + texto + " ".repeat(espaco - esquerda);
  }
  return texto + " ".repeat(espaco);
}

function tabelaParaTexto(colunas: Coluna[], linhas: Celula[][]): string {
  const larguras = colunas.map((c, i) =>
    Math.max(larguraVisual(c.titulo), ...linhas.map((l) => larguraVisual(l[i]?.texto ?? ""))),
  );

  const separador = `+${larguras.map((w) => "-".repeat(w + 2)).join("+")}+`;
  const linhaTexto = (celulas: string[], alinhamentos: (Alinhamento | undefined)[]) =>
    `| ${celulas.map((t, i) => alinhar(t, larguras[i], alinhamentos[i])).join(" | ")} |`;

  return [
    separador,
    linhaTexto(
      colunas.map((c) => c.titulo),
      colunas.map((c) => c.alinhamento),
    ),
    separador,
    ...linhas.map((l) =>
      linhaTexto(
        colunas.map((_, i) => l[i]?.texto ?? ""),
        colunas.map((c, i) => l[i]?.alinhamento ?? c.alinhamento),
      ),
    ),
    separador,
  ].join("\n");
}

export function documentoParaTexto(doc: Documento): string {
  const partes: string[] = [doc.titulo, "=".repeat(larguraVisual(doc.titulo))];
  if (doc.subtitulo) partes.push(doc.subtitulo);
  partes.push("");

  for (const bloco of doc.blocos) {
    switch (bloco.tipo) {
      case "titulo":
        partes.push(
          bloco.texto,
          (bloco.nivel === 1 ? "=" : bloco.nivel === 2 ? "-" : "·").repeat(larguraVisual(bloco.texto)),
          "",
        );
        break;
      case "paragrafo":
        partes.push(bloco.texto, "");
        break;
      case "nota":
        partes.push(`[ ${bloco.texto} ]`, "");
        break;
      case "lista":
        partes.push(
          ...bloco.itens.map((item, i) => (bloco.numerada ? `${i + 1}. ${item}` : `  - ${item}`)),
          "",
        );
        break;
      case "opcoes":
        partes.push(
          ...bloco.itens.map((o) => `  ${o.marcada ? MARCA_MARCADA : MARCA_VAZIA} ${o.texto}`),
          "",
        );
        break;
      case "tabela":
        if (bloco.legenda) partes.push(bloco.legenda);
        partes.push(tabelaParaTexto(bloco.colunas, bloco.linhas), "");
        break;
    }
  }

  return partes.join("\n").trimEnd();
}
