// Margem prudencial do valor estimado.
//
// Os valores hora escritos no Módulo 3 são a média das rates das propostas dos
// últimos procedimentos de natureza equivalente. A margem, quando a há, é uma
// percentagem aplicada a cada um deles; com ela crescem o valor de cada perfil,
// de cada lote, de cada ano e do procedimento. Por isso aplica-se num sítio só,
// ao agrupamento inteiro, antes de qualquer peça ser gerada: todos os quadros
// batem certo uns com os outros e com o valor estimado.
//
// O agrupamento gravado guarda sempre os valores hora de referência e a margem
// à parte — é a margem, e não o valor já acrescido, que se decide.

import type { LotesJSON } from "./types";

// Sem importar de `lotes.ts`, que lê daqui o texto por omissão.
const formatarNumero = (valor: number) =>
  new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 }).format(valor);

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

/** O texto por omissão para uma margem. */
export function justificacaoPorOmissao(margem: number): string {
  return margem > 0 ? justificacaoComMargem(margem) : JUSTIFICACAO_SEM_MARGEM;
}

/**
 * Se um fundamento é um dos textos por omissão — de 0 % ou de outra margem —,
 * e não um texto escrito à mão. É o que decide se, ao mudar a margem, o
 * fundamento acompanha a mudança ou fica como a pessoa o deixou.
 */
export function ehJustificacaoPorOmissao(texto: string): boolean {
  const t = texto.trim();
  if (t === "" || t === JUSTIFICACAO_SEM_MARGEM) return true;
  const modelo = justificacaoComMargem(0).replace("0 %", "");
  return (
    t.replace(
      /^A margem prudencial de [\d\s.,]+ %/,
      "A margem prudencial de ",
    ) === modelo
  );
}

/** A margem como valor válido: um número finito, não negativo. */
export function margemDe(config: Pick<LotesJSON, "margemPrudencial">): number {
  const m = config.margemPrudencial;
  return Number.isFinite(m) && m > 0 ? m : 0;
}

function centimos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * O agrupamento com a margem aplicada: o valor hora de cada perfil cresce na
 * percentagem da margem, arredondado ao cêntimo. Sem margem, o próprio.
 */
export function comMargemPrudencial(
  config: LotesJSON,
  margem = margemDe(config),
): LotesJSON {
  if (!(margem > 0)) return config;
  return {
    ...config,
    lotes: config.lotes.map((lote) => ({
      ...lote,
      perfis: lote.perfis.map((entrada) => ({
        ...entrada,
        valorHora: centimos(entrada.valorHora * (1 + margem / 100)),
      })),
    })),
  };
}
