// Agrupamento de perfis em lotes e preço base — Módulo 2.
//
// Nota de método sobre o preço base: o valor de cada perfil dentro de um lote é
// `n.º mínimo de elementos × horas × preço/hora`, sem IVA.

import type {
  InformacaoEavalia,
  Lote,
  LotesJSON,
  PerfilEmLote,
  PerfilJSON,
  PostoTrabalho,
  RespostaEavalia,
} from "./types";
import {
  EQUIPAMENTOS_POSTO,
  LOCAIS_POSTO,
  REGIMES_POSTO,
  REQUISITOS_EQUIPAMENTO_PADRAO,
  SCHEMA_VERSION_ATUAL,
  TAXA_IVA_PADRAO,
  informacaoEavaliaInicial,
  postoTrabalhoInicial,
} from "./types";
import { ErroImportacao, certificacoesDoPerfil, type ErroValidacao } from "./perfil";
import { gerarId } from "./id";

export function criarLote(numero: string): Lote {
  return { id: gerarId(), numero, designacao: "", perfis: [] };
}

export function criarPerfilEmLote(perfil: PerfilJSON): PerfilEmLote {
  return { id: gerarId(), perfil, horas: 0, valorHora: 0, nMinimoElementos: 1 };
}

export function lotesIniciais(): LotesJSON {
  return {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    tipo: "lotes",
    nomeProjeto: "",
    nomeProcedimento: "",
    taxaIva: TAXA_IVA_PADRAO,
    umLotePorConcorrente: false,
    postoTrabalho: postoTrabalhoInicial(),
    eavalia: informacaoEavaliaInicial(),
    lotes: [],
  };
}

// --------------------------------------------------------------------------
// Validação
// --------------------------------------------------------------------------

export function validarLotes(config: LotesJSON): ErroValidacao[] {
  const erros: ErroValidacao[] = [];

  if (config.lotes.length === 0) {
    erros.push({ campo: "lotes", mensagem: "Crie pelo menos um lote." });
  }

  const numerosVistos = new Set<string>();
  config.lotes.forEach((lote, idxLote) => {
    const numero = lote.numero.trim();
    if (numero === "") {
      erros.push({ campo: `lotes[${idxLote}].numero`, mensagem: `Lote ${idxLote + 1}: indique o número do lote.` });
    } else if (numerosVistos.has(numero)) {
      erros.push({ campo: `lotes[${idxLote}].numero`, mensagem: `Número de lote repetido: "${numero}".` });
    } else {
      numerosVistos.add(numero);
    }

    // A designação é obrigatória: dá nome ao ficheiro de formulários do lote e
    // aparece pré-preenchida na declaração entregue ao candidato.
    if (lote.designacao.trim() === "") {
      erros.push({
        campo: `lotes[${idxLote}].designacao`,
        mensagem: `Lote ${numero || idxLote + 1}: indique a designação do lote.`,
      });
    }

    if (lote.perfis.length === 0) {
      erros.push({
        campo: `lotes[${idxLote}].perfis`,
        mensagem: `Lote ${numero || idxLote + 1}: atribua pelo menos um perfil.`,
      });
    }

    lote.perfis.forEach((entrada, idxPerfil) => {
      const nome = entrada.perfil.perfil || `perfil ${idxPerfil + 1}`;
      const prefixo = `Lote ${numero || idxLote + 1}, ${nome}`;

      if (!Number.isFinite(entrada.horas) || entrada.horas <= 0) {
        erros.push({
          campo: `lotes[${idxLote}].perfis[${idxPerfil}].horas`,
          mensagem: `${prefixo}: indique um n.º de horas maior que zero.`,
        });
      }
      if (!Number.isFinite(entrada.valorHora) || entrada.valorHora <= 0) {
        erros.push({
          campo: `lotes[${idxLote}].perfis[${idxPerfil}].valorHora`,
          mensagem: `${prefixo}: indique um valor/hora maior que zero.`,
        });
      }
      if (!Number.isInteger(entrada.nMinimoElementos) || entrada.nMinimoElementos < 1) {
        erros.push({
          campo: `lotes[${idxLote}].perfis[${idxPerfil}].nMinimoElementos`,
          mensagem: `${prefixo}: o n.º mínimo de elementos deve ser um inteiro ≥ 1.`,
        });
      }
    });
  });

  return erros;
}

