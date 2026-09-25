// A folha «Alinhamento Tecnológico» do eAvalia, desenhada em páginas.
//
// Recebe a folha já lida (`folhaDoAlinhamento.ts`) e desenha-a num canvas, à
// maneira do Excel: fundo, texto e, por cima, as bordas. A folha é alta — setenta
// e cinco linhas —, e reduzida a uma página só ficava ilegível; por isso sai à
// largura da página e partida em tantas páginas quantas precise, sempre entre
// linhas, e sem separar o cabeçalho de uma secção da primeira pergunta dela.
//
// Só corre no browser: depende de `document.createElement("canvas")`.

import type { CelulaDaFolha, EstiloDeCelula, FolhaDesenhavel } from "./folhaDoAlinhamento";

/** Uma página da folha: o PNG e o tamanho a que entra na página, em píxeis a 96 ppp. */
export interface PaginaDaFolha {
  dados: Uint8Array;
  largura: number;
  altura: number;
}

/** O espaço útil da página, em píxeis a 96 ppp — a primeira leva o título do anexo. */
export interface EspacoDaPagina {
  largura: number;
  alturaPrimeira: number;
  alturaSeguintes: number;
}

const LETRA = '"Aptos Narrow", "Arial Narrow", "Liberation Sans Narrow", "Liberation Sans", Arial, sans-serif';
const RECUO = 3;
/** Uma margem à volta da folha, para as bordas de fora não ficarem cortadas a meio. */
const MARGEM = 1;
const ENTRELINHA = 1.22;

function fonte(estilo: EstiloDeCelula): { css: string; tamanho: number } {
  const tamanho = (estilo.tamanho * 96) / 72;
  return {
    tamanho,
    css: `${estilo.italico ? "italic " : ""}${estilo.negrito ? "bold " : ""}${tamanho.toFixed(1)}px ${LETRA}`,
  };
}

function partirEmLinhas(ctx: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split("\n")) {
    let atual = "";
    for (const palavra of paragrafo.split(" ")) {
      const tentativa = atual === "" ? palavra : `${atual} ${palavra}`;
      if (ctx.measureText(tentativa).width > largura && atual !== "") {
        linhas.push(atual);
        atual = palavra;
      } else {
        atual = tentativa;
      }
    }
    linhas.push(atual);
  }
  return linhas;
}

function soma(valores: number[], de: number, ate: number): number {
  return valores.slice(de, ate + 1).reduce((total, v) => total + v, 0);
}

/**
 * As alturas das linhas, crescidas onde o texto não cabe.
 *
 * No Excel quem lê pode alargar a linha; na imagem, não. E o tipo de letra do
 * browser nunca é exatamente o do Excel: um texto que lá cabe em três linhas
 * pode aqui pedir quatro. A linha cresce o que for preciso para nada ficar
 * cortado — numa fusão de várias linhas, cresce a última.
 */
function alturasQueCabem(ctx: CanvasRenderingContext2D, folha: FolhaDesenhavel): number[] {
  const alturas = [...folha.alturas];
  for (const celula of folha.celulas) {
    if (celula.texto === "") continue;
    const { css, tamanho } = fonte(celula.estilo);
    ctx.font = css;
    const largura = soma(folha.larguras, celula.coluna, celula.ateColuna) - 2 * RECUO;
    // Sem quebra é uma linha só — mas mesmo essa tem de caber: o título da
    // folha, a 16 pt, é mais alto do que a linha que o modelo lhe dá.
    const linhas = celula.estilo.quebra ? partirEmLinhas(ctx, celula.texto, largura).length : 1;
    const precisa = Math.ceil(linhas * tamanho * ENTRELINHA + 6);
    const tem = soma(alturas, celula.linha, celula.ateLinha);
    if (precisa > tem) alturas[celula.ateLinha] += precisa - tem;
  }
  return alturas;
}

/**
 * As linhas agrupadas em blocos que não se partem entre páginas: as de uma
 * fusão vertical ficam juntas, e o cabeçalho de uma secção — a linha com
 * «Resposta» e «Data» — fica com a primeira pergunta.
 */
