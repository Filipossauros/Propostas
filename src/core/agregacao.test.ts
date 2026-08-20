import { describe, expect, it } from "vitest";
import { apurarEAgregar, requisitosFalhados } from "./agregacao";
import { proporAgrupamentos } from "./reconciliacao";
import { bloco, configAvaliacao, declaracao, linha } from "./fixtures";
import type { Declaracao } from "./types";

function elemento(nome: string, entidade: string, cumpre = true): Declaracao {
  return declaracao({
    id: `decl-${nome}`,
    ficheiro: `${nome}.xlsx`,
    identificacao: { nome, entidadeConcorrente: entidade } as never,
    blocos: [cumpre ? bloco() : bloco({ linhas: [linha({ declara: "NÃO" })] })],
  });
}

describe("apurarEAgregar", () => {
  it("agrega elementos da mesma entidade e verifica o n.º mínimo", () => {
    const resultado = apurarEAgregar(
      [elemento("Ana", "ABC"), elemento("Bruno", "ABC")],
      configAvaliacao({ nMinimoElementos: 2 }),
      [],
    );

    expect(resultado).toHaveLength(1);
    expect(resultado[0].nElementos).toBe(2);
    expect(resultado[0].nElementosSuficiente).toBe(true);
    expect(resultado[0].cumpre).toBe(true);
  });

  it("sinaliza insuficiência de elementos separadamente do mérito de cada CV", () => {
    const resultado = apurarEAgregar([elemento("Ana", "ABC")], configAvaliacao({ nMinimoElementos: 2 }), []);

    expect(resultado[0].todosElementosCumprem).toBe(true);
    expect(resultado[0].nElementosSuficiente).toBe(false);
    expect(resultado[0].cumpre).toBe(false);
  });

  it("concorrente não cumpre se um elemento falhar, mesmo com n.º suficiente", () => {
    const resultado = apurarEAgregar(
      [elemento("Ana", "ABC"), elemento("Bruno", "ABC", false)],
      configAvaliacao({ nMinimoElementos: 2 }),
      [],
    );

    expect(resultado[0].nElementosSuficiente).toBe(true);
    expect(resultado[0].todosElementosCumprem).toBe(false);
    expect(resultado[0].cumpre).toBe(false);
  });

  it("aplica a reconciliação de nomes antes de agregar", () => {
    const declaracoes = [elemento("Ana", "ABC"), elemento("Bruno", "ABC, S.A.")];
    const grupos = proporAgrupamentos(["ABC", "ABC, S.A."]);

    expect(apurarEAgregar(declaracoes, configAvaliacao({ nMinimoElementos: 2 }), grupos)).toHaveLength(1);
    expect(apurarEAgregar(declaracoes, configAvaliacao({ nMinimoElementos: 2 }), [])).toHaveLength(2);
  });

  it("distingue declarações com o mesmo nome de ficheiro", () => {
    const a = declaracao({ id: "a", ficheiro: "cv.xlsx", identificacao: { nome: "Ana" } as never });
    const b = declaracao({ id: "b", ficheiro: "cv.xlsx", identificacao: { nome: "Bruno" } as never });

    const resultado = apurarEAgregar([a, b], configAvaliacao(), []);
    expect(resultado[0].elementos).toHaveLength(2);
  });

  it("associa os alertas do PDF pelo id da declaração, não pelo nome do ficheiro", () => {
    const a = declaracao({ id: "a", ficheiro: "cv.xlsx", identificacao: { nome: "Ana" } as never });
    const b = declaracao({ id: "b", ficheiro: "cv.xlsx", identificacao: { nome: "Bruno" } as never });
    const alertasPdf = new Map([["a", [{ tipo: "divergenciaPdf" as const, mensagem: "divergência" }]]]);

    const elementos = apurarEAgregar([a, b], configAvaliacao(), [], alertasPdf)[0].elementos;
    expect(elementos.find((e) => e.declaracao.id === "a")!.alertas).toHaveLength(1);
    expect(elementos.find((e) => e.declaracao.id === "b")!.alertas).toHaveLength(0);
  });

});

describe("requisitosFalhados", () => {
  it("lista as designações dos requisitos não cumpridos", () => {
    const config = configAvaliacao();
    const resultado = apurarEAgregar([elemento("Ana", "ABC", false)], config, []);
    expect(requisitosFalhados(resultado[0].elementos[0].apuramento, config)).toEqual(["Requisito r1"]);
  });
});
