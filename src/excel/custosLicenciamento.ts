// A folha «Custos - Licenciamento» do eAvalia, preenchida com as licenças do pedido.
//
// A folha tem duas secções, cada uma com vinte blocos lado a lado — um por
// produto, de três colunas (rótulo, valor, espaço): A–B, D–E, G–H, …, BF–BG.
//
//   Software proprietário (linhas 3–63)      Código aberto (linhas 65–123)
//     5  Tipo de solução                       —
//     7  Tipo                                  66  Tipo
//     9  Âmbito                                68  Âmbito
//    11  Fabricante                            70  Fabricante
//    13  Consulta ao mercado                   72  Consulta ao mercado
//    15  Descrição                             74  Descrição
//    18  Tipo de Licenciamento                 78  Tipo de Licenciamento
//    20  Preço Unitário                        80  Preço Unitário
//    22  N.º de licenças                       82  N.º de licenças
//    24  Custo total (fórmula a partir de H)   84  Custo total (fórmula)
//    40/42/44/46  Manutenção (aquisição)       100/102/104/106
//
// Uma licença «Solução Software Livre» vai para a secção do código aberto; os
// restantes, para a primeira. Os custos indiretos, o hardware, a manutenção
// operacional e os outros custos ficam por preencher: não são objeto do pedido.
//
// O preço unitário é o do período inteiro — na subscrição, o preço/mês vezes
// os meses —, para o custo total da folha (preço × n.º de licenças) dar o
// valor das licenças. A manutenção à parte vai, pelo período, na primeira
// linha da manutenção da aquisição; as outras duas levam 0, porque a fórmula do
// custo total só soma com as três preenchidas.
//
// Como no resto do eAvalia, escreve-se diretamente no XML do modelo, sem o
// reescrever — ver `eavalia.ts`. As fórmulas ficam as do modelo, com o
// resultado já calculado; nas duas células onde o modelo não tem fórmula (B24
// e E24), escreve-se o valor.

import type { Licenca, NaturezaAquisicao, PedidoLicenciamento } from "../core/licenciamento";
import {
  LICENCAS_POR_SECCAO_EAVALIA,
  anosDoPedido,
  consultaMercadoEavalia,
  ehServico,
  lotesEfetivos,
  tipoEavalia,
  tipoLicenciamentoEavalia,
  tipoSolucaoEavalia,
  valorDaLicenca,
} from "../core/licenciamento";
import { celulaDeNumero, celulaDeTexto, ErroModeloEavalia, escreverCelula, textoDaMedida } from "./eavaliaModelo";
import { lerFolhaDoEavalia, type FolhaDesenhavel } from "./folhaDoAlinhamento";

export const FOLHA_CUSTOS_LICENCIAMENTO = "xl/worksheets/sheet5.xml";
export const NOME_FOLHA_CUSTOS_LICENCIAMENTO = "Custos - Licenciamento";

interface LinhasDaSeccao {
  tipoSolucao?: number;
  tipo: number;
  ambito: number;
  fabricante: number;
  consulta: number;
  descricao: number;
  tipoLicenciamento: number;
  preco: number;
  quantidade: number;
  total: number;
  manutencao: [number, number, number, number];
}

const PROPRIETARIO: LinhasDaSeccao = {
  tipoSolucao: 5,
  tipo: 7,
  ambito: 9,
  fabricante: 11,
  consulta: 13,
  descricao: 15,
  tipoLicenciamento: 18,
  preco: 20,
  quantidade: 22,
  total: 24,
  manutencao: [40, 42, 44, 46],
};

const CODIGO_ABERTO: LinhasDaSeccao = {
  tipo: 66,
  ambito: 68,
  fabricante: 70,
  consulta: 72,
  descricao: 74,
  tipoLicenciamento: 78,
  preco: 80,
  quantidade: 82,
  total: 84,
  manutencao: [100, 102, 104, 106],
};

/** A última linha da manutenção de cada secção — até onde se desenha a folha no Word. */
export const ULTIMA_LINHA_PROPRIETARIO = 46;
export const ULTIMA_LINHA_CODIGO_ABERTO = 106;

/** A letra de uma coluna, a contar de 0: 0 → A, 26 → AA. */
export function letraDaColuna(indice: number): string {
  let n = indice + 1;
  let letras = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    letras = String.fromCharCode(65 + r) + letras;
    n = Math.floor((n - 1) / 26);
  }
  return letras;
}

