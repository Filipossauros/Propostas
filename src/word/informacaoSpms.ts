// O que as informações da SPMS partilham, para lá do gerador de cada uma.
//
// A informação que a aplicação produz é a manifestação de necessidades, no
// modelo da DAG — ver `manifestacaoNecessidades.ts`, que substituiu o pedido de
// encargos plurianuais e a manifestação anterior. Ficam aqui as peças comuns:
// a data por extenso, o quadro das rates de referência e o arranjo da linha do
// rodapé dos modelos.

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function dataPorExtenso(quando: Date): string {
  return `${quando.getDate()} de ${MESES[quando.getMonth()]} de ${quando.getFullYear()}`;
}

/**
 * A linha de separação do rodapé, desenhada como borda e não como texto.
 *
 * No modelo é uma fila de sublinhados: com o tipo de letra do rodapé ocupa
 * mais do que a largura da página e parte-se em duas, a segunda a meio. Uma
 * borda inferior do parágrafo tem sempre a largura do texto, seja qual for o
 * tipo de letra — é uma linha só, de margem a margem. Fica no mesmo parágrafo,
 * com a mesma cor, para o resto do rodapé não mudar de sítio.
 */
export function rodapeComLinhaUnica(rodape: string): string {
  return rodape.replace(/<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?<w:t>_{10,}<\/w:t>[\s\S]*?<\/w:p>/, (paragrafo) =>
    paragrafo
      .replace(/<w:r\b[^>]*>(?:(?!<\/w:r>)[\s\S])*?<w:t>_+<\/w:t><\/w:r>/g, "")
      .replace(
        /(<w:pStyle [^>]*\/>)/,
        '$1<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="A6A6A6"/></w:pBdr>',
      ),
  );
}
