// Conteúdo do caderno de encargos e das regras para o programa do concurso,
// construído a partir do agrupamento em lotes.
//
// As regras seguem as normas fornecidas pela organização, mas apresentadas em
// secções e não em artigos: a inserção sistemática e a numeração dos artigos
// são feitas depois, na redação do procedimento.

import type { LotesJSON, PerfilJSON, PostoTrabalho } from "./types";
import { LOCAIS_POSTO, regimeTemLocal } from "./types";
import { agruparPorExigencia, certificacoesDoPerfil, conteudoFuncionalDoPerfil } from "./perfil";
import {
  anosPlurianuais,
  formatarMoeda,
  formatarNumero,
  linhasPlurianuais,
  linhasTabelaValores,
  taxaIva,
  totaisPorAnoDoLote,
  totaisPorAnoPlurianual,
  totalLote,
  totalProcedimento,
} from "./lotes";
import { celula, type BlocoDocumento, type Documento } from "./documento";

const DIREITA = "direita" as const;

function tabelaPrecoBase(config: LotesJSON): BlocoDocumento {
  const taxa = taxaIva(config);
  const linhas = linhasTabelaValores(config).map((l) => [
    celula(l.lote),
    celula(l.perfil),
    celula(String(l.nMinimoElementos), DIREITA),
    celula(formatarNumero(l.horas), DIREITA),
    celula(formatarMoeda(l.valorHora), DIREITA),
    celula(formatarMoeda(l.valores.semIva), DIREITA),
    celula(formatarMoeda(l.valores.comIva), DIREITA),
  ]);

  for (const lote of config.lotes) {
    const total = totalLote(lote, taxa);
    linhas.push([
      celula(lote.numero, undefined, true),
      celula(`Subtotal do lote ${lote.numero}`, undefined, true),
      celula("", DIREITA, true),
      celula("", DIREITA, true),
      celula("", DIREITA, true),
      celula(formatarMoeda(total.semIva), DIREITA, true),
      celula(formatarMoeda(total.comIva), DIREITA, true),
    ]);
  }

  const total = totalProcedimento(config);
  linhas.push([
    celula("", undefined, true),
    celula("Preço base total do procedimento", undefined, true),
    celula("", DIREITA, true),
    celula("", DIREITA, true),
    celula("", DIREITA, true),
    celula(formatarMoeda(total.semIva), DIREITA, true),
    celula(formatarMoeda(total.comIva), DIREITA, true),
  ]);

  return {
    tipo: "tabela",
    legenda: `Preço base por lote e perfil. Os preços unitários por hora são apresentados sem IVA; a taxa aplicada é de ${formatarNumero(taxa)}%.`,
    colunas: [
      { titulo: "Lote", peso: 6 },
      { titulo: "Perfil", peso: 26 },
      { titulo: "N.º mín. elementos", alinhamento: DIREITA, peso: 12 },
      { titulo: "Horas", alinhamento: DIREITA, peso: 10 },
      { titulo: "Preço/hora (s/ IVA)", alinhamento: DIREITA, peso: 14 },
      { titulo: "Preço base (s/ IVA)", alinhamento: DIREITA, peso: 16 },
      { titulo: "Preço base (c/ IVA)", alinhamento: DIREITA, peso: 16 },
    ],
    linhas,
  };
}

/**
 * Conteúdo funcional do perfil, uma atividade por linha.
 *
 * Fica logo abaixo da tabela de requisitos do mesmo perfil, e nunca sai em
 * Excel: descreve o trabalho a contratar, não algo que o candidato declare.
 */
function tabelaConteudoFuncional(perfil: PerfilJSON): BlocoDocumento[] {
  const atividades = conteudoFuncionalDoPerfil(perfil);
  if (atividades.length === 0) return [];

  return [
    {
      tipo: "tabela",
      colunas: [{ titulo: "Conteúdo Funcional do Perfil", peso: 100 }],
      linhas: atividades.map((atividade) => [celula(atividade)]),
    },
  ];
}

/**
 * Certificações exigidas ao elemento, uma por linha.
 *
 * O campo é opcional, e a tabela só existe quando alguma foi indicada — um
 * quadro vazio intitulado "Certificações" leria como "nenhuma é exigida", que
 * é coisa diferente de não haver quadro nenhum.
 *
 * A certificação não é apurada por esta ferramenta: verifica-se contra as peças
 * da proposta. Por isso vive só aqui e no programa do concurso, e não chega a
 * nenhum formulário Excel.
 */
