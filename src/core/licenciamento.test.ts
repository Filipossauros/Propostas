import { describe, expect, it } from "vitest";
import {
  anosDoPedido,
  aplicabilidade,
  comAlteracao,
  comMargemLicenciamento,
  consultaMercadoEavalia,
  criarLicenca,
  ehJustificacaoMargemPorOmissao,
  horarioPorExtenso,
  importarPedidoLicenciamentoJSON,
  importarProdutoJSON,
  justificacaoMargemLicenciamento,
  linhasDoMapa,
  lotesEfetivos,
  mesesPorAno,
  moverLicencaParaLote,
  nomeProcedimentoLicenciamento,
  normalizarPedidoLicenciamento,
  pedidoLicenciamentoExemplo,
  pedidoLicenciamentoExemploSoftware,
  pedidoLicenciamentoInicial,
  pedidoLicenciamentoParaJSON,
  produtoParaJSON,
  textoDaCondicao,
  textoPorOmissao,
  tipoEavalia,
  tipoLicenciamentoEavalia,
  tipoSolucaoEavalia,
  tituloDaManutencao,
  validarCondicoes,
  validarLicencas,
  validarPedido,
  validarProdutoLicenciamento,
  valorDaLicenca,
  valorEstimado,
  valorPorAno,
  valoresDosLotes,
} from "./licenciamento";

describe("licenciamento — cálculos", () => {
  it("subscrição mensal: quantidade × preço/mês × meses, repartida pelos anos", () => {
    const l = { ...criarLicenca(), quantidade: 1200, precoUnitario: 14.5, periodoMeses: 36 };
    const v = valorDaLicenca(l, 3);
    expect(v.total).toBe(626_400);
    expect(v.porAno).toEqual([208_800, 208_800, 208_800]);
  });

  it("subscrição anual: quantidade × preço/ano × anos", () => {
    const l = { ...criarLicenca(), quantidade: 1, precoUnitario: 120_000, periodoMeses: 36, periodicidadePreco: "anual" as const };
    const v = valorDaLicenca(l, 3);
    expect(v.total).toBe(360_000);
    expect(v.porAno).toEqual([120_000, 120_000, 120_000]);
  });

  it("subscrição sem anos bastantes: o resto cabe no último ano", () => {
    const l = { ...criarLicenca(), quantidade: 10, precoUnitario: 10, periodoMeses: 18 };
    expect(valorDaLicenca(l, 1).porAno).toEqual([1800]);
  });

  it("perpétua com manutenção em linha própria: licenças no 1.º ano e manutenção anual", () => {
    const l = {
      ...criarLicenca(),
      direitoUso: "perpetuo" as const,
      manutencao: "aParte" as const,
      percentagemManutencao: 22,
      quantidade: 64,
      precoUnitario: 1900,
      periodoMeses: 36,
    };
    const v = valorDaLicenca(l, 3);
    expect(v.licencas).toBe(121_600);
    expect(v.manutencaoAnual).toBe(26_752);
    expect(v.total).toBe(121_600 + 3 * 26_752);
    expect(v.porAno).toEqual([148_352, 26_752, 26_752]);
  });

  it("a manutenção em linha própria é uma segunda linha do mapa, com preço anual", () => {
    const l = {
      ...criarLicenca(),
      designacao: "Base de dados",
      direitoUso: "perpetuo" as const,
      manutencao: "aParte" as const,
      percentagemManutencao: 22,
      metrica: "core" as const,
      quantidade: 64,
      precoUnitario: 1900,
      periodoMeses: 36,
    };
    const linhas = linhasDoMapa(l, "aberta", 3);
    expect(linhas.map((x) => [x.tipo, x.quantidade, x.periodos, x.precoUnitario, x.total])).toEqual([
      ["licenca", 64, 1, 1900, 121_600],
      ["manutencao", 1, 3, 26_752, 80_256],
    ]);
    expect(linhas[1].designacao).toBe("Manutenção e suporte — Base de dados");
  });

  it("meses por ano a partir de janeiro", () => {
    expect(mesesPorAno(30, 3)).toEqual([12, 12, 6]);
    expect(mesesPorAno(6, 1)).toEqual([6]);
  });

  it("o exemplo de software: valor estimado por licença, por ano e por lote", () => {
    const pedido = pedidoLicenciamentoExemploSoftware(2027);
    expect(anosDoPedido(pedido)).toEqual([2027, 2028, 2029]);
    expect(valorEstimado(pedido)).toBe(828_256);
    expect(valorPorAno(pedido)).toEqual([357_152, 235_552, 235_552]);
    expect(valoresDosLotes(pedido).map((l) => l.total)).toEqual([626_400, 201_856]);
  });

  it("o exemplo da SNOMED CT: licença nacional, preço anual, 3 anos", () => {
    const pedido = pedidoLicenciamentoExemplo(2027);
    expect(valorEstimado(pedido)).toBe(360_000);
    expect(nomeProcedimentoLicenciamento(pedido.nomeProduto)).toBe("Aquisição de Licenciamento de SNOMED CT");
  });

  it("a margem prudencial cresce os preços unitários", () => {
    const pedido = { ...pedidoLicenciamentoExemploSoftware(2027), margemPrudencial: 10 };
    const comMargem = comMargemLicenciamento(pedido);
    expect(comMargem.licencas[0].precoUnitario).toBe(15.95);
    expect(comMargem.licencas[1].precoUnitario).toBe(2090);
    expect(valorEstimado(comMargem)).toBeGreaterThan(valorEstimado(pedido));
  });

  it("o fundamento da margem por omissão acompanha a margem", () => {
    expect(ehJustificacaoMargemPorOmissao(justificacaoMargemLicenciamento(0))).toBe(true);
    expect(ehJustificacaoMargemPorOmissao(justificacaoMargemLicenciamento(7.5))).toBe(true);
    expect(ehJustificacaoMargemPorOmissao("Escrito à mão.")).toBe(false);
  });
});

