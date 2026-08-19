// Modelo de dados partilhado — ver PLANO.md secção 3.

export interface Requisito {
  id: string;
  designacao: string;
  versaoMinima: string | null;
  mesesMinimos: number;
}

export interface ConfiguracaoJSON {
  schemaVersion: string;
  templateVersion: string;
  procedimento: string;
  lote: string;
  perfil: string;
  nMinimoElementos: number;
  /** Data limite para apresentação de propostas, formato ISO "AAAA-MM-DD". */
  dataLimitePropostas: string;
  nBlocos: number;
  requisitos: Requisito[];
}

export const SCHEMA_VERSION_ATUAL = "1.0";

/** Intervalo de anos admitido em qualquer campo de data (configuração e formulário). */
export const ANO_MINIMO = 1910;
export const ANO_MAXIMO = 2035;

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
  lote: string;
  perfil: string;
}

export type AlertaTipo =
  | "estruturaIncompativel"
  | "requisitosDivergentes"
  | "campoObrigatorioBranco"
  | "periodoForaDoProjeto"
  | "datasIncoerentes"
  | "identificacaoIncompleta";

export interface Alerta {
  tipo: AlertaTipo;
  mensagem: string;
  blocoIndice?: number;
  requisitoId?: string;
}

export interface Declaracao {
  ficheiro: string;
  identificacao: Identificacao;
  blocos: Bloco[];
  alertas: Alerta[];
}
