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

const { configure } = await import("@teamscala/ui-foundation/configure");
configure({
	requireConfigObject: ((slug: string) => {
		if (slug === "container-presets") {
			return {
				presetConfigs: {
					header: {
						direction: "row",
						justify: "between",
						align: "center",
						wrap: false,
						height: 0,
						padding: "none",
						minHeight: 0,
						mobileBehavior: "scroll",
						overflow: "auto",
						alignContent: "default",
					},
					banner: {
						direction: "column",
						justify: "center",
						align: "start",
						padding: "lg",
					},
				},
			};
		}
		throw new Error(`no test config object for ${slug}`);
	}) as never,
});

const { render, cleanup } = await import("@testing-library/react");
const { Container, buildContainerStyles, buildContainerClassName } = await import(
	"./container/Container.tsx"
);

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

test("the header preset is the one setting: thin bar, horizontal, between, centred", () => {
	const { classes, inline } = renderContainer({ preset: "header" });
	expect(classes()).toContain("puck-container-row");
	expect(classes()).toContain("puck-container-scroll-row");
	expect(inline()).toContain("justify-content: space-between");
	expect(inline()).toContain("align-items: center");
	expect(inline()).toContain("overflow: auto");
	expect(inline()).toContain("padding: var(--space-0)");
	expect(inline()).not.toContain("height");
});

test("preset values win: a conflicting authored prop cannot reintroduce a clip", () => {
	const { classes, inline } = renderContainer({
		preset: "header",
		direction: "column",
		justify: "start",
		align: "stretch",
		wrap: true,
		mobileBehavior: "stack",
		height: 52,
		minHeight: 48,
		padding: "md",
	});
	expect(classes()).toContain("puck-container-row");
	expect(classes()).toContain("puck-container-scroll-row");
	expect(classes()).not.toContain("puck-container-wrap");
	expect(inline()).toContain("justify-content: space-between");
	expect(inline()).toContain("align-items: center");
	expect(inline()).not.toContain("height");
	expect(inline()).toContain("padding: var(--space-0)");
});

test("a new preset is a row edit only: the same merge renders any other preset", () => {
	const { classes, inline } = renderContainer({ preset: "banner" });
	expect(classes()).toContain("puck-container-col");
	expect(inline()).toContain("justify-content: center");
	expect(inline()).toContain("align-items: flex-start");
	expect(inline()).not.toContain("padding: var(--space-0)");
});

test("without a preset the Container keeps its general knobs untouched", () => {
	const { classes, inline } = renderContainer({
		direction: "row",
		justify: "between",
		padding: "lg",
		height: 40,
	});
	expect(classes()).not.toContain("puck-container-scroll-row");
	expect(inline()).toContain("justify-content: space-between");
	expect(inline()).not.toContain("padding: var(--space-0)");
	expect(inline()).toContain("height: 40px");
});

test("both seams resolve the same preset through the same merge", () => {
	const style = buildContainerStyles({ preset: "header" });
	expect(style.justifyContent).toBe("space-between");
	expect(style.alignItems).toBe("center");
	expect(style.overflow).toBe("auto");
	expect(style.padding).toBe("var(--space-0)");
	expect(style.height).toBeUndefined();
	expect(style.minHeight).toBeUndefined();
	expect(style.alignContent).toBeUndefined();
	const classes = buildContainerClassName({ preset: "header" }).split(/\s+/);
	expect(classes).toContain("puck-container-row");
	expect(classes).toContain("puck-container-scroll-row");
	expect(classes).not.toContain("puck-container-col");
});
