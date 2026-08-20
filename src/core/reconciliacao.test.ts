import { describe, expect, it } from "vitest";
import {
  construirMapaReconciliacao,
  escolherNomeCanonico,
  normalizarNomeEntidade,
  proporAgrupamentos,
} from "./reconciliacao";

describe("normalizarNomeEntidade", () => {
  it("remove acentos e uniformiza maiúsculas", () => {
    expect(normalizarNomeEntidade("São José, Lda.")).toBe(normalizarNomeEntidade("Sao Jose LDA"));
  });

  it("ignora formas societárias comuns", () => {
    expect(normalizarNomeEntidade("ABC")).toBe(normalizarNomeEntidade("ABC, S.A."));
    expect(normalizarNomeEntidade("ABC")).toBe(normalizarNomeEntidade("ABC Lda"));
  });
});

describe("proporAgrupamentos", () => {
  it("agrupa variações de escrita da mesma entidade", () => {
    const grupos = proporAgrupamentos(["ABC", "ABC, S.A.", "ABC Lda", "XYZ Unipessoal"]);
    expect(grupos).toHaveLength(2);
    const grupoAbc = grupos.find((g) => g.nomesOriginais.includes("ABC"))!;
    expect(grupoAbc.nomesOriginais).toEqual(expect.arrayContaining(["ABC", "ABC, S.A.", "ABC Lda"]));
  });

  it("não agrupa entidades genuinamente distintas", () => {
    const grupos = proporAgrupamentos(["Entidade Um", "Entidade Dois"]);
    expect(grupos).toHaveLength(2);
  });
});

describe("construirMapaReconciliacao", () => {
  it("mapeia cada nome original para o nome canónico do grupo", () => {
    const grupos = proporAgrupamentos(["ABC", "ABC, S.A."]);
    const mapa = construirMapaReconciliacao(grupos);
    expect(mapa.get("ABC")).toBe(mapa.get("ABC, S.A."));
  });
});

describe("escolherNomeCanonico", () => {
  it("prefere o nome mais completo", () => {
    expect(escolherNomeCanonico(["ABC", "ABC, S.A.", "ABC SA"])).toBe("ABC, S.A.");
  });

  it("desempata pela ordem alfabética", () => {
    expect(escolherNomeCanonico(["Beta", "Alfa"])).toBe("Alfa");
  });
});
