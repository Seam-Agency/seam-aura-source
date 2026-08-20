import { describe, expect, it } from "vitest";
import { DEFAULT_AURA_PALETTE, DEFAULT_PULSE_ORIGIN } from "../src";
import { fragmentShaderSource } from "../src/shader";

describe("source equation invariants", () => {
  it("locks the production palette and right-edge pulse origin", () => {
    expect(DEFAULT_AURA_PALETTE).toEqual([
      "#ff9cff",
      "#ff9638",
      "#ffff22",
      "#54ffff",
    ]);
    expect(DEFAULT_PULSE_ORIGIN).toEqual([1.001, 0.5]);
  });

  it("retains the signed-distance edge curves", () => {
    expect(fragmentShaderSource).toContain("u_padding * 2.5");
    expect(fragmentShaderSource).toContain("pow(inner, 3.0)");
    expect(fragmentShaderSource).toContain("u_padding * 5.5");
    expect(fragmentShaderSource).toContain("pow(outer, 5.0)");
  });

  it("retains pulse travel, source displacement and blue-noise dither", () => {
    expect(fragmentShaderSource).toContain(
      "waveTravelLength = waveLength + waveStartLength + waveEndLength",
    );
    expect(fragmentShaderSource).toContain(
      "smoothstep(0.0, 0.4, abs(waveDistance)) * wave * -0.005",
    );
    expect(fragmentShaderSource).toContain("blueNoise * 0.004");
    expect(fragmentShaderSource).toContain(
      "clamp(sampleUv, vec2(0.001), vec2(0.999))",
    );
    expect(fragmentShaderSource).not.toContain("revealed");
    expect(fragmentShaderSource).not.toContain("sweepWidth");
  });

  it("uses one emissive color path for every source luminance", () => {
    expect(fragmentShaderSource).toContain("vec3 color = emissiveColor");
    expect(fragmentShaderSource).not.toContain("sourceLuminance");
    expect(fragmentShaderSource).not.toContain("lightSurface");
    expect(fragmentShaderSource).not.toContain("lightSampleUv");
    expect(fragmentShaderSource).not.toContain("inkMask");
    expect(fragmentShaderSource).not.toContain("inkTint");
  });
});
