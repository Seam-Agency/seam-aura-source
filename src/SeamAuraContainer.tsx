import { SeamAura } from "./SeamAura";
import type { SeamAuraContainerProps } from "./types";

/**
 * Pointer-safe Aura layer for buttons, links, cards, and other positioned
 * containers. The parent owns its semantic content, surface, and interaction.
 */
export function SeamAuraContainer(props: SeamAuraContainerProps) {
  return <SeamAura {...props} mode="container" aria-hidden="true" />;
}
