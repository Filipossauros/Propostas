import { describe, expect, it } from "vitest";
import {
  anosDoOrcamento,
  comInterno,
  comProjeto,
  ehOrcamentoGuardado,
  importarOrcamentoJSON,
  jaTemProjeto,
  lotesDoProjeto,
  nomeDoProjeto,
  normalizarOrcamento,
  orcamentoInicial,
  orcamentoParaJSON,
  percentagemNaUnidade,
  pessoasDaUnidade,
  pessoasDoProjeto,
  projetoDeAgrupamento,
  semInterno,
  semProjeto,
  totaisPorAnoDaUnidade,
  valorDaEntradaNoAno,
  valorDaUnidade,
  valorDoProjeto,
  valorDoProjetoNoAno,
} from "./vistaGeral";
import { criarLote, criarPerfilEmLote, lotesIniciais } from "./lotes";
import { ErroImportacao } from "./perfil";
import { SCHEMA_VERSION_ATUAL } from "./types";
import type { LotesJSON } from "./types";
import { perfil } from "./fixtures";

/** Um agrupamento com um perfil por lote, com horas já repartidas por ano. */
function agrupamento(opcoes: {
  nomeProjeto?: string;
  nomeProcedimento?: string;
  anoInicio?: number;
  taxaIva?: number;
  lotes: Array<{ numero: string; perfil: string; pessoas: number; valorHora: number; horasPorAno: number[] }>;
}): LotesJSON {
  const config = lotesIniciais();
  config.nomeProjeto = opcoes.nomeProjeto ?? "";
  config.nomeProcedimento = opcoes.nomeProcedimento ?? "";
  config.taxaIva = opcoes.taxaIva ?? 23;
  config.encargosPlurianuais = { ativo: true, anoInicio: opcoes.anoInicio ?? 2027 };
  config.lotes = opcoes.lotes.map((l) => {
    const lote = criarLote(l.numero);
    const entrada = criarPerfilEmLote(perfil({ perfil: l.perfil }));
    lote.perfis = [
      {
        ...entrada,
        nMinimoElementos: l.pessoas,
        valorHora: l.valorHora,
        horasPorAno: l.horasPorAno,
        horas: l.horasPorAno.reduce((soma, h) => soma + h, 0),
      },
    ];
    return lote;
  });
  return config;
}

function projetoSimples(nome: string, pessoas: number, anoInicio = 2027) {
  return projetoDeAgrupamento(
    agrupamento({
      nomeProjeto: nome,
      anoInicio,
      lotes: [{ numero: "1", perfil: "Programador", pessoas, valorHora: 100, horasPorAno: [1000, 500, 0] }],
    }),
  );
}

describe("nome do projeto", () => {
  it("prefere o nome do projeto", () => {
    expect(nomeDoProjeto(agrupamento({ nomeProjeto: "SClínico", nomeProcedimento: "Aquisição…", lotes: [] }))).toBe(
      "SClínico",
    );
  });

  it("na falta dele, serve o nome do procedimento", () => {
    expect(nomeDoProjeto(agrupamento({ nomeProcedimento: "Aquisição de Serviços…", lotes: [] }))).toBe(
      "Aquisição de Serviços…",
    );
  });

  it("faltando os dois, o projeto fica identificado à mesma", () => {
    expect(nomeDoProjeto(agrupamento({ lotes: [] }))).toBe("(projeto sem nome)");
  });
});

