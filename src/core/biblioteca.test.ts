import { describe, expect, it } from "vitest";
import {
  CHAVES_DA_VERSAO_ANTERIOR,
  bibliotecaDaVersaoAnterior,
  bibliotecaParaJSON,
  bibliotecaVazia,
  comDadosBolsa,
  comDadosLicenciamento,
  comPedidoAberto,
  comPedidoAlterado,
  comPedidoNovo,
  estadoDoPedido,
  importarParaBiblioteca,
  nomeDoPedido,
  normalizarBiblioteca,
  novoPedidoBolsa,
  novoPedidoLicenciamento,
  pedidoAtivo,
  pedidoDuplicado,
  pedidoParaJSON,
  questoesDoPedido,
  resumoDoPedido,
  semPedido,
  valorEstimadoDoPedido,
  type Biblioteca,
  type DadosBolsa,
} from "./biblioteca";
import {
  DESCRICAO_PROJETO_EXEMPLO,
  JUSTIFICACAO_EXEMPLO,
  LOTES_EXEMPLO,
  NOME_PROJETO_EXEMPLO,
  PERFIS_EXEMPLO,
} from "./exemplo";
import { lotesParaJSON, normalizarLotesGuardados, totalProcedimento } from "./lotes";
import { comMargemPrudencial } from "./margem";
import { pedidoLicenciamentoExemplo, pedidoLicenciamentoParaJSON } from "./licenciamento";
import { ErroImportacao, perfisParaJSON } from "./perfil";

function bolsaExemplo(): DadosBolsa {
  return {
    nomeProjeto: NOME_PROJETO_EXEMPLO,
    descricaoProjeto: DESCRICAO_PROJETO_EXEMPLO,
    justificacao: structuredClone(JUSTIFICACAO_EXEMPLO),
    perfis: structuredClone(PERFIS_EXEMPLO),
    lotes: normalizarLotesGuardados(structuredClone(LOTES_EXEMPLO)),
  };
}

function comDois(): Biblioteca {
  let b = bibliotecaVazia();
  b = comPedidoNovo(b, novoPedidoBolsa(bolsaExemplo(), "2026-11-01T10:00:00.000Z"));
  b = comPedidoNovo(b, novoPedidoLicenciamento(pedidoLicenciamentoExemplo(2027), "2026-11-02T10:00:00.000Z"), false);
  return b;
}

describe("biblioteca — o que se diz de cada pedido", () => {
  it("nome, resumo, estado e valor estimado com a margem", () => {
    const [bolsa, lic] = comDois().pedidos;
    expect(nomeDoPedido(bolsa)).toBe(NOME_PROJETO_EXEMPLO);
    expect(resumoDoPedido(bolsa)).toMatch(/^\d+ lotes? · \d+ perfis?/);
    expect(resumoDoPedido(lic)).toBe("1 licença");
    expect(questoesDoPedido(lic)).toBe(0);
    expect(estadoDoPedido(lic)).toBe("pronto");
    expect(estadoDoPedido({ ...lic, versao: 2 })).toBe("revisto");
    expect(estadoDoPedido({ ...lic, arquivado: true })).toBe("arquivado");
    expect(estadoDoPedido(novoPedidoBolsa())).toBe("preparacao");
    if (bolsa.tipo !== "bolsa") throw new Error("tipo");
    expect(valorEstimadoDoPedido(bolsa)).toBe(totalProcedimento(comMargemPrudencial(bolsa.dados.lotes)).semIva);
    expect(valorEstimadoDoPedido(lic)).toBe(360_000);
    expect(valorEstimadoDoPedido(novoPedidoBolsa())).toBeNull();
  });
});

