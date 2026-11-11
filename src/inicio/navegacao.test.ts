import { describe, expect, it } from "vitest";
import { GRUPOS, enderecoDe, grupoDaPagina, localizacaoDoEndereco } from "./navegacao";

describe("organização da aplicação", () => {
  it("quatro grupos, pela ordem da página inicial", () => {
    expect(GRUPOS.map((g) => g.titulo)).toEqual([
      "Pedido de serviços de bolsa de horas",
      "Pedido de licenciamento",
      "Análise de propostas",
      "Orçamento",
    ]);
  });

  it("o Projeto está nos dois pedidos; vale o grupo de onde se veio", () => {
    expect(grupoDaPagina("projeto").chave).toBe("bolsa");
    expect(grupoDaPagina("projeto", "licenciamento").chave).toBe("licenciamento");
    // Um grupo que não tem a página não conta.
    expect(grupoDaPagina("perfis", "licenciamento").chave).toBe("bolsa");
  });

  it("o pedido de licenciamento: Projeto, L1, L2 e L3", () => {
    const grupo = GRUPOS.find((g) => g.chave === "licenciamento")!;
    expect(grupo.modulos.map((m) => m.marca)).toEqual(["1", "L1", "L2", "L3"]);
    expect(localizacaoDoEndereco("#licenciamento/condicoes")).toEqual({ pagina: "condicoes", grupo: "licenciamento" });
  });

  it("a localização vai e vem pelo endereço", () => {
    for (const local of [
      { pagina: "perfis", grupo: "bolsa" },
      { pagina: "projeto", grupo: "licenciamento" },
      { pagina: "vistaDirecao", grupo: "orcamento" },
    ] as const) {
      expect(localizacaoDoEndereco(enderecoDe(local))).toEqual(local);
    }
  });

  it("um endereço vazio ou que não existe abre a página inicial", () => {
    for (const hash of ["", "#", "#bolsa/licenciamento", "#xpto/perfis", "#bolsa"]) {
      expect(localizacaoDoEndereco(hash)).toEqual({ pagina: "inicio", grupo: null });
    }
    expect(enderecoDe({ pagina: "inicio", grupo: null })).toBe("#");
  });
});
