import type { InformacaoEavalia, RespostaEavalia } from "../core/types";

interface Props {
  eavalia: InformacaoEavalia;
  onChange: (eavalia: InformacaoEavalia) => void;
}

/** Uma medida do formulário, com as respostas que lhe cabem. */
interface Medida {
  campo: keyof InformacaoEavalia;
  pergunta: string;
  opcoes: RespostaEavalia[];
}

/**
 * As opções são as da lista de validação do formulário eAvalia, escritas tal e
 * qual — incluindo o "Já cumpre" com minúscula. Cada medida oferece só as que
 * lhe fazem sentido; o formulário admite as cinco em todas.
 */
const MEDIDAS: Medida[] = [
  {
    campo: "iap",
    pergunta: "Utilização da plataforma de interoperabilidade da ARTE (iAP)",
    opcoes: ["Já cumpre", "Não aplicável"],
  },
  {
    campo: "chaveMovelDigital",
    pergunta:
      "Utilização de chave móvel digital como único método de autenticação para portais (websites) " +
      "disponibilizados ao público.",
    opcoes: ["Já cumpre", "Não aplicável"],
  },
  {
    campo: "idiomas",
    pergunta: "Disponibilização do portal (website) pelo menos nos idiomas português e inglês.",
    opcoes: ["Cumpre Parcialmente", "Já cumpre", "Não aplicável"],
  },
];

export function InformacaoEavaliaEditor({ eavalia, onChange }: Props) {
  const porResponder = MEDIDAS.filter((m) => eavalia[m.campo] === "").length;

  return (
    <>
      <div className="grelha-eavalia">
        {MEDIDAS.map((medida) => (
          <label key={medida.campo}>
            <span className="rotulo">{medida.pergunta}</span>
            <select
              value={eavalia[medida.campo]}
              aria-invalid={eavalia[medida.campo] === ""}
              onChange={(e) => onChange({ ...eavalia, [medida.campo]: e.target.value as RespostaEavalia })}
            >
              <option value="">— por responder —</option>
              {medida.opcoes.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {porResponder > 0 && (
        <p className="aviso aviso-erro">
          {porResponder === 1 ? "Falta responder a uma medida." : `Faltam responder a ${porResponder} medidas.`} As
          três são de preenchimento obrigatório.
        </p>
      )}

      <p className="ajuda">
        Preenchem as medidas correspondentes na folha «Alinhamento Tecnológico» do pedido de parecer prévio. A data
        só acompanha as respostas que assumem um compromisso futuro — quem já cumpre não tem data por que se
        comprometer. As restantes medidas do formulário vão como já vêm no modelo.
      </p>
    </>
  );
}
