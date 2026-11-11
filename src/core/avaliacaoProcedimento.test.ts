import { describe, expect, it } from "vitest";
import { avaliarProcedimento, chaveDeProjeto, ordenarLotes, type DeclaracaoAtribuida } from "./avaliacaoProcedimento";
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

describe("novas regras: data-limite e decisão do júri", () => {
  const declaracoes = () => declaracoesExemplo(LOTES_EXEMPLO);
  const grupos = (d: DeclaracaoAtribuida[]) =>
    proporAgrupamentos(d.map((x) => x.declaracao.identificacao.entidadeConcorrente));

  it("o resultado guarda a data-limite usada como teto", () => {
    const d = declaracoes();
    const resultado = avaliarProcedimento(LOTES_EXEMPLO, d, grupos(d), new Map(), { mes: 3, ano: 2026 });
    expect(resultado.dataLimite).toEqual({ mes: 3, ano: 2026 });
  });

  it("um projeto sem cliente conta, assinalado; o júri pode deixar de o considerar", () => {
    const d = declaracoes();
    const alvo = d.find((x) => concorrenteDe(x).startsWith("Alfa"))!;
    alvo.declaracao.blocos[0] = { ...alvo.declaracao.blocos[0], cliente: "" };
    const teto = { mes: 12, ano: 2030 };

    const elemento = (r: ReturnType<typeof avaliarProcedimento>) =>
      r.lotes
        .flatMap((l) => l.concorrentes)
        .flatMap((c) => c.perfis)
        .flatMap((p) => p.elementos)
        .find((e) => e.declaracao.id === alvo.declaracao.id)!;

    const antes = elemento(avaliarProcedimento(LOTES_EXEMPLO, d, grupos(d), new Map(), teto));
    expect(antes.alertas.some((a) => a.tipo === "blocoSemIdentificacao")).toBe(true);
    const mesesAntes = antes.apuramento.requisitos.reduce((s, r) => s + r.mesesApurados, 0);

    const excluidos = new Set([chaveDeProjeto(alvo.declaracao.id, alvo.declaracao.blocos[0].indice)]);
    const depois = elemento(avaliarProcedimento(LOTES_EXEMPLO, d, grupos(d), new Map(), teto, excluidos));
    const mesesDepois = depois.apuramento.requisitos.reduce((s, r) => s + r.mesesApurados, 0);

    expect(mesesDepois).toBeLessThan(mesesAntes);
    expect(depois.alertas.some((a) => a.tipo === "projetoExcluidoPeloJuri")).toBe(true);
    expect(depois.alertas.some((a) => a.tipo === "blocoSemIdentificacao")).toBe(false);
  });
});

function concorrenteDe(d: DeclaracaoAtribuida): string {
  return d.declaracao.identificacao.entidadeConcorrente;
}
