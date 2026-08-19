import type { Lote, PerfilEmLote, PerfilJSON } from "../core/types";
import { formatarMoeda, precoBaseEntrada, totalLote } from "../core/lotes";
import { CampoNumero } from "../ui/CampoNumero";

interface Props {
  lote: Lote;
  onAlterar: (alteracao: Partial<Lote>) => void;
  onRemover: () => void;
  onRetirarPerfil: (perfilEmLoteId: string) => void;
  onDescarregarFormulario: (perfil: PerfilJSON) => void;
}

export function EditorLote({ lote, onAlterar, onRemover, onRetirarPerfil, onDescarregarFormulario }: Props) {
  function alterarPerfil(perfilEmLoteId: string, alteracao: Partial<PerfilEmLote>) {
    onAlterar({
      perfis: lote.perfis.map((e) => (e.id === perfilEmLoteId ? { ...e, ...alteracao } : e)),
    });
  }

  return (
    <article className="cartao-lote">
      <header className="cartao-lote-cabecalho">
        <label className="campo-estreito">
          <span className="rotulo">Lote n.º</span>
          <input
            type="text"
            value={lote.numero}
            onChange={(e) => onAlterar({ numero: e.target.value })}
            aria-invalid={lote.numero.trim() === ""}
          />
        </label>

        <label className="campo-crescente">
          <span className="rotulo">
            Designação do lote <span className="etiqueta-opcional">opcional</span>
          </span>
          <input
            type="text"
            value={lote.designacao}
            placeholder="ex.: Desenvolvimento aplicacional"
            onChange={(e) => onAlterar({ designacao: e.target.value })}
          />
        </label>

        <button type="button" className="botao-discreto botao-perigo" onClick={onRemover}>
          Remover lote
        </button>
      </header>

      {lote.perfis.length === 0 ? (
        <p className="estado-vazio">Sem perfis atribuídos a este lote.</p>
      ) : (
        <ul className="lista-perfis-lote">
          {lote.perfis.map((entrada) => (
            <li key={entrada.id} className="perfil-em-lote">
              <div className="perfil-em-lote-titulo">
                <strong>{entrada.perfil.perfil || "(perfil sem designação)"}</strong>
                <span className="meta">{entrada.perfil.requisitos.length} requisito(s)</span>
              </div>

              <div className="perfil-em-lote-campos">
                <label className="campo-estreito">
                  <span className="rotulo">N.º mín. elementos</span>
                  <CampoNumero
                    valor={entrada.nMinimoElementos}
                    min={1}
                    step={1}
                    invalido={!Number.isInteger(entrada.nMinimoElementos) || entrada.nMinimoElementos < 1}
                    onChange={(nMinimoElementos) => alterarPerfil(entrada.id, { nMinimoElementos })}
                  />
                </label>

                <label className="campo-estreito">
                  <span className="rotulo">Horas</span>
                  <CampoNumero
                    valor={entrada.horas}
                    min={0}
                    step={1}
                    sufixo="h"
                    invalido={!(entrada.horas > 0)}
                    onChange={(horas) => alterarPerfil(entrada.id, { horas })}
                  />
                </label>

                <label className="campo-estreito">
                  <span className="rotulo">Preço/hora (s/ IVA)</span>
                  <CampoNumero
                    valor={entrada.valorHora}
                    min={0}
                    step={0.01}
                    sufixo="€"
                    invalido={!(entrada.valorHora > 0)}
                    onChange={(valorHora) => alterarPerfil(entrada.id, { valorHora })}
                  />
                </label>

                <div className="valor-calculado">
                  <span className="rotulo">Preço base (s/ IVA)</span>
                  <strong>{formatarMoeda(precoBaseEntrada(entrada))}</strong>
                </div>
              </div>

              <div className="acoes-linha">
                <button
                  type="button"
                  className="botao-discreto"
                  onClick={() => onDescarregarFormulario(entrada.perfil)}
                >
                  Formulário Excel
                </button>
                <button
                  type="button"
                  className="botao-discreto botao-perigo"
                  onClick={() => onRetirarPerfil(entrada.id)}
                >
                  Retirar do lote
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <footer className="cartao-lote-rodape">
        <span>Preço base do lote (sem IVA)</span>
        <strong>{formatarMoeda(totalLote(lote, 0).semIva)}</strong>
      </footer>
    </article>
  );
}
