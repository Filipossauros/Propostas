// Validação, (des)serialização e texto de caderno de encargos dos PERFIS — Módulo 1.

import type { PerfilJSON, PerfisJSON, Requisito } from "./types";
import { MESES_POR_ANO, SCHEMA_VERSION_ATUAL, anosDeMeses } from "./types";
import { gerarId } from "./id";

export interface ErroValidacao {
  campo: string;
  mensagem: string;
}

export function perfilInicial(): PerfilJSON {
  return {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    tipo: "perfil",
    id: gerarId(),
    perfil: "",
    nBlocos: 15,
    conteudoFuncional: "",
    requisitos: [],
  };
}

/**
 * Cópia de um perfil com identidade nova — duplicar não pode partilhar o `id`,
 * ou as duas cópias passariam a ser o mesmo perfil aos olhos da propagação.
 * Os requisitos também levam ids novos, para poderem ser editados em separado.
 */
export function duplicarPerfil(perfil: PerfilJSON): PerfilJSON {
  return {
    ...perfil,
    id: gerarId(),
    perfil: `${perfil.perfil} (cópia)`,
    requisitos: perfil.requisitos.map((r) => ({ ...r, id: gerarId() })),
  };
}

export function ehListaDePerfisGuardada(valor: unknown): valor is PerfilJSON[] {
  return (
    Array.isArray(valor) &&
    valor.every((p) => {
      if (typeof p !== "object" || p === null) return false;
      const perfil = p as Partial<PerfilJSON>;
      return (
        perfil.tipo === "perfil" &&
        perfil.schemaVersion === SCHEMA_VERSION_ATUAL &&
        typeof perfil.id === "string" &&
        Array.isArray(perfil.requisitos)
      );
    })
  );
}

export function validarRequisitos(requisitos: Requisito[]): ErroValidacao[] {
  const erros: ErroValidacao[] = [];
  const designacoesVistas = new Set<string>();

  requisitos.forEach((r, idx) => {
    const designacao = r.designacao.trim();
    const nome = designacao || `Requisito ${idx + 1}`;

    if (designacao === "") {
      erros.push({ campo: `requisitos[${idx}].designacao`, mensagem: "A designação do requisito não pode ser vazia." });
    } else if (designacoesVistas.has(designacao)) {
      erros.push({ campo: `requisitos[${idx}].designacao`, mensagem: `Designação repetida: "${designacao}".` });
    } else {
      designacoesVistas.add(designacao);
    }

    // A exigência é declarada em anos completos; guardamos o equivalente em
    // meses, porque é em meses de calendário que a Regra A apura.
    if (
      !Number.isInteger(r.mesesMinimos) ||
      r.mesesMinimos < MESES_POR_ANO ||
      r.mesesMinimos % MESES_POR_ANO !== 0
    ) {
      erros.push({
        campo: `requisitos[${idx}].mesesMinimos`,
        mensagem: `"${nome}": a experiência mínima deve ser um número inteiro de anos, igual ou superior a 1.`,
      });
    }
  });

  return erros;
}

/**
 * Valida um perfil. Nota: `procedimento` é deliberadamente opcional — nesta fase
 * pré-contratual o número do procedimento pode ainda não existir.
 */
export function validarPerfil(perfil: PerfilJSON): ErroValidacao[] {
  const erros: ErroValidacao[] = [];

  if (perfil.perfil.trim() === "") {
    erros.push({ campo: "perfil", mensagem: "Indique a designação do perfil." });
  }
  if (!Number.isInteger(perfil.nBlocos) || perfil.nBlocos < 1) {
    erros.push({ campo: "nBlocos", mensagem: "O n.º de blocos deve ser um inteiro ≥ 1." });
  }
  if (perfil.conteudoFuncional.trim() === "") {
    erros.push({ campo: "conteudoFuncional", mensagem: "Descreva o conteúdo funcional do perfil." });
  }
  if (perfil.requisitos.length === 0) {
    erros.push({ campo: "requisitos", mensagem: "Defina pelo menos um requisito." });
  }

  return [...erros, ...validarRequisitos(perfil.requisitos)];
}

/**
 * Valida o conjunto de perfis do Módulo 1.
 *
 * Além dos erros de cada perfil, exige designações distintas: é a designação
 * que dá nome à folha do perfil no formulário Excel e que identifica o perfil
 * na leitura das declarações, pelo que duas iguais tornariam a declaração
 * impossível de atribuir a um deles.
 */
export function validarPerfis(perfis: PerfilJSON[]): ErroValidacao[] {
  const erros: ErroValidacao[] = [];

  if (perfis.length === 0) {
    erros.push({ campo: "perfis", mensagem: "Crie pelo menos um perfil." });
  }

  const designacoesVistas = new Set<string>();
  perfis.forEach((perfil, idx) => {
    const designacao = perfil.perfil.trim();
    const nome = designacao || `Perfil ${idx + 1}`;

    if (designacao !== "" && designacoesVistas.has(designacao)) {
      erros.push({ campo: `perfis[${idx}].perfil`, mensagem: `Designação de perfil repetida: "${designacao}".` });
    } else if (designacao !== "") {
      designacoesVistas.add(designacao);
    }

    for (const erro of validarPerfil(perfil)) {
      erros.push({ campo: `perfis[${idx}].${erro.campo}`, mensagem: `${nome}: ${erro.mensagem}` });
    }
  });

  return erros;
}

