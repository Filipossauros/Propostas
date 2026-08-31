import { describe, expect, it } from "vitest";
import {
  DIAS_DE_FERIADO_MUNICIPAL,
  DIAS_DE_FERIAS,
  HORAS_POR_DIA,
  diasDeSemana,
  domingoDePascoa,
  feriadosEmDiaUtil,
  feriadosNacionais,
  horasUteis,
  horasUteisDoAno,
} from "./horasUteis";

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("domingoDePascoa", () => {
  it("dá as datas conhecidas", () => {
    expect(iso(domingoDePascoa(2025))).toBe("2025-04-20");
    expect(iso(domingoDePascoa(2026))).toBe("2026-04-05");
    expect(iso(domingoDePascoa(2027))).toBe("2027-03-28");
    expect(iso(domingoDePascoa(2028))).toBe("2028-04-16");
  });

  it("cai sempre a um domingo", () => {
    for (let ano = 2020; ano <= 2060; ano++) expect(domingoDePascoa(ano).getUTCDay()).toBe(0);
  });
});

describe("feriadosNacionais", () => {
  it("são os treze do Código do Trabalho", () => {
    expect(feriadosNacionais(2026)).toHaveLength(13);
  });

  it("levam os fixos e os que se contam a partir da Páscoa", () => {
    const datas = feriadosNacionais(2026).map(iso);

    // Fixos.
    for (const d of ["2026-01-01", "2026-04-25", "2026-05-01", "2026-06-10", "2026-08-15", "2026-10-05",
                     "2026-11-01", "2026-12-01", "2026-12-08", "2026-12-25"]) {
      expect(datas).toContain(d);
    }
    // Móveis: Sexta-feira Santa (Páscoa − 2) e Corpo de Deus (Páscoa + 60).
    expect(datas).toContain("2026-04-03");
    expect(datas).toContain("2026-04-05");
    expect(datas).toContain("2026-06-04");
  });

  it("não leva o Carnaval nem feriados municipais", () => {
    // O Carnaval é 47 dias antes da Páscoa: 17 de fevereiro em 2026.
    expect(feriadosNacionais(2026).map(iso)).not.toContain("2026-02-17");
    // 13 de junho é o feriado municipal de Lisboa.
    expect(feriadosNacionais(2026).map(iso)).not.toContain("2026-06-13");
  });

  it("os que caem ao fim de semana não contam para o trabalho", () => {
    // Em 2026: 25 de abril é sábado, 15 de agosto é sábado, 1 de novembro é
    // domingo, e o Domingo de Páscoa é sempre domingo.
    const uteis = feriadosEmDiaUtil(2026).map(iso);
    expect(uteis).toHaveLength(9);
    for (const d of ["2026-04-25", "2026-08-15", "2026-11-01", "2026-04-05"]) expect(uteis).not.toContain(d);
  });
});

describe("diasDeSemana", () => {
  it("conta os dias de segunda a sexta do ano civil", () => {
    expect(diasDeSemana(2026)).toBe(261);
    expect(diasDeSemana(2027)).toBe(261);
    // 2028 é bissexto.
    expect(diasDeSemana(2028)).toBe(260);
  });

  it("nunca conta sábados nem domingos", () => {
    // 52 semanas dão 260 dias de semana; o resto do ano acrescenta 0, 1 ou 2.
    for (let ano = 2020; ano <= 2040; ano++) {
      expect(diasDeSemana(ano)).toBeGreaterThanOrEqual(260);
      expect(diasDeSemana(ano)).toBeLessThanOrEqual(262);
    }
  });
});

describe("horasUteisDoAno", () => {
  it("desconta feriados, férias e o feriado municipal, a oito horas por dia", () => {
    const c = horasUteisDoAno(2026);

    expect(c).toEqual({
      ano: 2026,
      diasDeSemana: 261,
      feriados: 9,
      diasUteis: 252,
      ferias: 22,
      municipal: 1,
      diasTrabalhados: 229,
      horasPorDia: 8,
      horas: 1832,
    });
  });

  it("o feriado municipal vale um dia de trabalho — oito horas a menos", () => {
    for (let ano = 2024; ano <= 2035; ano++) {
      const c = horasUteisDoAno(ano);
      const semMunicipal = (c.diasUteis - c.ferias) * c.horasPorDia;
      expect(semMunicipal - c.horas).toBe(HORAS_POR_DIA);
    }
  });

  it("as parcelas fecham entre si, em qualquer ano", () => {
    for (let ano = 2024; ano <= 2035; ano++) {
      const c = horasUteisDoAno(ano);
      expect(c.diasUteis).toBe(c.diasDeSemana - c.feriados);
      expect(c.diasTrabalhados).toBe(c.diasUteis - DIAS_DE_FERIAS - DIAS_DE_FERIADO_MUNICIPAL);
      expect(c.horas).toBe(c.diasTrabalhados * HORAS_POR_DIA);
      expect(horasUteis(ano)).toBe(c.horas);
    }
  });

  it("um ano dá sempre entre 1800 e 1870 horas", () => {
    // O intervalo é estreito por construção: o que varia é quantos feriados
    // calham ao fim de semana. Serve de rede a um erro grosseiro no cálculo.
    for (let ano = 2024; ano <= 2040; ano++) {
      expect(horasUteis(ano)).toBeGreaterThanOrEqual(1800);
      expect(horasUteis(ano)).toBeLessThanOrEqual(1870);
    }
  });
});