// --------------------------------------------------------------------------
// (Des)serialização
// --------------------------------------------------------------------------

export function lotesParaJSON(config: LotesJSON): string {
  return JSON.stringify(config, null, 2);
}

export function importarLotesJSON(texto: string): LotesJSON {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new ErroImportacao("O ficheiro não contém JSON válido.");
  }
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) {
    throw new ErroImportacao("O ficheiro não corresponde a uma configuração válida.");
  }

  const registo = bruto as Record<string, unknown>;
  if (registo.schemaVersion !== SCHEMA_VERSION_ATUAL) {
    throw new ErroImportacao(
      `Versão de esquema desconhecida ("${String(registo.schemaVersion)}"). ` +
        `Esta aplicação suporta a versão "${SCHEMA_VERSION_ATUAL}".`,
    );
  }
  if (registo.tipo !== "lotes") {
    throw new ErroImportacao(
      `Este ficheiro é do tipo "${String(registo.tipo)}", não um agrupamento de lotes.`,
    );
  }
  if (!Array.isArray(registo.lotes)) {
    throw new ErroImportacao("O ficheiro não contém uma lista de lotes.");
  }

  // A taxa de IVA, o nome do procedimento e a identidade do perfil foram
  // acrescentados depois: ficheiros anteriores não os têm.
  const config = bruto as unknown as LotesJSON;
  return {
    ...config,
    taxaIva: Number.isFinite(config.taxaIva) ? config.taxaIva : TAXA_IVA_PADRAO,
    nomeProjeto: config.nomeProjeto ?? "",
    nomeProcedimento: config.nomeProcedimento ?? "",
    umLotePorConcorrente: config.umLotePorConcorrente === true,
    postoTrabalho: normalizarPostoTrabalho((registo as { postoTrabalho?: unknown }).postoTrabalho),
    eavalia: normalizarEavalia((registo as { eavalia?: unknown }).eavalia),
    lotes: config.lotes.map((lote) => ({
      ...lote,
      perfis: lote.perfis.map((entrada) => ({
        ...entrada,
        perfil: {
          ...entrada.perfil,
          id: typeof entrada.perfil.id === "string" && entrada.perfil.id !== "" ? entrada.perfil.id : gerarId(),
        },
      })),
    })),
  };
}

/** As respostas admitidas pela lista de validação do formulário eAvalia. */
const RESPOSTAS_EAVALIA: RespostaEavalia[] = [
  "",
  "Cumpre Totalmente",
  "Cumpre Parcialmente",
  "Já cumpre",
  "Não cumpre",
  "Não aplicável",
];

function lerResposta(valor: unknown): RespostaEavalia {
  return RESPOSTAS_EAVALIA.includes(valor as RespostaEavalia) ? (valor as RespostaEavalia) : "";
}

/**
 * Respostas eAvalia vindas de ficheiro. Ficheiros anteriores a este campo não
 * o trazem, e um valor que não conste da lista de validação é descartado: o
 * formulário recusá-lo-ia, e é preferível ficar por responder do que levar lá
 * um valor que não abre.
 */
function normalizarEavalia(bruto: unknown): InformacaoEavalia {
  if (typeof bruto !== "object" || bruto === null) return informacaoEavaliaInicial();
  const e = bruto as Record<string, unknown>;
  return {
    iap: lerResposta(e.iap),
    chaveMovelDigital: lerResposta(e.chaveMovelDigital),
    idiomas: lerResposta(e.idiomas),
  };
}

/** Só as opções que constam da lista, e sem repetições, pela ordem da lista. */
function lerOpcoes<T extends string>(bruto: unknown, admitidas: readonly T[]): T[] {
  if (!Array.isArray(bruto)) return [];
  return admitidas.filter((opcao) => bruto.includes(opcao));
}

