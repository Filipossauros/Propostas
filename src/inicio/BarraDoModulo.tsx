import type { Grupo, Pagina } from "./navegacao";

interface Props {
  grupo: Grupo;
  pagina: Exclude<Pagina, "inicio">;
  onVoltar: () => void;
  onIrPara: (pagina: Exclude<Pagina, "inicio">) => void;
}

/**
 * O topo de cada módulo: o regresso à página inicial, onde se está, e os
 * passos do grupo — para ir de um módulo ao seguinte sem voltar ao início.
 */
export function BarraDoModulo({ grupo, pagina, onVoltar, onIrPara }: Props) {
  const atual = grupo.modulos.find((m) => m.pagina === pagina);
  return (
    <nav className="barra-modulo" aria-label="Navegação">
      <button type="button" className="botao-voltar" onClick={onVoltar}>
        ← Página inicial
      </button>
      <span className="migalhas">
        {grupo.titulo} › <strong>{atual ? `${atual.marca} · ${atual.titulo}` : ""}</strong>
      </span>
      {grupo.modulos.length > 1 && (
        <span className="passos-grupo" role="group" aria-label={`Módulos de ${grupo.titulo}`}>
          {grupo.modulos.map((m) => (
            <button
              key={m.pagina}
              type="button"
              className={m.pagina === pagina ? "passo-grupo passo-grupo-ativo" : "passo-grupo"}
              aria-current={m.pagina === pagina ? "page" : undefined}
              onClick={() => onIrPara(m.pagina)}
            >
              {m.marca} {m.titulo}
            </button>
          ))}
        </span>
      )}
    </nav>
  );
}
