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

The schema kernel — framework-agnostic, AI-ready. Published as **`@inkin/core`** on npm; the project name remains **inkin**. Single package architecture: future releases grow `@inkin/core` itself rather than splitting into multiple packages — `0.2.0` adds the React `<DiagramStudio>` at the bare `@inkin/core` root entry, `0.6.0` adds the Mermaid bridge at the `@inkin/core/mermaid` subpath, etc. Consumers install `@inkin/core` once and pick which surfaces they import.

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
- Static `dist/schema/diagram.schema.json` file emitted at build time, exported via the
  `@inkin/core/diagram.schema.json` subpath for HTTP-fetchable / static-import consumers.
- **`@inkin/core/schema` is the only active subpath in `0.1.0`** — the bare
  `@inkin/core` root entry is intentionally absent from `package.json`'s `exports`
  map and will be added in `0.2.0` pointing at the React `<DiagramStudio>`
  component. Zero breaking changes between `0.1.0` and `0.2.0`; the schema subpath
  remains stable forever.
- **Published under the `@inkin` npm organization** as `@inkin/core`. The original
  unscoped name `inkin` was rejected by npm's anti-typosquatting check (too similar
  to existing packages `ink` and `ini`); the `@inkin` scope bypasses that check
  cleanly. Single-package architecture preserved from the original plan — future
  releases grow this package's exports map rather than spawning sibling packages.

### Verified

- Schema validation, layout determinism, JSON round-trip (parse → stringify → parse)
  via vitest. JSON Schema validity (Draft 2020-12) and runtime ↔ static parity via
  `ajv@8` with the 2020 meta-schema.

### Deferred

- **`arethetypeswrong` (attw) type-export check** is intentionally not gated in CI
  for `0.1.0`. attw requires either a `main` field or a `.` entry in `exports`;
  this release intentionally has only the `./schema` subpath (no `.`) so consumers
  can adopt without a breaking import path change at `0.2.0`. attw returns as a CI
  gate at `0.2.0` when the React surface adds the `.` entry. The `pnpm attw`
  script is still available for ad-hoc runs.

[Unreleased]: https://github.com/kartikeya-27/inkin/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/kartikeya-27/inkin/releases/tag/v0.1.0
[@inkin/core on npm]: https://www.npmjs.com/package/@inkin/core
