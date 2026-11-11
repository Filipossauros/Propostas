// A manifestação de necessidades de um pedido de licenciamento, no modelo da DAG.
//
// O mesmo modelo, a mesma tipografia e a mesma estrutura da manifestação do
// pedido de serviços de bolsa de horas — dez secções numeradas, a conclusão em
// proposta de deliberação, a assinatura —, com o conteúdo próprio do
// licenciamento: os produtos e a sua natureza (aberta à concorrência ou produto
// determinado), o valor estimado por produto e por ano, e as condições do
// contrato nas Especificações Técnicas.
//
// O único aspeto submetido à concorrência é o preço: tudo o que está no
// Anexo III são termos e condições do contrato.

import type { BlocoDocumento } from "../core/documento";
import type { PedidoLicenciamento, ProdutoLicenca, ValoresDoLote } from "../core/licenciamento";
import {
  DIREITOS_USO,
  FUNDAMENTOS_PRODUTO,
  HORARIOS_SUPORTE,
  MANUTENCOES,
  METRICAS,
  MODALIDADES,
  ORIGENS_PRECO,
  anosDoPedido,
  comIva,
  comMargemLicenciamento,
  designacaoDoLote,
  justificacaoMargemLicenciamento,
  margemDoPedido,
  mesesDoContrato,
  metricaPorExtenso,
  nomeDoProduto,
  nomeProcedimentoLicenciamento,
  valorEstimado,
  valorPorAno,
  valoresDosLotes,
} from "../core/licenciamento";
import { semBeneficioFixo } from "../core/justificacao";
import { blocosUmLotePorConcorrente } from "../core/cadernoEncargos";
import { formatarMoeda, formatarNumero } from "../core/lotes";
import { dataPorExtenso } from "./informacaoSpms";
import { gerarEavaliaLicenciamentoBlob } from "../excel/eavalia";
import { lerFolhaDoAlinhamento } from "../excel/folhaDoAlinhamento";
import { paginasDoAlinhamento } from "../excel/imagemDoAlinhamento";
import { lerFolhaDosCustosLicenciamento } from "../excel/custosLicenciamento";
import {
  ALTURA_EM_RETRATO,
  BENEFICIARIOS,
  DIRECAO,
  DXA_POR_PIXEL,
  LARGURA_EM_RETRATO,
  RECUO,
  RECUO_ALINEA,
  RESERVA_DO_TITULO,
  TABELA,
  abrirModeloDaManifestacao,
  alinea,
  assinatura,
  comPontuacao,
  entre,
  enumerar,
  fecharManifestacao,
  juntoAoSeguinte,
  letra,
  lista,
  marcador,
  numerado,
  paginasDeImagem,
  paragrafo,
  recuado,
  run,
  seccao,
  soCalibri,
  subtitulo,
  tabela,
  tabelaIdentificacao,
  tabulador,
  vazio,
} from "./manifestacaoNecessidades";

const RISCOS_DA_EXECUCAO_LICENCIAMENTO =
  "atraso na disponibilização das licenças ou dos acessos; incompatibilidade técnica com os sistemas existentes; " +
  "incumprimento dos níveis de serviço de suporte e de disponibilidade.";

const MITIGACAO_LICENCIAMENTO =
  "requisitos mínimos e condições contratuais fixados no caderno de encargos; níveis de serviço com penalizações " +
  "associadas; acompanhamento pelo gestor do contrato, com verificação das licenças disponibilizadas e dos relatórios " +
  "mensais de incidentes.";

const CONCLUSAO_CUSTO_BENEFICIO_LICENCIAMENTO =
  "Da análise efetuada resulta que a contratação permite assegurar os benefícios operacionais identificados, " +
  "mostrando-se o dimensionamento financeiro adotado adequado e proporcional à necessidade, sem prejuízo da " +
  "monitorização das licenças efetivamente utilizadas e dos encargos durante a execução.";

/** As questões de sustentabilidade, com as respostas próprias de uma aquisição de licenciamento. */
const SUSTENTABILIDADE_LICENCIAMENTO: Array<{ pergunta: string; resposta: boolean; justificacao: string }> = [
  {
    pergunta: "Existem requisitos ambientais?",
    resposta: false,
    justificacao:
      "O objeto do contrato é o direito de utilização de software, sem fornecimento de bens físicos nem produção de " +
      "resíduos relevantes, pelo que não se justifica a fixação de requisitos ambientais específicos, sem prejuízo do " +
      "cumprimento da legislação ambiental aplicável.",
  },
  {
    pergunta: "Existem preocupações de economia circular?",
    resposta: false,
    justificacao:
      "O objeto do contrato não contempla a aquisição de bens ou materiais, não se identificando oportunidades " +
      "relevantes de aplicação de princípios de economia circular.",
  },
  {
    pergunta: "Existem requisitos sociais ou de inclusão?",
    resposta: false,
    justificacao:
      "Sem prejuízo do cumprimento, pelo adjudicatário, das obrigações legais em matéria laboral, de segurança social " +
      "e de igualdade e não discriminação, não se identificam requisitos sociais ou de inclusão específicos a fixar, " +
      "atenta a natureza do objeto.",
  },
  {
    pergunta: "Existe incentivo à inovação?",
    resposta: false,
    justificacao:
      "O licenciamento respeita a software com funcionalidades e características técnicas definidas, pelo que não se " +
      "justifica a adoção de mecanismos específicos de incentivo à inovação.",
  },
];

const OBJETO_INDIVISIVEL_UM_PRODUTO =
  "O objeto do contrato não é suscetível de divisão em lotes, por respeitar ao licenciamento de um único produto " +
  "de software, cuja separação em prestações autónomas não é técnica nem economicamente viável.";

