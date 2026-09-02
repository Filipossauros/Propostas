// O anexo dos Resumos Curriculares: o formulário de folha de cálculo que os
// concorrentes preenchem, reproduzido dentro dos documentos Word.
//
// Quem aprova o procedimento lê o Word, não o ficheiro de cálculo — e as
// regras de apuramento remetem para campos («Declara experiência?», as datas
// de início e de fim) que só se percebem tendo o formulário à frente. Por isso
// o anexo reproduz cada folha do ficheiro, uma por página.
//
// Reproduz-se um único Projeto por folha, e não os `nBlocos` que o ficheiro
// comporta: os blocos são todos iguais, e repeti-los quinze vezes enterrava o
// resto do documento sem acrescentar nada.

import type { EspecificacaoFormulario, LotesJSON } from "./types";
import { especificacao } from "./lotes";
import { celula, type BlocoDocumento } from "./documento";
import {
  CAMPOS_IDENTIFICACAO,
  ROTULO_ASSINATURA,
  TEXTO_CABECALHO_ANO,
  TEXTO_CABECALHO_MES,
  TEXTO_DECLARACAO_VERACIDADE,
  TEXTO_DISCLAIMER_PROJETO_EM_CURSO,
  TEXTO_NOTA_BLOCO,
  TEXTO_ROTULO_CLIENTE,
  TEXTO_ROTULO_FIM_PROJETO,
  TEXTO_ROTULO_FUNCAO,
  TEXTO_ROTULO_INICIO_PROJETO,
  TEXTO_ROTULO_PROJETO,
  TEXTO_SUBCABECALHO_DECLARA,
  TEXTO_SUBCABECALHO_FIM_ANO,
  TEXTO_SUBCABECALHO_FIM_MES,
  TEXTO_SUBCABECALHO_INICIO_ANO,
  TEXTO_SUBCABECALHO_INICIO_MES,
  tituloFaixaBloco,
} from "../excel/layout";

export const TITULO_ANEXO_RESUMOS = "Resumos Curriculares";

/**
 * Uma folha desenhada em imagem, com as dimensões naturais em píxeis.
 *
 * Quem a produz é o `excel/imagemDaFolha`, que precisa de um canvas e por isso
 * só corre no browser; o tipo vive aqui para o núcleo não depender dele.
 */
export interface ImagemDaFolha {
  perfil: string;
  dados: Uint8Array;
  largura: number;
  altura: number;
}

/** O bloco de projeto reproduzido — o primeiro, e só ele. */
const BLOCO_REPRODUZIDO = 1;

const COLUNAS_CAMPO = [
  { titulo: "Campo", peso: 34 },
  { titulo: "Preenchimento", peso: 66 },
];

/** Uma linha de campo por preencher: rótulo à esquerda, caixa vazia à direita. */
function campo(rotulo: string, valor = ""): ReturnType<typeof celula>[] {
  return [celula(rotulo), celula(valor)];
}

/**
 * O valor pré-preenchido de um campo de identificação.
 *
 * O perfil, o lote e a designação do lote vêm decididos pela entidade
 * adjudicante e saem bloqueados no ficheiro de cálculo; os restantes ficam em
 * branco, para o candidato preencher.
 */
function valorDeIdentificacao(config: EspecificacaoFormulario, nome: string): string {
  if (nome === "perfil") return config.perfil;
  if (nome === "lote") return config.lote ?? "";
  if (nome === "loteDesignacao") return config.loteDesignacao ?? "";
  return "";
}

