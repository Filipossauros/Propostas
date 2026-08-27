// Vista Geral — o orçamento da unidade, visto de cima.
//
// Os quatro módulos trabalham um procedimento de cada vez. Este trabalha muitos:
// recebe os agrupamentos já feitos (o JSON do Módulo 2), põe-nos lado a lado e
// responde à pergunta que nenhum deles responde — onde é que a unidade está a
// pôr as pessoas e o dinheiro.
//
// A vista fica guardada neste navegador, como o resto do trabalho de
// configuração — sair do separador não a pode apagar. Traz nomes de pessoas da
// equipa, registados à mão, que ficam só neste posto de trabalho: nada sai
// daqui. Ver `persistencia.ts`.

import type { LotesJSON } from "./types";
import { ANOS_PLURIANUAIS, SCHEMA_VERSION_ATUAL } from "./types";
import { aplicarIva, horasPorAnoDe, taxaIva } from "./lotes";
import { ErroImportacao } from "./perfil";
import { gerarId } from "./id";

/** Uma pessoa da equipa afeta ao projeto, registada pelo nome. */
export interface ElementoInterno {
  id: string;
  nome: string;
}

/**
 * Uma linha do projeto: um perfil dentro de um lote.
 *
 * Guarda os valores já apurados, e não uma referência ao agrupamento de onde
 * vieram: a vista sobrevive a apagar-se metade das linhas, e o que resta tem de
 * continuar a somar certo sem ir buscar nada a lado nenhum.
 */
export interface EntradaVistaGeral {
  id: string;
  /** Número do lote, tal como no agrupamento de origem. */
  lote: string;
  perfil: string;
  /** N.º de elementos exigido ao concorrente para este perfil. */
  pessoas: number;
  valorHoraSemIva: number;
  valorHoraComIva: number;
  /** Valor com IVA em cada ano, a começar em `anoInicio` do projeto. */
  totaisPorAno: number[];
}

export interface ProjetoVistaGeral {
  id: string;
  nome: string;
  /** Ano económico da primeira coluna de `totaisPorAno`. */
  anoInicio: number;
  entradas: EntradaVistaGeral[];
  internos: ElementoInterno[];
}

export interface OrcamentoUnidade {
  schemaVersion: string;
  tipo: "orcamentoUnidade";
  /** Unidade a que o orçamento respeita, se quem o guardou lhe deu nome. */
  unidade: string;
  projetos: ProjetoVistaGeral[];
}

export function orcamentoInicial(): OrcamentoUnidade {
  return { schemaVersion: SCHEMA_VERSION_ATUAL, tipo: "orcamentoUnidade", unidade: "", projetos: [] };
}

// --------------------------------------------------------------------------
// Conversão a partir de um agrupamento
// --------------------------------------------------------------------------

/**
 * O nome por que o projeto passa a ser conhecido na vista.
 *
 * O nome do projeto é o que interessa — é o que distingue um procedimento do
 * seguinte. Faltando, serve o nome do procedimento; faltando os dois, é preciso
 * pôr ali alguma coisa, ou a linha fica órfã na tabela.
 */
export function nomeDoProjeto(config: LotesJSON): string {
  const nome = (config.nomeProjeto ?? "").trim();
  if (nome !== "") return nome;
  const procedimento = (config.nomeProcedimento ?? "").trim();
  return procedimento !== "" ? procedimento : "(projeto sem nome)";
}

/**
 * Lê um agrupamento como um projeto da vista.
 *
 * As horas por ano existem sempre — com pedido plurianual porque foram
 * escritas, sem ele porque `horasPorAnoDe` reparte o total. É o que permite à
 * tabela ter as mesmas colunas para todos os projetos, venham eles de um pedido
 * plurianual ou não.
 */
export function projetoDeAgrupamento(config: LotesJSON): ProjetoVistaGeral {
  const taxa = taxaIva(config);

  return {
    id: gerarId(),
    nome: nomeDoProjeto(config),
    anoInicio: config.encargosPlurianuais.anoInicio,
    entradas: config.lotes.flatMap((lote) =>
      lote.perfis.map((entrada) => {
        const valorHoraComIva = aplicarIva(entrada.valorHora, taxa).comIva;
        return {
          id: gerarId(),
          lote: lote.numero,
          perfil: entrada.perfil.perfil || "(perfil sem designação)",
          pessoas: entrada.nMinimoElementos,
          valorHoraSemIva: entrada.valorHora,
          valorHoraComIva,
          totaisPorAno: horasPorAnoDe(entrada).map((horas) => entrada.nMinimoElementos * horas * valorHoraComIva),
        };
      }),
    ),
    internos: [],
  };
}

