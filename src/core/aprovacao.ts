// Aprovar um cenário de corte.
//
// Aprovar um cenário é dizer «é este o orçamento». O cenário deixa de ser uma
// variação e passa a ser o orçamento revisto — e, como o orçamento lê os
// pedidos da biblioteca, o que se cortou passa para os próprios pedidos:
//
// - cada pedido cortado passa a uma nova versão (versão + 1), com as pessoas,
//   as horas, o valor hora e as licenças do cenário. O que fica vazio sai: um
//   perfil sem ninguém sai do lote, um lote sem perfis (ou sem licenças) sai do
//   pedido, e um perfil que deixou de estar em algum lote sai dos perfis;
// - um pedido cortado por inteiro não se esvazia: sai do orçamento (fica na
//   biblioteca como estava, desmarcado);
// - um projeto importado de ficheiro (sem pedido) fica com as linhas do cenário;
// - os internos movidos ficam no projeto para onde foram;
// - o cenário aprovado e os restantes são arquivados — partiam do orçamento
//   anterior.
//
// Guarda-se o que havia antes (os pedidos alterados, e os projetos e cenários
// do orçamento) para se poder desfazer a última aprovação.

import { gerarId } from "./id";
import type { PerfilEmLote } from "./types";
import { margemDe } from "./margem";
import {
  comNoOrcamento,
  nomeParaListas,
  type Biblioteca,
  type DadosBolsa,
  type PedidoNaBiblioteca,
} from "./biblioteca";
import type { PedidoLicenciamento } from "./licenciamento";
import {
  aplicarCenario,
  horasDaEntrada,
  horasNoCenario,
  linhaAlterada,
  pessoasNoCenario,
  projetoDoInterno,
  projetoTodoCortado,
  quantidadeNoCenario,
  retiradaNoCenario,
  valorHoraNoCenario,
  type Cenario,
} from "./cenarios";
import { orcamentoComBiblioteca } from "./orcamentoDaBiblioteca";
import type { Aprovacao, EntradaVistaGeral, OrcamentoUnidade, ProjetoVistaGeral } from "./vistaGeral";
import { formatarNumero } from "./lotes";

/** O que a aprovação faz a um pedido da biblioteca. */
export interface AlteracaoDoPedido {
  pedidoId: string;
  nome: string;
  tipo: PedidoNaBiblioteca["tipo"];
  /** «nova versão» (v. seguinte) ou «sai do orçamento» (cortado por inteiro). */
  efeito: "novaVersao" | "saiDoOrcamento";
  versaoNova: number;
  /** O que muda, linha a linha. */
  linhas: string[];
  /** O n.º de informação, se o pedido já o tem: pode já ter seguido. */
  numeroInformacao: string;
}

export interface PrevisaoDaAprovacao {
  pedidos: AlteracaoDoPedido[];
  /** Os projetos importados de ficheiro (sem pedido) que mudam. */
  importados: string[];
  /** Internos que mudam de projeto. */
  internosMovidos: number;
  /** Os outros cenários, que serão arquivados. */
  outrosCenarios: string[];
}

const plural = (n: number, um: string, varios: string) => `${formatarNumero(n)} ${n === 1 ? um : varios}`;

function igual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

/** O que muda numa linha, por extenso. Vazio se a linha fica igual. */
function linhaPorExtenso(
  cenario: Cenario,
  projeto: ProjetoVistaGeral,
  entrada: EntradaVistaGeral,
  anoInicio: number,
): string | null {
  if (!linhaAlterada(cenario, projeto, entrada)) return null;
  const lote = entrada.lote === "" ? "" : `Lote ${entrada.lote} · `;
  if (entrada.tipo === "licenca") {
    if (retiradaNoCenario(cenario, projeto, entrada)) return `${lote}${entrada.perfil}: retirada`;
    const q0 = entrada.quantidade ?? 0;
    const q = quantidadeNoCenario(cenario, projeto, entrada);
    return q === q0 ? null : `${lote}${entrada.perfil}: quantidade ${formatarNumero(q0)} → ${formatarNumero(q)}`;
  }
  const ficam = pessoasNoCenario(cenario, projeto, entrada);
  if (ficam === 0) return `${lote}${entrada.perfil}: sai (sem elementos)`;
  const partes: string[] = [];
  if (ficam !== entrada.pessoas) partes.push(`elementos ${entrada.pessoas} → ${ficam}`);
  const h0 = horasDaEntrada(entrada);
  const h = horasNoCenario(cenario, projeto, entrada);
  h.forEach((horas, i) => {
    if (!igual(horas, h0[i])) partes.push(`${anoInicio + i}: ${formatarNumero(h0[i])} h → ${formatarNumero(horas)} h`);
  });
  const vh = valorHoraNoCenario(cenario, projeto, entrada);
  if (!igual(vh, entrada.valorHoraSemIva)) {
    partes.push(`valor hora ${formatarNumero(entrada.valorHoraSemIva)} € → ${formatarNumero(vh)} €`);
  }
  return partes.length === 0 ? null : `${lote}${entrada.perfil}: ${partes.join(", ")}`;
}

