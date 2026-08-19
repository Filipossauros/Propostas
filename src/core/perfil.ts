// Validação, (des)serialização e texto de caderno de encargos de um PERFIL — Módulo 1.

import type { PerfilJSON, Requisito } from "./types";
import { SCHEMA_VERSION_ATUAL } from "./types";

export interface ErroValidacao {
  campo: string;
  mensagem: string;
}

/** Indica se a designação de um requisito sugere agrupamento de tecnologias. */
export function sugereAgrupamento(designacao: string): boolean {
  return designacao.includes(",") || / ou /i.test(designacao);
}

export function validarRequisitos(requisitos: Requisito[]): ErroValidacao[] {
  const erros: ErroValidacao[] = [];
  const designacoesVistas = new Set<string>();

  requisitos.forEach((r, idx) => {
    const designacao = r.designacao.trim();
    if (designacao === "") {
      erros.push({ campo: `requisitos[${idx}].designacao`, mensagem: "A designação do requisito não pode ser vazia." });
    } else if (designacoesVistas.has(designacao)) {
      erros.push({ campo: `requisitos[${idx}].designacao`, mensagem: `Designação repetida: "${designacao}".` });
    } else {
      designacoesVistas.add(designacao);
    }

    if (!Number.isInteger(r.mesesMinimos) || r.mesesMinimos < 1) {
      erros.push({
        campo: `requisitos[${idx}].mesesMinimos`,
        mensagem: `"${designacao || `Requisito ${idx + 1}`}": os meses mínimos devem ser um inteiro ≥ 1.`,
      });
    }
  });

  return erros;
}

/**
 * Valida um perfil. Nota: `procedimento` é deliberadamente opcional — nesta fase
 * pré-contratual o número do procedimento pode ainda não existir.
 */
export function validarPerfil(perfil: PerfilJSON): ErroValidacao[] {
  const erros: ErroValidacao[] = [];

  if (perfil.perfil.trim() === "") {
    erros.push({ campo: "perfil", mensagem: "Indique a designação do perfil." });
  }
  if (!Number.isInteger(perfil.nBlocos) || perfil.nBlocos < 1) {
    erros.push({ campo: "nBlocos", mensagem: "O n.º de blocos deve ser um inteiro ≥ 1." });
  }
  if (perfil.requisitos.length === 0) {
    erros.push({ campo: "requisitos", mensagem: "Defina pelo menos um requisito." });
  }

  return [...erros, ...validarRequisitos(perfil.requisitos)];
}

export function perfilParaJSON(perfil: PerfilJSON): string {
  return JSON.stringify(perfil, null, 2);
}

export class ErroImportacao extends Error {}

function analisarJSON(texto: string): Record<string, unknown> {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new ErroImportacao("O ficheiro não contém JSON válido.");
  }
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) {
    throw new ErroImportacao("O ficheiro não corresponde a uma configuração válida.");
  }
  return bruto as Record<string, unknown>;
}

function verificarSchemaVersion(bruto: Record<string, unknown>): void {
  if (bruto.schemaVersion !== SCHEMA_VERSION_ATUAL) {
    throw new ErroImportacao(
      `Versão de esquema desconhecida ("${String(bruto.schemaVersion)}"). ` +
        `Esta aplicação suporta a versão "${SCHEMA_VERSION_ATUAL}".`,
    );
  }
}

/** Reconstrói um perfil a partir de um JSON exportado. */
export function importarPerfilJSON(texto: string): PerfilJSON {
  const bruto = analisarJSON(texto);
  verificarSchemaVersion(bruto);

  if (bruto.tipo !== "perfil") {
    throw new ErroImportacao(
      `Este ficheiro é do tipo "${String(bruto.tipo)}", não um perfil. Carregue um ficheiro de perfil (Módulo 1).`,
    );
  }
  if (!Array.isArray(bruto.requisitos)) {
    throw new ErroImportacao("O ficheiro de perfil não contém uma lista de requisitos.");
  }

  return bruto as unknown as PerfilJSON;
}

/** Lê o `tipo` de um ficheiro de configuração, validando primeiro a versão de esquema. */
export function lerTipoConfiguracao(texto: string): string {
  const bruto = analisarJSON(texto);
  verificarSchemaVersion(bruto);
  return String(bruto.tipo ?? "");
}

/**
 * Texto para o caderno de encargos, agrupado por n.º de meses mínimos,
 * do requisito mais exigente para o menos exigente.
 */
export function gerarTextoCadernoEncargos(requisitos: Requisito[]): string {
  const grupos = new Map<number, string[]>();
  for (const r of requisitos) {
    const lista = grupos.get(r.mesesMinimos) ?? [];
    lista.push(r.designacao);
    grupos.set(r.mesesMinimos, lista);
  }

  return [...grupos.keys()]
    .sort((a, b) => b - a)
    .map((meses) => {
      const designacoes = grupos.get(meses)!.map((d) => `  - ${d}`).join("\n");
      return `Experiência mínima de ${meses} meses em:\n${designacoes}`;
    })
    .join("\n\n");
}
