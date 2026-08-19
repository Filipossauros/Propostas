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
//     de um perfil mais os parâmetros que só existem já em fase de avaliação
//     (data limite para apresentação de propostas).

export const SCHEMA_VERSION_ATUAL = "2.0";

/** Intervalo de anos admitido em qualquer campo de data (configuração e formulário). */
export const ANO_MINIMO = 1910;
export const ANO_MAXIMO = 2035;

export interface Requisito {
  id: string;
  designacao: string;
  mesesMinimos: number;
}

// --------------------------------------------------------------------------
// Módulo 1 — perfil
// --------------------------------------------------------------------------

/**
 * Saída do Módulo 1. Não contém lote (quem define o perfil não sabe como os
 * lotes serão agrupados) e o procedimento é opcional (pode ainda não ter número).
 */
export interface PerfilJSON {
  schemaVersion: string;
  tipo: "perfil";
  /** Número do procedimento, quando já existe. Vazio é válido. */
  procedimento: string;
  /** Designação do perfil, ex.: "Arquiteto / Programador Sénior — Integração". */
  perfil: string;
  nBlocos: number;
  requisitos: Requisito[];
}

/** O que o gerador do formulário Excel precisa de saber. */
export interface EspecificacaoFormulario {
  procedimento: string;
  perfil: string;
  nBlocos: number;
  requisitos: Requisito[];
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

/** Saída do Módulo 2. */
export interface LotesJSON {
  schemaVersion: string;
  tipo: "lotes";
  /** Número do procedimento, quando já existe. Vazio é válido. */
  procedimento: string;
  lotes: Lote[];
}

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
  /** Data limite para apresentação de propostas, formato ISO "AAAA-MM-DD". */
  dataLimitePropostas: string;
}

// --------------------------------------------------------------------------
// Declarações lidas
// --------------------------------------------------------------------------

export interface MesAno {
  mes: number; // 1-12
  ano: number;
}

export type DeclaraExperiencia = "SIM" | "NÃO";
export type SimNao = "Sim" | "Não";

export interface LinhaRequisito {
  requisitoId: string;
  declara: DeclaraExperiencia | null;
  inicio: MesAno | null;
  fim: MesAno | null;
}

export interface Bloco {
  indice: number;
  cliente: string;
  projeto: string;
  funcao: string;
  projInicio: MesAno | null;
  projFim: MesAno | null;
  emCurso: SimNao | null;
  linhas: LinhaRequisito[];
}

export interface Identificacao {
  nome: string;
  documento: string;
  entidadeConcorrente: string;
  procedimento: string;
  perfil: string;
}

export type AlertaTipo =
  | "estruturaIncompativel"
  | "requisitosDivergentes"
  | "campoObrigatorioBranco"
  | "periodoForaDoProjeto"
  | "datasIncoerentes"
  | "identificacaoIncompleta"
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
