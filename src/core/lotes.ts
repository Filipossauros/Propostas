// Agrupamento de perfis em lotes e preço base — Módulo 2.
//
// Nota de método sobre o preço base: o valor de cada perfil dentro de um lote é
// `n.º mínimo de elementos × horas × preço/hora`, sem IVA.

import type {
  InformacaoEavalia,
  Lote,
  LotesJSON,
  EncargosPlurianuais,
  LinhaPlurianual,
  PerfilEmLote,
  PerfilJSON,
  PostoTrabalho,
  RespostaEavalia,
} from "./types";
import {
  ANO_MAXIMO,
  ANO_MINIMO,
  ANOS_PLURIANUAIS,
  EQUIPAMENTOS_POSTO,
  LOCAIS_POSTO,
  REGIMES_POSTO,
  REQUISITOS_EQUIPAMENTO_PADRAO,
  requisitosEquipamentoAtualizados,
  SCHEMA_VERSION_ATUAL,
  TAXA_IVA_PADRAO,
  encargosPlurianuaisIniciais,
  informacaoEavaliaInicial,
  postoTrabalhoInicial,
  regimeTemLocal,
} from "./types";
import { ErroImportacao, certificacoesDoPerfil, type ErroValidacao } from "./perfil";
import { gerarId } from "./id";

/**
 * Início fixo do nome do procedimento. O nome não se escreve à mão: forma-se a
 * partir do nome do projeto, para que as peças, os ficheiros e o pedido de
 * parecer digam todos exatamente a mesma coisa.
 */
export const PREFIXO_NOME_PROCEDIMENTO = "Aquisição de Serviços de Desenvolvimento e Manutenção do projeto ";

/**
 * O nome do procedimento correspondente a um projeto.
 *
 * Sem nome de projeto não há nome de procedimento: metade de um nome numa peça
 * é pior do que nenhum, e o nome do projeto por preencher já é questão por
 * resolver no Módulo 1.
 */
export function nomeProcedimentoDe(nomeProjeto: string): string {
  const projeto = nomeProjeto.trim();
  return projeto === "" ? "" : PREFIXO_NOME_PROCEDIMENTO + projeto;
}

export function criarLote(numero: string): Lote {
  return { id: gerarId(), numero, designacao: "", perfis: [] };
}

export function criarPerfilEmLote(perfil: PerfilJSON): PerfilEmLote {
  return { id: gerarId(), perfil, horas: 0, valorHora: 0, nMinimoElementos: 1 };
}

export function lotesIniciais(): LotesJSON {
  return {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    tipo: "lotes",
    nomeProjeto: "",
    nomeProcedimento: "",
    taxaIva: TAXA_IVA_PADRAO,
    umLotePorConcorrente: false,
    postoTrabalho: postoTrabalhoInicial(),
    eavalia: informacaoEavaliaInicial(),
    encargosPlurianuais: encargosPlurianuaisIniciais(),
    lotes: [],
  };
}

// --------------------------------------------------------------------------
// Validação
// --------------------------------------------------------------------------

/**
 * Condições de execução do posto de trabalho.
 *
 * O regime e o equipamento são listas pendentes com valor de partida: têm
 * sempre resposta, e não há nada a exigir. O que pode ficar por dizer é o que
 * depende dessas escolhas — o local, quando o regime o tem, e os requisitos,
 * quando o equipamento é do prestador.
 */
export function validarPostoTrabalho(posto: PostoTrabalho): ErroValidacao[] {
  const erros: ErroValidacao[] = [];

  if (regimeTemLocal(posto.regime)) {
    if (posto.locais.length === 0) {
      erros.push({
        campo: "postoTrabalho.locais",
        mensagem: `Posto de trabalho: em regime ${posto.regime.toLowerCase()}, indique o local da prestação de serviços.`,
      });
    }
    if (posto.locais.includes("Outro") && posto.outroLocal.trim() === "") {
      erros.push({
        campo: "postoTrabalho.outroLocal",
        mensagem: "Posto de trabalho: indique qual é o outro local da prestação de serviços.",
      });
    }
  }

  if (posto.equipamento === "Equipamentos do Prestador" && posto.requisitosEquipamento.trim() === "") {
    erros.push({
      campo: "postoTrabalho.requisitosEquipamento",
      mensagem: "Posto de trabalho: indique os requisitos mínimos do equipamento do prestador.",
    });
  }

  return erros;
}

