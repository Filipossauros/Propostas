import { describe, expect, it } from "vitest";
import {
  anosDoPedido,
  comAlteracao,
  comMargemLicenciamento,
  comNatureza,
  criarProduto,
  ehJustificacaoMargemPorOmissao,
  importarPedidoLicenciamentoJSON,
  justificacaoMargemLicenciamento,
  lotesEfetivos,
  mesesPorAno,
  moverProdutoParaLote,
  nomeProcedimentoLicenciamento,
  pedidoLicenciamentoExemplo,
  pedidoLicenciamentoInicial,
  pedidoLicenciamentoParaJSON,
  validarCondicoes,
  validarLicencas,
  validarPedido,
  valorDoProduto,
  valorEstimado,
  valorPorAno,
  valoresDosLotes,
  condicoesIniciais,
} from "./licenciamento";

describe("licenciamento — cálculos", () => {
  it("subscrição: quantidade × preço/mês × meses, repartida pelos anos", () => {
    const p = { ...criarProduto(), quantidade: 1200, precoUnitario: 14.5, periodoMeses: 36 };
    const v = valorDoProduto(p, 3);
    expect(v.total).toBe(626_400);
    expect(v.porAno).toEqual([208_800, 208_800, 208_800]);
  });

  it("subscrição sem anos bastantes: o resto cabe no último ano", () => {
    const p = { ...criarProduto(), quantidade: 10, precoUnitario: 10, periodoMeses: 18 };
    expect(valorDoProduto(p, 1).porAno).toEqual([1800]);
  });

  it("perpétua com manutenção à parte: licenças no 1.º ano e manutenção anual", () => {
    const p = {
      ...criarProduto(),
      direitoUso: "perpetuo" as const,
      manutencao: "aParte" as const,
      percentagemManutencao: 22,
      quantidade: 64,
      precoUnitario: 1900,
      periodoMeses: 36,
    };
    const v = valorDoProduto(p, 3);
    expect(v.licencas).toBe(121_600);
    expect(v.manutencaoAnual).toBe(26_752);
    expect(v.total).toBe(121_600 + 3 * 26_752);
    expect(v.porAno).toEqual([148_352, 26_752, 26_752]);
  });

  it("meses por ano a partir de janeiro", () => {
    expect(mesesPorAno(30, 3)).toEqual([12, 12, 6]);
    expect(mesesPorAno(6, 1)).toEqual([6]);
  });

  it("o exemplo: valor estimado por produto, por ano e por lote", () => {
    const pedido = pedidoLicenciamentoExemplo(2027);
    expect(anosDoPedido(pedido)).toEqual([2027, 2028, 2029]);
    expect(valorEstimado(pedido)).toBe(828_256);
    expect(valorPorAno(pedido)).toEqual([357_152, 235_552, 235_552]);
    expect(valoresDosLotes(pedido).map((l) => l.total)).toEqual([626_400, 201_856]);
  });

  it("a margem prudencial cresce os preços unitários", () => {
    const pedido = { ...pedidoLicenciamentoExemplo(2027), margemPrudencial: 10 };
    const comMargem = comMargemLicenciamento(pedido);
    expect(comMargem.produtos[0].precoUnitario).toBe(15.95);
    expect(comMargem.produtos[1].precoUnitario).toBe(2090);
    expect(valorEstimado(comMargem)).toBeGreaterThan(valorEstimado(pedido));
  });

  it("o fundamento da margem por omissão acompanha a margem", () => {
    expect(ehJustificacaoMargemPorOmissao(justificacaoMargemLicenciamento(0))).toBe(true);
    expect(ehJustificacaoMargemPorOmissao(justificacaoMargemLicenciamento(7.5))).toBe(true);
    expect(ehJustificacaoMargemPorOmissao("Escrito à mão.")).toBe(false);
  });
});

describe("licenciamento — lotes", () => {
  it("por omissão, um lote por produto", () => {
    const a = criarProduto();
    const b = criarProduto();
    const lotes = lotesEfetivos({ ...pedidoLicenciamentoInicial(), produtos: [a, b] });
    expect(lotes.map((l) => [l.numero, l.produtoIds])).toEqual([
      ["1", [a.id]],
      ["2", [b.id]],
    ]);
  });

  it("juntar dois produtos num lote, e voltar a separá-los", () => {
    const pedido = pedidoLicenciamentoExemplo(2027);
    const junto = moverProdutoParaLote(pedido, "lic-bd", "lote-gd");
    expect(junto.lotes).toHaveLength(1);
    expect(junto.lotes[0].produtoIds).toEqual(["lic-gd", "lic-bd"]);
    const separado = moverProdutoParaLote(junto, "lic-bd", null);
    expect(separado.lotes.map((l) => l.numero)).toEqual(["1", "2"]);
  });

  it("um produto removido sai do lote, e o lote vazio desaparece", () => {
    const pedido = pedidoLicenciamentoExemplo(2027);
    const sem = { ...pedido, produtos: pedido.produtos.filter((p) => p.id !== "lic-gd") };
    expect(lotesEfetivos(sem).map((l) => [l.numero, l.produtoIds])).toEqual([["1", ["lic-bd"]]]);
  });
});