/** A coluna dos valores do bloco `i` (a contar de 0): B, E, H, … */
export function colunaDoBloco(i: number): string {
  return letraDaColuna(i * 3 + 1);
}

function confirmarModelo(xml: string, cadeias: string[]): void {
  const esperado = (linha: number, inicio: string) => {
    if (!textoDaMedida(xml, linha, cadeias).startsWith(inicio)) {
      throw new ErroModeloEavalia(
        `A linha ${linha} da folha «${NOME_FOLHA_CUSTOS_LICENCIAMENTO}» já não é a esperada ("${inicio}…"). ` +
          "O ficheiro-modelo terá sido substituído por outra versão.",
      );
    }
  };
  esperado(1, NOME_FOLHA_CUSTOS_LICENCIAMENTO);
  esperado(5, "Tipo de solução");
  esperado(18, "Tipo de Licenciamento");
  esperado(20, "Preço Unitário");
  esperado(22, "N.º de licenças");
  esperado(40, "Manutenção evolutiva");
  esperado(65, "Software de Código Aberto");
  esperado(66, "Tipo");
  esperado(78, "Tipo de Licenciamento");
  esperado(100, "Manutenção evolutiva");
}

export function ehCodigoAberto(l: Licenca, natureza: NaturezaAquisicao): boolean {
  return tipoSolucaoEavalia(l, natureza) === "Solução Software Livre";
}

/**
 * A descrição do bloco: a licença (e a versão, se determinada). O tipo, o
 * preço e a quantidade já têm células próprias, e a célula não quebra linha.
 */
export function descricaoParaEavalia(l: Licenca, natureza: NaturezaAquisicao): string {
  const nome = (natureza === "determinado" ? l.nomeComercial.trim() : l.designacao.trim()) || "Licença";
  const versao = natureza === "determinado" && l.versao.trim() !== "" ? ` ${l.versao.trim()}` : "";
  return `${nome}${versao}`;
}

/** O preço unitário do período inteiro, como a folha o pede: o custo total da folha é preço × n.º de licenças. */
export function precoParaEavalia(l: Licenca): number {
  if (l.direitoUso !== "temporario") return Number.isFinite(l.precoUnitario) ? l.precoUnitario : 0;
  const quantidade = l.quantidade > 0 ? l.quantidade : 1;
  return Math.round((valorDaLicenca(l).licencas / quantidade) * 100) / 100;
}

/** Fórmula do modelo com o valor já calculado; sem fórmula no modelo, só o valor. */
function comValorCalculado(xml: string, ref: string, valor: number): string {
  const celula = new RegExp(`<c r="${ref}"[^>]*>\\s*<f>([^<]*)</f>`).exec(xml);
  if (celula === null) return escreverCelula(xml, ref, (a) => celulaDeNumero(ref, a, valor));
  const formula = celula[1];
  return escreverCelula(xml, ref, (a) => `<c r="${ref}"${a}><f>${formula}</f><v>${valor}</v></c>`, true);
}

/**
 * Escreve as licenças na folha. `pedido` traz os preços como devem sair — já
 * com a margem prudencial, se a houver.
 */