/** As medidas do pedido de parecer eAvalia que esta aplicação preenche. */
const MEDIDAS_EAVALIA: Array<{ campo: keyof InformacaoEavalia; nome: string }> = [
  { campo: "iap", nome: "a utilização da plataforma de interoperabilidade da ARTE (iAP)" },
  { campo: "chaveMovelDigital", nome: "a utilização de chave móvel digital" },
  { campo: "idiomas", nome: "a disponibilização do portal em português e inglês" },
];

/**
 * Respostas ao alinhamento tecnológico. Todas são exigidas: o pedido de parecer
 * segue com elas, e uma célula em branco no formulário é uma medida por
 * responder — não é uma resposta.
 */
/**
 * O pedido de encargos plurianuais só se valida quando existe.
 *
 * A regra que importa é a soma: as horas repartidas pelos anos têm de dar as
 * horas contratadas para o perfil. Se não derem, a mesma peça diz dois preços
 * — o do preço base e o da soma dos anos — e é a primeira coisa que alguém
 * pergunta.
 */
export function validarEncargosPlurianuais(config: LotesJSON): ErroValidacao[] {
  const encargos = config.encargosPlurianuais;
  if (!encargos.ativo) return [];

  const erros: ErroValidacao[] = [];
  const ultimoAno = ANO_MAXIMO - ANOS_PLURIANUAIS + 1;
  if (!Number.isInteger(encargos.anoInicio) || encargos.anoInicio < ANO_MINIMO || encargos.anoInicio > ultimoAno) {
    erros.push({
      campo: "encargosPlurianuais.anoInicio",
      mensagem: `Encargos plurianuais: indique o ano de início do contrato, entre ${ANO_MINIMO} e ${ultimoAno}.`,
    });
  }

  for (const linha of linhasPlurianuais(config)) {
    const onde = `o perfil "${linha.perfil}" no lote ${linha.lote}`;
    if (linha.horas.some((h) => !Number.isFinite(h) || h < 0)) {
      erros.push({
        campo: `encargosPlurianuais.${linha.perfilEmLoteId}`,
        mensagem: `Encargos plurianuais: as horas de ${onde} não podem ser negativas.`,
      });
      continue;
    }
    const repartidas = linha.horas.reduce((soma, h) => soma + h, 0);
    if (repartidas !== linha.horasContratadas) {
      erros.push({
        campo: `encargosPlurianuais.${linha.perfilEmLoteId}`,
        mensagem:
          `Encargos plurianuais: as horas repartidas por ${onde} somam ${formatarNumero(repartidas)}, ` +
          `e o lote contratou ${formatarNumero(linha.horasContratadas)}.`,
      });
    }
  }

  return erros;
}

export function validarEavalia(eavalia: InformacaoEavalia): ErroValidacao[] {
  return MEDIDAS_EAVALIA.filter((m) => eavalia[m.campo] === "").map((m) => ({
    campo: `eavalia.${m.campo}`,
    mensagem: `Informação eAvalia: responda sobre ${m.nome}.`,
  }));
}

