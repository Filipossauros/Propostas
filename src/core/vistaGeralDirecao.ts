// Vista Geral da Direção — as unidades lado a lado.
//
// A Vista Geral da Unidade junta os procedimentos de uma unidade; esta junta as
// unidades de uma direção. O Diretor carrega o ficheiro que cada unidade
// descarrega no seu separador e passa a ver, de uma assentada, onde está a
// equipa da direção, quanto custa cada unidade e a que rates cada perfil foi
// contratado.
//
// Aqui não se edita nada do que vem das unidades: os elementos internos são
// registados por quem conhece a equipa, na vista da própria unidade, e esta
// vista limita-se a somá-los. É deliberado — dois sítios a escrever o mesmo
// acabariam a divergir, e o dono do dado é a unidade.

import { ANOS_PLURIANUAIS, SCHEMA_VERSION_ATUAL } from "./types";
import { ErroImportacao } from "./perfil";
import {
  anosDoOrcamento,
  externosDaUnidade,
  internosDaUnidade,
  normalizarOrcamento,
  pessoasDaUnidade,
  pessoasDoProjeto,
  semIvaDaEntrada,
  valorDaEntradaNoAno,
  valorDoProjetoNoAno,
  valorDoProjetoNoAnoSemIva,
  type EntradaVistaGeral,
  type OrcamentoUnidade,
  type ProjetoVistaGeral,
} from "./vistaGeral";

export interface VistaDirecao {
  schemaVersion: string;
  tipo: "vistaDirecao";
  /** Direção a que a vista respeita, se quem a guardou lhe deu nome. */
  direcao: string;
  unidades: OrcamentoUnidade[];
}

export function vistaDirecaoInicial(): VistaDirecao {
  return { schemaVersion: SCHEMA_VERSION_ATUAL, tipo: "vistaDirecao", direcao: "", unidades: [] };
}

/**
 * O nome por que a unidade passa a ser conhecida na direção.
 *
 * É por ele que as unidades se distinguem — não há outro identificador no
 * ficheiro de uma unidade — e por isso uma unidade sem nome tem de ficar com
 * algum, ou as linhas ficavam órfãs na tabela.
 */
export function nomeDaUnidade(orcamento: OrcamentoUnidade): string {
  const nome = orcamento.unidade.trim();
  return nome === "" ? "(unidade sem nome)" : nome;
}

/**
 * Acrescenta uma unidade, substituindo a que já lá esteja com o mesmo nome.
 *
 * Recarregar a vista corrigida de uma unidade é o caso corrente — e duplicá-la
 * falseava logo o total de pessoas da direção, que é precisamente o número que
 * se veio aqui ver.
 */
export function comUnidade(vista: VistaDirecao, nova: OrcamentoUnidade): VistaDirecao {
  const nome = nomeDaUnidade(nova);
  const jaLa = vista.unidades.some((u) => nomeDaUnidade(u) === nome);
  return {
    ...vista,
    unidades: jaLa
      ? vista.unidades.map((u) => (nomeDaUnidade(u) === nome ? nova : u))
      : [...vista.unidades, nova],
  };
}

/** Se uma unidade com este nome já está na vista — para avisar que vai ser substituída. */
export function jaTemUnidade(vista: VistaDirecao, nome: string): boolean {
  return vista.unidades.some((u) => nomeDaUnidade(u) === nome);
}

export function semUnidade(vista: VistaDirecao, nome: string): VistaDirecao {
  return { ...vista, unidades: vista.unidades.filter((u) => nomeDaUnidade(u) !== nome) };
}

// --------------------------------------------------------------------------
// Filtros
// --------------------------------------------------------------------------

/**
 * O que está escolhido nos filtros.
 *
 * `null` quer dizer «todos», e é o estado de partida: a vista abre-se para ver
 * o conjunto, não um recorte. Os anos são vários — é frequente a pergunta ser
 * sobre um biénio — e nenhum escolhido vale todos, pela mesma razão.
 */
export interface FiltrosDirecao {
  unidade: string | null;
  anos: number[];
  perfil: string | null;
  projeto: string | null;
}