function tabelaCertificacoes(perfil: PerfilJSON): BlocoDocumento[] {
  const exigidas = certificacoesDoPerfil(perfil);
  if (exigidas.length === 0) return [];

  return [
    {
      tipo: "tabela",
      colunas: [{ titulo: "Certificações", peso: 100 }],
      linhas: exigidas.map((certificacao) => [celula(certificacao)]),
    },
  ];
}

function blocosDeRequisitos(config: LotesJSON): BlocoDocumento[] {
  return config.lotes.flatMap((lote) => {
    const cabecalho: BlocoDocumento = {
      tipo: "titulo",
      nivel: 2,
      texto: lote.designacao.trim() === "" ? `Lote ${lote.numero}` : `Lote ${lote.numero} — ${lote.designacao}`,
    };

    const perfis = lote.perfis.flatMap((entrada): BlocoDocumento[] => [
      { tipo: "titulo", nivel: 3, texto: entrada.perfil.perfil },
      {
        tipo: "paragrafo",
        texto:
          `O concorrente apresenta, para este perfil, um mínimo de ${entrada.nMinimoElementos} ` +
          `${entrada.nMinimoElementos === 1 ? "elemento" : "elementos"}. ` +
          `Cada elemento proposto satisfaz, cumulativamente, os requisitos mínimos de experiência profissional ` +
          `constantes da tabela seguinte.`,
      },
      {
        tipo: "tabela",
        colunas: [
          { titulo: "Requisito", peso: 62 },
          { titulo: "Experiência mínima", alinhamento: DIREITA, peso: 19 },
          { titulo: "Equivalente em meses", alinhamento: DIREITA, peso: 19 },
        ],
        linhas: agruparPorExigencia(entrada.perfil.requisitos).flatMap((grupo) =>
          grupo.designacoes.map((designacao) => [
            celula(designacao),
            celula(`${grupo.anosMinimos} ${grupo.anosMinimos === 1 ? "ano" : "anos"}`, DIREITA),
            celula(String(grupo.mesesMinimos), DIREITA),
          ]),
        ),
      },
      ...tabelaCertificacoes(entrada.perfil),
      ...tabelaConteudoFuncional(entrada.perfil),
    ]);

    return [cabecalho, ...perfis];
  });
}

/** Preço base e requisitos por lote e perfil. */
/**
 * Pedido de autorização para assumir encargos em anos económicos futuros.
 *
 * Só sai quando o procedimento o leva. A tabela repete a do Módulo 2 linha por
 * linha, com os anos já resolvidos em datas: quem lê a peça não tem de saber o
 * que é o «ano n+1».
 */
