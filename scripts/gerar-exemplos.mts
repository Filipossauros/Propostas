// Gera os ficheiros de exemplo em exemplos/, a partir da fonte única em
// src/core/exemplo.ts. Correr com `npm run exemplos`.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LOTES_EXEMPLO, PERFIL_EXEMPLO } from "../src/core/exemplo.ts";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const destino = join(raiz, "exemplos");
mkdirSync(destino, { recursive: true });

for (const [nome, dados] of [
  ["lotes-exemplo.json", LOTES_EXEMPLO],
  ["perfil-exemplo.json", PERFIL_EXEMPLO],
] as const) {
  writeFileSync(join(destino, nome), `${JSON.stringify(dados, null, 2)}\n`);
  console.log("gerado:", nome);
}
