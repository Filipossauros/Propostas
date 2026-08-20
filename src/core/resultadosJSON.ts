// Serialização dos resultados do Módulo 3, para alimentar o Módulo 4.
//
// O ficheiro leva o apuramento inteiro, e não um resumo: o Módulo 4 tem de
// poder gerar o mesmo relatório Excel do Módulo 3, acrescido da ordenação, e
// para isso precisa de tudo o que o Módulo 3 tinha. É por isso, também, que
// este ficheiro contém dados pessoais dos elementos propostos — como o Excel
// dos resultados — e nunca é guardado no navegador.

import type { LotesJSON } from "./types";
import { SCHEMA_VERSION_ATUAL } from "./types";
import type { ResultadoProcedimento } from "./avaliacaoProcedimento";
import { ErroImportacao } from "./perfil";

export interface ResultadosJSON {
  schemaVersion: string;
  tipo: "resultados";
  config: LotesJSON;
  resultado: ResultadoProcedimento;
}

export function resultadosParaJSON(resultado: ResultadoProcedimento, config: LotesJSON): string {
  const ficheiro: ResultadosJSON = {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    tipo: "resultados",
    config,
    resultado,
  };
  return JSON.stringify(ficheiro, null, 2);
}

export function importarResultadosJSON(texto: string): ResultadosJSON {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new ErroImportacao("O ficheiro não contém JSON válido.");
  }
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) {
    throw new ErroImportacao("O ficheiro não corresponde a resultados de avaliação.");
  }

  const ficheiro = bruto as Partial<ResultadosJSON>;
  if (ficheiro.schemaVersion !== SCHEMA_VERSION_ATUAL) {
    throw new ErroImportacao(
      `Versão de esquema desconhecida ("${String(ficheiro.schemaVersion)}"). ` +
        `Esta aplicação suporta a versão "${SCHEMA_VERSION_ATUAL}".`,
    );
  }
  if (ficheiro.tipo !== "resultados") {
    throw new ErroImportacao(
      `Este ficheiro é do tipo "${String(ficheiro.tipo)}", não resultados de avaliação. ` +
        "Carregue o JSON de resultados descarregado do Módulo 3.",
    );
  }
  if (ficheiro.config === undefined || !Array.isArray(ficheiro.resultado?.lotes)) {
    throw new ErroImportacao("O ficheiro de resultados está incompleto.");
  }

  return ficheiro as ResultadosJSON;
}
