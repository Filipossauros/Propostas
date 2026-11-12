// O pedido de licenciamento: o modelo, os cálculos e a validação.
//
// Quatro módulos partilham este pedido — 1 Produto, L1 Licenças, L2 Condições
// e L3 Pedido. O que se adquire é um produto (um software, mas também uma
// terminologia como a SNOMED CT, uma norma ou um conteúdo), e cada licença é
// uma linha do mapa de quantidades e preços.
//
// O único aspeto submetido à concorrência é o preço. Tudo o resto — o que a
// licença tem de permitir, a métrica, a manutenção, os níveis de serviço — são
// termos e condições do contrato, e saem nas Especificações Técnicas.
//
// Há duas naturezas de aquisição, e cada uma descreve a licença de forma
// diferente:
//   · aberta à concorrência — descreve-se a necessidade (requisitos mínimos),
//     sem marca nem fabricante; o produto concreto só se conhece na proposta;
//   · licença determinada — identifica-se a licença, o fabricante ou titular
//     dos direitos e a versão, e fundamenta-se a escolha (art.º 24.º do CCP).
//
// A classificação eAvalia decorre, quase toda, destas escolhas: o tipo, do
// direito de uso; o tipo de licenciamento, da modalidade; a consulta ao
// mercado e (na aberta) o tipo de solução, da natureza. Só o âmbito — e o tipo
// de solução na licença determinada — se escolhem.

import type { ItemPerfil, JuriTecnico, JustificacaoProjeto } from "./types";
import { ANOS_PLURIANUAIS, SCHEMA_VERSION_ATUAL, TAXA_IVA_PADRAO, juriInicial } from "./types";
import { gerarId } from "./id";
import type { ErroValidacao } from "./perfil";
import { ErroImportacao, normalizarItens } from "./perfil";
import { justificacaoInicial, normalizarJustificacao, semBeneficioFixo } from "./justificacao";

// --------------------------------------------------------------------------
// As listas do eAvalia («Custos - Licenciamento»), tal como vêm na folha
// «Backup» do modelo — uma letra diferente e a célula recusava o valor.
// --------------------------------------------------------------------------

export const TIPOS_SOLUCAO_EAVALIA = [
  "Solução Software Livre",
  "Software Proprietário sem alternativas",
  "Software Proprietário com apresentação TCO",
  "Submissão à concorrência",
] as const;
export type TipoSolucaoEavalia = (typeof TIPOS_SOLUCAO_EAVALIA)[number];

/** Os tipos de solução que se escolhem numa licença determinada (na aberta é sempre a submissão à concorrência). */
export const TIPOS_SOLUCAO_DETERMINADA = [
  "Software Proprietário sem alternativas",
  "Software Proprietário com apresentação TCO",
  "Solução Software Livre",
] as const satisfies readonly TipoSolucaoEavalia[];
export type TipoSolucaoDeterminada = (typeof TIPOS_SOLUCAO_DETERMINADA)[number];

/** O que cada tipo de solução quer dizer, para quem escolhe. */
export const EXPLICACAO_TIPOS_SOLUCAO: Record<TipoSolucaoDeterminada, string> = {
  "Solução Software Livre":
    "Software de código aberto, sem custo de licença. Pode haver custo de suporte. No eAvalia vai para a secção " +
    "«Software de Código Aberto».",
  "Software Proprietário sem alternativas":
    "Não existe alternativa no mercado: plataforma já instalada, direitos exclusivos ou renovação. É o caso da " +
    "SNOMED CT.",
  "Software Proprietário com apresentação TCO":
    "Há alternativas, e a escolha justifica-se pelo custo total de posse: aquisição, migração, formação, manutenção " +
    "e saída. Obriga a juntar essa análise ao pedido.",
};

export type TipoEavalia = "Licenças" | "Subscrição ou SaaS";

export const AMBITOS_EAVALIA = ["Produtividade", "Servidor", "Gestão Documental", "Outro"] as const;
export type AmbitoEavalia = (typeof AMBITOS_EAVALIA)[number];

export type TipoLicenciamentoEavalia = "Aquisição novas licenças" | "Actualizações/Upgrades/Correções";
/** Como o tipo de licenciamento se lê no ecrã; o ficheiro leva o valor exato da lista do modelo. */
export const ROTULO_TIPO_LICENCIAMENTO: Record<TipoLicenciamentoEavalia, string> = {
  "Aquisição novas licenças": "Aquisição de novas licenças",
  "Actualizações/Upgrades/Correções": "Atualizações / upgrades / correções",
};

export type RespostaConsultaMercado = "Sim" | "Não";

/** O que se escolhe da classificação eAvalia; o resto decorre das outras escolhas. */
export interface ClassificacaoEavalia {
  /** Só conta na licença determinada. */
  tipoSolucao: TipoSolucaoDeterminada | "";
  ambito: AmbitoEavalia | "";
}

// --------------------------------------------------------------------------
// A licença (L1)
// --------------------------------------------------------------------------

export type NaturezaAquisicao = "aberta" | "determinado";

export const FUNDAMENTOS_LICENCA = {
  plataformaInstalada: "Plataforma já instalada — continuidade e compatibilidade técnica",
  direitosExclusivos: "Direitos exclusivos do fabricante ou titular (art.º 24.º, n.º 1, alínea e), do CCP)",
  renovacao: "Renovação de licenças existentes",
  outro: "Outro",
} as const;
export type FundamentoLicenca = keyof typeof FUNDAMENTOS_LICENCA | "";

export type ObjetoLicenca = "software" | "terminologia" | "outro";
export const OBJETOS_LICENCA: Record<ObjetoLicenca, string> = {
  software: "Software",
  terminologia: "Terminologia, norma ou conteúdo",
  outro: "Outro (indicar)",
};

export type DireitoUso = "temporario" | "perpetuo";
export const DIREITOS_USO: Record<DireitoUso, string> = {
  temporario: "Temporário (subscrição)",
  perpetuo: "Perpétuo",
};

export type Modalidade = "aquisicao" | "renovacao" | "upgrade" | "alargamento";
export const MODALIDADES: Record<Modalidade, string> = {
  aquisicao: "Aquisição de novas licenças",
  renovacao: "Renovação",
  upgrade: "Atualização / upgrade",
  alargamento: "Alargamento de quantidades",
};

export type Manutencao = "incluida" | "aParte" | "naoAplicavel";
export const MANUTENCOES: Record<Manutencao, string> = {
  incluida: "Incluída no preço",
  aParte: "Linha própria no mapa de preços",
  naoAplicavel: "Não contratada",
};

export type PeriodicidadePreco = "mensal" | "anual";
export const PERIODICIDADES: Record<PeriodicidadePreco, string> = { mensal: "Mensal", anual: "Anual" };

export type Metrica =
  | ""
  | "utilizadorNomeado"
  | "utilizadorConcorrente"
  | "dispositivo"
  | "core"
  | "instancia"
  | "volume"
  | "nacional"
  | "institucional";
/** A métrica no singular e no plural: «1 utilizador nomeado», «1 200 utilizadores nomeados». */
export const METRICAS: Record<Exclude<Metrica, "">, { singular: string; plural: string }> = {
  utilizadorNomeado: { singular: "Utilizador nomeado", plural: "Utilizadores nomeados" },
  utilizadorConcorrente: { singular: "Utilizador concorrente", plural: "Utilizadores concorrentes" },
  dispositivo: { singular: "Dispositivo", plural: "Dispositivos" },
  core: { singular: "Core / processador", plural: "Cores / processadores" },
  instancia: { singular: "Instância / servidor", plural: "Instâncias / servidores" },
  volume: { singular: "Unidade de volume (transações, GB…)", plural: "Unidades de volume" },
  nacional: { singular: "Licença nacional (território)", plural: "Licenças nacionais" },
  institucional: { singular: "Licença institucional (entidade)", plural: "Licenças institucionais" },
};
/** As métricas de licença única: a quantidade é sempre 1. */
export const METRICAS_UNICAS: ReadonlyArray<Exclude<Metrica, "">> = ["nacional", "institucional"];

export type OrigemPreco = "" | "consultaPreliminar" | "procedimentoAnterior" | "tabelaPublica";
export const ORIGENS_PRECO: Record<Exclude<OrigemPreco, "">, string> = {
  consultaPreliminar: "Consulta preliminar ao mercado (art.º 35.º-A do CCP)",
  procedimentoAnterior: "Procedimento anterior",
  tabelaPublica: "Tabela pública do fabricante ou titular",
};

/** O prazo máximo de vigência (art.º 48.º do CCP): três anos, como na bolsa de horas. */
export const MESES_MAXIMOS = ANOS_PLURIANUAIS * 12;

