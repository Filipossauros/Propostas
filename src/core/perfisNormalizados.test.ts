import { describe, expect, it } from "vitest";
import { PERFIS_NORMALIZADOS } from "./perfisNormalizados";
import { criarPerfilEmLote } from "./lotes";
import { perfilInicial, validarPerfis } from "./perfil";
import { MESES_POR_ANO } from "./types";

describe("PERFIS_NORMALIZADOS", () => {
  it("traz os nove perfis do catálogo, sem o perfil 9, que não existe", () => {
    expect(PERFIS_NORMALIZADOS.map((p) => p.perfil)).toEqual([
      "Arquiteto de Sistemas",
      "Fullstack",
      "Backend / Integração de Sistemas",
      "Frontend",
      "Consultor de Administração de Sistemas",
      "Tester",
      "Analista Funcional",
      "Gestor de Projeto",
      "UX Designer",
    ]);
  });

  it("está pronto a usar: passa a validação do Módulo 1 sem retoques", () => {
    expect(validarPerfis(PERFIS_NORMALIZADOS)).toEqual([]);
  });

  it("as exigências vêm em anos completos, como a interface e o caderno de encargos exigem", () => {
    for (const perfil of PERFIS_NORMALIZADOS) {
      for (const requisito of perfil.requisitos) {
        expect(requisito.mesesMinimos % MESES_POR_ANO, `${perfil.perfil} · ${requisito.designacao}`).toBe(0);
      }
    }
  });

  it("os identificadores são estáveis e únicos, para o recarregamento atualizar em vez de duplicar", () => {
    const ids = PERFIS_NORMALIZADOS.map((p) => p.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("pn1");
    // Também dentro de cada perfil: requisitos e atividades são editáveis um a um.
    const internos = PERFIS_NORMALIZADOS.flatMap((p) => [
      ...p.requisitos.map((r) => r.id),
      ...p.conteudoFuncional.map((a) => a.id),
    ]);
    expect(new Set(internos).size).toBe(internos.length);
  });

  it("nenhum exige certificação — isso é matéria de cada procedimento", () => {
    expect(PERFIS_NORMALIZADOS.every((p) => p.certificacoes.length === 0)).toBe(true);
  });

  it("o requisito nuclear de cada perfil segue a escala padronizada", () => {
    const maisExigente = Object.fromEntries(
      PERFIS_NORMALIZADOS.map((p) => [p.perfil, Math.max(...p.requisitos.map((r) => r.mesesMinimos))]),
    );

    expect(maisExigente["Arquiteto de Sistemas"]).toBe(72);
    expect(maisExigente["Gestor de Projeto"]).toBe(60);
    expect(maisExigente["Tester"]).toBe(36);
    expect(maisExigente["Frontend"]).toBe(24);
  });
});

describe("preço/hora", () => {
  it("o catálogo não fixa preço: entra a zero, para ser escrito no procedimento", () => {
    expect(criarPerfilEmLote(PERFIS_NORMALIZADOS[0]).valorHora).toBe(0);
    expect(criarPerfilEmLote(perfilInicial()).valorHora).toBe(0);
  });
});
