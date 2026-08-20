// Agrupamento de perfis em lotes e preço base — Módulo 2.
//
// Nota de método sobre o preço base: o valor de cada perfil dentro de um lote é
// `n.º mínimo de elementos × horas × preço/hora`, sem IVA.

import type { Lote, LotesJSON, PerfilEmLote, PerfilJSON } from "./types";
import { SCHEMA_VERSION_ATUAL, TAXA_IVA_PADRAO } from "./types";
import { ErroImportacao, type ErroValidacao } from "./perfil";
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
    nomeProcedimento: "",
    taxaIva: TAXA_IVA_PADRAO,
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
    nomeProcedimento: config.nomeProcedimento ?? "",
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