export function validarLotes(config: LotesJSON): ErroValidacao[] {
  const erros: ErroValidacao[] = [];

  if (config.lotes.length === 0) {
    erros.push({ campo: "lotes", mensagem: "Crie pelo menos um lote." });
  }

  const numerosVistos = new Set<string>();
  config.lotes.forEach((lote, idxLote) => {
    const numero = lote.numero.trim();
    if (numero === "") {
      erros.push({ campo: `lotes[${idxLote}].numero`, mensagem: `Lote ${idxLote + 1}: indique o número do lote.` });
    } else if (numerosVistos.has(numero)) {
      erros.push({ campo: `lotes[${idxLote}].numero`, mensagem: `Número de lote repetido: "${numero}".` });
    } else {
      numerosVistos.add(numero);
    }

    // A designação é obrigatória: dá nome ao ficheiro de formulários do lote e
    // aparece pré-preenchida na declaração entregue ao candidato.
    if (lote.designacao.trim() === "") {
      erros.push({
        campo: `lotes[${idxLote}].designacao`,
        mensagem: `Lote ${numero || idxLote + 1}: indique a designação do lote.`,
      });
    }

    if (lote.perfis.length === 0) {
      erros.push({
        campo: `lotes[${idxLote}].perfis`,
        mensagem: `Lote ${numero || idxLote + 1}: atribua pelo menos um perfil.`,
      });
    }

    lote.perfis.forEach((entrada, idxPerfil) => {
      const nome = entrada.perfil.perfil || `perfil ${idxPerfil + 1}`;
      const prefixo = `Lote ${numero || idxLote + 1}, ${nome}`;

      if (!Number.isFinite(entrada.horas) || entrada.horas <= 0) {
        erros.push({
          campo: `lotes[${idxLote}].perfis[${idxPerfil}].horas`,
          mensagem: `${prefixo}: indique um n.º de horas maior que zero.`,
        });
      }
      if (!Number.isFinite(entrada.valorHora) || entrada.valorHora <= 0) {
        erros.push({
          campo: `lotes[${idxLote}].perfis[${idxPerfil}].valorHora`,
          mensagem: `${prefixo}: indique um valor/hora maior que zero.`,
        });
      }
      if (!Number.isInteger(entrada.nMinimoElementos) || entrada.nMinimoElementos < 1) {
        erros.push({
          campo: `lotes[${idxLote}].perfis[${idxPerfil}].nMinimoElementos`,
          mensagem: `${prefixo}: o n.º mínimo de elementos deve ser um inteiro ≥ 1.`,
        });
      }
    });
  });

  // No fim, e por esta ordem, porque é a ordem por que os painéis aparecem no
  // Módulo 2: quem percorre a lista de erros percorre a página de cima a baixo.
  return [
    ...erros,
    ...validarPostoTrabalho(config.postoTrabalho),
    ...validarEavalia(config.eavalia),
    ...validarEncargosPlurianuais(config),
  ];
}

// --------------------------------------------------------------------------
// (Des)serialização
// --------------------------------------------------------------------------

export function lotesParaJSON(config: LotesJSON): string {
  return JSON.stringify(config, null, 2);
}

export function importarLotesJSON(texto: string): LotesJSON {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new ErroImportacao("O ficheiro não contém JSON válido.");
  }
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) {
    throw new ErroImportacao("O ficheiro não corresponde a uma configuração válida.");
  }

  const registo = bruto as Record<string, unknown>;
  if (registo.schemaVersion !== SCHEMA_VERSION_ATUAL) {
    throw new ErroImportacao(
      `Versão de esquema desconhecida ("${String(registo.schemaVersion)}"). ` +
        `Esta aplicação suporta a versão "${SCHEMA_VERSION_ATUAL}".`,
    );
  }
  if (registo.tipo !== "lotes") {
    throw new ErroImportacao(
      `Este ficheiro é do tipo "${String(registo.tipo)}", não um agrupamento de lotes.`,
    );
  }
  if (!Array.isArray(registo.lotes)) {
    throw new ErroImportacao("O ficheiro não contém uma lista de lotes.");
  }

  // A taxa de IVA, o nome do procedimento e a identidade do perfil foram
  // acrescentados depois: ficheiros anteriores não os têm.
  const config = bruto as unknown as LotesJSON;
  return {
    ...config,
    taxaIva: Number.isFinite(config.taxaIva) ? config.taxaIva : TAXA_IVA_PADRAO,
    nomeProjeto: config.nomeProjeto ?? "",
    nomeProcedimento: config.nomeProcedimento ?? "",
    umLotePorConcorrente: config.umLotePorConcorrente === true,
    postoTrabalho: normalizarPostoTrabalho((registo as { postoTrabalho?: unknown }).postoTrabalho),
    eavalia: normalizarEavalia((registo as { eavalia?: unknown }).eavalia),
    encargosPlurianuais: normalizarEncargosPlurianuais(
      (registo as { encargosPlurianuais?: unknown }).encargosPlurianuais,
    ),
    lotes: config.lotes.map((lote) => ({
      ...lote,
      perfis: lote.perfis.map((entrada) => ({
        ...entrada,
        perfil: {
          ...entrada.perfil,
          id: typeof entrada.perfil.id === "string" && entrada.perfil.id !== "" ? entrada.perfil.id : gerarId(),
        },
      })),
    })),
  };
}

