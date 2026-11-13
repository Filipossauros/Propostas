import { describe, expect, it } from "vitest";
import {
  bibliotecaVazia,
  comNoOrcamento,
  comPedidoAlterado,
  comPedidoNovo,
  novoPedidoBolsa,
  novoPedidoLicenciamento,
  type Biblioteca,
  type PedidoNaBiblioteca,
} from "./biblioteca";
import { orcamentoComBiblioteca } from "./orcamentoDaBiblioteca";
import { comInterno, normalizarOrcamento, orcamentoInicial, valorDaUnidade, type OrcamentoUnidade } from "./vistaGeral";
import { pedidoLicenciamentoExemplo } from "./licenciamento";
import { LOTES_EXEMPLO, PERFIS_EXEMPLO, JUSTIFICACAO_EXEMPLO } from "./exemplo";
import { normalizarLotesGuardados } from "./lotes";
import {
  aplicarCenario,
  comHorasNoAno,
  comInternoMovido,
  comPessoas,
  comProjetoCortado,
  comValorHora,
  novoCenario,
  type Cenario,
} from "./cenarios";
import { alteradosDepois, aprovarCenario, desfazerUltimaAprovacao, previsaoDaAprovacao } from "./aprovacao";

const AGORA = "2026-11-13T10:00:00.000Z";

function biblioteca(margem = 0): Biblioteca {
  let b = bibliotecaVazia();
  const l = normalizarLotesGuardados(structuredClone(LOTES_EXEMPLO));
  l.margemPrudencial = margem;
  b = comPedidoNovo(
    b,
    novoPedidoBolsa({
      nomeProjeto: l.nomeProjeto,
      descricaoProjeto: l.descricaoProjeto,
      justificacao: JUSTIFICACAO_EXEMPLO,
      perfis: structuredClone(PERFIS_EXEMPLO),
      lotes: l,
    }),
  );
  b = comPedidoNovo(b, novoPedidoLicenciamento(pedidoLicenciamentoExemplo(2026)), false);
  return comNoOrcamento(
    b,
    b.pedidos.map((p) => p.id),
    true,
  );
}

/** O orçamento guardado com um cenário, e o cenário feito sobre o que se vê. */
function comCenario(b: Biblioteca, cortar: (c: Cenario, o: OrcamentoUnidade) => Cenario, outros = 0) {
  const visto = orcamentoComBiblioteca(orcamentoInicial(), b);
  const cenario = cortar(novoCenario("Cenário A"), visto);
  const extra = Array.from({ length: outros }, (_v, i) => novoCenario(`Outro ${i + 1}`));
  const guardado = orcamentoComBiblioteca({ ...orcamentoInicial(), cenarios: [cenario, ...extra] }, b, {
    manterFora: true,
  });
  return { guardado, cenario, visto: { ...visto, cenarios: [cenario, ...extra] } };
}

const bolsa = (b: Biblioteca) => b.pedidos[0] as Extract<PedidoNaBiblioteca, { tipo: "bolsa" }>;
const arred = (v: number) => Math.round(v * 100) / 100;

