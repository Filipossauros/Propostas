// O que se sabe sobre o modelo eAvalia: onde estão as medidas, que respostas
// admitem, e como se escreve numa célula sem lhe estragar o resto.
//
// Vive à parte do gerador porque há dois consumidores: o pedido de parecer de
// um procedimento concreto (`eavalia.ts`) e o ficheiro-padrão que se distribui
// às equipas que não usam a aplicação (`eavaliaPadrao.ts`). O modelo é o mesmo,
// e as linhas das medidas têm de ser as mesmas nos dois.

import type { InformacaoEavalia, RespostaEavalia } from "../core/types";

/**
 * Uma medida do formulário que esta aplicação preenche.
 *
 * `inicioDoTexto` é a guarda contra o modelo mudar debaixo dos pés: se um dia
 * o formulário for substituído por outra versão em que as linhas tenham
 * mudado de sítio, escrever às cegas em E6 poria a resposta na medida errada.
 * Confirma-se antes que a linha ainda é aquela.
 *
 * A resposta ou vem de um campo respondido no Módulo 2 (`campo`), ou é sempre
 * a mesma neste procedimento (`fixa`) e não se pergunta a ninguém.
 */
export interface MedidaBase {
  linha: number;
  inicioDoTexto: string;
}

export type Medida = (MedidaBase & { campo: keyof InformacaoEavalia }) | (MedidaBase & { fixa: RespostaEavalia });

/** Folha "Alinhamento Tecnológico" — a terceira do livro. */
export const FOLHA_ALINHAMENTO = "xl/worksheets/sheet3.xml";
/** Folha "Informação Base da despesa" — a segunda. */
export const FOLHA_DESPESA = "xl/worksheets/sheet2.xml";

/** Célula do objeto da aquisição, fundida de B17 a F17. */
export const CELULA_OBJETO = "B17";

export const MEDIDAS: Medida[] = [
  {
    campo: "iap",
    linha: 6,
    inicioDoTexto: "Reutilização de dados disponíveis por outros serviços ou entidades",
  },
  {
    campo: "sms",
    linha: 8,
    inicioDoTexto: "Adoção da Plataforma de Mensagens da Administração Pública",
  },
  {
    campo: "faturacao",
    linha: 10,
    inicioDoTexto: "Adoção da Plataforma de Pagamentos da Administração Pública",
  },
  {
    campo: "chaveMovelDigital",
    linha: 26,
    inicioDoTexto: "Implementação de mecanismos de autenticação e assinatura disponibilizados pelo Estado",
  },
  {
    campo: "usabilidade",
    linha: 42,
    inicioDoTexto: "Conformidade com as melhores práticas no que respeita a usabilidade",
  },
  {
    campo: "idiomas",
    linha: 44,
    inicioDoTexto: "Disponibilização dos serviços e conteúdos pelo menos nos idiomas português e inglês",
  },
  // Respostas fixas: não são decisões que se tomem procedimento a procedimento
  // — o ponto de troca de tráfego está adotado, e a conformidade com o Quadro
  // Nacional de Referência para a Cibersegurança não se aplica a esta aquisição
  // —, e por isso não há campo por que as perguntar. São também as únicas
  // medidas cuja célula pode já vir preenchida no modelo: o valor que lá esteja
  // é substituído.
  {
    fixa: "Já cumpre",
    linha: 62,
    inicioDoTexto: "Utilização de soluções de comunicações transversais adotadas para a Administração Pública",
  },
  {
    fixa: "Não aplicável",
    linha: 70,
    inicioDoTexto: "Conformidade com o Quadro Nacional de Referência para a Cibersegurança",
  },
];

export class ErroModeloEavalia extends Error {}

/**
 * Respostas que levam data: as que assumem um compromisso para o futuro.
 *
 * A regra é do próprio formulário, e está lá escrita na formatação condicional
 * da célula da data: "Cumpre Totalmente" e "Cumpre Parcialmente" tratam-na de
 * uma maneira, "Já cumpre", "Não cumpre" e "Não aplicável" de outra. Quem já
 * cumpre não tem data por que se comprometer, e a quem não se aplica não há
 * data nenhuma a pedir.
 */
