// @system codegen
// @status generated
// @edit change the suite in the owned-suites band, then re-run codegen. Hand-edits are overwritten.
//
// This suite's assertions are OWNED by the codegen band: the band module
// carries them verbatim, this file is the emission, and hand edits here are
// overwritten on the next run. The rationale each assertion carries moved
// with it into the band.

import { afterEach, mock, test, expect } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
// Guarded: several suite files register happy-dom, and a second registration
// throws — an unguarded register() breaks whole-suite runs for every peer.
if (!globalThis.document) GlobalRegistrator.register();

mock.module("@teamscala/ui-foundation/contexts/LiveDataContext", () => ({
	useLiveDataSource: (_source: string) => undefined,
}));

const { render, cleanup } = await import("@testing-library/react");
const { Container } = await import("./Container.tsx");

// Puck's slot-render component: spreads what the Container hands it (style,
// className, as) onto the DOM element. Children are irrelevant here — the
// contract under test is what THIS element carries, not its subtree.
const Slot = (props: Record<string, unknown>) => {
	const { as: _as, ...rest } = props;
	return <div data-testid="container" {...rest} />;
};

afterEach(() => {
	cleanup();
});

function renderContainer(props: Record<string, unknown> = {}) {
	const { container } = render(<Container content={Slot} {...props} />);
	const el = container.querySelector('[data-testid="container"]') as HTMLElement;
	if (!el) throw new Error("container element not rendered");
	return {
		el,
		classes: () => (el.className || "").split(/\s+/).filter(Boolean),
		inline: () => el.getAttribute("style") || "",
	};
}

test("a row Container carries its layout via classes, not inline flex declarations", () => {
	const { classes, inline } = renderContainer({ direction: "row", wrap: false });
	expect(classes()).toContain("puck-container-row");
	// The collapse-capable properties: an inline copy would beat the
	// @container (max-width: 600px) collapse rule `.puck-container-row {
	// flex-direction: column }` and the row would never stack.
	expect(inline()).not.toContain("display");
	expect(inline()).not.toContain("flex-direction");
	expect(inline()).not.toContain("flex-wrap");
});

test("a wrapping row Container gets the wrap class, not an inline flex-wrap", () => {
	const { classes, inline } = renderContainer({ direction: "row", wrap: true });
	expect(classes()).toContain("puck-container-row");
	expect(classes()).toContain("puck-container-wrap");
	expect(inline()).not.toContain("flex-wrap");
});

test("a growing Container flexes via the grow class, not inline flex declarations", () => {
	const { classes, inline } = renderContainer({ direction: "row", grow: 1 });
	expect(classes()).toContain("puck-container-grow");
	// `.puck-container-row > * { flex: none }` under 600px must be able to
	// stop a child Container from growing — an inline flex-grow/flex-shrink/
	// flex-basis on that child wins the cascade and it keeps desktop sizing.
	expect(inline()).not.toContain("flex-grow");
	expect(inline()).not.toContain("flex-shrink");
	expect(inline()).not.toContain("flex-basis");
});

test("a grow:0 Container gets the fixed-size class, not inline flex declarations", () => {
	const { classes, inline } = renderContainer({ direction: "row", grow: 0 });
	expect(classes()).toContain("puck-container-fixed");
	expect(inline()).not.toContain("flex-grow");
	expect(inline()).not.toContain("flex-shrink");
	expect(inline()).not.toContain("flex-basis");
});

test("a grid Container declares its columns via a class, not inline grid-template-columns", () => {
	const { classes, inline } = renderContainer({ layout: "grid", columns: 2 });
	expect(classes()).toContain("puck-container-grid");
	expect(classes()).toContain("puck-container-cols-2");
	// `.puck-container-grid { grid-template-columns: 1fr }` under 600px must
	// collapse the grid to one column — an inline template wins instead.
	expect(inline()).not.toContain("grid-template-columns");
});

test("an auto-fill grid gets the fill class and its min column width rides a custom property", () => {
	const { classes, inline } = renderContainer({
		layout: "grid",
		gridFill: "auto-fill",
		minColWidth: "220px",
	});
	expect(classes()).toContain("puck-container-grid");
	expect(classes()).toContain("puck-container-grid-fill");
	expect(inline()).not.toContain("grid-template-columns");
	// A custom property is a VALUE channel, not a layout declaration — it
	// cannot beat the collapse rule, so it may stay inline.
	expect(inline()).toContain("--responsive-grid-min");
	expect(inline()).toContain("220px");
});

test("a fixed string width self-caps at the parent (min()) and carries no flex pin", async () => {
	// Asserted on the builder's output, not the DOM: happy-dom's CSS parser
	// silently drops min() math functions when React assigns them, so the
	// rendered style attribute cannot observe the value. The builder IS the
	// inline-emission surface under contract.
	const { buildContainerStyles } = await import("./Container.tsx");
	const style = buildContainerStyles({ direction: "row", width: "22px" });
	// The badge decision (orchestrator ruling 2026-08-18): a sized element
	// keeps its size when it fits, never overflows its parent when it does
	// not (min(<size>, 100%)), and NEVER pins itself against shrinking
	// (flex-shrink: 0 compounded the platform-wide overflow).
	expect(style.width).toBe("min(22px, 100%)");
	expect(style.flexShrink).toBeUndefined();
	expect(style.flexBasis).toBeUndefined();
	expect(style.flexGrow).toBeUndefined();
});

test("a numeric width self-caps at the parent too", async () => {
	const { buildContainerStyles } = await import("./Container.tsx");
	const style = buildContainerStyles({ direction: "row", width: 600 });
	expect(style.width).toBe("min(600px, 100%)");
	expect(style.flexShrink).toBeUndefined();
});

test("per-instance tuning with no collapse counterpart stays inline (gap, padding, align)", () => {
	const { inline } = renderContainer({ direction: "row", gap: "md", padding: "sm", align: "center" });
	// These have no @container rule that must override them, so inline is
	// the correct single home (layout-properties-inline, as amended).
	expect(inline()).toContain("row-gap");
	expect(inline()).toContain("column-gap");
	expect(inline()).toContain("padding");
	expect(inline()).toContain("align-items");
});

test("the stylesheet half of the seam: class rules and the collapse block exist", async () => {
	const css = await Bun.file(import.meta.dir + "/../styles.css").text();
	// A class name emitted with no rule behind it is a silent no-op. Each
	// class the builder emits must have a rule, and the collapse block must
	// still carry the declarations that made this seam necessary.
	expect(css).toContain(".puck-container-grow");
	expect(css).toContain(".puck-container-fixed");
	expect(css).toContain(".puck-container-wrap");
	expect(css).toContain(".puck-container-cols-2");
	expect(css).toContain(".puck-container-grid-fill");
	const collapseStart = css.indexOf("@container (max-width: 600px)");
	expect(collapseStart).toBeGreaterThan(0);
	const collapse = css.slice(collapseStart);
	expect(collapse).toContain("flex-direction: column");
	expect(collapse).toContain("grid-template-columns: 1fr");
});