function blocosDeLinhas(folha: FolhaDesenhavel): Array<[number, number]> {
  const n = folha.alturas.length;
  const juntaComASeguinte = Array.from({ length: n }, () => false);
  for (const c of folha.celulas) {
    for (let r = c.linha; r < c.ateLinha; r++) juntaComASeguinte[r] = true;
    if (c.texto.trim().toLowerCase() === "resposta") juntaComASeguinte[c.linha] = true;
  }

  const blocos: Array<[number, number]> = [];
  let inicio = 0;
  for (let r = 0; r < n; r++) {
    if (!juntaComASeguinte[r] || r === n - 1) {
      blocos.push([inicio, r]);
      inicio = r + 1;
    }
  }
  return blocos;
}

/** Uma linha sem nada que se veja: começar uma página por ela era deixar um vazio no topo. */
function linhaVazia(folha: FolhaDesenhavel, r: number): boolean {
  return folha.celulas
    .filter((c) => c.linha <= r && c.ateLinha >= r)
    .every((c) => c.texto === "" && c.estilo.fundo === undefined && !c.estilo.pontilhado && Object.values(c.estilo.bordas).every((b) => b === undefined));
}

/** As linhas de cada página, dado quanto cabe em cada uma. */
function paginar(folha: FolhaDesenhavel, alturas: number[], capacidade: (pagina: number) => number): Array<[number, number]> {
  const paginas: Array<[number, number]> = [];
  let atual: [number, number] | null = null;
  let usado = 0;

  for (const [de, ate] of blocosDeLinhas(folha)) {
    const altura = soma(alturas, de, ate);
    if (atual !== null && usado + altura > capacidade(paginas.length)) {
      paginas.push(atual);
      atual = null;
      usado = 0;
    }
    if (atual === null) {
      if (de === ate && linhaVazia(folha, de)) continue;
      atual = [de, ate];
    } else {
      atual[1] = ate;
    }
    usado += altura;
  }
  if (atual !== null) paginas.push(atual);
  return paginas;
}

/** O `lightGray` do Excel: pontos cinzentos em quadrícula, sobre branco. */
function pontilhado(ctx: CanvasRenderingContext2D): CanvasPattern | string {
  const padrao = document.createElement("canvas");
  padrao.width = 4;
  padrao.height = 4;
  const p = padrao.getContext("2d");
  if (p === null) return "#E6E6E6";
  p.fillStyle = "#FFFFFF";
  p.fillRect(0, 0, 4, 4);
  p.fillStyle = "#A6A6A6";
  p.fillRect(0, 0, 1, 1);
  p.fillRect(2, 2, 1, 1);
  return ctx.createPattern(padrao, "repeat") ?? "#E6E6E6";
}

interface Caixa {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

function caixaDe(celula: CelulaDaFolha, folha: FolhaDesenhavel, alturas: number[], primeiraLinha: number): Caixa {
  return {
    x: soma(folha.larguras, 0, celula.coluna - 1),
    y: soma(alturas, primeiraLinha, celula.linha - 1),
    largura: soma(folha.larguras, celula.coluna, celula.ateColuna),
    altura: soma(alturas, celula.linha, celula.ateLinha),
  };
}

function desenharTexto(
  ctx: CanvasRenderingContext2D,
  celula: CelulaDaFolha,
  caixa: Caixa,
  larguraVisivel: number,
): void {
  if (celula.texto === "") return;
  const { css, tamanho } = fonte(celula.estilo);
  ctx.font = css;
  ctx.fillStyle = celula.estilo.cor;
  ctx.textBaseline = "middle";

  const linhas = celula.estilo.quebra ? partirEmLinhas(ctx, celula.texto, caixa.largura - 2 * RECUO) : [celula.texto];
  const alturaLinha = tamanho * ENTRELINHA;
  const bloco = linhas.length * alturaLinha;
  const topo =
    celula.estilo.vertical === "top"
      ? caixa.y + 3
      : celula.estilo.vertical === "middle"
        ? caixa.y + (caixa.altura - bloco) / 2
        : caixa.y + caixa.altura - bloco - 3;

  ctx.save();
  ctx.beginPath();
  ctx.rect(caixa.x, caixa.y, larguraVisivel, caixa.altura);
  ctx.clip();
  const h = celula.estilo.horizontal;
  ctx.textAlign = h;
  const x = h === "center" ? caixa.x + caixa.largura / 2 : h === "right" ? caixa.x + caixa.largura - RECUO : caixa.x + RECUO;
  linhas.forEach((linha, i) => ctx.fillText(linha, x, topo + alturaLinha * (i + 0.5)));
  ctx.restore();
}

function desenharBordas(ctx: CanvasRenderingContext2D, celula: CelulaDaFolha, caixa: Caixa): void {
  const { esquerda, direita, cima, baixo } = celula.estilo.bordas;
  const traco = (borda: { cor: string; espessura: number } | undefined, x1: number, y1: number, x2: number, y2: number) => {
    if (borda === undefined) return;
    ctx.strokeStyle = borda.cor;
    ctx.lineWidth = borda.espessura;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  // Sobre a própria divisória, como no Excel: a borda de baixo de uma célula e
  // a de cima da seguinte são a mesma linha, e não duas lado a lado.
  const { x, y, largura, altura } = caixa;
  traco(cima, x, y, x + largura, y);
  traco(baixo, x, y + altura, x + largura, y + altura);
  traco(esquerda, x, y, x, y + altura);
  traco(direita, x + largura, y, x + largura, y + altura);
}

function paraPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolver, rejeitar) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        rejeitar(new Error("Não foi possível desenhar a folha do alinhamento."));
        return;
      }
      void blob.arrayBuffer().then((b) => resolver(new Uint8Array(b)));
    }, "image/png");
  });
}