/**
 * Uma escolha única, aceitando também a lista com que estes campos já foram
 * guardados: fica a primeira que ainda conste da lista de opções. Um valor que
 * tenha entretanto deixado de existir — o antigo regime de teletrabalho — cai
 * no valor de partida, que é o que o utilizador veria se começasse agora.
 */
function lerEscolha<T extends string>(bruto: unknown, admitidas: readonly T[], omissao: T): T {
  const candidatos = Array.isArray(bruto) ? bruto : [bruto];
  return (candidatos.find((c) => admitidas.includes(c as T)) as T | undefined) ?? omissao;
}

/**
 * Posto de trabalho vindo de ficheiro. Ficheiros anteriores a este campo não o
 * trazem, e nesses assume-se o valor de partida.
 */
function normalizarPostoTrabalho(bruto: unknown): PostoTrabalho {
  if (typeof bruto !== "object" || bruto === null) return postoTrabalhoInicial();
  const p = bruto as Record<string, unknown>;
  const partida = postoTrabalhoInicial();
  return {
    regime: lerEscolha(p.regime ?? p.regimes, REGIMES_POSTO, partida.regime),
    locais: lerOpcoes(p.locais, LOCAIS_POSTO),
    outroLocal: typeof p.outroLocal === "string" ? p.outroLocal : "",
    equipamento: lerEscolha(p.equipamento ?? p.equipamentos, EQUIPAMENTOS_POSTO, partida.equipamento),
    requisitosEquipamento:
      typeof p.requisitosEquipamento === "string" ? p.requisitosEquipamento : REQUISITOS_EQUIPAMENTO_PADRAO,
  };
}

/** Todos os perfis atribuídos a lotes, na ordem em que aparecem. */
export function perfisEmLotes(config: LotesJSON): PerfilJSON[] {
  return config.lotes.flatMap((lote) => lote.perfis.map((entrada) => entrada.perfil));
}

/**
 * Ficheiro único com os formulários de declaração de todos os perfis atribuídos
 * a lotes, e a informação de lote que os acompanha. É o par em JSON do ficheiro
 * Excel dos formulários — mesma matéria, formato legível por outra aplicação.
 */
export function formulariosParaJSON(config: LotesJSON): string {
  const ficheiro = {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    tipo: "formularios" as const,
    nomeProjeto: config.nomeProjeto,
    nomeProcedimento: config.nomeProcedimento,
    formularios: config.lotes.flatMap((lote) =>
      lote.perfis.map((entrada) => ({
        lote: lote.numero,
        loteDesignacao: lote.designacao,
        perfil: entrada.perfil.perfil,
        nBlocos: entrada.perfil.nBlocos,
        nMinimoElementos: entrada.nMinimoElementos,
        horas: entrada.horas,
        valorHora: entrada.valorHora,
        precoBase: precoBaseEntrada(entrada),
        requisitos: entrada.perfil.requisitos,
      })),
    ),
  };
  return JSON.stringify(ficheiro, null, 2);
}

/** Um perfil do agrupamento que exige certificação, com o lote onde está. */
export interface PerfilComCertificacao {
  loteNumero: string;
  loteDesignacao: string;
  perfil: string;
  certificacoes: string[];
}

/**
 * Perfis do agrupamento que exigem certificação.
 *
 * O Módulo 3 usa isto para chamar a atenção do júri: a certificação não é
 * apurada por esta aplicação — verifica-se contra as peças da proposta — e o
 * risco é justamente passar despercebida por não aparecer em lado nenhum do
 * apuramento.
 */
export function perfisComCertificacao(config: LotesJSON): PerfilComCertificacao[] {
  return config.lotes.flatMap((lote) =>
    lote.perfis
      .map((entrada) => ({
        loteNumero: lote.numero,
        loteDesignacao: lote.designacao,
        perfil: entrada.perfil.perfil,
        certificacoes: certificacoesDoPerfil(entrada.perfil),
      }))
      .filter((p) => p.certificacoes.length > 0),
  );
}

/**
 * Chamada de atenção das certificações. Dita uma só vez, e não por perfil: é o
 * mesmo aviso para todos, e repeti-lo linha a linha ocupava a página sem
 * acrescentar nada. Os perfis a que respeita ficam listados por baixo.
 */
