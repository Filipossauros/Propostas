// O pedido de licenciamento de software: o modelo, os cálculos e a validação.
//
// Três módulos partilham este pedido — L1 (as licenças), L2 (as condições do
// contrato) e L3 (lotes, valor estimado, júri e Anexo Técnico) — e ele parte
// da mesma caracterização do projeto que o pedido de serviços de bolsa de
// horas (Módulo 1).
//
// O único aspeto submetido à concorrência é o preço. Tudo o resto — o que o
// software tem de fazer, a métrica, a manutenção, os níveis de serviço — são
// termos e condições do contrato, e saem nas Especificações Técnicas.
//
// Há duas naturezas de aquisição, e cada uma descreve o produto de forma
// diferente:
//   · aberta à concorrência — descreve-se a necessidade (categoria e requisitos
//     mínimos), sem marca nem fabricante; o produto só se conhece na proposta;
//   · produto determinado — identifica-se o produto, o fabricante e a versão, e
//     fundamenta-se a escolha (art.º 24.º do CCP, plataforma já instalada…).

import type { InformacaoEavalia, ItemPerfil, JuriTecnico, JustificacaoProjeto } from "./types";
import {
  ANOS_PLURIANUAIS,
  SCHEMA_VERSION_ATUAL,
  TAXA_IVA_PADRAO,
  informacaoEavaliaInicial,
  juriInicial,
} from "./types";
import { gerarId } from "./id";
import type { ErroValidacao } from "./perfil";
import { ErroImportacao } from "./perfil";
import { justificacaoInicial, normalizarJustificacao } from "./justificacao";
import { validarEavalia } from "./lotes";

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

export const TIPOS_EAVALIA = ["Licenças", "Upgrade de licenças", "Subscrição ou SaaS", "Outros"] as const;
export type TipoEavalia = (typeof TIPOS_EAVALIA)[number];

export const AMBITOS_EAVALIA = ["Produtividade", "Servidor", "Gestão Documental", "Outro"] as const;
export type AmbitoEavalia = (typeof AMBITOS_EAVALIA)[number];

export const TIPOS_LICENCIAMENTO_EAVALIA = ["Aquisição novas licenças", "Actualizações/Upgrades/Correções"] as const;
export type TipoLicenciamentoEavalia = (typeof TIPOS_LICENCIAMENTO_EAVALIA)[number];

export const RESPOSTAS_CONSULTA_MERCADO = ["Sim", "Não"] as const;
export type RespostaConsultaMercado = (typeof RESPOSTAS_CONSULTA_MERCADO)[number];

export interface ClassificacaoEavalia {
  tipoSolucao: TipoSolucaoEavalia | "";
  tipo: TipoEavalia | "";
  ambito: AmbitoEavalia | "";
  consultaMercado: RespostaConsultaMercado | "";
  tipoLicenciamento: TipoLicenciamentoEavalia | "";
}

// --------------------------------------------------------------------------
// O produto (L1)
// --------------------------------------------------------------------------

export type NaturezaAquisicao = "aberta" | "determinado";

export const FUNDAMENTOS_PRODUTO = {
  plataformaInstalada: "Plataforma já instalada — continuidade e compatibilidade técnica",
  direitosExclusivos: "Direitos exclusivos do fabricante (art.º 24.º, n.º 1, alínea e), do CCP)",
  renovacao: "Renovação de licenças existentes",
  outro: "Outro",
} as const;
export type FundamentoProduto = keyof typeof FUNDAMENTOS_PRODUTO | "";

export type DireitoUso = "temporario" | "perpetuo";
export const DIREITOS_USO: Record<DireitoUso, string> = {
  temporario: "Temporário (subscrição / SaaS)",
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
  aParte: "À parte (% do valor da licença / ano)",
  naoAplicavel: "Não aplicável",
};

export type Metrica =
  | ""
  | "utilizadorNomeado"
  | "utilizadorConcorrente"
  | "dispositivo"
  | "core"
  | "instancia"
  | "volume";
/** A métrica no singular e no plural: «1 utilizador nomeado», «1 200 utilizadores nomeados». */
export const METRICAS: Record<Exclude<Metrica, "">, { singular: string; plural: string }> = {
  utilizadorNomeado: { singular: "Utilizador nomeado", plural: "Utilizadores nomeados" },
  utilizadorConcorrente: { singular: "Utilizador concorrente", plural: "Utilizadores concorrentes" },
  dispositivo: { singular: "Dispositivo", plural: "Dispositivos" },
  core: { singular: "Core / processador", plural: "Cores / processadores" },
  instancia: { singular: "Instância / servidor", plural: "Instâncias / servidores" },
  volume: { singular: "Unidade de volume (transações, GB…)", plural: "Unidades de volume" },
};

export type OrigemPreco = "" | "consultaPreliminar" | "procedimentoAnterior" | "tabelaPublica";
export const ORIGENS_PRECO: Record<Exclude<OrigemPreco, "">, string> = {
  consultaPreliminar: "Consulta preliminar ao mercado (art.º 35.º-A do CCP)",
  procedimentoAnterior: "Procedimento anterior",
  tabelaPublica: "Tabela pública do fabricante",
};

/** O prazo máximo de vigência (art.º 48.º do CCP): três anos, como na bolsa de horas. */
export const MESES_MAXIMOS = ANOS_PLURIANUAIS * 12;