/**
 * Acrescenta um projeto ao orçamento, substituindo o que já lá esteja com o
 * mesmo nome.
 *
 * Reimportar um agrupamento corrigido é o caso corrente — e duplicar o projeto
 * em vez de o substituir falsearia logo o total de pessoas da unidade, que é
 * precisamente o número que se veio aqui ver. Os elementos internos do projeto
 * substituído ficam: são registo desta vista, não vêm do agrupamento.
 */
export function comProjeto(orcamento: OrcamentoUnidade, novo: ProjetoVistaGeral): OrcamentoUnidade {
  const anterior = orcamento.projetos.find((p) => p.nome === novo.nome);
  const projeto = anterior === undefined ? novo : { ...novo, id: anterior.id, internos: anterior.internos };
  return {
    ...orcamento,
    projetos:
      anterior === undefined
        ? [...orcamento.projetos, projeto]
        : orcamento.projetos.map((p) => (p.id === anterior.id ? projeto : p)),
  };
}

/** Se um projeto com este nome já está na vista — para avisar que vai ser substituído. */
export function jaTemProjeto(orcamento: OrcamentoUnidade, nome: string): boolean {
  return orcamento.projetos.some((p) => p.nome === nome);
}

// --------------------------------------------------------------------------
// Remoções
// --------------------------------------------------------------------------

export function semProjeto(orcamento: OrcamentoUnidade, projetoId: string): OrcamentoUnidade {
  return { ...orcamento, projetos: orcamento.projetos.filter((p) => p.id !== projetoId) };
}

export function semInterno(orcamento: OrcamentoUnidade, projetoId: string, internoId: string): OrcamentoUnidade {
  return alterarProjeto(orcamento, projetoId, (projeto) => ({
    ...projeto,
    internos: projeto.internos.filter((i) => i.id !== internoId),
  }));
}

export function comInterno(orcamento: OrcamentoUnidade, projetoId: string, nome: string): OrcamentoUnidade {
  const limpo = nome.trim();
  if (limpo === "") return orcamento;
  return alterarProjeto(orcamento, projetoId, (projeto) => ({
    ...projeto,
    internos: [...projeto.internos, { id: gerarId(), nome: limpo }],
  }));
}

export function comNomeDeInterno(
  orcamento: OrcamentoUnidade,
  projetoId: string,
  internoId: string,
  nome: string,
): OrcamentoUnidade {
  return alterarProjeto(orcamento, projetoId, (projeto) => ({
    ...projeto,
    internos: projeto.internos.map((i) => (i.id === internoId ? { ...i, nome } : i)),
  }));
}

function alterarProjeto(
  orcamento: OrcamentoUnidade,
  projetoId: string,
  alterar: (projeto: ProjetoVistaGeral) => ProjetoVistaGeral,
): OrcamentoUnidade {
  return {
    ...orcamento,
    projetos: orcamento.projetos.map((p) => (p.id === projetoId ? alterar(p) : p)),
  };
}

// --------------------------------------------------------------------------
// Apuramento
// --------------------------------------------------------------------------

/**
 * Os anos económicos cobertos pelo orçamento, do mais cedo ao mais tarde.
 *
 * Em anos absolutos, e não em «ano n, n+1, n+2»: projetos que comecem em anos
 * diferentes não têm o mesmo ano n, e uma coluna que numas linhas fosse 2027 e
 * noutras 2028 não se poderia somar — que é a única coisa que uma vista de
 * unidade tem de saber fazer.
 */
export function anosDoOrcamento(orcamento: OrcamentoUnidade): number[] {
  const inicios = orcamento.projetos.map((p) => p.anoInicio).filter((ano) => Number.isFinite(ano));
  if (inicios.length === 0) return [];
  const primeiro = Math.min(...inicios);
  const ultimo = Math.max(...inicios) + ANOS_PLURIANUAIS - 1;
  return Array.from({ length: ultimo - primeiro + 1 }, (_, i) => primeiro + i);
}

