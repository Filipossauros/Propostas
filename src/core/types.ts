// Modelo de dados partilhado.
//
// O fluxo tem três papéis distintos, e o modelo acompanha-os:
//
//  1. O elemento técnico define um PERFIL (requisitos mínimos de experiência).
//     Nesta fase pré-contratual ainda não existe número de procedimento nem
//     agrupamento em lotes — por isso o perfil não os conhece.
//  2. O responsável do procedimento agrupa perfis em LOTES, atribuindo a cada
//     perfil dentro do lote as horas, o valor/hora e o n.º de elementos exigido.
//  3. O júri avalia declarações contra uma CONFIGURAÇÃO DE AVALIAÇÃO, derivada
//     de um perfil dentro de um lote (requisitos e n.º mínimo de elementos).

export const SCHEMA_VERSION_ATUAL = "2.0";

/** Intervalo de anos admitido em qualquer campo de data (configuração e formulário). */
export const ANO_MINIMO = 1910;
export const ANO_MAXIMO = 2035;

/** Meses num ano — só se admitem anos completos como exigência mínima. */
export const MESES_POR_ANO = 12;

export interface Requisito {
  id: string;
  designacao: string;
  /**
   * Exigência mínima em meses. Declarada em anos completos na interface e no
   * caderno de encargos, mas guardada e apurada em meses: a Regra A conta meses
   * de calendário, e as normas exprimem mínimos e apurados em meses inteiros.
   * É sempre múltiplo de MESES_POR_ANO.
   */
  mesesMinimos: number;
}

export function anosDeMeses(meses: number): number {
  return meses / MESES_POR_ANO;
}

export function mesesDeAnos(anos: number): number {
  return anos * MESES_POR_ANO;
}

// --------------------------------------------------------------------------
// Módulo 1 — perfil
// --------------------------------------------------------------------------

/**
 * Um perfil do Módulo 1.
 *
 * Não contém procedimento nem lote: nesta fase pré-contratual nenhum dos dois
 * existe ainda. O número do procedimento aparece apenas no formulário entregue
 * aos concorrentes, como campo que o próprio candidato preenche.
 */
export interface PerfilJSON {
  schemaVersion: string;
  tipo: "perfil";
  /**
   * Identidade estável do perfil, atribuída na criação e preservada na
   * importação/exportação. É o que permite que uma alteração aos requisitos
   * feita no Módulo 1 se propague ao mesmo perfil já atribuído a um lote.
   */
  id: string;
  /** Designação do perfil, ex.: "Arquiteto / Programador Sénior — Integração". */
  perfil: string;
  nBlocos: number;
  /**
   * Atividades que se espera que o perfil desempenhe, separadas por ponto e
   * vírgula. Só entra no documento Word: descreve o trabalho a contratar, e
   * não é matéria que o candidato declare no formulário — daí não aparecer em
   * nenhum Excel.
   */
  conteudoFuncional: string;
  requisitos: Requisito[];
}

/**
 * Saída do Módulo 1: um ficheiro único com todos os perfis definidos.
 *
 * A importação continua a aceitar ficheiros de perfil isolado (`tipo: "perfil"`),
 * gerados por versões anteriores, e admite carregar vários ficheiros de uma vez.
 */
export interface PerfisJSON {
  schemaVersion: string;
  tipo: "perfis";
  /** Nome do projeto a que os perfis pertencem — ver `LotesJSON.nomeProjeto`. */
  nomeProjeto: string;
  perfis: PerfilJSON[];
}

/** O que o gerador do formulário Excel precisa de saber. */
export interface EspecificacaoFormulario {
  perfil: string;
  nBlocos: number;
  requisitos: Requisito[];
  /**
   * Número e designação do lote, quando já se conhecem (formulário descarregado
   * a partir do Módulo 2, dentro de um lote). Pré-preenchem e bloqueiam os
   * campos de lote no formulário. Ausentes quando o formulário é gerado a
   * partir do Módulo 1, antes de o perfil ser agrupado em qualquer lote.
   */
  lote?: string;
  loteDesignacao?: string;
}

// --------------------------------------------------------------------------
// Módulo 2 — lotes
// --------------------------------------------------------------------------

/** Um perfil colocado dentro de um lote, com os parâmetros económicos do lote. */
export interface PerfilEmLote {
  id: string;
  perfil: PerfilJSON;
  /** Horas estimadas para o perfil dentro do lote. */
  horas: number;
  /** Preço/hora unitário considerado para o preço base. */
  valorHora: number;
  /** N.º mínimo de elementos que o concorrente tem de apresentar para este perfil. */
  nMinimoElementos: number;
}

