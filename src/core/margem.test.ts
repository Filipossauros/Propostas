import { describe, expect, it } from "vitest";
import {
  comMargemPrudencial,
  ehJustificacaoPorOmissao,
  JUSTIFICACAO_SEM_MARGEM,
  justificacaoComMargem,
  justificacaoPorOmissao,
} from "./margem";
import { totalProcedimento } from "./lotes";
import { LOTES_EXEMPLO } from "./exemplo";

describe("comMargemPrudencial", () => {
  it("sem margem, devolve o próprio agrupamento", () => {
    expect(comMargemPrudencial(LOTES_EXEMPLO)).toBe(LOTES_EXEMPLO);
  });

  it("aplica a margem ao valor hora de cada perfil, ao cêntimo, e com ele ao preço base", () => {
    const com = comMargemPrudencial({ ...LOTES_EXEMPLO, margemPrudencial: 10 });
    expect(com.lotes.flatMap((l) => l.perfis.map((e) => e.valorHora))).toEqual([46.2, 41.8, 60.5, 49.5]);
    expect(totalProcedimento(com).semIva).toBeCloseTo(totalProcedimento(LOTES_EXEMPLO).semIva * 1.1, 2);
    // O agrupamento guardado não muda: a margem é aplicada a uma cópia.
    expect(LOTES_EXEMPLO.lotes[0].perfis[0].valorHora).toBe(42);
  });

  it("arredonda ao cêntimo", () => {
    const com = comMargemPrudencial({ ...LOTES_EXEMPLO, margemPrudencial: 3.333 });
    expect(com.lotes[0].perfis[0].valorHora).toBe(43.4);
  });
});

describe("fundamento por omissão", () => {
  it("tem um texto para 0 % e outro, com a percentagem, para as margens", () => {
    expect(justificacaoPorOmissao(0)).toBe(JUSTIFICACAO_SEM_MARGEM);
    expect(justificacaoPorOmissao(12.5)).toBe(justificacaoComMargem(12.5));
    expect(justificacaoComMargem(12.5)).toMatch(/^A margem prudencial de 12,5 %/);
  });

  it("reconhece os textos por omissão, e não um escrito à mão", () => {
    expect(ehJustificacaoPorOmissao(JUSTIFICACAO_SEM_MARGEM)).toBe(true);
    expect(ehJustificacaoPorOmissao(justificacaoComMargem(10))).toBe(true);
    expect(ehJustificacaoPorOmissao("")).toBe(true);
    expect(ehJustificacaoPorOmissao("A margem cobre a inflação prevista.")).toBe(false);
  });
});
