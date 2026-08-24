import { useId } from "react";
import type { EquipamentoPosto, LocalPosto, PostoTrabalho, RegimePosto } from "../core/types";
import {
  EQUIPAMENTOS_POSTO,
  LOCAIS_POSTO,
  REGIMES_POSTO,
  REQUISITOS_EQUIPAMENTO_PADRAO,
  regimeTemLocal,
} from "../core/types";

interface Props {
  posto: PostoTrabalho;
  onChange: (posto: PostoTrabalho) => void;
}

/** Escolha única, em lista pendente. */
function Escolha<T extends string>({
  titulo,
  todas,
  escolhida,
  onAlterar,
}: {
  titulo: string;
  todas: readonly T[];
  escolhida: T;
  onAlterar: (escolhida: T) => void;
}) {
  return (
    <label className="campo-escolha">
      <span className="rotulo">{titulo}</span>
      <select value={escolhida} onChange={(e) => onAlterar(e.target.value as T)}>
        {todas.map((opcao) => (
          <option key={opcao} value={opcao}>
            {opcao}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Um grupo de caixas de seleção, onde as escolhas se acumulam. */
function Grupo<T extends string>({
  titulo,
  todas,
  escolhidas,
  onAlterar,
  extra,
  aviso,
}: {
  titulo: string;
  todas: readonly T[];
  escolhidas: T[];
  onAlterar: (escolhidas: T[]) => void;
  /** Campo que acompanha uma opção — o "onde" do local "Outro". */
  extra?: (opcao: T) => React.ReactNode;
  /** Mostrado por baixo das opções quando falta escolher. */
  aviso?: string;
}) {
  function alternar(opcao: T, marcada: boolean) {
    // Guarda-se pela ordem do formulário, e não pela ordem dos cliques: é
    // assim que a lista sai no documento.
    onAlterar(todas.filter((o) => (o === opcao ? marcada : escolhidas.includes(o))));
  }

  return (
    <fieldset className="grupo-opcoes">
      <legend>{titulo}</legend>
      {todas.map((opcao) => (
        <div key={opcao} className="linha-opcao">
          <label>
            <input
              type="checkbox"
              checked={escolhidas.includes(opcao)}
              onChange={(e) => alternar(opcao, e.target.checked)}
            />
            <span>{opcao}</span>
          </label>
          {extra?.(opcao)}
        </div>
      ))}
      {aviso !== undefined && <p className="aviso aviso-erro">{aviso}</p>}
    </fieldset>
  );
}

export function PostoTrabalhoEditor({ posto, onChange }: Props) {
  const idRequisitos = useId();

  return (
    <div className="posto-trabalho">
      {/* O regime vem primeiro porque comanda o resto: em regime remoto não há
          local a indicar, e o campo do local nem chega a aparecer. */}
      <Escolha<RegimePosto>
        titulo="Regime da prestação de serviços"
        todas={REGIMES_POSTO}
        escolhida={posto.regime}
        onAlterar={(regime) => onChange({ ...posto, regime })}
      />

      {regimeTemLocal(posto.regime) && (
        <Grupo<LocalPosto>
          titulo="Local da prestação de serviços"
          todas={LOCAIS_POSTO}
          escolhidas={posto.locais}
          onAlterar={(locais) => onChange({ ...posto, locais })}
          aviso={posto.locais.length === 0 ? "Indique pelo menos um local." : undefined}
          extra={(local) =>
            local === "Outro" && posto.locais.includes("Outro") ? (
              <input
                type="text"
                className="campo-outro-local"
                value={posto.outroLocal}
                placeholder="Indique o local"
                aria-label="Outro local da prestação de serviços"
                aria-invalid={posto.outroLocal.trim() === ""}
                onChange={(e) => onChange({ ...posto, outroLocal: e.target.value })}
              />
            ) : null
          }
        />
      )}

      <Escolha<EquipamentoPosto>
        titulo="Equipamentos para os recursos"
        todas={EQUIPAMENTOS_POSTO}
        escolhida={posto.equipamento}
        onAlterar={(equipamento) => onChange({ ...posto, equipamento })}
      />

      {/* Os requisitos só fazem sentido — e só saem no documento — quando o
          equipamento é do prestador: é a ele que se exigem. */}
      {/* O rótulo e o botão são irmãos, e não pai e filho: um botão dentro da
          etiqueta passaria a fazer parte do nome do campo, e quem ouve a página
          ouviria "Requisitos mínimos… repor o texto de partida" de cada vez que
          lá chegasse. */}
      {posto.equipamento === "Equipamentos do Prestador" && (
        <div className="campo-largo">
          <div className="linha-rotulo">
            <label className="rotulo" htmlFor={idRequisitos}>
              Requisitos mínimos do equipamento do prestador
            </label>
            {/* Quem ajustou o texto e se arrependeu não tinha por onde voltar
                atrás: o de partida não estava em lado nenhum. */}
            {posto.requisitosEquipamento !== REQUISITOS_EQUIPAMENTO_PADRAO && (
              <button
                type="button"
                className="ligacao"
                onClick={() => onChange({ ...posto, requisitosEquipamento: REQUISITOS_EQUIPAMENTO_PADRAO })}
              >
                repor o texto de partida
              </button>
            )}
          </div>
          <textarea
            id={idRequisitos}
            rows={8}
            value={posto.requisitosEquipamento}
            placeholder="Uma característica por linha. Uma primeira linha terminada em dois pontos encabeça a tabela."
            aria-invalid={posto.requisitosEquipamento.trim() === ""}
            onChange={(e) => onChange({ ...posto, requisitosEquipamento: e.target.value })}
          />
          {posto.requisitosEquipamento.trim() === "" && (
            <span className="aviso aviso-erro">Indique os requisitos mínimos do equipamento.</span>
          )}
        </div>
      )}
    </div>
  );
}