describe("aprovar um cenário", () => {
  it("o pedido cortado passa à versão 2 com as pessoas e as horas do cenário; o orçamento revisto é o cenário", () => {
    const b = biblioteca();
    const { guardado, cenario, visto } = comCenario(b, (c, o) => {
      const p = o.projetos[0];
      const e = p.entradas[0]; // Programador Sénior — Java: 2 elementos, 1760 h em 2026
      return comHorasNoAno(comPessoas(c, p, e, 1), p, e, 0, 1752);
    });
    const esperado = valorDaUnidade(aplicarCenario(visto, cenario));

    const r = aprovarCenario(guardado, b, cenario.id, AGORA);
    expect(r).not.toBeNull();
    const pedido = bolsa(r!.biblioteca);
    expect(pedido.versao).toBe(2);
    expect(pedido.atualizadoEm).toBe(AGORA);
    expect(pedido.historico).toHaveLength(1);
    expect(pedido.historico[0].nota).toContain("Cenário «Cenário A» aprovado");
    const java = pedido.dados.lotes.lotes[0].perfis[0];
    expect(java.nMinimoElementos).toBe(1);
    expect(java.horasPorAno[0]).toBe(1752);
    // O licenciamento não foi tocado.
    expect(r!.biblioteca.pedidos[1]).toEqual(b.pedidos[1]);

    const revisto = orcamentoComBiblioteca(r!.orcamento, r!.biblioteca);
    expect(arred(valorDaUnidade(revisto))).toBe(arred(esperado));
    expect(revisto.aprovacoes).toHaveLength(1);
    expect(revisto.cenarios.every((c) => c.arquivado === true)).toBe(true);
    expect(revisto.cenarios[0].aprovadoEm).toBe(AGORA);
  });

  it("um perfil sem elementos sai do lote; o lote vazio sai; o perfil que deixou de estar em lotes sai dos perfis", () => {
    const b = biblioteca();
    const { guardado, cenario } = comCenario(b, (c, o) => {
      const p = o.projetos[0];
      // Lote 2: Arquiteto de Integração e Engenheiro de Dados.
      return comPessoas(comPessoas(c, p, p.entradas[2], 0), p, p.entradas[3], 0);
    });
    const r = aprovarCenario(guardado, b, cenario.id, AGORA)!;
    const dados = bolsa(r.biblioteca).dados;
    expect(dados.lotes.lotes.map((l) => l.numero)).toEqual(["1"]);
    expect(dados.perfis.map((p) => p.id)).not.toContain("p3");
    expect(dados.perfis.map((p) => p.id)).not.toContain("p4");
    expect(dados.perfis.map((p) => p.id)).toContain("p1");
  });

  it("o valor hora do cenário volta ao pedido sem a margem prudencial", () => {
    const b = biblioteca(10);
    const { guardado, cenario } = comCenario(b, (c, o) => {
      const p = o.projetos[0];
      return comValorHora(c, p, p.entradas[0], 44); // no orçamento: 42 × 1,1 = 46,20
    });
    const r = aprovarCenario(guardado, b, cenario.id, AGORA)!;
    expect(bolsa(r.biblioteca).dados.lotes.lotes[0].perfis[0].valorHora).toBe(40);
  });

  it("um pedido cortado por inteiro sai do orçamento, sem mudar de versão nem de conteúdo", () => {
    const b = biblioteca();
    const { guardado, cenario } = comCenario(b, (c, o) => comProjetoCortado(c, o.projetos[1]));
    const previsao = previsaoDaAprovacao(orcamentoComBiblioteca(guardado, b), b, cenario);
    expect(previsao.pedidos.map((p) => p.efeito)).toEqual(["saiDoOrcamento"]);

    const r = aprovarCenario(guardado, b, cenario.id, AGORA)!;
    const lic = r.biblioteca.pedidos[1];
    expect([lic.noOrcamento, lic.versao]).toEqual([false, 1]);
    expect(lic.dados).toEqual(b.pedidos[1].dados);
    expect(orcamentoComBiblioteca(r.orcamento, r.biblioteca).projetos).toHaveLength(1);
  });

  it("os internos ficam no projeto para onde o cenário os moveu", () => {
    const b = biblioteca();
    let base = orcamentoComBiblioteca(orcamentoInicial(), b, { manterFora: true });
    base = comInterno(base, base.projetos[0].id, "Ana");
    const ana = base.projetos[0].internos[0];
    const cenario = comInternoMovido(novoCenario("Mover"), ana.id, base.projetos[0].nome, base.projetos[1].nome);
    const guardado = { ...base, cenarios: [cenario] };
    const r = aprovarCenario(guardado, b, cenario.id, AGORA)!;
    const revisto = orcamentoComBiblioteca(r.orcamento, r.biblioteca);
    expect(revisto.projetos[0].internos).toEqual([]);
    expect(revisto.projetos[1].internos.map((i) => i.nome)).toEqual(["Ana"]);
  });

  it("os outros cenários são arquivados", () => {
    const b = biblioteca();
    const { guardado, cenario } = comCenario(
      b,
      (c, o) => comPessoas(c, o.projetos[0], o.projetos[0].entradas[0], 1),
      2,
    );
    const previsao = previsaoDaAprovacao(orcamentoComBiblioteca(guardado, b), b, cenario);
    expect(previsao.outrosCenarios).toEqual(["Outro 1", "Outro 2"]);
    const r = aprovarCenario(guardado, b, cenario.id, AGORA)!;
    expect(r.orcamento.cenarios.map((c) => [c.nome, c.arquivado === true, c.aprovadoEm !== undefined])).toEqual([
      ["Cenário A", true, true],
      ["Outro 1", true, false],
      ["Outro 2", true, false],
    ]);
  });

  it("desfazer repõe os pedidos e o orçamento de antes; avisa se o pedido mudou depois", () => {
    const b = biblioteca();
    let base = orcamentoComBiblioteca(orcamentoInicial(), b, { manterFora: true });
    base = comInterno(base, base.projetos[0].id, "Rui");
    const p = orcamentoComBiblioteca(base, b).projetos[0];
    const cenario = comPessoas(novoCenario("A"), p, p.entradas[0], 1);
    const guardado = { ...base, cenarios: [cenario] };
    const r = aprovarCenario(guardado, b, cenario.id, AGORA)!;

    expect(alteradosDepois(r.orcamento.aprovacoes[0], r.biblioteca)).toEqual([]);
    const editada = comPedidoAlterado(r.biblioteca, b.pedidos[0].id, (x) => x, "2026-11-14T00:00:00.000Z");
    expect(alteradosDepois(r.orcamento.aprovacoes[0], editada)).toHaveLength(1);

    const d = desfazerUltimaAprovacao(r.orcamento, editada)!;
    expect(d.biblioteca.pedidos[0]).toEqual(b.pedidos[0]);
    expect(d.orcamento.aprovacoes).toEqual([]);
    expect(d.orcamento.cenarios).toEqual([cenario]);
    expect(orcamentoComBiblioteca(d.orcamento, d.biblioteca).projetos[0].internos.map((i) => i.nome)).toEqual(["Rui"]);
  });

  it("a aprovação sobrevive a guardar e ler o orçamento", () => {
    const b = biblioteca();
    const { guardado, cenario } = comCenario(b, (c, o) => comPessoas(c, o.projetos[0], o.projetos[0].entradas[0], 1));
    const r = aprovarCenario(guardado, b, cenario.id, AGORA)!;
    const lido = normalizarOrcamento(JSON.parse(JSON.stringify(r.orcamento)));
    expect(lido.aprovacoes).toEqual(r.orcamento.aprovacoes);
    expect(lido.cenarios).toEqual(r.orcamento.cenarios);
    const d = desfazerUltimaAprovacao(lido, r.biblioteca)!;
    expect(d.biblioteca.pedidos[0]).toEqual(b.pedidos[0]);
  });
});