/** O valor com IVA de um projeto num ano concreto — zero fora dos seus anos. */
export function valorDoProjetoNoAno(projeto: ProjetoVistaGeral, ano: number): number {
  const indice = ano - projeto.anoInicio;
  if (indice < 0 || indice >= ANOS_PLURIANUAIS) return 0;
  return projeto.entradas.reduce((soma, e) => soma + (e.totaisPorAno[indice] ?? 0), 0);
}

/**
 * O valor sem IVA correspondente a um total com IVA de uma entrada.
 *
 * A vista guarda os totais já com IVA — é o que a tabela mostra —, mas guarda
 * também as duas rates de onde vieram. Desfazer o IVA pela razão entre elas dá
 * de volta o mesmo produto que lhe deu origem, sem ter de andar com a taxa de
 * cada procedimento atrás, que podia até ser outra em cada um.
 */
export function semIvaDaEntrada(entrada: EntradaVistaGeral, comIva: number): number {
  return entrada.valorHoraComIva === 0 ? 0 : (comIva / entrada.valorHoraComIva) * entrada.valorHoraSemIva;
}

/** O valor sem IVA de um projeto num ano concreto — zero fora dos seus anos. */
export function valorDoProjetoNoAnoSemIva(projeto: ProjetoVistaGeral, ano: number): number {
  const indice = ano - projeto.anoInicio;
  if (indice < 0 || indice >= ANOS_PLURIANUAIS) return 0;
  return projeto.entradas.reduce((soma, e) => soma + semIvaDaEntrada(e, e.totaisPorAno[indice] ?? 0), 0);
}

/** O valor com IVA de uma entrada num ano concreto do orçamento. */
export function valorDaEntradaNoAno(projeto: ProjetoVistaGeral, entrada: EntradaVistaGeral, ano: number): number | null {
  const indice = ano - projeto.anoInicio;
  if (indice < 0 || indice >= ANOS_PLURIANUAIS) return null;
  return entrada.totaisPorAno[indice] ?? 0;
}

/**
 * Os elementos externos de um projeto: os exigidos aos concorrentes nos perfis.
 *
 * É o mínimo que o procedimento impõe, e não quem lá está: o que a vista
 * compara é o que cada projeto obriga a ter.
 */
export function externosDoProjeto(projeto: ProjetoVistaGeral): number {
  return projeto.entradas.reduce((soma, e) => soma + e.pessoas, 0);
}

/** Os elementos internos de um projeto: os da casa, registados à mão. */
export function internosDoProjeto(projeto: ProjetoVistaGeral): number {
  return projeto.internos.length;
}

/**
 * As pessoas afetas a um projeto: as exigidas aos concorrentes, mais as da casa.
 *
 * Cada elemento interno conta um, tal como cada elemento exigido num perfil
 * conta o que o perfil pedir. É a soma que dá a resposta procurada — onde é que
 * está a equipa —, e por isso as duas origens contam da mesma maneira.
 */
export function pessoasDoProjeto(projeto: ProjetoVistaGeral): number {
  return externosDoProjeto(projeto) + internosDoProjeto(projeto);
}

export function externosDaUnidade(orcamento: OrcamentoUnidade): number {
  return orcamento.projetos.reduce((soma, p) => soma + externosDoProjeto(p), 0);
}

export function internosDaUnidade(orcamento: OrcamentoUnidade): number {
  return orcamento.projetos.reduce((soma, p) => soma + internosDoProjeto(p), 0);
}

export function pessoasDaUnidade(orcamento: OrcamentoUnidade): number {
  return orcamento.projetos.reduce((soma, p) => soma + pessoasDoProjeto(p), 0);
}

/** O valor total do projeto, com IVA: a soma de todos os anos. */
export function valorDoProjeto(projeto: ProjetoVistaGeral): number {
  return projeto.entradas.reduce((soma, e) => soma + e.totaisPorAno.reduce((s, v) => s + v, 0), 0);
}

export function valorDaUnidade(orcamento: OrcamentoUnidade): number {
  return orcamento.projetos.reduce((soma, p) => soma + valorDoProjeto(p), 0);
}

