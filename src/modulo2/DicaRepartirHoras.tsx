import { useId } from "react";

/**
 * Porque é que a repartição de horas existe, e o que significa um ano a zero.
 *
 * Não é evidente à primeira: quem olha para a tabela vê três anos e presume que
 * o contrato corre nos três, para todos os perfis. A hipótese de um perfil
 * entrar só a meio — porque até lá está coberto por um contrato em vigor — é
 * precisamente o que esta repartição serve, e é preciso dizê-lo.
 */
export function DicaRepartirHoras() {
  const id = useId();

  return (
    <span className="dica">
      <button type="button" className="dica-alvo dica-ajuda" aria-describedby={id} aria-label="Como repartir as horas">
        ?
      </button>

      <span role="tooltip" id={id} className="dica-conteudo dica-lista">
        <strong>Como repartir as horas</strong>
        <ul>
          <li>Cada perfil tem um total de horas fixado no lote. Aqui reparte-se esse total pelos anos do contrato.</li>
          <li>A soma dos três anos tem de dar o total do lote: é o mesmo contrato, visto ano a ano.</li>
          <li>
            Um ano a zero significa que o perfil não é contratado nesse ano — é o que permite acomodar um contrato
            ainda em vigor.
          </li>
          <li>
            Exemplo: com um contrato a decorrer durante o primeiro ano, esse perfil leva 0 horas nesse ano e as suas
            horas repartem-se pelos dois seguintes, enquanto os restantes perfis vigoram nos três.
          </li>
          <li>À partida, as horas vêm divididas por igual pelos três anos — é só um ponto de partida.</li>
        </ul>
      </span>
    </span>
  );
}