describe("leitura de um agrupamento", () => {
  it("traz uma linha por perfil de cada lote", () => {
    const projeto = projetoDeAgrupamento(
      agrupamento({
        nomeProjeto: "SClínico",
        lotes: [
          { numero: "1", perfil: "Programador", pessoas: 2, valorHora: 100, horasPorAno: [1000, 1000, 0] },
          { numero: "2", perfil: "Arquiteto", pessoas: 1, valorHora: 50, horasPorAno: [500, 0, 0] },
        ],
      }),
    );

    expect(projeto.nome).toBe("SClínico");
    expect(projeto.anoInicio).toBe(2027);
    expect(projeto.entradas.map((e) => `${e.lote}/${e.perfil}`)).toEqual(["1/Programador", "2/Arquiteto"]);
    expect(lotesDoProjeto(projeto)).toEqual(["1", "2"]);
  });

  it("calcula a rate com IVA e o valor de cada ano, com IVA", () => {
    const [entrada] = projetoSimples("SClínico", 2).entradas;

    expect(entrada.valorHoraSemIva).toBe(100);
    expect(entrada.valorHoraComIva).toBeCloseTo(123, 10);
    // 2 pessoas × 1000 h × 123 €/h
    expect(entrada.totaisPorAno[0]).toBeCloseTo(246_000, 5);
    expect(entrada.totaisPorAno[1]).toBeCloseTo(123_000, 5);
    expect(entrada.totaisPorAno[2]).toBe(0);
  });

  it("um agrupamento sem pedido plurianual reparte as horas na mesma", () => {
    const config = agrupamento({
      nomeProjeto: "Sem pedido",
      lotes: [{ numero: "1", perfil: "Programador", pessoas: 1, valorHora: 10, horasPorAno: [0, 0, 0] }],
    });
    config.encargosPlurianuais = { ativo: false, anoInicio: 2027 };
    config.lotes[0].perfis[0].horas = 300;

    const projeto = projetoDeAgrupamento(config);
    expect(projeto.entradas[0].totaisPorAno.map((v) => Math.round(v))).toEqual([1230, 1230, 1230]);
  });
});

describe("acrescentar projetos", () => {
  it("acrescenta pela ordem de importação", () => {
    let orcamento = orcamentoInicial();
    orcamento = comProjeto(orcamento, projetoSimples("A", 1));
    orcamento = comProjeto(orcamento, projetoSimples("B", 1));
    expect(orcamento.projetos.map((p) => p.nome)).toEqual(["A", "B"]);
  });

  it("reimportar o mesmo projeto substitui-o, em vez de o duplicar", () => {
    let orcamento = comProjeto(orcamentoInicial(), projetoSimples("A", 1));
    expect(jaTemProjeto(orcamento, "A")).toBe(true);

    orcamento = comProjeto(orcamento, projetoSimples("A", 5));
    expect(orcamento.projetos).toHaveLength(1);
    expect(orcamento.projetos[0].entradas[0].pessoas).toBe(5);
  });

  it("e a substituição não perde os elementos internos já registados", () => {
    let orcamento = comProjeto(orcamentoInicial(), projetoSimples("A", 1));
    orcamento = comInterno(orcamento, orcamento.projetos[0].id, "Ana Silva");

    orcamento = comProjeto(orcamento, projetoSimples("A", 5));
    expect(orcamento.projetos[0].internos.map((i) => i.nome)).toEqual(["Ana Silva"]);
  });
});

describe("pessoas e percentagem", () => {
  it("os elementos internos contam um cada, ao lado dos exigidos nos perfis", () => {
    let orcamento = comProjeto(orcamentoInicial(), projetoSimples("A", 3));
    const id = orcamento.projetos[0].id;
    expect(pessoasDoProjeto(orcamento.projetos[0])).toBe(3);

    orcamento = comInterno(orcamento, id, "Ana Silva");
    orcamento = comInterno(orcamento, id, "Bruno Costa");
    expect(pessoasDoProjeto(orcamento.projetos[0])).toBe(5);
  });

  it("um nome em branco não conta como pessoa", () => {
    let orcamento = comProjeto(orcamentoInicial(), projetoSimples("A", 1));
    orcamento = comInterno(orcamento, orcamento.projetos[0].id, "   ");
    expect(orcamento.projetos[0].internos).toEqual([]);
  });

  it("a percentagem reparte o total da unidade pelos projetos", () => {
    let orcamento = comProjeto(orcamentoInicial(), projetoSimples("A", 3));
    orcamento = comProjeto(orcamento, projetoSimples("B", 1));

    expect(pessoasDaUnidade(orcamento)).toBe(4);
    expect(percentagemNaUnidade(orcamento, orcamento.projetos[0])).toBe(75);
    expect(percentagemNaUnidade(orcamento, orcamento.projetos[1])).toBe(25);
  });

  it("as percentagens somam cem, contando os internos", () => {
    let orcamento = comProjeto(orcamentoInicial(), projetoSimples("A", 3));
    orcamento = comProjeto(orcamento, projetoSimples("B", 1));
    orcamento = comInterno(orcamento, orcamento.projetos[1].id, "Ana Silva");

    expect(pessoasDaUnidade(orcamento)).toBe(5);
    const soma = orcamento.projetos.reduce((s, p) => s + percentagemNaUnidade(orcamento, p), 0);
    expect(soma).toBeCloseTo(100, 10);
  });

  it("sem pessoas nenhumas, a percentagem é zero e não indefinida", () => {
    const orcamento = orcamentoInicial();
    expect(percentagemNaUnidade(orcamento, projetoSimples("A", 0))).toBe(0);
  });
});

