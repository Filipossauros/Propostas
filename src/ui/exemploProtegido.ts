// Palavra-passe para carregar dados de exemplo.
//
// Os exemplos substituem o trabalho em curso por dados fictícios. Num
// procedimento a sério, carregá-los por engano é estragar o que já estava
// feito — e, pior, é ficar sem saber se o que está no ecrã é o procedimento ou
// o exemplo. A palavra-passe existe para esse clique não acontecer por
// distração.
//
// Não é segurança, e não se faz passar por isso: a aplicação corre inteira no
// navegador, sem servidor nenhum, pelo que a palavra-passe está no código que o
// navegador descarrega e quem a quiser encontra-a. É um travão, não uma
// fechadura.

const PALAVRA_PASSE = "Filipossauros123";

/**
 * Uma vez certa, não se volta a pedir enquanto o separador estiver aberto:
 * quem já provou que sabe a palavra-passe não ganha nada em a escrever outra
 * vez ao mudar de módulo. Não fica guardada em lado nenhum — recarregar a
 * página volta a pedi-la.
 */
let autorizado = false;

/** Se está autorizado a carregar exemplos, perguntando quando for preciso. */
export function podeCarregarExemplo(): boolean {
  if (autorizado) return true;

  const escrita = prompt(
    "Os dados de exemplo substituem o trabalho em curso.\n\nIndique a palavra-passe para os carregar:",
  );
  // Cancelou: nada a dizer, ninguém se enganou.
  if (escrita === null) return false;

  if (escrita !== PALAVRA_PASSE) {
    alert("Palavra-passe errada. Os dados de exemplo não foram carregados.");
    return false;
  }

  autorizado = true;
  return true;
}