export function filtrosIniciais(): FiltrosDirecao {
  return { unidade: null, anos: [], perfil: null, projeto: null };
}

export function haFiltros(filtros: FiltrosDirecao): boolean {
  return (
    filtros.unidade !== null || filtros.perfil !== null || filtros.projeto !== null || filtros.anos.length > 0
  );
}

/**
 * A vista reduzida ao que os filtros deixam passar.
 *
 * Filtrar devolve outra vista, e não uma lista de linhas: as três tabelas, os
 * totais e o Excel leem todos daqui, e é isso que garante que mostram o mesmo
 * recorte sem cada um repetir a regra.
 *
 * Com um perfil escolhido os elementos internos ficam de fora: a pergunta
 * passou a ser sobre quem foi contratado naquele perfil, e um interno não foi
 * contratado em perfil nenhum.
 */
export function aplicarFiltros(vista: VistaDirecao, filtros: FiltrosDirecao): VistaDirecao {
  const anos = new Set(filtros.anos);

  const unidades = vista.unidades
    .filter((u) => filtros.unidade === null || nomeDaUnidade(u) === filtros.unidade)
    .map((u) => ({
      ...u,
      projetos: u.projetos
        .filter((p) => filtros.projeto === null || p.nome === filtros.projeto)
        .filter((p) => anos.size === 0 || anosDoProjeto(p).some((ano) => anos.has(ano)))
        .map((p) => ({
          ...p,
          entradas: p.entradas.filter((e) => filtros.perfil === null || e.perfil === filtros.perfil),
          internos: filtros.perfil === null ? p.internos : [],
        }))
        .filter((p) => p.entradas.length > 0 || p.internos.length > 0),
    }))
    .filter((u) => u.projetos.length > 0);

  return { ...vista, unidades };
}

/** Os anos económicos de um projeto: o de início e os que o plurianual cobre. */
export function anosDoProjeto(projeto: ProjetoVistaGeral): number[] {
  return Array.from({ length: ANOS_PLURIANUAIS }, (_, i) => projeto.anoInicio + i);
}

// --------------------------------------------------------------------------
// Listas para os filtros
// --------------------------------------------------------------------------

const porTexto = (a: string, b: string) => a.localeCompare(b, "pt");

export function unidadesDaVista(vista: VistaDirecao): string[] {
  return vista.unidades.map(nomeDaUnidade);
}

export function projetosDaVista(vista: VistaDirecao): string[] {
  return [...new Set(vista.unidades.flatMap((u) => u.projetos.map((p) => p.nome)))].sort(porTexto);
}

export function perfisDaVista(vista: VistaDirecao): string[] {
  return [
    ...new Set(vista.unidades.flatMap((u) => u.projetos.flatMap((p) => p.entradas.map((e) => e.perfil)))),
  ].sort(porTexto);
}

// --------------------------------------------------------------------------
// Apuramento
// --------------------------------------------------------------------------

/** Os anos económicos cobertos pela direção, do mais cedo ao mais tarde. */
export function anosDaDirecao(vista: VistaDirecao): number[] {
  return [...new Set(vista.unidades.flatMap((u) => anosDoOrcamento(u)))].sort((a, b) => a - b);
}

export function externosDaDirecao(vista: VistaDirecao): number {
  return vista.unidades.reduce((soma, u) => soma + externosDaUnidade(u), 0);
}

export function internosDaDirecao(vista: VistaDirecao): number {
  return vista.unidades.reduce((soma, u) => soma + internosDaUnidade(u), 0);
}

export function pessoasDaDirecao(vista: VistaDirecao): number {
  return vista.unidades.reduce((soma, u) => soma + pessoasDaUnidade(u), 0);
}

/**
 * A fatia da direção que a unidade ocupa, em pessoas.
 *
 * Em pessoas e não em euros, como na vista da unidade: a pergunta é onde está a
 * equipa, e só se apuram custos de FSE.
 */
export function percentagemNaDirecao(vista: VistaDirecao, orcamento: OrcamentoUnidade): number {
  const total = pessoasDaDirecao(vista);
  return total === 0 ? 0 : (pessoasDaUnidade(orcamento) / total) * 100;
}

