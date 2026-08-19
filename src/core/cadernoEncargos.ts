// Conteúdo do caderno de encargos e das regras para o programa do concurso,
// construído a partir do agrupamento em lotes.
//
// As regras seguem as normas fornecidas pela organização, mas apresentadas em
// secções e não em artigos: a inserção sistemática e a numeração dos artigos
// são feitas depois, na redação do procedimento.

import type { LotesJSON } from "./types";
import { agruparPorExigencia } from "./perfil";
import { formatarMoeda, formatarNumero, linhasTabelaValores, taxaIva, totalLote, totalProcedimento } from "./lotes";
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
    ]);

    return [cabecalho, ...perfis];
  });
}

/** Anexo técnico: requisitos por lote e perfil, mais o preço base. */
export function documentoCadernoEncargos(config: LotesJSON): Documento {
  return {
    titulo: "Requisitos mínimos de experiência profissional e preço base",
    subtitulo: "Conteúdo para o Caderno de Encargos e respetivo Anexo Técnico",
    blocos: [
      { tipo: "titulo", nivel: 1, texto: "Preço base" },
      tabelaPrecoBase(config),
      {
        tipo: "paragrafo",
        texto:
          "O preço base de cada perfil corresponde ao produto do número de horas estimadas pelo preço unitário " +
          "máximo por hora. O número mínimo de elementos não concorre para o cálculo do preço base, por constituir " +
          "condição de admissibilidade da proposta e não quantidade contratada.",
      },
      { tipo: "titulo", nivel: 1, texto: "Requisitos mínimos de experiência profissional" },
      {
        tipo: "paragrafo",
        texto:
          "A experiência mínima é fixada em anos completos e apurada em meses de calendário, nos termos das regras " +
          "de comprovação e apuramento constantes do Programa do Concurso.",
      },
      ...blocosDeRequisitos(config),
    ],
  };
}

// --------------------------------------------------------------------------
// Regras para o Programa do Concurso
// --------------------------------------------------------------------------

/**
 * Número de blocos do formulário. Quando os perfis divergem, não se afirma um
 * número — seria falso para parte dos formulários.
 */
function descricaoBlocos(config: LotesJSON): string {
  const valores = new Set(config.lotes.flatMap((l) => l.perfis.map((e) => e.perfil.nBlocos)));
  if (valores.size === 1) {
    const n = [...valores][0];
    return `Cada formulário comporta ${n} blocos de projeto.`;
  }
  return "Cada formulário comporta o número de blocos de projeto nele previsto.";
}

