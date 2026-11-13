// A biblioteca de pedidos.
//
// Até aqui a aplicação guardava um só pedido de cada tipo: começar outro
// apagava o anterior. A biblioteca guarda-os todos — de bolsa de horas e de
// licenciamento —, cada um com os seus dados, e diz qual está aberto. Os
// módulos continuam a trabalhar um pedido de cada vez: o aberto.
//
// Fica neste navegador, como o resto, numa chave própria: a versão anterior da
// aplicação, publicada ao lado, continua a ler e a escrever as suas chaves sem
// que esta lhes toque. Na primeira abertura, os pedidos que lá estavam são
// copiados para a biblioteca — ver `bibliotecaDaVersaoAnterior`.
//
// Os dados das propostas dos concorrentes (análise de propostas) nunca entram
// aqui: continuam só em memória.

import type { JustificacaoProjeto, LotesJSON, PerfilJSON } from "./types";
import { SCHEMA_VERSION_ATUAL } from "./types";
import { gerarId } from "./id";
import { justificacaoInicial, normalizarJustificacao, temJustificacao, validarJustificacao } from "./justificacao";
import {
  ErroImportacao,
  importarPerfisJSON,
  normalizarPerfisGuardados,
  validarDescricaoProjeto,
  validarNomeProjeto,
  validarPerfis,
} from "./perfil";
import {
  importarLotesJSON,
  lotesIniciais,
  normalizarLotesGuardados,
  totalProcedimento,
  validarCategoriasEavalia,
  validarLotes,
} from "./lotes";
import { comMargemPrudencial } from "./margem";
import {
  comMargemLicenciamento,
  importarPedidoLicenciamentoJSON,
  normalizarPedidoLicenciamento,
  pedidoLicenciamentoInicial,
  validarCondicoes,
  validarLicencas,
  validarPedido,
  validarProdutoLicenciamento,
  valorEstimado,
  type PedidoLicenciamento,
} from "./licenciamento";

export type TipoPedido = "bolsa" | "licenciamento";

export const TIPOS_PEDIDO: Record<TipoPedido, string> = {
  bolsa: "Bolsa de horas",
  licenciamento: "Licenciamento",
};

/** Os dados de um pedido de bolsa de horas: o projeto (Módulo 1), os perfis (2) e os lotes (3). */
export interface DadosBolsa {
  nomeProjeto: string;
  descricaoProjeto: string;
  justificacao: JustificacaoProjeto;
  perfis: PerfilJSON[];
  lotes: LotesJSON;
}

/** Uma versão do pedido: quando nasceu e porquê (ex.: a aprovação de um cenário do orçamento). */
export interface VersaoDoPedido {
  versao: number;
  /** Data ISO. */
  em: string;
  nota: string;
}

interface Comum {
  id: string;
  /** Datas ISO. */
  criadoEm: string;
  atualizadoEm: string;
  /** A versão do pedido: sobe quando a aprovação de um cenário do orçamento o altera. */
  versao: number;
  /** Se entra no orçamento da unidade. */
  noOrcamento: boolean;
  arquivado: boolean;
  /** O que mudou o pedido fora dos módulos (as aprovações do orçamento), do mais antigo ao mais recente. */
  historico: VersaoDoPedido[];
}

export type PedidoNaBiblioteca =
  | (Comum & { tipo: "bolsa"; dados: DadosBolsa })
  | (Comum & { tipo: "licenciamento"; dados: PedidoLicenciamento });

export interface Biblioteca {
  schemaVersion: string;
  tipo: "biblioteca";
  pedidos: PedidoNaBiblioteca[];
  /** O pedido aberto, ou nenhum. */
  ativoId: string | null;
}

export const VERSAO_BIBLIOTECA = "1";

export function bibliotecaVazia(): Biblioteca {
  return { schemaVersion: VERSAO_BIBLIOTECA, tipo: "biblioteca", pedidos: [], ativoId: null };
}