describe("licenciamento — lotes", () => {
  it("por omissão, um lote por licença", () => {
    const a = criarLicenca();
    const b = criarLicenca();
    const lotes = lotesEfetivos({ ...pedidoLicenciamentoInicial(), licencas: [a, b] });
    expect(lotes.map((l) => [l.numero, l.licencaIds])).toEqual([
      ["1", [a.id]],
      ["2", [b.id]],
    ]);
  });

  it("juntar duas licenças num lote, e voltar a separá-las", () => {
    const pedido = pedidoLicenciamentoExemploSoftware(2027);
    const junto = moverLicencaParaLote(pedido, "lic-bd", "lote-gd");
    expect(junto.lotes).toHaveLength(1);
    expect(junto.lotes[0].licencaIds).toEqual(["lic-gd", "lic-bd"]);
    const separado = moverLicencaParaLote(junto, "lic-bd", null);
    expect(separado.lotes.map((l) => l.numero)).toEqual(["1", "2"]);
  });

  it("uma licença removida sai do lote, e o lote vazio desaparece", () => {
    const pedido = pedidoLicenciamentoExemploSoftware(2027);
    const sem = { ...pedido, licencas: pedido.licencas.filter((l) => l.id !== "lic-gd") };
    expect(lotesEfetivos(sem).map((l) => [l.numero, l.licencaIds])).toEqual([["1", ["lic-bd"]]]);
  });
});

describe("licenciamento — eAvalia derivado", () => {
  it("o tipo vem do direito de uso", () => {
    expect(tipoEavalia({ direitoUso: "temporario" })).toBe("Subscrição ou SaaS");
    expect(tipoEavalia({ direitoUso: "perpetuo" })).toBe("Licenças");
  });

  it("o tipo de licenciamento vem da modalidade", () => {
    expect(tipoLicenciamentoEavalia({ modalidade: "aquisicao" })).toBe("Aquisição novas licenças");
    expect(tipoLicenciamentoEavalia({ modalidade: "alargamento" })).toBe("Aquisição novas licenças");
    expect(tipoLicenciamentoEavalia({ modalidade: "renovacao" })).toBe("Actualizações/Upgrades/Correções");
    expect(tipoLicenciamentoEavalia({ modalidade: "upgrade" })).toBe("Actualizações/Upgrades/Correções");
  });

  it("a consulta ao mercado e, na aberta, o tipo de solução vêm da natureza", () => {
    const l = { ...criarLicenca(), eavalia: { tipoSolucao: "Software Proprietário sem alternativas" as const, ambito: "" as const } };
    expect(consultaMercadoEavalia("aberta")).toBe("Sim");
    expect(consultaMercadoEavalia("determinado")).toBe("Não");
    expect(tipoSolucaoEavalia(l, "aberta")).toBe("Submissão à concorrência");
    expect(tipoSolucaoEavalia(l, "determinado")).toBe("Software Proprietário sem alternativas");
  });

  it("a manutenção em linha própria só existe na perpétua; as licenças únicas ficam com quantidade 1", () => {
    const l = comAlteracao({ ...criarLicenca(), direitoUso: "perpetuo", manutencao: "aParte" }, { direitoUso: "temporario" });
    expect(l.manutencao).toBe("incluida");
    expect(comAlteracao({ ...criarLicenca(), quantidade: 50 }, { metrica: "nacional" }).quantidade).toBe(1);
  });
});

