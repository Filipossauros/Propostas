// A folha do Resumo Curricular desenhada como imagem.
//
// Não é uma captura do Excel — no browser não há Excel. É a mesma folha
// redesenhada num canvas a partir das mesmas constantes que a geram (`layout`
// para a estrutura, `estilo` para as cores), de modo que a imagem e o ficheiro
// de cálculo não possam divergir.
//
// Só corre no browser: depende de `document.createElement("canvas")`.

import type { EspecificacaoFormulario, LotesJSON } from "../core/types";
import { folhasDoAnexo, type ImagemDaFolha } from "../core/resumoCurricular";
import {
  COR_CAMPO_BG,
  COR_CAMPO_BLOQUEADO_BG,
  COR_CAMPO_BLOQUEADO_TEXTO,
  COR_CAMPO_BORDA,
  COR_CAMPO_TEXTO,
  COR_FAIXA,
  COR_NOTA_BG,
  COR_NOTA_TEXTO,
  COR_ROTULO_BG,
  COR_ROTULO_TEXTO,
  COR_SUBCABECALHO,
} from "./estilo";
import {
  CAMPOS_IDENTIFICACAO,
  ROTULO_ASSINATURA,
  TEXTO_CABECALHO_ANO,
  TEXTO_CABECALHO_MES,
  TEXTO_DECLARACAO_VERACIDADE,
  TEXTO_DISCLAIMER_PROJETO_EM_CURSO,
  TEXTO_NOTA_BLOCO,
  TEXTO_ROTULO_CLIENTE,
  TEXTO_ROTULO_FIM_PROJETO,
  TEXTO_ROTULO_FUNCAO,
  TEXTO_ROTULO_INICIO_PROJETO,
  TEXTO_ROTULO_PROJETO,
  TEXTO_SUBCABECALHO_DECLARA,
  TEXTO_SUBCABECALHO_FIM_ANO,
  TEXTO_SUBCABECALHO_FIM_MES,
  TEXTO_SUBCABECALHO_INICIO_ANO,
  TEXTO_SUBCABECALHO_INICIO_MES,
  TEXTO_SUBCABECALHO_REQUISITO,
  tituloFaixaBloco,
} from "./layout";

/** As cores do Excel vêm em ARGB; o canvas quer #RRGGBB. */
function cor(argb: string): string {
  return `#${argb.slice(2)}`;
}

/** Largura de uma coluna do Excel, em píxeis: a fórmula do próprio Excel. */
function larguraDeColuna(caracteres: number): number {
  return Math.round(caracteres * 7 + 5);
}

/** Altura de linha: o Excel conta em pontos, o canvas em píxeis. */
function alturaDeLinha(pontos: number): number {
  return Math.round((pontos * 96) / 72);
}

const LARGURAS = [30, 16, 11, 22, 16, 11, 16, 16].map(larguraDeColuna);
const LARGURA_TOTAL = LARGURAS.reduce((soma, l) => soma + l, 0);

const LETRA = '"Calibri", "Carlito", "Liberation Sans", Arial, sans-serif';
const RECUO = 8;
const COR_GRELHA_CANVAS = "#D5DDE5";

interface Estilo {
  fundo?: string;
  texto?: string;
  tamanho?: number;
  negrito?: boolean;
  italico?: boolean;
  centrado?: boolean;
  moldura?: string;
  quebra?: boolean;
}

/** O x de uma coluna (0-based) e a largura de um intervalo de colunas. */
function xDe(coluna: number): number {
  return LARGURAS.slice(0, coluna).reduce((soma, l) => soma + l, 0);
}
function larguraDe(primeira: number, ultima: number): number {
  return LARGURAS.slice(primeira, ultima + 1).reduce((soma, l) => soma + l, 0);
}

function partirEmLinhas(ctx: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(" ")) {
    const tentativa = atual === "" ? palavra : `${atual} ${palavra}`;
    if (ctx.measureText(tentativa).width > largura && atual !== "") {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = tentativa;
    }
  }
  if (atual !== "") linhas.push(atual);
  return linhas;
}

/** A fonte de um estilo, tal como o canvas a quer. */
function fonteDe(estilo: Estilo): { fonte: string; tamanho: number } {
  const tamanho = ((estilo.tamanho ?? 10) * 96) / 72;
  return {
    tamanho,
    fonte: `${estilo.italico ? "italic " : ""}${estilo.negrito ? "600 " : ""}${tamanho.toFixed(1)}px ${LETRA}`,
  };
}

