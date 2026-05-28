import { z } from 'zod'
import { Diagram } from './types'

/**
 * The inkin `Diagram` zod schema serialized as a standard JSON Schema document
 * (Draft 2020-12). Designed to be passed directly into AI tool-use APIs:
 *
 *     // OpenAI / Anthropic / Gemini function-calling
 *     const tool = {
 *       name: 'create_diagram',
 *       description: 'Produce an inkin Diagram object.',
 *       input_schema: diagramJsonSchema,
 *     }
 *
 * The same content also ships as a static file at `dist/schema/diagram.schema.json`,
 * exported via the `inkin/diagram.schema.json` subpath for tools that prefer
 * fetching the schema over importing the JS module.
 *
 * Generated at build time — never edited by hand.
 */
export const diagramJsonSchema = z.toJSONSchema(Diagram, {
  target: 'draft-2020-12',
  // Generate the *input* schema, not the output. With io: 'input', fields with
  // `.default()` are listed as OPTIONAL — meaning AI agents can omit them and
  // zod will fill in the default at parse time. With the default io: 'output',
  // those fields would be marked required (because the parsed output always
  // contains them), which mismatches the AI-generation use case.
  io: 'input',
  // Inline definitions rather than $ref-ing them — AI function-calling APIs
  // historically have inconsistent $ref support; inline is the safest default.
  reused: 'inline',
})

export type DiagramJsonSchema = typeof diagramJsonSchema