describe("biblioteca — alterações", () => {
  it("só se altera o pedido aberto, do tipo certo, e a data acompanha", () => {
    const b = comDois();
    const [bolsa, lic] = b.pedidos;
    expect(pedidoAtivo(b)?.id).toBe(bolsa.id);
    const alterada = comDadosBolsa(b, (d) => ({ ...d, nomeProjeto: "Outro" }));
    expect(nomeDoPedido(alterada.pedidos[0])).toBe("Outro");
    expect(alterada.pedidos[0].atualizadoEm).not.toBe(bolsa.atualizadoEm);
    expect(alterada.pedidos[1]).toBe(lic);
    // Com a bolsa aberta, alterar o licenciamento não faz nada.
    expect(comDadosLicenciamento(b, (d) => ({ ...d, nomeProduto: "X" }))).toBe(b);
    const outra = comDadosLicenciamento(comPedidoAberto(b, lic.id), (d) => ({ ...d, nomeProduto: "X" }));
    expect(nomeDoPedido(outra.pedidos[1])).toBe("X");
  });

  it("duplicar dá um pedido novo, versão 1, com «(cópia)»; apagar o aberto fecha-o", () => {
    const b = comDois();
    const copia = pedidoDuplicado({ ...b.pedidos[0], versao: 3, noOrcamento: true });
    expect(copia.id).not.toBe(b.pedidos[0].id);
    expect([copia.versao, copia.noOrcamento]).toEqual([1, false]);
    expect(nomeDoPedido(copia)).toBe(`${NOME_PROJETO_EXEMPLO} (cópia)`);
    if (copia.tipo !== "bolsa") throw new Error("tipo");
    expect(copia.dados.lotes.nomeProjeto).toBe(`${NOME_PROJETO_EXEMPLO} (cópia)`);
    const sem = semPedido(b, b.pedidos[0].id);
    expect([sem.pedidos.length, sem.ativoId]).toEqual([1, null]);
    expect(comPedidoAberto(b, "nao-existe").ativoId).toBeNull();
  });
});

describe("biblioteca — guardar, ler e migrar", () => {
  it("vai e vem em JSON, e o que não se reconhece fica de fora", () => {
    const b = comPedidoAlterado(comDois(), comDois().pedidos[0].id, (p) => p);
    const lida = normalizarBiblioteca(JSON.parse(JSON.stringify({ ...b, pedidos: [...b.pedidos, { tipo: "xpto" }] })));
    expect(lida.pedidos.map((p) => p.tipo)).toEqual(["bolsa", "licenciamento"]);
    expect(lida.ativoId).toBe(b.ativoId);
    expect(lida.pedidos[1]).toEqual(b.pedidos[1]);
  });

  it("a primeira abertura copia os pedidos da versão anterior, sem os apagar", () => {
    const guardado: Record<string, unknown> = {
      [CHAVES_DA_VERSAO_ANTERIOR.nomeProjeto]: NOME_PROJETO_EXEMPLO,
      [CHAVES_DA_VERSAO_ANTERIOR.descricaoProjeto]: DESCRICAO_PROJETO_EXEMPLO,
      [CHAVES_DA_VERSAO_ANTERIOR.justificacao]: JUSTIFICACAO_EXEMPLO,
      [CHAVES_DA_VERSAO_ANTERIOR.perfis]: PERFIS_EXEMPLO,
      [CHAVES_DA_VERSAO_ANTERIOR.lotes]: LOTES_EXEMPLO,
      [CHAVES_DA_VERSAO_ANTERIOR.licenciamento]: JSON.parse(pedidoLicenciamentoParaJSON(pedidoLicenciamentoExemplo(2027))),
    };
    const lidas: string[] = [];
    const b = bibliotecaDaVersaoAnterior((chave) => {
      lidas.push(chave);
      return guardado[chave] ?? null;
    });
    expect(b.pedidos.map((p) => [p.tipo, nomeDoPedido(p)])).toEqual([
      ["bolsa", NOME_PROJETO_EXEMPLO],
      ["licenciamento", "SNOMED CT"],
    ]);
    expect(pedidoAtivo(b)?.tipo).toBe("bolsa");
    expect(lidas.every((c) => c.startsWith("propostas.v2."))).toBe(true);
    // Sem nada guardado, a biblioteca começa vazia.
    expect(bibliotecaDaVersaoAnterior(() => null).pedidos).toEqual([]);
  });

  it("o licenciamento antigo sem produto herda o projeto, como antes", () => {
    const lic = pedidoLicenciamentoExemplo(2027);
    const b = bibliotecaDaVersaoAnterior((chave) =>
      chave === CHAVES_DA_VERSAO_ANTERIOR.licenciamento
        ? JSON.parse(pedidoLicenciamentoParaJSON({ ...lic, nomeProduto: "" }))
        : chave === CHAVES_DA_VERSAO_ANTERIOR.nomeProjeto
          ? "Projeto antigo"
          : null,
    );
    expect(b.pedidos.map((p) => nomeDoPedido(p))).toEqual(["Projeto antigo", "Projeto antigo"]);
  });
});

