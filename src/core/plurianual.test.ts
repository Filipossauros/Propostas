import { describe, expect, it } from "vitest";
import {
  anosPlurianuais,
  comHorasPlurianuaisAlteradas,
  distribuicaoPadrao,
  importarLotesJSON,
  linhasPlurianuais,
  lotesParaJSON,
  totaisPorAnoPlurianual,
  validarEncargosPlurianuais,
  validarLotes,
} from "./lotes";
import { documentoRegrasEPrecoBase } from "./cadernoEncargos";
import { documentoParaTexto } from "./documento";
import { lotesComPerfis, perfil } from "./fixtures";
import type { LotesJSON } from "./types";
import { encargosPlurianuaisIniciais } from "./types";

/**
 * Um agrupamento com dois perfis num lote e o pedido ligado. A fixture dá a
 * cada perfil 100 horas, 2 elementos e 50 €/h, com IVA à taxa padrão.
 */
function comPedido(alteracoes: Partial<LotesJSON["encargosPlurianuais"]> = {}): LotesJSON {
  const base = lotesComPerfis([{ numero: "1", perfis: [perfil({ perfil: "Analista" }), perfil({ perfil: "Tester" })] }]);
  return {
    ...base,
    encargosPlurianuais: { ...encargosPlurianuaisIniciais(2026), ativo: true, ...alteracoes },
  };
}

function comHoras(config: LotesJSON, indice: number, horas: number[]): LotesJSON {
  const linha = linhasPlurianuais(config)[indice];
  return {
    ...config,
    encargosPlurianuais: comHorasPlurianuaisAlteradas(config.encargosPlurianuais, linha.perfilEmLoteId, horas),
  };
}

describe("anosPlurianuais", () => {
  it("são o ano do início e os dois seguintes", () => {
    expect(anosPlurianuais(2026)).toEqual([2026, 2027, 2028]);
  });
});