describe("anos do orçamento", () => {
  it("com um projeto só, são os três anos dele", () => {
    const orcamento = comProjeto(orcamentoInicial(), projetoSimples("A", 1, 2027));
    expect(anosDoOrcamento(orcamento)).toEqual([2027, 2028, 2029]);
  });

  it("com projetos que começam em anos diferentes, cobrem-nos a todos", () => {
    let orcamento = comProjeto(orcamentoInicial(), projetoSimples("A", 1, 2027));
    orcamento = comProjeto(orcamento, projetoSimples("B", 1, 2029));
    expect(anosDoOrcamento(orcamento)).toEqual([2027, 2028, 2029, 2030, 2031]);
  });

  it("um projeto não contribui para anos fora dos seus", () => {
    let orcamento = comProjeto(orcamentoInicial(), projetoSimples("A", 1, 2027));
    orcamento = comProjeto(orcamento, projetoSimples("B", 1, 2029));

    const [a] = orcamento.projetos;
    expect(valorDoProjetoNoAno(a, 2027)).toBeGreaterThan(0);
    expect(valorDoProjetoNoAno(a, 2030)).toBe(0);
    expect(valorDaEntradaNoAno(a, a.entradas[0], 2030)).toBeNull();
  });

  it("o total da unidade em cada ano soma os projetos que lá estão", () => {
    let orcamento = comProjeto(orcamentoInicial(), projetoSimples("A", 1, 2027));
    orcamento = comProjeto(orcamento, projetoSimples("B", 1, 2028));

    const totais = totaisPorAnoDaUnidade(orcamento);
    const [a, b] = orcamento.projetos;
    expect(totais).toHaveLength(4);
    expect(totais[0]).toBeCloseTo(valorDoProjetoNoAno(a, 2027), 6);
    expect(totais[1]).toBeCloseTo(valorDoProjetoNoAno(a, 2028) + valorDoProjetoNoAno(b, 2028), 6);
    expect(totais.reduce((s, v) => s + v, 0)).toBeCloseTo(valorDaUnidade(orcamento), 6);
  });

  it("sem projetos, não há anos nenhuns", () => {
    expect(anosDoOrcamento(orcamentoInicial())).toEqual([]);
  });
});

describe("remoções", () => {
  it("apagar um elemento interno desconta-o do total de pessoas", () => {
    let orcamento = comProjeto(orcamentoInicial(), projetoSimples("A", 1));
    const id = orcamento.projetos[0].id;
    orcamento = comInterno(orcamento, id, "Ana Silva");
    expect(pessoasDoProjeto(orcamento.projetos[0])).toBe(2);

    orcamento = semInterno(orcamento, id, orcamento.projetos[0].internos[0].id);
    expect(pessoasDoProjeto(orcamento.projetos[0])).toBe(1);
  });

  it("apagar um projeto tira-o da unidade e reparte a percentagem pelos que ficam", () => {
    let orcamento = comProjeto(orcamentoInicial(), projetoSimples("A", 3));
    orcamento = comProjeto(orcamento, projetoSimples("B", 1));

    orcamento = semProjeto(orcamento, orcamento.projetos[0].id);
    expect(orcamento.projetos.map((p) => p.nome)).toEqual(["B"]);
    expect(percentagemNaUnidade(orcamento, orcamento.projetos[0])).toBe(100);
  });
});

