// Agrupamento de perfis em lotes e preço base — Módulo 2.
//
// Nota de método sobre o preço base: o valor de cada perfil dentro de um lote é
// `horas × valor/hora`. O n.º mínimo de elementos NÃO multiplica esse valor — é
// uma condição de admissibilidade da proposta (quantos currículos o concorrente
// tem de apresentar), não uma quantidade contratada.

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
  return { schemaVersion: SCHEMA_VERSION_ATUAL, tipo: "lotes", taxaIva: TAXA_IVA_PADRAO, lotes: [] };
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

  // A taxa de IVA foi acrescentada depois: ficheiros anteriores não a têm.
  const config = bruto as unknown as LotesJSON;
  return Number.isFinite(config.taxaIva) ? config : { ...config, taxaIva: TAXA_IVA_PADRAO };
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
      valores: aplicarIva(entrada.horas * entrada.valorHora, taxaIva(config)),
    })),
  );
}

/** Taxa de IVA da configuração, tolerando ficheiros anteriores que não a tinham. */
export function taxaIva(config: LotesJSON): number {
  return Number.isFinite(config.taxaIva) ? config.taxaIva : TAXA_IVA_PADRAO;
}

export function totalLote(lote: Lote, taxa: number): Valores {
  return aplicarIva(
    lote.perfis.reduce((soma, e) => soma + e.horas * e.valorHora, 0),
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
