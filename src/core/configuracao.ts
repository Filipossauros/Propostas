// Validação, (des)serialização JSON e texto para caderno de encargos — PLANO.md 4.2, 4.3.

import type { ConfiguracaoJSON, Requisito } from "./types";
import { SCHEMA_VERSION_ATUAL } from "./types";

export interface ErroValidacaoConfig {
  campo: string;
  mensagem: string;
}

/** Indica se a designação de um requisito sugere agrupamento de tecnologias (PLANO.md 4.1). */
export function sugereAgrupamento(designacao: string): boolean {
  return designacao.includes(",") || / ou /i.test(designacao);
}

export function validarRequisitos(requisitos: Requisito[]): ErroValidacaoConfig[] {
  const erros: ErroValidacaoConfig[] = [];
  const designacoesVistas = new Set<string>();

  requisitos.forEach((r, idx) => {
    const designacao = r.designacao.trim();
    if (designacao === "") {
      erros.push({ campo: `requisitos[${idx}].designacao`, mensagem: "A designação não pode ser vazia." });
    } else if (designacoesVistas.has(designacao)) {
      erros.push({ campo: `requisitos[${idx}].designacao`, mensagem: `Designação repetida: "${designacao}".` });
    } else {
      designacoesVistas.add(designacao);
    }

    if (!Number.isInteger(r.mesesMinimos) || r.mesesMinimos < 1) {
      erros.push({
        campo: `requisitos[${idx}].mesesMinimos`,
        mensagem: "Os meses mínimos devem ser um número inteiro maior ou igual a 1.",
      });
    }
  });

  return erros;
}

export function validarConfiguracao(config: ConfiguracaoJSON): ErroValidacaoConfig[] {
  const erros: ErroValidacaoConfig[] = [];

  if (config.procedimento.trim() === "") {
    erros.push({ campo: "procedimento", mensagem: "Indique o número do procedimento." });
  }
  if (config.lote.trim() === "") {
    erros.push({ campo: "lote", mensagem: "Indique o lote." });
  }
  if (config.perfil.trim() === "") {
    erros.push({ campo: "perfil", mensagem: "Indique o perfil." });
  }
  if (!Number.isInteger(config.nMinimoElementos) || config.nMinimoElementos < 1) {
    erros.push({ campo: "nMinimoElementos", mensagem: "O n.º mínimo de elementos deve ser um inteiro ≥ 1." });
  }
  if (!Number.isInteger(config.nBlocos) || config.nBlocos < 1) {
    erros.push({ campo: "nBlocos", mensagem: "O n.º de blocos deve ser um inteiro ≥ 1." });
  }
  if (Number.isNaN(Date.parse(config.dataLimitePropostas))) {
    erros.push({ campo: "dataLimitePropostas", mensagem: "Data limite inválida." });
  }
  if (config.requisitos.length === 0) {
    erros.push({ campo: "requisitos", mensagem: "Defina pelo menos um requisito." });
  }

  return [...erros, ...validarRequisitos(config.requisitos)];
}

export function configuracaoParaJSON(config: ConfiguracaoJSON): string {
  return JSON.stringify(config, null, 2);
}

export class ErroImportacaoConfig extends Error {}

/** Reconstrói o estado a partir de um JSON exportado (4.3). Rejeita schemaVersion desconhecida. */
export function importarConfiguracaoJSON(texto: string): ConfiguracaoJSON {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new ErroImportacaoConfig("O ficheiro não contém JSON válido.");
  }

  if (typeof bruto !== "object" || bruto === null) {
    throw new ErroImportacaoConfig("O ficheiro não corresponde a uma configuração válida.");
  }

  const config = bruto as Partial<ConfiguracaoJSON>;
  if (config.schemaVersion !== SCHEMA_VERSION_ATUAL) {
    throw new ErroImportacaoConfig(
      `Versão de esquema desconhecida ("${String(config.schemaVersion)}"). Esta aplicação suporta a versão "${SCHEMA_VERSION_ATUAL}".`,
    );
  }

  return bruto as ConfiguracaoJSON;
}

/**
 * Texto para o caderno de encargos, agrupado por n.º de meses mínimos (4.2.c),
 * na ordem em que cada grupo de meses aparece pela primeira vez na lista de requisitos.
 */
export function gerarTextoCadernoEncargos(requisitos: Requisito[]): string {
  const grupos = new Map<number, string[]>();
  for (const r of requisitos) {
    const lista = grupos.get(r.mesesMinimos) ?? [];
    lista.push(r.designacao);
    grupos.set(r.mesesMinimos, lista);
  }

  const mesesOrdenados = [...grupos.keys()].sort((a, b) => b - a);

  return mesesOrdenados
    .map((meses) => {
      const designacoes = grupos.get(meses)!.map((d) => `  - ${d}`).join("\n");
      return `Experiência mínima de ${meses} meses em:\n${designacoes}`;
    })
    .join("\n\n");
}