describe("biblioteca — importar", () => {
  it("um pedido de bolsa exportado volta igual", () => {
    const p = novoPedidoBolsa(bolsaExemplo());
    const r = importarParaBiblioteca(bibliotecaVazia(), pedidoParaJSON(p));
    expect(r.acrescentados).toEqual([NOME_PROJETO_EXEMPLO]);
    expect(r.biblioteca.pedidos[0].dados).toEqual(p.dados);
    expect(r.biblioteca.ativoId).toBeNull();
  });

  it("um agrupamento de lotes dá um pedido de bolsa com os perfis dos lotes", () => {
    const r = importarParaBiblioteca(bibliotecaVazia(), lotesParaJSON(normalizarLotesGuardados(structuredClone(LOTES_EXEMPLO))));
    const p = r.biblioteca.pedidos[0];
    if (p.tipo !== "bolsa") throw new Error("tipo");
    const ids = new Set(LOTES_EXEMPLO.lotes.flatMap((l) => l.perfis.map((e) => e.perfil.id)));
    expect(p.dados.perfis.map((x) => x.id).sort()).toEqual([...ids].sort());
  });

  it("um ficheiro de perfis e um pedido de licenciamento entram como pedidos novos", () => {
    const perfis = perfisParaJSON(PERFIS_EXEMPLO, "Perfis soltos", "", JUSTIFICACAO_EXEMPLO);
    const r1 = importarParaBiblioteca(bibliotecaVazia(), perfis);
    expect(r1.biblioteca.pedidos[0].tipo).toBe("bolsa");
    expect(nomeDoPedido(r1.biblioteca.pedidos[0])).toBe("Perfis soltos");
    const r2 = importarParaBiblioteca(r1.biblioteca, pedidoLicenciamentoParaJSON(pedidoLicenciamentoExemplo(2027)));
    expect(r2.biblioteca.pedidos.map((p) => p.tipo)).toEqual(["bolsa", "licenciamento"]);
  });

  it("uma biblioteca descarregada acrescenta os novos e substitui os que já cá estão", () => {
    const b = comDois();
    const ficheiro = bibliotecaParaJSON(comDadosBolsa(b, (d) => ({ ...d, nomeProjeto: "Renomeado" })));
    const destino = semPedido(b, b.pedidos[1].id);
    const r = importarParaBiblioteca(destino, ficheiro);
    expect(r.atualizados).toEqual(["Renomeado"]);
    expect(r.acrescentados).toEqual(["SNOMED CT"]);
    expect(r.biblioteca.pedidos.map((p) => nomeDoPedido(p))).toEqual(["Renomeado", "SNOMED CT"]);
  });

  it("recusa o que não é JSON ou não é de um tipo conhecido", () => {
    expect(() => importarParaBiblioteca(bibliotecaVazia(), "{")).toThrow(ErroImportacao);
    expect(() => importarParaBiblioteca(bibliotecaVazia(), JSON.stringify({ tipo: "orcamentoUnidade" }))).toThrow(
      /orcamentoUnidade/,
    );
  });
});

describe("biblioteca — migração do orçamento", () => {
  it("os pedidos que estavam no orçamento anterior entram marcados", () => {
    const b = bibliotecaDaVersaoAnterior((chave) =>
      chave === CHAVES_DA_VERSAO_ANTERIOR.nomeProjeto
        ? NOME_PROJETO_EXEMPLO
        : chave === CHAVES_DA_VERSAO_ANTERIOR.licenciamento
          ? JSON.parse(pedidoLicenciamentoParaJSON(pedidoLicenciamentoExemplo(2027)))
          : chave === CHAVES_DA_VERSAO_ANTERIOR.vistaGeral
            ? { tipo: "orcamentoUnidade", projetos: [{ nome: NOME_PROJETO_EXEMPLO }] }
            : null,
    );
    expect(b.pedidos.map((p) => [nomeDoPedido(p), p.noOrcamento])).toEqual([
      [NOME_PROJETO_EXEMPLO, true],
      ["SNOMED CT", false],
    ]);
  });
});
