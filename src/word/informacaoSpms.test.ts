import { describe, expect, it } from "vitest";
import { dataPorExtenso, rodapeComLinhaUnica } from "./informacaoSpms";
import { TABELA_RATES_SPMS } from "../core/referenciaValorHora";

describe("dataPorExtenso", () => {
  it("escreve a data em português", () => {
    expect(dataPorExtenso(new Date("2026-08-26T10:00:00"))).toBe("26 de agosto de 2026");
  });
});

describe("rodapeComLinhaUnica", () => {
  it("troca a fila de sublinhados por uma borda do parágrafo", () => {
    const rodape =
      '<w:ftr><w:p><w:pPr><w:pStyle w:val="Rodap"/></w:pPr><w:r><w:t>' + "_".repeat(40) + "</w:t></w:r></w:p></w:ftr>";
    const novo = rodapeComLinhaUnica(rodape);
    expect(novo).not.toMatch(/_{10,}/);
    expect(novo).toContain('<w:pBdr><w:bottom w:val="single"');
  });
});

describe("TABELA_RATES_SPMS", () => {
  it("leva os onze perfis, o Suporte IOP incluído", () => {
    expect(TABELA_RATES_SPMS).toHaveLength(11);
    expect(TABELA_RATES_SPMS.map((r) => r.perfil)).toContain("Suporte IOP");
  });
});
