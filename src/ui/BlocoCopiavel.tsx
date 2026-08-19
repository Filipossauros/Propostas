import type { Mensagem } from "./PainelMensagem";

interface Props {
  texto: string;
  onMensagem: (mensagem: Mensagem) => void;
}

export function BlocoCopiavel({ texto, onMensagem }: Props) {
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      onMensagem({ tipo: "sucesso", texto: "Texto copiado para a área de transferência." });
    } catch {
      onMensagem({
        tipo: "erro",
        texto: "Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.",
      });
    }
  }

  return (
    <div className="bloco-copiavel">
      <pre className="texto-caderno">{texto}</pre>
      <button type="button" className="botao-secundario" onClick={copiar}>
        Copiar para a área de transferência
      </button>
    </div>
  );
}