/**
 * Põe em dia um agrupamento que estava guardado — no navegador ou num ficheiro.
 *
 * O que ficou gravado traz o modelo do dia em que foi gravado, e a aplicação
 * entretanto andou: campos que não existiam, opções que foram retiradas, textos
 * de partida que mudaram. É aqui que essa distância se resolve, num sítio só,
 * para o resto da aplicação poder contar com o modelo atual.
 */
export function normalizarLotesGuardados(config: LotesJSON): LotesJSON {
  return {
    ...config,
    postoTrabalho: normalizarPostoTrabalho(config.postoTrabalho),
    eavalia: normalizarEavalia(config.eavalia),
    encargosPlurianuais: normalizarEncargosPlurianuais(config.encargosPlurianuais),
  };
}

/** As respostas admitidas pela lista de validação do formulário eAvalia. */
const RESPOSTAS_EAVALIA: RespostaEavalia[] = [
  "",
  "Cumpre Totalmente",
  "Cumpre Parcialmente",
  "Já cumpre",
  "Não cumpre",
  "Não aplicável",
];

function lerResposta(valor: unknown): RespostaEavalia {
  return RESPOSTAS_EAVALIA.includes(valor as RespostaEavalia) ? (valor as RespostaEavalia) : "";
}

/**
 * Respostas eAvalia vindas de ficheiro. Ficheiros anteriores a este campo não
 * o trazem, e um valor que não conste da lista de validação é descartado: o
 * formulário recusá-lo-ia, e é preferível ficar por responder do que levar lá
 * um valor que não abre.
 */
function normalizarEavalia(bruto: unknown): InformacaoEavalia {
  if (typeof bruto !== "object" || bruto === null) return informacaoEavaliaInicial();
  const e = bruto as Record<string, unknown>;
  return {
    iap: lerResposta(e.iap),
    chaveMovelDigital: lerResposta(e.chaveMovelDigital),
    idiomas: lerResposta(e.idiomas),
  };
}

/** Só as opções que constam da lista, e sem repetições, pela ordem da lista. */
function lerOpcoes<T extends string>(bruto: unknown, admitidas: readonly T[]): T[] {
  if (!Array.isArray(bruto)) return [];
  return admitidas.filter((opcao) => bruto.includes(opcao));
}

/**
 * Uma escolha única, aceitando também a lista com que estes campos já foram
 * guardados: fica a primeira que ainda conste da lista de opções. Um valor que
 * tenha entretanto deixado de existir — o antigo regime de teletrabalho — cai
 * no valor de partida, que é o que o utilizador veria se começasse agora.
 */
function lerEscolha<T extends string>(bruto: unknown, admitidas: readonly T[], omissao: T): T {
  const candidatos = Array.isArray(bruto) ? bruto : [bruto];
  return (candidatos.find((c) => admitidas.includes(c as T)) as T | undefined) ?? omissao;
}

/**
 * Posto de trabalho vindo de ficheiro. Ficheiros anteriores a este campo não o
 * trazem, e nesses assume-se o valor de partida.
 */
/**
 * Pedido plurianual vindo de ficheiro. Ficheiros anteriores a este campo não o
 * têm, e abrem sem pedido — que é o que eram.
 */
function normalizarEncargosPlurianuais(bruto: unknown): EncargosPlurianuais {
  const partida = encargosPlurianuaisIniciais();
  if (typeof bruto !== "object" || bruto === null) return partida;
  const e = bruto as Record<string, unknown>;
  const guardadas = Array.isArray(e.linhas) ? e.linhas : [];

  return {
    ativo: e.ativo === true,
    anoInicio: Number.isInteger(e.anoInicio) ? (e.anoInicio as number) : partida.anoInicio,
    linhas: guardadas.flatMap((linha) => {
      if (typeof linha !== "object" || linha === null) return [];
      const l = linha as Record<string, unknown>;
      if (typeof l.perfilEmLoteId !== "string" || l.perfilEmLoteId === "") return [];
      // Uma linha sem repartição de horas é como se não existisse: as horas
      // voltam à repartição de partida, calculada a partir do lote.
      if (!Array.isArray(l.horas)) return [];
      return [
        {
          perfilEmLoteId: l.perfilEmLoteId,
          horas: Array.from({ length: ANOS_PLURIANUAIS }, (_, i) => numeroOuZero((l.horas as unknown[])[i])),
        },
      ];
    }),
  };
}