/**
 * A altura de que um texto precisa numa célula, depois de quebrado.
 *
 * As linhas do Excel têm altura fixa e cortam o que não cabe — na folha, quem
 * lê pode alargar a linha; na imagem, não. Por isso a linha cresce aqui o que
 * for preciso para nada ficar cortado.
 */
function alturaNecessaria(
  ctx: CanvasRenderingContext2D,
  texto: string,
  primeira: number,
  ultima: number,
  estilo: Estilo,
): number {
  if (texto === "" || !estilo.quebra) return 0;
  const { fonte, tamanho } = fonteDe(estilo);
  ctx.font = fonte;
  const linhas = partirEmLinhas(ctx, texto, larguraDe(primeira, ultima) - 2 * RECUO);
  return Math.ceil(linhas.length * tamanho * 1.2 + 8);
}

/**
 * Uma célula: fundo, moldura e texto, com o mesmo tratamento do Excel —
 * centrado na vertical, recuado na horizontal, e quebrado quando não cabe.
 */
function pintar(
  ctx: CanvasRenderingContext2D,
  primeira: number,
  ultima: number,
  y: number,
  altura: number,
  texto: string,
  estilo: Estilo = {},
): void {
  const x = xDe(primeira);
  const largura = larguraDe(primeira, ultima);

  if (estilo.fundo) {
    ctx.fillStyle = estilo.fundo;
    ctx.fillRect(x, y, largura, altura);
  }
  if (estilo.moldura) {
    ctx.strokeStyle = estilo.moldura;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, largura - 1, altura - 1);
  }
  if (texto === "") return;

  const { fonte, tamanho } = fonteDe(estilo);
  ctx.font = fonte;
  ctx.fillStyle = estilo.texto ?? cor(COR_CAMPO_TEXTO);
  ctx.textBaseline = "middle";

  const util = largura - 2 * RECUO;
  const linhas = estilo.quebra ? partirEmLinhas(ctx, texto, util) : [texto];
  const alturaLinha = tamanho * 1.2;
  const topo = y + altura / 2 - ((linhas.length - 1) * alturaLinha) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, largura, altura);
  ctx.clip();
  ctx.textAlign = estilo.centrado ? "center" : "left";
  const xTexto = estilo.centrado ? x + largura / 2 : x + RECUO;
  linhas.forEach((linha, i) => ctx.fillText(linha, xTexto, topo + i * alturaLinha));
  ctx.restore();
}

const FAIXA: Estilo = { fundo: cor(COR_FAIXA), texto: "#FFFFFF", negrito: true, tamanho: 11 };
const ROTULO: Estilo = { fundo: cor(COR_ROTULO_BG), texto: cor(COR_ROTULO_TEXTO), negrito: true, quebra: true };
const CAMPO: Estilo = { fundo: cor(COR_CAMPO_BG), moldura: cor(COR_CAMPO_BORDA) };
const BLOQUEADO: Estilo = {
  fundo: cor(COR_CAMPO_BLOQUEADO_BG),
  texto: cor(COR_CAMPO_BLOQUEADO_TEXTO),
  italico: true,
};
const NOTA: Estilo = { fundo: cor(COR_NOTA_BG), texto: cor(COR_NOTA_TEXTO), italico: true, tamanho: 9, quebra: true };
const SUB: Estilo = {
  fundo: cor(COR_SUBCABECALHO),
  texto: "#FFFFFF",
  negrito: true,
  centrado: true,
  quebra: true,
  moldura: "#FFFFFF",
};
const DATA: Estilo = { fundo: cor(COR_ROTULO_BG), texto: cor(COR_ROTULO_TEXTO), negrito: true, tamanho: 8, centrado: true };

/**
 * Desenha a folha de um perfil, com um único bloco de projeto.
 *
 * A imagem é feita à escala pedida (2 por omissão) para não sair serrilhada
 * quando o Word a reduz à largura da página.
 */
