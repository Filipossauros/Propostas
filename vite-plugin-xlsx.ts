import { readFile } from 'node:fs/promises'
import type { Plugin } from 'vite'

/**
 * Permite `import modelo from "./x.xlsx?base64"`, devolvendo o ficheiro
 * embutido no pacote como texto base64.
 *
 * É embutido, e não servido como recurso: a aplicação não faz uma única
 * chamada de rede, e um `fetch` — mesmo de um ficheiro do próprio pacote —
 * seria uma, além de falhar quando o `dist/` é aberto a partir do disco.
 */
export function xlsxEmBase64(): Plugin {
  return {
    name: 'xlsx-em-base64',
    enforce: 'pre',
    async load(id) {
      const [caminho, query] = id.split('?')
      if (query !== 'base64' || !caminho.endsWith('.xlsx')) return null
      const dados = await readFile(caminho)
      return `export default ${JSON.stringify(dados.toString('base64'))};`
    },
  }
}
