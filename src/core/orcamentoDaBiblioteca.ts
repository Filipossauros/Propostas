// O orçamento da unidade a partir da biblioteca de pedidos.
//
// O orçamento deixou de viver de cópias importadas: lê os pedidos da
// biblioteca marcados «no orçamento» — de bolsa de horas e de licenciamento —
// e acompanha-os. Corrigir um pedido corrige o orçamento, sem reimportar nada.
//
// O que é do orçamento, e não do pedido, fica guardado no orçamento: os
// elementos internos de cada projeto, a ordem dos projetos e os cenários. Para
// isso, o orçamento guarda um projeto por pedido (com `pedidoId`), que aqui se
// põe em dia com os valores do pedido. Um pedido desmarcado sai do orçamento,
// mas o seu projeto guardado fica — com os internos —, e volta como estava se o
// pedido voltar a ser marcado.
//
// Os projetos importados de ficheiro antes da biblioteca (sem pedido) ficam
// como estão — salvo se houver na biblioteca um pedido com o mesmo nome: aí o
// projeto passa a ser dele (com os internos), e entra ou sai com ele.

import { ANOS_PLURIANUAIS } from "./types";
import { nomeDoPedido, type Biblioteca, type PedidoNaBiblioteca } from "./biblioteca";
import { projetoDeAgrupamento, type EntradaVistaGeral, type OrcamentoUnidade, type ProjetoVistaGeral } from "./vistaGeral";
import {
  anosDoPedido,
  comMargemLicenciamento,
  ehPrecoGlobal,
  ehServico,
  lotesEfetivos,
  metricaPorExtenso,
  nomeDaLicenca,
  valorDaLicenca,
  type Licenca,
  type PedidoLicenciamento,
} from "./licenciamento";
import { formatarNumero } from "./lotes";

/** A quantidade de uma licença por extenso, para a linha do orçamento. */
function quantidadeDaLicenca(l: Licenca): string {
  if (ehServico(l)) return "serviço · preço global";
  const qtd = `${ehPrecoGlobal(l) ? "até " : ""}${formatarNumero(l.quantidade)} ${metricaPorExtenso(l) || "licenças"}`;
  return ehPrecoGlobal(l) ? `${qtd} (preço global)` : qtd;
}

/**
 * Um pedido de licenciamento como projeto do orçamento: uma linha por
 * licença (ou serviço), com o valor de cada ano — com a margem e com IVA, como
 * nas peças.
 */
export function projetoDeLicenciamento(original: PedidoLicenciamento): Omit<ProjetoVistaGeral, "id"> {
  const pedido = comMargemLicenciamento(original);
  const nAnos = anosDoPedido(pedido).length;
  const fator = 1 + (Number.isFinite(pedido.taxaIva) ? pedido.taxaIva : 0) / 100;
  const loteDe = new Map(lotesEfetivos(pedido).flatMap((lote) => lote.licencaIds.map((id) => [id, lote.numero] as const)));

  const entradas: EntradaVistaGeral[] = pedido.licencas.map((l) => {
    const porAno = valorDaLicenca(l, nAnos).porAno;
    return {
      id: `lic-${l.id}`,
      tipo: "licenca",
      quantidadePorExtenso: quantidadeDaLicenca(l),
      lote: loteDe.get(l.id) ?? "",
      perfil: nomeDaLicenca(l, pedido.natureza) || l.designacao.trim() || "(licença sem nome)",
      pessoas: 0,
      valorHoraSemIva: l.precoUnitario,
      valorHoraComIva: Math.round(l.precoUnitario * fator * 100) / 100,
      totaisPorAno: Array.from({ length: ANOS_PLURIANUAIS }, (_v, i) => (porAno[i] ?? 0) * fator),
    };
  });

  return {
    nome: pedido.nomeProduto.trim() || "(produto sem nome)",
    anoInicio: pedido.encargosPlurianuais.anoInicio,
    entradas,
    internos: [],
  };
}

/** Um pedido da biblioteca como projeto do orçamento, com o identificador do pedido. */
export function projetoDoPedido(p: PedidoNaBiblioteca): ProjetoVistaGeral {
  if (p.tipo === "bolsa") {
    const projeto = projetoDeAgrupamento(p.dados.lotes);
    return {
      ...projeto,
      id: p.id,
      nome: nomeDoPedido(p) || projeto.nome,
      pedidoId: p.id,
      tipoPedido: "bolsa",
      // As linhas com identificadores estáveis: o perfil no lote.
      entradas: projeto.entradas.map((e, i) => ({ ...e, id: `${p.id}-${i}` })),
    };
  }
  return { ...projetoDeLicenciamento(p.dados), id: p.id, pedidoId: p.id, tipoPedido: "licenciamento" };
}

/** Os pedidos que entram no orçamento: os marcados, e não arquivados. */
export function pedidosNoOrcamento(b: Biblioteca): PedidoNaBiblioteca[] {
  return b.pedidos.filter((p) => p.noOrcamento && !p.arquivado);
}

/**
 * O orçamento com os pedidos da biblioteca postos em dia.
 *
 * Com `manterFora`, ficam também os projetos de pedidos que já não estão
 * marcados (com os seus internos): é a versão que se guarda. Sem ela, só os
 * que contam: é a que se mostra, se soma e se descarrega.
 */
export function orcamentoComBiblioteca(
  orcamento: OrcamentoUnidade,
  b: Biblioteca,
  { manterFora = false }: { manterFora?: boolean } = {},
): OrcamentoUnidade {
  const marcados = pedidosNoOrcamento(b);
  const porId = new Map(marcados.map((p) => [p.id, p]));
  const naBiblioteca = b.pedidos.filter((p) => !p.arquivado);
  const usados = new Set<string>();
  const projetos: ProjetoVistaGeral[] = [];

  for (const projeto of orcamento.projetos) {
    if (projeto.pedidoId !== undefined) {
      const p = porId.get(projeto.pedidoId);
      if (p !== undefined && !usados.has(p.id)) {
        usados.add(p.id);
        projetos.push({ ...projetoDoPedido(p), id: projeto.id, internos: projeto.internos });
      } else if (manterFora && !usados.has(projeto.pedidoId)) {
        projetos.push(projeto);
      }
      continue;
    }
    // Um projeto importado de ficheiro: passa a ser do pedido com o mesmo nome.
    const p = naBiblioteca.find((x) => !usados.has(x.id) && nomeDoPedido(x) === projeto.nome);
    if (p === undefined) {
      projetos.push(projeto);
    } else if (porId.has(p.id)) {
      usados.add(p.id);
      projetos.push({ ...projetoDoPedido(p), id: projeto.id, internos: projeto.internos });
    } else if (manterFora) {
      usados.add(p.id);
      projetos.push({ ...projeto, pedidoId: p.id, tipoPedido: p.tipo });
    }
  }

  for (const p of marcados) if (!usados.has(p.id)) projetos.push(projetoDoPedido(p));
  return { ...orcamento, projetos };
}
