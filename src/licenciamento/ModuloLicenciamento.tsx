interface Props {
  nomeProjeto: string;
  onIrParaProjeto: () => void;
}

/**
 * Pedido de licenciamento — em preparação.
 *
 * O módulo existe já na organização da aplicação, a seguir ao Projeto, que
 * partilha com o pedido de serviços de bolsa de horas. O conteúdo do pedido
 * (licenças, quantidades, documento a gerar) acrescenta-se quando estiver
 * definido.
 */
export function ModuloLicenciamento({ nomeProjeto, onIrParaProjeto }: Props) {
  return (
    <div className="modulo">
      <header className="modulo-cabecalho">
        <div className="modulo-titulo-linha">
          <h2>Pedido de licenciamento</h2>
        </div>
        <p className="modulo-subtitulo">
          Preparação de pedidos de licenciamento, a partir da caracterização do projeto.
        </p>
      </header>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Em preparação</h3>
        </header>
        <p>
          Este módulo ainda está a ser preparado. Para já, pode caracterizar o projeto no Módulo 1: é a mesma
          caracterização que servirá o pedido de licenciamento.
        </p>
        <p className="ajuda">
          {nomeProjeto.trim() === "" ? "Ainda não há projeto caracterizado." : `Projeto atual: ${nomeProjeto}.`}
        </p>
        <div className="acoes">
          <button type="button" className="botao-secundario" onClick={onIrParaProjeto}>
            ← Ir para o Módulo 1 · Projeto
          </button>
        </div>
      </section>
    </div>
  );
}
