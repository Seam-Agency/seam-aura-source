import { describe, expect, it } from "vitest";
import {
  clampDpr,
  colorToLinearRgb,
  parseCssColor,
  pulseOriginFromAngle,
  resolveEdgeWidth,
  sineIn,
} from "../src/aura-math";

describe("aura math", () => {
  it("parses hex and rgb colors", () => {
    expect(parseCssColor("#ff9638")).toEqual([1, 150 / 255, 56 / 255]);
    expect(parseCssColor("rgb(84, 255, 255)")).toEqual([84 / 255, 1, 1]);
  });

  it("converts sRGB channels to linear values", () => {
    const [red, green, blue] = colorToLinearRgb("#ff0000");
    expect(red).toBe(1);
    expect(green).toBe(0);
    expect(blue).toBe(0);
  });

  it("caps DPR and edge width to safe rendering limits", () => {
    expect(clampDpr(9)).toBe(3);
    expect(clampDpr(0.1)).toBe(0.5);
    expect(resolveEdgeWidth(90, 320, 180)).toBe(18);
    expect(resolveEdgeWidth(120, 420, 64, 0.3)).toBeCloseTo(19.2);
  });

  it("uses a bounded sine-in activation curve", () => {
    expect(sineIn(-1)).toBe(0);
    expect(sineIn(1)).toBeCloseTo(1);
    expect(sineIn(0.5)).toBeGreaterThan(0);
    expect(sineIn(0.5)).toBeLessThan(1);
  });

  it("maps cardinal and diagonal travel angles to edge-safe pulse origins", () => {
    expect(pulseOriginFromAngle(0)[0]).toBeCloseTo(-0.001);
    expect(pulseOriginFromAngle(0)[1]).toBeCloseTo(0.5);
    expect(pulseOriginFromAngle(90)[0]).toBeCloseTo(0.5);
    expect(pulseOriginFromAngle(90)[1]).toBeCloseTo(-0.001);
    expect(pulseOriginFromAngle(180)[0]).toBeCloseTo(1.001);
    expect(pulseOriginFromAngle(180)[1]).toBeCloseTo(0.5);
    expect(pulseOriginFromAngle(270)[0]).toBeCloseTo(0.5);
    expect(pulseOriginFromAngle(270)[1]).toBeCloseTo(1.001);
    expect(pulseOriginFromAngle(135)[0]).toBeCloseTo(1.001);
    expect(pulseOriginFromAngle(135)[1]).toBeCloseTo(-0.001);
  });
});
