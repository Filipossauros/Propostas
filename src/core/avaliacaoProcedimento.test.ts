import { describe, expect, it } from "vitest";
import { avaliarProcedimento, ordenarLotes, type DeclaracaoAtribuida } from "./avaliacaoProcedimento";
import { LOTES_EXEMPLO, declaracoesExemplo } from "./exemplo";
import { proporAgrupamentos } from "./reconciliacao";
import type { LotesJSON } from "./types";

function avaliar(config: LotesJSON, declaracoes: DeclaracaoAtribuida[] = declaracoesExemplo(config)) {
  const grupos = proporAgrupamentos(declaracoes.map((d) => d.declaracao.identificacao.entidadeConcorrente));
  return avaliarProcedimento(config, declaracoes, grupos);
}

function noLote(resultado: ReturnType<typeof avaliar>, numero: string) {
  return resultado.lotes.find((l) => l.numero === numero)!;
}

function concorrente(resultado: ReturnType<typeof avaliar>, numero: string, nome: string) {
  return noLote(resultado, numero).concorrentes.find((c) => c.concorrente.startsWith(nome))!;
}

describe("ordenarLotes", () => {
  it("ordena os números como números, e não como texto", () => {
    const lotes = ["10", "2", "1"].map((numero) => ({ id: numero, numero, designacao: "", perfis: [] }));
    expect(ordenarLotes(lotes).map((l) => l.numero)).toEqual(["1", "2", "10"]);
  });
});

describe("avaliarProcedimento", () => {
  it("avalia todos os lotes de uma vez", () => {
    const resultado = avaliar(LOTES_EXEMPLO);
    expect(resultado.lotes.map((l) => l.numero)).toEqual(["1", "2"]);
  });

  it("apura cada perfil contra o seu n.º mínimo de elementos", () => {
    const alfa = concorrente(avaliar(LOTES_EXEMPLO), "1", "Alfa");
    const perfil = alfa.perfis[0];

    expect(perfil.nElementos).toBe(perfil.nMinimoElementos);
    expect(perfil.nElementosSuficiente).toBe(true);
  });

  it("assinala quem fica aquém dos requisitos, sem o excluir dos resultados", () => {
    const resultado = avaliar(LOTES_EXEMPLO);
    const beta = concorrente(resultado, "1", "Beta");

    expect(beta.cumpreRequisitos).toBe(false);
    expect(beta.perfis[0].todosElementosCumprem).toBe(false);
  });
});

describe("limitação de um lote por concorrente", () => {
  it("assinala como potencial o impedimento de quem cumpre mais do que um lote", () => {
    const resultado = avaliar(LOTES_EXEMPLO);

    // A Alfa cumpre os dois lotes. Qual deles fica por decidir: depende do
    // preço, que não consta do formulário de declaração.
    expect(concorrente(resultado, "1", "Alfa").potencialImpedimento).toEqual(["2"]);
    expect(concorrente(resultado, "2", "Alfa").potencialImpedimento).toEqual(["1"]);
  });

  it("não exclui ninguém: quem cumpre é admitido em todos os lotes em que cumpre", () => {
    const resultado = avaliar(LOTES_EXEMPLO);

    expect(concorrente(resultado, "1", "Alfa").admitido).toBe(true);
    expect(concorrente(resultado, "2", "Alfa").admitido).toBe(true);
    expect(concorrente(resultado, "2", "Beta").admitido).toBe(true);
  });

  it("quem só cumpre um lote não tem impedimento a assinalar", () => {
    const resultado = avaliar(LOTES_EXEMPLO);

    // A Beta fica aquém no lote 1, pelo que só cumpre o lote 2.
    expect(concorrente(resultado, "1", "Beta").cumpreRequisitos).toBe(false);
    expect(concorrente(resultado, "2", "Beta").potencialImpedimento).toEqual([]);
  });

  it("não assinala impedimento no lote onde o concorrente nem sequer é admitido", () => {
    const resultado = avaliar(LOTES_EXEMPLO);

    // A Beta não é admitida no lote 1: cumprir o lote 2 não lhe tira nada aqui.
    expect(concorrente(resultado, "1", "Beta").admitido).toBe(false);
    expect(concorrente(resultado, "1", "Beta").potencialImpedimento).toEqual([]);
  });

  it("sem a limitação, não há impedimento nenhum a assinalar", () => {
    const semLimite: LotesJSON = { ...LOTES_EXEMPLO, umLotePorConcorrente: false };
    const resultado = avaliar(semLimite, declaracoesExemplo(semLimite));

    expect(concorrente(resultado, "2", "Alfa").potencialImpedimento).toEqual([]);
  });
});