const OBJETO_INDIVISIVEL_VARIOS =
  "Não se procede à divisão em lotes, uma vez que os produtos a licenciar constituem uma solução integrada, cujo " +
  "funcionamento depende da compatibilidade entre os seus componentes; a fragmentação introduziria riscos de " +
  "incompatibilidade técnica, de duplicação de esforços de coordenação e de aumento dos custos de gestão, " +
  "revelando-se a contratação unitária mais eficiente e adequada à satisfação da necessidade.";

const DEFINICAO_SEVERIDADES: Array<[string, string]> = [
  ["Crítica", "serviço indisponível, ou perda ou corrupção de dados, sem alternativa de contorno"],
  ["Alta", "funcionalidade relevante afetada, sem alternativa de contorno razoável"],
  ["Normal", "restantes incidentes e pedidos de esclarecimento"],
];

/**
 * Os benefícios escritos no Módulo 1. O benefício de fecho da bolsa de horas —
 * a insuficiência de recursos humanos internos — não se aplica a licenças.
 */
function beneficiosDoLicenciamento(pedido: PedidoLicenciamento): string[] {
  return semBeneficioFixo(pedido.justificacao.beneficios)
    .map((b) => b.designacao)
    .filter((b) => b.trim() !== "");
}

function objetoDoPedido(pedido: PedidoLicenciamento): string {
  const projeto = pedido.nomeProjeto.trim();
  return `licenciamento de software para o projeto ${projeto === "" ? "[nome do projeto]" : projeto}`;
}

function periodoPorExtenso(meses: number): string {
  return meses === 1 ? "1 mês" : `${meses} meses`;
}

/** «1 200 utilizadores nomeados de Plataforma de gestão documental, em subscrição por 36 meses». */
function utilizacaoDoProduto(p: ProdutoLicenca, pedido: PedidoLicenciamento): string {
  const nome = nomeDoProduto(p, pedido.natureza) || "produto por designar";
  const qtd = `${formatarNumero(p.quantidade)} ${metricaPorExtenso(p) || "licenças"}`;
  const tipo =
    p.direitoUso === "temporario"
      ? `em subscrição por ${periodoPorExtenso(p.periodoMeses)}`
      : `em licenças perpétuas${p.manutencao === "aParte" ? `, com manutenção por ${periodoPorExtenso(p.periodoMeses)}` : ""}`;
  return `${qtd} de ${nome}, ${tipo}`;
}

function linhasDosProdutos(lotes: ValoresDoLote[], pedido: PedidoLicenciamento): string[][] {
  return lotes.flatMap((l) =>
    l.linhas.map(({ produto: p, valor }) => [
      l.lote.numero,
      nomeDoProduto(p, pedido.natureza) || "—",
      p.metrica === "" ? "—" : METRICAS[p.metrica].plural,
      formatarNumero(p.quantidade),
      p.direitoUso === "temporario" ? `${formatarMoeda(p.precoUnitario)}/mês` : formatarMoeda(p.precoUnitario),
      periodoPorExtenso(p.periodoMeses),
      formatarMoeda(valor.licencas),
      valor.manutencao > 0 ? formatarMoeda(valor.manutencao) : "—",
      formatarMoeda(valor.total),
    ]),
  );
}

