import { useCallback, useEffect, useRef, useState } from "react";
import type { Perguntar } from "./contextoExemplos";
import { ContextoExemplos } from "./contextoExemplos";

// Palavra-passe para carregar dados de exemplo.
//
// Os exemplos substituem o trabalho em curso por dados fictícios. Num
// procedimento a sério, carregá-los por engano é estragar o que já estava feito
// — e, pior, é ficar sem saber se o que está no ecrã é o procedimento ou o
// exemplo. A palavra-passe existe para esse clique não acontecer por distração.
//
// Não é segurança, e não se faz passar por isso: a aplicação corre inteira no
// navegador, sem servidor nenhum, pelo que a palavra-passe está no código que o
// navegador descarrega e quem a quiser encontra-a. É um travão, não uma
// fechadura.

const PALAVRA_PASSE = "Filipossauros123";

/** O que fazer com a resposta ao pedido que está no ecrã. */
interface Pedido {
  responder: (autorizado: boolean) => void;
}

export function ProtecaoExemplos({ children }: { children: React.ReactNode }) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  // Uma vez certa, não se volta a pedir enquanto o separador estiver aberto:
  // quem já provou que a sabe não ganha nada em a escrever outra vez ao mudar
  // de módulo. Não fica guardada em lado nenhum — recarregar volta a pedi-la.
  const [autorizado, setAutorizado] = useState(false);

  const perguntar = useCallback<Perguntar>(() => {
    if (autorizado) return Promise.resolve(true);
    return new Promise<boolean>((responder) => setPedido({ responder }));
  }, [autorizado]);

  function fechar(autorizacao: boolean) {
    if (autorizacao) setAutorizado(true);
    pedido?.responder(autorizacao);
    setPedido(null);
  }

  return (
    <ContextoExemplos.Provider value={perguntar}>
      {children}
      {pedido !== null && <DialogoPalavraPasse esperada={PALAVRA_PASSE} onFechar={fechar} />}
    </ContextoExemplos.Provider>
  );
}

function DialogoPalavraPasse({ esperada, onFechar }: { esperada: string; onFechar: (ok: boolean) => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [escrita, setEscrita] = useState("");
  const [errada, setErrada] = useState(false);

  // O <dialog> nativo trata do que seria trabalhoso à mão: prende o foco
  // dentro de si, escurece o resto da página e fecha na tecla Escape.
  useEffect(() => {
    dialogo.current?.showModal();
  }, []);

  function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (escrita === esperada) {
      onFechar(true);
      return;
    }
    // Não se fecha à primeira falha: quem se enganou a escrever quer tentar
    // outra vez, e não voltar ao princípio.
    setErrada(true);
    setEscrita("");
  }

  return (
    <dialog
      ref={dialogo}
      className="dialogo"
      aria-labelledby="titulo-palavra-passe"
      onCancel={(e) => {
        e.preventDefault();
        onFechar(false);
      }}
    >
      <form onSubmit={submeter}>
        <h3 id="titulo-palavra-passe">Carregar dados de exemplo</h3>
        <p className="dialogo-nota">
          Os dados de exemplo substituem o trabalho em curso. Indique a palavra-passe para os carregar.
        </p>

        <label>
          <span className="rotulo">Palavra-passe</span>
          <input
            type="password"
            value={escrita}
            autoFocus
            autoComplete="off"
            aria-invalid={errada}
            aria-describedby={errada ? "erro-palavra-passe" : undefined}
            onChange={(e) => {
              setEscrita(e.target.value);
              setErrada(false);
            }}
          />
        </label>

        {errada && (
          <p className="aviso aviso-erro" id="erro-palavra-passe" role="alert">
            Palavra-passe errada. Nada foi carregado.
          </p>
        )}

        <div className="dialogo-acoes">
          <button type="button" className="botao-secundario" onClick={() => onFechar(false)}>
            Cancelar
          </button>
          <button type="submit" className="botao-principal" disabled={escrita === ""}>
            Carregar exemplo
          </button>
        </div>
      </form>
    </dialog>
  );
}
