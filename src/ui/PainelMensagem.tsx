export interface Mensagem {
  tipo: "erro" | "sucesso";
  texto: string;
}

interface Props {
  mensagem: Mensagem | null;
  onFechar: () => void;
}

export function PainelMensagem({ mensagem, onFechar }: Props) {
  if (mensagem === null) return null;

  return (
    <div className={mensagem.tipo === "erro" ? "mensagem mensagem-erro" : "mensagem mensagem-sucesso"} role="status">
      <span>{mensagem.texto}</span>
      <button type="button" className="botao-icone" onClick={onFechar} aria-label="Fechar mensagem">
        ×
      </button>
    </div>
  );
}
