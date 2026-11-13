import { useEffect, useRef } from "react";
import type { Biblioteca } from "../core/biblioteca";
import type { Cenario } from "../core/cenarios";
import { previsaoDaAprovacao } from "../core/aprovacao";
import type { OrcamentoUnidade } from "../core/vistaGeral";
import { EtiquetaDoTipo } from "../inicio/BarraSuperior";

interface Props {
  orcamento: OrcamentoUnidade;
  biblioteca: Biblioteca;
  cenario: Cenario;
  onAprovar: () => void;
  onFechar: () => void;
}

/**
 * Antes de aprovar, diz-se o que acontece: que pedidos passam a nova versão (e
 * o que muda em cada um), quais saem do orçamento, e que cenários são
 * arquivados. Um pedido que já tem n.º de informação pode já ter seguido —
 * avisa-se, para quem aprova saber que a informação terá de ser refeita.
 */
export function DialogoAprovarCenario({ orcamento, biblioteca, cenario, onAprovar, onFechar }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const previsao = previsaoDaAprovacao(orcamento, biblioteca, cenario);
  const comInformacao = previsao.pedidos.filter((p) => p.numeroInformacao !== "" && p.efeito === "novaVersao");
  const nada = previsao.pedidos.length === 0 && previsao.importados.length === 0 && previsao.internosMovidos === 0;

  useEffect(() => {
    const d = dialogo.current;
    if (d !== null && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={dialogo}
      className="dialogo dialogo-largo dialogo-aprovar"
      aria-labelledby="titulo-aprovar-cenario"
      onCancel={(e) => {
        e.preventDefault();
        onFechar();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAprovar();
        }}
      >
        <h3 id="titulo-aprovar-cenario">Aprovar o cenário «{cenario.nome}»</h3>
        <p className="dialogo-nota">
          O cenário passa a ser o orçamento da unidade (revisto), e os cortes passam para os próprios pedidos da
          biblioteca. Pode desfazer a aprovação a seguir.
        </p>

        {nada ? (
          <p className="aviso aviso-atencao">Este cenário não altera nenhum pedido nem projeto.</p>
        ) : (
          <div className="previsao-aprovacao">
            {previsao.pedidos.map((p) => (
              <section key={p.pedidoId} className="previsao-pedido">
                <p className="previsao-pedido-titulo">
                  <EtiquetaDoTipo tipo={p.tipo} /> <strong>{p.nome}</strong>{" "}
                  <span className={p.efeito === "novaVersao" ? "etiqueta-versao" : "etiqueta-sai"}>
                    {p.efeito === "novaVersao" ? `passa à versão ${p.versaoNova}` : "sai do orçamento"}
                  </span>
                </p>
                <ul>
                  {p.linhas.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </section>
            ))}
            {previsao.importados.length > 0 && (
              <p className="dialogo-nota">
                Projetos importados de ficheiro (sem pedido na biblioteca), que ficam com as linhas do cenário:{" "}
                {previsao.importados.join(", ")}.
              </p>
            )}
            {previsao.internosMovidos > 0 && (
              <p className="dialogo-nota">
                {previsao.internosMovidos === 1
                  ? "1 elemento interno fica no projeto para onde o cenário o moveu."
                  : `${previsao.internosMovidos} elementos internos ficam nos projetos para onde o cenário os moveu.`}
              </p>
            )}
          </div>
        )}

        {previsao.pedidos.some((p) => p.efeito === "novaVersao") && (
          <p className="dialogo-nota">
            Perfis sem elementos saem dos lotes, e os lotes sem perfis (ou sem licenças) saem do pedido. As peças
            (manifestação, eAvalia, mapas) da nova versão descarregam-se de novo no pedido.
          </p>
        )}

        {comInformacao.length > 0 && (
          <p className="aviso aviso-atencao" role="alert">
            {comInformacao.length === 1 ? "O pedido" : "Os pedidos"}{" "}
            {comInformacao.map((p) => `«${p.nome}» (informação n.º ${p.numeroInformacao})`).join(", ")}{" "}
            {comInformacao.length === 1 ? "já tem" : "já têm"} n.º de informação: se a informação já seguiu, terá de ser
            refeita com a nova versão.
          </p>
        )}

        {previsao.outrosCenarios.length > 0 && (
          <p className="dialogo-nota">
            {previsao.outrosCenarios.length === 1 ? "O outro cenário" : "Os outros cenários"} (
            {previsao.outrosCenarios.join(", ")}){" "}
            {previsao.outrosCenarios.length === 1 ? "é arquivado" : "são arquivados"}:{" "}
            {previsao.outrosCenarios.length === 1 ? "partia" : "partiam"} do orçamento anterior.
          </p>
        )}

        <div className="dialogo-acoes">
          <button type="button" className="botao-secundario" onClick={onFechar}>
            Cancelar
          </button>
          <button type="submit" className="botao-principal" disabled={nada}>
            Aprovar
          </button>
        </div>
      </form>
    </dialog>
  );
}