function blocosEncargosPlurianuais(config: LotesJSON): BlocoDocumento[] {
  const encargos = config.encargosPlurianuais;
  if (!encargos.ativo) return [];

  const anos = anosPlurianuais(encargos.anoInicio);
  const linhas = linhasPlurianuais(config).map((linha) => [
    celula(String(linha.pessoas), DIREITA),
    celula(linha.perfil),
    celula(formatarMoeda(linha.valorHoraSemIva), DIREITA),
    celula(formatarMoeda(linha.valorHoraComIva), DIREITA),
    celula(linha.lote, DIREITA),
    // O valor de cada ano leva consigo as horas de que resulta: sem elas, um
    // ano a zero parece um lapso em vez da decisão que é.
    ...linha.totais.map((total, i) =>
      celula(`${formatarMoeda(total)} (${formatarNumero(linha.horas[i])} h)`, DIREITA),
    ),
  ]);

  // Com um lote só, o subtotal seria o total repetido uma linha acima.
  if (config.lotes.length > 1) {
    for (const lote of config.lotes) {
      linhas.push([
        celula("", DIREITA, true),
        celula(`Subtotal do lote ${lote.numero}`, undefined, true),
        celula("", DIREITA, true),
        celula("", DIREITA, true),
        celula(lote.numero, DIREITA, true),
        ...totaisPorAnoDoLote(config, lote.id).map((total) => celula(formatarMoeda(total), DIREITA, true)),
      ]);
    }
  }

  const totais = totaisPorAnoPlurianual(config);
  linhas.push([
    celula("", DIREITA, true),
    celula("Total a assumir", undefined, true),
    celula("", DIREITA, true),
    celula("", DIREITA, true),
    celula("", DIREITA, true),
    ...totais.map((total) => celula(formatarMoeda(total), DIREITA, true)),
  ]);

  return [
    { tipo: "titulo", nivel: 1, texto: "Pedido de encargos plurianuais" },
    {
      tipo: "paragrafo",
      texto:
        "A execução do contrato em período superior a 12 meses assegura a estabilidade dos recursos afetos ao " +
        "projeto, evitando o consumo adicional de horas em transferência de conhecimento e a quebra de ritmo dos " +
        "desenvolvimentos em curso.",
    },
    {
      tipo: "paragrafo",
      texto:
        `Os encargos a assumir respeitam ao ano económico do início do contrato, ${anos[0]}, e aos dois anos ` +
        `económicos seguintes, ${anos[1]} e ${anos[2]}.`,
    },
    {
      tipo: "paragrafo",
      texto:
        "As horas contratadas para cada perfil repartem-se pelos anos económicos indicados, sendo o encargo de " +
        "cada ano o produto do número de elementos pelas horas desse ano e pelo preço unitário por hora.",
    },
    {
      tipo: "tabela",
      legenda: "Encargos a assumir por ano económico, com IVA incluído, e horas de que resultam.",
      colunas: [
        { titulo: "Pessoas", alinhamento: DIREITA, peso: 8 },
        { titulo: "Perfil", peso: 24 },
        { titulo: "Rate (€/h) s/ IVA", alinhamento: DIREITA, peso: 11 },
        { titulo: "Rate (€/h) c/ IVA", alinhamento: DIREITA, peso: 11 },
        { titulo: "Lotes", alinhamento: DIREITA, peso: 6 },
        ...anos.map((ano) => ({ titulo: `Total € c/ IVA ${ano}`, alinhamento: DIREITA, peso: 13 })),
      ],
      linhas,
    },
    {
      // A tabela dos anos exprime-se toda com IVA. O preço base do procedimento
      // é elemento da peça e não pode sair dela por essa via.
      tipo: "paragrafo",
      texto:
        `O preço base do procedimento é de ${formatarMoeda(totalProcedimento(config).semIva)}, sem IVA, ` +
        `correspondendo a ${formatarMoeda(totalProcedimento(config).comIva)} com IVA à taxa legal em vigor.`,
    },
  ];
}

function blocosPrecoBaseERequisitos(config: LotesJSON): BlocoDocumento[] {
  // Ou uma tabela, ou outra: com pedido plurianual, a repartição por anos é o
  // preço base, e as duas juntas obrigavam a lê-las uma contra a outra.
  const precoBase: BlocoDocumento[] = config.encargosPlurianuais.ativo
    ? blocosEncargosPlurianuais(config)
    : [{ tipo: "titulo", nivel: 1, texto: "Preço base" }, tabelaPrecoBase(config)];

  return [
    ...precoBase,
    { tipo: "titulo", nivel: 1, texto: "Requisitos mínimos de experiência profissional" },
    ...blocosDeRequisitos(config),
  ];
}

// --------------------------------------------------------------------------
// Posto de trabalho
// --------------------------------------------------------------------------

/** Os locais escolhidos, numa linha. "Outro" leva consigo o sítio indicado. */
function locaisEscolhidos(posto: PostoTrabalho): string {
  const escolhidos = LOCAIS_POSTO.filter((local) => posto.locais.includes(local)).map((local) => {
    if (local !== "Outro") return local;
    return posto.outroLocal.trim() === "" ? "Outro" : `Outro: ${posto.outroLocal.trim()}`;
  });
  // Um lugar por indicar não é o mesmo que nenhum lugar: numa peça de
  // procedimento, uma célula em branco lê-se como esquecimento.
  return escolhidos.length === 0 ? "(por indicar)" : escolhidos.join("; ");
}

/**
 * Requisitos do equipamento, tal como foram escritos, um por linha da tabela.
 *
 * O texto é livre e multilinha. Uma primeira linha terminada em dois pontos é
 * introdução, e encabeça a tabela — não fica solta por cima dela, que era ler
 * duas vezes a mesma coisa: o cabeçalho anuncia o que a tabela enumera. Sem
 * essa linha, encabeça-a o nome do campo. As restantes linhas são
 * características, uma por linha da tabela.
 */
const TITULO_REQUISITOS_EQUIPAMENTO = "Requisitos mínimos do equipamento do prestador";

