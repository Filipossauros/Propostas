// O que vai dentro do pacote de cada módulo.
//
// Vive à parte dos ecrãs porque há conjuntos que se reaproveitam: as peças do
// procedimento (Módulo 3) levam também os ficheiros dos perfis (Módulo 2), e a
// ordenação (Módulo 5) leva os da análise (Módulo 4). Ter a lista escrita uma
// só vez é o que garante que o pacote maior não fica a divergir do menor.

import type { JustificacaoProjeto, LotesJSON, PerfilJSON } from "../core/types";
import type { ResultadoProcedimento } from "../core/avaliacaoProcedimento";
import type { Ordenacao } from "../core/ordenacao";
import type { OrcamentoUnidade } from "../core/vistaGeral";
import type { VistaDirecao } from "../core/vistaGeralDirecao";
import { perfisParaJSON } from "../core/perfil";
import { especificacao, lotesParaJSON } from "../core/lotes";
import type { ImagemDaFolha } from "../core/resumoCurricular";
import { resultadosParaJSON } from "../core/resultadosJSON";
import { anosDoOrcamento, orcamentoParaJSON } from "../core/vistaGeral";
import { anosDaDirecao, vistaDirecaoParaJSON } from "../core/vistaGeralDirecao";
import { gerarManifestacaoBlob } from "../word/manifestacaoNecessidades";
import { comMargemPrudencial } from "../core/margem";
import { gerarResumoPerfisBlob } from "../excel/resumoPerfis";
import { gerarDeclaracaoExcelBlob } from "../excel/gerar";
import { imagensDosResumos } from "../excel/imagemDaFolha";
import { gerarEavaliaBlob } from "../excel/eavalia";
import { gerarResultadosBlob } from "../excel/exportarResultados";
import { gerarVistaGeralBlob } from "../excel/vistaGeral";
import { gerarVistaDirecaoBlob } from "../excel/vistaDirecao";
import { nomeSeguro } from "../ui/descarregar";
import { carimboDeData, emPasta, nomeDoPacote, type FicheiroDoPacote } from "../ui/pacote";

const JSON_MIME = "application/json";

/** A pasta dos formulários que os concorrentes preenchem, um por lote. */
const PASTA_DOS_RESUMOS = "Resumos Curriculares";

function comoJSON(texto: string): Blob {
  return new Blob([texto], { type: JSON_MIME });
}

// --------------------------------------------------------------------------
// Módulo 2 — perfis
// --------------------------------------------------------------------------

export async function ficheirosDosPerfis(
  perfis: PerfilJSON[],
  nomeProjeto: string,
  descricaoProjeto: string,
  justificacao: JustificacaoProjeto,
): Promise<FicheiroDoPacote[]> {
  const base = nomeSeguro(nomeProjeto, "Projeto");
  return [
    { nome: `${base}_Perfis.xlsx`, conteudo: await gerarResumoPerfisBlob(perfis, nomeProjeto) },
    {
      nome: `${base}_Perfis.json`,
      conteudo: comoJSON(perfisParaJSON(perfis, nomeProjeto, descricaoProjeto, justificacao)),
    },
  ];
}

export function nomeDoPacoteDePerfis(nomeProjeto: string, quando?: Date): string {
  return nomeDoPacote(nomeProjeto, "Perfis", quando);
}

// --------------------------------------------------------------------------
// Módulo 3 — Anexo Técnico (as peças do procedimento)
// --------------------------------------------------------------------------

/**
 * A informação do procedimento: a manifestação de necessidades, no modelo da
 * DAG. É a mesma com ou sem encargos plurianuais — a repartição por anos vai
 * dentro dela.
 */
async function informacaoDoProcedimento(
  config: LotesJSON,
  base: string,
  quando: Date,
  imagens: ImagemDaFolha[],
): Promise<FicheiroDoPacote> {
  return {
    nome: `${base}_Manifestacao_de_Necessidades.docx`,
    conteudo: await gerarManifestacaoBlob(config, quando, imagens),
  };
}

/**
 * A informação em PDF — só quando já tem os dois números: o da informação e o
 * de orçamento.
 *
 * O PDF é desenhado a partir do próprio Word que segue no pacote, e é o que se
 * submete tal e qual: sem um dos números ficaria com o espaço a vermelho, que
 * no Word ainda se preenche e no PDF já não. Por isso, faltando um, não sai.
 *
 * O conversor carrega-se só aqui: a biblioteca de PDF não pesa no arranque da
 * aplicação para quem nunca o chega a usar.
 */
