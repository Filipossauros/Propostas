import { defineConfig } from "vitest/config";
import { modeloEmBase64 } from "./vite-plugin-modelos.ts";

export default defineConfig({
  // O mesmo carregador do build: os testes leem o modelo pela via por
  // que a aplicação o lê, e não por uma alternativa que pudesse divergir.
  plugins: [modeloEmBase64()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