function numeroOuZero(valor: unknown): number {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
}

function normalizarPostoTrabalho(bruto: unknown): PostoTrabalho {
  if (typeof bruto !== "object" || bruto === null) return postoTrabalhoInicial();
  const p = bruto as Record<string, unknown>;
  const partida = postoTrabalhoInicial();
  return {
    regime: lerEscolha(p.regime ?? p.regimes, REGIMES_POSTO, partida.regime),
    locais: lerOpcoes(p.locais, LOCAIS_POSTO),
    outroLocal: typeof p.outroLocal === "string" ? p.outroLocal : "",
    equipamento: lerEscolha(p.equipamento ?? p.equipamentos, EQUIPAMENTOS_POSTO, partida.equipamento),
    requisitosEquipamento:
      typeof p.requisitosEquipamento === "string"
        ? requisitosEquipamentoAtualizados(p.requisitosEquipamento)
        : REQUISITOS_EQUIPAMENTO_PADRAO,
  };
}

/** Todos os perfis atribuídos a lotes, na ordem em que aparecem. */
export function perfisEmLotes(config: LotesJSON): PerfilJSON[] {
  return config.lotes.flatMap((lote) => lote.perfis.map((entrada) => entrada.perfil));
}

/**
 * Ficheiro único com os formulários de declaração de todos os perfis atribuídos
 * a lotes, e a informação de lote que os acompanha. É o par em JSON do ficheiro
 * Excel dos formulários — mesma matéria, formato legível por outra aplicação.
 */
export function formulariosParaJSON(config: LotesJSON): string {
  const ficheiro = {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    tipo: "formularios" as const,
    nomeProjeto: config.nomeProjeto,
    nomeProcedimento: config.nomeProcedimento,
    formularios: config.lotes.flatMap((lote) =>
      lote.perfis.map((entrada) => ({
        lote: lote.numero,
        loteDesignacao: lote.designacao,
        perfil: entrada.perfil.perfil,
        nBlocos: entrada.perfil.nBlocos,
        nMinimoElementos: entrada.nMinimoElementos,
        horas: entrada.horas,
        valorHora: entrada.valorHora,
        precoBase: precoBaseEntrada(entrada),
        requisitos: entrada.perfil.requisitos,
      })),
    ),
  };
  return JSON.stringify(ficheiro, null, 2);
}

/** Um perfil do agrupamento que exige certificação, com o lote onde está. */
export interface PerfilComCertificacao {
  loteNumero: string;
  loteDesignacao: string;
  perfil: string;
  certificacoes: string[];
}

/**
 * Perfis do agrupamento que exigem certificação.
 *
 * O Módulo 3 usa isto para chamar a atenção do júri: a certificação não é
 * apurada por esta aplicação — verifica-se contra as peças da proposta — e o
 * risco é justamente passar despercebida por não aparecer em lado nenhum do
 * apuramento.
 */
export function perfisComCertificacao(config: LotesJSON): PerfilComCertificacao[] {
  return config.lotes.flatMap((lote) =>
    lote.perfis
      .map((entrada) => ({
        loteNumero: lote.numero,
        loteDesignacao: lote.designacao,
        perfil: entrada.perfil.perfil,
        certificacoes: certificacoesDoPerfil(entrada.perfil),
      }))
      .filter((p) => p.certificacoes.length > 0),
  );
}

/**
 * Chamada de atenção das certificações. Dita uma só vez, e não por perfil: é o
 * mesmo aviso para todos, e repeti-lo linha a linha ocupava a página sem
 * acrescentar nada. Os perfis a que respeita ficam listados por baixo.
 */
export const AVISO_CERTIFICACAO =
  "Além dos requisitos mínimos verificados, este(s) perfil(is) requer(em) ainda a apresentação de uma " +
  "certificação. Deve ser validada a apresentação da mesma nas peças da proposta.";

