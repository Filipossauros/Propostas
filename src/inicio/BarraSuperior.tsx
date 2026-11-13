import { useEffect, useRef, useState } from "react";
import {
  ESTADOS_PEDIDO,
  TIPOS_PEDIDO,
  estadoDoPedido,
  nomeParaListas,
  type PedidoNaBiblioteca,
  type TipoPedido,
} from "../core/biblioteca";
import type { EstadoDaGravacao } from "../core/useBiblioteca";

/** A secção em que se está: a biblioteca, um pedido, a análise de propostas ou o orçamento. */
export type Seccao = "biblioteca" | "pedido" | "analise" | "orcamento";

interface Props {
  seccao: Seccao;
  ativo: PedidoNaBiblioteca | null;
  /** Os pedidos para onde se pode mudar (os não arquivados). */
  pedidos: PedidoNaBiblioteca[];
  gravacao: EstadoDaGravacao;
  onIrPara: (seccao: Exclude<Seccao, "pedido">) => void;
  onAbrirPedido: (id: string) => void;
  onNovoPedido: (tipo: TipoPedido) => void;
  onDescarregarTudo: () => void;
}

export function EtiquetaDoTipo({ tipo }: { tipo: TipoPedido }) {
  return <span className={`etiqueta-tipo etiqueta-tipo-${tipo}`}>{TIPOS_PEDIDO[tipo]}</span>;
}

export function EtiquetaDoEstado({ pedido }: { pedido: PedidoNaBiblioteca }) {
  const estado = estadoDoPedido(pedido);
  return <span className={`etiqueta-estado etiqueta-estado-${estado}`}>{ESTADOS_PEDIDO[estado]}</span>;
}

/**
 * A barra de cima, sempre visível: as três entradas da aplicação (biblioteca,
 * análise de propostas e orçamento), o pedido em que se está a trabalhar — com
 * a mudança para outro —, se ficou guardado, e o «Descarregar tudo» do pedido.
 */
export function BarraSuperior({
  seccao,
  ativo,
  pedidos,
  gravacao,
  onIrPara,
  onAbrirPedido,
  onNovoPedido,
  onDescarregarTudo,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current !== null && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  const entradas: Array<[Exclude<Seccao, "pedido">, string]> = [
    ["biblioteca", "Biblioteca"],
    ["analise", "Análise de propostas"],
    ["orcamento", "Orçamento"],
  ];
  const recentes = [...pedidos].sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));

  function escolher(acao: () => void) {
    setAberto(false);
    acao();
  }

  return (
    <header className="barra-superior">
      <div className="barra-superior-conteudo">
        <button type="button" className="barra-superior-marca" onClick={() => onIrPara("biblioteca")}>
          Manifestações de Necessidades
        </button>

        <nav className="barra-superior-entradas" aria-label="Secções da aplicação">
          {entradas.map(([s, titulo]) => (
            <button
              key={s}
              type="button"
              className={seccao === s ? "entrada-superior entrada-superior-ativa" : "entrada-superior"}
              aria-current={seccao === s ? "page" : undefined}
              onClick={() => onIrPara(s)}
            >
              {titulo}
            </button>
          ))}
        </nav>

        <div className="contexto-superior" ref={caixa}>
          <button
            type="button"
            className="contexto-superior-botao"
            aria-haspopup="menu"
            aria-expanded={aberto}
            onClick={() => setAberto((a) => !a)}
            title="Mudar de pedido"
          >
            {seccao === "pedido" && ativo !== null ? (
              <>
                <EtiquetaDoTipo tipo={ativo.tipo} />
                <span className="contexto-superior-nome" title={nomeParaListas(ativo)}>
                  {nomeParaListas(ativo)}
                </span>
                <EtiquetaDoEstado pedido={ativo} />
                <span className="contexto-superior-versao">v{ativo.versao}</span>
              </>
            ) : seccao === "analise" ? (
              <>
                <span className="etiqueta-tipo etiqueta-tipo-analise">Análise de propostas</span>
                <span className="contexto-superior-nota">depois de recebidas as propostas</span>
              </>
            ) : seccao === "orcamento" ? (
              <>
                <span className="etiqueta-tipo etiqueta-tipo-orcamento">Orçamento</span>
                <span className="contexto-superior-nota">os procedimentos da unidade</span>
              </>
            ) : ativo !== null ? (
              <>
                <span className="contexto-superior-nota">Último pedido aberto:</span>
                <span className="contexto-superior-nome">{nomeParaListas(ativo)}</span>
              </>
            ) : (
              <span className="contexto-superior-nota">Nenhum pedido aberto</span>
            )}
            <span className="contexto-superior-seta" aria-hidden="true">
              ▾
            </span>
          </button>

          {aberto && (
            <div className="contexto-superior-lista" role="menu">
              <p className="contexto-superior-titulo">Abrir um pedido</p>
              {recentes.length === 0 && <p className="contexto-superior-vazio">A biblioteca ainda não tem pedidos.</p>}
              {recentes.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="menuitem"
                  className={
                    ativo?.id === p.id && seccao === "pedido"
                      ? "contexto-superior-item contexto-superior-item-ativo"
                      : "contexto-superior-item"
                  }
                  onClick={() => escolher(() => onAbrirPedido(p.id))}
                >
                  <EtiquetaDoTipo tipo={p.tipo} />
                  <span className="contexto-superior-nome">{nomeParaListas(p)}</span>
                  <EtiquetaDoEstado pedido={p} />
                </button>
              ))}
              <div className="contexto-superior-rodape">
                <button type="button" className="botao-secundario" onClick={() => escolher(() => onIrPara("biblioteca"))}>
                  Ver a biblioteca
                </button>
                <button type="button" className="botao-secundario" onClick={() => escolher(() => onNovoPedido("bolsa"))}>
                  + Bolsa de horas
                </button>
                <button
                  type="button"
                  className="botao-secundario"
                  onClick={() => escolher(() => onNovoPedido("licenciamento"))}
                >
                  + Licenciamento
                </button>
              </div>
            </div>
          )}
        </div>

        <span
          className={gravacao === "guardado" ? "gravacao-superior" : "gravacao-superior gravacao-superior-falha"}
          title={gravacao === "guardado" ? "Tudo fica guardado neste navegador; nada sai deste computador." : undefined}
          role={gravacao === "guardado" ? undefined : "alert"}
        >
          {gravacao === "guardado"
            ? "✓ Guardado"
            : gravacao === "falhou"
              ? "⚠ Não foi possível guardar — descarregue a biblioteca"
              : "⚠ Este navegador não guarda: descarregue antes de sair"}
        </span>

        {seccao === "pedido" && ativo !== null && (
          <button type="button" className="botao-descarregar-tudo" onClick={onDescarregarTudo}>
            ⬇ Descarregar tudo
          </button>
        )}
      </div>
    </header>
  );
}