/** A fatia da unidade que o projeto ocupa — a mesma conta, um nível abaixo. */
export function percentagemNaSuaUnidade(orcamento: OrcamentoUnidade, projeto: ProjetoVistaGeral): number {
  const total = pessoasDaUnidade(orcamento);
  return total === 0 ? 0 : (pessoasDoProjeto(projeto) / total) * 100;
}

export function valorDaUnidadeNoAno(orcamento: OrcamentoUnidade, ano: number): number {
  return orcamento.projetos.reduce((soma, p) => soma + valorDoProjetoNoAno(p, ano), 0);
}

export function valorDaUnidadeNoAnoSemIva(orcamento: OrcamentoUnidade, ano: number): number {
  return orcamento.projetos.reduce((soma, p) => soma + valorDoProjetoNoAnoSemIva(p, ano), 0);
}

/** O que a unidade vale nos anos pedidos, com IVA. */
export function valorDaUnidadeNosAnos(orcamento: OrcamentoUnidade, anos: number[]): number {
  return anos.reduce((soma, ano) => soma + valorDaUnidadeNoAno(orcamento, ano), 0);
}

export function totaisPorAnoDaDirecao(vista: VistaDirecao, anos: number[]): number[] {
  return anos.map((ano) => vista.unidades.reduce((soma, u) => soma + valorDaUnidadeNoAno(u, ano), 0));
}

export function totaisPorAnoDaDirecaoSemIva(vista: VistaDirecao, anos: number[]): number[] {
  return anos.map((ano) => vista.unidades.reduce((soma, u) => soma + valorDaUnidadeNoAnoSemIva(u, ano), 0));
}

export function valorDaDirecao(vista: VistaDirecao, anos: number[]): number {
  return totaisPorAnoDaDirecao(vista, anos).reduce((soma, v) => soma + v, 0);
}

export function valorDaDirecaoSemIva(vista: VistaDirecao, anos: number[]): number {
  return totaisPorAnoDaDirecaoSemIva(vista, anos).reduce((soma, v) => soma + v, 0);
}

/** O que uma entrada vale nos anos pedidos, com IVA — e o mesmo sem IVA. */
export function valorDaEntradaNosAnos(
  projeto: ProjetoVistaGeral,
  entrada: EntradaVistaGeral,
  anos: number[],
): number {
  return anos.reduce((soma, ano) => soma + (valorDaEntradaNoAno(projeto, entrada, ano) ?? 0), 0);
}

// --------------------------------------------------------------------------
// Rates por perfil
// --------------------------------------------------------------------------

/** Uma contratação de um perfil: onde foi, a que rate e com quantas pessoas. */
export interface UsoDePerfil {
  unidade: string;
  projeto: string;
  lote: string;
  pessoas: number;
  valorHoraSemIva: number;
  valorHoraComIva: number;
  /** O que esta linha vale nos anos em vista, com IVA. */
  valor: number;
}

/**
 * Um perfil e as rates a que foi contratado em toda a direção.
 *
 * É a pergunta que só se pode fazer daqui: dentro de uma unidade a rate de um
 * perfil é uma só, mas entre unidades pode não ser — e é isso que a Direção
 * precisa de ver.
 */
export interface PerfilComRates {
  perfil: string;
  usos: UsoDePerfil[];
  /** Unidades distintas onde o perfil foi contratado. */
  unidades: number;
  pessoas: number;
  minimoSemIva: number;
  maximoSemIva: number;
  /** Média ponderada pelas pessoas: contratar dez a 40 € pesa mais do que um a 60 €. */
  mediaSemIva: number;
  minimoComIva: number;
  maximoComIva: number;
  mediaComIva: number;
}

