// O ficheiro do projeto: só a caracterização (Módulo 1), sem perfis nem lotes.
//
// Serve para guardar ou partilhar o projeto antes de haver perfis — e é o
// ponto de partida comum ao pedido de serviços de bolsa de horas e ao pedido de
// licenciamento. Ao importar aceitam-se também os ficheiros de perfis e de
// lotes, que trazem o mesmo projeto: quem só tem um desses não fica sem forma
// de recuperar a caracterização.

import type { JustificacaoProjeto } from "./types";
import { SCHEMA_VERSION_ATUAL } from "./types";
import { justificacaoInicial, normalizarJustificacao } from "./justificacao";
import { ErroImportacao, importarPerfisJSON } from "./perfil";
import { importarLotesJSON } from "./lotes";

export interface ProjetoJSON {
  schemaVersion: string;
  tipo: "projeto";
  nomeProjeto: string;
  descricaoProjeto: string;
  justificacao: JustificacaoProjeto;
}

/** O que se recupera de um ficheiro: os campos do Módulo 1 e de que tipo de ficheiro vieram. */
export interface ProjetoImportado {
  nomeProjeto: string;
  descricaoProjeto: string;
  justificacao: JustificacaoProjeto;
  origem: "projeto" | "perfis" | "lotes";
}

export function projetoParaJSON(
  nomeProjeto: string,
  descricaoProjeto: string,
  justificacao: JustificacaoProjeto,
): string {
  const ficheiro: ProjetoJSON = {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    tipo: "projeto",
    nomeProjeto,
    descricaoProjeto,
    justificacao,
  };
  return JSON.stringify(ficheiro, null, 2);
}

export function importarProjetoJSON(texto: string): ProjetoImportado {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new ErroImportacao("O ficheiro não contém JSON válido.");
  }
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) {
    throw new ErroImportacao("O ficheiro não corresponde a um projeto.");
  }
  const registo = bruto as Record<string, unknown>;

  if (registo.tipo === "perfis" || registo.tipo === "perfil") {
    const p = importarPerfisJSON(texto);
    return { ...camposDe(p), origem: "perfis" };
  }
  if (registo.tipo === "lotes") {
    return { ...camposDe(importarLotesJSON(texto)), origem: "lotes" };
  }
  if (registo.tipo !== "projeto") {
    throw new ErroImportacao(
      `Este ficheiro é do tipo "${String(registo.tipo)}". Carregue o JSON do projeto, dos perfis ou dos lotes.`,
    );
  }
  if (registo.schemaVersion !== SCHEMA_VERSION_ATUAL) {
    throw new ErroImportacao(
      `Versão de esquema desconhecida ("${String(registo.schemaVersion)}"). ` +
        `Esta aplicação suporta a versão "${SCHEMA_VERSION_ATUAL}".`,
    );
  }
  return {
    nomeProjeto: typeof registo.nomeProjeto === "string" ? registo.nomeProjeto : "",
    descricaoProjeto: typeof registo.descricaoProjeto === "string" ? registo.descricaoProjeto : "",
    justificacao:
      registo.justificacao === undefined ? justificacaoInicial() : normalizarJustificacao(registo.justificacao),
    origem: "projeto",
  };
}

function camposDe(f: { nomeProjeto: string; descricaoProjeto: string; justificacao: JustificacaoProjeto }) {
  return { nomeProjeto: f.nomeProjeto, descricaoProjeto: f.descricaoProjeto, justificacao: f.justificacao };
}