/**
 * A folha em páginas, prontas a entrar no Word.
 *
 * `resolucao` multiplica os píxeis do PNG, não o tamanho a que ele entra na
 * página: a 2 o texto continua nítido quando o Word o imprime.
 */
export async function paginasDoAlinhamento(
  folha: FolhaDesenhavel,
  espaco: EspacoDaPagina,
  resolucao = 2,
): Promise<PaginaDaFolha[]> {
  if (typeof document === "undefined") return [];
  const medida = document.createElement("canvas").getContext("2d");
  if (medida === null) return [];

  const alturas = alturasQueCabem(medida, folha);
  const larguraTotal = soma(folha.larguras, 0, folha.larguras.length - 1);
  // À largura da página, e nunca maior do que a folha é.
  const escala = Math.min(1, espaco.largura / (larguraTotal + 2 * MARGEM));
  const capacidade = (pagina: number) => (pagina === 0 ? espaco.alturaPrimeira : espaco.alturaSeguintes) / escala;

  const paginas: PaginaDaFolha[] = [];
  for (const [de, ate] of paginar(folha, alturas, capacidade)) {
    const alturaDaPagina = soma(alturas, de, ate);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil((larguraTotal + 2 * MARGEM) * escala * resolucao);
    canvas.height = Math.ceil((alturaDaPagina + 2 * MARGEM) * escala * resolucao);
    const ctx = canvas.getContext("2d");
    if (ctx === null) return [];
    ctx.scale(escala * resolucao, escala * resolucao);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, larguraTotal + 2 * MARGEM, alturaDaPagina + 2 * MARGEM);
    ctx.translate(MARGEM, MARGEM);

    const daPagina = folha.celulas.filter((c) => c.linha >= de && c.ateLinha <= ate);
    const comTexto = (linha: number, coluna: number) =>
      folha.celulas.some((c) => c.texto !== "" && c.linha <= linha && c.ateLinha >= linha && c.coluna <= coluna && c.ateColuna >= coluna);

    // Fundos primeiro, depois o texto, e as bordas por cima de tudo — senão o
    // fundo de uma célula tapava a borda da vizinha.
    for (const celula of daPagina) {
      const caixa = caixaDe(celula, folha, alturas, de);
      if (celula.estilo.pontilhado || celula.estilo.fundo !== undefined) {
        ctx.fillStyle = celula.estilo.pontilhado ? pontilhado(ctx) : celula.estilo.fundo!;
        ctx.fillRect(caixa.x, caixa.y, caixa.largura, caixa.altura);
      }
    }
    for (const celula of daPagina) {
      const caixa = caixaDe(celula, folha, alturas, de);
      // Texto sem quebra transborda para as células vazias à direita, como no Excel.
      let visivel = caixa.largura;
      if (!celula.estilo.quebra && celula.estilo.horizontal === "left") {
        for (let c = celula.ateColuna + 1; c < folha.larguras.length && !comTexto(celula.linha, c); c++) {
          visivel += folha.larguras[c];
        }
      }
      desenharTexto(ctx, celula, caixa, visivel);
    }
    for (const celula of daPagina) desenharBordas(ctx, celula, caixaDe(celula, folha, alturas, de));

    paginas.push({
      dados: await paraPng(canvas),
      largura: Math.floor((larguraTotal + 2 * MARGEM) * escala),
      altura: Math.floor((alturaDaPagina + 2 * MARGEM) * escala),
    });
  }
  return paginas;
}