describe("orçamento em JSON", () => {
  it("dá a volta sem perder nada", () => {
    let orcamento = comProjeto(orcamentoInicial(), projetoSimples("A", 2, 2028));
    orcamento = comInterno(orcamento, orcamento.projetos[0].id, "Ana Silva");
    orcamento = { ...orcamento, unidade: "Unidade de Sistemas" };

    const voltou = importarOrcamentoJSON(orcamentoParaJSON(orcamento));
    expect(voltou.unidade).toBe("Unidade de Sistemas");
    expect(voltou.projetos[0].anoInicio).toBe(2028);
    expect(voltou.projetos[0].internos.map((i) => i.nome)).toEqual(["Ana Silva"]);
    expect(valorDoProjeto(voltou.projetos[0])).toBeCloseTo(valorDoProjeto(orcamento.projetos[0]), 6);
    expect(pessoasDaUnidade(voltou)).toBe(pessoasDaUnidade(orcamento));
  });

  it("recusa um ficheiro que não seja um orçamento", () => {
    const lotes = JSON.stringify({ schemaVersion: SCHEMA_VERSION_ATUAL, tipo: "lotes", lotes: [] });
    expect(() => importarOrcamentoJSON(lotes)).toThrow(ErroImportacao);
  });

  it("recusa outra versão do esquema", () => {
    const antigo = JSON.stringify({ schemaVersion: "1.0", tipo: "orcamentoUnidade", projetos: [] });
    expect(() => importarOrcamentoJSON(antigo)).toThrow(ErroImportacao);
  });

  it("recusa texto que não é JSON", () => {
    expect(() => importarOrcamentoJSON("nada disto")).toThrow(ErroImportacao);
  });

  it("tolera um projeto a que falte quase tudo", () => {
    const magro = JSON.stringify({
      schemaVersion: SCHEMA_VERSION_ATUAL,
      tipo: "orcamentoUnidade",
      projetos: [{ nome: "A" }],
    });
    const orcamento = importarOrcamentoJSON(magro);
    expect(orcamento.projetos[0].entradas).toEqual([]);
    expect(orcamento.projetos[0].internos).toEqual([]);
    expect(pessoasDoProjeto(orcamento.projetos[0])).toBe(0);
  });
});

describe("orçamento guardado no navegador", () => {
  it("reconhece o que esta versão gravou", () => {
    const orcamento = comProjeto(orcamentoInicial(), projetoSimples("A", 2));
    expect(ehOrcamentoGuardado(JSON.parse(orcamentoParaJSON(orcamento)))).toBe(true);
  });

  it("recusa o que veio de outra versão, ou de outro tipo de ficheiro", () => {
    expect(ehOrcamentoGuardado({ schemaVersion: "1.0", tipo: "orcamentoUnidade", projetos: [] })).toBe(false);
    expect(ehOrcamentoGuardado({ schemaVersion: SCHEMA_VERSION_ATUAL, tipo: "lotes", lotes: [] })).toBe(false);
    expect(ehOrcamentoGuardado(null)).toBe(false);
    expect(ehOrcamentoGuardado("nada")).toBe(false);
  });

  it("o que se recupera do navegador é igual ao que se carrega de ficheiro", () => {
    let orcamento = comProjeto(orcamentoInicial(), projetoSimples("A", 2, 2028));
    orcamento = comInterno(orcamento, orcamento.projetos[0].id, "Ana Silva");

    const gravado = JSON.parse(orcamentoParaJSON(orcamento)) as object;
    const doNavegador = normalizarOrcamento(gravado);
    const doFicheiro = importarOrcamentoJSON(orcamentoParaJSON(orcamento));

    expect(doNavegador).toEqual(doFicheiro);
    expect(pessoasDaUnidade(doNavegador)).toBe(3);
  });

  it("um orçamento guardado a que falte um campo é reposto, não deitado fora", () => {
    const orcamento = normalizarOrcamento({ tipo: "orcamentoUnidade", projetos: [{ nome: "A" }] });
    expect(orcamento.unidade).toBe("");
    expect(orcamento.projetos.map((p) => p.nome)).toEqual(["A"]);
    expect(orcamento.projetos[0].entradas).toEqual([]);
  });
});