describe("licenciamento — condições", () => {
  it("os textos por omissão acompanham as licenças", () => {
    const snomed = pedidoLicenciamentoExemplo(2027);
    const software = pedidoLicenciamentoExemploSoftware(2027);
    expect(textoPorOmissao("ambito", snomed)).toContain("todo o território nacional");
    expect(textoPorOmissao("manutencao", snomed)).toContain("edições");
    expect(textoPorOmissao("manutencao", software)).toContain("correções");
    expect(tituloDaManutencao(snomed)).toBe("Atualizações e novas edições");
    expect(tituloDaManutencao(software)).toBe("Manutenção e atualizações");
  });

  it("um texto escrito à mão fica; repor volta ao por omissão", () => {
    const pedido = pedidoLicenciamentoExemplo(2027);
    pedido.condicoes.ambito.texto = "Escrito à mão.";
    expect(textoDaCondicao("ambito", pedido)).toBe("Escrito à mão.");
    pedido.condicoes.ambito.texto = null;
    expect(textoDaCondicao("ambito", pedido)).toBe(textoPorOmissao("ambito", pedido));
  });

  it("a disponibilidade só se aplica ao software em subscrição", () => {
    expect(aplicabilidade("disponibilidade", pedidoLicenciamentoExemplo(2027)).aplica).toBe(false);
    expect(aplicabilidade("disponibilidade", pedidoLicenciamentoExemploSoftware(2027)).aplica).toBe(true);
  });

  it("o horário do suporte, por extenso", () => {
    const s = pedidoLicenciamentoInicial().condicoes.suporte;
    expect(horarioPorExtenso(s)).toBe("Dias úteis, das 09:00 às 18:00");
    expect(horarioPorExtenso({ ...s, horario: "7dias", horaInicio: "00:00", horaFim: "24:00" })).toBe(
      "Todos os dias, incluindo fins de semana e feriados, 24 horas por dia",
    );
    expect(horarioPorExtenso({ ...s, horario: "personalizado", diasPersonalizados: "Dias úteis e sábados" })).toBe(
      "Dias úteis e sábados, das 09:00 às 18:00",
    );
  });

  it("horas inválidas e horário personalizado sem dias não passam", () => {
    const pedido = pedidoLicenciamentoExemplo(2027);
    pedido.condicoes.suporte = { ...pedido.condicoes.suporte, horario: "personalizado", horaInicio: "18:00", horaFim: "09:00" };
    const mensagens = validarCondicoes(pedido).map((e) => e.mensagem);
    expect(mensagens.some((m) => m.includes("dias do horário personalizado"))).toBe(true);
    expect(mensagens.some((m) => m.includes("hora de fim"))).toBe(true);
  });
});

describe("licenciamento — validação", () => {
  it("os dois exemplos estão completos", () => {
    for (const pedido of [pedidoLicenciamentoExemplo(2027), pedidoLicenciamentoExemploSoftware(2027)]) {
      expect(validarProdutoLicenciamento(pedido)).toEqual([]);
      expect(validarLicencas(pedido)).toEqual([]);
      expect(validarCondicoes(pedido)).toEqual([]);
      expect(validarPedido(pedido)).toEqual([]);
    }
  });

  it("aberta pede designação e requisitos; determinada pede licença, titular, fundamento e tipo de solução", () => {
    const aberta = validarLicencas({ ...pedidoLicenciamentoInicial(), licencas: [criarLicenca()] }).map((e) => e.mensagem);
    expect(aberta.some((m) => m.includes("requisito funcional"))).toBe(true);
    expect(aberta.some((m) => m.includes("tipo de solução"))).toBe(false);
    const det = validarLicencas({ ...pedidoLicenciamentoInicial(), natureza: "determinado", licencas: [criarLicenca()] }).map(
      (e) => e.mensagem,
    );
    expect(det.some((m) => m.includes("titular"))).toBe(true);
    expect(det.some((m) => m.includes("fundamento"))).toBe(true);
    expect(det.some((m) => m.includes("tipo de solução"))).toBe(true);
    expect(det.some((m) => m.includes("requisito"))).toBe(false);
  });

  it("objeto «outro» pede a indicação; preço anual pede anos completos", () => {
    const pedido = pedidoLicenciamentoExemplo(2027);
    pedido.licencas[0] = { ...pedido.licencas[0], objeto: "outro", periodoMeses: 18 };
    const mensagens = validarLicencas(pedido).map((e) => e.mensagem);
    expect(mensagens.some((m) => m.includes("objeto da licença"))).toBe(true);
    expect(mensagens.some((m) => m.includes("anos completos"))).toBe(true);
  });

  it("procedimento anterior e tabela pública pedem a referência", () => {
    const pedido = pedidoLicenciamentoExemplo(2027);
    pedido.licencas[0] = { ...pedido.licencas[0], origemPreco: "procedimentoAnterior", referenciaPreco: "" };
    expect(validarLicencas(pedido).some((e) => e.mensagem.includes("n.º do procedimento anterior"))).toBe(true);
    pedido.licencas[0] = { ...pedido.licencas[0], origemPreco: "tabelaPublica" };
    expect(validarLicencas(pedido).some((e) => e.mensagem.includes("tabela pública"))).toBe(true);
  });

  it("o direito de uso não tem texto livre", () => {
    const pedido = pedidoLicenciamentoExemplo(2027);
    pedido.condicoes.direitoUso.texto = "Escrito à mão.";
    expect(textoDaCondicao("direitoUso", pedido)).toBe(textoPorOmissao("direitoUso", pedido));
  });

  it("período acima de 36 meses e penalizações (ligadas) acima de 20 % não passam", () => {
    const pedido = pedidoLicenciamentoExemploSoftware(2027);
    pedido.licencas[0].periodoMeses = 48;
    expect(validarLicencas(pedido).some((e) => e.mensagem.includes("art.º 48.º"))).toBe(true);
    pedido.condicoes.penalizacoes.limiteGlobal = 25;
    expect(validarCondicoes(pedido).some((e) => e.mensagem.includes("art.º 329.º"))).toBe(false);
    pedido.condicoes.penalizacoes.ligada = true;
    expect(validarCondicoes(pedido).some((e) => e.mensagem.includes("art.º 329.º"))).toBe(true);
  });

  it("mais de 12 meses exige encargos plurianuais", () => {
    const pedido = { ...pedidoLicenciamentoExemplo(2027), encargosPlurianuais: { ativo: false, anoInicio: 2027 } };
    expect(validarPedido(pedido).some((e) => e.campo === "encargosPlurianuais")).toBe(true);
  });
});

