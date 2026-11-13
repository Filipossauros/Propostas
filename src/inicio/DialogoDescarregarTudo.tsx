import { useEffect, useRef, useState } from "react";
import {
  nomeDoPedido,
  nomeParaListas,
  pedidoParaJSON,
  questoesDoPedido,
  type PedidoNaBiblioteca,
} from "../core/biblioteca";
import { GRUPOS_DO_PACOTE, ficheirosDoPedido } from "../saidas/pedidoCompleto";
import { ErroModeloEavalia } from "../excel/eavalia";
import { nomeSeguro } from "../ui/descarregar";
import { descarregarPacote, nomeDoPacote } from "../ui/pacote";

interface Props {
  pedido: PedidoNaBiblioteca;
  onFechar: () => void;
}

/**
 * «Descarregar tudo»: um ZIP com todas as peças do pedido. Os descarregamentos
 * de cada módulo continuam onde estavam. Com questões por resolver, as peças
 * não saem — como nos módulos —, e só o ficheiro do pedido se descarrega.
 */
export function DialogoDescarregarTudo({ pedido, onFechar }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const grupos = GRUPOS_DO_PACOTE[pedido.tipo];
  const [escolhidos, setEscolhidos] = useState<Set<string>>(() => new Set(grupos.map((g) => g.id)));
  const [aGerar, setAGerar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const questoes = questoesDoPedido(pedido);
  const semNumeros =
    pedido.tipo === "bolsa"
      ? pedido.dados.lotes.numeroInformacao.trim() === "" || pedido.dados.lotes.numeroOrcamento.trim() === ""
      : pedido.dados.numeroInformacao.trim() === "" || pedido.dados.numeroOrcamento.trim() === "";

  useEffect(() => {
    const d = dialogo.current;
    if (d !== null && !d.open) d.showModal();
  }, []);

  async function descarregar() {
    setErro(null);
    setAGerar(true);
    try {
      const quando = new Date();
      const nome = nomeDoPedido(pedido);
      if (questoes > 0) {
        const sufixo = pedido.tipo === "bolsa" ? "Pedido_Bolsa_de_Horas" : "Pedido_Licenciamento";
        await descarregarPacote(nomeDoPacote(nome, "Pedido_Completo", quando), [
          { nome: `${nomeSeguro(nome, "Pedido")}_${sufixo}.json`, conteudo: pedidoParaJSON(pedido) },
        ]);
      } else {
        const todos = await ficheirosDoPedido(pedido, quando);
        const escolha = grupos.filter((g) => escolhidos.has(g.id));
        const ficheiros = todos.filter((f) => escolha.some((g) => g.pertence(f.nome)));
        await descarregarPacote(nomeDoPacote(nome, "Pedido_Completo", quando), ficheiros);
      }
      onFechar();
    } catch (e) {
      setErro(
        e instanceof ErroModeloEavalia
          ? e.message
          : "Não foi possível preparar o pacote. Tente descarregar as peças a partir de cada módulo.",
      );
    } finally {
      setAGerar(false);
    }
  }

  return (
    <dialog
      ref={dialogo}
      className="dialogo dialogo-largo"
      aria-labelledby="titulo-descarregar-tudo"
      onCancel={(e) => {
        e.preventDefault();
        onFechar();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void descarregar();
        }}
      >
        <h3 id="titulo-descarregar-tudo">
          Descarregar tudo — {nomeParaListas(pedido)} (v{pedido.versao})
        </h3>
        {questoes > 0 ? (
          <p className="aviso aviso-atencao">
            O pedido tem {questoes === 1 ? "1 questão" : `${questoes} questões`} por resolver: as peças só se geram
            depois de resolvidas, como nos módulos. Pode descarregar já o ficheiro do pedido (JSON).
          </p>
        ) : (
          <>
            <p className="dialogo-nota">Um ZIP com as peças do pedido, as mesmas que saem em cada módulo:</p>
            {grupos.map((g) => (
              <label key={g.id} className="campo-opcao">
                <input
                  type="checkbox"
                  checked={escolhidos.has(g.id)}
                  onChange={(e) =>
                    setEscolhidos((atual) => {
                      const novo = new Set(atual);
                      if (e.target.checked) novo.add(g.id);
                      else novo.delete(g.id);
                      return novo;
                    })
                  }
                />
                <span>{g.rotulo}</span>
              </label>
            ))}
            {semNumeros && escolhidos.has("manifestacao") && (
              <p className="dialogo-nota">
                O PDF da manifestação ainda não sai: pede o n.º da informação e o n.º de orçamento.
              </p>
            )}
          </>
        )}
        {erro !== null && (
          <p className="aviso aviso-erro" role="alert">
            {erro}
          </p>
        )}
        <div className="dialogo-acoes">
          <button type="button" className="botao-secundario" onClick={onFechar}>
            Cancelar
          </button>
          <button
            type="submit"
            className="botao-principal"
            disabled={aGerar || (questoes === 0 && escolhidos.size === 0)}
          >
            {aGerar ? "A preparar…" : questoes > 0 ? "Descarregar o JSON" : "Descarregar ZIP"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