/** Regras de comprovação e apuramento, em secções e não em artigos. */
export function documentoProgramaConcurso(config: LotesJSON): Documento {
  return {
    titulo: "Comprovação e apuramento da experiência profissional",
    subtitulo: "Conteúdo para o Programa do Concurso — a validar juridicamente",
    blocos: [
      { tipo: "titulo", nivel: 1, texto: "Comprovação da experiência profissional" },
      {
        tipo: "lista",
        numerada: true,
        itens: [
          "Para efeitos de verificação dos requisitos mínimos de experiência profissional fixados no Anexo Técnico, o concorrente apresenta, relativamente a cada elemento proposto, o formulário de declaração de experiência profissional, em modelo disponibilizado pela entidade adjudicante como anexo ao Programa do Concurso.",
          "O formulário é preenchido e assinado pelo próprio titular da experiência nele declarada, mediante assinatura eletrónica qualificada, não sendo admissível a sua substituição por assinatura do representante do concorrente.",
          `${descricaoBlocos(config)} Sempre que o número de projetos a declarar exceda essa capacidade, são apresentados tantos exemplares do formulário quantos os necessários, todos preenchidos e assinados nos termos do número anterior e identificados sequencialmente, não existindo limite ao número de exemplares admitidos.`,
          "Em cada bloco de projeto preenchido, o campo relativo a cada um dos requisitos constantes da lista deve conter obrigatoriamente a indicação «SIM» ou «NÃO», não sendo admitidos campos por preencher.",
          "Para efeitos do número anterior, considera-se preenchido o bloco de projeto em que conste qualquer elemento identificativo do cliente ou entidade, do projeto ou do período declarado.",
          "O formulário é apresentado no formato de folha de cálculo disponibilizado, sem alteração da respetiva estrutura, sendo simultaneamente apresentada uma versão em formato PDF do mesmo conteúdo, assinada nos termos do n.º 2.",
          "Em caso de divergência entre a versão em folha de cálculo e a versão em PDF, prevalece esta última.",
        ],
      },

      { tipo: "titulo", nivel: 1, texto: "Exclusão" },
      {
        tipo: "paragrafo",
        texto:
          "São excluídas as propostas relativamente às quais se verifique, quanto a qualquer dos elementos propostos:",
      },
      {
        tipo: "lista",
        itens: [
          "A falta de apresentação do formulário de declaração de experiência profissional;",
          "A falta de assinatura do formulário pelo próprio titular da experiência, mediante assinatura eletrónica qualificada;",
          "A existência, em bloco de projeto preenchido, de campos relativos a requisitos que não contenham a indicação «SIM» ou «NÃO»;",
          "A alteração da estrutura do formulário disponibilizado, designadamente por supressão, aditamento ou modificação de folhas, linhas, colunas ou rótulos.",
        ],
      },
      {
        tipo: "paragrafo",
        texto:
          "As situações previstas no número anterior respeitam ao conteúdo da proposta e não são passíveis de " +
          "suprimento em momento posterior à data limite para a respetiva apresentação.",
      },

      { tipo: "titulo", nivel: 1, texto: "Correspondência dos períodos declarados" },
      {
        tipo: "paragrafo",
        texto:
          "Os períodos declarados devem corresponder ao tempo de dedicação efetiva do elemento ao requisito em " +
          "causa, cabendo ao titular delimitá-los nos campos de datas próprios da linha do requisito sempre que a " +
          "dedicação não tenha sido integral ao longo do período do projeto.",
      },

      { tipo: "titulo", nivel: 1, texto: "Regra de apuramento da experiência" },
      {
        tipo: "lista",
        numerada: true,
        itens: [
          "A experiência é apurada em meses de calendário completos, autonomamente para cada um dos requisitos constantes do Anexo Técnico.",
          "São contados o mês de calendário em que se inicia e o mês de calendário em que termina o período declarado.",
          "Cada mês de calendário é contado uma única vez relativamente a cada requisito, independentemente do número de blocos de projeto declarados que o abranjam.",
          "O mesmo mês de calendário é contado integralmente para cada um dos requisitos relativamente aos quais tenha sido declarada experiência.",
          "Quando os campos de datas da linha de um requisito se encontrem em branco, considera-se declarado que a experiência nesse requisito ocorreu durante a totalidade do período do projeto indicado no respetivo bloco.",
          "Quando os campos de datas da linha de um requisito se encontrem preenchidos, releva exclusivamente o período neles delimitado.",
          "As datas declaradas na linha de um requisito situam-se dentro do período do projeto indicado no respetivo bloco. Caso não se situem, o período declarado não é admitido, considerando-se, quanto a esse bloco, que não foi declarada experiência no requisito em causa.",
          "Sempre que o período do projeto seja declarado como em curso, o apuramento tem por referência a data limite para a apresentação das propostas.",
          "Os requisitos mínimos são fixados em anos completos e os valores apurados exprimem-se em meses inteiros, não havendo lugar a arredondamento.",
        ],
      },
      {
        tipo: "tabela",
        legenda: "Exemplos de aplicação da regra de apuramento",
        colunas: [
          { titulo: "Situação declarada", peso: 62 },
          { titulo: "Experiência apurada", alinhamento: DIREITA, peso: 38 },
        ],
        linhas: [
          [celula("Um período declarado de 03/2021 a 09/2023."), celula("31 meses", DIREITA)],
          [
            celula(
              "Experiência no requisito A declarada em dois blocos de projeto, de 01/2024 a 12/2025 e de 06/2025 a 12/2025.",
            ),
            celula("24 meses — os meses de 06/2025 a 12/2025 são contados uma única vez", DIREITA),
          ],
          [
            celula("Experiência nos requisitos A e B declarada no mesmo bloco de projeto, de 01/2024 a 12/2025."),
            celula("24 meses no requisito A e 24 meses no requisito B", DIREITA),
          ],
        ],
      },
      {
        tipo: "nota",
        texto:
          "A inserção sistemática destas regras, a sua eventual conversão em artigos e a articulação com as demais " +
          "normas do Programa do Concurso e do Caderno de Encargos devem ser objeto de validação jurídica.",
      },
    ],
  };
}