export interface Licenca {
  id: string;
  // Aberta à concorrência: a descrição, sem marca.
  /** Designação da licença no procedimento, ex.: «Plataforma de gestão documental». */
  designacao: string;
  requisitosFuncionais: ItemPerfil[];
  requisitosTecnicos: ItemPerfil[];
  // Licença determinada: a identificação e o fundamento.
  /** A licença como o fabricante ou titular a designa, ex.: «Afiliação nacional SNOMED International». */
  nomeComercial: string;
  /** O fabricante ou o titular dos direitos. */
  fabricante: string;
  versao: string;
  fundamento: FundamentoLicenca;
  /** A explicação do fundamento — sai na manifestação. */
  explicacaoFundamento: string;
  // Tipo de licenciamento.
  objeto: ObjetoLicenca;
  /** O objeto, quando é «outro». */
  objetoOutro: string;
  direitoUso: DireitoUso;
  modalidade: Modalidade;
  /** Duração da subscrição, ou da manutenção, em meses. */
  periodoMeses: number;
  manutencao: Manutencao;
  /** Percentagem anual de referência da manutenção, sobre o valor das licenças, quando tem linha própria. */
  percentagemManutencao: number;
  eavalia: ClassificacaoEavalia;
  // Métrica, quantidade e preço de referência.
  metrica: Metrica;
  quantidade: number;
  /** Na subscrição, se o preço é por mês ou por ano. */
  periodicidadePreco: PeriodicidadePreco;
  /**
   * Preço unitário de referência sem IVA: por mês ou por ano, na subscrição; de
   * uma vez, na licença perpétua.
   */
  precoUnitario: number;
  origemPreco: OrigemPreco;
  /**
   * A referência da origem do preço: o n.º do procedimento anterior, ou a
   * ligação (ou indicação) da tabela pública.
   */
  referenciaPreco: string;
}

// --------------------------------------------------------------------------
// As condições do contrato (L2)
// --------------------------------------------------------------------------

export type HorarioSuporte = "uteis" | "7dias" | "personalizado";
export const HORARIOS_SUPORTE: Record<HorarioSuporte, string> = {
  uteis: "Dias úteis",
  "7dias": "7 dias por semana",
  personalizado: "Personalizado",
};

export interface TemposDeSeveridade {
  resposta: number;
  resolucao: number;
}

/**
 * Os textos das condições: `null` é o texto por omissão, que acompanha as
 * licenças do L1 enquanto não for alterado à mão.
 */
export interface CondicoesContrato {
  ambito: { texto: string | null; entidades: string; naoProdutivosSemCusto: boolean };
  direitoUso: { texto: string | null; sublicenciamento: boolean; transmissao: boolean };
  manutencao: { texto: string | null };
  suporte: {
    ligada: boolean;
    texto: string | null;
    horario: HorarioSuporte;
    /** Os dias, quando o horário é personalizado: «Dias úteis e sábados». */
    diasPersonalizados: string;
    horaInicio: string;
    horaFim: string;
    critica: TemposDeSeveridade;
    alta: TemposDeSeveridade;
    normal: TemposDeSeveridade;
  };
  disponibilidade: { ligada: boolean; texto: string | null; percentagem: number; janelasForaDoHorario: boolean };
  /** Facultativas: podem ficar para a formulação do contrato. */
  penalizacoes: { ligada: boolean; texto: string | null; porHoraCritica: number; limiteMensal: number; limiteGlobal: number };
  prazo: { ligada: boolean; texto: string | null; diasUteis: number };
  proprias: Array<{ id: string; titulo: string; texto: string }>;
}

export type CondicaoComTexto = "ambito" | "direitoUso" | "manutencao" | "suporte" | "disponibilidade" | "penalizacoes" | "prazo";

/** O limite das penalizações (art.º 329.º, n.º 2, do CCP): 20 % do preço contratual. */
export const LIMITE_GLOBAL_PENALIZACOES = 20;

/** Para quem escolhe: o que são o sublicenciamento e a transmissão, e o que muda com eles. */
export const EXPLICACAO_SUBLICENCIAMENTO =
  "Sublicenciar é a entidade adjudicante poder autorizar terceiros a usar a licença que adquiriu — por exemplo, " +
  "outras entidades do SNS ou as empresas de software que desenvolvem sistemas para elas —, dentro do âmbito, do " +
  "período e das quantidades contratados e sem que cada um tenha de pagar a sua. A licença continua a ser da " +
  "entidade adjudicante, que responde pelo uso que os sublicenciados dela fizerem. Sem esta cláusula, a licença " +
  "só pode ser usada por quem a adquiriu, porque o titular dos direitos é que decide quem a pode usar. É " +
  "frequente nas licenças de âmbito nacional.";

export const EXPLICACAO_TRANSMISSAO =
  "Transmitir é passar a licença, por inteiro e sem custo, para outra entidade do SNS — por exemplo, quando os " +
  "serviços que a usam são integrados noutra entidade, como aconteceu com a criação das Unidades Locais de Saúde. " +
  "A licença continua a valer nas mesmas condições (âmbito, quantidades e prazo); muda apenas quem a detém. Sem " +
  "esta cláusula, a passagem para outra entidade fica dependente do acordo do titular dos direitos, que a pode " +
  "recusar ou cobrar. Não se confunde com o sublicenciamento: aqui quem adquiriu deixa de ser o titular da " +
  "licença.";

export const EXPLICACAO_NAO_PRODUTIVOS =
  "Num software instalado, cada cópia em funcionamento pode contar como uma licença. Com esta opção, as cópias " +
  "usadas só para testes, formação e recuperação de desastre não contam para a quantidade contratada nem se pagam " +
  "à parte. Só se aplica a licenças de software.";

export function condicoesIniciais(): CondicoesContrato {
  return {
    ambito: { texto: null, entidades: "", naoProdutivosSemCusto: true },
    direitoUso: { texto: null, sublicenciamento: false, transmissao: true },
    manutencao: { texto: null },
    suporte: {
      ligada: true,
      texto: null,
      horario: "uteis",
      diasPersonalizados: "",
      horaInicio: "09:00",
      horaFim: "18:00",
      critica: { resposta: 2, resolucao: 8 },
      alta: { resposta: 4, resolucao: 24 },
      normal: { resposta: 8, resolucao: 72 },
    },
    disponibilidade: { ligada: true, texto: null, percentagem: 99.5, janelasForaDoHorario: true },
    penalizacoes: { ligada: false, texto: null, porHoraCritica: 0.5, limiteMensal: 10, limiteGlobal: 20 },
    prazo: { ligada: true, texto: null, diasUteis: 10 },
    proprias: [],
  };
}

// --------------------------------------------------------------------------
// O pedido
// --------------------------------------------------------------------------

export interface LoteLicenca {
  id: string;
  numero: string;
  designacao: string;
  licencaIds: string[];
}

export interface PedidoLicenciamento {
  schemaVersion: string;
  tipo: "licenciamento";
  /** O produto (Módulo 1 do licenciamento) — próprio deste pedido, e não o projeto da bolsa de horas. */
  nomeProduto: string;
  descricaoProduto: string;
  justificacao: JustificacaoProjeto;
  natureza: NaturezaAquisicao;
  licencas: Licenca[];
  condicoes: CondicoesContrato;
  lotes: LoteLicenca[];
  umLotePorConcorrente: boolean;
  encargosPlurianuais: { ativo: boolean; anoInicio: number };
  taxaIva: number;
  margemPrudencial: number;
  justificacaoMargem: string;
  juri: JuriTecnico;
  numeroInformacao: string;
  numeroOrcamento: string;
}

export const PREFIXO_NOME_PROCEDIMENTO_LICENCIAMENTO = "Aquisição de Licenciamento de ";

export function nomeProcedimentoLicenciamento(nomeProduto: string): string {
  const nome = nomeProduto.trim();
  return nome === "" ? "" : `${PREFIXO_NOME_PROCEDIMENTO_LICENCIAMENTO}${nome}`;
}

/** O fundamento da margem a 0 %, por omissão — no licenciamento, os preços vêm do mercado. */
export const JUSTIFICACAO_SEM_MARGEM_LICENCIAMENTO =
  "Não foi aplicada margem prudencial autónoma ao valor estimado. Os preços unitários considerados resultam da " +
  "consulta ao mercado, de procedimentos anteriores ou da tabela pública do fabricante ou titular, conforme " +
  "indicado para cada licença, refletindo os preços efetivamente praticados. Considera-se, assim, que a margem " +
  "prudencial se encontra incorporada nos valores unitários adotados, os quais asseguram, com razoabilidade, a " +
  "suficiência do valor estimado para a satisfação da necessidade identificada.";

export function justificacaoMargemLicenciamento(margem: number): string {
  if (!(margem > 0)) return JUSTIFICACAO_SEM_MARGEM_LICENCIAMENTO;
  return (
    `A margem prudencial de ${formatarNumeroLic(margem)} % destina-se a acautelar a variação dos preços de tabela ` +
    "dos fabricantes e titulares e das condições de mercado até à adjudicação e ao longo da execução do contrato, e " +
    "é aplicada ao preço unitário de cada licença, refletindo-se em todos os valores por licença, por lote e por " +
    "ano apresentados na presente informação."
  );
}

export function ehJustificacaoMargemPorOmissao(texto: string): boolean {
  const t = texto.trim();
  if (t === "" || t === JUSTIFICACAO_SEM_MARGEM_LICENCIAMENTO) return true;
  const modelo = justificacaoMargemLicenciamento(1).replace(/^A margem prudencial de 1 %/, "");
  return t.replace(/^A margem prudencial de [\d\s.,]+ %/, "") === modelo;
}

function formatarNumeroLic(valor: number): string {
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 }).format(valor);
}