async function informacaoEmPdf(config: LotesJSON, informacao: FicheiroDoPacote): Promise<FicheiroDoPacote[]> {
  const numero = config.numeroInformacao.trim();
  const orcamento = config.numeroOrcamento.trim();
  if (numero === "" || orcamento === "" || !(informacao.conteudo instanceof Blob)) return [];

  const { wordEmPdf } = await import("../pdf/wordEmPdf");
  const titulo = `Informação ${numero} — ${config.nomeProcedimento.trim() || config.nomeProjeto.trim()}`;
  const pdf = await wordEmPdf(informacao.conteudo, titulo);
  return [
    {
      nome: informacao.nome.replace(/\.docx$/, ".pdf"),
      conteudo: new Blob([pdf as Uint8Array<ArrayBuffer>], { type: "application/pdf" }),
    },
  ];
}

/**
 * Tudo o que sai do procedimento: a manifestação de necessidades, o JSON dos lotes, o
 * pedido eAvalia, um formulário de declaração por lote — e, numa pasta à parte,
 * os ficheiros dos perfis do Módulo 2.
 *
 * Os perfis vão numa subpasta e não à mistura: são o que define os perfis, e
 * não peça do procedimento; quem abre o pacote tem de distinguir uma coisa da
 * outra sem ter de perguntar.
 */
export async function ficheirosDasPecas(
  config: LotesJSON,
  perfis: PerfilJSON[],
  nomeProjeto: string,
  quando = new Date(),
): Promise<FicheiroDoPacote[]> {
  const base = nomeSeguro(nomeProjeto, "Projeto");
  const comPerfis = config.lotes.filter((lote) => lote.perfis.length > 0);

  // As folhas do Resumo Curricular, desenhadas para o anexo da manifestação.
  const imagens = await imagensDosResumos(config);

  const formularios = await Promise.all(
    comPerfis.map(async (lote) => ({
      nome: `${base}_${nomeSeguro(lote.designacao, `Lote_${lote.numero}`)}.xlsx`,
      conteudo: await gerarDeclaracaoExcelBlob(
        lote.perfis.map((entrada) => especificacao(entrada.perfil, config.nBlocos, lote)),
      ),
    })),
  );

  const informacao = await informacaoDoProcedimento(config, base, quando, imagens);
  // As restantes peças com preços levam-nos com a margem prudencial, como a
  // informação: os valores têm de ser os mesmos em todas. O JSON guarda os de
  // referência e a margem à parte.
  const comMargem = comMargemPrudencial(config);

  return [
    informacao,
    ...(await informacaoEmPdf(config, informacao)),
    { nome: `Pedido_PPP_eavalia_${base}.xlsx`, conteudo: await gerarEavaliaBlob(comMargem) },
    { nome: `${base}_Lotes.json`, conteudo: comoJSON(lotesParaJSON(config)) },
    ...emPasta(PASTA_DOS_RESUMOS, formularios),
    ...emPasta(
      "Perfis",
      await ficheirosDosPerfis(perfis, nomeProjeto, config.descricaoProjeto, config.justificacao),
    ),
  ];
}

export function nomeDoPacoteDePecas(nomeProjeto: string, quando?: Date): string {
  // O pacote chama-se como o painel que o gera no Módulo 3.
  return nomeDoPacote(nomeProjeto, "Anexo_Tecnico", quando);
}

// --------------------------------------------------------------------------
// Módulo 4 — análise de propostas
// --------------------------------------------------------------------------

export async function ficheirosDaAvaliacao(
  resultado: ResultadoProcedimento,
  config: LotesJSON,
): Promise<FicheiroDoPacote[]> {
  const base = nomeSeguro(config.nomeProjeto, "Projeto");
  return [
    { nome: `${base}_Resultados_Avaliacao.xlsx`, conteudo: await gerarResultadosBlob(resultado, config) },
    { nome: `${base}_Resultados_Avaliacao.json`, conteudo: comoJSON(resultadosParaJSON(resultado, config)) },
  ];
}

