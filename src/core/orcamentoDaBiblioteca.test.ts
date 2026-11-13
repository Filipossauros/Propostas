import { describe, expect, it } from "vitest";
import {
  bibliotecaVazia,
  comNoOrcamento,
  comPedidoAlterado,
  comPedidoNovo,
  novoPedidoBolsa,
  novoPedidoLicenciamento,
  type Biblioteca,
} from "./biblioteca";
import { orcamentoComBiblioteca, projetoDeLicenciamento, projetoDoPedido } from "./orcamentoDaBiblioteca";
import {
  comInterno,
  orcamentoInicial,
  pessoasDoProjeto,
  projetoDeAgrupamento,
  valorDoProjeto,
  type OrcamentoUnidade,
} from "./vistaGeral";
import { comMargemLicenciamento, pedidoLicenciamentoExemplo, valorEstimado } from "./licenciamento";
import { LOTES_EXEMPLO, PERFIS_EXEMPLO, JUSTIFICACAO_EXEMPLO } from "./exemplo";
import { normalizarLotesGuardados, totalProcedimento } from "./lotes";
import { comMargemPrudencial } from "./margem";
import { aplicarCenario, comPessoas, novoCenario } from "./cenarios";

function lotes() {
  return normalizarLotesGuardados(structuredClone(LOTES_EXEMPLO));
}

function biblioteca(): Biblioteca {
  let b = bibliotecaVazia();
  const l = lotes();
  b = comPedidoNovo(
    b,
    novoPedidoBolsa({
      nomeProjeto: l.nomeProjeto,
      descricaoProjeto: l.descricaoProjeto,
      justificacao: JUSTIFICACAO_EXEMPLO,
      perfis: PERFIS_EXEMPLO,
      lotes: l,
    }),
  );
  b = comPedidoNovo(b, novoPedidoLicenciamento(pedidoLicenciamentoExemplo(2027)), false);
  return comNoOrcamento(b, b.pedidos.map((p) => p.id), true);
}

const arred = (v: number) => Math.round(v * 100) / 100;

