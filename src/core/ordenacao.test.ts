import { describe, expect, it } from "vitest";
import { avaliarProcedimento } from "./avaliacaoProcedimento";
import { LOTES_EXEMPLO, declaracoesExemplo } from "./exemplo";
import { proporAgrupamentos } from "./reconciliacao";
import { chavePreco, ordenarPropostas, propostasAdmitidas, type PrecosPropostos } from "./ordenacao";
import { resultadosParaJSON, importarResultadosJSON } from "./resultadosJSON";
import type { LotesJSON } from "./types";

function apurar(config: LotesJSON = LOTES_EXEMPLO) {
  const declaracoes = declaracoesExemplo(config);
  const grupos = proporAgrupamentos(declaracoes.map((d) => d.declaracao.identificacao.entidadeConcorrente));
  return avaliarProcedimento(config, declaracoes, grupos);
}

/** Preços indexados por número de lote e primeiro nome do concorrente, para os testes se lerem. */
function precos(resultado: ReturnType<typeof apurar>, tabela: Record<string, Record<string, number>>) {
  const mapa: PrecosPropostos = {};
  for (const lote of resultado.lotes) {
    for (const [nome, valor] of Object.entries(tabela[lote.numero] ?? {})) {
      const c = lote.concorrentes.find((x) => x.concorrente.startsWith(nome));
      if (c !== undefined) mapa[chavePreco(lote.loteId, c.concorrente)] = valor;
    }
  }
  return mapa;
}

function noLote(ordenacao: ReturnType<typeof ordenarPropostas>, numero: string) {
  return ordenacao.lotes.find((l) => l.numero === numero)!;
}

describe("propostasAdmitidas", () => {
  it("só traz quem cumpre os requisitos mínimos", () => {
    const resultado = apurar();
    const admitidas = propostasAdmitidas(resultado);

    // A Alfa cumpre os dois lotes; a Beta só o segundo.
    expect(admitidas).toHaveLength(3);
    expect(admitidas.filter((p) => p.numero === "1").map((p) => p.concorrente.split(" ")[0])).toEqual(["Alfa"]);
  });

  it("traz os lotes pela ordem do número", () => {
    expect(propostasAdmitidas(apurar()).map((p) => p.numero)).toEqual(["1", "2", "2"]);
  });
});

describe("ordenarPropostas", () => {
  it("ordena pelo preço mais baixo", () => {
    const resultado = apurar();
    const ordenacao = ordenarPropostas(resultado, precos(resultado, { "2": { Alfa: 200, Beta: 150 } }), false);
    const lote2 = noLote(ordenacao, "2");

    expect(lote2.propostas.map((p) => p.concorrente.split(" ")[0])).toEqual(["Beta", "Alfa"]);
    expect(lote2.propostas[0].posicao).toBe(1);
    expect(lote2.propostas[0].vencedora).toBe(true);
    expect(lote2.propostas[1].vencedora).toBe(false);
  });

  it("não ordena nem faz vencer uma proposta sem preço", () => {
    const resultado = apurar();
    const ordenacao = ordenarPropostas(resultado, precos(resultado, { "2": { Beta: 150 } }), false);
    const semPreco = noLote(ordenacao, "2").propostas.find((p) => p.preco === null)!;

    expect(semPreco.posicao).toBeNull();
    expect(semPreco.vencedora).toBe(false);
    expect(noLote(ordenacao, "2").precosEmFalta).toBe(1);
  });

  it("assinala preços empatados, sem os desempatar", () => {
    const resultado = apurar();
    const ordenacao = ordenarPropostas(resultado, precos(resultado, { "2": { Alfa: 150, Beta: 150 } }), false);

    expect(noLote(ordenacao, "2").propostas.every((p) => p.empatada)).toBe(true);
  });
});

describe("limitação de um lote por concorrente", () => {
  it("quem vence o lote 1 fica impedido no lote 2, mesmo com o preço mais baixo", () => {
    const resultado = apurar();
    const ordenacao = ordenarPropostas(
      resultado,
      precos(resultado, { "1": { Alfa: 100 }, "2": { Alfa: 10, Beta: 999 } }),
      true,
    );

    expect(noLote(ordenacao, "1").propostas[0].vencedora).toBe(true);

    const lote2 = noLote(ordenacao, "2");
    const alfa = lote2.propostas.find((p) => p.concorrente.startsWith("Alfa"))!;
    expect(alfa.impedidaPeloLote).toBe("1");
    expect(alfa.posicao).toBeNull();
    expect(alfa.vencedora).toBe(false);

    // O lote 2 fica para a Beta, apesar do preço muito mais alto.
    expect(lote2.propostas.find((p) => p.vencedora)!.concorrente).toContain("Beta");
  });

  it("sem a limitação, o mesmo concorrente vence os dois lotes", () => {
    const resultado = apurar();
    const ordenacao = ordenarPropostas(
      resultado,
      precos(resultado, { "1": { Alfa: 100 }, "2": { Alfa: 10, Beta: 999 } }),
      false,
    );

    expect(noLote(ordenacao, "1").propostas.find((p) => p.vencedora)!.concorrente).toContain("Alfa");
    expect(noLote(ordenacao, "2").propostas.find((p) => p.vencedora)!.concorrente).toContain("Alfa");
  });

  it("um concorrente sem preço no lote 1 não fica lá impedido para o lote 2", () => {
    const resultado = apurar();
    const ordenacao = ordenarPropostas(resultado, precos(resultado, { "2": { Alfa: 10, Beta: 999 } }), true);

    expect(noLote(ordenacao, "2").propostas.find((p) => p.vencedora)!.concorrente).toContain("Alfa");
  });
});

describe("ficheiro de resultados", () => {
  it("vai e volta sem perder o apuramento", () => {
    const resultado = apurar();
    const ficheiro = importarResultadosJSON(resultadosParaJSON(resultado, LOTES_EXEMPLO));

    expect(ficheiro.resultado.lotes.map((l) => l.numero)).toEqual(["1", "2"]);
    expect(propostasAdmitidas(ficheiro.resultado)).toHaveLength(3);
    expect(ficheiro.config.nomeProjeto).toBe(LOTES_EXEMPLO.nomeProjeto);
  });

  it("recusa um ficheiro de outro tipo, dizendo qual carregar", () => {
    expect(() => importarResultadosJSON(JSON.stringify({ schemaVersion: "2.0", tipo: "lotes" }))).toThrow(
      /resultados/i,
    );
  });
});