export function criarLicenca(): Licenca {
  return {
    id: gerarId(),
    designacao: "",
    requisitosFuncionais: [],
    requisitosTecnicos: [],
    nomeComercial: "",
    fabricante: "",
    versao: "",
    fundamento: "",
    explicacaoFundamento: "",
    objeto: "software",
    objetoOutro: "",
    direitoUso: "temporario",
    modalidade: "aquisicao",
    periodoMeses: 12,
    manutencao: "incluida",
    percentagemManutencao: 0,
    eavalia: { tipoSolucao: "", ambito: "" },
    metrica: "",
    quantidade: 0,
    periodicidadePreco: "mensal",
    precoUnitario: 0,
    origemPreco: "",
    referenciaPreco: "",
  };
}

export function pedidoLicenciamentoInicial(anoInicio = new Date().getFullYear()): PedidoLicenciamento {
  return {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    tipo: "licenciamento",
    nomeProduto: "",
    descricaoProduto: "",
    justificacao: justificacaoInicial(),
    natureza: "aberta",
    licencas: [],
    condicoes: condicoesIniciais(),
    lotes: [],
    umLotePorConcorrente: false,
    encargosPlurianuais: { ativo: false, anoInicio },
    taxaIva: TAXA_IVA_PADRAO,
    margemPrudencial: 0,
    justificacaoMargem: JUSTIFICACAO_SEM_MARGEM_LICENCIAMENTO,
    juri: juriInicial(),
    numeroInformacao: "",
    numeroOrcamento: "",
  };
}

/**
 * A licença com uma alteração, e com o que dela depende: a manutenção em linha
 * própria só existe na licença perpétua, o preço anual ou mensal só na
 * subscrição, e as métricas de licença única fixam a quantidade em 1.
 */
export function comAlteracao(licenca: Licenca, alteracao: Partial<Licenca>): Licenca {
  const nova = { ...licenca, ...alteracao };
  if (nova.direitoUso === "temporario" && nova.manutencao === "aParte") nova.manutencao = "incluida";
  if (nova.metrica !== "" && METRICAS_UNICAS.includes(nova.metrica)) nova.quantidade = 1;
  return nova;
}

// --------------------------------------------------------------------------
// eAvalia — o que decorre das escolhas
// --------------------------------------------------------------------------

export function tipoSolucaoEavalia(l: Licenca, natureza: NaturezaAquisicao): TipoSolucaoEavalia | "" {
  return natureza === "aberta" ? "Submissão à concorrência" : l.eavalia.tipoSolucao;
}

export function tipoEavalia(l: Pick<Licenca, "direitoUso">): TipoEavalia {
  return l.direitoUso === "temporario" ? "Subscrição ou SaaS" : "Licenças";
}

export function tipoLicenciamentoEavalia(l: Pick<Licenca, "modalidade">): TipoLicenciamentoEavalia {
  return l.modalidade === "aquisicao" || l.modalidade === "alargamento"
    ? "Aquisição novas licenças"
    : "Actualizações/Upgrades/Correções";
}

export function consultaMercadoEavalia(natureza: NaturezaAquisicao): RespostaConsultaMercado {
  return natureza === "aberta" ? "Sim" : "Não";
}

// --------------------------------------------------------------------------
// Nomes
// --------------------------------------------------------------------------

/** O nome da licença como sai nos quadros: a designação, ou a licença e o fabricante ou titular. */
export function nomeDaLicenca(l: Licenca, natureza: NaturezaAquisicao): string {
  if (natureza === "aberta") return l.designacao.trim();
  const nome = l.nomeComercial.trim();
  const fabricante = l.fabricante.trim();
  if (nome === "") return "";
  return fabricante === "" ? nome : `${nome} — ${fabricante}`;
}

export function objetoPorExtenso(l: Pick<Licenca, "objeto" | "objetoOutro">): string {
  if (l.objeto === "outro") return l.objetoOutro.trim() || "Outro";
  return OBJETOS_LICENCA[l.objeto];
}

export function metricaPorExtenso(l: Pick<Licenca, "metrica" | "quantidade">): string {
  if (l.metrica === "") return "";
  const m = METRICAS[l.metrica];
  return (l.quantidade === 1 ? m.singular : m.plural).toLowerCase();
}

export function resumoDoTipo(l: Licenca): string {
  const objeto = objetoPorExtenso(l);
  if (l.direitoUso === "temporario")
    return `${objeto} · Subscrição ${l.periodicidadePreco === "anual" ? "anual" : "mensal"} · ${l.periodoMeses} meses`;
  const manut =
    l.manutencao === "aParte"
      ? ` + manutenção em linha própria (${l.periodoMeses} meses)`
      : l.manutencao === "incluida"
        ? ` · manutenção incluída (${l.periodoMeses} meses)`
        : "";
  return `${objeto} · Licenças perpétuas${manut}`;
}

/** A origem do preço, com a referência: «Procedimento anterior (n.º 123/2025)». */
export function origemPorExtenso(l: Pick<Licenca, "origemPreco" | "referenciaPreco">): string {
  if (l.origemPreco === "") return "";
  const ref = l.referenciaPreco.trim();
  if (l.origemPreco === "procedimentoAnterior" && ref) return `${ORIGENS_PRECO.procedimentoAnterior} (n.º ${ref})`;
  if (l.origemPreco === "tabelaPublica" && ref) return `${ORIGENS_PRECO.tabelaPublica} (${ref})`;
  return ORIGENS_PRECO[l.origemPreco];
}

// --------------------------------------------------------------------------
// Cálculos
// --------------------------------------------------------------------------

function centimos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function num(valor: number): number {
  return Number.isFinite(valor) && valor > 0 ? valor : 0;
}

export function margemDoPedido(pedido: Pick<PedidoLicenciamento, "margemPrudencial">): number {
  return num(pedido.margemPrudencial);
}

/** O preço unitário com a margem prudencial, arredondado ao cêntimo. */
export function precoComMargem(preco: number, margem: number): number {
  return margem > 0 ? centimos(num(preco) * (1 + margem / 100)) : num(preco);
}

/** O pedido com a margem aplicada aos preços unitários — o que sai em todas as peças. */
export function comMargemLicenciamento(pedido: PedidoLicenciamento): PedidoLicenciamento {
  const margem = margemDoPedido(pedido);
  if (!(margem > 0)) return pedido;
  return {
    ...pedido,
    licencas: pedido.licencas.map((l) => ({ ...l, precoUnitario: precoComMargem(l.precoUnitario, margem) })),
  };
}

/** Quantos meses do período caem em cada ano do contrato, a começar em janeiro do primeiro. */
export function mesesPorAno(meses: number, nAnos: number): number[] {
  return Array.from({ length: nAnos }, (_v, i) => Math.max(0, Math.min(12, num(meses) - 12 * i)));
}

export interface ValorDaLicenca {
  /** Licenças ou subscrição, sem IVA. */
  licencas: number;
  /** Manutenção em linha própria, sem IVA (0 quando incluída ou não contratada). */
  manutencao: number;
  /** Manutenção de um ano. */
  manutencaoAnual: number;
  total: number;
  /** O total repartido pelos anos do contrato. */
  porAno: number[];
}

/** O preço da subscrição por mês, de uma unidade: o mensal, ou o anual a dividir por 12. */
function precoMensal(l: Licenca): number {
  return l.periodicidadePreco === "anual" ? num(l.precoUnitario) / 12 : num(l.precoUnitario);
}

/**
 * O valor de uma licença, sem IVA, com os preços como estão (aplique-se antes a
 * margem, se for caso disso).
 *
 *   subscrição: quantidade × preço × períodos (meses, ou anos), repartido mês a mês;
 *   perpétua:   quantidade × preço, no primeiro ano, e a manutenção em linha
 *               própria — a percentagem anual sobre esse valor, pelos meses do período.
 */
export function valorDaLicenca(l: Licenca, nAnos = 1): ValorDaLicenca {
  const qtd = num(l.quantidade);
  const meses = Math.min(num(l.periodoMeses), MESES_MAXIMOS);
  const anos = Math.max(1, nAnos);
  const acerta = (porAno: number[], total: number) => {
    // Sem anos bastantes (pedido sem encargos plurianuais), o resto cabe no último.
    porAno[porAno.length - 1] = centimos(porAno[porAno.length - 1] + total - porAno.reduce((s, v) => s + v, 0));
    return porAno;
  };
  if (l.direitoUso === "temporario") {
    const mensal = qtd * precoMensal(l);
    const total = centimos(mensal * meses);
    const porAno = acerta(
      mesesPorAno(meses, anos).map((m) => centimos(mensal * m)),
      total,
    );
    return { licencas: total, manutencao: 0, manutencaoAnual: 0, total, porAno };
  }
  const licencas = centimos(qtd * num(l.precoUnitario));
  const manutencaoAnual = l.manutencao === "aParte" ? centimos((licencas * num(l.percentagemManutencao)) / 100) : 0;
  const manutencao = centimos((manutencaoAnual * meses) / 12);
  const total = centimos(licencas + manutencao);
  const porAno = acerta(
    mesesPorAno(meses, anos).map((m, i) => centimos((i === 0 ? licencas : 0) + (manutencaoAnual * m) / 12)),
    total,
  );
  return { licencas, manutencao, manutencaoAnual, total, porAno };
}