function tabelaDosRequisitosDeEquipamento(texto: string): BlocoDocumento[] {
  const linhas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
  if (linhas.length === 0) return [];

  const temIntroducao = linhas[0].endsWith(":");
  const caracteristicas = temIntroducao ? linhas.slice(1) : linhas;
  if (caracteristicas.length === 0) return [];

  return [
    {
      tipo: "tabela",
      colunas: [{ titulo: temIntroducao ? linhas[0] : TITULO_REQUISITOS_EQUIPAMENTO, peso: 100 }],
      linhas: caracteristicas.map((c) => [celula(c)]),
    },
  ];
}

/**
 * Condições de execução do contrato: em que regime se presta o serviço, onde,
 * e com que equipamento.
 *
 * Sai só o que ficou escolhido, e em tabela: é o que uma peça de procedimento
 * fixa — as opções ponderadas e postas de lado ficam no rascunho, não no
 * documento que vincula.
 *
 * O regime comanda o resto: em regime remoto não há local a indicar, e a
 * linha do local nem chega a existir.
 */
function blocosPostoTrabalho(config: LotesJSON): BlocoDocumento[] {
  const posto = config.postoTrabalho;

  const condicoes = [
    [celula("Regime da prestação de serviços"), celula(posto.regime)],
    ...(regimeTemLocal(posto.regime)
      ? [[celula("Local da prestação de serviços"), celula(locaisEscolhidos(posto))]]
      : []),
    [celula("Equipamentos para os recursos"), celula(posto.equipamento)],
  ];

  return [
    { tipo: "titulo", nivel: 1, texto: "Posto de trabalho" },
    {
      tipo: "tabela",
      colunas: [
        { titulo: "Condição", peso: 34 },
        { titulo: "Opção fixada", peso: 66 },
      ],
      linhas: condicoes,
    },
    ...(posto.equipamento === "Equipamentos do Prestador"
      ? tabelaDosRequisitosDeEquipamento(posto.requisitosEquipamento)
      : []),
  ];
}

// --------------------------------------------------------------------------
// Regras para o Programa do Concurso
// --------------------------------------------------------------------------

/** Número de blocos do formulário, igual em todos: é do procedimento. */
function descricaoBlocos(config: LotesJSON): string {
  return `Cada formulário comporta ${config.nBlocos} blocos de projeto.`;
}

/**
 * Limitação de adjudicação a um lote por concorrente.
 *
 * Tem título próprio, e não é mais um número na lista das regras de apuramento:
 * altera o resultado do procedimento para lá do apuramento da experiência, e
 * quem prepara as peças tem de dar por ela.
 */
function blocosUmLotePorConcorrente(config: LotesJSON): BlocoDocumento[] {
  if (!config.umLotePorConcorrente) return [];

  return [
    { tipo: "titulo", nivel: 1, texto: "Limitação de adjudicação a um lote por concorrente" },
    {
      tipo: "lista",
      numerada: true,
      itens: [
        "A cada concorrente não pode ser adjudicado mais do que um lote do presente procedimento.",
        "Para efeitos do número anterior, as propostas são apreciadas pela ordem crescente do número do lote.",
        "O concorrente a quem tenha sido adjudicado um lote fica impedido de o ser em qualquer lote subsequente, ainda que a sua proposta a esse lote satisfaça todos os requisitos.",
      ],
    },
  ];
}

/**
 * Documento único do procedimento: preço base, requisitos e regras.
 *
 * Um só título — o das regras — e todo o resto em secções debaixo dele. As
 * regras vão em secções e não em artigos: a numeração e a inserção sistemática
 * ficam para a redação das peças.
 */