export function ratesPorPerfil(vista: VistaDirecao, anos: number[]): PerfilComRates[] {
  const porPerfil = new Map<string, UsoDePerfil[]>();

  for (const unidade of vista.unidades) {
    for (const projeto of unidade.projetos) {
      for (const entrada of projeto.entradas) {
        const usos = porPerfil.get(entrada.perfil) ?? [];
        usos.push({
          unidade: nomeDaUnidade(unidade),
          projeto: projeto.nome,
          lote: entrada.lote,
          pessoas: entrada.pessoas,
          valorHoraSemIva: entrada.valorHoraSemIva,
          valorHoraComIva: entrada.valorHoraComIva,
          valor: valorDaEntradaNosAnos(projeto, entrada, anos),
        });
        porPerfil.set(entrada.perfil, usos);
      }
    }
  }

  return [...porPerfil.entries()]
    .map(([perfil, usos]) => {
      const pessoas = usos.reduce((soma, u) => soma + u.pessoas, 0);
      const media = (valor: (u: UsoDePerfil) => number) =>
        pessoas === 0
          ? usos.reduce((soma, u) => soma + valor(u), 0) / usos.length
          : usos.reduce((soma, u) => soma + valor(u) * u.pessoas, 0) / pessoas;

      return {
        perfil,
        usos,
        unidades: new Set(usos.map((u) => u.unidade)).size,
        pessoas,
        minimoSemIva: Math.min(...usos.map((u) => u.valorHoraSemIva)),
        maximoSemIva: Math.max(...usos.map((u) => u.valorHoraSemIva)),
        mediaSemIva: media((u) => u.valorHoraSemIva),
        minimoComIva: Math.min(...usos.map((u) => u.valorHoraComIva)),
        maximoComIva: Math.max(...usos.map((u) => u.valorHoraComIva)),
        mediaComIva: media((u) => u.valorHoraComIva),
      };
    })
    .sort((a, b) => porTexto(a.perfil, b.perfil));
}

/** Se o perfil foi contratado a mais do que uma rate — o que a Direção vem cá ver. */
export function rateVariavel(perfil: PerfilComRates): boolean {
  return perfil.minimoSemIva !== perfil.maximoSemIva;
}

/** O valor sem IVA de uma entrada num ano, para o Excel não repetir a conta. */
export function semIva(entrada: EntradaVistaGeral, comIva: number): number {
  return semIvaDaEntrada(entrada, comIva);
}

// --------------------------------------------------------------------------
// (Des)serialização
// --------------------------------------------------------------------------

export function vistaDirecaoParaJSON(vista: VistaDirecao): string {
  return JSON.stringify(vista, null, 2);
}

export function importarVistaDirecaoJSON(texto: string): VistaDirecao {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new ErroImportacao("O ficheiro não contém JSON válido.");
  }
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) {
    throw new ErroImportacao("O ficheiro não corresponde a uma vista de direção.");
  }

  const registo = bruto as Record<string, unknown>;
  if (registo.schemaVersion !== SCHEMA_VERSION_ATUAL) {
    throw new ErroImportacao(
      `Versão de esquema desconhecida ("${String(registo.schemaVersion)}"). ` +
        `Esta aplicação suporta a versão "${SCHEMA_VERSION_ATUAL}".`,
    );
  }
  if (registo.tipo !== "vistaDirecao") {
    throw new ErroImportacao(`Este ficheiro é do tipo "${String(registo.tipo)}", não uma vista de direção.`);
  }
  if (!Array.isArray(registo.unidades)) {
    throw new ErroImportacao("O ficheiro não contém uma lista de unidades.");
  }

  return normalizarVistaDirecao(registo);
}

export function ehVistaDirecaoGuardada(valor: unknown): valor is VistaDirecao {
  if (typeof valor !== "object" || valor === null) return false;
  const v = valor as Partial<VistaDirecao>;
  return v.tipo === "vistaDirecao" && v.schemaVersion === SCHEMA_VERSION_ATUAL && Array.isArray(v.unidades);
}

export function normalizarVistaDirecao(bruto: object): VistaDirecao {
  const registo = bruto as Record<string, unknown>;
  return {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    tipo: "vistaDirecao",
    direcao: typeof registo.direcao === "string" ? registo.direcao : "",
    unidades: Array.isArray(registo.unidades)
      ? registo.unidades.flatMap((u) => (typeof u === "object" && u !== null ? [normalizarOrcamento(u)] : []))
      : [],
  };
}
