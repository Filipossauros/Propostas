import type { EquipamentoPosto, LocalPosto, PostoTrabalho, RegimePosto } from "../core/types";
import { EQUIPAMENTOS_POSTO, LOCAIS_POSTO, REGIMES_POSTO } from "../core/types";

interface Props {
  posto: PostoTrabalho;
  onChange: (posto: PostoTrabalho) => void;
}

/** Um grupo de caixas de seleção, com o seu título. */
function Grupo<T extends string>({
  titulo,
  todas,
  escolhidas,
  onAlterar,
  extra,
}: {
  titulo: string;
  todas: readonly T[];
  escolhidas: T[];
  onAlterar: (escolhidas: T[]) => void;
  /** Campo que acompanha uma opção — o "onde" do local "Outro". */
  extra?: (opcao: T) => React.ReactNode;
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
    </fieldset>
  );
}

export function PostoTrabalhoEditor({ posto, onChange }: Props) {
  const comEquipamentoDoPrestador = posto.equipamentos.includes("Equipamentos do Prestador");

  return (
    <div className="posto-trabalho">
      <Grupo<LocalPosto>
        titulo="Local da prestação de serviços / entrega dos bens"
        todas={LOCAIS_POSTO}
        escolhidas={posto.locais}
        onAlterar={(locais) => onChange({ ...posto, locais })}
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

      <Grupo<RegimePosto>
        titulo="Regime da prestação de serviços"
        todas={REGIMES_POSTO}
        escolhidas={posto.regimes}
        onAlterar={(regimes) => onChange({ ...posto, regimes })}
      />

      <Grupo<EquipamentoPosto>
        titulo="Equipamentos para os recursos"
        todas={EQUIPAMENTOS_POSTO}
        escolhidas={posto.equipamentos}
        onAlterar={(equipamentos) => onChange({ ...posto, equipamentos })}
      />

      {/* Os requisitos só fazem sentido — e só saem no documento — quando o
          equipamento é do prestador: é a ele que se exigem. */}
      {comEquipamentoDoPrestador && (
        <label className="campo-largo">
          <span className="rotulo">Requisitos mínimos do equipamento do prestador</span>
          <textarea
            rows={8}
            value={posto.requisitosEquipamento}
            placeholder="Uma característica por linha. Uma linha terminada em dois pontos é introdução."
            onChange={(e) => onChange({ ...posto, requisitosEquipamento: e.target.value })}
          />
        </label>
      )}
    </div>
  );
}
