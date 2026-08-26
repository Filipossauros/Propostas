import { describe, expect, it } from "vitest";
import { PERFIS_NORMALIZADOS } from "./perfisNormalizados";
import { criarPerfilEmLote } from "./lotes";
import { perfilInicial, validarPerfis } from "./perfil";
import { MESES_POR_ANO } from "./types";

describe("PERFIS_NORMALIZADOS", () => {
  it("traz os dez perfis do catálogo, sem o perfil 9, que não existe", () => {
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
      "Consultor Especialista da Plataforma ATLAS",
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

  it("só o perfil da plataforma ATLAS exige formação, e é a do fornecedor", () => {
    const comFormacao = PERFIS_NORMALIZADOS.filter((p) => p.certificacoes.length > 0);

    expect(comFormacao.map((p) => p.perfil)).toEqual(["Consultor Especialista da Plataforma ATLAS"]);
    expect(comFormacao[0].certificacoes[0].designacao).toBe(
      "Formação comprovada ou certificada pelo fornecedor da solução de arquitetura empresarial ATLAS, " +
        "na versão X ou superior",
    );
  });

  it("o perfil da plataforma ATLAS traz o que lhe foi definido", () => {
    const atlas = PERFIS_NORMALIZADOS.find((p) => p.perfil === "Consultor Especialista da Plataforma ATLAS")!;

    expect(atlas.requisitos.map((r) => [r.designacao, r.mesesMinimos])).toEqual([
      ["Modelação de processos de negócio, designadamente em notação BPMN ou equivalente", 12],
      ["Configuração da solução de arquitetura empresarial ATLAS, na versão X ou superior", 12],
    ]);
    expect(atlas.conteudoFuncional).toHaveLength(6);
    expect(atlas.conteudoFuncional[0].designacao).toBe("Mapeamento de conceitos arquiteturais na solução ATLAS");
    expect(atlas.conteudoFuncional[5].designacao).toBe("Configuração de repositórios na solução ATLAS");
  });

  it("o requisito nuclear de cada perfil segue a escala padronizada", () => {
    const maisExigente = Object.fromEntries(
      PERFIS_NORMALIZADOS.map((p) => [p.perfil, Math.max(...p.requisitos.map((r) => r.mesesMinimos))]),
    );

    expect(maisExigente["Arquiteto de Sistemas"]).toBe(72);
    expect(maisExigente["Gestor de Projeto"]).toBe(60);
    expect(maisExigente["Tester"]).toBe(36);
    expect(maisExigente["Frontend"]).toBe(24);
    expect(maisExigente["Consultor Especialista da Plataforma ATLAS"]).toBe(12);
  });
});

describe("preço/hora", () => {
  it("o catálogo não fixa preço: entra a zero, para ser escrito no procedimento", () => {
    expect(criarPerfilEmLote(PERFIS_NORMALIZADOS[0]).valorHora).toBe(0);
    expect(criarPerfilEmLote(perfilInicial()).valorHora).toBe(0);
  });
});
