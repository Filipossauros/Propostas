import type { Lote, PerfilEmLote } from "../core/types";
import { formatarMoeda, precoBaseEntrada, totalLote } from "../core/lotes";
import { certificacoesDoPerfil } from "../core/perfil";
import { CampoNumero } from "../ui/CampoNumero";
import { DicaRequisitos } from "../ui/DicaRequisitos";
import { moverItem, useReordenavel } from "../ui/useReordenavel";

interface Props {
  lote: Lote;
  onAlterar: (alteracao: Partial<Lote>) => void;
  onRemover: () => void;
  onRetirarPerfil: (perfilEmLoteId: string) => void;
}

export function EditorLote({ lote, onAlterar, onRemover, onRetirarPerfil }: Props) {
  const reordenavel = useReordenavel((de, para) => onAlterar({ perfis: moverItem(lote.perfis, de, para) }));

  function alterarPerfil(perfilEmLoteId: string, alteracao: Partial<PerfilEmLote>) {
    onAlterar({
      perfis: lote.perfis.map((e) => (e.id === perfilEmLoteId ? { ...e, ...alteracao } : e)),
    });
  }

  function mover(idx: number, direcao: -1 | 1) {
    onAlterar({ perfis: moverItem(lote.perfis, idx, idx + direcao) });
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
          <span className="rotulo">Designação do lote</span>
          <input
            type="text"
            value={lote.designacao}
            placeholder="ex.: Desenvolvimento aplicacional"
            onChange={(e) => onAlterar({ designacao: e.target.value })}
            aria-invalid={lote.designacao.trim() === ""}
          />
        </label>

        <button type="button" className="botao-discreto botao-perigo" onClick={onRemover}>
          Remover lote
        </button>
      </header>

      {lote.perfis.length === 0 ? (
        <p className="estado-vazio estado-vazio-encaixado">Sem perfis atribuídos a este lote.</p>
      ) : (
        <div className="tabela-edicao">
          {/* Uma linha por perfil, com os rótulos no cabeçalho: com vários
              perfis por lote, repetir "Horas" e "Preço/hora" em cada bloco
              triplicava a altura do cartão sem acrescentar informação. */}
          <div className="tabela-edicao-cabecalho grelha-perfil-lote">
            <span />
            <span>Perfil</span>
            <span>N.º mín.</span>
            <span>Horas</span>
            <span>Preço/hora</span>
            <span>Preço base s/ IVA</span>
            <span />
          </div>

          <ul className="lista-perfis-lote">
            {lote.perfis.map((entrada, idx) => (
              <li
                key={entrada.id}
                className={reordenavel.aArrastar === idx ? "linha-edicao linha-a-arrastar" : "linha-edicao"}
                {...reordenavel.propsAlvo(idx)}
              >
                <div className="grelha-perfil-lote">
                  <span
                    className="pega"
                    title="Arrastar para reordenar"
                    aria-hidden="true"
                    {...reordenavel.propsPega(idx)}
                  >
                    {idx + 1}
                  </span>

                  <div className="perfil-em-lote-titulo">
                    <strong>{entrada.perfil.perfil || "(perfil sem designação)"}</strong>
                    <DicaRequisitos requisitos={entrada.perfil.requisitos} certificacoes={certificacoesDoPerfil(entrada.perfil)} />
                  </div>

                  <CampoNumero
                    valor={entrada.nMinimoElementos}
                    min={1}
                    step={1}
                    aria-label={`N.º mínimo de elementos de ${entrada.perfil.perfil}`}
                    invalido={!Number.isInteger(entrada.nMinimoElementos) || entrada.nMinimoElementos < 1}
                    onChange={(nMinimoElementos) => alterarPerfil(entrada.id, { nMinimoElementos })}
                  />

                  <CampoNumero
                    valor={entrada.horas}
                    min={0}
                    step={1}
                    sufixo="h"
                    aria-label={`Horas de ${entrada.perfil.perfil}`}
                    invalido={!(entrada.horas > 0)}
                    onChange={(horas) => alterarPerfil(entrada.id, { horas })}
                  />

                  <CampoNumero
                    valor={entrada.valorHora}
                    min={0}
                    step={0.01}
                    sufixo="€"
                    aria-label={`Preço por hora de ${entrada.perfil.perfil}, sem IVA`}
                    invalido={!(entrada.valorHora > 0)}
                    onChange={(valorHora) => alterarPerfil(entrada.id, { valorHora })}
                  />

                  <strong className="valor-calculado">{formatarMoeda(precoBaseEntrada(entrada))}</strong>

                  <div className="acoes-linha">
                    <button
                      type="button"
                      className="botao-icone"
                      onClick={() => mover(idx, -1)}
                      disabled={idx === 0}
                      title="Mover para cima"
                      aria-label={`Mover ${entrada.perfil.perfil} para cima`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="botao-icone"
                      onClick={() => mover(idx, 1)}
                      disabled={idx === lote.perfis.length - 1}
                      title="Mover para baixo"
                      aria-label={`Mover ${entrada.perfil.perfil} para baixo`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="botao-icone botao-perigo"
                      onClick={() => onRetirarPerfil(entrada.id)}
                      title="Retirar do lote"
                      aria-label={`Retirar ${entrada.perfil.perfil} do lote`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <footer className="cartao-lote-rodape">
        <span>Preço base do lote (sem IVA)</span>
        <strong>{formatarMoeda(totalLote(lote, 0).semIva)}</strong>
      </footer>
    </article>
  );
}
