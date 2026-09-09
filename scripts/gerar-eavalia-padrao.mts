// Gera o eAvalia-padrão para distribuir às equipas que não usam a aplicação:
// as medidas de resposta fixa já respondidas e trancadas, e a folha do
// alinhamento tecnológico aberta só nas células que admitem escolha.
// Correr com `npm run eavalia-padrao`.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { construirEavaliaPadrao } from "../src/excel/eavaliaPadrao.ts";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const modelo = readFileSync(join(raiz, "src/excel/modelos/Pedido_PPP_eavalia.xlsx"));
const destino = join(raiz, "exemplos", "Pedido_PPP_eavalia_padrao.xlsx");

writeFileSync(destino, await construirEavaliaPadrao(modelo));
console.log("gerado:", destino);
