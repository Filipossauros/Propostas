import type { ConfiguracaoJSON } from "../core/types";

interface Props {
  config: ConfiguracaoJSON;
  onChange: (patch: Partial<ConfiguracaoJSON>) => void;
}

export function ConfigForm({ config, onChange }: Props) {
  return (
    <fieldset className="painel">
      <legend>Configuração do procedimento</legend>

      <div className="grelha-campos">
        <label>
          Procedimento n.º
          <input
            type="text"
            value={config.procedimento}
            onChange={(e) => onChange({ procedimento: e.target.value })}
          />
        </label>

        <label>
          Lote
          <input type="text" value={config.lote} onChange={(e) => onChange({ lote: e.target.value })} />
        </label>

        <label className="campo-largo">
          Perfil
          <input type="text" value={config.perfil} onChange={(e) => onChange({ perfil: e.target.value })} />
        </label>

        <label>
          N.º mínimo de elementos exigido por lote
          <input
            type="number"
            min={1}
            step={1}
            value={config.nMinimoElementos}
            onChange={(e) => onChange({ nMinimoElementos: Number(e.target.value) })}
          />
        </label>

        <label>
          Data limite para apresentação de propostas
          <input
            type="date"
            value={config.dataLimitePropostas}
            onChange={(e) => onChange({ dataLimitePropostas: e.target.value })}
          />
        </label>

        <label>
          N.º de blocos do formulário
          <input
            type="number"
            min={1}
            step={1}
            value={config.nBlocos}
            onChange={(e) => onChange({ nBlocos: Number(e.target.value) })}
          />
        </label>
      </div>
    </fieldset>
  );
}
