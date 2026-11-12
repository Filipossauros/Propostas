import { describe, expect, it } from "vitest";
import {
  TABELA_RATES_SPMS,
  diferencaMediaBase,
  linhaAdjudicadoVazia,
  normalizarReferenciaValorHora,
  procedimentosDe,
  referenciaValorHoraInicial,
  validarReferenciaValorHora,
} from "./referenciaValorHora";
import { JUSTIFICACAO_SEM_MARGEM, ehJustificacaoPorOmissao, justificacaoPorOmissao } from "./margem";
import { lotesIniciais, normalizarLotesGuardados, validarLotes } from "./lotes";

describe("tabela de referência do valor hora", () => {
  it("parte do quadro da SPMS, com a rate média como fundamento", () => {
    const ref = referenciaValorHoraInicial();
    expect(ref.fundamento).toBe("media");
    expect(ref.media.map((l) => l.perfil)).toEqual(TABELA_RATES_SPMS.map((l) => l.perfil));
    expect(ref.adjudicados).toEqual([]);
    expect(validarReferenciaValorHora(ref)).toEqual([]);
  });

  it("a diferença da média para a base calcula-se, como no quadro de sempre", () => {
    const porPerfil = Object.fromEntries(TABELA_RATES_SPMS.map((l) => [l.perfil, diferencaMediaBase(l)]));
    expect(porPerfil["Analista Funcional"]).toBe(52);
    expect(porPerfil["Tester"]).toBe(16);
    // O quadro antigo dizia 20 %, calculado sobre rates não arredondadas; (59,51 − 47,31) / 59,51 = 20,5 %.
    expect(porPerfil["Arquiteto de Sistemas"]).toBe(21);
    expect(diferencaMediaBase({ base: 0, media: 10 })).toBeNull();
    expect(procedimentosDe({ procedimentos: " 20260065\n\n20260066 " })).toEqual(["20260065", "20260066"]);
  });

  it("valida só a parte que o fundamento usa", () => {
    const ref = { ...referenciaValorHoraInicial(), fundamento: "adjudicado" as const };
    expect(validarReferenciaValorHora(ref).map((e) => e.mensagem)).toEqual([
      "Valor hora de referência: acrescente pelo menos uma linha de valores adjudicados.",
    ]);
    const comLinha = { ...ref, adjudicados: [{ ...linhaAdjudicadoVazia(), perfil: "Tester" }] };
    const msgs = validarReferenciaValorHora(comLinha, 2026).map((e) => e.mensagem);
    expect(msgs).toContain("Valores adjudicados, Tester: indique o procedimento ou o contrato.");
    expect(msgs).toContain("Valores adjudicados, Tester: indique o ano da adjudicação.");
    expect(msgs).toContain("Valores adjudicados, Tester: indique o valor hora adjudicado.");
    // Ambos: as rates médias também contam.
    const ambos = { ...comLinha, fundamento: "ambos" as const, media: [] };
    expect(validarReferenciaValorHora(ambos, 2026).some((e) => e.mensagem.includes("rates médias"))).toBe(true);
    // E entra nas questões do Módulo 3.
    const config = { ...lotesIniciais(), referenciaValorHora: ambos };
    expect(validarLotes(config).some((e) => e.campo === "referenciaValorHora")).toBe(true);
  });

  it("um agrupamento anterior, sem tabela, fica com o quadro da SPMS; uma gravada vai e vem", () => {
    const antigo = { ...lotesIniciais() } as Partial<ReturnType<typeof lotesIniciais>>;
    delete antigo.referenciaValorHora;
    const lido = normalizarLotesGuardados(antigo as ReturnType<typeof lotesIniciais>);
    expect(lido.referenciaValorHora.media).toHaveLength(TABELA_RATES_SPMS.length);
    const gravada = {
      fundamento: "ambos",
      media: [{ id: "m", perfil: "Tester", procedimentos: "1", propostas: 2, base: 30, maisAlta: 28, media: 25 }],
      adjudicados: [{ id: "a", perfil: "Tester", procedimento: "CP 1/2024", ano: 2024, valorHora: 26 }],
    };
    expect(normalizarReferenciaValorHora(JSON.parse(JSON.stringify(gravada)))).toEqual(gravada);
  });

  it("o fundamento da margem a 0 % acompanha a base", () => {
    expect(justificacaoPorOmissao(0)).toBe(JUSTIFICACAO_SEM_MARGEM);
    const adjudicado = justificacaoPorOmissao(0, "adjudicado");
    expect(adjudicado).toContain("valores hora adjudicados em procedimentos aquisitivos anteriores");
    expect(adjudicado).not.toContain("média das rates");
    const ambos = justificacaoPorOmissao(0, "ambos");
    expect(ambos).toContain("média das rates das propostas");
    expect(ambos).toContain("valores hora adjudicados");
    for (const t of [adjudicado, ambos]) expect(ehJustificacaoPorOmissao(t)).toBe(true);
  });
});