describe("licenciamento — ficheiros", () => {
  it("ida e volta pelo JSON", () => {
    const pedido = pedidoLicenciamentoExemploSoftware(2027);
    const lido = importarPedidoLicenciamentoJSON(pedidoLicenciamentoParaJSON(pedido));
    expect(lido.licencas).toEqual(pedido.licencas);
    expect(lido.condicoes).toEqual(pedido.condicoes);
    expect(lido.nomeProduto).toBe(pedido.nomeProduto);
    expect(lido.lotes.map((l) => l.licencaIds)).toEqual(pedido.lotes.map((l) => l.licencaIds));
  });

  it("lê um pedido da versão anterior: produtos, projeto e textos por omissão de então", () => {
    const antigo = {
      schemaVersion: "2.0",
      tipo: "licenciamento",
      nomeProjeto: "Arquivo",
      natureza: "determinado",
      produtos: [
        {
          id: "p1",
          produto: "DocFlow",
          fabricante: "X",
          categoria: "Gestão documental",
          eavalia: { tipoSolucao: "Submissão à concorrência", tipo: "Licenças", ambito: "Servidor" },
          direitoUso: "temporario",
          manutencao: "incluida",
        },
      ],
      lotes: [{ id: "l1", numero: "1", designacao: "", produtoIds: ["p1"] }],
      condicoes: {
        ambito: {
          texto:
            "Utilização pela SPMS, E.P.E. e pelas entidades do Serviço Nacional de Saúde indicadas, em todos os ambientes (produção, teste, formação e recuperação), sem limite geográfico dentro do território nacional.",
        },
        suporte: { horario: "24x7" },
      },
    };
    const lido = normalizarPedidoLicenciamento(antigo);
    expect(lido.nomeProduto).toBe("Arquivo");
    expect(lido.licencas[0].nomeComercial).toBe("DocFlow");
    expect(lido.licencas[0].eavalia.tipoSolucao).toBe("");
    expect(lido.lotes[0].licencaIds).toEqual(["p1"]);
    expect(lido.condicoes.ambito.texto).toBeNull();
    expect(lido.condicoes.suporte.horario).toBe("7dias");
    expect(lido.condicoes.suporte.horaFim).toBe("24:00");
  });

  it("o ficheiro do produto vai e vem, e importa-se também do pedido e de um projeto", () => {
    const pedido = pedidoLicenciamentoExemplo(2027);
    expect(importarProdutoJSON(produtoParaJSON(pedido)).nomeProduto).toBe("SNOMED CT");
    expect(importarProdutoJSON(pedidoLicenciamentoParaJSON(pedido)).origem).toBe("licenciamento");
    const projeto = JSON.stringify({ schemaVersion: "2.0", tipo: "projeto", nomeProjeto: "P", descricaoProjeto: "d" });
    expect(importarProdutoJSON(projeto)).toMatchObject({ nomeProduto: "P", origem: "projeto" });
  });

  it("recusa um ficheiro de outro tipo", () => {
    expect(() => importarPedidoLicenciamentoJSON(JSON.stringify({ tipo: "lotes" }))).toThrow(/pedido de licenciamento/);
  });
});
