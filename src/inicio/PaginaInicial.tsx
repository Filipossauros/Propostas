import { GRUPOS, type ChaveGrupo, type ModuloDoGrupo, type Pagina } from "./navegacao";

/** O que se diz por baixo de cada cartão: o estado do módulo, se já tiver algum. */
export interface EstadoDoModulo {
  texto: string;
  falta: boolean;
}

interface Props {
  estados: Partial<Record<Pagina, EstadoDoModulo>>;
  onAbrir: (grupo: ChaveGrupo, pagina: Exclude<Pagina, "inicio">) => void;
}

/**
 * A página inicial: os quatro trabalhos da aplicação, cada um com os seus
 * módulos. Substitui a barra de separadores, que deixou de caber.
 */
export function PaginaInicial({ estados, onAbrir }: Props) {
  return (
    <div className="pagina-inicial">
      {GRUPOS.map((grupo) => (
        <section key={grupo.chave} className={`secao-grupo secao-grupo-${grupo.chave}`}>
          <header className="secao-grupo-cabecalho">
            <h2>{grupo.titulo}</h2>
            <span className="secao-grupo-etiqueta">{grupo.etiqueta}</span>
          </header>
          <p className="secao-grupo-descricao">{grupo.descricao}</p>

          <div className="cartoes-modulos">
            {grupo.modulos.map((modulo) => (
              <CartaoModulo
                key={modulo.pagina}
                modulo={modulo}
                estado={estados[modulo.pagina]}
                partilhado={modulo.pagina === "projeto" && grupo.chave !== "bolsa"}
                onAbrir={() => onAbrir(grupo.chave, modulo.pagina)}
              />
            ))}
          </div>
        </section>
      ))}

      <p className="ajuda">Tudo fica guardado neste navegador; nada sai deste computador.</p>
    </div>
  );
}

function CartaoModulo({
  modulo,
  estado,
  partilhado,
  onAbrir,
}: {
  modulo: ModuloDoGrupo;
  estado: EstadoDoModulo | undefined;
  partilhado: boolean;
  onAbrir: () => void;
}) {
  return (
    <button type="button" className={`cartao-modulo cartao-modulo-${modulo.pagina}`} onClick={onAbrir}>
      <span className="cartao-modulo-marca" aria-hidden="true">
        {modulo.marca}
      </span>
      <span className="cartao-modulo-texto">
        <span className="cartao-modulo-titulo">{modulo.titulo}</span>
        <span className="cartao-modulo-descricao">{modulo.descricao}</span>
        {partilhado && <span className="cartao-modulo-nota">O mesmo do pedido de serviços de bolsa de horas.</span>}
        {estado && (
          <span className={estado.falta ? "cartao-modulo-estado cartao-modulo-estado-falta" : "cartao-modulo-estado"}>
            {estado.texto}
          </span>
        )}
      </span>
    </button>
  );
}
