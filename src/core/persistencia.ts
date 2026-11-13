// Persistência local do trabalho em curso (localStorage).
//
// ATENÇÃO — desvio deliberado ao princípio "sem persistência" do plano original,
// pedido explicitamente para não se perder trabalho entre sessões. O que é
// guardado está limitado ao trabalho da entidade adjudicante: a biblioteca de
// pedidos (projeto, perfis e lotes; ou produto, licenças e condições) e a Vista
// Geral da unidade. Os dados das declarações
// carregadas no Módulo 4 — que contêm dados pessoais de CANDIDATOS — NUNCA são
// guardados: continuam a viver apenas em memória e desaparecem ao fechar o
// separador.
//
// A Vista Geral traz nomes de pessoas da equipa, registados à mão por quem a
// preenche. Ficam neste navegador, e só nele — como tudo o resto, nada sai do
// posto de trabalho. Apagar um projeto apaga também os nomes que lhe estavam
// afetos.

// Esta versão guarda tudo em chaves próprias («propostas.v3.»): a versão
// anterior, publicada ao lado no mesmo endereço, continua com as suas
// («propostas.v2.»), que aqui só se leem — uma vez, para copiar o que lá
// estava. Ver `copiarDaVersaoAnterior` e `bibliotecaDaVersaoAnterior`.
const PREFIXO = "propostas.v3.";
const PREFIXO_ANTERIOR = "propostas.v2.";

/** A biblioteca de pedidos: todos os pedidos de bolsa de horas e de licenciamento, e o que está aberto. */
export const CHAVE_BIBLIOTECA = `${PREFIXO}biblioteca`;
/** Orçamento da unidade da Vista Geral, com os elementos internos registados. */
export const CHAVE_VISTA_GERAL = `${PREFIXO}vistaGeral`;

function armazenamentoDisponivel(): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    const sonda = `${PREFIXO}__sonda__`;
    localStorage.setItem(sonda, "1");
    localStorage.removeItem(sonda);
    return true;
  } catch {
    // Modo privado, quota esgotada ou armazenamento bloqueado por política.
    return false;
  }
}

export const PERSISTENCIA_DISPONIVEL = armazenamentoDisponivel();

export function lerEstado<T>(chave: string): T | null {
  if (!PERSISTENCIA_DISPONIVEL) return null;
  try {
    const bruto = localStorage.getItem(chave);
    if (bruto === null) return null;
    return JSON.parse(bruto) as T;
  } catch {
    // Conteúdo corrompido ou de uma versão anterior: ignorar em silêncio e
    // recomeçar do estado inicial, em vez de bloquear a aplicação.
    return null;
  }
}

/** Grava; diz se conseguiu (sem armazenamento ou com a quota esgotada, não). */
export function guardarEstado<T>(chave: string, valor: T): boolean {
  if (!PERSISTENCIA_DISPONIVEL) return false;
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch {
    // Quota esgotada: preferimos perder a gravação a interromper a edição — e
    // quem chama decide se avisa.
    return false;
  }
}

export function limparEstado(chave: string): void {
  if (!PERSISTENCIA_DISPONIVEL) return;
  try {
    localStorage.removeItem(chave);
  } catch {
    // Sem recurso útil — ignorar.
  }
}
/**
 * Data-limite de apresentação de propostas, indicada na análise (Módulo 4): o
 * teto das datas declaradas. É do procedimento, não dos candidatos, e por isso
 * pode ficar no navegador — ao contrário das declarações, que nunca ficam.
 */
export const CHAVE_DATA_LIMITE_ANALISE = `${PREFIXO}dataLimiteAnalise`;

/** As chaves que passam como estão da versão anterior, na primeira abertura. */
const CHAVES_COPIADAS = ["vistaGeral", "dataLimiteAnalise"];

/**
 * Copia para as chaves desta versão o que a anterior guardou e ainda cá não
 * está. Só lê as chaves antigas: a versão anterior continua a funcionar.
 */
export function copiarDaVersaoAnterior(): void {
  if (!PERSISTENCIA_DISPONIVEL) return;
  for (const nome of CHAVES_COPIADAS) {
    try {
      if (localStorage.getItem(`${PREFIXO}${nome}`) !== null) continue;
      const antigo = localStorage.getItem(`${PREFIXO_ANTERIOR}${nome}`);
      if (antigo !== null) localStorage.setItem(`${PREFIXO}${nome}`, antigo);
    } catch {
      // Sem armazenamento: não há o que copiar.
    }
  }
}

/** Lê uma chave em bruto (JSON), sem a validar — para a migração. */
export function lerChave(chave: string): unknown {
  return lerEstado<unknown>(chave);
}
