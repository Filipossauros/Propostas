import { describe, expect, it } from "vitest";
import {
  anosPlurianuais,
  comLinhaPlurianualAlterada,
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

/** Um agrupamento com dois perfis num lote, e o pedido plurianual ligado. */
function comPedido(alteracoes: Partial<LotesJSON["encargosPlurianuais"]> = {}): LotesJSON {
  const base = lotesComPerfis([{ numero: "1", perfis: [perfil({ perfil: "Analista" }), perfil({ perfil: "Tester" })] }]);
  return {
    ...base,
    encargosPlurianuais: { ...encargosPlurianuaisIniciais(2026), ativo: true, ...alteracoes },
  };
}

describe("anosPlurianuais", () => {
  it("são os três anos seguintes ao do início, e não o do início", () => {
    expect(anosPlurianuais(2026)).toEqual([2027, 2028, 2029]);
  });
});

describe("linhasPlurianuais", () => {
  it("uma linha por perfil dentro de cada lote", () => {
    const linhas = linhasPlurianuais(comPedido());

    expect(linhas.map((l) => l.perfil)).toEqual(["Analista", "Tester"]);
    expect(linhas.every((l) => l.lote === "1")).toBe(true);
  });

  it("as pessoas e o lote vêm do agrupamento, não do pedido", () => {
    const config = comPedido();
    const [primeira] = linhasPlurianuais(config);

    expect(primeira.pessoas).toBe(config.lotes[0].perfis[0].nMinimoElementos);
  });

  it("por preencher, o preço parte do que está no lote, com e sem IVA", () => {
    const config = comPedido();
    const [primeira] = linhasPlurianuais(config);

    // A fixture usa 50 €/h e a taxa de IVA padrão, 23%.
    expect(primeira.valorHoraSemIva).toBe(50);
    expect(primeira.valorHoraComIva).toBeCloseTo(61.5, 2);
    expect(primeira.totais).toEqual([0, 0, 0]);
  });

  it("um perfil retirado do lote leva consigo a sua linha", () => {
    const config = comPedido();
    const [primeira] = linhasPlurianuais(config);
    const comValores = {
      ...config,
      encargosPlurianuais: comLinhaPlurianualAlterada(config.encargosPlurianuais, primeira, {
        totais: [10, 20, 30],
      }),
    };
    const semPerfil: LotesJSON = {
      ...comValores,
      lotes: [{ ...comValores.lotes[0], perfis: comValores.lotes[0].perfis.slice(1) }],
    };

    expect(linhasPlurianuais(semPerfil).map((l) => l.perfil)).toEqual(["Tester"]);
    expect(totaisPorAnoPlurianual(semPerfil)).toEqual([0, 0, 0]);
  });
});

describe("comLinhaPlurianualAlterada", () => {
  it("editar um total não apaga o preço que já lá estava", () => {
    const config = comPedido();
    const [linha] = linhasPlurianuais(config);

    const encargos = comLinhaPlurianualAlterada(config.encargosPlurianuais, linha, { totais: [1, 2, 3] });
    const [depois] = linhasPlurianuais({ ...config, encargosPlurianuais: encargos });

    expect(depois.totais).toEqual([1, 2, 3]);
    expect(depois.valorHoraSemIva).toBe(50);
  });

  it("editar duas vezes a mesma linha não a duplica", () => {
    const config = comPedido();
    const [linha] = linhasPlurianuais(config);

    let encargos = comLinhaPlurianualAlterada(config.encargosPlurianuais, linha, { valorHoraSemIva: 40 });
    encargos = comLinhaPlurianualAlterada(encargos, linhasPlurianuais({ ...config, encargosPlurianuais: encargos })[0], {
      valorHoraSemIva: 45,
    });

    expect(encargos.linhas).toHaveLength(1);
    expect(encargos.linhas[0].valorHoraSemIva).toBe(45);
  });
});

describe("totaisPorAnoPlurianual", () => {
  it("soma as linhas ano a ano", () => {
    const config = comPedido();
    const [a, b] = linhasPlurianuais(config);
    let encargos = comLinhaPlurianualAlterada(config.encargosPlurianuais, a, { totais: [100, 200, 300] });
    encargos = comLinhaPlurianualAlterada(encargos, b, { totais: [1, 2, 3] });

    expect(totaisPorAnoPlurianual({ ...config, encargosPlurianuais: encargos })).toEqual([101, 202, 303]);
  });
});

describe("validarEncargosPlurianuais", () => {
  it("sem pedido não há nada a validar", () => {
    const config = lotesComPerfis([{ numero: "1", perfis: [perfil()] }]);

    expect(validarEncargosPlurianuais(config)).toEqual([]);
  });

  it("um pedido sem valores em ano nenhum não é um pedido", () => {
    const mensagens = validarEncargosPlurianuais(comPedido()).map((e) => e.mensagem);

    expect(mensagens).toContain("Encargos plurianuais: indique os totais a assumir em, pelo menos, um dos anos.");
  });

  it("basta um ano preenchido para o pedido fazer sentido", () => {
    const config = comPedido();
    const [linha] = linhasPlurianuais(config);
    const comValor = {
      ...config,
      encargosPlurianuais: comLinhaPlurianualAlterada(config.encargosPlurianuais, linha, { totais: [0, 1000, 0] }),
    };

    expect(validarEncargosPlurianuais(comValor)).toEqual([]);
  });

  it("o ano de início tem de ser um ano", () => {
    const mensagens = validarEncargosPlurianuais(comPedido({ anoInicio: 12 })).map((e) => e.mensagem);

    expect(mensagens.some((m) => m.includes("indique o ano de início"))).toBe(true);
  });

  it("valores negativos são apanhados, e dizem de que perfil", () => {
    const config = comPedido();
    const [linha] = linhasPlurianuais(config);
    const negativo = {
      ...config,
      encargosPlurianuais: comLinhaPlurianualAlterada(config.encargosPlurianuais, linha, { totais: [-1, 0, 0] }),
    };

    expect(validarEncargosPlurianuais(negativo).map((e) => e.mensagem)).toContain(
      'Encargos plurianuais: os valores do perfil "Analista" no lote 1 têm de ser positivos.',
    );
  });

  it("as questões do pedido entram na lista do Módulo 2", () => {
    expect(validarLotes(comPedido()).some((e) => e.campo.startsWith("encargosPlurianuais"))).toBe(true);
  });
});

describe("no ficheiro e no documento", () => {
  it("o pedido sobrevive a passar por JSON", () => {
    const config = comPedido();
    const [linha] = linhasPlurianuais(config);
    const original = {
      ...config,
      encargosPlurianuais: comLinhaPlurianualAlterada(config.encargosPlurianuais, linha, { totais: [7, 8, 9] }),
    };

    const lido = importarLotesJSON(lotesParaJSON(original)).encargosPlurianuais;

    expect(lido.ativo).toBe(true);
    expect(lido.anoInicio).toBe(2026);
    expect(lido.linhas[0].totais).toEqual([7, 8, 9]);
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

  it("com pedido, o documento leva o texto, os anos e os totais", () => {
    const config = comPedido();
    const [linha] = linhasPlurianuais(config);
    const comValores = {
      ...config,
      encargosPlurianuais: comLinhaPlurianualAlterada(config.encargosPlurianuais, linha, {
        totais: [0, 12345.67, 0],
      }),
    };

    const texto = documentoParaTexto(documentoRegrasEPrecoBase(comValores));

    expect(texto).toContain("Pedido de encargos plurianuais");
    expect(texto).toContain("estabilidade dos recursos");
    expect(texto).toContain("transferência de conhecimento");
    expect(texto).toContain("2027");
    expect(texto).toContain("2029");
    expect(texto).toMatch(/12[\s\u00a0.]345,67/);
    expect(texto).toContain("Total a assumir");
  });
});
