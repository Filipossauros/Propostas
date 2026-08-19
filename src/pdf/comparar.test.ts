import { describe, expect, it } from "vitest";
import { compararComPdf } from "./comparar";
import { extrairValoresDeclarados } from "./extrairValores";
import { normalizarTexto } from "./normalizar";
import type { Bloco, Declaracao, LinhaRequisito, MesAno } from "../core/types";

function ma(ano: number, mes: number): MesAno {
  return { ano, mes };
}

function linha(opts: Partial<LinhaRequisito> = {}): LinhaRequisito {
  return { requisitoId: "r1", declara: "SIM", inicio: null, fim: null, ...opts };
}

function bloco(opts: Partial<Bloco> = {}): Bloco {
  return {
    indice: 1,
    cliente: "Cliente ACME",
    projeto: "Projeto Alfa",
    funcao: "Arquiteto de software",
    projInicio: ma(2020, 3),
    projFim: ma(2022, 12),
    emCurso: null,
    linhas: [linha()],
    ...opts,
  };
}

function declaracao(opts: Partial<Declaracao> = {}): Declaracao {
  return {
    id: "decl-1",
    ficheiro: "teste.xlsx",
    identificacao: {
      nome: "João Silva",
      documento: "123",
      entidadeConcorrente: "ABC, Lda.",
      procedimento: "20270001",
      perfil: "Perfil",
    },
    blocos: [bloco()],
    alertas: [],
    ...opts,
  };
}

const requisitosPorId = new Map([["r1", "Requisito 1"]]);

function pdfCoerenteCom(declaracaoTeste: Declaracao): string {
  const identificacao = declaracaoTeste.identificacao;
  const b = declaracaoTeste.blocos[0];
  return normalizarTexto(
    `Declaração de experiência profissional. Nome: ${identificacao.nome}. Entidade: ${identificacao.entidadeConcorrente}. ` +
      `Cliente: ${b.cliente}. Projeto: ${b.projeto}. Função: ${b.funcao}. ` +
      `Início: 03/2020 Fim: 12/2022. Declara experiência? SIM.`,
  );
}

describe("compararComPdf", () => {
  it("não gera alertas quando o PDF confirma tudo o que o Excel declara", () => {
    const d = declaracao();
    const valores = extrairValoresDeclarados(d);
    const alertas = compararComPdf(valores, pdfCoerenteCom(d), requisitosPorId);
    expect(alertas).toHaveLength(0);
  });

  it("assinala divergência quando a resposta SIM/NÃO não está confirmada no PDF", () => {
    const d = declaracao();
    const valores = extrairValoresDeclarados(d);
    const textoPdf = normalizarTexto("Nome: João Silva. Entidade: ABC, Lda. Cliente: Cliente ACME. Projeto: Projeto Alfa. Função: Arquiteto de software. 03/2020 12/2022. Declara experiência? NÃO.");
    const alertas = compararComPdf(valores, textoPdf, requisitosPorId);
    expect(alertas.some((a) => a.tipo === "divergenciaPdf" && a.mensagem.includes("SIM"))).toBe(true);
  });

  it("assinala divergência quando uma data declarada não aparece no PDF", () => {
    const d = declaracao();
    const valores = extrairValoresDeclarados(d);
    const textoPdf = normalizarTexto("Nome: João Silva. Entidade: ABC, Lda. Cliente: Cliente ACME. Projeto: Projeto Alfa. Início: 01/2019 Fim: 12/2022. SIM.");
    const alertas = compararComPdf(valores, textoPdf, requisitosPorId);
    expect(alertas.some((a) => a.mensagem.includes("03/2020"))).toBe(true);
  });

  it("aceita datas sem zero à esquerda no mês como equivalentes", () => {
    const d = declaracao({ blocos: [bloco({ projInicio: ma(2020, 3), projFim: ma(2022, 9) })] });
    const valores = extrairValoresDeclarados(d);
    const textoPdf = normalizarTexto("Nome: João Silva. Entidade: ABC, Lda. Cliente: Cliente ACME. Projeto: Projeto Alfa. Função: Arquiteto de software. Início: 3/2020 Fim: 9/2022. SIM.");
    const alertas = compararComPdf(valores, textoPdf, requisitosPorId);
    expect(alertas.filter((a) => a.mensagem.includes("2020") || a.mensagem.includes("2022"))).toHaveLength(0);
  });

  it("assinala divergência quando um texto declarado não aparece no PDF", () => {
    const d = declaracao();
    const valores = extrairValoresDeclarados(d);
    const textoPdf = normalizarTexto("Nome: João Silva. Entidade: ABC, Lda. Início: 03/2020 Fim: 12/2022. SIM.");
    const alertas = compararComPdf(valores, textoPdf, requisitosPorId);
    expect(alertas.some((a) => a.mensagem.includes("CLIENTE ACME"))).toBe(true);
  });
});