function corpoLicenciamento(
  original: PedidoLicenciamento,
  pedido: PedidoLicenciamento,
  modelo: string,
  anterior: string,
  quando: Date,
): string {
  const objeto = objetoDoPedido(pedido);
  const projeto = pedido.nomeProjeto.trim();
  const margem = margemDoPedido(pedido);
  const justificacaoMargem = pedido.justificacaoMargem.trim() || justificacaoMargemLicenciamento(margem);
  const anos = anosDoPedido(pedido);
  const meses = mesesDoContrato(pedido);
  const estimado = valorEstimado(pedido);
  const referencia = valorEstimado(original);
  const iva = comIva(estimado, pedido.taxaIva);
  const porAno = valorPorAno(pedido);
  const lotes = valoresDosLotes(pedido);
  const determinado = pedido.natureza === "determinado";
  const c = pedido.condicoes;
  const juri = pedido.juri;

  const p: string[] = [];
  let ponto = 0;
  const proximo = () => `${++ponto}.`;

  // A caixa de parecer do modelo, e a identificação.
  p.push(soCalibri(entre(modelo.slice(modelo.indexOf("<w:body>")), "<w:tbl>", "</w:tbl>")));
  p.push(vazio(240));
  p.push(
    tabelaIdentificacao(
      pedido.numeroInformacao.trim(),
      pedido.numeroOrcamento.trim(),
      dataPorExtenso(quando),
      `MANIFESTAÇÃO DE NECESSIDADES PARA A AQUISIÇÃO DE ${objeto.toUpperCase()}`,
    ),
  );

  // I. Enquadramento
  p.push(seccao(1, "Enquadramento"));
  p.push(
    numerado(proximo(), [
      run(`A presente informação visa concretizar o pedido de aquisição de ${objeto}, que possibilitará atingir os seguintes objetivos:`),
    ]),
  );
  const objetivos = pedido.justificacao.objetivos.map((o) => o.designacao).filter((o) => o.trim() !== "");
  if (objetivos.length === 0) p.push(alinea("a.", [marcador("objetivos da aquisição")]));
  else comPontuacao(objetivos).forEach((o, i) => p.push(alinea(`${letra(i)}.`, o)));

  // II. Identificação da necessidade
  p.push(seccao(2, "Identificação clara, objetiva e funcional da necessidade"));
  p.push(
    numerado(
      proximo(),
      "Para efeitos do artigo 35.º-D do Código dos Contratos Públicos, na redação conferida pelo Decreto-Lei n.º " +
        `177/2026, de 4 de setembro, a necessidade a satisfazer consiste em assegurar, durante ${periodoPorExtenso(meses)}, ` +
        "o direito de utilização do seguinte software:",
      { depois: 80 },
    ),
  );
  comPontuacao(pedido.produtos.map((x) => utilizacaoDoProduto(x, pedido))).forEach((t, i) =>
    p.push(alinea(`${letra(i)}.`, t)),
  );
  if (determinado) {
    p.push(
      numerado(
        proximo(),
        "A aquisição respeita a produtos determinados, cuja identificação se fundamenta nos seguintes termos:",
        { depois: 80, antes: 80 },
      ),
    );
    pedido.produtos.forEach((x, i) =>
      p.push(
        alinea(`${letra(i)}.`, [
          run(`${nomeDoProduto(x, "determinado") || "Produto"}: `, { negrito: true }),
          x.fundamento === "" ? marcador("fundamento") : run(`${FUNDAMENTOS_PRODUTO[x.fundamento]}. `),
          x.explicacaoFundamento.trim() === ""
            ? marcador("explicação do fundamento")
            : run(`${x.explicacaoFundamento.trim().replace(/[.;]+$/, "")}.`),
        ]),
      ),
    );
  } else {
    p.push(
      numerado(
        proximo(),
        "A aquisição é aberta à concorrência: a necessidade descreve-se pelas funcionalidades e características " +
          "técnicas mínimas que o software tem de assegurar, constantes do Anexo III, sem referência a marca, " +
          "fabricante ou produto determinado, competindo aos concorrentes identificar na proposta o produto que " +
          "propõem.",
        { antes: 80 },
      ),
    );
  }
  p.push(
    numerado(
      proximo(),
      "A presente necessidade foi objeto de análise funcional prévia, tendo-se concluído que corresponde a uma " +
        "necessidade efetiva, atual e devidamente identificada, não sendo suscetível de satisfação através de " +
        "recursos próprios da SPMS.",
    ),
  );
  p.push(numerado(proximo(), "A presente aquisição comporta os seguintes benefícios:", { depois: 80 }));
  const beneficios = beneficiosDoLicenciamento(pedido);
  if (beneficios.length === 0) p.push(alinea("a.", [marcador("benefícios do projeto")]));
  else comPontuacao(beneficios).forEach((b, i) => p.push(alinea(`${letra(i)}.`, b)));
  p.push(numerado(proximo(), "Concluindo assim que a necessidade visa:", { depois: 80, antes: 80 }));
  const descricao = pedido.descricaoProjeto.trim();
  p.push(
    alinea(
      "a.",
      descricao === ""
        ? [marcador("descrição do projeto")]
        : `${descricao.charAt(0).toUpperCase()}${descricao.slice(1).replace(/[.;]+$/, "")}.`,
    ),
  );

  // III. Valor estimado
  p.push(seccao(3, "Valor estimado e memória de cálculo"));
  p.push(
    numerado(proximo(), [
      run("Para efeitos dos artigos 17.º e 17.º-B do CCP, o valor estimado do contrato corresponde a "),
      run(formatarMoeda(estimado), { negrito: true }),
      run(
        ", sem IVA, determinado com base em critérios económicos objetivos, designadamente as quantidades a " +
          `licenciar, o período de utilização e os preços unitários de referência${
            margem > 0 ? `, acrescidos de uma margem prudencial de ${formatarNumero(margem)} %` : ""
          }, nos termos da memória descritiva e de cálculo constante do Anexo I.`,
      ),
    ]),
  );
  p.push(numerado(proximo(), justificacaoMargem));
  const linhasCalculo: string[][] = [
    ["Valor de referência (s/ IVA)", formatarMoeda(referencia)],
    [
      "Margem prudencial",
      margem > 0
        ? `${formatarNumero(margem)} % (${formatarMoeda(estimado - referencia)})`
        : "0 % (incorporada nos valores unitários)",
    ],
    ["Valor estimado do contrato (s/ IVA)", formatarMoeda(estimado)],
    [`Valor estimado do contrato (c/ IVA a ${formatarNumero(pedido.taxaIva)} %)`, formatarMoeda(iva.comIva)],
  ];
  p.push(
    tabela(
      [
        { titulo: "Elemento de cálculo", peso: 60 },
        { titulo: "Valor", alinhamento: "direita", peso: 40 },
      ],
      linhasCalculo,
      { destaques: linhasCalculo.map((_, i) => i === 2) },
    ),
  );
  if (estimado >= 5_000_000) {
    p.push(
      recuado([marcador("valor igual ou superior a 5 M€: juntar o Anexo II – Fundamentação de valor superior a 5 M€")]),
    );
  }

  // IV. Avaliação custo-benefício
  p.push(seccao(4, "Avaliação custo-benefício"));
  p.push(
    paragrafo(
      "Atento o valor estimado e para efeitos do artigo 36.º do CCP, apresenta-se a seguinte avaliação custo-benefício:",
    ),
  );
  const beneficiosOperacionais = beneficios
    .map((b) =>
      b
        .trim()
        .replace(/^Permitirá\s+/i, "")
        .replace(/[.;]+$/, ""),
    )
    .map((b) => b.charAt(0).toLowerCase() + b.slice(1));
  const criterios: Array<[string, string]> = [
    ["Beneficiários", BENEFICIARIOS],
    ["Utilização prevista", `${enumerar(pedido.produtos.map((x) => utilizacaoDoProduto(x, pedido)))}.`],
    ["Benefícios operacionais", beneficiosOperacionais.length === 0 ? "" : `${beneficiosOperacionais.join("; ")}.`],
    [
      "Custos",
      `encargo anual máximo de ${formatarMoeda(Math.max(...porAno))}, sem IVA, e encargo máximo global de ${formatarMoeda(
        estimado,
      )}, sem IVA.`,
    ],
    ["Riscos", RISCOS_DA_EXECUCAO_LICENCIAMENTO],
    ["Mitigação", MITIGACAO_LICENCIAMENTO],
  ];
  criterios.forEach(([rotulo, texto], i) =>
    p.push(
      alinea(
        `${letra(i)})`,
        [run(`${rotulo}: `), texto.trim() === "" ? marcador(rotulo.toLowerCase()) : run(texto.trim())],
        RECUO,
      ),
    ),
  );
  p.push(paragrafo(CONCLUSAO_CUSTO_BENEFICIO_LICENCIAMENTO, { antes: 120 }));

  // V. Sustentabilidade
  p.push(seccao(5, "Sustentabilidade e contratação estratégica"));
  SUSTENTABILIDADE_LICENCIAMENTO.forEach((q, i) =>
    p.push(
      alinea(
        `${letra(i)})`,
        [
          run(`${q.pergunta} `),
          run(q.resposta ? "Sim." : "Não.", { negrito: true }),
          run(" "),
          q.justificacao.trim() === "" ? marcador("justificação") : run(q.justificacao.trim()),
        ],
        RECUO,
      ),
    ),
  );

  // VI. Divisão em lotes
  p.push(seccao(6, "Divisão em lotes"));
  if (lotes.length <= 1) {
    p.push(paragrafo(pedido.produtos.length <= 1 ? OBJETO_INDIVISIVEL_UM_PRODUTO : OBJETO_INDIVISIVEL_VARIOS));
  } else {
    p.push(
      paragrafo(
        "O procedimento é configurado por lotes, correspondendo cada lote a produtos autónomos, suscetíveis de " +
          "adjudicação separada, nos seguintes termos:",
        { depois: 80 },
      ),
    );
    const linhas = lotes.map((l) => [
      l.lote.numero,
      designacaoDoLote(l.lote, pedido),
      { linhas: l.linhas.map((x) => nomeDoProduto(x.produto, pedido.natureza) || "—") },
      formatarMoeda(l.total),
    ]);
    p.push(
      tabela(
        [
          { titulo: "Lote", alinhamento: "direita", peso: 8 },
          { titulo: "Designação", peso: 30 },
          { titulo: "Produtos", peso: 42 },
          { titulo: "Valor estimado (s/ IVA)", alinhamento: "direita", peso: 20 },
        ],
        linhas,
        {
          legenda:
            `Valor estimado por lote, sem IVA.${margem > 0 ? ` Inclui a margem prudencial de ${formatarNumero(margem)} %.` : ""}`,
        },
      ),
    );
    p.push(
      paragrafo([
        run("Condições da adjudicação por lotes: ", { negrito: true }),
        run(
          pedido.umLotePorConcorrente
            ? "não se pretende o mesmo adjudicatário em mais do que um lote, nos termos das regras de adjudicação dos lotes constantes do Anexo III."
            : "não existe qualquer condicionante, sendo indiferente a ordem pela qual ocorre a adjudicação.",
        ),
      ]),
    );
  }

  // VII. Gestão, monitorização e controlo
  p.push(seccao(7, "Gestão, monitorização e controlo"));
  const instrumentos = [
    ...(c.suporte.ligada ? ["os tempos máximos de resposta e de resolução dos incidentes"] : []),
    ...(c.disponibilidade.ligada ? ["a disponibilidade mensal do serviço"] : []),
    ...(c.prazo.ligada ? ["o prazo de disponibilização das licenças"] : []),
  ];
  p.push(
    paragrafo(
      "O acompanhamento e o controlo da execução são assegurados pelo gestor do contrato, que verifica a " +
        "disponibilização das licenças nas quantidades e métricas contratadas" +
        (instrumentos.length > 0 ? ` e o cumprimento dos níveis de serviço fixados no Anexo III — ${enumerar(instrumentos)}` : "") +
        ", aplicando, em caso de incumprimento, as penalizações aí previstas.",
    ),
  );
  if (c.suporte.ligada || c.disponibilidade.ligada) {
    p.push(
      paragrafo(
        "O adjudicatário remete ao gestor do contrato, até ao 5.º dia útil do mês seguinte, um relatório mensal dos " +
          "incidentes registados, com os tempos de resposta e de resolução" +
          (c.disponibilidade.ligada ? " e a disponibilidade apurada" : "") +
          ".",
      ),
    );
  }

  // VIII. Riscos da não contratação
  p.push(seccao(8, "Riscos da não contratação"));
  p.push(
    paragrafo("Caso não seja adjudicada a aquisição em apreço, as suas consequências serão as seguintes:", {
      depois: 80,
    }),
  );
  const riscos = pedido.justificacao.riscos.map((r) => r.designacao).filter((r) => r.trim() !== "");
  if (riscos.length === 0) p.push(alinea("a.", [marcador("riscos da não contratação")], RECUO));
  else comPontuacao(riscos).forEach((r, i) => p.push(alinea(`${letra(i)}.`, r, RECUO)));

  // IX. Júri técnico
  p.push(seccao(9, "Júri técnico"));
  p.push(
    paragrafo(
      "Na componente técnica deverão ser nomeados os seguintes elementos para integrarem o júri do procedimento:",
      { depois: 80 },
    ),
  );
  const nome = (valor: string, falta: string) => (valor.trim() === "" ? marcador(falta) : run(valor.trim()));
  p.push(alinea("a)", [nome(juri.diretor, "nome do diretor"), run(` – Diretor da ${DIRECAO}`)], RECUO));
  p.push(
    alinea("b)", [nome(juri.coordenador, "nome do coordenador"), run(" – Coordenador da "), nome(juri.unidade, "unidade")], RECUO),
  );
  p.push(alinea("c)", [nome(juri.gestorProjeto, "nome do gestor de projeto"), run(` – Gestor do Projeto ${projeto}`)], RECUO));

  // X. Conclusão
  p.push(seccao(10, "Conclusão"));
  p.push(paragrafo("Face ao exposto, propõe-se que o Conselho de Administração delibere:", { depois: 80 }));
  const reparticao = enumerar(anos.map((ano, i) => `${formatarMoeda(porAno[i])} em ${ano}`));
  const deliberacoes = [
    `Reconhecer a necessidade de assegurar o ${objeto}, pelo período de ${periodoPorExtenso(meses)};`,
    `Aprovar o valor estimado máximo de ${formatarMoeda(estimado)}, sem IVA, calculado nos termos da memória descritiva e de cálculo constante do Anexo I;`,
    `Autorizar a realização da despesa até ao valor máximo referido, acrescido de IVA à taxa legal em vigor, com a repartição anual máxima de ${reparticao}, sem IVA;`,
    "Aprovar o conteúdo da presente manifestação de necessidades;",
    "Seja remetido o conteúdo da presente informação à Direção de Administração Geral, para acompanhamento e adoção das diligências procedimentais necessárias.",
  ];
  deliberacoes.forEach((d, i) =>
    p.push(paragrafo([run(`${letra(i)})`), tabulador(), run(d)], { ind: 680, pendente: 680, depois: 120 })),
  );
  p.push(vazio(240));
  p.push(paragrafo("À consideração superior,", { jc: "left", depois: 240, comOSeguinte: true }));
  p.push(juntoAoSeguinte(assinatura(anterior, juri)));

  // A lista dos anexos.
  p.push(paragrafo([run("Anexos:")], { antes: 360, depois: 80, comOSeguinte: true }));
  const anexos = [
    "Anexo I – Memória descritiva e de cálculo do valor estimado",
    ...(estimado >= 5_000_000 ? ["Anexo II – Fundamentação de valor superior a 5 M€"] : []),
    "Anexo III – Especificações técnicas",
    "Anexo IV – Alinhamento Tecnológico (eAvalia)",
    "Anexo V – Custos - Licenciamento (eAvalia)",
  ];
  anexos.forEach((a, i) => p.push(alinea(`${letra(i)})`, [run(a, { sz: TABELA + 2 })], RECUO)));

  // Anexo I — memória descritiva e de cálculo
  p.push(
    paragrafo([run("Anexo I – Memória descritiva e de cálculo do valor estimado", { negrito: true })], {
      jc: "center",
      novaPagina: true,
      depois: 240,
    }),
  );
  p.push(paragrafo([run("Sumário executivo:", { negrito: true })], { comOSeguinte: true }));
  p.push(numerado("1.", [run("Objeto", { negrito: true })], { comOSeguinte: true, depois: 80 }));
  p.push(
    recuado(
      `Aquisição de ${objeto}, pelo período de ${periodoPorExtenso(meses)}, com o valor estimado de ` +
        `${formatarMoeda(estimado)}, sem IVA (${formatarMoeda(iva.comIva)} com IVA à taxa de ${formatarNumero(pedido.taxaIva)} %).`,
    ),
  );
  p.push(numerado("2.", [run("Pressupostos dos cálculos", { negrito: true })], { comOSeguinte: true, depois: 80 }));
  p.push(
    recuado(
      "Na subscrição, o valor de cada produto resulta da quantidade × preço unitário mensal × número de meses. Na " +
        "licença perpétua, resulta da quantidade × preço unitário, acrescido, quando a manutenção é contratada à " +
        "parte, da percentagem anual de manutenção sobre o valor das licenças, pelo período do contrato.",
    ),
  );
  p.push(
    tabela(
      [
        { titulo: "Lote", alinhamento: "direita", peso: 6 },
        { titulo: "Produto", peso: 22 },
        { titulo: "Métrica", peso: 13 },
        { titulo: "Qtd.", alinhamento: "direita", peso: 7 },
        { titulo: "Preço unit. (s/ IVA)", alinhamento: "direita", peso: 11 },
        { titulo: "Período", alinhamento: "direita", peso: 8 },
        { titulo: "Licenças (s/ IVA)", alinhamento: "direita", peso: 11 },
        { titulo: "Manutenção (s/ IVA)", alinhamento: "direita", peso: 11 },
        { titulo: "Total (s/ IVA)", alinhamento: "direita", peso: 11 },
      ],
      linhasDosProdutos(lotes, pedido),
      { legenda: margem > 0 ? `Preços unitários com a margem prudencial de ${formatarNumero(margem)} %.` : undefined, sz: 16 },
    ),
  );
  if (anos.length > 1) {
    const linhasAnos = lotes.map((l) => [
      `Lote ${l.lote.numero} — ${designacaoDoLote(l.lote, pedido)}`,
      ...l.porAno.map((v) => formatarMoeda(v)),
      formatarMoeda(l.total),
    ]);
    linhasAnos.push(["Total (s/ IVA)", ...porAno.map((v) => formatarMoeda(v)), formatarMoeda(estimado)]);
    linhasAnos.push([
      `Total (c/ IVA a ${formatarNumero(pedido.taxaIva)} %)`,
      ...porAno.map((v) => formatarMoeda(comIva(v, pedido.taxaIva).comIva)),
      formatarMoeda(iva.comIva),
    ]);
    p.push(
      recuado(
        `O contrato inicia-se em janeiro de ${anos[0]}; a subscrição e a manutenção repartem-se pelos meses de cada ` +
          "ano económico, e as licenças perpétuas imputam-se ao primeiro ano.",
      ),
    );
    p.push(
      tabela(
        [
          { titulo: "Lote", peso: 30 },
          ...anos.map((ano) => ({ titulo: String(ano), alinhamento: "direita" as const, peso: 70 / (anos.length + 1) })),
          { titulo: "Total", alinhamento: "direita", peso: 70 / (anos.length + 1) },
        ],
        linhasAnos,
        { legenda: "Encargos por ano económico.", destaques: linhasAnos.map((_, i) => i >= lotes.length) },
      ),
    );
  }
  if (margem > 0) {
    p.push(
      tabela(
        [
          { titulo: "Produto", peso: 46 },
          { titulo: "Preço de referência (s/ IVA)", alinhamento: "direita", peso: 20 },
          { titulo: "Margem prudencial", alinhamento: "direita", peso: 14 },
          { titulo: "Preço considerado (s/ IVA)", alinhamento: "direita", peso: 20 },
        ],
        original.produtos.map((x, i) => [
          nomeDoProduto(x, pedido.natureza) || "—",
          formatarMoeda(x.precoUnitario),
          `${formatarNumero(margem)} %`,
          formatarMoeda(pedido.produtos[i].precoUnitario),
        ]),
        { legenda: "Preço unitário de cada produto, antes e depois da margem prudencial." },
      ),
    );
  }
  p.push(numerado("3.", [run("Origem dos preços de referência", { negrito: true })], { comOSeguinte: true, depois: 80 }));
  pedido.produtos.forEach((x, i) =>
    p.push(
      alinea(
        `${letra(i)}.`,
        [
          run(`${nomeDoProduto(x, pedido.natureza) || "Produto"}: `),
          x.origemPreco === "" ? marcador("origem do preço") : run(`${ORIGENS_PRECO[x.origemPreco]}.`),
        ],
        RECUO_ALINEA,
      ),
    ),
  );
  p.push(recuado(justificacaoMargem, { antes: 80 }));
  p.push(numerado("4.", [run("Rastreabilidade da execução", { negrito: true })], { comOSeguinte: true, depois: 80 }));
  p.push(
    recuado(
      "A execução deverá permitir a reconciliação entre as licenças disponibilizadas, as faturadas, os preços " +
        "unitários contratados e os limites financeiros anuais, assegurando o respetivo registo documental e a " +
        "preparação de evidência adequada para controlo interno, auditoria e fiscalização.",
    ),
  );

  // Anexo III — especificações técnicas
  const numeroInf = pedido.numeroInformacao.trim();
  const dia = (d: number) => String(d).padStart(2, "0");
  p.push(
    paragrafo(
      [
        run(
          `ANEXO III À INFORMAÇÃO N.º ${numeroInf === "" ? "_________" : numeroInf} DE ${dia(quando.getDate())}/${dia(
            quando.getMonth() + 1,
          )}/${quando.getFullYear()}`,
          { negrito: true },
        ),
      ],
      { jc: "center", novaPagina: true, depois: 80 },
    ),
  );
  p.push(paragrafo([run("Especificações Técnicas", { negrito: true })], { jc: "center", depois: 240 }));

  let n = 0;
  const ponto3 = (titulo: string) =>
    p.push(numerado(`${++n}.`, [run(titulo, { negrito: true })], { comOSeguinte: true, depois: 80 }));

  ponto3("Descrição");
  p.push(
    recuado(
      descricao === "" ? [marcador("descrição do projeto")] : [run(`O Projeto ${projeto} visa ${descricao.replace(/[.;]+$/, "")}.`)],
    ),
  );

  ponto3(determinado ? "Identificação dos produtos" : "Descrição do software e requisitos mínimos");
  if (determinado) {
    p.push(
      tabela(
        [
          { titulo: "Lote", alinhamento: "direita", peso: 8 },
          { titulo: "Produto", peso: 36 },
          { titulo: "Fabricante", peso: 30 },
          { titulo: "Versão / edição mínima", peso: 26 },
        ],
        lotes.flatMap((l) =>
          l.linhas.map(({ produto: x }) => [l.lote.numero, x.produto.trim() || "—", x.fabricante.trim() || "—", x.versao.trim() || "—"]),
        ),
      ),
    );
  } else {
    p.push(
      recuado(
        "O software a fornecer deve cumprir, em cada produto, os requisitos mínimos seguintes. O concorrente " +
          "identifica na proposta o produto, o fabricante e a versão ou edição propostos.",
      ),
    );
    lotes.forEach((l) =>
      l.linhas.forEach(({ produto: x }) => {
        p.push(subtitulo(`Lote ${l.lote.numero} — ${x.designacao.trim() || "Produto"}`, 2));
        p.push(recuado([run("Categoria de software: "), x.categoria.trim() === "" ? marcador("categoria") : run(`${x.categoria.trim()}.`)]));
        const funcionais = x.requisitosFuncionais.map((r) => r.designacao.trim()).filter((r) => r !== "");
        const tecnicos = x.requisitosTecnicos.map((r) => r.designacao.trim()).filter((r) => r !== "");
        p.push(tabela([{ titulo: "Requisitos funcionais mínimos", peso: 100 }], funcionais.map((r) => [r])));
        if (tecnicos.length > 0) p.push(tabela([{ titulo: "Requisitos técnicos mínimos", peso: 100 }], tecnicos.map((r) => [r])));
      }),
    );
  }

  ponto3("Tipo de licenciamento, métrica e quantidades");
  p.push(
    tabela(
      [
        { titulo: "Lote", alinhamento: "direita", peso: 6 },
        { titulo: "Produto", peso: 22 },
        { titulo: "Direito de uso", peso: 14 },
        { titulo: "Modalidade", peso: 14 },
        { titulo: "Métrica", peso: 14 },
        { titulo: "Quantidade", alinhamento: "direita", peso: 9 },
        { titulo: "Período", alinhamento: "direita", peso: 8 },
        { titulo: "Manutenção", peso: 13 },
      ],
      lotes.flatMap((l) =>
        l.linhas.map(({ produto: x }) => [
          l.lote.numero,
          nomeDoProduto(x, pedido.natureza) || "—",
          DIREITOS_USO[x.direitoUso],
          MODALIDADES[x.modalidade],
          x.metrica === "" ? "—" : METRICAS[x.metrica].singular,
          formatarNumero(x.quantidade),
          periodoPorExtenso(x.periodoMeses),
          x.manutencao === "aParte" ? "À parte" : MANUTENCOES[x.manutencao],
        ]),
      ),
      { sz: 16 },
    ),
  );

  if (c.prazo.ligada) {
    ponto3("Prazo de disponibilização");
    p.push(recuado(`${c.prazo.texto.trim().replace(/[.;]+$/, "")}: ${c.prazo.diasUteis} dias úteis.`));
  }

  ponto3("Âmbito da licença");
  p.push(recuado(c.ambito.texto.trim()));
  if (c.ambito.entidades.trim() !== "") p.push(recuado(`Entidades abrangidas: ${c.ambito.entidades.trim().replace(/[.;]+$/, "")}.`));
  if (c.ambito.naoProdutivosSemCusto)
    p.push(
      recuado(
        "A utilização em ambientes não produtivos (teste, formação e recuperação) não é contabilizada para efeitos " +
          "de licenciamento nem dá lugar a qualquer custo adicional.",
      ),
    );

  ponto3("Direito de uso e transmissão");
  p.push(recuado(c.direitoUso.texto.trim()));
  if (c.direitoUso.transmissao)
    p.push(
      recuado(
        "As licenças podem ser transmitidas, sem custo, a outra entidade do Serviço Nacional de Saúde, mediante " +
          "comunicação prévia ao adjudicatário.",
      ),
    );

  ponto3("Manutenção e atualizações");
  p.push(recuado(c.manutencao.texto.trim()));

  if (c.suporte.ligada) {
    ponto3("Suporte técnico e níveis de serviço (SLA)");
    p.push(recuado(c.suporte.texto.trim()));
    p.push(recuado(`Horário do suporte: ${HORARIOS_SUPORTE[c.suporte.horario].toLowerCase()}.`));
    const tempos = [c.suporte.critica, c.suporte.alta, c.suporte.normal];
    p.push(
      tabela(
        [
          { titulo: "Severidade", peso: 16 },
          { titulo: "Definição", peso: 48 },
          { titulo: "Tempo máximo de resposta", alinhamento: "direita", peso: 18 },
          { titulo: "Tempo máximo de resolução", alinhamento: "direita", peso: 18 },
        ],
        DEFINICAO_SEVERIDADES.map(([sev, def], i) => [
          sev,
          def,
          `${formatarNumero(tempos[i].resposta)} h`,
          `${formatarNumero(tempos[i].resolucao)} h`,
        ]),
        {
          legenda:
            c.suporte.horario === "uteis"
              ? "Tempos contados em horas do horário de suporte, a partir da abertura do pedido."
              : "Tempos contados em horas seguidas, a partir da abertura do pedido.",
        },
      ),
    );
  }

  if (c.disponibilidade.ligada) {
    ponto3("Disponibilidade do serviço");
    p.push(recuado(c.disponibilidade.texto.trim()));
    p.push(
      recuado(
        `Disponibilidade mensal mínima: ${formatarNumero(c.disponibilidade.percentagem)} %.` +
          (c.disponibilidade.janelasForaDoHorario
            ? " As janelas de manutenção são agendadas fora do horário de funcionamento (dias úteis, das 9h às 18h) e comunicadas com, pelo menos, 5 dias úteis de antecedência."
            : ""),
      ),
    );
  }

  ponto3("Penalizações");
  p.push(recuado(c.penalizacoes.texto.trim()));
  const pen = [
    ...(c.suporte.ligada
      ? [
          `Por cada hora de atraso na resolução de um incidente de severidade crítica, face ao tempo máximo fixado: ${formatarNumero(
            c.penalizacoes.porHoraCritica,
          )} % do valor mensal do contrato`,
        ]
      : [`Por cada hora de atraso no cumprimento das obrigações de serviço: ${formatarNumero(c.penalizacoes.porHoraCritica)} % do valor mensal do contrato`]),
    ...(c.disponibilidade.ligada
      ? ["Por cada décima de ponto percentual abaixo da disponibilidade mínima: a mesma percentagem do valor mensal do contrato"]
      : []),
    `Limite mensal das penalizações: ${formatarNumero(c.penalizacoes.limiteMensal)} % do valor mensal do contrato`,
    `Limite global: ${formatarNumero(c.penalizacoes.limiteGlobal)} % do preço contratual, nos termos do artigo 329.º do CCP`,
  ];
  comPontuacao(pen).forEach((t, i) => p.push(alinea(`${letra(i)}.`, t, RECUO_ALINEA)));
  p.push(
    recuado(
      "Entende-se por valor mensal do contrato o preço contratual do lote a dividir pelo número de meses do contrato.",
      { antes: 80 },
    ),
  );

  for (const propria of c.proprias) {
    ponto3(propria.titulo.trim() || "Condição");
    p.push(recuado(propria.texto.trim()));
  }

  if (lotes.length > 1 && pedido.umLotePorConcorrente) {
    const regras = blocosUmLotePorConcorrente({ umLotePorConcorrente: true, lotes: lotes.map((l) => l.lote) });
    ponto3("Regras de adjudicação dos lotes");
    for (const bloco of regras.filter((b): b is Extract<BlocoDocumento, { tipo: "lista" }> => b.tipo === "lista"))
      p.push(lista(bloco, RECUO_ALINEA));
  }

  ponto3("Preço e proposta");
  p.push(
    recuado(
      "O preço é o único aspeto da execução do contrato submetido à concorrência; os requisitos e as condições " +
        "constantes do presente anexo são termos e condições do contrato a celebrar, que a proposta não pode " +
        "contrariar. O concorrente apresenta o preço no mapa de quantidades e preços de cada lote, sem IVA" +
        (determinado ? "." : ", identificando, em cada linha, o produto, o fabricante e a versão propostos."),
    ),
  );

  return p.join("");
}

