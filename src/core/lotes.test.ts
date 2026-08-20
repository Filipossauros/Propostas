import { describe, expect, it } from "vitest";
import {
  importarLotesJSON,
  linhasTabelaValores,
  lotesIniciais,
  lotesParaJSON,
  perfisComCertificacao,
  totalLote,
  totalProcedimento,
  validarLotes,
} from "./lotes";
import { ErroImportacao } from "./perfil";
import { TAXA_IVA_PADRAO } from "./types";
import { lotesComPerfis, perfil } from "./fixtures";
import type { LotesJSON } from "./types";

function lotesExemplo(): LotesJSON {
  return lotesComPerfis([
    { numero: "1", perfis: [perfil({ perfil: "Programador Sénior" })] },
    { numero: "2", perfis: [perfil({ perfil: "Analista" })] },
  ]);
}

describe("validarLotes", () => {
  it("aceita um agrupamento completo", () => {
    expect(validarLotes(lotesExemplo())).toHaveLength(0);
  });

  it("exige pelo menos um lote", () => {
    expect(validarLotes(lotesIniciais()).some((e) => e.campo === "lotes")).toBe(true);
  });

  it("rejeita números de lote repetidos", () => {
    const config = lotesExemplo();
    config.lotes[1].numero = config.lotes[0].numero;
    expect(validarLotes(config).some((e) => e.mensagem.includes("repetido"))).toBe(true);
  });

  it("exige a designação do lote — dá nome ao ficheiro de formulários", () => {
    const config = lotesExemplo();
    config.lotes[0].designacao = "   ";
    expect(validarLotes(config).some((e) => e.campo === "lotes[0].designacao")).toBe(true);
  });

  it("exige horas e valor/hora positivos", () => {
    const config = lotesExemplo();
    config.lotes[0].perfis[0].horas = 0;
    config.lotes[0].perfis[0].valorHora = -5;

    const erros = validarLotes(config);
    expect(erros.some((e) => e.campo.includes("horas"))).toBe(true);
    expect(erros.some((e) => e.campo.includes("valorHora"))).toBe(true);
  });

  it("exige um lote com pelo menos um perfil", () => {
    const config = lotesExemplo();
    config.lotes[0].perfis = [];
    expect(validarLotes(config).some((e) => e.campo.includes("perfis"))).toBe(true);
  });
});

describe("preço base", () => {
  it("calcula o valor de cada perfil como n.º mínimo de elementos × horas × valor/hora", () => {
    const linhas = linhasTabelaValores(lotesExemplo());
    expect(linhas).toHaveLength(2);
    expect(linhas[0].valores.semIva).toBe(2 * 100 * 50);
  });

  it("o n.º mínimo de elementos multiplica o preço base", () => {
    const config = lotesExemplo();
    config.lotes[0].perfis[0].nMinimoElementos = 7;
    expect(linhasTabelaValores(config)[0].valores.semIva).toBe(7 * 100 * 50);
  });

  it("soma por lote e por procedimento", () => {
    const config = lotesExemplo();
    expect(totalLote(config.lotes[0], 23).semIva).toBe(10000);
    expect(totalProcedimento(config).semIva).toBe(20000);
  });
});

describe("importação/exportação de lotes", () => {
  it("repõe o estado completo (ida e volta)", () => {
    const original = lotesExemplo();
    expect(importarLotesJSON(lotesParaJSON(original))).toEqual(original);
  });

  it("rejeita um ficheiro de perfil carregado como lotes", () => {
    expect(() => importarLotesJSON(JSON.stringify(perfil()))).toThrow(/não um agrupamento/i);
  });

  it("rejeita schemaVersion desconhecida", () => {
    const antigo = JSON.stringify({ ...lotesExemplo(), schemaVersion: "1.0" });
    expect(() => importarLotesJSON(antigo)).toThrow(ErroImportacao);
  });
});

describe("IVA", () => {
  it("aplica a taxa configurada sobre a base tributável", () => {
    const config = lotesExemplo();
    config.taxaIva = 23;

    const linha = linhasTabelaValores(config)[0];
    expect(linha.valores.semIva).toBe(10000);
    expect(linha.valores.iva).toBeCloseTo(2300, 6);
    expect(linha.valores.comIva).toBeCloseTo(12300, 6);
  });

  it("uma taxa de zero deixa o valor com IVA igual ao valor sem IVA", () => {
    const config = lotesExemplo();
    config.taxaIva = 0;
    expect(totalProcedimento(config).comIva).toBe(totalProcedimento(config).semIva);
  });

  it("assume a taxa por omissão em ficheiros anteriores, que não a tinham", () => {
    const semTaxa = { ...lotesExemplo() } as Record<string, unknown>;
    delete semTaxa.taxaIva;

    const importado = importarLotesJSON(JSON.stringify(semTaxa));
    expect(importado.taxaIva).toBe(TAXA_IVA_PADRAO);
  });
});

describe("perfisComCertificacao", () => {
  it("assinala só os perfis que exigem certificação, com o lote onde estão", () => {
    const config = lotesComPerfis([
      { numero: "1", perfis: [perfil({ perfil: "Programador", certificacoes: "Certificação A; Certificação B" })] },
      { numero: "2", perfis: [perfil({ perfil: "Analista" })] },
    ]);

    expect(perfisComCertificacao(config)).toEqual([
      {
        loteNumero: "1",
        loteDesignacao: "Lote 1",
        perfil: "Programador",
        certificacoes: ["Certificação A", "Certificação B"],
      },
    ]);
  });

  it("o agrupamento exportado leva as certificações, para o Módulo 3 poder avisar", () => {
    const config = lotesComPerfis([
      { numero: "1", perfis: [perfil({ certificacoes: "Certificação A" })] },
    ]);

    expect(perfisComCertificacao(importarLotesJSON(lotesParaJSON(config)))).toHaveLength(1);
  });
});
