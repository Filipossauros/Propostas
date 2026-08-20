// Vocabulário visual dos ficheiros Excel gerados pela aplicação.
//
// Vive à parte porque é partilhado por dois ficheiros com propósitos
// diferentes — o formulário de declaração (que se preenche) e o relatório de
// avaliação (que se lê) — e é a partilha que os faz parecer da mesma casa.

import type ExcelJS from "exceljs";

// Paleta: duas famílias e uma só exceção.
//
// Tudo o que é estrutura (faixas, subcabeçalhos, rótulos) vive na família azul,
// do mais escuro para o mais claro conforme desce na hierarquia. Tudo o que é
// leitura passiva (notas, campos bloqueados) fica em cinzento-azulado. O amarelo
// é a única exceção, e é deliberada: marca exclusivamente o que o candidato tem
// de preencher — nenhum outro elemento do formulário o usa.
export const COR_FAIXA = "FF1F4E78";
export const COR_SUBCABECALHO = "FF2E75B6";
export const COR_ROTULO_BG = "FFEDF1F5";
export const COR_ROTULO_TEXTO = "FF1F3B54";
export const COR_CAMPO_BG = "FFFFF8E1";
export const COR_CAMPO_TEXTO = "FF1F2933";
export const COR_CAMPO_BORDA = "FFE0C67A";
export const COR_CAMPO_BLOQUEADO_BG = "FFE9ECF1";
export const COR_CAMPO_BLOQUEADO_TEXTO = "FF4A5A6A";
export const COR_NOTA_BG = "FFEFF3F6";
export const COR_NOTA_TEXTO = "FF4A5A6A";
export const COR_BRANCO = "FFFFFFFF";
export const COR_LINHA_ALTERNADA = "FFF7F9FB";
export const COR_GRELHA = "FFD5DDE5";

/**
 * Cores de resultado, só do relatório de avaliação.
 *
 * O formulário reserva o amarelo para o que se preenche; num relatório não há
 * nada a preencher, e a cor fica livre para dizer o que interessa a quem lê:
 * cumpre, não cumpre, ou está impedido por outra razão.
 */
export const COR_CUMPRE_BG = "FFE6F4EA";
export const COR_CUMPRE_TEXTO = "FF1B6E3C";
export const COR_FALHA_BG = "FFFCECEB";
export const COR_FALHA_TEXTO = "FFB3261E";
export const COR_AVISO_BG = "FFFDF3E3";
export const COR_AVISO_TEXTO = "FF8A5A00";

export function fillSolido(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

export function linhaFina(argb: string): ExcelJS.Border {
  return { style: "thin", color: { argb } };
}

export function contorno(argb: string): Partial<ExcelJS.Borders> {
  const lado = linhaFina(argb);
  return { top: lado, bottom: lado, left: lado, right: lado };
}
