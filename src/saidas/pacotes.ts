// O que vai dentro do pacote de cada módulo.
//
// Vive à parte dos ecrãs porque há conjuntos que se reaproveitam: as peças do
// procedimento (Módulo 2) levam também os ficheiros dos perfis (Módulo 1), e a
// ordenação (Módulo 4) leva os da avaliação (Módulo 3). Ter a lista escrita uma
// só vez é o que garante que o pacote maior não fica a divergir do menor.

import type { LotesJSON, PerfilJSON } from "../core/types";
import type { ResultadoProcedimento } from "../core/avaliacaoProcedimento";
import type { Ordenacao } from "../core/ordenacao";
import type { OrcamentoUnidade } from "../core/vistaGeral";
import { perfisParaJSON } from "../core/perfil";
import { especificacao, lotesParaJSON } from "../core/lotes";
import type { ImagemDaFolha } from "../core/resumoCurricular";
import { documentoRegrasEPrecoBase } from "../core/cadernoEncargos";
import { resultadosParaJSON } from "../core/resultadosJSON";
import { anosDoOrcamento, orcamentoParaJSON } from "../core/vistaGeral";
import { gerarDocxBlob } from "../word/gerarDocx";
import { gerarManifestacaoNecessidadesBlob, gerarPedidoPlurianualBlob } from "../word/informacaoSpms";
import { gerarResumoPerfisBlob } from "../excel/resumoPerfis";
import { gerarDeclaracaoExcelBlob } from "../excel/gerar";
import { imagensDosResumos } from "../excel/imagemDaFolha";
import { gerarEavaliaBlob } from "../excel/eavalia";
import { gerarResultadosBlob } from "../excel/exportarResultados";
import { gerarVistaGeralBlob } from "../excel/vistaGeral";
import { nomeSeguro } from "../ui/descarregar";
import { emPasta, nomeDoPacote, type FicheiroDoPacote } from "../ui/pacote";

const JSON_MIME = "application/json";

/** A pasta dos formulários que os concorrentes preenchem, um por lote. */
const PASTA_DOS_RESUMOS = "Resumos Curriculares";

function comoJSON(texto: string): Blob {
  return new Blob([texto], { type: JSON_MIME });
}

// --------------------------------------------------------------------------
// Módulo 1 — perfis
// --------------------------------------------------------------------------

export async function ficheirosDosPerfis(
  perfis: PerfilJSON[],
  nomeProjeto: string,
  descricaoProjeto: string,
): Promise<FicheiroDoPacote[]> {
  const base = nomeSeguro(nomeProjeto, "Projeto");
  return [
    { nome: `${base}_Perfis.xlsx`, conteudo: await gerarResumoPerfisBlob(perfis, nomeProjeto) },
    { nome: `${base}_Perfis.json`, conteudo: comoJSON(perfisParaJSON(perfis, nomeProjeto, descricaoProjeto)) },
  ];
}

export function nomeDoPacoteDePerfis(nomeProjeto: string, quando?: Date): string {
  return nomeDoPacote(nomeProjeto, "Perfis", quando);
}

// --------------------------------------------------------------------------
// Módulo 2 — peças do procedimento
// --------------------------------------------------------------------------

/**
 * A informação formal da organização que este procedimento pede.
 *
 * Com encargos plurianuais é o pedido para os assumir; sem eles a despesa cabe
 * num ano só, não há nada a pedir à tutela, e o que segue é a manifestação de
 * necessidades. Sai sempre uma, e nunca as duas: são a mesma informação vista
 * de dois sítios, e juntas obrigavam quem recebe o processo a escolher.
 */
async function informacaoDoProcedimento(
  config: LotesJSON,
  base: string,
  quando: Date,
  imagens: ImagemDaFolha[],
): Promise<FicheiroDoPacote> {
  return config.encargosPlurianuais.ativo
    ? {
        nome: `${base}_Pedido_Trienio.docx`,
        conteudo: await gerarPedidoPlurianualBlob(config, quando, imagens),
      }
    : {
        nome: `${base}_Manifestacao_de_Necessidades.docx`,
        conteudo: await gerarManifestacaoNecessidadesBlob(config, quando, imagens),
      };
}

/**
 * Tudo o que sai do procedimento: os dois documentos Word, o JSON dos lotes, o
 * pedido eAvalia, um formulário de declaração por lote — e, numa pasta à parte,
 * os ficheiros dos perfis do Módulo 1.
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

  // As folhas do Resumo Curricular são desenhadas uma só vez: entram no anexo
  // dos dois documentos Word, e desenhá-las duas vezes seria o mesmo trabalho a
  // dobrar.
  const imagens = await imagensDosResumos(config);

  const formularios = await Promise.all(
    comPerfis.map(async (lote) => ({
      nome: `${base}_${nomeSeguro(lote.designacao, `Lote_${lote.numero}`)}.xlsx`,
      conteudo: await gerarDeclaracaoExcelBlob(
        lote.perfis.map((entrada) => especificacao(entrada.perfil, config.nBlocos, lote)),
      ),
    })),
  );

  return [
    {
      nome: `${base}_Requisitos_e_regras.docx`,
      conteudo: await gerarDocxBlob([documentoRegrasEPrecoBase(config, imagens)]),
    },
    await informacaoDoProcedimento(config, base, quando, imagens),
    { nome: `Pedido_PPP_eavalia_${base}.xlsx`, conteudo: await gerarEavaliaBlob(config) },
    { nome: `${base}_Lotes.json`, conteudo: comoJSON(lotesParaJSON(config)) },
    ...emPasta(PASTA_DOS_RESUMOS, formularios),
    ...emPasta("Perfis", await ficheirosDosPerfis(perfis, nomeProjeto, config.descricaoProjeto)),
  ];
}

export function nomeDoPacoteDePecas(nomeProjeto: string, quando?: Date): string {
  return nomeDoPacote(nomeProjeto, "Pecas_do_Procedimento", quando);
}

// --------------------------------------------------------------------------
// Módulo 3 — análise de propostas
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
// Módulo 4 — ordenação de propostas
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
