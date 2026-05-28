import type { Diagram as DiagramType } from './types'
import { Diagram } from './types'

/**
 * Field-path-precise validation errors that AI agents and humans can self-correct from.
 *
 * `parse()` either returns a typed Diagram or throws `InkinValidationError`. The error
 * message format is stable and grep-able:
 *
 *     inkin: invalid Diagram
 *       - diagram.nodes[3].id — Required
 *       - diagram.edges[1].from — edge.from references unknown node id "noep"
 *
 * The individual `issues[]` array is exposed for programmatic consumption (agents
 * doing single-round self-correction read `.issues` and patch the source object).
 */

export interface ValidationIssue {
  /** Dotted/bracketed path into the Diagram, prefixed with `diagram.` */
  path: string
  /** Human-readable reason. */
  message: string
}

/**
 * Structural shape of the per-issue object we read from zod's `error.issues`.
 * Defined locally rather than imported from `zod/v4/core` so an internal type
 * rename in a zod patch release doesn't break our build.
 */
interface RawZodIssue {
  readonly path: readonly PropertyKey[]
  readonly message: string
}

export class InkinValidationError extends Error {
  override readonly name = 'InkinValidationError'
  constructor(readonly issues: readonly ValidationIssue[]) {
    super(formatIssues(issues))
  }
}

function formatPath(rawPath: readonly PropertyKey[]): string {
  let out = 'diagram'
  for (const segment of rawPath) {
    if (typeof segment === 'number') {
      out += `[${segment}]`
    } else {
      out += `.${String(segment)}`
    }
  }
  return out
}

function formatIssues(issues: readonly ValidationIssue[]): string {
  if (issues.length === 0) return 'inkin: invalid Diagram (no issues reported)'
  return `inkin: invalid Diagram\n${issues.map((i) => `  - ${i.path} — ${i.message}`).join('\n')}`
}

/**
 * Parse and validate an unknown value as a Diagram.
 *
 * @throws {InkinValidationError} when validation fails; the error carries a
 *   structured `issues[]` array and a human-readable, multi-line `message`.
 */
export function parse(input: unknown): DiagramType {
  const result = Diagram.safeParse(input)
  if (result.success) return result.data

  const issues: ValidationIssue[] = result.error.issues.map((issue: RawZodIssue) => ({
    path: formatPath(issue.path),
    message: issue.message,
  }))
  throw new InkinValidationError(issues)
}

/**
 * Same as `parse` but returns a discriminated result instead of throwing.
 * Useful for surfaces that prefer Result-style error handling (e.g., agents
 * that want to inspect issues without try/catch).
 */
export function safeParse(
  input: unknown,
): { success: true; data: DiagramType } | { success: false; error: InkinValidationError } {
  try {
    return { success: true, data: parse(input) }
  } catch (err) {
    if (err instanceof InkinValidationError) return { success: false, error: err }
    throw err
  }
}
