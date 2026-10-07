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
if (!globalThis.document) GlobalRegistrator.register();

mock.module("@teamscala/ui-foundation/contexts/LiveDataContext", () => ({
	useLiveDataSource: (_source: string) => undefined,
}));

const { render, cleanup } = await import("@testing-library/react");
const { Container } = await import("./container/Container.tsx");

const Slot = (props: Record<string, unknown>) => {
	const { as: _as, ...rest } = props;
	return <div data-testid="container" {...rest} />;
};

afterEach(() => {
	cleanup();
});

function classesFor(props: Record<string, unknown>): string[] {
	const { container } = render(<Container content={Slot} {...props} />);
	const el = container.querySelector('[data-testid="container"]') as HTMLElement;
	if (!el) throw new Error("container element not rendered");
	return (el.className || "").split(/\s+/).filter(Boolean);
}

test("a page selects squeeze on the block, exactly like any other prop", () => {
	const classes = classesFor({ direction: "row", mobileBehavior: "squeeze" });
	expect(classes).toContain("puck-container-squeeze");
	expect(classes).toContain("puck-container-row");
});

test("the other mobile behaviours are unchanged", () => {
	expect(classesFor({ direction: "row", mobileBehavior: "keep-row" })).toContain(
		"puck-container-keep-row",
	);
	expect(classesFor({ direction: "row", mobileBehavior: "scroll" })).toContain(
		"puck-container-scroll-row",
	);
	// `stack` is the default collapse and carries no class of its own.
	expect(classesFor({ direction: "row", mobileBehavior: "stack" })).not.toContain(
		"puck-container-squeeze",
	);
});

test("an authored mobileBehavior wins over the htmlTag-driven scroll", () => {
	// The scroll was applied from `htmlTag` alone, so a page that had CHOSEN a
	// narrow-width behaviour got the scroll anyway and could not opt out from
	// the database — the composed page losing to a rule keyed on another prop.
	const squeezed = classesFor({
		direction: "row",
		htmlTag: "header",
		mobileBehavior: "squeeze",
	});
	expect(squeezed).toContain("puck-container-squeeze");
	expect(squeezed).not.toContain("puck-container-header-scroll");

	// A header that authored NO behaviour keeps the universal scroll default.
	const untouched = classesFor({ direction: "row", htmlTag: "header" });
	expect(untouched).toContain("puck-container-header-scroll");
});

test("the stylesheet backs the class, and no surface is special-cased", async () => {
	const css = await Bun.file(`${import.meta.dir}/styles.css`).text();
	// A class with no rule behind it is a silent no-op, not a fix.
	expect(css).toContain(".puck-container-squeeze.puck-container-row");
	expect(css).toContain(".puck-container-squeeze.puck-container-row > .puck-container-grow");

	// The behaviour must never again be keyed to one privileged surface. The
	// comment explaining the removal may name it; a SELECTOR may not.
	const selectors = css
		.split("\n")
		.filter((line) => !line.trimStart().startsWith("*") && !line.trimStart().startsWith("/*"));
	expect(selectors.join("\n")).not.toContain(".shell-header-slot");
});

test("squeeze fits rather than hiding overflow behind a scrollbar", async () => {
	const css = await Bun.file(`${import.meta.dir}/styles.css`).text();
	const start = css.indexOf(".puck-container-squeeze.puck-container-row {");
	expect(start).toBeGreaterThan(0);
	const body = css.slice(start, css.indexOf("}", start));
	expect(body).toContain("flex-direction: row");
	expect(body).toContain("overflow: visible");
	expect(body).not.toContain("overflow-x: auto");
});
