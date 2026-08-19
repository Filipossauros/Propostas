// Persistência local do trabalho em curso (localStorage).
//
// ATENÇÃO — desvio deliberado ao princípio "sem persistência" do plano original,
// pedido explicitamente para não se perder trabalho entre sessões. O que é
// guardado está limitado ao trabalho de CONFIGURAÇÃO da entidade adjudicante
// (perfis do Módulo 1 e lotes do Módulo 2). Os dados das declarações carregadas
// no Módulo 3 — que contêm dados pessoais de candidatos — NUNCA são guardados:
// continuam a viver apenas em memória e desaparecem ao fechar o separador.

const PREFIXO = "propostas.v2.";

export const CHAVE_PERFIL = `${PREFIXO}perfil`;
export const CHAVE_LOTES = `${PREFIXO}lotes`;
/** Perfis já carregados/enviados mas ainda não atribuídos a nenhum lote. */
export const CHAVE_POR_ATRIBUIR = `${PREFIXO}porAtribuir`;

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

export function guardarEstado<T>(chave: string, valor: T): void {
  if (!PERSISTENCIA_DISPONIVEL) return;
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Quota esgotada: preferimos perder a gravação a interromper a edição.
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
