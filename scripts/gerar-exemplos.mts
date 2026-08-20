// Gera os ficheiros de exemplo em exemplos/, a partir da fonte única em
// src/core/exemplo.ts. Correr com `npm run exemplos`.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LOTES_EXEMPLO, NOME_PROJETO_EXEMPLO, PERFIS_EXEMPLO } from "../src/core/exemplo.ts";
import { SCHEMA_VERSION_ATUAL } from "../src/core/types.ts";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const destino = join(raiz, "exemplos");
mkdirSync(destino, { recursive: true });

const perfisExemplo = {
  schemaVersion: SCHEMA_VERSION_ATUAL,
  tipo: "perfis",
  nomeProjeto: NOME_PROJETO_EXEMPLO,
  perfis: PERFIS_EXEMPLO,
};

for (const [nome, dados] of [
  ["lotes-exemplo.json", LOTES_EXEMPLO],
  ["perfis-exemplo.json", perfisExemplo],
] as const) {
  writeFileSync(join(destino, nome), `${JSON.stringify(dados, null, 2)}\n`);
  console.log("gerado:", nome);
}
