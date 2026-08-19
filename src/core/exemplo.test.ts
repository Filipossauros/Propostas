import { describe, expect, it } from "vitest";
import { LOTES_EXEMPLO, PERFIL_EXEMPLO, PERFIS_EXEMPLO } from "./exemplo";
import { importarPerfilJSON, perfilParaJSON, validarPerfil } from "./perfil";
import { importarLotesJSON, lotesParaJSON, totalProcedimento, validarLotes } from "./lotes";

// O exemplo é aquilo que uma pessoa carrega para experimentar a aplicação pela
// primeira vez: se estiver inválido, a primeira impressão é um painel de erros.

describe("dados de exemplo", () => {
  it("o perfil de exemplo é válido", () => {
    expect(validarPerfil(PERFIL_EXEMPLO)).toHaveLength(0);
  });

  it("todos os perfis do exemplo são válidos", () => {
    for (const p of PERFIS_EXEMPLO) {
      expect(validarPerfil(p), p.perfil).toHaveLength(0);
    }
  });

  it("o agrupamento de exemplo é válido e exportável", () => {
    expect(validarLotes(LOTES_EXEMPLO)).toHaveLength(0);
    expect(totalProcedimento(LOTES_EXEMPLO)).toBeGreaterThan(0);
  });

  it("os ficheiros de exemplo são reimportáveis pela própria aplicação", () => {
    expect(importarPerfilJSON(perfilParaJSON(PERFIL_EXEMPLO))).toEqual(PERFIL_EXEMPLO);
    expect(importarLotesJSON(lotesParaJSON(LOTES_EXEMPLO))).toEqual(LOTES_EXEMPLO);
  });

  it("os identificadores de requisito são únicos em todo o agrupamento", () => {
    const ids = LOTES_EXEMPLO.lotes.flatMap((l) =>
      l.perfis.flatMap((e) => e.perfil.requisitos.map((r) => r.id)),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});