/** Uma linha do mapa de quantidades e preços: a licença, ou a sua manutenção em linha própria. */
export interface LinhaDoMapa {
  licenca: Licenca;
  tipo: "licenca" | "manutencao";
  designacao: string;
  metrica: string;
  quantidade: number;
  /** Quantos períodos de preço (meses, anos, ou 1 na licença perpétua). */
  periodos: number;
  /** Como se lê o preço unitário: «€ por licença e por mês», «€ por ano»… */
  unidade: string;
  precoUnitario: number;
  total: number;
}

export function linhasDoMapa(l: Licenca, natureza: NaturezaAquisicao, nAnos = 1): LinhaDoMapa[] {
  const valor = valorDaLicenca(l, nAnos);
  const nome = nomeDaLicenca(l, natureza) || "Licença";
  const meses = Math.min(num(l.periodoMeses), MESES_MAXIMOS);
  const metrica = l.metrica === "" ? "" : METRICAS[l.metrica].plural;
  if (l.direitoUso === "temporario") {
    const anual = l.periodicidadePreco === "anual";
    return [
      {
        licenca: l,
        tipo: "licenca",
        designacao: nome,
        metrica,
        quantidade: l.quantidade,
        periodos: anual ? meses / 12 : meses,
        unidade: anual ? "€ por licença e por ano" : "€ por licença e por mês",
        precoUnitario: l.precoUnitario,
        total: valor.licencas,
      },
    ];
  }
  const linhas: LinhaDoMapa[] = [
    {
      licenca: l,
      tipo: "licenca",
      designacao: `${nome} — licenças perpétuas`,
      metrica,
      quantidade: l.quantidade,
      periodos: 1,
      unidade: l.manutencao === "incluida" ? "€ por licença (perpétua, com manutenção)" : "€ por licença (perpétua)",
      precoUnitario: l.precoUnitario,
      total: valor.licencas,
    },
  ];
  if (l.manutencao === "aParte") {
    linhas.push({
      licenca: l,
      tipo: "manutencao",
      designacao: `Manutenção e suporte — ${nome}`,
      metrica: "Ano de manutenção",
      quantidade: 1,
      periodos: meses / 12,
      unidade: "€ por ano",
      precoUnitario: valor.manutencaoAnual,
      total: valor.manutencao,
    });
  }
  return linhas;
}

/** Os meses do contrato: o maior período das licenças (pelo menos 1). */
export function mesesDoContrato(pedido: Pick<PedidoLicenciamento, "licencas">): number {
  return Math.max(1, ...pedido.licencas.map((l) => Math.min(num(l.periodoMeses), MESES_MAXIMOS)));
}

/** Os anos económicos do contrato: com encargos plurianuais, tantos quantos o período abranja. */
export function anosDoPedido(pedido: PedidoLicenciamento): number[] {
  const inicio = pedido.encargosPlurianuais.anoInicio;
  if (!pedido.encargosPlurianuais.ativo) return [inicio];
  const n = Math.max(1, Math.ceil(mesesDoContrato(pedido) / 12));
  return Array.from({ length: n }, (_v, i) => inicio + i);
}

export interface ValoresComIva {
  semIva: number;
  iva: number;
  comIva: number;
}

export function comIva(semIva: number, taxa: number): ValoresComIva {
  const s = centimos(semIva);
  const iva = centimos((s * num(taxa)) / 100);
  return { semIva: s, iva, comIva: centimos(s + iva) };
}

export interface LinhaDoLote {
  licenca: Licenca;
  valor: ValorDaLicenca;
}

export interface ValoresDoLote {
  lote: LoteLicenca;
  linhas: LinhaDoLote[];
  porAno: number[];
  total: number;
}

/** O valor de cada lote, com os preços como estão no pedido recebido. */
export function valoresDosLotes(pedido: PedidoLicenciamento): ValoresDoLote[] {
  const nAnos = anosDoPedido(pedido).length;
  const porId = new Map(pedido.licencas.map((l) => [l.id, l]));
  return lotesEfetivos(pedido).map((lote) => {
    const linhas = lote.licencaIds
      .map((id) => porId.get(id))
      .filter((l): l is Licenca => l !== undefined)
      .map((licenca) => ({ licenca, valor: valorDaLicenca(licenca, nAnos) }));
    const porAno = Array.from({ length: nAnos }, (_v, i) =>
      centimos(linhas.reduce((s, l) => s + l.valor.porAno[i], 0)),
    );
    return { lote, linhas, porAno, total: centimos(linhas.reduce((s, l) => s + l.valor.total, 0)) };
  });
}

/** O valor estimado do contrato, sem IVA, com os preços como estão no pedido recebido. */
export function valorEstimado(pedido: PedidoLicenciamento): number {
  const nAnos = anosDoPedido(pedido).length;
  return centimos(pedido.licencas.reduce((s, l) => s + valorDaLicenca(l, nAnos).total, 0));
}

export function valorPorAno(pedido: PedidoLicenciamento): number[] {
  const nAnos = anosDoPedido(pedido).length;
  return Array.from({ length: nAnos }, (_v, i) =>
    centimos(pedido.licencas.reduce((s, l) => s + valorDaLicenca(l, nAnos).porAno[i], 0)),
  );
}

// --------------------------------------------------------------------------
// Lotes
// --------------------------------------------------------------------------

/**
 * Os lotes como devem ficar: sem licenças que já não existam, sem lotes vazios,
 * cada licença por atribuir num lote próprio (é a omissão: um lote por
 * licença), numerados de 1 em diante.
 */
export function lotesEfetivos(pedido: Pick<PedidoLicenciamento, "licencas" | "lotes">): LoteLicenca[] {
  const existentes = new Set(pedido.licencas.map((l) => l.id));
  const vistos = new Set<string>();
  const lotes: LoteLicenca[] = [];
  for (const lote of pedido.lotes) {
    const ids = lote.licencaIds.filter((id) => existentes.has(id) && !vistos.has(id));
    ids.forEach((id) => vistos.add(id));
    if (ids.length > 0) lotes.push({ ...lote, licencaIds: ids });
  }
  for (const l of pedido.licencas) {
    if (!vistos.has(l.id)) lotes.push({ id: `lote-${l.id}`, numero: "", designacao: "", licencaIds: [l.id] });
  }
  return lotes.map((l, i) => ({ ...l, numero: String(i + 1) }));
}

/** A designação de um lote: a escrita, ou o nome da licença quando é só uma. */
export function designacaoDoLote(lote: LoteLicenca, pedido: PedidoLicenciamento): string {
  if (lote.designacao.trim() !== "") return lote.designacao.trim();
  if (lote.licencaIds.length === 1) {
    const l = pedido.licencas.find((x) => x.id === lote.licencaIds[0]);
    if (l) return nomeDaLicenca(l, pedido.natureza);
  }
  return `Lote ${lote.numero}`;
}

/** Muda uma licença de lote (ou para um lote novo, com `destino` nulo). */
export function moverLicencaParaLote(
  pedido: PedidoLicenciamento,
  licencaId: string,
  destino: string | null,
): PedidoLicenciamento {
  const lotes = lotesEfetivos(pedido).map((l) => ({ ...l, licencaIds: l.licencaIds.filter((id) => id !== licencaId) }));
  if (destino === null) lotes.push({ id: gerarId(), numero: "", designacao: "", licencaIds: [licencaId] });
  else {
    const alvo = lotes.find((l) => l.id === destino);
    if (alvo) alvo.licencaIds.push(licencaId);
  }
  return { ...pedido, lotes: lotesEfetivos({ ...pedido, lotes }) };
}

// --------------------------------------------------------------------------
// Condições: o que se aplica e os textos por omissão
// --------------------------------------------------------------------------

function objetos(pedido: Pick<PedidoLicenciamento, "licencas">): Set<ObjetoLicenca> {
  return new Set(pedido.licencas.map((l) => l.objeto));
}

const temSoftware = (p: Pick<PedidoLicenciamento, "licencas">) => objetos(p).has("software");
const temNacional = (p: Pick<PedidoLicenciamento, "licencas">) => p.licencas.some((l) => l.metrica === "nacional");

/** Se uma condição se aplica às licenças do L1, e, quando não, porquê. */
export function aplicabilidade(chave: CondicaoComTexto, pedido: PedidoLicenciamento): { aplica: boolean; razao: string } {
  const sim = { aplica: true, razao: "" };
  if (pedido.licencas.length === 0) return sim;
  if (chave === "manutencao") {
    const alguma = pedido.licencas.some((l) => l.direitoUso === "temporario" || l.manutencao !== "naoAplicavel");
    return alguma ? sim : { aplica: false, razao: "Todas as licenças do L1 são perpétuas e sem manutenção contratada." };
  }
  if (chave === "disponibilidade") {
    const saas = pedido.licencas.some((l) => l.objeto === "software" && l.direitoUso === "temporario");
    return saas ? sim : { aplica: false, razao: "Nenhuma licença do L1 é software em subscrição (SaaS)." };
  }
  return sim;
}

/** Se a opção dos ambientes não produtivos se aplica: só há cópias por contar no software. */
export function aplicaNaoProdutivos(pedido: PedidoLicenciamento): boolean {
  return pedido.licencas.length === 0 || temSoftware(pedido);
}

/** O título da condição da manutenção, conforme o que se licencia. */
export function tituloDaManutencao(pedido: Pick<PedidoLicenciamento, "licencas">): string {
  const o = objetos(pedido);
  const software = o.has("software");
  const outros = o.has("terminologia") || o.has("outro");
  if (software && outros) return "Manutenção, atualizações e novas edições";
  return outros ? "Atualizações e novas edições" : "Manutenção e atualizações";
}

