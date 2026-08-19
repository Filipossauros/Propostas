// Validação, (des)serialização e texto de caderno de encargos de um PERFIL — Módulo 1.

import type { PerfilJSON, Requisito } from "./types";
import { MESES_POR_ANO, SCHEMA_VERSION_ATUAL, anosDeMeses } from "./types";

export interface ErroValidacao {
  campo: string;
  mensagem: string;
}

export function perfilInicial(): PerfilJSON {
  return {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    tipo: "perfil",
    perfil: "",
    nBlocos: 15,
    requisitos: [],
  };
}

export function ehPerfilGuardado(valor: unknown): valor is PerfilJSON {
  if (typeof valor !== "object" || valor === null) return false;
  const p = valor as Partial<PerfilJSON>;
  return p.tipo === "perfil" && p.schemaVersion === SCHEMA_VERSION_ATUAL && Array.isArray(p.requisitos);
}

export function validarRequisitos(requisitos: Requisito[]): ErroValidacao[] {
  const erros: ErroValidacao[] = [];
  const designacoesVistas = new Set<string>();

  requisitos.forEach((r, idx) => {
    const designacao = r.designacao.trim();
    const nome = designacao || `Requisito ${idx + 1}`;

    if (designacao === "") {
      erros.push({ campo: `requisitos[${idx}].designacao`, mensagem: "A designação do requisito não pode ser vazia." });
    } else if (designacoesVistas.has(designacao)) {
      erros.push({ campo: `requisitos[${idx}].designacao`, mensagem: `Designação repetida: "${designacao}".` });
    } else {
      designacoesVistas.add(designacao);
    }

    // A exigência é declarada em anos completos; guardamos o equivalente em
    // meses, porque é em meses de calendário que a Regra A apura.
    if (
      !Number.isInteger(r.mesesMinimos) ||
      r.mesesMinimos < MESES_POR_ANO ||
      r.mesesMinimos % MESES_POR_ANO !== 0
    ) {
      erros.push({
        campo: `requisitos[${idx}].mesesMinimos`,
        mensagem: `"${nome}": a experiência mínima deve ser um número inteiro de anos, igual ou superior a 1.`,
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

export interface GrupoDeExigencia {
  mesesMinimos: number;
  anosMinimos: number;
  designacoes: string[];
}

/** Agrupa os requisitos por exigência, do mais exigente para o menos exigente. */
export function agruparPorExigencia(requisitos: Requisito[]): GrupoDeExigencia[] {
  const grupos = new Map<number, string[]>();
  for (const r of requisitos) {
    const lista = grupos.get(r.mesesMinimos) ?? [];
    lista.push(r.designacao);
    grupos.set(r.mesesMinimos, lista);
  }

  return [...grupos.keys()]
    .sort((a, b) => b - a)
    .map((mesesMinimos) => ({
      mesesMinimos,
      anosMinimos: anosDeMeses(mesesMinimos),
      designacoes: grupos.get(mesesMinimos)!,
    }));
}

export function exigenciaPorExtenso(anos: number, meses: number): string {
  return `${anos} ${anos === 1 ? "ano" : "anos"} (${meses} meses)`;
}

/** Texto simples para o caderno de encargos, agrupado por exigência. */
export function gerarTextoCadernoEncargos(requisitos: Requisito[]): string {
  return agruparPorExigencia(requisitos)
    .map((g) => {
      const designacoes = g.designacoes.map((d) => `  - ${d}`).join("\n");
      return `Experiência mínima de ${exigenciaPorExtenso(g.anosMinimos, g.mesesMinimos)} em:\n${designacoes}`;
    })
    .join("\n\n");
}
