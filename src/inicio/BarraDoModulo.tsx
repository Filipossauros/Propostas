import type { Grupo, Pagina } from "./navegacao";

/** O que se diz de cada módulo nos passos: se está completo, ou quantas questões tem por resolver. */
export interface EstadoDoModulo {
  texto: string;
  falta: boolean;
}

interface Props {
  grupo: Grupo;
  pagina: Exclude<Pagina, "inicio">;
  estados?: Partial<Record<Pagina, EstadoDoModulo>>;
  onIrPara: (pagina: Exclude<Pagina, "inicio">) => void;
}

/**
 * Os passos do pedido aberto (ou da análise de propostas), por baixo da barra
 * superior: para ir de um módulo a outro, vendo os que já estão completos.
 */
export function BarraDoModulo({ grupo, pagina, estados = {}, onIrPara }: Props) {
  if (grupo.modulos.length <= 1) return null;
  return (
    <nav className="barra-modulo" aria-label={`Módulos de ${grupo.titulo}`}>
      <span className="passos-grupo" role="group">
        {grupo.modulos.map((m) => {
          const estado = estados[m.pagina];
          const completo = estado !== undefined && !estado.falta;
          return (
            <button
              key={m.pagina}
              type="button"
              className={m.pagina === pagina ? "passo-grupo passo-grupo-ativo" : "passo-grupo"}
              aria-current={m.pagina === pagina ? "page" : undefined}
              title={estado?.texto}
              onClick={() => onIrPara(m.pagina)}
            >
              {completo && (
                <span className="passo-grupo-completo" aria-label="completo">
                  ✓{" "}
                </span>
              )}
              {m.marca} {m.titulo}
              {estado?.falta && <span className="passo-grupo-falta"> · {estado.texto}</span>}
            </button>
          );
        })}
      </span>
    </nav>
  );
}
