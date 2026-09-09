// O eAvalia-padrão: o mesmo formulário, para quem não usa a aplicação.
//
// As equipas que não passam por aqui preenchem o pedido de parecer à mão, e
// nada as impede de responder ao lado do que a organização já decidiu. Este
// ficheiro fecha essa porta: as medidas de resposta fixa vão já respondidas e
// trancadas, e da folha do alinhamento tecnológico só ficam abertas as células
// que admitem escolha — as respostas às medidas e as datas que algumas delas
// obrigam a indicar.
//
// As restantes folhas — a despesa, os custos — ficam como estão: também são
// para preencher, e não é aqui que se decide o que lá vai.
//
// Recebe os bytes do modelo em vez de os importar: assim serve tanto a
// aplicação como o script que gera o ficheiro para distribuir.

import JSZip from "jszip";
import {
  celulaDeTexto,
  ErroModeloEavalia,
  escreverCelula,
  FOLHA_ALINHAMENTO,
  lerCadeiasPartilhadas,
  MEDIDAS,
  textoDaMedida,
} from "./eavaliaModelo";

/**
 * As células de resposta que ficam abertas, e as de data que as acompanham.
 *
 * Saem da própria validação do modelo (`x14:dataValidation` com lista) e não de
 * uma lista escrita à mão: se o formulário ganhar medidas, elas ficam abertas
 * sem ninguém ter de se lembrar disso.
 */
function celulasComEscolha(xml: string): string[] {
  const listas = [...xml.matchAll(/<x14:dataValidation type="list"[\s\S]*?<xm:sqref>([^<]*)<\/xm:sqref>/g)];
  if (listas.length === 0) {
    throw new ErroModeloEavalia("O modelo eAvalia já não tem listas de escolha na folha do alinhamento.");
  }
  return listas.flatMap((m) => m[1].split(/\s+/).filter((ref) => ref !== ""));
}

/** As células de data do formulário: uma resposta de compromisso obriga a indicá-la. */
function celulasComData(xml: string): string[] {
  const datas = /<dataValidation type="date"[^>]*sqref="([^"]*)"/.exec(xml);
  return datas === null ? [] : datas[1].split(/\s+/).filter((ref) => ref !== "");
}

/**
 * Estilos com a proteção declarada — trancada ou aberta.
 *
 * No Excel a proteção é um atributo do estilo, não da célula: mudar o estado de
 * uma célula é apontá-la a um `xf` que o diga. O modelo traz a maioria dos seus
 * abertos, de quando alguém o protegeu e voltou atrás, pelo que não basta abrir
 * o que interessa — é preciso trancar explicitamente tudo o resto.
 *
 * Cada par (estilo de origem, estado) dá um `xf` só, reaproveitado por todas as
 * células que o partilhem: são centenas de células e algumas dezenas de estilos.
 */
interface EstilosComProtecao {
  /** O índice do estilo equivalente a `origem`, aberto ou trancado. */
  com: (origem: number, aberto: boolean) => number;
  /** Os `xf` que foi preciso criar, para acrescentar ao `cellXfs`. */
  acrescentados: string[];
}

const XF_POR_OMISSAO = '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>';

function estilosComProtecao(xfs: string[]): EstilosComProtecao {
  const porEstado = new Map<string, number>();
  const novos: string[] = [];

  return {
    acrescentados: novos,
    com(origem, aberto) {
      const chave = `${origem}:${aberto}`;
      const jaHa = porEstado.get(chave);
      if (jaHa !== undefined) return jaHa;

      const protecao = `<protection locked="${aberto ? 0 : 1}"/>`;
      const base = (xfs[origem] ?? XF_POR_OMISSAO).replace(/<protection[^>]*\/>/g, "");
      const comAtributo = base.includes('applyProtection="1"')
        ? base
        : base.replace("<xf ", '<xf applyProtection="1" ');
      const xf = comAtributo.endsWith("/>")
        ? `${comAtributo.slice(0, -2)}>${protecao}</xf>`
        : comAtributo.replace("</xf>", `${protecao}</xf>`);

      const indice = xfs.length + novos.length;
      novos.push(xf);
      porEstado.set(chave, indice);
      return indice;
    },
  };
}

/** Os `xf` do `cellXfs`, pela ordem em que lá estão — o índice é o `s` das células. */
function lerCellXfs(estilos: string): { inicio: number; fim: number; xfs: string[] } {
  const bloco = /<cellXfs count="\d+">([\s\S]*?)<\/cellXfs>/.exec(estilos);
  if (bloco === null) throw new ErroModeloEavalia("O modelo eAvalia não tem estilos de célula.");
  return {
    inicio: bloco.index,
    fim: bloco.index + bloco[0].length,
    // Um `xf` ou fecha em si mesmo, ou tem filhos (`alignment`, `protection`)
    // e fecha em `</xf>`. Um padrão preguiçoso só com `/>` partia os segundos
    // ao meio, no `/>` do primeiro filho.
    xfs: bloco[1].match(/<xf\b[^>]*\/>|<xf\b[^>]*>[\s\S]*?<\/xf>/g) ?? [],
  };
}

