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

/** Um pedaço de parágrafo com peso próprio: é assim que uma frase sai a negrito. */
export interface ParteDeTexto {
  texto: string;
  destaque?: boolean;
}

/**
 * Um item de lista: o texto, e as alíneas que dele pendam.
 *
 * As alíneas existem porque há normas que enumeram casos sem quebrar a série
 * dos números — «nos termos do n.º 3» tem de continuar a apontar ao mesmo sítio
 * depois de o número ganhar três alíneas.
 */
export type ItemLista = string | { texto: string; alineas: string[] };

export type BlocoDocumento =
  | { tipo: "titulo"; nivel: 1 | 2 | 3; texto: string }
  | { tipo: "paragrafo"; texto: string; destaque?: boolean; partes?: ParteDeTexto[] }
  | { tipo: "nota"; texto: string }
  | { tipo: "lista"; itens: ItemLista[]; numerada?: boolean }
  | { tipo: "tabela"; legenda?: string; colunas: Coluna[]; linhas: Celula[][] }
  /**
   * Uma imagem, com as dimensões naturais em píxeis a 96 ppp. Quem a desenha
   * não sabe que largura tem a página; é cada saída que a reduz ao que lá cabe,
   * sempre com a proporção intacta.
   */
  | {
      tipo: "imagem";
      dados: Uint8Array;
      largura: number;
      altura: number;
      descricao: string;
      /**
       * A imagem começa uma página nova.
       *
       * É uma marca no próprio parágrafo da imagem, e não uma quebra à frente
       * dela: uma quebra é um parágrafo com vida própria e, quando a imagem
       * ocupa a página toda, essa linha vazia já não cabe — vai para a página
       * seguinte e leva a quebra com ela, deixando uma folha em branco pelo
       * meio.
       */
      novaPagina?: boolean;
    }
  /**
   * Uma quebra de página. Existe para o anexo dos Resumos Curriculares, onde
   * cada folha do ficheiro de cálculo tem de sair numa folha do Word — sem
   * isso, dois resumos partilhariam a mesma página e deixariam de se ler como
   * o formulário que reproduzem.
   */
  | { tipo: "quebraDePagina" };

export interface Documento {
  titulo: string;
  subtitulo?: string;
  blocos: BlocoDocumento[];
  /**
   * Blocos que vão numa secção própria, em orientação horizontal.
   *
   * É o que o anexo dos Resumos Curriculares precisa: a folha do formulário é
   * mais larga do que alta, e numa página vertical sairia reduzida a metade.
   */
  blocosEmPaisagem?: BlocoDocumento[];
}

export function celula(texto: string, alinhamento?: Alinhamento, destaque?: boolean): Celula {
  return { texto, alinhamento, destaque };
}

/**
 * Um parágrafo em que só parte do texto vai destacada.
 *
 * `texto` é derivado das partes, e não escrito à mão ao lado delas: as saídas
 * que não sabem de negrito — o texto simples, o Excel — leem-no, e escrito duas
 * vezes acabaria a divergir do que o Word mostra.
 */
export function paragrafoComPartes(...partes: ParteDeTexto[]): BlocoDocumento {
  return { tipo: "paragrafo", texto: partes.map((p) => p.texto).join(""), partes };
}

/** As partes de um parágrafo — o texto todo numa só, quando não foi repartido. */
export function partesDoParagrafo(bloco: Extract<BlocoDocumento, { tipo: "paragrafo" }>): ParteDeTexto[] {
  return bloco.partes ?? [{ texto: bloco.texto, destaque: bloco.destaque }];
}

export function textoDoItem(item: ItemLista): string {
  return typeof item === "string" ? item : item.texto;
}

export function alineasDoItem(item: ItemLista): string[] {
  return typeof item === "string" ? [] : item.alineas;
}

const ROMANOS = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];

/** A marca de uma alínea: i., ii., iii. — e o número, passados os dez. */
export function marcaDeAlinea(indice: number): string {
  return `${ROMANOS[indice] ?? String(indice + 1)}.`;
}

/**
 * A escala comum às imagens de uma secção: a maior que faz caber a maior delas.
 *
 * É comum de propósito. Com uma escala por imagem, cada folha sairia do tamanho
 * que a sua página permitia e o anexo mudava de corpo de letra de página para
 * página. Nunca amplia: a folha é desenhada a 96 ppp, e esticá-la só a
 * esborrataria.
 */
export function escalaDasImagens(blocos: BlocoDocumento[], larguraUtil: number, alturaUtil: number): number {
  const imagens = blocos.filter((b) => b.tipo === "imagem");
  if (imagens.length === 0) return 1;

  return Math.min(
    larguraUtil / Math.max(...imagens.map((i) => i.largura)),
    alturaUtil / Math.max(...imagens.map((i) => i.altura)),
    1,
  );
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

  for (const bloco of [...doc.blocos, ...(doc.blocosEmPaisagem ?? [])]) {
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
        for (const [i, item] of bloco.itens.entries()) {
          partes.push(bloco.numerada ? `${i + 1}. ${textoDoItem(item)}` : `  - ${textoDoItem(item)}`);
          partes.push(...alineasDoItem(item).map((a, j) => `     ${marcaDeAlinea(j)} ${a}`));
        }
        partes.push("");
        break;
      case "tabela":
        if (bloco.legenda) partes.push(bloco.legenda);
        partes.push(tabelaParaTexto(bloco.colunas, bloco.linhas), "");
        break;
      case "quebraDePagina":
        partes.push("", "");
        break;
      case "imagem":
        partes.push(`[ imagem: ${bloco.descricao} ]`, "");
        break;
    }
  }

  return partes.join("\n").trimEnd();
}
