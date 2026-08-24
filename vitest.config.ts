import { defineConfig } from "vitest/config";
import { xlsxEmBase64 } from "./vite-plugin-xlsx.ts";

export default defineConfig({
  // O mesmo carregador do build: os testes leem o modelo eAvalia pela via por
  // que a aplicação o lê, e não por uma alternativa que pudesse divergir.
  plugins: [xlsxEmBase64()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
