import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SeamAura, SeamAuraContainer } from "../src";

afterEach(cleanup);

describe("SeamAura", () => {
  it("preserves content and falls back cleanly when WebGL is unavailable", () => {
    const { container, getByText } = render(
      <SeamAura data-testid="frame">
        <span>Scene content</span>
      </SeamAura>,
    );

    const root = container.querySelector(".seam-aura");
    const canvas = container.querySelector("canvas");

    expect(getByText("Scene content")).toBeTruthy();
    expect(root?.getAttribute("data-renderer")).toBe("fallback");
    expect(root?.getAttribute("data-active")).toBe("true");
    expect(root?.getAttribute("data-source")).toBe("false");
    expect(canvas?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector(".seam-aura__fallback")).toBeTruthy();
  });

  it("exposes palette and activation through stable CSS variables", () => {
    const { container, rerender } = render(
      <SeamAura
        colors={["#111111", "#222222", "#333333", "#444444"]}
        active
      />,
    );

    const root = container.querySelector<HTMLElement>(".seam-aura")!;
    expect(root.style.getPropertyValue("--seam-aura-color-2")).toBe(
      "#333333",
    );
    expect(root.style.getPropertyValue("--seam-aura-active")).toBe("1");

    rerender(<SeamAura active={false} />);
    expect(root.style.getPropertyValue("--seam-aura-active")).toBe("0");
  });

  it("marks source-texture composition without changing child semantics", () => {
    const source = document.createElement("canvas");
    const { container, getByLabelText } = render(
      <SeamAura source={source}>
        <canvas aria-label="Input field" />
      </SeamAura>,
    );

    expect(container.querySelector(".seam-aura")?.getAttribute("data-source"))
      .toBe("true");
    expect(getByLabelText("Input field")).toBeTruthy();
  });

  it("renders a pointer-safe semantic layer inside interactive containers", () => {
    const { container, getByRole } = render(
      <button type="button">
        <SeamAuraContainer data-testid="aura-container" />
        <span>Run action</span>
      </button>,
    );

    const button = getByRole("button", { name: "Run action" });
    const aura = container.querySelector(".seam-aura--container");

    expect(button.querySelector(":scope > span.seam-aura")).toBe(aura);
    expect(aura?.tagName).toBe("SPAN");
    expect(aura?.getAttribute("aria-hidden")).toBe("true");
    expect(aura?.querySelector(".seam-aura__content")).toBeNull();
    expect(aura?.querySelector("canvas")).toBeTruthy();
  });
});