function numeroInformacaoDe(p: PedidoNaBiblioteca): string {
  return (p.tipo === "bolsa" ? p.dados.lotes.numeroInformacao : p.dados.numeroInformacao).trim();
}

/** Os projetos do orçamento (o que se vê) que o cenário altera. */
function projetosAlterados(orcamento: OrcamentoUnidade, cenario: Cenario): ProjetoVistaGeral[] {
  return orcamento.projetos.filter((projeto) => projeto.entradas.some((e) => linhaAlterada(cenario, projeto, e)));
}

function internosMovidos(orcamento: OrcamentoUnidade, cenario: Cenario): number {
  const nomes = new Set(orcamento.projetos.map((p) => p.nome));
  return orcamento.projetos
    .flatMap((p) => p.internos.map((i) => ({ i, origem: p.nome })))
    .filter(({ i, origem }) => {
      const destino = projetoDoInterno(cenario, i.id, origem);
      return destino !== origem && nomes.has(destino);
    }).length;
}

/**
 * O que a aprovação do cenário vai fazer, para se mostrar antes de aprovar.
 * `orcamento` é o que se vê (só os pedidos marcados).
 */
export function previsaoDaAprovacao(orcamento: OrcamentoUnidade, b: Biblioteca, cenario: Cenario): PrevisaoDaAprovacao {
  const pedidos: AlteracaoDoPedido[] = [];
  const importados: string[] = [];
  for (const projeto of projetosAlterados(orcamento, cenario)) {
    const pedido = projeto.pedidoId === undefined ? undefined : b.pedidos.find((p) => p.id === projeto.pedidoId);
    if (pedido === undefined) {
      importados.push(projeto.nome);
      continue;
    }
    const todo = projetoTodoCortado(cenario, projeto);
    pedidos.push({
      pedidoId: pedido.id,
      nome: nomeParaListas(pedido),
      tipo: pedido.tipo,
      efeito: todo ? "saiDoOrcamento" : "novaVersao",
      versaoNova: todo ? pedido.versao : pedido.versao + 1,
      linhas: todo
        ? ["Cortado por inteiro: o pedido sai do orçamento e fica na biblioteca como está."]
        : projeto.entradas
            .map((e) => linhaPorExtenso(cenario, projeto, e, projeto.anoInicio))
            .filter((l): l is string => l !== null),
      numeroInformacao: numeroInformacaoDe(pedido),
    });
  }
  return {
    pedidos,
    importados,
    internosMovidos: internosMovidos(orcamento, cenario),
    outrosCenarios: orcamento.cenarios.filter((c) => c.id !== cenario.id && c.arquivado !== true).map((c) => c.nome),
  };
}

// --------------------------------------------------------------------------
// Os cortes no próprio pedido
// --------------------------------------------------------------------------