export function preencherCustosLicenciamento(xml: string, pedido: PedidoLicenciamento, cadeias: string[]): string {
  confirmarModelo(xml, cadeias);
  const nAnos = anosDoPedido(pedido).length;
  const natureza = pedido.natureza;
  const seccoes: Array<[LinhasDaSeccao, Licenca[]]> = [
    [PROPRIETARIO, pedido.licencas.filter((l) => !ehServico(l) && !ehCodigoAberto(l, natureza))],
    [CODIGO_ABERTO, pedido.licencas.filter((l) => !ehServico(l) && ehCodigoAberto(l, natureza))],
  ];
  const servicos = servicosPorLicenca(pedido, nAnos);
  let folha = xml;

  for (const [linhas, licencas] of seccoes) {
    if (licencas.length > LICENCAS_POR_SECCAO_EAVALIA) {
      throw new ErroModeloEavalia(
        `A folha «${NOME_FOLHA_CUSTOS_LICENCIAMENTO}» comporta ${LICENCAS_POR_SECCAO_EAVALIA} licenças por secção.`,
      );
    }
    licencas.forEach((p, i) => {
      const col = colunaDoBloco(i);
      const texto = (linha: number | undefined, valor: string) => {
        if (linha === undefined || valor.trim() === "") return;
        const ref = `${col}${linha}`;
        folha = escreverCelula(folha, ref, (a) => celulaDeTexto(ref, a, valor));
      };
      const numero = (linha: number, valor: number) => {
        const ref = `${col}${linha}`;
        folha = escreverCelula(folha, ref, (a) => celulaDeNumero(ref, a, valor));
      };

      // O tipo, o tipo de licenciamento e a consulta ao mercado decorrem das
      // escolhas do L1: do direito de uso, da modalidade e da natureza.
      texto(linhas.tipoSolucao, tipoSolucaoEavalia(p, natureza));
      texto(linhas.tipo, tipoEavalia(p));
      texto(linhas.ambito, p.eavalia.ambito);
      texto(
        linhas.fabricante,
        // Na aberta, o fabricante só se conhece na proposta; a célula não quebra linha, e o texto é curto.
        pedido.natureza === "determinado" ? p.fabricante : "Indicado na proposta",
      );
      texto(linhas.consulta, consultaMercadoEavalia(natureza, p));
      texto(linhas.descricao, descricaoParaEavalia(p, natureza));
      texto(linhas.tipoLicenciamento, tipoLicenciamentoEavalia(p));

      const preco = precoParaEavalia(p);
      const valor = valorDaLicenca(p, nAnos);
      if (preco > 0) numero(linhas.preco, preco);
      if (p.quantidade > 0) numero(linhas.quantidade, p.quantidade);
      if (preco > 0 && p.quantidade > 0) folha = comValorCalculado(folha, `${col}${linhas.total}`, valor.licencas);

      // A manutenção em linha própria vai na manutenção evolutiva e corretiva;
      // os serviços associados do mesmo lote, na instalação, configuração e
      // atualização. A fórmula do total só soma com as três preenchidas.
      const servico = servicos.get(p.id) ?? 0;
      if (valor.manutencao > 0 || servico > 0) {
        const [evolutiva, instalacao, especializados, total] = linhas.manutencao;
        numero(evolutiva, valor.manutencao);
        numero(instalacao, servico);
        numero(especializados, 0);
        folha = comValorCalculado(folha, `${col}${total}`, Math.round((valor.manutencao + servico) * 100) / 100);
      }
    });
  }
  return folha;
}

/**
 * O valor dos serviços associados, pela licença a que se juntam na folha: a
 * primeira licença do mesmo lote, ou, sem nenhuma no lote, a primeira do pedido.
 */
function servicosPorLicenca(pedido: PedidoLicenciamento, nAnos: number): Map<string, number> {
  const mapa = new Map<string, number>();
  const porId = new Map(pedido.licencas.map((l) => [l.id, l]));
  const primeira = pedido.licencas.find((l) => !ehServico(l));
  for (const lote of lotesEfetivos(pedido)) {
    const doLote = lote.licencaIds.map((id) => porId.get(id)).filter((l): l is Licenca => l !== undefined);
    const alvo = doLote.find((l) => !ehServico(l)) ?? primeira;
    if (alvo === undefined) continue;
    for (const s of doLote.filter(ehServico)) mapa.set(alvo.id, (mapa.get(alvo.id) ?? 0) + valorDaLicenca(s, nAnos).total);
  }
  return mapa;
}

/**
 * A folha de um eAvalia gerado, pronta a desenhar: só as colunas dos blocos
 * usados, e só até à manutenção da última secção com licenças.
 */
export function lerFolhaDosCustosLicenciamento(
  xlsx: Uint8Array | ArrayBuffer,
  pedido: PedidoLicenciamento,
): Promise<FolhaDesenhavel> {
  const licencas = pedido.licencas.filter((l) => !ehServico(l));
  const abertos = licencas.filter((l) => ehCodigoAberto(l, pedido.natureza)).length;
  const blocos = Math.max(1, abertos, licencas.length - abertos);
  const ateLinha = abertos > 0 ? ULTIMA_LINHA_CODIGO_ABERTO : ULTIMA_LINHA_PROPRIETARIO;
  return lerFolhaDoEavalia(xlsx, FOLHA_CUSTOS_LICENCIAMENTO, {
    ateLinha,
    // Até à coluna do valor do último bloco (o espaço a seguir não diz nada).
    ateColuna: blocos * 3 - 1,
    // As linhas contam de 0: o cabeçalho, a identificação, os custos diretos e a manutenção.
    juntas: [
      [0, 14],
      [15, 23],
      [24, 35],
      [36, 45],
      ...(abertos > 0
        ? ([
            [63, 74],
            [75, 83],
            [84, 95],
            [96, 105],
          ] as Array<[number, number]>)
        : []),
    ],
  });
}
