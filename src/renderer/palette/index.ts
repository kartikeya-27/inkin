/**
 * Palette — internal barrel.
 *
 * Not re-exported from `src/index.ts`. Phase 8 wires `<Palette>` into
 * DiagramStudio via the `palette` prop.
 */

export { Palette, type PalettePosition, type PaletteProps } from './Palette'
export {
  DEFAULT_CLUSTER_LABEL,
  DEFAULT_NODE_LABEL,
  type HandlePlacementClickOptions,
  handlePlacementClick,
} from './tools'