export function nomeDoPacoteDeAvaliacao(nomeProjeto: string, quando?: Date): string {
  return nomeDoPacote(nomeProjeto, "Analise_de_Propostas", quando);
}

// --------------------------------------------------------------------------
// Módulo 5 — ordenação de propostas
// --------------------------------------------------------------------------

/** Os ficheiros da avaliação, mais o relatório que já traz a ordenação. */
export async function ficheirosDaOrdenacao(
  resultado: ResultadoProcedimento,
  config: LotesJSON,
  ordenacao: Ordenacao,
): Promise<FicheiroDoPacote[]> {
  const base = nomeSeguro(config.nomeProjeto, "Projeto");
  return [
    {
      nome: `${base}_Resultados_e_Ordenacao.xlsx`,
      conteudo: await gerarResultadosBlob(resultado, config, ordenacao),
    },
    ...(await ficheirosDaAvaliacao(resultado, config)),
  ];
}

export function nomeDoPacoteDeOrdenacao(nomeProjeto: string, quando?: Date): string {
  return nomeDoPacote(nomeProjeto, "Ordenacao_de_Propostas", quando);
}

// --------------------------------------------------------------------------
// Vista Geral — orçamento da unidade
// --------------------------------------------------------------------------

export async function ficheirosDaVistaGeral(orcamento: OrcamentoUnidade): Promise<FicheiroDoPacote[]> {
  const base = nomeSeguro(orcamento.unidade, "Unidade");
  return [
    { nome: `${base}_Vista_Geral.xlsx`, conteudo: await gerarVistaGeralBlob(orcamento) },
    { nome: `${base}_Vista_Geral.json`, conteudo: comoJSON(orcamentoParaJSON(orcamento)) },
  ];
}

/**
 * O nome do pacote da unidade leva os anos de início dos projetos carregados,
 * em dois dígitos: `PACE_Vista_Geral_26_27_28_26082026.zip`.
 *
 * São os anos de início, e não todos os anos cobertos: é o que diz de quando
 * são os compromissos que a vista junta. Repetidos contam uma vez.
 */
export function nomeDoPacoteDaVistaGeral(orcamento: OrcamentoUnidade, quando?: Date): string {
  const inicios = [...new Set(orcamento.projetos.map((p) => p.anoInicio))].sort((a, b) => a - b);
  const anos = inicios.map((ano) => String(ano % 100).padStart(2, "0")).join("_");
  return nomeDoPacote(orcamento.unidade, anos === "" ? "Vista_Geral" : `Vista_Geral_${anos}`, quando, "Unidade");
}

/** Os anos cobertos pelo orçamento — usado só para o texto de ajuda do ecrã. */
export function anosDaVistaGeral(orcamento: OrcamentoUnidade): number[] {
  return anosDoOrcamento(orcamento);
}

// --------------------------------------------------------------------------
// Vista Geral da Direção — as unidades juntas
// --------------------------------------------------------------------------

/** O Excel da direção, sozinho: é o que se leva para uma reunião. */
export function nomeDoExcelDaDirecao(vista: VistaDirecao, quando = new Date()): string {
  return `${nomeSeguro(vista.direcao, "Direcao")}_Vista_Geral_Direcao_${carimboDeData(quando)}.xlsx`;
}

export async function ficheirosDaVistaDirecao(vista: VistaDirecao): Promise<FicheiroDoPacote[]> {
  const base = nomeSeguro(vista.direcao, "Direcao");
  return [
    { nome: `${base}_Vista_Geral_Direcao.xlsx`, conteudo: await gerarVistaDirecaoBlob(vista) },
    { nome: `${base}_Vista_Geral_Direcao.json`, conteudo: comoJSON(vistaDirecaoParaJSON(vista)) },
  ];
}

/**
 * O nome do pacote da direção leva os anos económicos que a vista cobre, em
 * dois dígitos — a mesma leitura do pacote de uma unidade.
 */
export function nomeDoPacoteDaVistaDirecao(vista: VistaDirecao, quando?: Date): string {
  const anos = anosDaDirecao(vista)
    .map((ano) => String(ano % 100).padStart(2, "0"))
    .join("_");
  return nomeDoPacote(vista.direcao, anos === "" ? "Vista_Geral_Direcao" : `Vista_Geral_Direcao_${anos}`, quando, "Direcao");
}
