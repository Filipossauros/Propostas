import { describe, expect, it } from "vitest";
import {
  anosPlurianuais,
  comHorasDoAno,
  distribuicaoPadrao,
  horasPorAnoDe,
  importarLotesJSON,
  linhasPlurianuais,
  lotesParaJSON,
  precoBaseEntrada,
  totaisPorAnoDoLote,
  totaisPorAnoPlurianual,
  validarEncargosPlurianuais,
  validarLotes,
} from "./lotes";
import { documentoRegrasEPrecoBase } from "./cadernoEncargos";
import { documentoParaTexto } from "./documento";
import { lotesComPerfis, perfil } from "./fixtures";
import type { LotesJSON, PerfilEmLote } from "./types";
import { anosDeInicioAdmitidos } from "./types";

const HOJE = new Date(2026, 7, 25);
const ESTE_ANO = HOJE.getFullYear();

/**
 * Um agrupamento com dois perfis num lote e o pedido ligado. A fixture dá a
 * cada perfil 100 horas, 2 elementos e 50 €/h, com IVA à taxa padrão.
 */
function comPedido(anoInicio = ESTE_ANO): LotesJSON {
  const base = lotesComPerfis([{ numero: "1", perfis: [perfil({ perfil: "Analista" }), perfil({ perfil: "Tester" })] }]);
  return { ...base, encargosPlurianuais: { ativo: true, anoInicio } };
}

/** Escreve as horas de um ano no perfil indicado, como faz o editor do lote. */
function comHoras(config: LotesJSON, indice: number, horas: number[]): LotesJSON {
  return {
    ...config,
    lotes: config.lotes.map((lote) => ({
      ...lote,
      perfis: lote.perfis.map((entrada, i) => {
        if (i !== indice) return entrada;
        return horas.reduce<PerfilEmLote>(
          (atual, valor, ano) => ({ ...atual, ...comHorasDoAno(atual, ano, valor) }),
          entrada,
        );
      }),
    })),
  };
}

describe("anosPlurianuais", () => {
  it("são o ano do início e os dois seguintes", () => {
    expect(anosPlurianuais(2026)).toEqual([2026, 2027, 2028]);
  });
});

