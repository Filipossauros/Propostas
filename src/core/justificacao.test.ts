import { describe, expect, it } from "vitest";
import {
  alineasDe,
  beneficiosDoProjeto,
  normalizarJustificacao,
  temJustificacao,
  validarJustificacao,
} from "./justificacao";
import { BENEFICIO_FIXO } from "./types";
import { importarPerfisJSON, perfisParaJSON } from "./perfil";
import { importarLotesJSON, lotesParaJSON } from "./lotes";
import { JUSTIFICACAO_EXEMPLO, LOTES_EXEMPLO, PERFIS_EXEMPLO } from "./exemplo";
import { itens } from "./fixtures";

describe("validarJustificacao", () => {
  it("exige pelo menos um benefício e um risco", () => {
    const erros = validarJustificacao({ beneficios: [], riscos: [] });

    expect(erros.map((e) => e.campo)).toEqual(["justificacao.beneficios", "justificacao.riscos"]);
  });

  it("não aceita linhas vazias nem repetidas", () => {
    const erros = validarJustificacao({ beneficios: itens("Poupança", " "), riscos: itens("Atraso", "Atraso") });

    expect(erros.map((e) => e.campo)).toEqual(["justificacao.beneficios[1].designacao", "justificacao.riscos[1].designacao"]);
    expect(erros[0].mensagem).toContain("benefício 2");
    expect(erros[1].mensagem).toBe('Risco repetido: "Atraso".');
  });

  it("aceita as duas listas preenchidas", () => {
    expect(validarJustificacao(JUSTIFICACAO_EXEMPLO)).toEqual([]);
  });
});

describe("benefício fixo", () => {
  it("fecha a lista dos benefícios, depois dos escritos", () => {
    const lista = beneficiosDoProjeto({ beneficios: itens("Um", "Dois"), riscos: [] });
    expect(lista.map((b) => b.designacao)).toEqual(["Um", "Dois", BENEFICIO_FIXO]);
  });

  it("não se guarda: um ficheiro que o traga escrito abre sem ele, para não sair duas vezes", () => {
    const lida = normalizarJustificacao({
      beneficios: [{ id: "x", designacao: `  ${BENEFICIO_FIXO}  ` }, { id: "y", designacao: "Outro" }],
      riscos: [],
    });
    expect(lida.beneficios.map((b) => b.designacao)).toEqual(["Outro"]);
  });

  it("não conta como benefício escrito: continua a pedir pelo menos um além dele", () => {
    const erros = validarJustificacao({ beneficios: [], riscos: itens("Atraso") });
    expect(erros.map((e) => e.campo)).toEqual(["justificacao.beneficios"]);
    expect(erros[0].mensagem).toContain("além do benefício de fecho");
  });
});

describe("alineasDe", () => {
  it("numera por letras e fecha a enumeração: ponto e vírgula, e ponto final na última", () => {
    expect(alineasDe(itens("Menos tempo de registo", "Dados partilhados", "Custos menores"))).toEqual([
      { marca: "a)", texto: "Menos tempo de registo;" },
      { marca: "b)", texto: "Dados partilhados;" },
      { marca: "c)", texto: "Custos menores." },
    ]);
  });

  it("troca a pontuação que a pessoa tenha posto no fim, e deixa as maiúsculas", () => {
    expect(alineasDe(itens("SClínico mais rápido.", "Menos erros;"))).toEqual([
      { marca: "a)", texto: "SClínico mais rápido;" },
      { marca: "b)", texto: "Menos erros." },
    ]);
  });

  it("salta as linhas em branco sem saltar letras", () => {
    expect(alineasDe(itens("Um", "  ", "Dois")).map((a) => a.marca)).toEqual(["a)", "b)"]);
  });
});

describe("a justificação viaja nos ficheiros", () => {
  it("no JSON dos perfis", () => {
    const lido = importarPerfisJSON(perfisParaJSON(PERFIS_EXEMPLO, "Projeto", "Descrição", JUSTIFICACAO_EXEMPLO));
    expect(lido.justificacao).toEqual(JUSTIFICACAO_EXEMPLO);
  });

  it("no JSON dos lotes", () => {
    expect(importarLotesJSON(lotesParaJSON(LOTES_EXEMPLO)).justificacao).toEqual(JUSTIFICACAO_EXEMPLO);
  });

  it("um ficheiro de antes destes campos abre com as duas listas vazias", () => {
    const { justificacao: _semJustificacao, ...antigo } = LOTES_EXEMPLO;
    const lido = importarLotesJSON(JSON.stringify(antigo));

    expect(lido.justificacao).toEqual({ beneficios: [], riscos: [] });
    expect(temJustificacao(lido.justificacao)).toBe(false);
  });

  it("aceita listas escritas como texto, uma entrada por linha", () => {
    const lida = normalizarJustificacao({ beneficios: "Um\nDois", riscos: ["Três"] });
    expect(lida.beneficios.map((b) => b.designacao)).toEqual(["Um", "Dois"]);
    expect(lida.riscos.map((r) => r.designacao)).toEqual(["Três"]);
  });
});