export function dadosBolsaIniciais(): DadosBolsa {
  return {
    nomeProjeto: "",
    descricaoProjeto: "",
    justificacao: justificacaoInicial(),
    perfis: [],
    lotes: lotesIniciais(),
  };
}

function comum(agora: string): Comum {
  return {
    id: gerarId(),
    criadoEm: agora,
    atualizadoEm: agora,
    versao: 1,
    noOrcamento: false,
    arquivado: false,
    historico: [],
  };
}

export function novoPedidoBolsa(dados: DadosBolsa = dadosBolsaIniciais(), agora = new Date().toISOString()): PedidoNaBiblioteca {
  return { ...comum(agora), tipo: "bolsa", dados };
}

export function novoPedidoLicenciamento(
  dados: PedidoLicenciamento = pedidoLicenciamentoInicial(),
  agora = new Date().toISOString(),
): PedidoNaBiblioteca {
  return { ...comum(agora), tipo: "licenciamento", dados };
}

// --------------------------------------------------------------------------
// O que se diz de cada pedido
// --------------------------------------------------------------------------

export function nomeDoPedido(p: PedidoNaBiblioteca): string {
  return (p.tipo === "bolsa" ? p.dados.nomeProjeto : p.dados.nomeProduto).trim();
}

/** O nome, ou «(sem nome)», para as listas. */
export function nomeParaListas(p: PedidoNaBiblioteca): string {
  return nomeDoPedido(p) || "(sem nome)";
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** «3 lotes · 7 perfis · 2027–2029», «2 licenças · 1 serviço». */
export function resumoDoPedido(p: PedidoNaBiblioteca): string {
  if (p.tipo === "bolsa") {
    const lotes = p.dados.lotes.lotes;
    const partes = [plural(lotes.length, "lote", "lotes"), plural(p.dados.perfis.length, "perfil", "perfis")];
    const enc = p.dados.lotes.encargosPlurianuais;
    if (lotes.length > 0) partes.push(enc.ativo ? `${enc.anoInicio}–${enc.anoInicio + 2}` : String(enc.anoInicio));
    return partes.join(" · ");
  }
  const servicos = p.dados.licencas.filter((l) => l.objeto === "servico").length;
  const licencas = p.dados.licencas.length - servicos;
  const partes = [plural(licencas, "licença", "licenças")];
  if (servicos > 0) partes.push(plural(servicos, "serviço", "serviços"));
  return partes.join(" · ");
}

/** As questões por resolver do pedido, de todos os seus módulos. */
export function questoesDoPedido(p: PedidoNaBiblioteca): number {
  if (p.tipo === "bolsa") {
    const d = p.dados;
    return (
      validarNomeProjeto(d.nomeProjeto).length +
      validarDescricaoProjeto(d.descricaoProjeto).length +
      validarJustificacao(d.justificacao).length +
      validarPerfis(d.perfis).length +
      validarLotes(d.lotes).length +
      validarCategoriasEavalia(d.lotes).length
    );
  }
  const d = p.dados;
  return (
    validarProdutoLicenciamento(d).length +
    validarLicencas(d).length +
    validarCondicoes(d).length +
    validarPedido(d).length
  );
}

/** Se o pedido ainda não tem nada escrito. */
export function pedidoVazio(p: PedidoNaBiblioteca): boolean {
  if (p.tipo === "bolsa") {
    const d = p.dados;
    return (
      d.nomeProjeto.trim() === "" &&
      d.descricaoProjeto.trim() === "" &&
      !temJustificacao(d.justificacao) &&
      d.perfis.length === 0 &&
      d.lotes.lotes.length === 0
    );
  }
  const d = p.dados;
  return d.nomeProduto.trim() === "" && d.descricaoProduto.trim() === "" && d.licencas.length === 0;
}

export type EstadoDoPedido = "preparacao" | "pronto" | "revisto" | "arquivado";

export const ESTADOS_PEDIDO: Record<EstadoDoPedido, string> = {
  preparacao: "Em preparação",
  pronto: "Pronto",
  revisto: "Revisto",
  arquivado: "Arquivado",
};

/**
 * O estado decorre do pedido: arquivado se foi arquivado; revisto se uma
 * aprovação do orçamento o alterou (versão acima de 1); pronto sem questões
 * por resolver; em preparação nos restantes.
 */
export function estadoDoPedido(p: PedidoNaBiblioteca): EstadoDoPedido {
  if (p.arquivado) return "arquivado";
  if (questoesDoPedido(p) > 0) return "preparacao";
  return p.versao > 1 ? "revisto" : "pronto";
}

/** O valor estimado sem IVA, com a margem prudencial — o das peças. `null` sem nada a somar. */
export function valorEstimadoDoPedido(p: PedidoNaBiblioteca): number | null {
  if (p.tipo === "bolsa") {
    if (p.dados.lotes.lotes.length === 0) return null;
    const v = totalProcedimento(comMargemPrudencial(p.dados.lotes)).semIva;
    return v > 0 ? v : null;
  }
  if (p.dados.licencas.length === 0) return null;
  const v = valorEstimado(comMargemLicenciamento(p.dados));
  return v > 0 ? v : null;
}

// --------------------------------------------------------------------------
// Alterações
// --------------------------------------------------------------------------

export function pedidoAtivo(b: Biblioteca): PedidoNaBiblioteca | null {
  return b.pedidos.find((p) => p.id === b.ativoId) ?? null;
}

/** A biblioteca com um pedido alterado (e a data de atualização posta em dia). */
export function comPedidoAlterado(
  b: Biblioteca,
  id: string,
  alterar: (p: PedidoNaBiblioteca) => PedidoNaBiblioteca,
  agora = new Date().toISOString(),
): Biblioteca {
  return {
    ...b,
    pedidos: b.pedidos.map((p) => (p.id === id ? { ...alterar(p), atualizadoEm: agora } : p)),
  };
}

/** Os dados de bolsa do pedido aberto, alterados. Sem pedido de bolsa aberto, nada muda. */
export function comDadosBolsa(b: Biblioteca, alterar: (d: DadosBolsa) => DadosBolsa): Biblioteca {
  const ativo = pedidoAtivo(b);
  if (ativo === null || ativo.tipo !== "bolsa") return b;
  return comPedidoAlterado(b, ativo.id, (p) => (p.tipo === "bolsa" ? { ...p, dados: alterar(p.dados) } : p));
}

/** Os dados de licenciamento do pedido aberto, alterados. */
export function comDadosLicenciamento(
  b: Biblioteca,
  alterar: (d: PedidoLicenciamento) => PedidoLicenciamento,
): Biblioteca {
  const ativo = pedidoAtivo(b);
  if (ativo === null || ativo.tipo !== "licenciamento") return b;
  return comPedidoAlterado(b, ativo.id, (p) => (p.tipo === "licenciamento" ? { ...p, dados: alterar(p.dados) } : p));
}

export function comPedidoNovo(b: Biblioteca, p: PedidoNaBiblioteca, abrir = true): Biblioteca {
  return { ...b, pedidos: [...b.pedidos, p], ativoId: abrir ? p.id : b.ativoId };
}

export function comPedidoAberto(b: Biblioteca, id: string | null): Biblioteca {
  return { ...b, ativoId: id !== null && b.pedidos.some((p) => p.id === id) ? id : null };
}

/** Uma cópia do pedido, como versão 1, com «(cópia)» no nome. */
export function pedidoDuplicado(p: PedidoNaBiblioteca, agora = new Date().toISOString()): PedidoNaBiblioteca {
  const base = { ...comum(agora), noOrcamento: false };
  const nome = `${nomeDoPedido(p) || "Pedido"} (cópia)`;
  if (p.tipo === "bolsa") {
    const dados = structuredClone(p.dados);
    dados.nomeProjeto = nome;
    dados.lotes = { ...dados.lotes, nomeProjeto: nome };
    return { ...base, tipo: "bolsa", dados };
  }
  const dados = structuredClone(p.dados);
  dados.nomeProduto = nome;
  return { ...base, tipo: "licenciamento", dados };
}

/** Marca (ou desmarca) pedidos para o orçamento. */
export function comNoOrcamento(b: Biblioteca, ids: string[], noOrcamento: boolean): Biblioteca {
  const alvo = new Set(ids);
  return { ...b, pedidos: b.pedidos.map((p) => (alvo.has(p.id) ? { ...p, noOrcamento } : p)) };
}

export function semPedido(b: Biblioteca, id: string): Biblioteca {
  return { ...b, pedidos: b.pedidos.filter((p) => p.id !== id), ativoId: b.ativoId === id ? null : b.ativoId };
}

// --------------------------------------------------------------------------
// Guardar, ler e migrar
// --------------------------------------------------------------------------

function objeto(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

const texto = (v: unknown, omissao = ""): string => (typeof v === "string" ? v : omissao);

function normalizarDadosBolsa(bruto: unknown): DadosBolsa {
  const r = objeto(bruto);
  const lotesBrutos = objeto(r.lotes);
  const lotes =
    lotesBrutos.tipo === "lotes" && Array.isArray(lotesBrutos.lotes)
      ? normalizarLotesGuardados(lotesBrutos as unknown as LotesJSON)
      : lotesIniciais();
  return {
    nomeProjeto: texto(r.nomeProjeto),
    descricaoProjeto: texto(r.descricaoProjeto),
    justificacao: normalizarJustificacao(r.justificacao),
    perfis: Array.isArray(r.perfis) ? normalizarPerfisGuardados(r.perfis as PerfilJSON[]) : [],
    lotes,
  };
}

function normalizarHistorico(bruto: unknown): VersaoDoPedido[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.flatMap((x) => {
    const r = objeto(x);
    const versao = Number(r.versao);
    return Number.isInteger(versao) && versao >= 1 ? [{ versao, em: texto(r.em), nota: texto(r.nota) }] : [];
  });
}

/** Um pedido guardado (na biblioteca, ou numa aprovação do orçamento), posto em dia. `null` se não é um pedido. */
export function normalizarPedido(bruto: unknown): PedidoNaBiblioteca | null {
  const r = objeto(bruto);
  if (r.tipo !== "bolsa" && r.tipo !== "licenciamento") return null;
  const agora = new Date().toISOString();
  const c: Comum = {
    id: texto(r.id) || gerarId(),
    criadoEm: texto(r.criadoEm, agora),
    atualizadoEm: texto(r.atualizadoEm, agora),
    versao: typeof r.versao === "number" && Number.isInteger(r.versao) && r.versao >= 1 ? r.versao : 1,
    noOrcamento: r.noOrcamento === true,
    arquivado: r.arquivado === true,
    historico: normalizarHistorico(r.historico),
  };
  return r.tipo === "bolsa"
    ? { ...c, tipo: "bolsa", dados: normalizarDadosBolsa(r.dados) }
    : { ...c, tipo: "licenciamento", dados: normalizarPedidoLicenciamento(r.dados) };
}

export function ehBibliotecaGuardada(valor: unknown): valor is Biblioteca {
  const r = objeto(valor);
  return r.tipo === "biblioteca" && Array.isArray(r.pedidos);
}

export function normalizarBiblioteca(valor: Biblioteca): Biblioteca {
  const pedidos = (valor.pedidos as unknown[]).map(normalizarPedido).filter((p): p is PedidoNaBiblioteca => p !== null);
  const ativoId = typeof valor.ativoId === "string" && pedidos.some((p) => p.id === valor.ativoId) ? valor.ativoId : null;
  return { schemaVersion: VERSAO_BIBLIOTECA, tipo: "biblioteca", pedidos, ativoId };
}

/** As chaves da versão anterior, onde estava o pedido único de cada tipo. Só se leem. */
export const CHAVES_DA_VERSAO_ANTERIOR = {
  perfis: "propostas.v2.perfis",
  lotes: "propostas.v2.lotes",
  nomeProjeto: "propostas.v2.nomeProjeto",
  descricaoProjeto: "propostas.v2.descricaoProjeto",
  justificacao: "propostas.v2.justificacaoProjeto",
  licenciamento: "propostas.v2.licenciamento",
  vistaGeral: "propostas.v2.vistaGeral",
} as const;

/**
 * A biblioteca inicial, a partir do que a versão anterior deixou guardado: o
 * pedido de bolsa de horas e o de licenciamento, se tiverem alguma coisa. O
 * de bolsa fica aberto. Nada se apaga nem se reescreve nas chaves antigas.
 */
export function bibliotecaDaVersaoAnterior(ler: (chave: string) => unknown, agora = new Date().toISOString()): Biblioteca {
  let b = bibliotecaVazia();
  const k = CHAVES_DA_VERSAO_ANTERIOR;

  const lotesBrutos = objeto(ler(k.lotes));
  const temLotes = lotesBrutos.tipo === "lotes" && lotesBrutos.schemaVersion === SCHEMA_VERSION_ATUAL && Array.isArray(lotesBrutos.lotes);
  const bolsa = normalizarDadosBolsa({
    nomeProjeto: ler(k.nomeProjeto),
    descricaoProjeto: ler(k.descricaoProjeto),
    justificacao: ler(k.justificacao),
    perfis: ler(k.perfis),
    lotes: temLotes ? lotesBrutos : undefined,
  });
  const pedidoBolsa = novoPedidoBolsa(bolsa, agora);
  if (!pedidoVazio(pedidoBolsa)) b = comPedidoNovo(b, pedidoBolsa);

  const lic = objeto(ler(k.licenciamento));
  if (lic.tipo === "licenciamento") {
    const dados = normalizarPedidoLicenciamento(lic);
    // A primeira versão do licenciamento usava o projeto da bolsa de horas como produto.
    if (dados.nomeProduto.trim() === "" && dados.licencas.length > 0 && bolsa.nomeProjeto.trim() !== "") {
      dados.nomeProduto = bolsa.nomeProjeto;
      dados.descricaoProduto = bolsa.descricaoProjeto;
      dados.justificacao = structuredClone(bolsa.justificacao);
    }
    const pedidoLic = novoPedidoLicenciamento(dados, agora);
    if (!pedidoVazio(pedidoLic)) b = comPedidoNovo(b, pedidoLic, b.ativoId === null);
  }

  // Os pedidos que já estavam no orçamento da versão anterior (pelo nome) entram marcados.
  const orcamento = objeto(ler(k.vistaGeral));
  const nomes = new Set(
    (Array.isArray(orcamento.projetos) ? orcamento.projetos : []).map((p) => texto(objeto(p).nome)).filter((n) => n !== ""),
  );
  return { ...b, pedidos: b.pedidos.map((p) => (nomes.has(nomeDoPedido(p)) ? { ...p, noOrcamento: true } : p)) };
}

// --------------------------------------------------------------------------
// Ficheiros: exportar e importar
// --------------------------------------------------------------------------

/** O pedido de bolsa de horas inteiro, num ficheiro: projeto, perfis e lotes. */
export const TIPO_FICHEIRO_PEDIDO_BOLSA = "pedidoBolsa";

export function pedidoParaJSON(p: PedidoNaBiblioteca): string {
  if (p.tipo === "licenciamento") return JSON.stringify(p.dados, null, 2);
  return JSON.stringify({ schemaVersion: SCHEMA_VERSION_ATUAL, tipo: TIPO_FICHEIRO_PEDIDO_BOLSA, ...p.dados }, null, 2);
}

export function bibliotecaParaJSON(b: Biblioteca): string {
  return JSON.stringify({ ...b, ativoId: null }, null, 2);
}

export interface Importacao {
  biblioteca: Biblioteca;
  acrescentados: string[];
  atualizados: string[];
  /** Os identificadores dos pedidos acrescentados ou atualizados. */
  ids: string[];
}

/**
 * Acrescenta à biblioteca o que vier num ficheiro: uma biblioteca inteira
 * (cópia de segurança), um pedido de bolsa de horas, um agrupamento de lotes,
 * um ficheiro de perfis, ou um pedido de licenciamento. Numa biblioteca, um
 * pedido que já cá esteja (o mesmo identificador) é substituído.
 */
export function importarParaBiblioteca(b: Biblioteca, conteudo: string, agora = new Date().toISOString()): Importacao {
  let bruto: unknown;
  try {
    bruto = JSON.parse(conteudo);
  } catch {
    throw new ErroImportacao("O ficheiro não contém JSON válido.");
  }
  const r = objeto(bruto);
  const acrescentados: string[] = [];
  const atualizados: string[] = [];
  const ids: string[] = [];
  let nova = b;
  const acrescentar = (p: PedidoNaBiblioteca) => {
    nova = comPedidoNovo(nova, p, false);
    acrescentados.push(nomeParaListas(p));
    ids.push(p.id);
  };

  switch (r.tipo) {
    case "biblioteca": {
      if (!Array.isArray(r.pedidos)) throw new ErroImportacao("A biblioteca do ficheiro não tem lista de pedidos.");
      for (const p of r.pedidos.map(normalizarPedido)) {
        if (p === null) continue;
        if (nova.pedidos.some((x) => x.id === p.id)) {
          nova = { ...nova, pedidos: nova.pedidos.map((x) => (x.id === p.id ? p : x)) };
          atualizados.push(nomeParaListas(p));
          ids.push(p.id);
        } else acrescentar(p);
      }
      break;
    }
    case TIPO_FICHEIRO_PEDIDO_BOLSA:
      if (r.schemaVersion !== SCHEMA_VERSION_ATUAL)
        throw new ErroImportacao(`Versão de esquema desconhecida ("${String(r.schemaVersion)}").`);
      acrescentar(novoPedidoBolsa(normalizarDadosBolsa(r), agora));
      break;
    case "lotes": {
      const lotes = importarLotesJSON(conteudo);
      const porId = new Map<string, PerfilJSON>();
      for (const lote of lotes.lotes) for (const e of lote.perfis) porId.set(e.perfil.id, e.perfil);
      acrescentar(
        novoPedidoBolsa(
          {
            nomeProjeto: lotes.nomeProjeto,
            descricaoProjeto: lotes.descricaoProjeto,
            justificacao: lotes.justificacao,
            perfis: [...porId.values()],
            lotes,
          },
          agora,
        ),
      );
      break;
    }
    case "perfis":
    case "perfil": {
      const lidos = importarPerfisJSON(conteudo);
      acrescentar(
        novoPedidoBolsa(
          {
            ...dadosBolsaIniciais(),
            nomeProjeto: lidos.nomeProjeto,
            descricaoProjeto: lidos.descricaoProjeto,
            justificacao: lidos.justificacao,
            perfis: lidos.perfis,
          },
          agora,
        ),
      );
      break;
    }
    case "licenciamento":
      acrescentar(novoPedidoLicenciamento(importarPedidoLicenciamentoJSON(conteudo), agora));
      break;
    default:
      throw new ErroImportacao(
        `Este ficheiro é do tipo "${String(r.tipo)}". Carregue uma biblioteca, um pedido, um agrupamento de lotes, ` +
          "um ficheiro de perfis ou um pedido de licenciamento.",
      );
  }
  return { biblioteca: nova, acrescentados, atualizados, ids };
}
