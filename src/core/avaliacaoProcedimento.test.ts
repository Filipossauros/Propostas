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
  it("impede quem já ficou com um lote de ficar com o seguinte", () => {
    const resultado = avaliar(LOTES_EXEMPLO);

    // A Alfa cumpre os dois lotes, mas só fica com o primeiro.
    expect(concorrente(resultado, "1", "Alfa").admitido).toBe(true);
    const alfaNoDois = concorrente(resultado, "2", "Alfa");
    expect(alfaNoDois.cumpreRequisitos).toBe(true);
    expect(alfaNoDois.impedidoPeloLote).toBe("1");
    expect(alfaNoDois.admitido).toBe(false);
  });

  it("deixa o lote seguinte para quem não ficou com nenhum", () => {
    const resultado = avaliar(LOTES_EXEMPLO);
    expect(concorrente(resultado, "2", "Beta").admitido).toBe(true);
  });

  it("sem a limitação, o mesmo concorrente fica com os dois lotes", () => {
    const semLimite: LotesJSON = { ...LOTES_EXEMPLO, umLotePorConcorrente: false };
    const resultado = avaliar(semLimite, declaracoesExemplo(semLimite));

    expect(concorrente(resultado, "1", "Alfa").admitido).toBe(true);
    expect(concorrente(resultado, "2", "Alfa").admitido).toBe(true);
    expect(concorrente(resultado, "2", "Alfa").impedidoPeloLote).toBeNull();
  });

  it("dentro do mesmo lote nenhum concorrente impede outro", () => {
    const resultado = avaliar(LOTES_EXEMPLO);
    const noPrimeiro = noLote(resultado, "1").concorrentes;
    expect(noPrimeiro.every((c) => c.impedidoPeloLote === null)).toBe(true);
  });
});
