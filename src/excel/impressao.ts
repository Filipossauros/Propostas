// Como as folhas geradas se imprimem.
//
// Todas as folhas desta aplicação são largas — o Resumo Curricular tem oito
// colunas, a vista geral tem uma por ano — e, em retrato e à escala natural, o
// Excel corta-as ao meio e manda o resto para uma segunda folha, que ninguém
// consegue ler ao lado da primeira. Por isso: A4 deitado, largura ajustada a
// uma página, e altura livre — o que é longo continua nas páginas seguintes,
// mas nenhuma coluna se perde.
//
// Vive à parte por ser a mesma decisão em cinco ficheiros diferentes: escrita
// uma vez, nenhum deles fica para trás quando ela muda.

import type ExcelJS from "exceljs";

/** A4. É o código do próprio Excel, e não há constante na exceljs para ele. */
const A4 = 9;

/** Margens estreitas: o que se ganha aqui é largura útil para as colunas. */
const MARGENS = { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 };

export interface OpcoesDeImpressao {
  /** Últimas linhas do topo a repetir em cada página — o cabeçalho da tabela. */
  repetirAte?: number;
  /** Em retrato, para as folhas estreitas que não ganham nada em ficar deitadas. */
  retrato?: boolean;
}

/**
 * Prepara uma folha para impressão: deitada, com todas as colunas na mesma
 * página e o cabeçalho repetido no topo de cada uma.
 */
export function prepararImpressao(folha: ExcelJS.Worksheet, opcoes: OpcoesDeImpressao = {}): void {
  folha.pageSetup = {
    ...folha.pageSetup,
    paperSize: A4,
    orientation: opcoes.retrato === true ? "portrait" : "landscape",
    // `fitToWidth: 1` com `fitToHeight: 0` é o que diz ao Excel «uma página de
    // largura, as que forem precisas de altura».
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: MARGENS,
    ...(opcoes.repetirAte === undefined ? {} : { printTitlesRow: `1:${opcoes.repetirAte}` }),
  };
}
