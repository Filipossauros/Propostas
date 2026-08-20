import { describe, expect, it } from "vitest";
import {
  agruparAtribuicoes,
  construirMapaReconciliacao,
  escolherNomeCanonico,
  normalizarNomeEntidade,
  proporAgrupamentos,
  proporAtribuicoes,
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

describe("atribuição nome a nome", () => {
  const NOMES = ["ABC, S.A.", "ABC SA", "Delta, Lda."];

  it("propõe uma linha por nome escrito, com o nome de relatório sugerido", () => {
    expect(proporAtribuicoes(NOMES)).toEqual([
      { nomeOriginal: "ABC SA", nomeCanonico: "ABC, S.A." },
      { nomeOriginal: "ABC, S.A.", nomeCanonico: "ABC, S.A." },
      { nomeOriginal: "Delta, Lda.", nomeCanonico: "Delta, Lda." },
    ]);
  });

  it("nomes de relatório iguais são o mesmo concorrente", () => {
    const grupos = agruparAtribuicoes(proporAtribuicoes(NOMES));

    expect(grupos).toHaveLength(2);
    expect(grupos.find((g) => g.nomeCanonico === "ABC, S.A.")!.nomesOriginais).toEqual(["ABC SA", "ABC, S.A."]);
  });

  it("separar é dar nomes diferentes", () => {
    const atribuicoes = proporAtribuicoes(NOMES).map((a) =>
      a.nomeOriginal === "ABC SA" ? { ...a, nomeCanonico: "ABC Segunda, S.A." } : a,
    );

    expect(agruparAtribuicoes(atribuicoes)).toHaveLength(3);
  });

  it("um nome de relatório em branco vale pelo original, sem fundir ninguém", () => {
    const atribuicoes = proporAtribuicoes(NOMES).map((a) => ({ ...a, nomeCanonico: "" }));
    const grupos = agruparAtribuicoes(atribuicoes);

    expect(grupos).toHaveLength(3);
    expect(grupos.map((g) => g.nomeCanonico).sort()).toEqual(["ABC SA", "ABC, S.A.", "Delta, Lda."]);
  });
});