/** Serializa todos os perfis num ficheiro único. */
export function perfisParaJSON(perfis: PerfilJSON[], nomeProjeto: string): string {
  const ficheiro: PerfisJSON = { schemaVersion: SCHEMA_VERSION_ATUAL, tipo: "perfis", nomeProjeto, perfis };
  return JSON.stringify(ficheiro, null, 2);
}

/**
 * O nome do projeto é obrigatório: identifica os ficheiros entregues e dá nome
 * a todos os descarregamentos, nos dois módulos.
 */
export function validarNomeProjeto(nomeProjeto: string): ErroValidacao[] {
  return nomeProjeto.trim() === ""
    ? [{ campo: "nomeProjeto", mensagem: "Indique o nome do projeto." }]
    : [];
}

export class ErroImportacao extends Error {}

function analisarJSON(texto: string): Record<string, unknown> {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new ErroImportacao("O ficheiro não contém JSON válido.");
  }
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) {
    throw new ErroImportacao("O ficheiro não corresponde a uma configuração válida.");
  }
  return bruto as Record<string, unknown>;
}

function verificarSchemaVersion(bruto: Record<string, unknown>): void {
  if (bruto.schemaVersion !== SCHEMA_VERSION_ATUAL) {
    throw new ErroImportacao(
      `Versão de esquema desconhecida ("${String(bruto.schemaVersion)}"). ` +
        `Esta aplicação suporta a versão "${SCHEMA_VERSION_ATUAL}".`,
    );
  }
}

/**
 * Normaliza um perfil vindo de ficheiro. Ficheiros gerados antes de o perfil
 * ter identidade própria não trazem `id`: damos-lhe um, para que passe a
 * participar na propagação de alterações como qualquer outro.
 */
function normalizarPerfil(bruto: Record<string, unknown>): PerfilJSON {
  if (!Array.isArray(bruto.requisitos)) {
    throw new ErroImportacao("O ficheiro de perfil não contém uma lista de requisitos.");
  }
  const perfil = bruto as unknown as PerfilJSON;
  return {
    ...perfil,
    tipo: "perfil",
    id: typeof perfil.id === "string" && perfil.id !== "" ? perfil.id : gerarId(),
    conteudoFuncional: typeof perfil.conteudoFuncional === "string" ? perfil.conteudoFuncional : "",
  };
}

export interface PerfisImportados {
  perfis: PerfilJSON[];
  /** Vazio nos ficheiros de perfil isolado, que ainda não o traziam. */
  nomeProjeto: string;
}

/**
 * Reconstrói os perfis de um ficheiro exportado. Aceita tanto o ficheiro único
 * com vários perfis (`tipo: "perfis"`) como o ficheiro de perfil isolado
 * (`tipo: "perfil"`) das versões anteriores.
 */
export function importarPerfisJSON(texto: string): PerfisImportados {
  const bruto = analisarJSON(texto);
  verificarSchemaVersion(bruto);

  if (bruto.tipo === "perfis") {
    if (!Array.isArray(bruto.perfis)) {
      throw new ErroImportacao("O ficheiro de perfis não contém uma lista de perfis.");
    }
    return {
      nomeProjeto: typeof bruto.nomeProjeto === "string" ? bruto.nomeProjeto : "",
      perfis: bruto.perfis.map((p) => {
        if (typeof p !== "object" || p === null || Array.isArray(p)) {
          throw new ErroImportacao("O ficheiro de perfis contém uma entrada que não é um perfil.");
        }
        return normalizarPerfil(p as Record<string, unknown>);
      }),
    };
  }

  if (bruto.tipo === "perfil") {
    return { nomeProjeto: "", perfis: [normalizarPerfil(bruto)] };
  }

  throw new ErroImportacao(
    `Este ficheiro é do tipo "${String(bruto.tipo)}", não um perfil. Carregue um ficheiro de perfil (Módulo 1).`,
  );
}

/** Lê o `tipo` de um ficheiro de configuração, validando primeiro a versão de esquema. */
export function lerTipoConfiguracao(texto: string): string {
  const bruto = analisarJSON(texto);
  verificarSchemaVersion(bruto);
  return String(bruto.tipo ?? "");
}

export interface GrupoDeExigencia {
  mesesMinimos: number;
  anosMinimos: number;
  designacoes: string[];
}

/** Agrupa os requisitos por exigência, do mais exigente para o menos exigente. */
export function agruparPorExigencia(requisitos: Requisito[]): GrupoDeExigencia[] {
  const grupos = new Map<number, string[]>();
  for (const r of requisitos) {
    const lista = grupos.get(r.mesesMinimos) ?? [];
    lista.push(r.designacao);
    grupos.set(r.mesesMinimos, lista);
  }

  return [...grupos.keys()]
    .sort((a, b) => b - a)
    .map((mesesMinimos) => ({
      mesesMinimos,
      anosMinimos: anosDeMeses(mesesMinimos),
      designacoes: grupos.get(mesesMinimos)!,
    }));
}

export function exigenciaPorExtenso(anos: number, meses: number): string {
  return `${anos} ${anos === 1 ? "ano" : "anos"} (${meses} meses)`;
}

/** Texto simples para o caderno de encargos, agrupado por exigência. */
export function gerarTextoCadernoEncargos(requisitos: Requisito[]): string {
  return agruparPorExigencia(requisitos)
    .map((g) => {
      const designacoes = g.designacoes.map((d) => `  - ${d}`).join("\n");
      return `Experiência mínima de ${exigenciaPorExtenso(g.anosMinimos, g.mesesMinimos)} em:\n${designacoes}`;
    })
    .join("\n\n");
}
