// O eAvalia-padrão: o mesmo formulário, para quem não usa a aplicação.
//
// As equipas que não passam por aqui preenchem o pedido de parecer à mão, e
// nada as impede de responder ao lado do que a organização já decidiu. Este
// ficheiro fecha essa porta: o que se pode responder no padrão é exatamente o
// que se responde no Módulo 2 — as mesmas medidas e, em cada uma, as mesmas
// opções. As de resposta fixa vão já respondidas, e o resto da folha do
// alinhamento tecnológico fica trancado.
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
  medidasPerguntadas,
  RESPOSTAS_COM_DATA,
  textoDaMedida,
} from "./eavaliaModelo";

/**
 * As células que ficam abertas, e a lista de escolha de cada uma.
 *
 * São as das medidas que o Módulo 2 pergunta, e mais nenhuma: as restantes ou
 * têm resposta fixa, ou não se respondem na aplicação — e o padrão não há de
 * admitir o que a aplicação não admite.
 */
function escolhasDoFormulario(): Map<string, readonly string[]> {
  return new Map(medidasPerguntadas().map((medida) => [`E${medida.linha}`, medida.opcoes]));
}

/**
 * As datas que acompanham as respostas de compromisso.
 *
 * Só se abre a data das medidas que admitem comprometer-se com um prazo: onde
 * a escolha é entre já cumprir e não se aplicar, não há data por que esperar.
 */
function datasDoFormulario(): string[] {
  return medidasPerguntadas()
    .filter((medida) => medida.opcoes.some((opcao) => RESPOSTAS_COM_DATA.includes(opcao)))
    .map((medida) => `F${medida.linha}`);
}

/**
 * Tira das listas do modelo as células que passam a ter lista própria.
 *
 * As listas do modelo vivem na extensão `x14` e apontam à folha «Backup», onde
 * estão as cinco respostas possíveis. Duas listas sobre a mesma célula seriam
 * uma contradição, pelo que a do modelo deixa de a cobrir. Uma lista que fique
 * sem células nenhumas desaparece.
 */
function semRefsNasListas(xml: string, refs: Set<string>): string {
  const cobertas = new Set<string>();
  let removidas = 0;

  const semRefs = xml.replace(/<x14:dataValidation\b[\s\S]*?<\/x14:dataValidation>/g, (validacao) => {
    const sqref = /<xm:sqref>([^<]*)<\/xm:sqref>/.exec(validacao);
    if (sqref === null) return validacao;

    const todas = sqref[1].split(/\s+/).filter((ref) => ref !== "");
    for (const ref of todas) if (refs.has(ref)) cobertas.add(ref);

    const restantes = todas.filter((ref) => !refs.has(ref));
    if (restantes.length === 0) {
      removidas += 1;
      return "";
    }
    return validacao.replace(sqref[0], `<xm:sqref>${restantes.join(" ")}</xm:sqref>`);
  });

  for (const ref of refs) {
    if (!cobertas.has(ref)) {
      throw new ErroModeloEavalia(`A célula ${ref} do modelo eAvalia já não tem lista de escolha.`);
    }
  }

  return semRefs.replace(/<x14:dataValidations count="(\d+)"/, (_inteiro, conta: string) => {
    return `<x14:dataValidations count="${Number(conta) - removidas}"`;
  });
}

/** Uma lista de escolha escrita no próprio ficheiro, e não por referência à folha «Backup». */
function listaDeEscolha(refs: string[], opcoes: readonly string[]): string {
  return (
    '<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" ' +
    `sqref="${refs.join(" ")}"><formula1>"${opcoes.join(",")}"</formula1></dataValidation>`
  );
}

/**
 * Junta as listas novas — e as datas que se abriram — às validações da folha.
 *
 * Medidas com as mesmas opções partilham uma validação, que é como o Excel as
 * escreve e como se lêem melhor.
 */
