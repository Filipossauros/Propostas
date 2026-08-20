import { mesesDeAnos, anosDeMeses, MESES_POR_ANO } from "../core/types";
import { CampoNumero } from "./CampoNumero";

interface Props {
  /** Valor guardado, em meses. */
  mesesMinimos: number;
  onChange: (mesesMinimos: number) => void;
  /**
   * Sem rótulo visível, para listas em que o cabeçalho já o dá uma vez por
   * todas. O rótulo continua a existir para leitores de ecrã.
   */
  rotuloVisivel?: boolean;
}

/**
 * A exigência é declarada em anos completos; o equivalente em meses aparece ao
 * lado, sem possibilidade de edição, porque é nessa unidade que a Regra A apura
 * e que as normas exprimem os valores.
 */
export function CampoAnos({ mesesMinimos, onChange, rotuloVisivel = true }: Props) {
  const anos = anosDeMeses(mesesMinimos);
  const invalido = !Number.isInteger(anos) || anos < 1;

  const campo = (
    <CampoNumero
      valor={invalido ? Math.max(1, Math.round(anos) || 1) : anos}
      min={1}
      step={1}
      sufixo={anos === 1 ? "ano" : "anos"}
      invalido={invalido}
      aria-label={rotuloVisivel ? undefined : "Experiência mínima, em anos"}
      onChange={(novosAnos) => onChange(mesesDeAnos(Math.max(1, Math.round(novosAnos))))}
    />
  );

  return (
    <div className="campo-anos">
      {rotuloVisivel ? (
        <label className="campo-estreito">
          <span className="rotulo">Experiência mínima</span>
          {campo}
        </label>
      ) : (
        <span className="campo-estreito">{campo}</span>
      )}
      <output className="equivalente-meses" aria-label="Equivalente em meses">
        = {invalido ? Math.round(anos) * MESES_POR_ANO : mesesMinimos} meses
      </output>
    </div>
  );
}
