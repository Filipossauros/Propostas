import { useEffect, useState } from "react";

interface Props {
  valor: number;
  onChange: (valor: number) => void;
  min?: number;
  step?: number;
  /** Sufixo apresentado à direita do campo, ex.: "h" ou "€". */
  sufixo?: string;
  invalido?: boolean;
  "aria-label"?: string;
}

/**
 * Campo numérico que mantém o texto em edição.
 *
 * Um `<input type="number">` ligado diretamente a um number não permite apagar o
 * conteúdo (o valor vazio converte-se em 0 e reaparece no campo). Aqui o texto é
 * estado local e só se propaga quando é um número válido.
 */
export function CampoNumero({ valor, onChange, min, step, sufixo, invalido, ...resto }: Props) {
  const [texto, setTexto] = useState(String(valor));

  useEffect(() => {
    if (Number(texto) !== valor) setTexto(String(valor));
    // Só sincroniza quando o valor muda por fora (importação, reposição).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  return (
    <span className="campo-numero">
      <input
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={texto}
        aria-invalid={invalido}
        aria-label={resto["aria-label"]}
        onChange={(e) => {
          setTexto(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isFinite(n)) onChange(n);
        }}
        onBlur={() => {
          if (texto.trim() === "" || !Number.isFinite(Number(texto))) setTexto(String(valor));
        }}
      />
      {sufixo && <span className="sufixo-campo">{sufixo}</span>}
    </span>
  );
}