describe("anosDeInicioAdmitidos", () => {
  it("só o ano corrente e o seguinte", () => {
    expect(anosDeInicioAdmitidos(HOJE)).toEqual([2026, 2027]);
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

describe("horasPorAnoDe", () => {
  it("um perfil com horas mas sem repartição mostra a repartição de partida", () => {
    const [entrada] = comPedido().lotes[0].perfis;

    expect(entrada.horas).toBe(100);
    expect(horasPorAnoDe(entrada)).toEqual([33, 33, 34]);
  });

  it("escrita a repartição, é ela que vale", () => {
    const config = comHoras(comPedido(), 0, [0, 40, 60]);

    expect(horasPorAnoDe(config.lotes[0].perfis[0])).toEqual([0, 40, 60]);
  });
});

describe("comHorasDoAno", () => {
  it("escrever as horas de um ano refaz o total do perfil", () => {
    const [entrada] = comPedido().lotes[0].perfis;
    const alterada = { ...entrada, ...comHorasDoAno(entrada, 0, 200) };

    expect(alterada.horasPorAno).toEqual([200, 33, 34]);
    expect(alterada.horas).toBe(267);
  });

  it("e com o total refaz-se o preço base, sem ninguém ter de o repetir", () => {
    const [entrada] = comPedido().lotes[0].perfis;
    const alterada = { ...entrada, ...comHorasDoAno(entrada, 0, 0) };

    // 2 elementos × 67 horas × 50 €/h
    expect(alterada.horas).toBe(67);
    expect(precoBaseEntrada(alterada)).toBe(2 * 67 * 50);
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

  it("o valor de cada ano é pessoas × horas do ano × preço/hora com IVA", () => {
    const [primeira] = linhasPlurianuais(comHoras(comPedido(), 0, [100, 0, 0]));

    expect(primeira.totais[0]).toBeCloseTo(2 * 100 * 61.5, 2);
    expect(primeira.totais[1]).toBe(0);
  });

  it("um ano a zero é uma repartição legítima, e não um erro", () => {
    const config = comHoras(comPedido(), 0, [0, 50, 50]);

    expect(linhasPlurianuais(config)[0].horas).toEqual([0, 50, 50]);
    expect(validarLotes(config)).toEqual([]);
  });

  it("um perfil retirado do lote leva consigo a sua linha", () => {
    const config = comPedido();
    const semPerfil: LotesJSON = {
      ...config,
      lotes: [{ ...config.lotes[0], perfis: config.lotes[0].perfis.slice(1) }],
    };

    expect(linhasPlurianuais(semPerfil).map((l) => l.perfil)).toEqual(["Tester"]);
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
    expect(validarEncargosPlurianuais(lotesComPerfis([{ numero: "1", perfis: [perfil()] }]), HOJE)).toEqual([]);
  });

  it("o ano corrente serve", () => {
    expect(validarEncargosPlurianuais(comPedido(ESTE_ANO), HOJE)).toEqual([]);
  });

  it("o ano seguinte também", () => {
    expect(validarEncargosPlurianuais(comPedido(ESTE_ANO + 1), HOJE)).toEqual([]);
  });

  it("mas não o de daqui a dois anos: não se pede hoje o que só começa depois", () => {
    const mensagens = validarEncargosPlurianuais(comPedido(ESTE_ANO + 2), HOJE).map((e) => e.mensagem);

    expect(mensagens).toEqual([
      "Encargos plurianuais: o contrato só pode iniciar-se em 2026 ou 2027 — não se pede hoje autorização para " +
        "uma despesa que só começa mais tarde.",
    ]);
  });

  it("nem um ano já passado", () => {
    expect(validarEncargosPlurianuais(comPedido(ESTE_ANO - 1), HOJE)).toHaveLength(1);
  });

  it("um perfil sem horas em ano nenhum não passa, como não passava sem horas nenhumas", () => {
    const semHoras = comHoras(comPedido(), 0, [0, 0, 0]);

    expect(validarLotes(semHoras).some((e) => e.mensagem.includes("horas"))).toBe(true);
  });
});

describe("no ficheiro e no documento", () => {
  it("a repartição sobrevive a passar por JSON, no lote onde vive", () => {
    const original = comHoras(comPedido(), 0, [0, 40, 60]);
    const lido = importarLotesJSON(lotesParaJSON(original));

    expect(lido.encargosPlurianuais.ativo).toBe(true);
    expect(lido.lotes[0].perfis[0].horasPorAno).toEqual([0, 40, 60]);
    expect(lido.lotes[0].perfis[0].horas).toBe(100);
  });

  it("um ficheiro anterior a este campo abre sem pedido e sem repartição", () => {
    const config = lotesComPerfis([{ numero: "1", perfis: [perfil()] }]);
    const semCampo = JSON.parse(lotesParaJSON(config)) as Record<string, unknown>;
    delete semCampo.encargosPlurianuais;

    const lido = importarLotesJSON(JSON.stringify(semCampo));

    expect(lido.encargosPlurianuais.ativo).toBe(false);
    expect(lido.lotes[0].perfis[0].horas).toBe(100);
  });

  it("sem pedido, o documento não fala dele", () => {
    const config = lotesComPerfis([{ numero: "1", perfis: [perfil()] }]);

    expect(documentoParaTexto(documentoRegrasEPrecoBase(config))).not.toContain("plurianuais");
  });

  it("com dois lotes, a tabela dos anos leva os subtotais de cada um", () => {
    const base = lotesComPerfis([
      { numero: "1", perfis: [perfil({ perfil: "Analista" })] },
      { numero: "2", perfis: [perfil({ perfil: "Tester" })] },
    ]);
    const config: LotesJSON = { ...base, encargosPlurianuais: { ativo: true, anoInicio: ESTE_ANO } };

    expect(totaisPorAnoDoLote(config, config.lotes[0].id)[0]).toBeCloseTo(2 * 33 * 61.5, 2);
    expect(documentoParaTexto(documentoRegrasEPrecoBase(config))).toContain("Subtotal do lote 2");
  });

  it("com um lote só, não há subtotal a repetir o total", () => {
    expect(documentoParaTexto(documentoRegrasEPrecoBase(comPedido()))).not.toContain("Subtotal do lote");
  });

  it("com pedido, o documento leva o fundamento, os anos e as horas de cada ano", () => {
    const texto = documentoParaTexto(documentoRegrasEPrecoBase(comHoras(comPedido(2026), 0, [0, 40, 60])));

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
