# Changelog

All notable changes to this project will be documented in this file. Format follows
[Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/). This project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Pre-1.0 conventions: per semver pre-1.0, MINOR bumps (`0.x.0`) may include breaking
changes; PATCH bumps (`0.x.y`) are bug fixes only. Schema version is tied to package
MAJOR — a `schemaVersion: 2` will only ship with `inkin@2.0.0`.

## [Unreleased]

_Nothing yet._

## [0.1.0] — 2026-05-28

The schema kernel — framework-agnostic, AI-ready. Published as **`@inkin/schema`** on npm; the project name remains **inkin**. Future `@inkin/*` packages ship the React surface (`0.2.0`), the Mermaid bridge (`0.6.0`), and so on — each under the same scope, installable independently.

### Added

- `Diagram` zod schema (v1) covering `nodes`, `edges`, optional `clusters` and `flows`.
- `Node`, `Edge`, `Cluster`, `Flow`, `Position` zod schemas with TypeScript types inferred.
- `parse(input)` validator that returns a typed `Diagram` or throws `InkinValidationError`
  with field-path-precise issues (e.g. `diagram.nodes[3].id — Required`).
- `safeParse(input)` non-throwing variant returning a discriminated result.
- Integrity checks: unique node/edge/cluster ids, edge/cluster reference resolution,
  cluster-self-parent rejection, flow-edge resolution against both explicit ids and
  the auto-derived `${from}->${to}` form.
- `layout(diagram, engine?)` auto-positioning, defaulting to `@dagrejs/dagre` 1.x
  (the maintained dagre fork). User-supplied positions are preserved verbatim.
- `createDagreLayout(options)` factory for custom direction / spacing.
- `LayoutEngine` interface so consumers can swap in elkjs or hand-position layouts.
- `diagramJsonSchema` — JSON Schema Draft 2020-12 export via zod 4's `z.toJSONSchema()`,
  ready to drop into OpenAI / Anthropic / Gemini function-calling.
- Static `dist/diagram.schema.json` file emitted at build time, exported via the
  `@inkin/schema/diagram.schema.json` subpath for HTTP-fetchable / static-import consumers.
- **Published under the `@inkin` npm organization** as `@inkin/schema`. The original
  unscoped name `inkin` was rejected by npm's anti-typosquatting check (too similar
  to existing packages `ink` and `ini`); the `@inkin` scope bypasses that check
  cleanly and sets up the future package layout (`@inkin/react` for `0.2.0`,
  `@inkin/mermaid` for `0.6.0`). Each future release adds a new package under the
  same scope; `@inkin/schema` remains the shared dependency.

### Verified

- Schema validation, layout determinism, JSON round-trip (parse → stringify → parse)
  via vitest. JSON Schema validity (Draft 2020-12) and runtime ↔ static parity via
  `ajv@8` with the 2020 meta-schema.

### Deferred

- **`arethetypeswrong` (attw) type-export check** is intentionally not gated in CI
  for `0.1.0`. With the package restructure to `@inkin/schema` (where the package
  itself is the schema, served at the `.` entry), attw should work — but this
  pivot happened during the publish race, and we'd rather not add a gate that
  hasn't been ground-truthed yet. attw returns as a CI gate at `0.2.0` after
  ad-hoc validation. The `pnpm attw` script is still available for ad-hoc runs.

[Unreleased]: https://github.com/kartikeya-27/inkin/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/kartikeya-27/inkin/releases/tag/v0.1.0
[@inkin/schema on npm]: https://www.npmjs.com/package/@inkin/schema