/** Os textos por omissão, escritos a partir das licenças do L1. */
export function textoPorOmissao(chave: CondicaoComTexto, pedido: PedidoLicenciamento): string {
  const o = objetos(pedido);
  const software = o.size === 0 || o.has("software");
  const outros = o.has("terminologia") || o.has("outro");
  const temporario = pedido.licencas.length === 0 || pedido.licencas.some((l) => l.direitoUso === "temporario");
  const perpetuo = pedido.licencas.some((l) => l.direitoUso === "perpetuo");
  switch (chave) {
    case "ambito":
      return temNacional(pedido)
        ? "Utilização em todo o território nacional, pelas entidades e utilizadores abrangidos pela licença, em " +
            "todos os sistemas e ambientes em que seja integrada, sem custo adicional para os utilizadores finais."
        : "Utilização pela SPMS, E.P.E. e pelas entidades do Serviço Nacional de Saúde indicadas, sem limite " +
            "geográfico dentro do território nacional" +
            (software ? ", em todos os ambientes (produção, teste, formação e recuperação)." : ".");
    case "direitoUso": {
      const partes: string[] = [];
      if (temporario) partes.push("pelo período contratado, no caso das licenças em subscrição");
      if (perpetuo) partes.push("por tempo indeterminado, no caso das licenças perpétuas adquiridas");
      return `Direito de uso não exclusivo das licenças, ${partes.join(", e ")}, nos termos do âmbito contratado.`;
    }
    case "manutencao": {
      const frases: string[] = [];
      if (software)
        frases.push(
          "acesso a todas as correções, novas versões e atualizações de segurança do software publicadas pelo fabricante",
        );
      if (outros)
        frases.push("acesso a todas as edições e atualizações publicadas pelo titular, e aos meios da sua distribuição");
      return `Durante a vigência do contrato, ${frases.join("; e ")}, sem custo adicional para a entidade adjudicante.`;
    }
    case "suporte":
      return software && !outros
        ? "Suporte técnico em língua portuguesa, com tempos máximos de resposta e de resolução por severidade do " +
            "incidente."
        : "Apoio à utilização e ao acesso às edições, em língua portuguesa ou inglesa, com tempos máximos de " +
            "resposta e de resolução por severidade do pedido.";
    case "disponibilidade":
      return (
        "Disponibilidade mensal mínima do serviço, medida pelo adjudicatário e reportada mensalmente ao gestor do " +
        "contrato, excluídas as janelas de manutenção previamente acordadas."
      );
    case "penalizacoes":
      return (
        "Pelo incumprimento dos níveis de serviço, o adjudicatário fica sujeito a penalizações contratuais, sem " +
        "prejuízo da resolução do contrato nos termos legais."
      );
    case "prazo":
      return (
        "Licenças e acessos disponibilizados à entidade adjudicante no prazo máximo indicado, a contar da data de " +
        "assinatura do contrato."
      );
  }
}

/**
 * O texto de uma condição: o escrito à mão, ou o por omissão. O direito de uso
 * não tem texto livre: sai sempre o padronizado, com as opções escolhidas.
 */
export function textoDaCondicao(chave: CondicaoComTexto, pedido: PedidoLicenciamento): string {
  if (chave === "direitoUso") return textoPorOmissao(chave, pedido);
  return pedido.condicoes[chave].texto ?? textoPorOmissao(chave, pedido);
}

/** As frases das opções do direito de uso, como saem no Anexo III. */
export function frasesDoDireitoDeUso(c: CondicoesContrato["direitoUso"]): string[] {
  return [
    ...(c.sublicenciamento
      ? [
          "A entidade adjudicante pode sublicenciar a utilização das licenças às entidades e aos fornecedores " +
            "abrangidos pelo âmbito da licença, dentro do período e das quantidades contratados, sem encargos " +
            "adicionais, respondendo pelo uso que os sublicenciados delas fizerem.",
        ]
      : []),
    ...(c.transmissao
      ? [
          "As licenças podem ser transmitidas, por inteiro e sem custo, a outra entidade do Serviço Nacional de " +
            "Saúde, mantendo-se as condições do contrato.",
        ]
      : []),
  ];
}

const HORA = /^([01]\d|2[0-4]):([0-5]\d)$/;

function minutos(hora: string): number {
  const m = HORA.exec(hora.trim());
  return m === null ? Number.NaN : Number(m[1]) * 60 + Number(m[2]);
}

/** «Dias úteis, das 09:00 às 18:00», «Todos os dias, 24 horas por dia»… */
export function horarioPorExtenso(s: CondicoesContrato["suporte"]): string {
  const dias =
    s.horario === "uteis"
      ? "Dias úteis"
      : s.horario === "7dias"
        ? "Todos os dias, incluindo fins de semana e feriados"
        : s.diasPersonalizados.trim() || "[dias]";
  const continuo = minutos(s.horaInicio) === 0 && minutos(s.horaFim) === 24 * 60;
  return continuo ? `${dias}, 24 horas por dia` : `${dias}, das ${s.horaInicio.trim()} às ${s.horaFim.trim()}`;
}

// --------------------------------------------------------------------------
// Validação
// --------------------------------------------------------------------------

function falta(campo: string, mensagem: string): ErroValidacao {
  return { campo, mensagem };
}

/** O que falta no produto (Módulo 1 do licenciamento). */
export function validarProdutoLicenciamento(
  pedido: Pick<PedidoLicenciamento, "nomeProduto" | "descricaoProduto" | "justificacao">,
): ErroValidacao[] {
  const erros: ErroValidacao[] = [];
  if (pedido.nomeProduto.trim() === "") erros.push(falta("nomeProduto", "Indique o nome do produto."));
  if (pedido.descricaoProduto.trim() === "") erros.push(falta("descricaoProduto", "Descreva o produto."));
  const lista = (itens: ItemPerfil[], campo: string, vazia: string, nome: string) => {
    if (itens.filter((i) => i.designacao.trim() !== "").length === 0) erros.push(falta(campo, vazia));
    else if (itens.some((i) => i.designacao.trim() === ""))
      erros.push(falta(campo, `Há ${nome} por escrever — preencha-os ou remova-os.`));
  };
  lista(pedido.justificacao.objetivos, "justificacao.objetivos", "Indique pelo menos um objetivo da aquisição.", "objetivos");
  lista(pedido.justificacao.beneficios, "justificacao.beneficios", "Indique pelo menos um benefício do produto.", "benefícios");
  lista(pedido.justificacao.riscos, "justificacao.riscos", "Indique pelo menos um risco da não aquisição.", "riscos");
  return erros;
}

/** O que falta numa licença (L1). */
export function validarLicenca(l: Licenca, natureza: NaturezaAquisicao): ErroValidacao[] {
  const erros: ErroValidacao[] = [];
  const nome = nomeDaLicenca(l, natureza) || "Licença sem nome";
  const de = (texto: string) => falta(l.id, `${nome}: ${texto}`);
  if (natureza === "aberta") {
    if (l.designacao.trim() === "") erros.push(de("indique a designação da licença no procedimento."));
    if (l.requisitosFuncionais.filter((r) => r.designacao.trim() !== "").length === 0)
      erros.push(de("indique pelo menos um requisito funcional mínimo."));
    if (l.requisitosFuncionais.some((r) => r.designacao.trim() === "") || l.requisitosTecnicos.some((r) => r.designacao.trim() === ""))
      erros.push(de("há requisitos por escrever — preencha-os ou remova-os."));
  } else {
    if (l.nomeComercial.trim() === "") erros.push(de("indique a licença."));
    if (l.fabricante.trim() === "") erros.push(de("indique o fabricante ou titular dos direitos."));
    if (l.fundamento === "") erros.push(de("escolha o fundamento da escolha da licença."));
    if (l.explicacaoFundamento.trim() === "") erros.push(de("explique o fundamento da escolha da licença."));
    if (l.eavalia.tipoSolucao === "") erros.push(de("escolha o tipo de solução (eAvalia)."));
  }
  if (l.objeto === "outro" && l.objetoOutro.trim() === "") erros.push(de("indique o objeto da licença."));
  if (!Number.isInteger(l.periodoMeses) || l.periodoMeses < 1)
    erros.push(de("o período tem de ser um número inteiro de meses."));
  else if (l.periodoMeses > MESES_MAXIMOS)
    erros.push(de(`o período não pode exceder ${MESES_MAXIMOS} meses (art.º 48.º do CCP).`));
  else if (l.direitoUso === "temporario" && l.periodicidadePreco === "anual" && l.periodoMeses % 12 !== 0)
    erros.push(de("com preço anual, o período tem de ser de anos completos (12, 24 ou 36 meses)."));
  if (l.direitoUso === "perpetuo" && l.manutencao === "aParte" && !(l.percentagemManutencao > 0))
    erros.push(de("indique a percentagem anual de referência da manutenção."));
  if (l.eavalia.ambito === "") erros.push(de("escolha o âmbito (eAvalia)."));
  if (l.metrica === "") erros.push(de("escolha a métrica de licenciamento."));
  if (!Number.isInteger(l.quantidade) || l.quantidade < 1) erros.push(de("a quantidade tem de ser um número inteiro positivo."));
  if (!(l.precoUnitario > 0)) erros.push(de("falta o preço unitário de referência."));
  if (l.origemPreco === "") erros.push(de("indique a origem do preço de referência."));
  else if (l.origemPreco === "procedimentoAnterior" && l.referenciaPreco.trim() === "")
    erros.push(de("indique o n.º do procedimento anterior."));
  else if (l.origemPreco === "tabelaPublica" && l.referenciaPreco.trim() === "")
    erros.push(de("indique a ligação ou a referência da tabela pública."));
  return erros;
}