function comValidacoesProprias(xml: string, escolhas: Map<string, readonly string[]>, datas: string[]): string {
  const porOpcoes = new Map<string, string[]>();
  for (const [ref, opcoes] of escolhas) {
    const chave = opcoes.join("\u0000");
    porOpcoes.set(chave, [...(porOpcoes.get(chave) ?? []), ref]);
  }
  const novas = [...porOpcoes].map(([chave, refs]) => listaDeEscolha(refs, chave.split("\u0000")));

  const bloco = /<dataValidations count="(\d+)">([\s\S]*?)<\/dataValidations>/.exec(xml);
  if (bloco === null) throw new ErroModeloEavalia("O modelo eAvalia não tem validações na folha do alinhamento.");

  // A data das medidas abertas tem de caber na validação de data do modelo,
  // que não cobre todas as linhas do formulário.
  const comDatas = bloco[2].replace(/(<dataValidation type="date"[^>]*sqref=")([^"]*)(")/, (_i, antes, refs, depois) => {
    const todas = refs.split(/\s+/).filter((ref: string) => ref !== "");
    const faltam = datas.filter((ref) => !todas.includes(ref));
    return `${antes}${[...todas, ...faltam].join(" ")}${depois}`;
  });

  return xml.replace(
    bloco[0],
    () => `<dataValidations count="${Number(bloco[1]) + novas.length}">${comDatas}${novas.join("")}</dataValidations>`,
  );
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

/**
 * O fundo amarelo dos campos a preencher, acrescentado à paleta do modelo.
 *
 * É o que num formulário em papel seria a caixa a sombreado: quem abre o
 * ficheiro vê logo onde pode escrever, sem ter de descobrir célula a célula o
 * que a proteção deixa e o que não deixa.
 */
function comFundoAmarelo(estilos: string): { xml: string; amarelo: number } {
  const bloco = /<fills count="(\d+)">([\s\S]*?)<\/fills>/.exec(estilos);
  if (bloco === null) throw new ErroModeloEavalia("O modelo eAvalia não tem os fundos das células.");

  const amarelo = '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2A8"/><bgColor indexed="64"/></patternFill></fill>';
  const conta = Number(bloco[1]);
  return {
    xml: estilos.replace(bloco[0], () => `<fills count="${conta + 1}">${bloco[2]}${amarelo}</fills>`),
    amarelo: conta,
  };
}

/** O mesmo estilo, com o fundo dos campos a preencher. */
function comAmarelo(xf: string, amarelo: number): string {
  const semAtributo = xf.replace(/\sapplyFill="[01]"/, "");
  const comFill = /fillId="\d+"/.test(semAtributo)
    ? semAtributo.replace(/fillId="\d+"/, `fillId="${amarelo}"`)
    : semAtributo.replace("<xf ", `<xf fillId="${amarelo}" `);
  return comFill.replace("<xf ", '<xf applyFill="1" ');
}

function estilosComProtecao(xfs: string[], amarelo: number): EstilosComProtecao {
  const porEstado = new Map<string, number>();
  const novos: string[] = [];

  return {
    acrescentados: novos,
    com(origem, aberto) {
      const chave = `${origem}:${aberto}`;
      const jaHa = porEstado.get(chave);
      if (jaHa !== undefined) return jaHa;

      const protecao = `<protection locked="${aberto ? 0 : 1}"/>`;
      const original = (xfs[origem] ?? XF_POR_OMISSAO).replace(/<protection[^>]*\/>/g, "");
      const base = aberto ? comAmarelo(original, amarelo) : original;
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

  // 2. As medidas que o Módulo 2 pergunta passam a ter, no ficheiro, a lista de
  //    escolha que o ecrã oferece — nem mais opções, nem outras.
  const escolhas = escolhasDoFormulario();
  const datas = datasDoFormulario();
  xml = semRefsNasListas(xml, new Set(escolhas.keys()));
  xml = comValidacoesProprias(xml, escolhas, datas);

  // 3. Só essas células ficam abertas — e a amarelo, para se verem; tudo o
  //    resto tranca-se.
  const { xml: estilosXml, amarelo } = comFundoAmarelo(await ficheiroEstilos.async("string"));
  const { inicio, fim, xfs } = lerCellXfs(estilosXml);
  const estilos = estilosComProtecao(xfs, amarelo);
  const abertas = new Set([...escolhas.keys(), ...datas].filter((ref) => !fixas.has(ref)));
  xml = comProtecaoDeclarada(xml, abertas, estilos);

  // 4. E tranca-se a folha, que é o que dá efeito ao passo anterior.
  if (xml.includes("<sheetProtection")) {
    throw new ErroModeloEavalia("A folha do alinhamento já vinha protegida no modelo.");
  }
  xml = xml.replace("</sheetData>", `</sheetData>${PROTECAO}`);
  zip.file(FOLHA_ALINHAMENTO, xml);

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