function centimos(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Os dados de bolsa com os cortes do cenário. As linhas do projeto seguem a ordem dos perfis nos lotes. */
function dadosBolsaCortados(dados: DadosBolsa, projeto: ProjetoVistaGeral, cenario: Cenario): DadosBolsa {
  const config = dados.lotes;
  const margem = margemDe(config);
  const plurianual = config.encargosPlurianuais.ativo;
  let i = 0;
  const lotes = config.lotes
    .map((lote) => ({
      ...lote,
      perfis: lote.perfis.flatMap((emLote): PerfilEmLote[] => {
        const entrada = projeto.entradas[i++];
        if (entrada === undefined || !linhaAlterada(cenario, projeto, entrada)) return [emLote];
        const ficam = pessoasNoCenario(cenario, projeto, entrada);
        if (ficam === 0) return [];
        const novo: PerfilEmLote = { ...emLote, nMinimoElementos: ficam, horasPorAno: [...emLote.horasPorAno] };
        // O orçamento mostra o valor hora com a margem prudencial; o pedido guarda-o sem ela.
        const vh = valorHoraNoCenario(cenario, projeto, entrada);
        if (!igual(vh, entrada.valorHoraSemIva)) novo.valorHora = centimos(margem > 0 ? vh / (1 + margem / 100) : vh);
        const h0 = horasDaEntrada(entrada);
        horasNoCenario(cenario, projeto, entrada).forEach((h, ano) => {
          if (igual(h, h0[ano])) return;
          if (plurianual) novo.horasPorAno[ano] = h;
          else if (ano === 0) novo.horas = h;
        });
        return [novo];
      }),
    }))
    .filter((lote) => lote.perfis.length > 0);

  // Um perfil que estava num lote e deixou de estar em todos sai também dos perfis.
  const antes = new Set(config.lotes.flatMap((l) => l.perfis.map((e) => e.perfil.id)));
  const depois = new Set(lotes.flatMap((l) => l.perfis.map((e) => e.perfil.id)));
  const perfis = dados.perfis.filter((p) => !antes.has(p.id) || depois.has(p.id));
  return { ...dados, perfis, lotes: { ...config, lotes } };
}

/** O pedido de licenciamento com os cortes do cenário: quantidades e licenças retiradas. */
function licenciamentoCortado(
  dados: PedidoLicenciamento,
  projeto: ProjetoVistaGeral,
  cenario: Cenario,
): PedidoLicenciamento {
  const retiradas = new Set<string>();
  const quantidades = new Map<string, number>();
  for (const entrada of projeto.entradas) {
    if (!entrada.id.startsWith("lic-") || !linhaAlterada(cenario, projeto, entrada)) continue;
    const id = entrada.id.slice(4);
    if (retiradaNoCenario(cenario, projeto, entrada)) retiradas.add(id);
    else if (entrada.quantidadeAjustavel === true) quantidades.set(id, quantidadeNoCenario(cenario, projeto, entrada));
  }
  const licencas = dados.licencas
    .filter((l) => !retiradas.has(l.id))
    .map((l) => (quantidades.has(l.id) ? { ...l, quantidade: quantidades.get(l.id) ?? l.quantidade } : l));
  const lotes = dados.lotes
    .map((lote) => ({ ...lote, licencaIds: lote.licencaIds.filter((id) => !retiradas.has(id)) }))
    .filter((lote) => lote.licencaIds.length > 0);
  return { ...dados, licencas, lotes };
}

function dataCurta(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-PT");
}

/**
 * Aprova o cenário: devolve a biblioteca com os pedidos revistos e o orçamento
 * a guardar (revisto, com a aprovação registada e os cenários arquivados).
 *
 * `guardado` é o orçamento tal como está guardado; a aprovação parte dele posto
 * em dia com a biblioteca.
 */
export function aprovarCenario(
  guardado: OrcamentoUnidade,
  b: Biblioteca,
  cenarioId: string,
  agora = new Date().toISOString(),
): { biblioteca: Biblioteca; orcamento: OrcamentoUnidade } | null {
  const completo = orcamentoComBiblioteca(guardado, b, { manterFora: true });
  const visivel = orcamentoComBiblioteca(guardado, b);
  const cenario = completo.cenarios.find((c) => c.id === cenarioId);
  if (cenario === undefined) return null;

  const previsao = previsaoDaAprovacao(visivel, b, cenario);
  const derivado = aplicarCenario(visivel, cenario);
  const nota = `Cenário «${cenario.nome}» aprovado no orçamento em ${dataCurta(agora)}`;

  // Os pedidos.
  const antes: PedidoNaBiblioteca[] = [];
  let biblioteca = b;
  for (const alteracao of previsao.pedidos) {
    const pedido = b.pedidos.find((p) => p.id === alteracao.pedidoId);
    const projeto = visivel.projetos.find((p) => p.pedidoId === alteracao.pedidoId);
    if (pedido === undefined || projeto === undefined) continue;
    antes.push(structuredClone(pedido));
    if (alteracao.efeito === "saiDoOrcamento") {
      biblioteca = comNoOrcamento(biblioteca, [pedido.id], false);
      biblioteca = {
        ...biblioteca,
        pedidos: biblioteca.pedidos.map((p) =>
          p.id === pedido.id
            ? {
                ...p,
                historico: [...p.historico, { versao: p.versao, em: agora, nota: `${nota}: retirado do orçamento` }],
              }
            : p,
        ),
      };
      continue;
    }
    const revisto: PedidoNaBiblioteca =
      pedido.tipo === "bolsa"
        ? { ...pedido, dados: dadosBolsaCortados(pedido.dados, projeto, cenario) }
        : { ...pedido, dados: licenciamentoCortado(pedido.dados, projeto, cenario) };
    const versao = pedido.versao + 1;
    biblioteca = {
      ...biblioteca,
      pedidos: biblioteca.pedidos.map((p) =>
        p.id === pedido.id
          ? { ...revisto, versao, atualizadoEm: agora, historico: [...pedido.historico, { versao, em: agora, nota }] }
          : p,
      ),
    };
  }

  // O orçamento: os importados com as linhas do cenário, os internos onde ficaram.
  const derivadoPorId = new Map(derivado.projetos.map((p) => [p.id, p]));
  const importados = new Set(previsao.importados);
  const projetos = completo.projetos.map((projeto) => {
    const noCenario = derivadoPorId.get(projeto.id);
    if (noCenario === undefined) return projeto;
    const entradas =
      projeto.pedidoId === undefined && importados.has(projeto.nome)
        ? noCenario.entradas.filter((e) =>
            e.tipo === "licenca" ? !retiradaNoCenario(cenario, projeto, e) : e.pessoas > 0,
          )
        : projeto.entradas;
    return { ...projeto, entradas, internos: noCenario.internos };
  });

  const resumo = [
    ...previsao.pedidos.map((a) =>
      a.efeito === "novaVersao" ? `${a.nome}: passa à versão ${a.versaoNova}` : `${a.nome}: sai do orçamento`,
    ),
    ...previsao.importados.map((n) => `${n} (importado): linhas do cenário`),
    ...(previsao.internosMovidos > 0
      ? [`${plural(previsao.internosMovidos, "elemento interno muda", "elementos internos mudam")} de projeto`]
      : []),
  ];

  const biblio = biblioteca;
  const aprovacao: Aprovacao = {
    id: gerarId(),
    cenarioId: cenario.id,
    cenarioNome: cenario.nome,
    em: agora,
    resumo,
    pedidosAntes: antes,
    pedidosDepois: antes.flatMap((p) => {
      const depois = biblio.pedidos.find((x) => x.id === p.id);
      return depois === undefined ? [] : [{ id: p.id, versao: depois.versao, atualizadoEm: depois.atualizadoEm }];
    }),
    orcamentoAntes: { projetos: completo.projetos, cenarios: completo.cenarios },
  };

  const cenarios = completo.cenarios.map((c) =>
    c.id === cenario.id
      ? { ...c, arquivado: true, aprovadoEm: agora }
      : c.arquivado === true
        ? c
        : { ...c, arquivado: true },
  );
  const orcamento = orcamentoComBiblioteca(
    { ...completo, projetos, cenarios, aprovacoes: [...completo.aprovacoes, aprovacao] },
    biblioteca,
    { manterFora: true },
  );
  return { biblioteca, orcamento };
}

/** A última aprovação, se há alguma. */
export function ultimaAprovacao(orcamento: OrcamentoUnidade): Aprovacao | null {
  return orcamento.aprovacoes.at(-1) ?? null;
}

/** Os pedidos da aprovação que foram alterados depois dela (e que desfazer repõe como estavam antes). */
export function alteradosDepois(aprovacao: Aprovacao, b: Biblioteca): string[] {
  return aprovacao.pedidosDepois.flatMap((d) => {
    const p = b.pedidos.find((x) => x.id === d.id);
    if (p === undefined) return [];
    return p.versao !== d.versao || p.atualizadoEm !== d.atualizadoEm ? [nomeParaListas(p)] : [];
  });
}

/**
 * Desfaz a última aprovação: os pedidos voltam a como estavam antes dela (um
 * pedido apagado entretanto volta à biblioteca), e o orçamento volta aos
 * projetos, internos e cenários de então.
 */
export function desfazerUltimaAprovacao(
  guardado: OrcamentoUnidade,
  b: Biblioteca,
): { biblioteca: Biblioteca; orcamento: OrcamentoUnidade } | null {
  const aprovacao = ultimaAprovacao(guardado);
  if (aprovacao === null) return null;
  const antes = new Map(aprovacao.pedidosAntes.map((p) => [p.id, p]));
  const existentes = new Set(b.pedidos.map((p) => p.id));
  const biblioteca: Biblioteca = {
    ...b,
    pedidos: [
      ...b.pedidos.map((p) => antes.get(p.id) ?? p),
      ...aprovacao.pedidosAntes.filter((p) => !existentes.has(p.id)),
    ],
  };
  const orcamento: OrcamentoUnidade = {
    ...guardado,
    projetos: aprovacao.orcamentoAntes.projetos,
    cenarios: aprovacao.orcamentoAntes.cenarios,
    aprovacoes: guardado.aprovacoes.slice(0, -1),
  };
  return { biblioteca, orcamento };
}