/** Número do lote a que cada perfil está atribuído, indexado pelo id do perfil. */
export function lotePorPerfilId(config: LotesJSON): Record<string, string> {
  const mapa: Record<string, string> = {};
  for (const lote of config.lotes) {
    for (const entrada of lote.perfis) mapa[entrada.perfil.id] = lote.numero;
  }
  return mapa;
}

/**
 * Repõe nos lotes a versão atual de cada perfil do catálogo do Módulo 1.
 *
 * É isto que torna a edição transversal: alterar um requisito no Módulo 1
 * altera-o também no lote onde o perfil já esteja atribuído. Um perfil que
 * tenha desaparecido do catálogo é retirado do lote — deixou de existir.
 */
export function sincronizarPerfisEmLotes(config: LotesJSON, perfis: PerfilJSON[]): LotesJSON {
  const porId = new Map(perfis.map((p) => [p.id, p]));
  return {
    ...config,
    lotes: config.lotes.map((lote) => ({
      ...lote,
      perfis: lote.perfis.flatMap((entrada) => {
        const atual = porId.get(entrada.perfil.id);
        return atual === undefined ? [] : [{ ...entrada, perfil: atual }];
      }),
    })),
  };
}


// --------------------------------------------------------------------------
// Preço base
// --------------------------------------------------------------------------

export interface Valores {
  /** Base tributável: horas × preço unitário/hora, sem IVA. */
  semIva: number;
  iva: number;
  comIva: number;
}

export function aplicarIva(semIva: number, taxaIva: number): Valores {
  const iva = semIva * (taxaIva / 100);
  return { semIva, iva, comIva: semIva + iva };
}

export interface LinhaTabelaValores {
  loteId: string;
  perfilEmLoteId: string;
  lote: string;
  loteDesignacao: string;
  perfil: string;
  nMinimoElementos: number;
  horas: number;
  /** Preço unitário por hora, sem IVA. */
  valorHora: number;
  valores: Valores;
}

/** Preço base de um perfil dentro de um lote, sem IVA: n.º mínimo de elementos × horas × preço/hora. */
export function precoBaseEntrada(entrada: PerfilEmLote): number {
  return entrada.nMinimoElementos * entrada.horas * entrada.valorHora;
}

export function linhasTabelaValores(config: LotesJSON): LinhaTabelaValores[] {
  return config.lotes.flatMap((lote) =>
    lote.perfis.map((entrada) => ({
      loteId: lote.id,
      perfilEmLoteId: entrada.id,
      lote: lote.numero,
      loteDesignacao: lote.designacao,
      perfil: entrada.perfil.perfil,
      nMinimoElementos: entrada.nMinimoElementos,
      horas: entrada.horas,
      valorHora: entrada.valorHora,
      valores: aplicarIva(precoBaseEntrada(entrada), taxaIva(config)),
    })),
  );
}

// --------------------------------------------------------------------------
// Pedido de encargos plurianuais
// --------------------------------------------------------------------------

/** Os anos económicos do pedido: o do início do contrato e os dois seguintes. */
export function anosPlurianuais(anoInicio: number): number[] {
  return Array.from({ length: ANOS_PLURIANUAIS }, (_, i) => anoInicio + i);
}

/** Uma linha do pedido, já com o que vem do agrupamento e o que foi repartido. */
export interface LinhaPlurianualCompleta {
  perfilEmLoteId: string;
  lote: string;
  perfil: string;
  /** N.º de elementos exigido para o perfil no lote. */
  pessoas: number;
  /** Preço/hora do lote, que aqui não se altera. */
  valorHoraSemIva: number;
  valorHoraComIva: number;
  /** Horas contratadas para o perfil, no total do contrato. */
  horasContratadas: number;
  /** Horas em cada ano, pela ordem de `anosPlurianuais`. */
  horas: number[];
  /** Valor a assumir em cada ano, com IVA: pessoas × horas do ano × preço/hora. */
  totais: number[];
}

/**
 * Repartição de partida: o total do lote dividido por igual pelos anos.
 *
 * É um palpite, e assume-se como tal — nenhum contrato começa a 1 de janeiro
 * por acaso. Serve para a tabela abrir com a soma certa, que é o que interessa:
 * a partir daí ajusta-se ano a ano.
 */