/** Quantos blocos de licença tem cada secção da folha «Custos - Licenciamento». */
export const LICENCAS_POR_SECCAO_EAVALIA = 20;

/** O que falta nas licenças (L1). */
export function validarLicencas(pedido: PedidoLicenciamento): ErroValidacao[] {
  if (pedido.licencas.length === 0) return [falta("licencas", "Acrescente pelo menos uma licença.")];
  const erros = pedido.licencas.flatMap((l) => validarLicenca(l, pedido.natureza));
  const livres = pedido.licencas.filter((l) => tipoSolucaoEavalia(l, pedido.natureza) === "Solução Software Livre").length;
  if (livres > LICENCAS_POR_SECCAO_EAVALIA || pedido.licencas.length - livres > LICENCAS_POR_SECCAO_EAVALIA)
    erros.push(falta("licencas", `O formulário eAvalia comporta ${LICENCAS_POR_SECCAO_EAVALIA} licenças por secção.`));
  return erros;
}

/** O que falta nas condições do contrato (L2), só nas que se aplicam e estão ligadas. */
export function validarCondicoes(pedido: PedidoLicenciamento): ErroValidacao[] {
  const c = pedido.condicoes;
  const erros: ErroValidacao[] = [];
  const texto = (chave: CondicaoComTexto, nome: string) => {
    if (textoDaCondicao(chave, pedido).trim() === "") erros.push(falta(chave, `${nome}: escreva o texto da condição.`));
  };
  texto("ambito", "Âmbito da licença");
  if (aplicabilidade("manutencao", pedido).aplica) texto("manutencao", tituloDaManutencao(pedido));
  if (c.suporte.ligada) {
    texto("suporte", "Suporte técnico e SLA");
    if (c.suporte.horario === "personalizado" && c.suporte.diasPersonalizados.trim() === "")
      erros.push(falta("suporte", "Suporte técnico e SLA: indique os dias do horário personalizado."));
    const [inicio, fim] = [minutos(c.suporte.horaInicio), minutos(c.suporte.horaFim)];
    if (Number.isNaN(inicio) || Number.isNaN(fim))
      erros.push(falta("suporte", "Suporte técnico e SLA: escreva as horas no formato 09:00."));
    else if (fim <= inicio)
      erros.push(falta("suporte", "Suporte técnico e SLA: a hora de fim tem de ser depois da de início."));
    for (const [nome, t] of [
      ["crítica", c.suporte.critica],
      ["alta", c.suporte.alta],
      ["normal", c.suporte.normal],
    ] as const) {
      if (!(t.resposta > 0) || !(t.resolucao > 0))
        erros.push(falta("suporte", `Suporte técnico e SLA: indique os tempos da severidade ${nome}.`));
      else if (t.resolucao < t.resposta)
        erros.push(falta("suporte", `Suporte técnico e SLA: na severidade ${nome}, a resolução não pode ser antes da resposta.`));
    }
  }
  if (c.disponibilidade.ligada && aplicabilidade("disponibilidade", pedido).aplica) {
    texto("disponibilidade", "Disponibilidade");
    if (!(c.disponibilidade.percentagem > 0 && c.disponibilidade.percentagem <= 100))
      erros.push(falta("disponibilidade", "Disponibilidade: a percentagem tem de estar entre 0 e 100 %."));
  }
  if (c.penalizacoes.ligada) {
    texto("penalizacoes", "Penalizações");
    if (!(c.penalizacoes.porHoraCritica > 0))
      erros.push(falta("penalizacoes", "Penalizações: indique a penalização por hora de atraso."));
    if (!(c.penalizacoes.limiteMensal > 0)) erros.push(falta("penalizacoes", "Penalizações: indique o limite mensal."));
    if (!(c.penalizacoes.limiteGlobal > 0) || c.penalizacoes.limiteGlobal > LIMITE_GLOBAL_PENALIZACOES)
      erros.push(
        falta(
          "penalizacoes",
          `Penalizações: o limite global tem de estar entre 0 e ${LIMITE_GLOBAL_PENALIZACOES} % do valor do contrato (art.º 329.º do CCP).`,
        ),
      );
  }
  if (c.prazo.ligada) {
    texto("prazo", "Prazo de disponibilização");
    if (!(Number.isInteger(c.prazo.diasUteis) && c.prazo.diasUteis > 0))
      erros.push(falta("prazo", "Prazo de disponibilização: indique o número de dias úteis."));
  }
  c.proprias.forEach((p, i) => {
    if (p.titulo.trim() === "" || p.texto.trim() === "")
      erros.push(falta(p.id, `Condição própria ${i + 1}: escreva o título e o texto.`));
  });
  return erros;
}

/** O que falta no pedido (L3): parâmetros, margem e júri. */
export function validarPedido(pedido: PedidoLicenciamento): ErroValidacao[] {
  const erros: ErroValidacao[] = [];
  if (!(pedido.taxaIva >= 0)) erros.push(falta("taxaIva", "A taxa de IVA tem de ser um número não negativo."));
  if (!(pedido.margemPrudencial >= 0))
    erros.push(falta("margemPrudencial", "A margem prudencial tem de ser um número não negativo."));
  if (pedido.justificacaoMargem.trim() === "")
    erros.push(falta("justificacaoMargem", "Escreva o fundamento da margem prudencial."));
  if (pedido.licencas.some((l) => l.periodoMeses > 12) && !pedido.encargosPlurianuais.ativo)
    erros.push(
      falta("encargosPlurianuais", "Há licenças com período superior a 12 meses: assinale o pedido de encargos plurianuais."),
    );
  const nomes: Array<[keyof JuriTecnico, string]> = [
    ["diretor", "o diretor"],
    ["coordenador", "o coordenador"],
    ["unidade", "a unidade do coordenador"],
    ["gestorProjeto", "o gestor do produto"],
  ];
  for (const [campo, nome] of nomes) {
    if (pedido.juri[campo].trim() === "") erros.push(falta(`juri.${campo}`, `Júri técnico: indique ${nome}.`));
  }
  return erros;
}

// --------------------------------------------------------------------------
// Ficheiros (JSON) e normalização
// --------------------------------------------------------------------------

export function pedidoLicenciamentoParaJSON(pedido: PedidoLicenciamento): string {
  return JSON.stringify({ ...pedido, lotes: lotesEfetivos(pedido) }, null, 2);
}

/** O ficheiro do produto: só o Módulo 1 do licenciamento. */
export interface ProdutoJSON {
  schemaVersion: string;
  tipo: "produto";
  nomeProduto: string;
  descricaoProduto: string;
  justificacao: JustificacaoProjeto;
}

export function produtoParaJSON(pedido: Pick<PedidoLicenciamento, "nomeProduto" | "descricaoProduto" | "justificacao">): string {
  const ficheiro: ProdutoJSON = {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    tipo: "produto",
    nomeProduto: pedido.nomeProduto,
    descricaoProduto: pedido.descricaoProduto,
    justificacao: pedido.justificacao,
  };
  return JSON.stringify(ficheiro, null, 2);
}

export interface ProdutoImportado {
  nomeProduto: string;
  descricaoProduto: string;
  justificacao: JustificacaoProjeto;
  origem: "produto" | "licenciamento" | "projeto";
}

/** Lê o produto de um ficheiro: o do produto, o do pedido de licenciamento ou o de um projeto. */
export function importarProdutoJSON(conteudo: string): ProdutoImportado {
  const r = analisar(conteudo);
  if (r.schemaVersion !== SCHEMA_VERSION_ATUAL) {
    throw new ErroImportacao(
      `Versão de esquema desconhecida ("${String(r.schemaVersion)}"). Esta aplicação suporta a versão "${SCHEMA_VERSION_ATUAL}".`,
    );
  }
  const justificacao = r.justificacao === undefined ? justificacaoInicial() : normalizarJustificacao(r.justificacao);
  if (r.tipo === "produto" || r.tipo === "licenciamento") {
    return {
      nomeProduto: texto(r.nomeProduto ?? r.nomeProjeto),
      descricaoProduto: texto(r.descricaoProduto ?? r.descricaoProjeto),
      justificacao,
      origem: r.tipo,
    };
  }
  if (r.tipo === "projeto") {
    return { nomeProduto: texto(r.nomeProjeto), descricaoProduto: texto(r.descricaoProjeto), justificacao, origem: "projeto" };
  }
  throw new ErroImportacao(
    `Este ficheiro é do tipo "${String(r.tipo)}". Carregue o JSON do produto, do pedido de licenciamento ou de um projeto.`,
  );
}

function analisar(conteudo: string): Record<string, unknown> {
  let bruto: unknown;
  try {
    bruto = JSON.parse(conteudo);
  } catch {
    throw new ErroImportacao("O ficheiro não contém JSON válido.");
  }
  return objeto(bruto);
}

