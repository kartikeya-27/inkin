// Build-time helper: writes the generated Diagram JSON Schema to
// `dist/schema/diagram.schema.json` so it can be referenced via the
// `@inkin/core/diagram.schema.json` subpath export.
//
// Runs after `tsdown` has produced `dist/schema/index.js`. Imports the
// pre-computed `diagramJsonSchema` from there (no re-running zod's
// `toJSONSchema` at build time — single source of truth).

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const distEntry = join(here, '..', 'dist', 'schema', 'index.js')
const outPath = join(here, '..', 'dist', 'schema', 'diagram.schema.json')

const mod = await import(pathToFileURL(distEntry).href)
const schema = mod.diagramJsonSchema

if (!schema || typeof schema !== 'object') {
  console.error(
    '[emit-json-schema] dist/schema/index.js did not export `diagramJsonSchema`. Build aborted.',
  )
  process.exit(1)
}

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(schema, null, 2)}\n`, 'utf8')

console.log(`[emit-json-schema] wrote ${outPath}`)