describe("distribuicaoPadrao", () => {
  it("divide por igual, e a soma bate certo", () => {
    expect(distribuicaoPadrao(300)).toEqual([100, 100, 100]);
    const resto = distribuicaoPadrao(100);
    expect(resto).toEqual([33, 33, 34]);
    expect(resto.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("sem horas contratadas não há nada a repartir", () => {
    expect(distribuicaoPadrao(0)).toEqual([0, 0, 0]);
  });
});

describe("linhasPlurianuais", () => {
  it("uma linha por perfil dentro de cada lote", () => {
    expect(linhasPlurianuais(comPedido()).map((l) => l.perfil)).toEqual(["Analista", "Tester"]);
  });

  it("as pessoas, o lote e o preço/hora vêm do agrupamento", () => {
    const [primeira] = linhasPlurianuais(comPedido());

    expect(primeira.pessoas).toBe(2);
    expect(primeira.lote).toBe("1");
    expect(primeira.valorHoraSemIva).toBe(50);
    expect(primeira.valorHoraComIva).toBeCloseTo(61.5, 2);
  });

  it("por repartir, as horas vêm divididas por igual pelos três anos", () => {
    const [primeira] = linhasPlurianuais(comPedido());

    expect(primeira.horasContratadas).toBe(100);
    expect(primeira.horas).toEqual([33, 33, 34]);
  });

  it("o valor de cada ano é pessoas × horas do ano × preço/hora com IVA", () => {
    const [primeira] = linhasPlurianuais(comHoras(comPedido(), 0, [100, 0, 0]));

    expect(primeira.totais[0]).toBeCloseTo(2 * 100 * 61.5, 2);
    expect(primeira.totais[1]).toBe(0);
  });

  it("um ano a zero é uma repartição legítima, e não um erro", () => {
    const config = comHoras(comPedido(), 0, [0, 50, 50]);

    expect(linhasPlurianuais(config)[0].horas).toEqual([0, 50, 50]);
    expect(validarEncargosPlurianuais(config)).toEqual([]);
  });

  it("um perfil retirado do lote leva consigo a sua linha", () => {
    const config = comHoras(comPedido(), 0, [100, 0, 0]);
    const semPerfil: LotesJSON = {
      ...config,
      lotes: [{ ...config.lotes[0], perfis: config.lotes[0].perfis.slice(1) }],
    };

    expect(linhasPlurianuais(semPerfil).map((l) => l.perfil)).toEqual(["Tester"]);
  });

  it("alterar as horas do lote refaz a repartição de quem ainda não a tocou", () => {
    const config = comPedido();
    const maisHoras: LotesJSON = {
      ...config,
      lotes: [
        {
          ...config.lotes[0],
          perfis: config.lotes[0].perfis.map((p) => ({ ...p, horas: 300 })),
        },
      ],
    };

    expect(linhasPlurianuais(maisHoras)[0].horas).toEqual([100, 100, 100]);
  });
});

describe("comHorasPlurianuaisAlteradas", () => {
  it("editar duas vezes a mesma linha não a duplica", () => {
    const config = comPedido();
    const { perfilEmLoteId } = linhasPlurianuais(config)[0];

    let encargos = comHorasPlurianuaisAlteradas(config.encargosPlurianuais, perfilEmLoteId, [10, 0, 0]);
    encargos = comHorasPlurianuaisAlteradas(encargos, perfilEmLoteId, [0, 0, 100]);

    expect(encargos.linhas).toHaveLength(1);
    expect(encargos.linhas[0].horas).toEqual([0, 0, 100]);
  });
});

describe("totaisPorAnoPlurianual", () => {
  it("soma as linhas ano a ano", () => {
    let config = comHoras(comPedido(), 0, [100, 0, 0]);
    config = comHoras(config, 1, [0, 100, 0]);
    const totais = totaisPorAnoPlurianual(config);

    expect(totais[0]).toBeCloseTo(2 * 100 * 61.5, 2);
    expect(totais[1]).toBeCloseTo(2 * 100 * 61.5, 2);
    expect(totais[2]).toBe(0);
  });
});

describe("validarEncargosPlurianuais", () => {
  it("sem pedido não há nada a validar", () => {
    expect(validarEncargosPlurianuais(lotesComPerfis([{ numero: "1", perfis: [perfil()] }]))).toEqual([]);
  });

  it("a repartição de partida já soma certo", () => {
    expect(validarEncargosPlurianuais(comPedido())).toEqual([]);
  });

  it("horas a menos são apanhadas, e diz-se quanto falta", () => {
    const mensagens = validarEncargosPlurianuais(comHoras(comPedido(), 0, [10, 10, 10])).map((e) => e.mensagem);

    expect(mensagens).toContain(
      'Encargos plurianuais: as horas repartidas por o perfil "Analista" no lote 1 somam 30, e o lote contratou 100.',
    );
  });

  it("horas a mais também", () => {
    const mensagens = validarEncargosPlurianuais(comHoras(comPedido(), 0, [100, 100, 100])).map((e) => e.mensagem);

    expect(mensagens.some((m) => m.includes("somam 300"))).toBe(true);
  });

  it("horas negativas não passam", () => {
    const mensagens = validarEncargosPlurianuais(comHoras(comPedido(), 0, [-10, 60, 50])).map((e) => e.mensagem);

    expect(mensagens.some((m) => m.includes("não podem ser negativas"))).toBe(true);
  });

  it("o ano de início tem de ser um ano", () => {
    const mensagens = validarEncargosPlurianuais(comPedido({ anoInicio: 12 })).map((e) => e.mensagem);

    expect(mensagens.some((m) => m.includes("indique o ano de início"))).toBe(true);
  });

  it("as questões do pedido entram na lista do Módulo 2", () => {
    const config = comHoras(comPedido(), 0, [1, 1, 1]);

    expect(validarLotes(config).some((e) => e.campo.startsWith("encargosPlurianuais"))).toBe(true);
  });
});

describe("no ficheiro e no documento", () => {
  it("a repartição sobrevive a passar por JSON", () => {
    const original = comHoras(comPedido(), 0, [0, 40, 60]);
    const lido = importarLotesJSON(lotesParaJSON(original)).encargosPlurianuais;

    expect(lido.ativo).toBe(true);
    expect(lido.anoInicio).toBe(2026);
    expect(lido.linhas[0].horas).toEqual([0, 40, 60]);
  });

  it("um ficheiro anterior a este campo abre sem pedido", () => {
    const config = lotesComPerfis([{ numero: "1", perfis: [perfil()] }]);
    const semCampo = JSON.parse(lotesParaJSON(config)) as Record<string, unknown>;
    delete semCampo.encargosPlurianuais;

    expect(importarLotesJSON(JSON.stringify(semCampo)).encargosPlurianuais.ativo).toBe(false);
  });

  it("sem pedido, o documento não fala dele", () => {
    const config = lotesComPerfis([{ numero: "1", perfis: [perfil()] }]);

    expect(documentoParaTexto(documentoRegrasEPrecoBase(config))).not.toContain("plurianuais");
  });

  it("com pedido, o documento leva o fundamento, os anos e as horas de cada ano", () => {
    const texto = documentoParaTexto(documentoRegrasEPrecoBase(comHoras(comPedido(), 0, [0, 40, 60])));

    expect(texto).toContain("Pedido de encargos plurianuais");
    expect(texto).toContain("estabilidade dos recursos");
    expect(texto).toContain("transferência de conhecimento");
    expect(texto).toContain("ano económico do início do contrato, 2026");
    expect(texto).toContain("2027 e 2028");
    // O valor de cada ano vai com as horas de que resulta.
    expect(texto).toMatch(/\(0 h\)/);
    expect(texto).toMatch(/\(40 h\)/);
    expect(texto).toContain("não é contratado nesse ano");
    expect(texto).toContain("Total a assumir");
  });
});
