/**
 * Shared UI primitives — internal-only.
 *
 * **Not** re-exported from `src/index.ts`. Consumers building their own
 * chrome around `<DiagramStudio>` style their own forms; we don't want
 * to commit to the API of a styled `<Button>` etc. as a public surface
 * (it would force changes here on every consumer rebrand).
 *
 * Phase 5 of the 0.4.0 plan introduces these; Phase 6's InspectorPanel
 * and Phase 7's Palette compose them.
 */

export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './Button'
export { ErrorPanel, type ErrorPanelProps } from './ErrorPanel'
export { Field, type FieldProps } from './Field'
export { Select, type SelectOption, type SelectProps } from './Select'
export { TextInput, type TextInputProps } from './TextInput'