/**
 * A fatia da unidade que o projeto ocupa, em pessoas.
 *
 * Em pessoas e não em euros: a pergunta é onde está a equipa, e uma equipa
 * pequena num contrato caro continua a ser uma equipa pequena.
 */
export function percentagemNaUnidade(orcamento: OrcamentoUnidade, projeto: ProjetoVistaGeral): number {
  const total = pessoasDaUnidade(orcamento);
  return total === 0 ? 0 : (pessoasDoProjeto(projeto) / total) * 100;
}

// --------------------------------------------------------------------------
// Ordem dos projetos
// --------------------------------------------------------------------------
//
// A ordem da lista é a ordem por que os projetos aparecem — nas duas tabelas e
// nos dois ficheiros. Não há uma ordem por tabela: quem arrasta numa está a
// dizer em que ordem quer ver os projetos, e não em que ordem quer ver aquela
// tabela.

/** A ordem com o projeto arrastado no lugar de outro, empurrando os do meio. */
export function comProjetoMovido(
  orcamento: OrcamentoUnidade,
  arrastadoId: string,
  alvoId: string,
): OrcamentoUnidade {
  if (arrastadoId === alvoId) return orcamento;

  const de = orcamento.projetos.findIndex((p) => p.id === arrastadoId);
  const para = orcamento.projetos.findIndex((p) => p.id === alvoId);
  if (de < 0 || para < 0) return orcamento;

  const projetos = [...orcamento.projetos];
  const [movido] = projetos.splice(de, 1);
  projetos.splice(para, 0, movido);
  return { ...orcamento, projetos };
}

/**
 * A ordem com o projeto deslocado alguns lugares para cima ou para baixo.
 *
 * É o que o teclado usa: arrastar com o rato não é a única maneira de ordenar,
 * e quem não o possa fazer tem de conseguir o mesmo com as setas. Nas pontas
 * não dá erro nem dá a volta — fica onde está.
 */
export function comProjetoDeslocado(
  orcamento: OrcamentoUnidade,
  projetoId: string,
  passos: number,
): OrcamentoUnidade {
  const de = orcamento.projetos.findIndex((p) => p.id === projetoId);
  if (de < 0) return orcamento;

  const para = Math.min(Math.max(de + passos, 0), orcamento.projetos.length - 1);
  if (para === de) return orcamento;
  return comProjetoMovido(orcamento, projetoId, orcamento.projetos[para].id);
}

/** Os lotes de um projeto, pela ordem em que aparecem. */
export function lotesDoProjeto(projeto: ProjetoVistaGeral): string[] {
  const vistos: string[] = [];
  for (const entrada of projeto.entradas) if (!vistos.includes(entrada.lote)) vistos.push(entrada.lote);
  return vistos;
}

/** O total da unidade em cada ano, com IVA, pela ordem de `anosDoOrcamento`. */
export function totaisPorAnoDaUnidade(orcamento: OrcamentoUnidade): number[] {
  return anosDoOrcamento(orcamento).map((ano) =>
    orcamento.projetos.reduce((soma, p) => soma + valorDoProjetoNoAno(p, ano), 0),
  );
}

/**
 * O mesmo, sem IVA.
 *
 * Só o total da unidade o mostra: é o valor que instrui o processo, e cada
 * linha da tabela a levar as duas versões dobrava a altura de tudo para
 * responder a uma pergunta que só se faz no fim.
 */
export function totaisPorAnoDaUnidadeSemIva(orcamento: OrcamentoUnidade): number[] {
  return anosDoOrcamento(orcamento).map((ano) =>
    orcamento.projetos.reduce((soma, p) => soma + valorDoProjetoNoAnoSemIva(p, ano), 0),
  );
}

// --------------------------------------------------------------------------
// (Des)serialização
// --------------------------------------------------------------------------

export function orcamentoParaJSON(orcamento: OrcamentoUnidade): string {
  return JSON.stringify(orcamento, null, 2);
}