/**
 * Declara a proteção de todas as células da folha, de uma passagem só.
 *
 * Percorre-se a folha inteira e não apenas as células a abrir: o que se
 * pretende é uma folha em que tudo está trancado menos o que admite escolha, e
 * das duas metades só uma vinha declarada no modelo.
 */
function comProtecaoDeclarada(xml: string, abertas: Set<string>, estilos: EstilosComProtecao): string {
  return xml.replace(/<c r="([A-Z]+\d+)"([^>]*?)(\/?)>/g, (_inteiro, ref: string, atributos: string, fecho: string) => {
    const atual = /s="(\d+)"/.exec(atributos);
    const novo = estilos.com(atual === null ? 0 : Number(atual[1]), abertas.has(ref));
    const comEstilo =
      atual === null ? `${atributos} s="${novo}"` : atributos.replace(/s="\d+"/, `s="${novo}"`);
    return `<c r="${ref}"${comEstilo}${fecho}>`;
  });
}

/**
 * A proteção da folha, sem palavra-passe.
 *
 * Sem palavra-passe de propósito: o que se pretende é que ninguém responda por
 * distração onde a resposta já está decidida, não trancar o ficheiro a quem
 * tenha uma razão para o alterar. A ordem dos elementos de uma folha é imposta
 * pelo esquema, e `sheetProtection` vem logo a seguir a `sheetData`.
 *
 * ATENÇÃO ao sentido dos atributos, que é ao contrário do que as caixas do
 * Excel dão a entender: aqui `1` é «não deixa». `selectLockedCells` e
 * `selectUnlockedCells` ficam de fora — postos a `1`, ninguém conseguiria
 * sequer selecionar uma célula, e a folha, protegida, deixava de se preencher.
 * O que fica vedado é mexer na estrutura: inserir e apagar linhas ou colunas,
 * ordenar, filtrar. Formatar continua livre — alargar uma coluna para ler o
 * texto todo não estraga nada.
 */
const PROTECAO =
  '<sheetProtection sheet="1" objects="1" scenarios="1" ' +
  'formatCells="0" formatColumns="0" formatRows="0" ' +
  'insertColumns="1" insertRows="1" insertHyperlinks="1" deleteColumns="1" deleteRows="1" ' +
  'sort="1" autoFilter="1" pivotTables="1"/>';

export async function construirEavaliaPadrao(modelo: Uint8Array): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(modelo);
  const folha = zip.file(FOLHA_ALINHAMENTO);
  const cadeias = zip.file("xl/sharedStrings.xml");
  const ficheiroEstilos = zip.file("xl/styles.xml");
  if (folha === null || cadeias === null || ficheiroEstilos === null) {
    throw new ErroModeloEavalia("O modelo eAvalia não tem a estrutura esperada.");
  }

  const partilhadas = lerCadeiasPartilhadas(await cadeias.async("string"));
  let xml = await folha.async("string");

  // 1. As respostas que a organização já decidiu vão escritas — e, por não
  //    ficarem abertas adiante, ficam trancadas.
  const fixas = new Set<string>();
  for (const medida of MEDIDAS) {
    if (!("fixa" in medida)) continue;

    const texto = textoDaMedida(xml, medida.linha, partilhadas);
    if (!texto.startsWith(medida.inicioDoTexto)) {
      throw new ErroModeloEavalia(
        `A linha ${medida.linha} do modelo eAvalia já não é a medida esperada ("${medida.inicioDoTexto}…").`,
      );
    }
    const ref = `E${medida.linha}`;
    fixas.add(ref);
    xml = escreverCelula(xml, ref, (attrs) => celulaDeTexto(ref, attrs, medida.fixa), true);
  }

  // 2. Abre-se o que admite escolha — menos o que acabou de ser decidido — e
  //    tranca-se tudo o resto.
  const { inicio, fim, xfs } = lerCellXfs(await ficheiroEstilos.async("string"));
  const estilos = estilosComProtecao(xfs);
  const abertas = new Set([...celulasComEscolha(xml), ...celulasComData(xml)].filter((ref) => !fixas.has(ref)));
  xml = comProtecaoDeclarada(xml, abertas, estilos);

  // 3. E tranca-se a folha, que é o que dá efeito ao passo anterior.
  if (xml.includes("<sheetProtection")) {
    throw new ErroModeloEavalia("A folha do alinhamento já vinha protegida no modelo.");
  }
  xml = xml.replace("</sheetData>", `</sheetData>${PROTECAO}`);
  zip.file(FOLHA_ALINHAMENTO, xml);

  const estilosXml = await ficheiroEstilos.async("string");
  const total = xfs.length + estilos.acrescentados.length;
  zip.file(
    "xl/styles.xml",
    estilosXml.slice(0, inicio) +
      `<cellXfs count="${total}">${xfs.join("")}${estilos.acrescentados.join("")}</cellXfs>` +
      estilosXml.slice(fim),
  );

  // O `loadAsync` cria entradas de pasta ao interpretar os caminhos; o modelo
  // não as tem, e o arquivo há de sair com as mesmas entradas com que entrou.
  for (const nome of Object.keys(zip.files)) {
    if (zip.files[nome].dir) delete zip.files[nome];
  }

  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