export interface Lote {
  id: string;
  /** Número do lote, tal como aparecerá no caderno de encargos. */
  numero: string;
  designacao: string;
  perfis: PerfilEmLote[];
}

/** Saída do Módulo 2. Também não identifica o procedimento — ver PerfilJSON. */
export interface LotesJSON {
  schemaVersion: string;
  tipo: "lotes";
  /**
   * Nome do projeto, definido no Módulo 1 e comum a toda a aplicação. Vai em
   * cada ficheiro exportado, e não só no estado da sessão, porque os ficheiros
   * seguem para pessoas diferentes: quem recebe um agrupamento tem de saber a
   * que projeto pertence sem ter de perguntar. Dá também nome aos ficheiros
   * descarregados.
   */
  nomeProjeto: string;
  /**
   * Nome do procedimento, apenas para registo. Só o nome — o número ainda não
   * é conhecido nesta fase (à semelhança do perfil e do próprio agrupamento).
   */
  nomeProcedimento: string;
  /** Taxa de IVA em percentagem, aplicada aos preços base. */
  taxaIva: number;
  /**
   * Quando verdadeiro, a mesma entidade não pode ficar com mais do que um
   * lote. Os lotes são percorridos por ordem do respetivo número, e quem já
   * tenha ficado com um fica impedido nos seguintes.
   */
  umLotePorConcorrente: boolean;
  lotes: Lote[];
}

export const TAXA_IVA_PADRAO = 23;

// --------------------------------------------------------------------------
// Módulo 3 — avaliação
// --------------------------------------------------------------------------

/**
 * O que o núcleo de avaliação precisa. Combina um perfil (requisitos e blocos)
 * com os parâmetros que só se conhecem em fase de avaliação.
 */
export interface ConfiguracaoAvaliacao {
  perfil: string;
  nBlocos: number;
  requisitos: Requisito[];
  nMinimoElementos: number;
}

/**
 * Mês corrente, teto de qualquer data declarada.
 *
 * Substituiu a data limite para apresentação de propostas: experiência ainda
 * por acontecer não é experiência, e o mês corrente é um teto que não precisa
 * de ser configurado nem pode ser mal preenchido.
 */
export function mesAtual(agora: Date = new Date()): MesAno {
  return { ano: agora.getFullYear(), mes: agora.getMonth() + 1 };
}

// --------------------------------------------------------------------------
// Declarações lidas
// --------------------------------------------------------------------------

export interface MesAno {
  mes: number; // 1-12
  ano: number;
}

export type DeclaraExperiencia = "SIM" | "NÃO";

export interface LinhaRequisito {
  requisitoId: string;
  declara: DeclaraExperiencia | null;
  inicio: MesAno | null;
  fim: MesAno | null;
  /**
   * Início parcialmente preenchido (só mês ou só ano, não os dois). Distinto de
   * `inicio === null`, que também cobre "totalmente em branco" — caso em que a
   * experiência herda o período do projeto. Um preenchimento parcial não pode
   * ser confundido com essa herança: a Regra A anula a experiência da linha.
   */
  inicioIncompleto: boolean;
  fimIncompleto: boolean;
}

export interface Bloco {
  indice: number;
  cliente: string;
  projeto: string;
  funcao: string;
  projInicio: MesAno | null;
  projFim: MesAno | null;
  linhas: LinhaRequisito[];
}

export interface Identificacao {
  nome: string;
  entidadeConcorrente: string;
  procedimento: string;
  lote: string;
  loteDesignacao: string;
  perfil: string;
}

export type AlertaTipo =
  | "estruturaIncompativel"
  | "requisitosDivergentes"
  | "campoObrigatorioBranco"
  | "periodoForaDoProjeto"
  | "periodoNoFuturo"
  | "datasIncoerentes"
  | "identificacaoIncompleta"
  | "blocoIncompleto"
  | "divergenciaPdf";

export interface Alerta {
  tipo: AlertaTipo;
  mensagem: string;
  blocoIndice?: number;
  requisitoId?: string;
}

export interface Declaracao {
  /** Identificador único desta declaração dentro da sessão (nomes de ficheiro podem repetir-se). */
  id: string;
  ficheiro: string;
  identificacao: Identificacao;
  blocos: Bloco[];
  alertas: Alerta[];
}