export function importarOrcamentoJSON(texto: string): OrcamentoUnidade {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new ErroImportacao("O ficheiro não contém JSON válido.");
  }
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) {
    throw new ErroImportacao("O ficheiro não corresponde a um orçamento de unidade.");
  }

  const registo = bruto as Record<string, unknown>;
  if (registo.schemaVersion !== SCHEMA_VERSION_ATUAL) {
    throw new ErroImportacao(
      `Versão de esquema desconhecida ("${String(registo.schemaVersion)}"). ` +
        `Esta aplicação suporta a versão "${SCHEMA_VERSION_ATUAL}".`,
    );
  }
  if (registo.tipo !== "orcamentoUnidade") {
    throw new ErroImportacao(
      `Este ficheiro é do tipo "${String(registo.tipo)}", não um orçamento de unidade.`,
    );
  }
  if (!Array.isArray(registo.projetos)) {
    throw new ErroImportacao("O ficheiro não contém uma lista de projetos.");
  }

  return normalizarOrcamento(registo);
}

/** Se o que está guardado no navegador é um orçamento desta versão da aplicação. */
export function ehOrcamentoGuardado(valor: unknown): valor is OrcamentoUnidade {
  if (typeof valor !== "object" || valor === null) return false;
  const o = valor as Partial<OrcamentoUnidade>;
  return o.tipo === "orcamentoUnidade" && o.schemaVersion === SCHEMA_VERSION_ATUAL && Array.isArray(o.projetos);
}

/**
 * Põe em dia um orçamento que estava guardado, no navegador ou num ficheiro.
 *
 * É o mesmo trabalho nos dois casos: o que ficou gravado traz o modelo do dia
 * em que foi gravado, e a aplicação entretanto andou. Fazê-lo num sítio só é o
 * que garante que carregar de ficheiro e recuperar do navegador dão o mesmo.
 */
export function normalizarOrcamento(bruto: object): OrcamentoUnidade {
  const registo = bruto as Record<string, unknown>;
  return {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    tipo: "orcamentoUnidade",
    unidade: typeof registo.unidade === "string" ? registo.unidade : "",
    projetos: Array.isArray(registo.projetos) ? registo.projetos.map((p) => normalizarProjeto(p)) : [],
  };
}

function normalizarProjeto(bruto: unknown): ProjetoVistaGeral {
  if (typeof bruto !== "object" || bruto === null) {
    throw new ErroImportacao("O ficheiro tem um projeto que não é um registo.");
  }
  const p = bruto as Record<string, unknown>;
  const anoInicio = Number(p.anoInicio);

  return {
    id: typeof p.id === "string" && p.id !== "" ? p.id : gerarId(),
    nome: typeof p.nome === "string" && p.nome.trim() !== "" ? p.nome : "(projeto sem nome)",
    anoInicio: Number.isInteger(anoInicio) ? anoInicio : new Date().getFullYear(),
    entradas: Array.isArray(p.entradas) ? p.entradas.map((e) => normalizarEntrada(e)) : [],
    internos: Array.isArray(p.internos) ? p.internos.flatMap((i) => normalizarInterno(i)) : [],
  };
}

function normalizarEntrada(bruto: unknown): EntradaVistaGeral {
  const e = (typeof bruto === "object" && bruto !== null ? bruto : {}) as Record<string, unknown>;
  const totais = Array.isArray(e.totaisPorAno) ? e.totaisPorAno : [];

  return {
    id: typeof e.id === "string" && e.id !== "" ? e.id : gerarId(),
    lote: typeof e.lote === "string" ? e.lote : "",
    perfil: typeof e.perfil === "string" ? e.perfil : "(perfil sem designação)",
    pessoas: numero(e.pessoas),
    valorHoraSemIva: numero(e.valorHoraSemIva),
    valorHoraComIva: numero(e.valorHoraComIva),
    totaisPorAno: Array.from({ length: ANOS_PLURIANUAIS }, (_, i) => numero(totais[i])),
  };
}

/** Um interno sem nome não é ninguém: descarta-se, em vez de contar como pessoa. */
function normalizarInterno(bruto: unknown): ElementoInterno[] {
  const i = (typeof bruto === "object" && bruto !== null ? bruto : {}) as Record<string, unknown>;
  const nome = typeof i.nome === "string" ? i.nome.trim() : "";
  if (nome === "") return [];
  return [{ id: typeof i.id === "string" && i.id !== "" ? i.id : gerarId(), nome }];
}

function numero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}