describe("licenciamento — natureza e classificação", () => {
  it("a natureza leva o tipo de solução sugerido", () => {
    const pedido = { ...pedidoLicenciamentoInicial(), produtos: [criarProduto("aberta")] };
    expect(pedido.produtos[0].eavalia.tipoSolucao).toBe("Submissão à concorrência");
    const det = comNatureza(pedido, "determinado");
    expect(det.produtos[0].eavalia.tipoSolucao).toBe("");
    expect(comNatureza(det, "aberta").produtos[0].eavalia.tipoSolucao).toBe("Submissão à concorrência");
  });

  it("a modalidade e o direito de uso sugerem o tipo e o tipo de licenciamento do eAvalia", () => {
    const p = comAlteracao(criarProduto(), { modalidade: "upgrade" });
    expect(p.eavalia.tipoLicenciamento).toBe("Actualizações/Upgrades/Correções");
    expect(p.eavalia.tipo).toBe("Upgrade de licenças");
    const q = comAlteracao(criarProduto(), { direitoUso: "perpetuo" });
    expect(q.eavalia.tipo).toBe("Licenças");
  });

  it("a manutenção à parte só existe na licença perpétua", () => {
    const p = comAlteracao({ ...criarProduto(), direitoUso: "perpetuo", manutencao: "aParte" }, { direitoUso: "temporario" });
    expect(p.manutencao).toBe("incluida");
  });
});

describe("licenciamento — validação", () => {
  it("o exemplo está completo", () => {
    const pedido = pedidoLicenciamentoExemplo(2027);
    expect(validarLicencas(pedido)).toEqual([]);
    expect(validarCondicoes(pedido.condicoes)).toEqual([]);
    expect(validarPedido(pedido)).toEqual([]);
  });

  it("aberta pede descrição e requisitos; determinado pede produto, fabricante e fundamento", () => {
    const aberta = validarLicencas({ ...pedidoLicenciamentoInicial(), produtos: [criarProduto()] }).map((e) => e.mensagem);
    expect(aberta.some((m) => m.includes("requisito funcional"))).toBe(true);
    const det = validarLicencas({
      ...pedidoLicenciamentoInicial(),
      natureza: "determinado",
      produtos: [criarProduto("determinado")],
    }).map((e) => e.mensagem);
    expect(det.some((m) => m.includes("fabricante"))).toBe(true);
    expect(det.some((m) => m.includes("fundamento"))).toBe(true);
    expect(det.some((m) => m.includes("requisito"))).toBe(false);
  });

  it("período acima de 36 meses e penalizações acima de 20 % não passam", () => {
    const pedido = pedidoLicenciamentoExemplo(2027);
    pedido.produtos[0].periodoMeses = 48;
    expect(validarLicencas(pedido).some((e) => e.mensagem.includes("art.º 48.º"))).toBe(true);
    const c = condicoesIniciais();
    c.penalizacoes.limiteGlobal = 25;
    expect(validarCondicoes(c).some((e) => e.mensagem.includes("art.º 329.º"))).toBe(true);
  });

  it("mais de 12 meses exige encargos plurianuais", () => {
    const pedido = { ...pedidoLicenciamentoExemplo(2027), encargosPlurianuais: { ativo: false, anoInicio: 2027 } };
    expect(validarPedido(pedido).some((e) => e.campo === "encargosPlurianuais")).toBe(true);
  });
});

describe("licenciamento — ficheiro", () => {
  it("ida e volta pelo JSON", () => {
    const pedido = pedidoLicenciamentoExemplo(2027);
    const lido = importarPedidoLicenciamentoJSON(pedidoLicenciamentoParaJSON(pedido));
    expect(lido.produtos).toEqual(pedido.produtos);
    expect(lido.condicoes).toEqual(pedido.condicoes);
    expect(lido.lotes.map((l) => l.produtoIds)).toEqual(pedido.lotes.map((l) => l.produtoIds));
  });

  it("recusa um ficheiro de outro tipo", () => {
    expect(() => importarPedidoLicenciamentoJSON(JSON.stringify({ tipo: "lotes" }))).toThrow(/pedido de licenciamento/);
  });

  it("o nome do procedimento forma-se pelo projeto", () => {
    expect(nomeProcedimentoLicenciamento("Portal X")).toBe("Aquisição de Licenciamento de Software para o projeto Portal X");
    expect(nomeProcedimentoLicenciamento("  ")).toBe("");
  });
});
