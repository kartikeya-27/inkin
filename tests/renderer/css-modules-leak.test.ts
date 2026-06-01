import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * CSS Modules leak gate (Phase 10 polish).
 *
 * Asserts that no `.module.css` class names leak into `dist/styles.css`
 * without their per-module hash prefix. CSS Modules is the only thing
 * keeping consumer styles from colliding with ours — a leak means a
 * consumer's `.root` would clash with one of our internal classes.
 *
 * Strategy: scan the consolidated stylesheet for plain `.root` /
 * `.body` / `.title` / etc. as top-level selectors. Hashed forms
 * (`.f_EOSa_root`, `.dKeFBG_input`, ...) match `_NAME` and are fine.
 * Anything in the form `.NAME` standalone is a leak.
 *
 * Skipped (with a console note) when `dist/styles.css` doesn't exist —
 * e.g., running `pnpm test` before `pnpm build`. The CI matrix and the
 * `prepublishOnly` gate both build before testing, so this never
 * silently no-ops in protected environments.
 */

const DIST_CSS = join(process.cwd(), 'dist', 'styles.css')

// Module-internal class names we ship. Adding a new `.module.css` entry
// usually adds a class here; the test is the reminder to keep this list
// honest, since a missing entry would let a real leak slip past.
const MODULE_CLASSES = [
  // BaseNode, RectNode, TerminalNode, Cluster, LabeledEdge, EditableLabel
  'root',
  'selected',
  'handle',
  'label',
  'sublabel',
  'staticLabel',
  'staticLabelEmpty',
  'input',
  'path',
  'dashed',
  'labelSelected',
  'cluster',
  'clusterLabel',
  // DiagramStudio
  'error',
  'errorTitle',
  'errorList',
  'errorPath',
  // ui/
  'sizeSm',
  'sizeMd',
  'variantPrimary',
  'variantDanger',
  'message',
  'dismiss',
  'labelRow',
  'hint',
  'description',
  'control',
  // inspector + palette
  'positionRight',
  'positionLeft',
  'positionTop',
  'header',
  'title',
  'body',
  'tool',
]

describe('CSS Modules leak gate', () => {
  it('every internal module class appears only in hashed form in dist/styles.css', () => {
    if (!existsSync(DIST_CSS)) {
      console.warn(`[skip] ${DIST_CSS} not present; run pnpm build first`)
      return
    }
    const css = readFileSync(DIST_CSS, 'utf8')

    for (const name of MODULE_CLASSES) {
      // Unhashed: `.NAME` followed by whitespace, `,`, `{`, or `:`.
      // Hashed forms always have `_` immediately before `NAME` (per
      // Rolldown's `[hash]_[name]` template), so we negate that with a
      // negative lookbehind that excludes `_`.
      const unhashed = new RegExp(`(?<![\\w_])\\.${name}(?=[\\s,{:])`, 'g')
      const matches = css.match(unhashed) ?? []
      expect(
        matches,
        `'.${name}' leaked unhashed into dist/styles.css; CSS Modules scoping is broken`,
      ).toEqual([])
    }
  })
})
