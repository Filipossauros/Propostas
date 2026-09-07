import {
  anosDaDirecao,
  haFiltros,
  perfisDaVista,
  projetosDaVista,
  unidadesDaVista,
  type FiltrosDirecao,
  type VistaDirecao,
} from "../core/vistaGeralDirecao";

interface Props {
  /** A vista por filtrar: as listas de escolha vêm de tudo o que foi carregado. */
  vista: VistaDirecao;
  filtros: FiltrosDirecao;
  onAlterar: (filtros: FiltrosDirecao) => void;
}

const TODOS = "";

/**
 * Os filtros da direção, comuns às três tabelas.
 *
 * As listas saem da vista por filtrar, e não da já filtrada: escolher uma
 * unidade não pode fazer desaparecer as outras da lista, ou não haveria como
 * voltar atrás.
 */
export function FiltrosDaDirecao({ vista, filtros, onAlterar }: Props) {
  const anos = anosDaDirecao(vista);

  function alternarAno(ano: number) {
    onAlterar({
      ...filtros,
      anos: filtros.anos.includes(ano) ? filtros.anos.filter((a) => a !== ano) : [...filtros.anos, ano].sort(),
    });
  }

  return (
    <div className="filtro-resultados">
      <label>
        <span className="rotulo">Unidade</span>
        <select
          value={filtros.unidade ?? TODOS}
          onChange={(e) => onAlterar({ ...filtros, unidade: e.target.value === TODOS ? null : e.target.value })}
        >
          <option value={TODOS}>Todas as unidades</option>
          {unidadesDaVista(vista).map((unidade) => (
            <option key={unidade} value={unidade}>
              {unidade}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="rotulo">Perfil</span>
        <select
          value={filtros.perfil ?? TODOS}
          onChange={(e) => onAlterar({ ...filtros, perfil: e.target.value === TODOS ? null : e.target.value })}
        >
          <option value={TODOS}>Todos os perfis</option>
          {perfisDaVista(vista).map((perfil) => (
            <option key={perfil} value={perfil}>
              {perfil}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="rotulo">Projeto</span>
        <select
          value={filtros.projeto ?? TODOS}
          onChange={(e) => onAlterar({ ...filtros, projeto: e.target.value === TODOS ? null : e.target.value })}
        >
          <option value={TODOS}>Todos os projetos</option>
          {projetosDaVista(vista).map((projeto) => (
            <option key={projeto} value={projeto}>
              {projeto}
            </option>
          ))}
        </select>
      </label>

      {/* Os anos escolhem-se aos vários — a pergunta é muitas vezes sobre um
          biénio — e nenhum escolhido vale todos. */}
      <div className="filtro-anos">
        <span className="rotulo">Anos económicos</span>
        <div className="seletor-vista" role="group" aria-label="Anos económicos">
          {anos.map((ano) => {
            const escolhido = filtros.anos.includes(ano);
            return (
              <button
                key={ano}
                type="button"
                className={escolhido ? "aba-ativa" : ""}
                aria-pressed={escolhido}
                onClick={() => alternarAno(ano)}
              >
                {ano}
              </button>
            );
          })}
          {anos.length === 0 && <span className="meta">Sem anos para escolher.</span>}
        </div>
      </div>

      {haFiltros(filtros) && (
        <button
          type="button"
          className="botao-discreto"
          onClick={() => onAlterar({ unidade: null, anos: [], perfil: null, projeto: null })}
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