export const RESPOSTAS_COM_DATA: RespostaEavalia[] = ["Cumpre Totalmente", "Cumpre Parcialmente"];

// --------------------------------------------------------------------------
// Manipulação do XML das folhas
// --------------------------------------------------------------------------

function escaparXml(texto: string): string {
  return (
    texto
      // Caracteres de controlo não são admitidos em XML 1.0, e o nome do
      // projeto vem escrito à mão: uma tabulação colada de outro sítio bastava
      // para o ficheiro deixar de abrir.
      // oxlint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
  );
}

/**
 * Escreve numa célula, preservando os atributos que o modelo lhe deu —
 * designadamente `s`, que é o estilo, e é o que dá à data o formato de data.
 *
 * Por omissão exige que a célula esteja vazia (`<c r="E6" s="17"/>`): é a
 * guarda de quem escreve às cegas. `sobrepor` levanta essa exigência, e usa-se
 * nas respostas às medidas — o modelo traz metade delas com um "Não aplicável"
 * por omissão, e a linha já foi confirmada pelo texto da medida.
 *
 * O `t` que a célula tivesse é descartado: o valor novo traz o seu (`inlineStr`
 * no texto, nenhum no número), e duas vezes o mesmo atributo não é XML válido.
 */
export function escreverCelula(
  xml: string,
  ref: string,
  conteudo: (atributos: string) => string,
  sobrepor = false,
): string {
  const vazia = new RegExp(`<c r="${ref}"([^>]*?)/>`);
  const preenchida = new RegExp(`<c r="${ref}"([^>]*?)>[\\s\\S]*?</c>`);

  const encontrada = vazia.exec(xml) ?? (sobrepor ? preenchida.exec(xml) : null);
  if (encontrada === null) {
    throw new ErroModeloEavalia(
      `O modelo eAvalia não tem a célula ${ref} por preencher. ` +
        "O ficheiro-modelo terá sido substituído por outra versão.",
    );
  }

  // Substituição por função: o nome do projeto é texto livre, e um "$&" ou um
  // "$1" lá dentro seria interpretado como padrão se fosse passado como cadeia.
  const substituto = conteudo(encontrada[1].replace(/\s+t="[^"]*"/g, ""));
  return xml.replace(encontrada[0], () => substituto);
}

export function celulaDeTexto(ref: string, atributos: string, valor: string): string {
  // Texto em linha, e não uma entrada na tabela de cadeias partilhadas: assim
  // o sharedStrings.xml do modelo fica byte a byte igual ao original.
  return `<c r="${ref}"${atributos} t="inlineStr"><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`;
}

export function celulaDeNumero(ref: string, atributos: string, valor: number): string {
  return `<c r="${ref}"${atributos}><v>${valor}</v></c>`;
}

/**
 * Data no formato interno do Excel: dias desde 30/12/1899. Conta-se em UTC
 * sobre a data civil, para o resultado não depender do fuso do posto.
 */
export function serieDeData(data: Date): number {
  const dia = Date.UTC(data.getFullYear(), data.getMonth(), data.getDate());
  return Math.round((dia - Date.UTC(1899, 11, 30)) / 86_400_000);
}

// --------------------------------------------------------------------------
// Confirmação de que o modelo é o esperado
// --------------------------------------------------------------------------

/** Textos da tabela de cadeias partilhadas, por índice. */
export function lerCadeiasPartilhadas(xml: string): string[] {
  const cadeias: string[] = [];
  for (const si of xml.match(/<si>[\s\S]*?<\/si>|<si\/>/g) ?? []) {
    const partes = si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? [];
    cadeias.push(
      partes
        .map((t) => t.replace(/<[^>]+>/g, ""))
        .join("")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&"),
    );
  }
  return cadeias;
}

/** O texto da medida na coluna A de uma linha, tal como está no modelo. */
export function textoDaMedida(xml: string, linha: number, cadeias: string[]): string {
  const celula = new RegExp(`<c r="A${linha}"[^>]*t="s"[^>]*><v>(\\d+)</v></c>`).exec(xml);
  if (celula === null) return "";
  return cadeias[Number(celula[1])] ?? "";
}