export function distribuicaoPadrao(horasContratadas: number): number[] {
  if (!Number.isFinite(horasContratadas) || horasContratadas <= 0) {
    return Array.from({ length: ANOS_PLURIANUAIS }, () => 0);
  }
  const porAno = Math.floor(horasContratadas / ANOS_PLURIANUAIS);
  return Array.from({ length: ANOS_PLURIANUAIS }, (_, i) =>
    // O resto vai todo para o último ano, para a soma bater certo ao cêntimo.
    i === ANOS_PLURIANUAIS - 1 ? horasContratadas - porAno * (ANOS_PLURIANUAIS - 1) : porAno,
  );
}

/** Ajusta uma repartição guardada ao número de anos de hoje. */
function horasDe(guardadas: number[] | undefined, horasContratadas: number): number[] {
  if (guardadas === undefined) return distribuicaoPadrao(horasContratadas);
  return Array.from({ length: ANOS_PLURIANUAIS }, (_, i) => {
    const valor = guardadas[i];
    return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
  });
}

/**
 * As linhas do pedido, uma por perfil dentro de cada lote.
 *
 * Tudo vem do agrupamento menos a repartição das horas: um perfil acrescentado
 * ao lote aparece aqui com a repartição de partida, e um perfil retirado
 * desaparece — sem ninguém ter de mexer no pedido.
 */
export function linhasPlurianuais(config: LotesJSON): LinhaPlurianualCompleta[] {
  const repartidas = new Map(config.encargosPlurianuais.linhas.map((l) => [l.perfilEmLoteId, l]));
  const taxa = taxaIva(config);

  return config.lotes.flatMap((lote) =>
    lote.perfis.map((entrada) => {
      const horas = horasDe(repartidas.get(entrada.id)?.horas, entrada.horas);
      const valorHoraComIva = aplicarIva(entrada.valorHora, taxa).comIva;
      return {
        perfilEmLoteId: entrada.id,
        lote: lote.numero,
        perfil: entrada.perfil.perfil,
        pessoas: entrada.nMinimoElementos,
        valorHoraSemIva: entrada.valorHora,
        valorHoraComIva,
        horasContratadas: entrada.horas,
        horas,
        totais: horas.map((h) => entrada.nMinimoElementos * h * valorHoraComIva),
      };
    }),
  );
}

/** O total pedido para cada ano, somando todas as linhas. */
export function totaisPorAnoPlurianual(config: LotesJSON): number[] {
  return linhasPlurianuais(config).reduce(
    (soma, linha) => soma.map((valor, i) => valor + linha.totais[i]),
    Array.from({ length: ANOS_PLURIANUAIS }, () => 0),
  );
}

/** Guarda a repartição de horas de uma linha. */
export function comHorasPlurianuaisAlteradas(
  encargos: EncargosPlurianuais,
  perfilEmLoteId: string,
  horas: number[],
): EncargosPlurianuais {
  const outras = encargos.linhas.filter((l) => l.perfilEmLoteId !== perfilEmLoteId);
  const nova: LinhaPlurianual = { perfilEmLoteId, horas };
  return { ...encargos, linhas: [...outras, nova] };
}

/** Taxa de IVA da configuração, tolerando ficheiros anteriores que não a tinham. */
export function taxaIva(config: LotesJSON): number {
  return Number.isFinite(config.taxaIva) ? config.taxaIva : TAXA_IVA_PADRAO;
}

export function totalLote(lote: Lote, taxa: number): Valores {
  return aplicarIva(
    lote.perfis.reduce((soma, e) => soma + precoBaseEntrada(e), 0),
    taxa,
  );
}

export function totalProcedimento(config: LotesJSON): Valores {
  return aplicarIva(
    config.lotes.reduce((soma, lote) => soma + totalLote(lote, 0).semIva, 0),
    taxaIva(config),
  );
}

const formatadorMoeda = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatarMoeda(valor: number): string {
  return Number.isFinite(valor) ? formatadorMoeda.format(valor) : "—";
}

const formatadorNumero = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 });

export function formatarNumero(valor: number): string {
  return Number.isFinite(valor) ? formatadorNumero.format(valor) : "—";
}
