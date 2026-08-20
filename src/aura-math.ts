import type { AuraPalette, NormalizedPoint } from "./types";

export const DEFAULT_AURA_PALETTE: AuraPalette = [
  "#ff9cff",
  "#ff9638",
  "#ffff22",
  "#54ffff",
];

export const DEFAULT_PULSE_ORIGIN: NormalizedPoint = [1.001, 0.5];
export const DEFAULT_PULSE_ANGLE = 135;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Converts a screen-space travel angle into a pulse origin just outside the
 * frame. 0deg travels right, 90deg down, 180deg left, and 270deg up.
 */
export function pulseOriginFromAngle(angle: number): NormalizedPoint {
  const safeAngle = Number.isFinite(angle) ? angle : DEFAULT_PULSE_ANGLE;
  const radians = (safeAngle * Math.PI) / 180;
  const rawX = Math.cos(radians);
  const rawY = Math.sin(radians);
  const directionX = Math.abs(rawX) < 1e-12 ? 0 : rawX;
  const directionY = Math.abs(rawY) < 1e-12 ? 0 : rawY;
  const distance = 0.501 / Math.max(Math.abs(directionX), Math.abs(directionY));

  return [
    0.5 - directionX * distance,
    0.5 - directionY * distance,
  ];
}

export function clampDpr(value: number | undefined): number {
  if (!Number.isFinite(value)) return 2;
  return clamp(value ?? 2, 0.5, 3);
}

export function resolveEdgeWidth(
  requested: number | undefined,
  width: number,
  height: number,
  maxFrameRatio = 0.1,
): number {
  const safeRequested = Number.isFinite(requested) ? (requested ?? 50) : 50;
  const safeFrameRatio = clamp(maxFrameRatio, 0.01, 0.5);
  return clamp(
    safeRequested,
    1,
    Math.max(1, Math.min(width, height) * safeFrameRatio),
  );
}

function parseHexColor(value: string): [number, number, number] | null {
  const hex = value.trim().replace(/^#/, "");
  const expanded =
    hex.length === 3 || hex.length === 4
      ? hex
          .slice(0, 3)
          .split("")
          .map((character) => character + character)
          .join("")
      : hex.slice(0, 6);

  if (expanded.length !== 6 || !/^[0-9a-f]{6}$/i.test(expanded)) return null;

  return [
    Number.parseInt(expanded.slice(0, 2), 16) / 255,
    Number.parseInt(expanded.slice(2, 4), 16) / 255,
    Number.parseInt(expanded.slice(4, 6), 16) / 255,
  ];
}

function parseRgbColor(value: string): [number, number, number] | null {
  if (!/^rgba?\(/i.test(value.trim())) return null;
  const channels = value.match(/(?:\d*\.)?\d+%?/g)?.slice(0, 3);
  if (!channels || channels.length !== 3) return null;

  return channels.map((channel) =>
    channel.endsWith("%")
      ? clamp(Number.parseFloat(channel) / 100, 0, 1)
      : clamp(Number.parseFloat(channel) / 255, 0, 1),
  ) as [number, number, number];
}

export function parseCssColor(value: string): [number, number, number] {
  return parseHexColor(value) ?? parseRgbColor(value) ?? [1, 1, 1];
}

export function srgbToLinear(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

export function colorToLinearRgb(value: string): [number, number, number] {
  const [red, green, blue] = parseCssColor(value);
  return [srgbToLinear(red), srgbToLinear(green), srgbToLinear(blue)];
}

export function sineIn(value: number): number {
  const clamped = clamp(value, 0, 1);
  return 1 - Math.cos((clamped * Math.PI) / 2);
}