export function documentoRegrasEPrecoBase(config: LotesJSON): Documento {
  return {
    titulo: "Regras de comprovação e apuramento da experiência profissional",
    blocos: [
      ...blocosPrecoBaseERequisitos(config),

      ...blocosPostoTrabalho(config),

      ...blocosUmLotePorConcorrente(config),

      { tipo: "titulo", nivel: 1, texto: "Regras de apuramento da experiência" },
      {
        // Uma só numeração para todas as regras, sem secções pelo meio: as
        // remissões entre normas ("nos termos do n.º 2") só são inequívocas se
        // a sequência correr de fio a pavio. As causas de exclusão vão numa
        // única regra, com alíneas em (i)/(ii)/(iii), para não quebrar a série.
        tipo: "lista",
        numerada: true,
        itens: [
          "Para efeitos de verificação dos requisitos mínimos de experiência profissional fixados no Anexo Técnico, o concorrente apresenta, relativamente a cada elemento proposto, o formulário de declaração de experiência profissional, em modelo disponibilizado pela entidade adjudicante como anexo ao Programa do Concurso.",
          "O formulário é preenchido e assinado pelo próprio titular da experiência nele declarada, mediante assinatura eletrónica qualificada, não sendo admissível a sua substituição por assinatura do representante do concorrente.",
          `${descricaoBlocos(config)} Sempre que o número de projetos a declarar exceda essa capacidade, poderão ser apresentados tantos exemplares do formulário quantos os necessários, todos preenchidos e assinados nos termos do número anterior e identificados sequencialmente, não existindo limite ao número de exemplares admitidos.`,
          "Em cada bloco de projeto preenchido, o campo relativo a cada um dos requisitos constantes da lista deve conter a indicação «SIM» ou «NÃO».",
          "O formulário não prevê a indicação de que o projeto se encontra em curso. Sempre que, à data do preenchimento, o projeto ainda não tenha terminado, indica-se como fim do projeto o mês e o ano em que o formulário é preenchido.",
          "O formulário de declaração de experiência profissional deve ser submetido no formato de folha de cálculo disponibilizado pela entidade adjudicante, sem alteração da respetiva estrutura. O referido formulário deverá ser apresentado em duas versões, correspondentes ao mesmo conteúdo: (i) uma versão em formato editável (folha de cálculo); e (ii) uma versão em formato PDF, devidamente assinada mediante recurso a assinatura eletrónica qualificada.",
          "Em caso de divergência entre a versão em folha de cálculo e a versão em PDF submetidas, prevalece esta última.",
          "São excluídas as propostas relativamente às quais se verifique, quanto a qualquer dos elementos propostos: (i) a falta de apresentação do formulário de declaração de experiência profissional; (ii) a falta de assinatura do PDF do formulário de declaração de experiência profissional, mediante assinatura eletrónica qualificada pelo próprio titular da experiência; ou (iii) a alteração da estrutura do formulário disponibilizado, designadamente por supressão, aditamento ou modificação de folhas, linhas, colunas ou rótulos.",
          "Os períodos declarados devem corresponder ao tempo de dedicação efetiva do elemento ao requisito em causa, cabendo ao titular delimitá-los nos campos de datas próprios da linha do requisito sempre que a dedicação não tenha sido integral ao longo do período do projeto.",
          "A experiência é apurada em meses de calendário completos, autonomamente para cada um dos requisitos constantes do Anexo Técnico.",
          "São contados o mês de calendário em que se inicia e o mês de calendário em que termina o período declarado.",
          "Quando o campo relativo a um requisito não contenha a indicação «SIM» ou «NÃO», considera-se, quanto a esse bloco, que não foi declarada experiência no requisito em causa.",
          "Se vários projetos forem apresentados para demonstrar o cumprimento do mesmo requisito e os respetivos períodos de execução abrangerem os mesmos meses, esses meses são contabilizados apenas uma vez para esse requisito.",
          "Quando os campos de datas da linha de um requisito se encontrem em branco, considera-se declarado que a experiência nesse requisito ocorreu durante a totalidade do período do projeto indicado no respetivo bloco.",
          "Quando os campos de datas da linha de um requisito se encontrem parcialmente preenchidos apenas o mês ou apenas o ano, de início ou de fim, considera-se não declarada, quanto a esse bloco, a experiência no requisito em causa.",
          "Quando os campos de datas da linha de um requisito se encontrem integralmente preenchidos, releva exclusivamente o período neles delimitado.",
          "As datas declaradas na linha de um requisito situam-se dentro do período do projeto indicado no respetivo bloco. Caso não se situem, o período declarado não é admitido, considerando-se, quanto a esse bloco, que não foi declarada experiência no requisito em causa.",
          "Não é admitida experiência cujo período se prolongue para além do mês e ano em que o formulário é preenchido: experiência ainda por decorrer não é experiência adquirida.",
          "Quando o bloco de projeto não identifique o cliente ou entidade, o projeto, a função desempenhada, o início do projeto ou o fim do projeto, considera-se não declarada, nesse bloco, a experiência em todos os requisitos.",
          "Os requisitos mínimos exprimem-se em meses inteiros, não havendo lugar a arredondamento.",
        ],
      },
    ],
  };
}