export interface ProdutoLicenca {
  id: string;
  // Aberta à concorrência: a descrição do software, sem marca.
  /** Designação do produto no procedimento, ex.: «Plataforma de gestão documental». */
  designacao: string;
  /** Categoria de software, ex.: «Gestão documental e workflow». */
  categoria: string;
  requisitosFuncionais: ItemPerfil[];
  requisitosTecnicos: ItemPerfil[];
  // Produto determinado: a identificação e o fundamento.
  produto: string;
  fabricante: string;
  versao: string;
  fundamento: FundamentoProduto;
  /** A explicação do fundamento — sai na manifestação. */
  explicacaoFundamento: string;
  // Tipo de licenciamento.
  direitoUso: DireitoUso;
  modalidade: Modalidade;
  /** Duração da subscrição, ou da manutenção, em meses. */
  periodoMeses: number;
  manutencao: Manutencao;
  /** Percentagem anual da manutenção, sobre o valor das licenças, quando é à parte. */
  percentagemManutencao: number;
  eavalia: ClassificacaoEavalia;
  // Métrica, quantidade e preço de referência.
  metrica: Metrica;
  quantidade: number;
  /**
   * Preço unitário de referência sem IVA: por mês, na subscrição; de uma vez,
   * na licença perpétua.
   */
  precoUnitario: number;
  origemPreco: OrigemPreco;
}

// --------------------------------------------------------------------------
// As condições do contrato (L2)
// --------------------------------------------------------------------------

export type HorarioSuporte = "uteis" | "24x7";
export const HORARIOS_SUPORTE: Record<HorarioSuporte, string> = {
  uteis: "Dias úteis, das 9h às 18h",
  "24x7": "24 horas por dia, 7 dias por semana",
};

export interface TemposDeSeveridade {
  resposta: number;
  resolucao: number;
}

export interface CondicoesContrato {
  ambito: { texto: string; entidades: string; naoProdutivosSemCusto: boolean };
  direitoUso: { texto: string; transmissao: boolean };
  manutencao: { texto: string };
  suporte: {
    ligada: boolean;
    texto: string;
    horario: HorarioSuporte;
    critica: TemposDeSeveridade;
    alta: TemposDeSeveridade;
    normal: TemposDeSeveridade;
  };
  disponibilidade: { ligada: boolean; texto: string; percentagem: number; janelasForaDoHorario: boolean };
  penalizacoes: { texto: string; porHoraCritica: number; limiteMensal: number; limiteGlobal: number };
  prazo: { ligada: boolean; texto: string; diasUteis: number };
  proprias: Array<{ id: string; titulo: string; texto: string }>;
}

/** O limite das penalizações (art.º 329.º, n.º 2, do CCP): 20 % do preço contratual. */
export const LIMITE_GLOBAL_PENALIZACOES = 20;

export const TEXTOS_CONDICOES = {
  ambito:
    "Utilização pela SPMS, E.P.E. e pelas entidades do Serviço Nacional de Saúde indicadas, em todos os ambientes " +
    "(produção, teste, formação e recuperação), sem limite geográfico dentro do território nacional.",
  direitoUso:
    "Direito de uso pelo período contratado ou, quando adquirido em regime perpétuo, sem limite temporal, " +
    "intransmissível a terceiros alheios ao Serviço Nacional de Saúde.",
  manutencao:
    "Acesso, durante a vigência do contrato, a todas as correções, versões e atualizações de segurança publicadas " +
    "pelo fabricante, sem custo adicional para a entidade adjudicante.",
  suporte:
    "Suporte técnico em língua portuguesa, com tempos máximos de resposta e de resolução por severidade do " +
    "incidente. O incumprimento destes tempos dá lugar às penalizações previstas.",
  disponibilidade:
    "Disponibilidade mensal mínima do serviço, medida pelo adjudicatário e reportada mensalmente ao gestor do " +
    "contrato, excluídas as janelas de manutenção previamente acordadas.",
  penalizacoes:
    "Pelo incumprimento dos níveis de serviço, o adjudicatário fica sujeito a penalizações contratuais, sem prejuízo " +
    "da resolução do contrato nos termos legais.",
  prazo: "Licenças e acessos disponibilizados à entidade adjudicante no prazo máximo indicado, a contar da data de " +
    "assinatura do contrato.",
} as const;