describe("orçamento a partir da biblioteca", () => {
  it("um pedido de licenciamento dá uma linha por licença, com margem e IVA, e sem pessoas", () => {
    const pedido = pedidoLicenciamentoExemplo(2027);
    const projeto = { ...projetoDeLicenciamento(pedido), id: "x" };
    expect(projeto.nome).toBe("SNOMED CT");
    expect(projeto.entradas.map((e) => [e.tipo, e.pessoas])).toEqual([["licenca", 0]]);
    expect(projeto.entradas[0].quantidadePorExtenso).toContain("licença nacional");
    const comMargem = comMargemLicenciamento(pedido);
    expect(arred(valorDoProjeto(projeto))).toBe(arred(valorEstimado(comMargem) * (1 + pedido.taxaIva / 100)));
    expect(pessoasDoProjeto(projeto)).toBe(0);
  });

  it("um pedido de bolsa dá o mesmo que o agrupamento, com o identificador do pedido", () => {
    const b = biblioteca();
    const projeto = projetoDoPedido(b.pedidos[0]);
    expect([projeto.id, projeto.pedidoId, projeto.tipoPedido]).toEqual([b.pedidos[0].id, b.pedidos[0].id, "bolsa"]);
    const base = projetoDeAgrupamento(lotes());
    expect(arred(valorDoProjeto(projeto))).toBe(arred(valorDoProjeto(base)));
    expect(arred(valorDoProjeto(projeto))).toBe(arred(totalProcedimento(comMargemPrudencial(lotes())).comIva));
  });

  it("só os marcados e não arquivados entram; um pedido alterado altera o orçamento", () => {
    let b = biblioteca();
    expect(orcamentoComBiblioteca(orcamentoInicial(), b).projetos.map((p) => p.nome)).toEqual([
      lotes().nomeProjeto,
      "SNOMED CT",
    ]);
    b = comPedidoAlterado(b, b.pedidos[1].id, (p) => ({ ...p, arquivado: true }));
    expect(orcamentoComBiblioteca(orcamentoInicial(), b).projetos).toHaveLength(1);
    b = comPedidoAlterado(b, b.pedidos[0].id, (p) =>
      p.tipo === "bolsa" ? { ...p, dados: { ...p.dados, nomeProjeto: "Outro nome" } } : p,
    );
    expect(orcamentoComBiblioteca(orcamentoInicial(), b).projetos[0].nome).toBe("Outro nome");
  });

  it("os internos ficam guardados quando o pedido sai do orçamento, e voltam com ele", () => {
    const b = biblioteca();
    const id = b.pedidos[0].id;
    let guardado: OrcamentoUnidade = orcamentoComBiblioteca(orcamentoInicial(), b, { manterFora: true });
    guardado = comInterno(guardado, id, "Ana");
    const fora = comNoOrcamento(b, [id], false);
    // Fora do orçamento: não se mostra, mas o guardado mantém-no.
    expect(orcamentoComBiblioteca(guardado, fora).projetos.map((p) => p.id)).not.toContain(id);
    guardado = orcamentoComBiblioteca(guardado, fora, { manterFora: true });
    expect(guardado.projetos.find((p) => p.id === id)?.internos.map((i) => i.nome)).toEqual(["Ana"]);
    // De volta: os internos acompanham.
    const deVolta = orcamentoComBiblioteca(guardado, b);
    expect(deVolta.projetos.find((p) => p.id === id)?.internos.map((i) => i.nome)).toEqual(["Ana"]);
  });

  it("um projeto importado antes da biblioteca passa a ser do pedido com o mesmo nome, com os internos", () => {
    const b = biblioteca();
    const importado = { ...projetoDeAgrupamento(lotes()), id: "antigo" };
    const solto = { ...projetoDeAgrupamento({ ...lotes(), nomeProjeto: "Sem pedido" }), id: "solto" };
    const guardado = comInterno({ ...orcamentoInicial(), projetos: [importado, solto] }, "antigo", "Rui");
    const efetivo = orcamentoComBiblioteca(guardado, b);
    expect(efetivo.projetos.map((p) => [p.id, p.pedidoId ?? null])).toEqual([
      ["antigo", b.pedidos[0].id],
      ["solto", null],
      [b.pedidos[1].id, b.pedidos[1].id],
    ]);
    expect(efetivo.projetos[0].internos.map((i) => i.nome)).toEqual(["Rui"]);
  });

  it("num cenário, a licença mantém o valor (os seus cortes chegam depois)", () => {
    const o = orcamentoComBiblioteca(orcamentoInicial(), biblioteca());
    const [bolsa, lic] = o.projetos;
    const cenario = comPessoas(novoCenario("Corte"), bolsa, bolsa.entradas[0], 0);
    const depois = aplicarCenario(o, cenario);
    expect(valorDoProjeto(depois.projetos[1])).toBe(valorDoProjeto(lic));
    expect(valorDoProjeto(depois.projetos[0])).toBeLessThan(valorDoProjeto(bolsa));
  });
});

describe("orçamento antigo e biblioteca", () => {
  it("o projeto importado com o nome de um pedido desmarcado sai com ele, e fica guardado", () => {
    const b = comNoOrcamento(biblioteca(), [], true);
    const desmarcada = comNoOrcamento(b, [b.pedidos[0].id], false);
    const importado = { ...projetoDeAgrupamento(lotes()), id: "antigo" };
    const guardado = comInterno({ ...orcamentoInicial(), projetos: [importado] }, "antigo", "Rui");
    expect(orcamentoComBiblioteca(guardado, desmarcada).projetos.map((p) => p.id)).toEqual([b.pedidos[1].id]);
    const posto = orcamentoComBiblioteca(guardado, desmarcada, { manterFora: true });
    expect(posto.projetos[0]).toMatchObject({ id: "antigo", pedidoId: b.pedidos[0].id });
    expect(orcamentoComBiblioteca(posto, b).projetos[0].internos.map((i) => i.nome)).toEqual(["Rui"]);
  });
});