/**
 * A manifestação de necessidades de um pedido de licenciamento.
 *
 * Recebe o pedido como está gravado — com os preços de referência — e aplica-lhe
 * a margem prudencial antes de escrever qualquer número.
 */
export async function gerarManifestacaoLicenciamentoBlob(
  original: PedidoLicenciamento,
  quando = new Date(),
): Promise<Blob> {
  const pedido = comMargemLicenciamento(original);
  const aberto = await abrirModeloDaManifestacao();
  const { modelo, anterior, sect, relacao } = aberto;
  let xml = corpoLicenciamento(original, pedido, modelo, anterior, quando);

  // As duas folhas do eAvalia, de pé: o alinhamento e os custos do licenciamento.
  const eavalia = new Uint8Array(await (await gerarEavaliaLicenciamentoBlob(pedido, quando)).arrayBuffer());
  const espaco = {
    largura: LARGURA_EM_RETRATO / DXA_POR_PIXEL,
    alturaPrimeira: (ALTURA_EM_RETRATO - RESERVA_DO_TITULO) / DXA_POR_PIXEL,
    alturaSeguintes: ALTURA_EM_RETRATO / DXA_POR_PIXEL,
  };
  const alinhamento = await paginasDoAlinhamento(await lerFolhaDoAlinhamento(eavalia), espaco);
  const custos = await paginasDoAlinhamento(await lerFolhaDosCustosLicenciamento(eavalia, pedido), espaco);

  const tituloAnexo = (texto: string) =>
    paragrafo([run(texto, { negrito: true })], { jc: "center", novaPagina: true, depois: 240, comOSeguinte: true });
  xml += tituloAnexo("Anexo IV – Alinhamento Tecnológico (eAvalia)");
  xml += paragrafo(
    "Reprodução da folha «Alinhamento Tecnológico» do pedido de parecer prévio eAvalia que acompanha a presente " +
      "informação, com as respostas às medidas de alinhamento tecnológico.",
  );
  xml +=
    alinhamento.length > 0
      ? paginasDeImagem(alinhamento, "eAvalia — Alinhamento Tecnológico", { docPr: 1000, relacao: "rIdEavalia", ficheiro: "eavalia" }, relacao)
      : paragrafo([marcador("folha do alinhamento tecnológico — desenhada no browser")]);
  xml += tituloAnexo("Anexo V – Custos - Licenciamento (eAvalia)");
  xml += paragrafo(
    "Reprodução da folha «Custos - Licenciamento» do pedido de parecer prévio eAvalia que acompanha a presente " +
      "informação, com a classificação, o preço unitário e o número de licenças de cada produto.",
  );
  xml +=
    custos.length > 0
      ? paginasDeImagem(custos, "eAvalia — Custos - Licenciamento", { docPr: 2000, relacao: "rIdCustos", ficheiro: "custos" }, relacao)
      : tabela(
          [
            { titulo: "Produto", peso: 34 },
            { titulo: "Tipo de solução", peso: 22 },
            { titulo: "Quantidade", alinhamento: "direita", peso: 12 },
            { titulo: "Licenças (s/ IVA)", alinhamento: "direita", peso: 16 },
            { titulo: "Manutenção (s/ IVA)", alinhamento: "direita", peso: 16 },
          ],
          valoresDosLotes(pedido).flatMap((l) =>
            l.linhas.map(({ produto: x, valor }) => [
              nomeDoProduto(x, pedido.natureza) || "—",
              x.eavalia.tipoSolucao || "—",
              formatarNumero(x.quantidade),
              formatarMoeda(valor.licencas),
              valor.manutencao > 0 ? formatarMoeda(valor.manutencao) : "—",
            ]),
          ),
        );
  xml += sect;
  return fecharManifestacao(aberto, xml);
}

/** O título do PDF: o n.º da informação e o nome do procedimento. */
export function tituloDoPdfLicenciamento(pedido: PedidoLicenciamento): string {
  return `Informação ${pedido.numeroInformacao.trim()} — ${nomeProcedimentoLicenciamento(pedido.nomeProjeto) || pedido.nomeProjeto.trim()}`;
}