export function condicoesIniciais(): CondicoesContrato {
  return {
    ambito: { texto: TEXTOS_CONDICOES.ambito, entidades: "", naoProdutivosSemCusto: true },
    direitoUso: { texto: TEXTOS_CONDICOES.direitoUso, transmissao: true },
    manutencao: { texto: TEXTOS_CONDICOES.manutencao },
    suporte: {
      ligada: true,
      texto: TEXTOS_CONDICOES.suporte,
      horario: "uteis",
      critica: { resposta: 2, resolucao: 8 },
      alta: { resposta: 4, resolucao: 24 },
      normal: { resposta: 8, resolucao: 72 },
    },
    disponibilidade: {
      ligada: true,
      texto: TEXTOS_CONDICOES.disponibilidade,
      percentagem: 99.5,
      janelasForaDoHorario: true,
    },
    penalizacoes: { texto: TEXTOS_CONDICOES.penalizacoes, porHoraCritica: 0.5, limiteMensal: 10, limiteGlobal: 20 },
    prazo: { ligada: true, texto: TEXTOS_CONDICOES.prazo, diasUteis: 10 },
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
  produtoIds: string[];
}

export interface PedidoLicenciamento {
  schemaVersion: string;
  tipo: "licenciamento";
  /** Carimbados ao exportar, como no agrupamento em lotes: o projeto vive no Módulo 1. */
  nomeProjeto: string;
  descricaoProjeto: string;
  justificacao: JustificacaoProjeto;
  natureza: NaturezaAquisicao;
  produtos: ProdutoLicenca[];
  condicoes: CondicoesContrato;
  lotes: LoteLicenca[];
  umLotePorConcorrente: boolean;
  encargosPlurianuais: { ativo: boolean; anoInicio: number };
  taxaIva: number;
  margemPrudencial: number;
  justificacaoMargem: string;
  juri: JuriTecnico;
  eavalia: InformacaoEavalia;
  numeroInformacao: string;
  numeroOrcamento: string;
}

export const PREFIXO_NOME_PROCEDIMENTO_LICENCIAMENTO = "Aquisição de Licenciamento de Software para o projeto ";

export function nomeProcedimentoLicenciamento(nomeProjeto: string): string {
  const nome = nomeProjeto.trim();
  return nome === "" ? "" : `${PREFIXO_NOME_PROCEDIMENTO_LICENCIAMENTO}${nome}`;
}

/** O fundamento da margem a 0 %, por omissão — no licenciamento, os preços vêm do mercado. */
export const JUSTIFICACAO_SEM_MARGEM_LICENCIAMENTO =
  "Não foi aplicada margem prudencial autónoma ao valor estimado. Os preços unitários considerados resultam da " +
  "consulta ao mercado, de procedimentos anteriores ou da tabela pública do fabricante, conforme indicado para " +
  "cada produto, refletindo os preços efetivamente praticados. Considera-se, assim, que a margem prudencial se " +
  "encontra incorporada nos valores unitários adotados, os quais asseguram, com razoabilidade, a suficiência do " +
  "valor estimado para a satisfação da necessidade identificada.";

export function justificacaoMargemLicenciamento(margem: number): string {
  if (!(margem > 0)) return JUSTIFICACAO_SEM_MARGEM_LICENCIAMENTO;
  return (
    `A margem prudencial de ${formatarNumeroLic(margem)} % destina-se a acautelar a variação dos preços de tabela ` +
    "dos fabricantes e das condições de mercado até à adjudicação e ao longo da execução do contrato, e é aplicada " +
    "ao preço unitário de cada produto, refletindo-se em todos os valores por produto, por lote e por ano " +
    "apresentados na presente informação."
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

export function classificacaoInicial(natureza: NaturezaAquisicao = "aberta"): ClassificacaoEavalia {
  return {
    tipoSolucao: natureza === "aberta" ? "Submissão à concorrência" : "",
    tipo: "",
    ambito: "",
    consultaMercado: "",
    tipoLicenciamento: "Aquisição novas licenças",
  };
}

export function criarProduto(natureza: NaturezaAquisicao = "aberta"): ProdutoLicenca {
  return {
    id: gerarId(),
    designacao: "",
    categoria: "",
    requisitosFuncionais: [],
    requisitosTecnicos: [],
    produto: "",
    fabricante: "",
    versao: "",
    fundamento: "",
    explicacaoFundamento: "",
    direitoUso: "temporario",
    modalidade: "aquisicao",
    periodoMeses: 12,
    manutencao: "incluida",
    percentagemManutencao: 0,
    eavalia: classificacaoInicial(natureza),
    metrica: "",
    quantidade: 0,
    precoUnitario: 0,
    origemPreco: "",
  };
}

export function pedidoLicenciamentoInicial(anoInicio = new Date().getFullYear()): PedidoLicenciamento {
  return {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    tipo: "licenciamento",
    nomeProjeto: "",
    descricaoProjeto: "",
    justificacao: justificacaoInicial(),
    natureza: "aberta",
    produtos: [],
    condicoes: condicoesIniciais(),
    lotes: [],
    umLotePorConcorrente: false,
    encargosPlurianuais: { ativo: false, anoInicio },
    taxaIva: TAXA_IVA_PADRAO,
    margemPrudencial: 0,
    justificacaoMargem: JUSTIFICACAO_SEM_MARGEM_LICENCIAMENTO,
    juri: juriInicial(),
    eavalia: informacaoEavaliaInicial(),
    numeroInformacao: "",
    numeroOrcamento: "",
  };
}

/** O tipo de licenciamento do eAvalia que a modalidade sugere. */
export function tipoLicenciamentoDaModalidade(modalidade: Modalidade): TipoLicenciamentoEavalia {
  return modalidade === "upgrade" ? "Actualizações/Upgrades/Correções" : "Aquisição novas licenças";
}

/** O tipo do eAvalia que o direito de uso e a modalidade sugerem. */
export function tipoEavaliaSugerido(p: Pick<ProdutoLicenca, "direitoUso" | "modalidade">): TipoEavalia {
  if (p.modalidade === "upgrade") return "Upgrade de licenças";
  return p.direitoUso === "temporario" ? "Subscrição ou SaaS" : "Licenças";
}

/**
 * O produto com uma alteração, e com o que dela depende: a classificação
 * eAvalia acompanha a modalidade e o direito de uso, e a manutenção «à parte»
 * só existe na licença perpétua.
 */
export function comAlteracao(produto: ProdutoLicenca, alteracao: Partial<ProdutoLicenca>): ProdutoLicenca {
  const novo = { ...produto, ...alteracao };
  if (alteracao.modalidade !== undefined || alteracao.direitoUso !== undefined) {
    novo.eavalia = {
      ...novo.eavalia,
      tipoLicenciamento: tipoLicenciamentoDaModalidade(novo.modalidade),
      tipo: tipoEavaliaSugerido(novo),
    };
  }
  if (novo.direitoUso === "temporario" && novo.manutencao === "aParte") novo.manutencao = "incluida";
  return novo;
}

/**
 * O pedido com outra natureza de aquisição. O tipo de solução do eAvalia que
 * a natureza sugere acompanha-a: «Submissão à concorrência» na aberta, e por
 * escolher no produto determinado (sem alternativas, ou com TCO).
 */
export function comNatureza(pedido: PedidoLicenciamento, natureza: NaturezaAquisicao): PedidoLicenciamento {
  if (pedido.natureza === natureza) return pedido;
  return {
    ...pedido,
    natureza,
    produtos: pedido.produtos.map((p) => {
      const t = p.eavalia.tipoSolucao;
      const tipoSolucao =
        natureza === "aberta" ? (t === "" ? "Submissão à concorrência" : t) : t === "Submissão à concorrência" ? "" : t;
      return { ...p, eavalia: { ...p.eavalia, tipoSolucao } };
    }),
  };
}

// --------------------------------------------------------------------------
// Nomes
// --------------------------------------------------------------------------

/** O nome do produto como sai nos quadros: a designação, ou o produto e o fabricante. */
export function nomeDoProduto(p: ProdutoLicenca, natureza: NaturezaAquisicao): string {
  if (natureza === "aberta") return p.designacao.trim();
  const produto = p.produto.trim();
  const fabricante = p.fabricante.trim();
  if (produto === "") return "";
  return fabricante === "" ? produto : `${produto} — ${fabricante}`;
}

export function metricaPorExtenso(p: Pick<ProdutoLicenca, "metrica" | "quantidade">): string {
  if (p.metrica === "") return "";
  const m = METRICAS[p.metrica];
  return (p.quantidade === 1 ? m.singular : m.plural).toLowerCase();
}

export function resumoDoTipo(p: ProdutoLicenca): string {
  if (p.direitoUso === "temporario") return `Subscrição · ${p.periodoMeses} meses`;
  const manut =
    p.manutencao === "aParte"
      ? ` + manutenção (${formatarNumeroLic(p.percentagemManutencao)} %/ano, ${p.periodoMeses} meses)`
      : p.manutencao === "incluida"
        ? ` · manutenção incluída (${p.periodoMeses} meses)`
        : "";
  return `Licenças perpétuas${manut}`;
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
    produtos: pedido.produtos.map((p) => ({ ...p, precoUnitario: precoComMargem(p.precoUnitario, margem) })),
  };
}

/** Quantos meses do período caem em cada ano do contrato, a começar em janeiro do primeiro. */
export function mesesPorAno(meses: number, nAnos: number): number[] {
  return Array.from({ length: nAnos }, (_v, i) => Math.max(0, Math.min(12, num(meses) - 12 * i)));
}

export interface ValorDoProduto {
  /** Licenças ou subscrição, sem IVA. */
  licencas: number;
  /** Manutenção à parte, sem IVA (0 quando incluída ou não aplicável). */
  manutencao: number;
  /** Manutenção de um ano. */
  manutencaoAnual: number;
  total: number;
  /** O total repartido pelos anos do contrato. */
  porAno: number[];
}

/**
 * O valor de um produto, sem IVA, com os preços como estão (aplique-se antes a
 * margem, se for caso disso).
 *
 *   subscrição: quantidade × preço/mês × meses, repartido mês a mês;
 *   perpétua:   quantidade × preço, no primeiro ano, e a manutenção à parte —
 *               a percentagem anual sobre esse valor, pelos meses do período.
 */
export function valorDoProduto(p: ProdutoLicenca, nAnos = 1): ValorDoProduto {
  const qtd = num(p.quantidade);
  const preco = num(p.precoUnitario);
  const meses = Math.min(num(p.periodoMeses), MESES_MAXIMOS);
  const anos = Math.max(1, nAnos);
  if (p.direitoUso === "temporario") {
    const mensal = qtd * preco;
    const porAno = mesesPorAno(meses, anos).map((m) => centimos(mensal * m));
    // Sem anos bastantes (pedido sem encargos plurianuais), o resto cabe no último.
    const total = centimos(mensal * meses);
    porAno[porAno.length - 1] = centimos(porAno[porAno.length - 1] + total - porAno.reduce((s, v) => s + v, 0));
    return { licencas: total, manutencao: 0, manutencaoAnual: 0, total, porAno };
  }
  const licencas = centimos(qtd * preco);
  const manutencaoAnual = p.manutencao === "aParte" ? centimos((licencas * num(p.percentagemManutencao)) / 100) : 0;
  const mesesDeManutencao = mesesPorAno(meses, anos);
  const porAno = mesesDeManutencao.map((m, i) => centimos((i === 0 ? licencas : 0) + (manutencaoAnual * m) / 12));
  const manutencao = centimos((manutencaoAnual * meses) / 12);
  const total = centimos(licencas + manutencao);
  porAno[porAno.length - 1] = centimos(porAno[porAno.length - 1] + total - porAno.reduce((s, v) => s + v, 0));
  return { licencas, manutencao, manutencaoAnual, total, porAno };
}

/** Os meses do contrato: o maior período dos produtos (pelo menos 1). */
export function mesesDoContrato(pedido: Pick<PedidoLicenciamento, "produtos">): number {
  return Math.max(1, ...pedido.produtos.map((p) => Math.min(num(p.periodoMeses), MESES_MAXIMOS)));
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
  produto: ProdutoLicenca;
  valor: ValorDoProduto;
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
  const porId = new Map(pedido.produtos.map((p) => [p.id, p]));
  return lotesEfetivos(pedido).map((lote) => {
    const linhas = lote.produtoIds
      .map((id) => porId.get(id))
      .filter((p): p is ProdutoLicenca => p !== undefined)
      .map((produto) => ({ produto, valor: valorDoProduto(produto, nAnos) }));
    const porAno = Array.from({ length: nAnos }, (_v, i) =>
      centimos(linhas.reduce((s, l) => s + l.valor.porAno[i], 0)),
    );
    return { lote, linhas, porAno, total: centimos(linhas.reduce((s, l) => s + l.valor.total, 0)) };
  });
}

/** O valor estimado do contrato, sem IVA, com os preços como estão no pedido recebido. */
export function valorEstimado(pedido: PedidoLicenciamento): number {
  const nAnos = anosDoPedido(pedido).length;
  return centimos(pedido.produtos.reduce((s, p) => s + valorDoProduto(p, nAnos).total, 0));
}

export function valorPorAno(pedido: PedidoLicenciamento): number[] {
  const nAnos = anosDoPedido(pedido).length;
  return Array.from({ length: nAnos }, (_v, i) =>
    centimos(pedido.produtos.reduce((s, p) => s + valorDoProduto(p, nAnos).porAno[i], 0)),
  );
}

// --------------------------------------------------------------------------
// Lotes
// --------------------------------------------------------------------------

/**
 * Os lotes como devem ficar: sem produtos que já não existam, sem lotes vazios,
 * cada produto por atribuir num lote próprio (é a omissão: um lote por
 * produto), numerados de 1 em diante.
 */
export function lotesEfetivos(pedido: Pick<PedidoLicenciamento, "produtos" | "lotes" | "natureza">): LoteLicenca[] {
  const existentes = new Set(pedido.produtos.map((p) => p.id));
  const vistos = new Set<string>();
  const lotes: LoteLicenca[] = [];
  for (const lote of pedido.lotes) {
    const ids = lote.produtoIds.filter((id) => existentes.has(id) && !vistos.has(id));
    ids.forEach((id) => vistos.add(id));
    if (ids.length > 0) lotes.push({ ...lote, produtoIds: ids });
  }
  for (const p of pedido.produtos) {
    if (!vistos.has(p.id)) lotes.push({ id: `lote-${p.id}`, numero: "", designacao: "", produtoIds: [p.id] });
  }
  return lotes.map((l, i) => ({ ...l, numero: String(i + 1) }));
}

/** A designação de um lote: a escrita, ou o nome do produto quando é só um. */
export function designacaoDoLote(lote: LoteLicenca, pedido: PedidoLicenciamento): string {
  if (lote.designacao.trim() !== "") return lote.designacao.trim();
  if (lote.produtoIds.length === 1) {
    const p = pedido.produtos.find((x) => x.id === lote.produtoIds[0]);
    if (p) return nomeDoProduto(p, pedido.natureza);
  }
  return `Lote ${lote.numero}`;
}

/** Muda um produto de lote (ou para um lote novo, com `destino` nulo). */
export function moverProdutoParaLote(
  pedido: PedidoLicenciamento,
  produtoId: string,
  destino: string | null,
): PedidoLicenciamento {
  const lotes = lotesEfetivos(pedido).map((l) => ({ ...l, produtoIds: l.produtoIds.filter((id) => id !== produtoId) }));
  if (destino === null) lotes.push({ id: gerarId(), numero: "", designacao: "", produtoIds: [produtoId] });
  else {
    const alvo = lotes.find((l) => l.id === destino);
    if (alvo) alvo.produtoIds.push(produtoId);
  }
  return { ...pedido, lotes: lotesEfetivos({ ...pedido, lotes }) };
}

// --------------------------------------------------------------------------
// Validação
// --------------------------------------------------------------------------

function falta(campo: string, mensagem: string): ErroValidacao {
  return { campo, mensagem };
}

/** O que falta num produto (L1). */
export function validarProduto(p: ProdutoLicenca, natureza: NaturezaAquisicao): ErroValidacao[] {
  const erros: ErroValidacao[] = [];
  const nome = nomeDoProduto(p, natureza) || "Produto sem nome";
  const de = (texto: string) => falta(p.id, `${nome}: ${texto}`);
  if (natureza === "aberta") {
    if (p.designacao.trim() === "") erros.push(de("indique a designação do produto no procedimento."));
    if (p.categoria.trim() === "") erros.push(de("indique a categoria de software."));
    if (p.requisitosFuncionais.filter((r) => r.designacao.trim() !== "").length === 0)
      erros.push(de("indique pelo menos um requisito funcional mínimo."));
    if (p.requisitosFuncionais.some((r) => r.designacao.trim() === "") || p.requisitosTecnicos.some((r) => r.designacao.trim() === ""))
      erros.push(de("há requisitos por escrever — preencha-os ou remova-os."));
  } else {
    if (p.produto.trim() === "") erros.push(de("indique o produto."));
    if (p.fabricante.trim() === "") erros.push(de("indique o fabricante."));
    if (p.fundamento === "") erros.push(de("escolha o fundamento da escolha do produto."));
    if (p.explicacaoFundamento.trim() === "") erros.push(de("explique o fundamento da escolha do produto."));
  }
  if (!Number.isInteger(p.periodoMeses) || p.periodoMeses < 1)
    erros.push(de("o período tem de ser um número inteiro de meses."));
  else if (p.periodoMeses > MESES_MAXIMOS)
    erros.push(de(`o período não pode exceder ${MESES_MAXIMOS} meses (art.º 48.º do CCP).`));
  if (p.direitoUso === "perpetuo" && p.manutencao === "aParte" && !(p.percentagemManutencao > 0))
    erros.push(de("indique a percentagem anual da manutenção."));
  if (p.eavalia.tipoSolucao === "") erros.push(de("escolha o tipo de solução (eAvalia)."));
  if (p.eavalia.tipo === "") erros.push(de("escolha o tipo (eAvalia)."));
  if (p.eavalia.ambito === "") erros.push(de("escolha o âmbito (eAvalia)."));
  if (p.eavalia.consultaMercado === "") erros.push(de("indique se houve consulta ao mercado (eAvalia)."));
  if (p.eavalia.tipoLicenciamento === "") erros.push(de("escolha o tipo de licenciamento (eAvalia)."));
  if (p.metrica === "") erros.push(de("escolha a métrica de licenciamento."));
  if (!Number.isInteger(p.quantidade) || p.quantidade < 1) erros.push(de("a quantidade tem de ser um número inteiro positivo."));
  if (!(p.precoUnitario > 0)) erros.push(de("falta o preço unitário de referência."));
  if (p.origemPreco === "") erros.push(de("indique a origem do preço de referência."));
  return erros;
}

/** Quantos blocos de produto tem cada secção da folha «Custos - Licenciamento». */
export const PRODUTOS_POR_SECCAO_EAVALIA = 20;

/** O que falta nas licenças (L1). */
export function validarLicencas(pedido: PedidoLicenciamento): ErroValidacao[] {
  if (pedido.produtos.length === 0) return [falta("produtos", "Acrescente pelo menos um produto a licenciar.")];
  const erros = pedido.produtos.flatMap((p) => validarProduto(p, pedido.natureza));
  const livres = pedido.produtos.filter((p) => p.eavalia.tipoSolucao === "Solução Software Livre").length;
  if (livres > PRODUTOS_POR_SECCAO_EAVALIA || pedido.produtos.length - livres > PRODUTOS_POR_SECCAO_EAVALIA)
    erros.push(
      falta("produtos", `O formulário eAvalia comporta ${PRODUTOS_POR_SECCAO_EAVALIA} produtos por secção.`),
    );
  return erros;
}

/** O que falta nas condições do contrato (L2). */
export function validarCondicoes(c: CondicoesContrato): ErroValidacao[] {
  const erros: ErroValidacao[] = [];
  const texto = (campo: string, valor: string, nome: string) => {
    if (valor.trim() === "") erros.push(falta(campo, `${nome}: escreva o texto da condição.`));
  };
  texto("ambito", c.ambito.texto, "Âmbito da licença");
  texto("direitoUso", c.direitoUso.texto, "Direito de uso e transmissão");
  texto("manutencao", c.manutencao.texto, "Manutenção e atualizações");
  texto("penalizacoes", c.penalizacoes.texto, "Penalizações");
  if (c.suporte.ligada) {
    texto("suporte", c.suporte.texto, "Suporte técnico e SLA");
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
  if (c.disponibilidade.ligada) {
    texto("disponibilidade", c.disponibilidade.texto, "Disponibilidade");
    if (!(c.disponibilidade.percentagem > 0 && c.disponibilidade.percentagem <= 100))
      erros.push(falta("disponibilidade", "Disponibilidade: a percentagem tem de estar entre 0 e 100 %."));
  }
  if (!(c.penalizacoes.porHoraCritica > 0))
    erros.push(falta("penalizacoes", "Penalizações: indique a penalização por hora de atraso."));
  if (!(c.penalizacoes.limiteMensal > 0))
    erros.push(falta("penalizacoes", "Penalizações: indique o limite mensal."));
  if (!(c.penalizacoes.limiteGlobal > 0) || c.penalizacoes.limiteGlobal > LIMITE_GLOBAL_PENALIZACOES)
    erros.push(
      falta(
        "penalizacoes",
        `Penalizações: o limite global tem de estar entre 0 e ${LIMITE_GLOBAL_PENALIZACOES} % do valor do contrato (art.º 329.º do CCP).`,
      ),
    );
  if (c.prazo.ligada && !(Number.isInteger(c.prazo.diasUteis) && c.prazo.diasUteis > 0))
    erros.push(falta("prazo", "Prazo de disponibilização: indique o número de dias úteis."));
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
  const longos = pedido.produtos.some((p) => p.periodoMeses > 12);
  if (longos && !pedido.encargosPlurianuais.ativo)
    erros.push(
      falta(
        "encargosPlurianuais",
        "Há produtos com período superior a 12 meses: assinale o pedido de encargos plurianuais.",
      ),
    );
  const nomes: Array<[keyof JuriTecnico, string]> = [
    ["diretor", "o diretor"],
    ["coordenador", "o coordenador"],
    ["unidade", "a unidade do coordenador"],
    ["gestorProjeto", "o gestor de projeto"],
  ];
  for (const [campo, nome] of nomes) {
    if (pedido.juri[campo].trim() === "") erros.push(falta(`juri.${campo}`, `Júri técnico: indique ${nome}.`));
  }
  // As medidas do alinhamento tecnológico, como no pedido de serviços.
  erros.push(...validarEavalia(pedido.eavalia));
  return erros;
}

// --------------------------------------------------------------------------
// Ficheiro (JSON) e normalização
// --------------------------------------------------------------------------

export function pedidoLicenciamentoParaJSON(pedido: PedidoLicenciamento): string {
  return JSON.stringify({ ...pedido, lotes: lotesEfetivos(pedido) }, null, 2);
}

function texto(v: unknown, omissao = ""): string {
  return typeof v === "string" ? v : omissao;
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

function itens(v: unknown): ItemPerfil[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null)
    .map((i) => ({ id: texto(i.id) || gerarId(), designacao: texto(i.designacao) }));
}

function objeto(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function normalizarProduto(bruto: unknown): ProdutoLicenca {
  const r = objeto(bruto);
  const base = criarProduto();
  const e = objeto(r.eavalia);
  const chaves = <T extends string>(registo: Record<T, unknown>) => Object.keys(registo) as T[];
  return {
    id: texto(r.id) || base.id,
    designacao: texto(r.designacao),
    categoria: texto(r.categoria),
    requisitosFuncionais: itens(r.requisitosFuncionais),
    requisitosTecnicos: itens(r.requisitosTecnicos),
    produto: texto(r.produto),
    fabricante: texto(r.fabricante),
    versao: texto(r.versao),
    fundamento: deLista(r.fundamento, chaves(FUNDAMENTOS_PRODUTO), ""),
    explicacaoFundamento: texto(r.explicacaoFundamento),
    direitoUso: deLista(r.direitoUso, chaves(DIREITOS_USO), "") || base.direitoUso,
    modalidade: deLista(r.modalidade, chaves(MODALIDADES), "") || base.modalidade,
    periodoMeses: numero(r.periodoMeses, base.periodoMeses),
    manutencao: deLista(r.manutencao, chaves(MANUTENCOES), "") || base.manutencao,
    percentagemManutencao: numero(r.percentagemManutencao),
    eavalia: {
      tipoSolucao: deLista(e.tipoSolucao, TIPOS_SOLUCAO_EAVALIA, ""),
      tipo: deLista(e.tipo, TIPOS_EAVALIA, ""),
      ambito: deLista(e.ambito, AMBITOS_EAVALIA, ""),
      consultaMercado: deLista(e.consultaMercado, RESPOSTAS_CONSULTA_MERCADO, ""),
      tipoLicenciamento: deLista(e.tipoLicenciamento, TIPOS_LICENCIAMENTO_EAVALIA, ""),
    },
    metrica: deLista(r.metrica, chaves(METRICAS), ""),
    quantidade: numero(r.quantidade),
    precoUnitario: numero(r.precoUnitario),
    origemPreco: deLista(r.origemPreco, chaves(ORIGENS_PRECO), ""),
  };
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
  return {
    ambito: {
      texto: texto(a.texto, base.ambito.texto),
      entidades: texto(a.entidades),
      naoProdutivosSemCusto: booleano(a.naoProdutivosSemCusto, base.ambito.naoProdutivosSemCusto),
    },
    direitoUso: { texto: texto(d.texto, base.direitoUso.texto), transmissao: booleano(d.transmissao, true) },
    manutencao: { texto: texto(m.texto, base.manutencao.texto) },
    suporte: {
      ligada: booleano(s.ligada, true),
      texto: texto(s.texto, base.suporte.texto),
      horario: s.horario === "24x7" ? "24x7" : "uteis",
      critica: sev(s.critica, base.suporte.critica),
      alta: sev(s.alta, base.suporte.alta),
      normal: sev(s.normal, base.suporte.normal),
    },
    disponibilidade: {
      ligada: booleano(di.ligada, true),
      texto: texto(di.texto, base.disponibilidade.texto),
      percentagem: numero(di.percentagem, base.disponibilidade.percentagem),
      janelasForaDoHorario: booleano(di.janelasForaDoHorario, true),
    },
    penalizacoes: {
      texto: texto(pe.texto, base.penalizacoes.texto),
      porHoraCritica: numero(pe.porHoraCritica, base.penalizacoes.porHoraCritica),
      limiteMensal: numero(pe.limiteMensal, base.penalizacoes.limiteMensal),
      limiteGlobal: numero(pe.limiteGlobal, base.penalizacoes.limiteGlobal),
    },
    prazo: {
      ligada: booleano(pr.ligada, true),
      texto: texto(pr.texto, base.prazo.texto),
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

/** O pedido recuperado de um ficheiro ou do navegador, com o que falte reposto por omissão. */
export function normalizarPedidoLicenciamento(bruto: unknown): PedidoLicenciamento {
  const r = objeto(bruto);
  const base = pedidoLicenciamentoInicial();
  const enc = objeto(r.encargosPlurianuais);
  const juri = objeto(r.juri);
  const eav = objeto(r.eavalia);
  const produtos = Array.isArray(r.produtos) ? r.produtos.map(normalizarProduto) : [];
  const natureza: NaturezaAquisicao = r.natureza === "determinado" ? "determinado" : "aberta";
  const lotes: LoteLicenca[] = Array.isArray(r.lotes)
    ? r.lotes.map((l) => {
        const o = objeto(l);
        return {
          id: texto(o.id) || gerarId(),
          numero: texto(o.numero),
          designacao: texto(o.designacao),
          produtoIds: Array.isArray(o.produtoIds) ? o.produtoIds.filter((x): x is string => typeof x === "string") : [],
        };
      })
    : [];
  const pedido: PedidoLicenciamento = {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    tipo: "licenciamento",
    nomeProjeto: texto(r.nomeProjeto),
    descricaoProjeto: texto(r.descricaoProjeto),
    justificacao: r.justificacao === undefined ? justificacaoInicial() : normalizarJustificacao(r.justificacao),
    natureza,
    produtos,
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
    eavalia: { ...informacaoEavaliaInicial(), ...(eav as Partial<InformacaoEavalia>) },
    numeroInformacao: texto(r.numeroInformacao),
    numeroOrcamento: texto(r.numeroOrcamento),
  };
  return { ...pedido, lotes: lotesEfetivos(pedido) };
}

export function ehPedidoLicenciamentoGuardado(valor: unknown): valor is PedidoLicenciamento {
  const r = objeto(valor);
  return r.tipo === "licenciamento" && Array.isArray(r.produtos);
}

export function importarPedidoLicenciamentoJSON(conteudo: string): PedidoLicenciamento {
  let bruto: unknown;
  try {
    bruto = JSON.parse(conteudo);
  } catch {
    throw new ErroImportacao("O ficheiro não contém JSON válido.");
  }
  const r = objeto(bruto);
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
  return normalizarPedidoLicenciamento(bruto);
}

// --------------------------------------------------------------------------
// Exemplo
// --------------------------------------------------------------------------

function itensExemplo(prefixo: string, textos: string[]): ItemPerfil[] {
  return textos.map((designacao, i) => ({ id: `${prefixo}${i + 1}`, designacao }));
}

/** Um pedido de exemplo, para experimentar os três módulos sem preencher tudo. */
export function pedidoLicenciamentoExemplo(anoInicio = new Date().getFullYear()): PedidoLicenciamento {
  const gestao: ProdutoLicenca = {
    ...criarProduto("aberta"),
    id: "lic-gd",
    designacao: "Plataforma de gestão documental",
    categoria: "Gestão documental e workflow",
    requisitosFuncionais: itensExemplo("lic-gd-f", [
      "Gestão de documentos com versões, classificação e pesquisa de texto integral",
      "Fluxos de aprovação configuráveis sem programação",
      "Assinatura eletrónica qualificada integrada",
      "Integração por API REST com os sistemas da SPMS",
    ]),
    requisitosTecnicos: itensExemplo("lic-gd-t", [
      "Autenticação por SSO (SAML 2.0 / OIDC)",
      "Alojamento dos dados na União Europeia",
    ]),
    produto: "DocFlow Enterprise",
    fabricante: "Fabricante X",
    versao: "12",
    fundamento: "plataformaInstalada",
    explicacaoFundamento:
      "A plataforma encontra-se instalada e integrada com os sistemas da SPMS desde 2022; a mudança de produto " +
      "obrigaria à migração de todo o arquivo documental e à reformulação das integrações existentes.",
    direitoUso: "temporario",
    modalidade: "aquisicao",
    periodoMeses: 36,
    manutencao: "incluida",
    eavalia: {
      tipoSolucao: "Submissão à concorrência",
      tipo: "Subscrição ou SaaS",
      ambito: "Gestão Documental",
      consultaMercado: "Sim",
      tipoLicenciamento: "Aquisição novas licenças",
    },
    metrica: "utilizadorNomeado",
    quantidade: 1200,
    precoUnitario: 14.5,
    origemPreco: "consultaPreliminar",
  };
  const bd: ProdutoLicenca = {
    ...criarProduto("aberta"),
    id: "lic-bd",
    designacao: "Sistema de gestão de base de dados relacional",
    categoria: "Base de dados relacional",
    requisitosFuncionais: itensExemplo("lic-bd-f", [
      "Replicação síncrona entre dois centros de dados",
      "Cópias de segurança em linha, sem paragem do serviço",
    ]),
    requisitosTecnicos: itensExemplo("lic-bd-t", ["Suporte a SQL ANSI e a procedimentos armazenados"]),
    produto: "DataCore DB",
    fabricante: "Fabricante Y",
    versao: "19c",
    fundamento: "renovacao",
    explicacaoFundamento: "As bases de dados de produção da SPMS assentam neste produto.",
    direitoUso: "perpetuo",
    modalidade: "aquisicao",
    periodoMeses: 36,
    manutencao: "aParte",
    percentagemManutencao: 22,
    eavalia: {
      tipoSolucao: "Submissão à concorrência",
      tipo: "Licenças",
      ambito: "Servidor",
      consultaMercado: "Sim",
      tipoLicenciamento: "Aquisição novas licenças",
    },
    metrica: "core",
    quantidade: 64,
    precoUnitario: 1900,
    origemPreco: "tabelaPublica",
  };
  return {
    ...pedidoLicenciamentoInicial(anoInicio),
    produtos: [gestao, bd],
    lotes: [
      { id: "lote-gd", numero: "1", designacao: "Gestão documental", produtoIds: ["lic-gd"] },
      { id: "lote-bd", numero: "2", designacao: "Base de dados", produtoIds: ["lic-bd"] },
    ],
    encargosPlurianuais: { ativo: true, anoInicio },
    eavalia: {
      iap: "Já cumpre",
      sms: "Não aplicável",
      faturacao: "Não aplicável",
      chaveMovelDigital: "Não aplicável",
      usabilidade: "Selo Prata",
      idiomas: "Cumpre Parcialmente",
    },
    juri: {
      diretor: "Nome do Diretor",
      coordenador: "Nome do Coordenador",
      unidade: "Unidade de Planeamento, Arquitetura, Conformidade e Engenharia",
      gestorProjeto: "Nome do Gestor de Projeto",
    },
  };
}

/** O projeto do exemplo do licenciamento — o Módulo 1 que o acompanha. */
export const PROJETO_LICENCIAMENTO_EXEMPLO: {
  nomeProjeto: string;
  descricaoProjeto: string;
  justificacao: JustificacaoProjeto;
} = {
  nomeProjeto: "Arquivo Digital",
  descricaoProjeto:
    "assegurar a gestão documental eletrónica da SPMS, com fluxos de aprovação, assinatura eletrónica e arquivo " +
    "de longo prazo, assente numa base de dados relacional de elevada disponibilidade",
  justificacao: {
    objetivos: itensExemplo("lic-obj", [
      "Desmaterializar os processos administrativos da SPMS",
      "Garantir o arquivo eletrónico com valor probatório",
    ]),
    beneficios: itensExemplo("lic-ben", [
      "Redução do tempo de tramitação dos processos, com fluxos de aprovação eletrónicos",
      "Eliminação do papel e dos custos de arquivo físico",
    ]),
    riscos: itensExemplo("lic-ris", [
      "Interrupção do acesso ao arquivo documental no termo das licenças atuais",
      "Perda de suporte e de atualizações de segurança da base de dados",
    ]),
  },
};