function texto(v: unknown, omissao = ""): string {
  return typeof v === "string" ? v : omissao;
}

function textoOuNulo(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function numero(v: unknown, omissao = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : omissao;
}

function booleano(v: unknown, omissao: boolean): boolean {
  return typeof v === "boolean" ? v : omissao;
}

function deLista<T extends string>(v: unknown, lista: readonly T[], omissao: T | ""): T | "" {
  return typeof v === "string" && (lista as readonly string[]).includes(v) ? (v as T) : omissao;
}

function objeto(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function chaves<T extends string>(registo: Record<T, unknown>): T[] {
  return Object.keys(registo) as T[];
}

function normalizarLicenca(bruto: unknown): Licenca {
  const r = objeto(bruto);
  const base = criarLicenca();
  const e = objeto(r.eavalia);
  const licenca: Licenca = {
    id: texto(r.id) || base.id,
    designacao: texto(r.designacao),
    requisitosFuncionais: normalizarItens(r.requisitosFuncionais),
    requisitosTecnicos: normalizarItens(r.requisitosTecnicos),
    // Pedidos anteriores chamavam «produto» ao nome comercial.
    nomeComercial: texto(r.nomeComercial ?? r.produto),
    fabricante: texto(r.fabricante),
    versao: texto(r.versao),
    fundamento: deLista(r.fundamento, chaves(FUNDAMENTOS_LICENCA), ""),
    explicacaoFundamento: texto(r.explicacaoFundamento),
    objeto: deLista(r.objeto, chaves(OBJETOS_LICENCA), "") || "software",
    objetoOutro: texto(r.objetoOutro),
    direitoUso: deLista(r.direitoUso, chaves(DIREITOS_USO), "") || base.direitoUso,
    modalidade: deLista(r.modalidade, chaves(MODALIDADES), "") || base.modalidade,
    periodoMeses: numero(r.periodoMeses, base.periodoMeses),
    manutencao: deLista(r.manutencao, chaves(MANUTENCOES), "") || base.manutencao,
    percentagemManutencao: numero(r.percentagemManutencao),
    eavalia: {
      // A submissão à concorrência já não se guarda: decorre da natureza aberta.
      tipoSolucao: deLista(e.tipoSolucao, TIPOS_SOLUCAO_DETERMINADA, ""),
      ambito: deLista(e.ambito, AMBITOS_EAVALIA, ""),
    },
    metrica: deLista(r.metrica, chaves(METRICAS), ""),
    quantidade: numero(r.quantidade),
    periodicidadePreco: r.periodicidadePreco === "anual" ? "anual" : "mensal",
    precoUnitario: numero(r.precoUnitario),
    origemPreco: deLista(r.origemPreco, chaves(ORIGENS_PRECO), ""),
    referenciaPreco: texto(r.referenciaPreco),
  };
  return comAlteracao(licenca, {});
}

/**
 * Os textos de condições gravados por versões anteriores: os que eram os
 * textos por omissão de então passam a acompanhar as licenças.
 */
const TEXTOS_ANTERIORES = new Set([
  "Utilização pela SPMS, E.P.E. e pelas entidades do Serviço Nacional de Saúde indicadas, em todos os ambientes (produção, teste, formação e recuperação), sem limite geográfico dentro do território nacional.",
  "Direito de uso pelo período contratado ou, quando adquirido em regime perpétuo, sem limite temporal, intransmissível a terceiros alheios ao Serviço Nacional de Saúde.",
  "Acesso, durante a vigência do contrato, a todas as correções, versões e atualizações de segurança publicadas pelo fabricante, sem custo adicional para a entidade adjudicante.",
  "Suporte técnico em língua portuguesa, com tempos máximos de resposta e de resolução por severidade do incidente. O incumprimento destes tempos dá lugar às penalizações previstas.",
  "Disponibilidade mensal mínima do serviço, medida pelo adjudicatário e reportada mensalmente ao gestor do contrato, excluídas as janelas de manutenção previamente acordadas.",
  "Pelo incumprimento dos níveis de serviço, o adjudicatário fica sujeito a penalizações contratuais, sem prejuízo da resolução do contrato nos termos legais.",
  "Licenças e acessos disponibilizados à entidade adjudicante no prazo máximo indicado, a contar da data de assinatura do contrato.",
]);

function textoDeCondicao(v: unknown): string | null {
  const t = textoOuNulo(v);
  return t === null || TEXTOS_ANTERIORES.has(t.trim()) ? null : t;
}

function normalizarCondicoes(bruto: unknown): CondicoesContrato {
  const base = condicoesIniciais();
  const r = objeto(bruto);
  const sev = (v: unknown, o: TemposDeSeveridade): TemposDeSeveridade => {
    const s = objeto(v);
    return { resposta: numero(s.resposta, o.resposta), resolucao: numero(s.resolucao, o.resolucao) };
  };
  const a = objeto(r.ambito);
  const d = objeto(r.direitoUso);
  const m = objeto(r.manutencao);
  const s = objeto(r.suporte);
  const di = objeto(r.disponibilidade);
  const pe = objeto(r.penalizacoes);
  const pr = objeto(r.prazo);
  // O antigo «24x7» é o horário de 7 dias, 24 horas por dia.
  const horario: HorarioSuporte = s.horario === "24x7" ? "7dias" : deLista(s.horario, chaves(HORARIOS_SUPORTE), "") || "uteis";
  return {
    ambito: {
      texto: textoDeCondicao(a.texto),
      entidades: texto(a.entidades),
      naoProdutivosSemCusto: booleano(a.naoProdutivosSemCusto, base.ambito.naoProdutivosSemCusto),
    },
    direitoUso: {
      // Sem texto livre: sai sempre o padronizado.
      texto: null,
      sublicenciamento: booleano(d.sublicenciamento, false),
      transmissao: booleano(d.transmissao, true),
    },
    manutencao: { texto: textoDeCondicao(m.texto) },
    suporte: {
      ligada: booleano(s.ligada, true),
      texto: textoDeCondicao(s.texto),
      horario,
      diasPersonalizados: texto(s.diasPersonalizados),
      horaInicio: texto(s.horaInicio, s.horario === "24x7" ? "00:00" : base.suporte.horaInicio),
      horaFim: texto(s.horaFim, s.horario === "24x7" ? "24:00" : base.suporte.horaFim),
      critica: sev(s.critica, base.suporte.critica),
      alta: sev(s.alta, base.suporte.alta),
      normal: sev(s.normal, base.suporte.normal),
    },
    disponibilidade: {
      ligada: booleano(di.ligada, true),
      texto: textoDeCondicao(di.texto),
      percentagem: numero(di.percentagem, base.disponibilidade.percentagem),
      janelasForaDoHorario: booleano(di.janelasForaDoHorario, true),
    },
    penalizacoes: {
      ligada: booleano(pe.ligada, false),
      texto: textoDeCondicao(pe.texto),
      porHoraCritica: numero(pe.porHoraCritica, base.penalizacoes.porHoraCritica),
      limiteMensal: numero(pe.limiteMensal, base.penalizacoes.limiteMensal),
      limiteGlobal: numero(pe.limiteGlobal, base.penalizacoes.limiteGlobal),
    },
    prazo: {
      ligada: booleano(pr.ligada, true),
      texto: textoDeCondicao(pr.texto),
      diasUteis: numero(pr.diasUteis, base.prazo.diasUteis),
    },
    proprias: Array.isArray(r.proprias)
      ? r.proprias.map((x) => {
          const o = objeto(x);
          return { id: texto(o.id) || gerarId(), titulo: texto(o.titulo), texto: texto(o.texto) };
        })
      : [],
  };
}

/**
 * O pedido recuperado de um ficheiro ou do navegador, com o que falte reposto
 * por omissão. Aceita os pedidos da versão anterior (produtos em vez de
 * licenças, projeto em vez de produto).
 */
export function normalizarPedidoLicenciamento(bruto: unknown): PedidoLicenciamento {
  const r = objeto(bruto);
  const base = pedidoLicenciamentoInicial();
  const enc = objeto(r.encargosPlurianuais);
  const juri = objeto(r.juri);
  const brutas = Array.isArray(r.licencas) ? r.licencas : Array.isArray(r.produtos) ? r.produtos : [];
  const lotes: LoteLicenca[] = Array.isArray(r.lotes)
    ? r.lotes.map((l) => {
        const o = objeto(l);
        const ids = Array.isArray(o.licencaIds) ? o.licencaIds : Array.isArray(o.produtoIds) ? o.produtoIds : [];
        return {
          id: texto(o.id) || gerarId(),
          numero: texto(o.numero),
          designacao: texto(o.designacao),
          licencaIds: ids.filter((x): x is string => typeof x === "string"),
        };
      })
    : [];
  const pedido: PedidoLicenciamento = {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    tipo: "licenciamento",
    nomeProduto: texto(r.nomeProduto ?? r.nomeProjeto),
    descricaoProduto: texto(r.descricaoProduto ?? r.descricaoProjeto),
    justificacao:
      r.justificacao === undefined
        ? justificacaoInicial()
        : (() => {
            const j = normalizarJustificacao(r.justificacao);
            return { ...j, beneficios: semBeneficioFixo(j.beneficios) };
          })(),
    natureza: r.natureza === "determinado" ? "determinado" : "aberta",
    licencas: brutas.map(normalizarLicenca),
    condicoes: normalizarCondicoes(r.condicoes),
    lotes,
    umLotePorConcorrente: booleano(r.umLotePorConcorrente, false),
    encargosPlurianuais: {
      ativo: booleano(enc.ativo, false),
      anoInicio: numero(enc.anoInicio, base.encargosPlurianuais.anoInicio),
    },
    taxaIva: numero(r.taxaIva, TAXA_IVA_PADRAO),
    margemPrudencial: numero(r.margemPrudencial, 0),
    justificacaoMargem: texto(r.justificacaoMargem, base.justificacaoMargem),
    juri: {
      diretor: texto(juri.diretor),
      coordenador: texto(juri.coordenador),
      unidade: texto(juri.unidade),
      gestorProjeto: texto(juri.gestorProjeto),
    },
    numeroInformacao: texto(r.numeroInformacao),
    numeroOrcamento: texto(r.numeroOrcamento),
  };
  return { ...pedido, lotes: lotesEfetivos(pedido) };
}

export function ehPedidoLicenciamentoGuardado(valor: unknown): valor is PedidoLicenciamento {
  const r = objeto(valor);
  return r.tipo === "licenciamento" && (Array.isArray(r.licencas) || Array.isArray(r.produtos));
}

export function importarPedidoLicenciamentoJSON(conteudo: string): PedidoLicenciamento {
  const r = analisar(conteudo);
  if (r.tipo !== "licenciamento") {
    throw new ErroImportacao(
      `Este ficheiro é do tipo "${String(r.tipo)}". Carregue o JSON de um pedido de licenciamento.`,
    );
  }
  if (r.schemaVersion !== SCHEMA_VERSION_ATUAL) {
    throw new ErroImportacao(
      `Versão de esquema desconhecida ("${String(r.schemaVersion)}"). ` +
        `Esta aplicação suporta a versão "${SCHEMA_VERSION_ATUAL}".`,
    );
  }
  return normalizarPedidoLicenciamento(r);
}

// --------------------------------------------------------------------------
// Exemplo
// --------------------------------------------------------------------------

function itensExemplo(prefixo: string, textos: string[]): ItemPerfil[] {
  return textos.map((designacao, i) => ({ id: `${prefixo}${i + 1}`, designacao }));
}

const JURI_EXEMPLO: JuriTecnico = {
  diretor: "Nome do Diretor",
  coordenador: "Nome do Coordenador",
  unidade: "Unidade de Planeamento, Arquitetura, Conformidade e Engenharia",
  gestorProjeto: "Nome do Gestor do Produto",
};

/**
 * O exemplo: a SNOMED CT, uma licença determinada de terminologia, de âmbito
 * nacional, em subscrição anual — o caso que não é software.
 */
export function pedidoLicenciamentoExemplo(anoInicio = new Date().getFullYear()): PedidoLicenciamento {
  const snomed: Licenca = {
    ...criarLicenca(),
    id: "lic-snomed",
    designacao: "Licença nacional de terminologia clínica de referência",
    requisitosFuncionais: itensExemplo("lic-snomed-f", [
      "Utilização da terminologia em todo o território nacional, por entidades públicas e privadas",
      "Acesso às edições internacionais e à criação da extensão nacional",
    ]),
    nomeComercial: "Afiliação nacional SNOMED International",
    fabricante: "SNOMED International",
    versao: "International Edition",
    fundamento: "direitosExclusivos",
    explicacaoFundamento:
      "A SNOMED International é a única entidade que licencia a SNOMED CT; a afiliação nacional cobre a sua " +
      "utilização em todo o território.",
    objeto: "terminologia",
    direitoUso: "temporario",
    modalidade: "renovacao",
    periodoMeses: 36,
    manutencao: "incluida",
    eavalia: { tipoSolucao: "Software Proprietário sem alternativas", ambito: "Outro" },
    metrica: "nacional",
    quantidade: 1,
    periodicidadePreco: "anual",
    precoUnitario: 120000,
    origemPreco: "tabelaPublica",
    referenciaPreco: "https://www.snomed.org/member-fees",
  };
  const pedido = pedidoLicenciamentoInicial(anoInicio);
  return {
    ...pedido,
    ...PRODUTO_LICENCIAMENTO_EXEMPLO,
    natureza: "determinado",
    licencas: [snomed],
    condicoes: {
      ...pedido.condicoes,
      suporte: {
        ...pedido.condicoes.suporte,
        critica: { resposta: 4, resolucao: 24 },
        alta: { resposta: 8, resolucao: 48 },
        normal: { resposta: 24, resolucao: 120 },
      },
    },
    lotes: [{ id: "lote-snomed", numero: "1", designacao: "", licencaIds: ["lic-snomed"] }],
    encargosPlurianuais: { ativo: true, anoInicio },
    juri: { ...JURI_EXEMPLO },
  };
}

/** Um segundo exemplo, de software: aberta à concorrência, subscrição e licença perpétua com manutenção. */
export function pedidoLicenciamentoExemploSoftware(anoInicio = new Date().getFullYear()): PedidoLicenciamento {
  const gestao: Licenca = {
    ...criarLicenca(),
    id: "lic-gd",
    designacao: "Plataforma de gestão documental",
    requisitosFuncionais: itensExemplo("lic-gd-f", [
      "Gestão de documentos com versões, classificação e pesquisa de texto integral",
      "Fluxos de aprovação configuráveis sem programação",
      "Assinatura eletrónica qualificada integrada",
      "Integração por API REST com os sistemas da SPMS",
    ]),
    requisitosTecnicos: itensExemplo("lic-gd-t", ["Autenticação por SSO (SAML 2.0 / OIDC)", "Alojamento dos dados na União Europeia"]),
    direitoUso: "temporario",
    modalidade: "aquisicao",
    periodoMeses: 36,
    eavalia: { tipoSolucao: "", ambito: "Gestão Documental" },
    metrica: "utilizadorNomeado",
    quantidade: 1200,
    precoUnitario: 14.5,
    origemPreco: "consultaPreliminar",
  };
  const bd: Licenca = {
    ...criarLicenca(),
    id: "lic-bd",
    designacao: "Sistema de gestão de base de dados relacional",
    requisitosFuncionais: itensExemplo("lic-bd-f", [
      "Replicação síncrona entre dois centros de dados",
      "Cópias de segurança em linha, sem paragem do serviço",
    ]),
    requisitosTecnicos: itensExemplo("lic-bd-t", ["Suporte a SQL ANSI e a procedimentos armazenados"]),
    direitoUso: "perpetuo",
    modalidade: "aquisicao",
    periodoMeses: 36,
    manutencao: "aParte",
    percentagemManutencao: 22,
    eavalia: { tipoSolucao: "", ambito: "Servidor" },
    metrica: "core",
    quantidade: 64,
    precoUnitario: 1900,
    origemPreco: "tabelaPublica",
    referenciaPreco: "Tabela de preços do fabricante, edição de 2026",
  };
  return {
    ...pedidoLicenciamentoInicial(anoInicio),
    nomeProduto: "Arquivo Digital",
    descricaoProduto:
      "plataforma de gestão documental eletrónica da SPMS, com fluxos de aprovação, assinatura eletrónica e " +
      "arquivo de longo prazo, assente numa base de dados relacional de elevada disponibilidade",
    justificacao: {
      objetivos: itensExemplo("ad-obj", ["Desmaterializar os processos administrativos da SPMS"]),
      beneficios: itensExemplo("ad-ben", ["Redução do tempo de tramitação dos processos"]),
      riscos: itensExemplo("ad-ris", ["Interrupção do acesso ao arquivo documental no termo das licenças atuais"]),
    },
    licencas: [gestao, bd],
    lotes: [
      { id: "lote-gd", numero: "1", designacao: "Gestão documental", licencaIds: ["lic-gd"] },
      { id: "lote-bd", numero: "2", designacao: "Base de dados", licencaIds: ["lic-bd"] },
    ],
    encargosPlurianuais: { ativo: true, anoInicio },
    juri: { ...JURI_EXEMPLO },
  };
}

/** O produto do exemplo — o Módulo 1 do licenciamento. */
export const PRODUTO_LICENCIAMENTO_EXEMPLO: Pick<PedidoLicenciamento, "nomeProduto" | "descricaoProduto" | "justificacao"> = {
  nomeProduto: "SNOMED CT",
  descricaoProduto:
    "terminologia clínica de referência internacional, que permite codificar de forma inequívoca a informação " +
    "clínica registada nos sistemas de informação de saúde e partilhá-la entre eles",
  justificacao: {
    objetivos: itensExemplo("snomed-obj", [
      "Assegurar a utilização da SNOMED CT em todo o território nacional",
      "Garantir o acesso às edições internacionais e à extensão portuguesa",
    ]),
    beneficios: itensExemplo("snomed-ben", [
      "Interoperabilidade semântica entre os sistemas de informação do SNS",
      "Utilização da terminologia pelas entidades e pelos fornecedores de software em Portugal sem custos de licenciamento próprios",
    ]),
    riscos: itensExemplo("snomed-ris", [
      "Os sistemas de informação deixam de poder usar a SNOMED CT no termo da afiliação",
    ]),
  },
};