function blocosDaFolha(config: EspecificacaoFormulario): BlocoDocumento[] {
  return [
    { tipo: "titulo", nivel: 1, texto: `Resumo Curricular — ${config.perfil}` },

    { tipo: "titulo", nivel: 3, texto: "Identificação do candidato" },
    { tipo: "nota", texto: TEXTO_DECLARACAO_VERACIDADE },
    {
      tipo: "tabela",
      colunas: COLUNAS_CAMPO,
      linhas: [
        ...CAMPOS_IDENTIFICACAO.map(({ rotulo, campo: nome }) =>
          campo(rotulo, valorDeIdentificacao(config, nome)),
        ),
        campo(ROTULO_ASSINATURA),
      ],
    },

    { tipo: "titulo", nivel: 3, texto: tituloFaixaBloco(BLOCO_REPRODUZIDO) },
    {
      tipo: "tabela",
      colunas: COLUNAS_CAMPO,
      linhas: [
        campo(TEXTO_ROTULO_CLIENTE),
        campo(TEXTO_ROTULO_PROJETO),
        campo(TEXTO_ROTULO_FUNCAO),
        campo(`${TEXTO_ROTULO_INICIO_PROJETO} — ${TEXTO_CABECALHO_MES}`),
        campo(`${TEXTO_ROTULO_INICIO_PROJETO} — ${TEXTO_CABECALHO_ANO}`),
        campo(`${TEXTO_ROTULO_FIM_PROJETO} — ${TEXTO_CABECALHO_MES}`),
        campo(`${TEXTO_ROTULO_FIM_PROJETO} — ${TEXTO_CABECALHO_ANO}`),
      ],
    },
    { tipo: "nota", texto: TEXTO_DISCLAIMER_PROJETO_EM_CURSO },

    {
      tipo: "tabela",
      colunas: [
        { titulo: "Requisito", peso: 34 },
        { titulo: TEXTO_SUBCABECALHO_DECLARA, peso: 14 },
        { titulo: TEXTO_SUBCABECALHO_INICIO_MES, peso: 13 },
        { titulo: TEXTO_SUBCABECALHO_INICIO_ANO, peso: 13 },
        { titulo: TEXTO_SUBCABECALHO_FIM_MES, peso: 13 },
        { titulo: TEXTO_SUBCABECALHO_FIM_ANO, peso: 13 },
      ],
      linhas: config.requisitos.map((requisito) => [
        celula(requisito.designacao),
        celula(""),
        celula(""),
        celula(""),
        celula(""),
        celula(""),
      ]),
    },
    { tipo: "nota", texto: TEXTO_NOTA_BLOCO },
  ];
}

/** As especificações reproduzidas no anexo — as mesmas que geram o ficheiro de cálculo. */
export function folhasDoAnexo(config: LotesJSON): EspecificacaoFormulario[] {
  return config.lotes
    .filter((lote) => lote.perfis.length > 0)
    .flatMap((lote) => lote.perfis.map((entrada) => especificacao(entrada.perfil, config.nBlocos, lote)));
}

function aberturaDoAnexo(config: LotesJSON): BlocoDocumento {
  return {
    tipo: "paragrafo",
    texto:
      "Reproduz-se em seguida o Resumo Curricular disponibilizado aos concorrentes, tal como consta do " +
      "ficheiro de folha de cálculo anexo ao Programa do Concurso: uma folha por perfil, na página " +
      `correspondente. O ficheiro comporta ${config.nBlocos} Projetos por perfil, todos com a mesma ` +
      "estrutura; reproduz-se aqui apenas o primeiro.",
  };
}

/**
 * O anexo, sem o seu próprio título: cada documento encabeça-o à sua maneira —
 * «V – Resumos Curriculares» na informação da organização, uma secção no
 * documento das regras.
 *
 * Sai em duas partes porque as folhas vão em imagem, e a imagem da folha é mais
 * larga do que alta: a abertura fica no corpo vertical do documento e as folhas
 * numa secção horizontal, uma por página. Sem imagens — fora do browser, onde
 * não há canvas para as desenhar — a folha volta a sair em tabelas, no corpo.
 */
export function anexoDosResumos(
  config: LotesJSON,
  imagens: ImagemDaFolha[] = [],
): { corpo: BlocoDocumento[]; paisagem: BlocoDocumento[] } {
  const folhas = folhasDoAnexo(config);
  if (folhas.length === 0) return { corpo: [], paisagem: [] };

  const abertura = aberturaDoAnexo(config);
  if (imagens.length !== folhas.length) {
    return {
      corpo: [abertura, ...folhas.flatMap((folha, i) => [...quebraEntre(i), ...blocosDaFolha(folha)])],
      paisagem: [],
    };
  }

  return {
    corpo: [abertura],
    paisagem: imagens.map((imagem, i): BlocoDocumento => ({
      tipo: "imagem",
      dados: imagem.dados,
      largura: imagem.largura,
      altura: imagem.altura,
      descricao: `Resumo Curricular — ${imagem.perfil}`,
      // Cada folha começa uma página; a primeira continua a que o título abriu.
      novaPagina: i > 0,
    })),
  };
}

/**
 * A quebra vai entre folhas, e não antes da primeira: antes da primeira
 * deixaria o título do anexo sozinho no fim da página anterior.
 */
function quebraEntre(indice: number): BlocoDocumento[] {
  return indice === 0 ? [] : [{ tipo: "quebraDePagina" }];
}
