import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export type AuraPalette = readonly [string, string, string, string];
export type AuraMode = "absolute" | "fixed" | "container";
export type NormalizedPoint = readonly [x: number, y: number];

export interface SeamAuraProps
  extends Omit<HTMLAttributes<HTMLElement>, "children" | "color"> {
  /** Content rendered beneath the decorative effect. */
  children?: ReactNode;
  /** Enables the effect. Changes are softly interpolated. @default true */
  active?: boolean;
  /** Multiplier for emitted edge light. @default 1 */
  intensity?: number;
  /** Width of the inward edge glow in CSS pixels. @default 50 */
  edgeWidth?: number;
  /** Four-color palette, ordered top-left through bottom-left. */
  colors?: AuraPalette;
  /** Rotation multiplier for the color field. @default 1 */
  speed?: number;
  /** Change this value to replay the travelling color-and-distortion pulse. */
  pulseKey?: string | number;
  /**
   * Screen-space travel angle in degrees. 0 travels right, 90 down, 180 left,
   * and 270 up. Ignored when `pulseOrigin` is supplied. @default 135
   */
  pulseAngle?: number;
  /**
   * Advanced pulse origin in normalized top-left coordinates. Overrides
   * `pulseAngle` when supplied.
   */
  pulseOrigin?: NormalizedPoint;
  /** Pulse travel time in seconds. @default 2 */
  pulseDuration?: number;
  /**
   * Optional browser image source sampled by the post-process. Canvas and video
   * sources are uploaded on every rendered frame so animated scenes stay live.
   */
  source?: TexImageSource | null;
  /** Flip browser-native image sources into WebGL texture coordinates. @default true */
  flipSourceY?: boolean;
  /** Maximum device pixel ratio used by the WebGL canvas. @default 2 */
  maxDpr?: number;
  /** Covers its own content, the viewport, or a positioned parent container. @default "absolute" */
  mode?: AuraMode;
  /** Freezes the color field and sweep at their current state. */
  paused?: boolean;
  /** Obeys prefers-reduced-motion and presents the completed state. @default true */
  respectReducedMotion?: boolean;
  /** Class applied to the content wrapper. */
  contentClassName?: string;
  /** Class applied to the WebGL canvas. */
  canvasClassName?: string;
  /** Inline styles for the WebGL canvas. */
  canvasStyle?: CSSProperties;
}

export interface SeamAuraContainerProps
  extends Omit<
    SeamAuraProps,
    "children" | "contentClassName" | "mode" | "aria-hidden"
  > {
  /** Container layers are decorative and intentionally do not accept children. */
  children?: never;
}