export function desenharFolha(config: EspecificacaoFormulario, escala = 2): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (ctx === null) throw new Error("Não foi possível desenhar a folha: canvas indisponível.");

  // As linhas que levam texto quebrado crescem o que for preciso: os rótulos
  // dos requisitos e os cabeçalhos das datas da experiência são compridos, e à
  // altura do Excel sairiam cortados na imagem.
  const cresce = (base: number, ...medidas: number[]) => Math.max(base, ...medidas);
  const alturaSubcabecalho = cresce(
    alturaDeLinha(32),
    alturaNecessaria(ctx, TEXTO_SUBCABECALHO_REQUISITO, 0, 2, SUB),
    ...[TEXTO_SUBCABECALHO_DECLARA, TEXTO_SUBCABECALHO_INICIO_MES, TEXTO_SUBCABECALHO_INICIO_ANO,
      TEXTO_SUBCABECALHO_FIM_MES, TEXTO_SUBCABECALHO_FIM_ANO].map((t, i) => alturaNecessaria(ctx, t, 3 + i, 3 + i, SUB)),
  );

  const alturas = [
    alturaDeLinha(26), // título
    alturaDeLinha(20), // subtítulo
    alturaDeLinha(10), // branco
    alturaDeLinha(22), // faixa da identificação
    ...CAMPOS_IDENTIFICACAO.map(() => alturaDeLinha(20)),
    cresce(alturaDeLinha(32), alturaNecessaria(ctx, TEXTO_DECLARACAO_VERACIDADE, 0, 7, NOTA)), // declaração
    alturaDeLinha(20), // assinatura
    alturaDeLinha(8), // separador
    alturaDeLinha(22), // faixa do bloco
    alturaDeLinha(20), // cliente / projeto
    alturaDeLinha(20), // função
    alturaDeLinha(16), // cabeçalho das datas
    cresce(alturaDeLinha(40), alturaNecessaria(ctx, TEXTO_DISCLAIMER_PROJETO_EM_CURSO, 6, 7, { ...NOTA, tamanho: 8 })),
    alturaSubcabecalho,
    ...config.requisitos.map((r) => cresce(alturaDeLinha(20), alturaNecessaria(ctx, r.designacao, 0, 2, ROTULO))),
    cresce(alturaDeLinha(34), alturaNecessaria(ctx, TEXTO_NOTA_BLOCO, 0, 7, NOTA)), // nota do bloco
  ];
  const alturaTotal = alturas.reduce((soma, a) => soma + a, 0);

  canvas.width = LARGURA_TOTAL * escala;
  canvas.height = alturaTotal * escala;
  ctx.scale(escala, escala);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, LARGURA_TOTAL, alturaTotal);

  // Uma linha de cada vez, na ordem em que o Excel a constrói.
  let y = 0;
  let linha = 0;
  const avancar = () => {
    y += alturas[linha++];
  };
  const altura = () => alturas[linha];

  pintar(ctx, 0, 7, y, altura(), "RESUMO CURRICULAR", {
    texto: cor(COR_FAIXA),
    negrito: true,
    tamanho: 14,
    centrado: true,
  });
  avancar();
  pintar(ctx, 0, 7, y, altura(), config.perfil, {
    texto: cor(COR_ROTULO_TEXTO),
    italico: true,
    tamanho: 11,
    centrado: true,
  });
  avancar();
  avancar(); // branco

  pintar(ctx, 0, 7, y, altura(), "IDENTIFICAÇÃO DO CANDIDATO", FAIXA);
  avancar();

  for (const { rotulo, campo } of CAMPOS_IDENTIFICACAO) {
    pintar(ctx, 0, 0, y, altura(), rotulo, ROTULO);
    const preenchido =
      campo === "perfil" ? config.perfil : campo === "lote" ? config.lote : campo === "loteDesignacao" ? config.loteDesignacao : "";
    if (preenchido) pintar(ctx, 1, 7, y, altura(), preenchido, BLOQUEADO);
    else pintar(ctx, 1, 7, y, altura(), "", CAMPO);
    avancar();
  }

  pintar(ctx, 0, 7, y, altura(), TEXTO_DECLARACAO_VERACIDADE, NOTA);
  avancar();

  pintar(ctx, 0, 0, y, altura(), ROTULO_ASSINATURA, ROTULO);
  pintar(ctx, 1, 7, y, altura(), "", CAMPO);
  avancar();
  avancar(); // separador

  pintar(ctx, 0, 7, y, altura(), tituloFaixaBloco(1), FAIXA);
  avancar();

  pintar(ctx, 0, 0, y, altura(), TEXTO_ROTULO_CLIENTE, ROTULO);
  pintar(ctx, 1, 2, y, altura(), "", CAMPO);
  pintar(ctx, 3, 3, y, altura(), TEXTO_ROTULO_PROJETO, ROTULO);
  pintar(ctx, 4, 7, y, altura(), "", CAMPO);
  avancar();

  pintar(ctx, 0, 0, y, altura(), TEXTO_ROTULO_FUNCAO, ROTULO);
  pintar(ctx, 1, 7, y, altura(), "", CAMPO);
  avancar();

  for (const [coluna, texto] of [
    [1, TEXTO_CABECALHO_MES],
    [2, TEXTO_CABECALHO_ANO],
    [4, TEXTO_CABECALHO_MES],
    [5, TEXTO_CABECALHO_ANO],
  ] as const) {
    pintar(ctx, coluna, coluna, y, altura(), texto, DATA);
  }
  avancar();

  pintar(ctx, 0, 0, y, altura(), TEXTO_ROTULO_INICIO_PROJETO, ROTULO);
  pintar(ctx, 1, 1, y, altura(), "", CAMPO);
  pintar(ctx, 2, 2, y, altura(), "", CAMPO);
  pintar(ctx, 3, 3, y, altura(), TEXTO_ROTULO_FIM_PROJETO, ROTULO);
  pintar(ctx, 4, 4, y, altura(), "", CAMPO);
  pintar(ctx, 5, 5, y, altura(), "", CAMPO);
  pintar(ctx, 6, 7, y, altura(), TEXTO_DISCLAIMER_PROJETO_EM_CURSO, { ...NOTA, tamanho: 8 });
  avancar();

  pintar(ctx, 0, 2, y, altura(), TEXTO_SUBCABECALHO_REQUISITO, SUB);
  pintar(ctx, 3, 3, y, altura(), TEXTO_SUBCABECALHO_DECLARA, SUB);
  pintar(ctx, 4, 4, y, altura(), TEXTO_SUBCABECALHO_INICIO_MES, SUB);
  pintar(ctx, 5, 5, y, altura(), TEXTO_SUBCABECALHO_INICIO_ANO, SUB);
  pintar(ctx, 6, 6, y, altura(), TEXTO_SUBCABECALHO_FIM_MES, SUB);
  pintar(ctx, 7, 7, y, altura(), TEXTO_SUBCABECALHO_FIM_ANO, SUB);
  avancar();

  for (const requisito of config.requisitos) {
    pintar(ctx, 0, 2, y, altura(), requisito.designacao, ROTULO);
    for (const coluna of [3, 4, 5, 6, 7]) pintar(ctx, coluna, coluna, y, altura(), "", CAMPO);
    avancar();
  }

  pintar(ctx, 0, 7, y, altura(), TEXTO_NOTA_BLOCO, NOTA);
  avancar();

  // Um contorno leve a fechar a folha, como a grelha do Excel a delimita.
  ctx.strokeStyle = COR_GRELHA_CANVAS;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, LARGURA_TOTAL - 1, alturaTotal - 1);

  return canvas;
}

/** A folha em PNG, com as dimensões em píxeis que o Word precisa de saber. */
export async function imagemDaFolha(config: EspecificacaoFormulario, escala = 2): Promise<ImagemDaFolha> {
  const canvas = desenharFolha(config, escala);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (blob === null) throw new Error("Não foi possível converter a folha em imagem.");
  return {
    perfil: config.perfil,
    dados: new Uint8Array(await blob.arrayBuffer()),
    largura: canvas.width / escala,
    altura: canvas.height / escala,
  };
}

/**
 * As folhas do anexo, todas desenhadas — ou nenhuma.
 *
 * Fora do browser não há canvas para as desenhar; nesse caso devolve-se lista
 * vazia e os documentos Word voltam a reproduzir a folha em tabelas, que é o
 * que sabem fazer sem imagens.
 */
export async function imagensDosResumos(config: LotesJSON, escala = 2): Promise<ImagemDaFolha[]> {
  if (typeof document === "undefined") return [];
  try {
    return await Promise.all(folhasDoAnexo(config).map((folha) => imagemDaFolha(folha, escala)));
  } catch {
    return [];
  }
}