export const AVISO_CERTIFICACAO =
  "Além dos requisitos mínimos verificados, este(s) perfil(is) requer(em) ainda a apresentação de uma " +
  "certificação. Deve ser validada a apresentação da mesma nas peças da proposta.";

/** Número do lote a que cada perfil está atribuído, indexado pelo id do perfil. */
export function lotePorPerfilId(config: LotesJSON): Record<string, string> {
  const mapa: Record<string, string> = {};
  for (const lote of config.lotes) {
    for (const entrada of lote.perfis) mapa[entrada.perfil.id] = lote.numero;
  }
  return mapa;
}

/**
 * Repõe nos lotes a versão atual de cada perfil do catálogo do Módulo 1.
 *
 * É isto que torna a edição transversal: alterar um requisito no Módulo 1
 * altera-o também no lote onde o perfil já esteja atribuído. Um perfil que
 * tenha desaparecido do catálogo é retirado do lote — deixou de existir.
 */
export function sincronizarPerfisEmLotes(config: LotesJSON, perfis: PerfilJSON[]): LotesJSON {
  const porId = new Map(perfis.map((p) => [p.id, p]));
  return {
    ...config,
    lotes: config.lotes.map((lote) => ({
      ...lote,
      perfis: lote.perfis.flatMap((entrada) => {
        const atual = porId.get(entrada.perfil.id);
        return atual === undefined ? [] : [{ ...entrada, perfil: atual }];
      }),
    })),
  };
}


// --------------------------------------------------------------------------
// Preço base
// --------------------------------------------------------------------------

export interface Valores {
  /** Base tributável: horas × preço unitário/hora, sem IVA. */
  semIva: number;
  iva: number;
  comIva: number;
}

export function aplicarIva(semIva: number, taxaIva: number): Valores {
  const iva = semIva * (taxaIva / 100);
  return { semIva, iva, comIva: semIva + iva };
}

export interface LinhaTabelaValores {
  loteId: string;
  perfilEmLoteId: string;
  lote: string;
  loteDesignacao: string;
  perfil: string;
  nMinimoElementos: number;
  horas: number;
  /** Preço unitário por hora, sem IVA. */
  valorHora: number;
  valores: Valores;
}

/** Preço base de um perfil dentro de um lote, sem IVA: n.º mínimo de elementos × horas × preço/hora. */
export function precoBaseEntrada(entrada: PerfilEmLote): number {
  return entrada.nMinimoElementos * entrada.horas * entrada.valorHora;
}

export function linhasTabelaValores(config: LotesJSON): LinhaTabelaValores[] {
  return config.lotes.flatMap((lote) =>
    lote.perfis.map((entrada) => ({
      loteId: lote.id,
      perfilEmLoteId: entrada.id,
      lote: lote.numero,
      loteDesignacao: lote.designacao,
      perfil: entrada.perfil.perfil,
      nMinimoElementos: entrada.nMinimoElementos,
      horas: entrada.horas,
      valorHora: entrada.valorHora,
      valores: aplicarIva(precoBaseEntrada(entrada), taxaIva(config)),
    })),
  );
}

/** Taxa de IVA da configuração, tolerando ficheiros anteriores que não a tinham. */
export function taxaIva(config: LotesJSON): number {
  return Number.isFinite(config.taxaIva) ? config.taxaIva : TAXA_IVA_PADRAO;
}

export function totalLote(lote: Lote, taxa: number): Valores {
  return aplicarIva(
    lote.perfis.reduce((soma, e) => soma + precoBaseEntrada(e), 0),
    taxa,
  );
}

export function totalProcedimento(config: LotesJSON): Valores {
  return aplicarIva(
    config.lotes.reduce((soma, lote) => soma + totalLote(lote, 0).semIva, 0),
    taxaIva(config),
  );
}

const formatadorMoeda = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatarMoeda(valor: number): string {
  return Number.isFinite(valor) ? formatadorMoeda.format(valor) : "—";
}

const formatadorNumero = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 });

export function formatarNumero(valor: number): string {
  return Number.isFinite(valor) ? formatadorNumero.format(valor) : "—";
}
