/**
 * @system container
 * @status handwritten
 */

import { useLiveDataSource } from "@teamscala/ui-foundation/contexts/LiveDataContext";
import { getLivePath } from "@teamscala/ui-foundation/text/get-live-path";
import { buildStyle } from "@teamscala/ui-foundation/styling-vocabulary/build-style";
import {
	alignContentValues,
	alignValues,
	backgroundValues,
	gapValues,
	justifyValues,
} from "@teamscala/ui-foundation/styling-vocabulary/values";
import type { CSSProperties } from "react";
import type { ContainerProps } from "./props.ts";
import { resolveContainerProps } from "./resolve-props.ts";

export function buildColumnWidthsTracks(props: ContainerProps): string | null {
	const { layout, columns, gridFill, columnWidths } = resolveContainerProps(props);
	if (layout !== "grid") return null;
	if (gridFill === "auto-fill" || gridFill === "auto-fit") return null;
	const colNum = Math.min(12, Math.max(1, Number(columns) || 2));
	const given = (Array.isArray(columnWidths) ? columnWidths : [])
		.filter(
			(value): value is number =>
				typeof value === "number" && Number.isFinite(value) && value > 0,
		)
		.slice(0, colNum);
	if (given.length === 0) return null;
	const missing = colNum - given.length;
	const tracks = [...given];
	if (missing > 0) {
		const remainder = Math.max(
			0,
			100 - given.reduce((sum, value) => sum + value, 0),
		);
		const share = remainder / missing;
		for (let index = 0; index < missing; index += 1) tracks.push(share);
	}
	return tracks
		.map((value) => `minmax(0, ${Math.round(value * 100) / 100}fr)`)
		.join(" ");
}

export function buildContainerStyles(props: ContainerProps): CSSProperties {
	const {
		layout,
		align,
		justify,
		alignContent,
		gap,
		rowGap,
		columnGap,
		padding,
		wrap,
		width,
		height,
		minHeight,
		overflow,
		background,
		backgroundColor: customBg,
		backgroundBlur,
		position,
		zIndex,
		border,
		accentSide,
		accentColor,
		accentWidth,
		rounded,
		borderRadius: customRadius,
		shadow,
		emphasis,
		tone,
		gridFill,
		minColWidth,
	} = resolveContainerProps(props);

	const isWrap = wrap === true || wrap === "true";
	const isGrid = layout === "grid";

	const isGridFill = gridFill === "auto-fill" || gridFill === "auto-fit";

	const columnWidthsTracks = buildColumnWidthsTracks(props);

	const style: CSSProperties = {
		maxWidth: "100%",
		boxSizing: "border-box" as const,
		...(overflow && overflow !== "visible" ? { overflow } : {}),
		rowGap: gapValues[rowGap ?? gap],
		columnGap: gapValues[columnGap ?? gap],
		...buildStyle({
			padding,
			radius: rounded,
			shadow,
			emphasis,
			tone,
		}),

		...(!isGrid
			? {
					alignItems: alignValues[align] || "stretch",
					justifyContent: justifyValues[justify] || "flex-start",
					...(isWrap && alignContentValues[alignContent]
						? { alignContent: alignContentValues[alignContent] }
						: {}),
				}
			: {}),

		...(isGrid && isGridFill && minColWidth !== "280px"
			? ({ "--responsive-grid-min": minColWidth } as CSSProperties)
			: {}),

		...(columnWidthsTracks
			? ({ "--puck-col-widths": columnWidthsTracks } as CSSProperties)
			: {}),

		...(customBg
			? { backgroundColor: customBg }
			: backgroundValues[background]
				? { backgroundColor: backgroundValues[background] }
				: {}),
		...(typeof backgroundBlur === "number" && backgroundBlur > 0
			? {
					backdropFilter: `blur(${backgroundBlur}px)`,
					WebkitBackdropFilter: `blur(${backgroundBlur}px)`,
				}
			: {}),
		...(border !== "none" && accentSide && accentSide !== "all"
			? {
					[accentSide === "top"
						? "borderTop"
						: accentSide === "bottom"
							? "borderBottom"
							: accentSide === "left"
								? "borderLeft"
								: "borderRight"]: `${
						accentWidth ||
						(border === "bold"
							? "var(--border-width-thick)"
							: "var(--border-width-default)")
					} solid ${accentColor || "var(--block-tone, var(--color-border))"}`,
				}
			: {}),
		...(border === "subtle" && (!accentSide || accentSide === "all")
			? {
					border: `${accentWidth || "var(--border-width-default)"} solid ${
						accentColor || "var(--block-tone, var(--color-border))"
					}`,
				}
			: {}),
		...(border === "bold" && (!accentSide || accentSide === "all")
			? {
					border: `${accentWidth || "var(--border-width-thick)"} solid ${
						accentColor || "var(--block-tone, var(--color-border))"
					}`,
				}
			: {}),
		...(customRadius
			? { borderRadius: customRadius }
			: {}),
		...(typeof width === "number" && width > 0 ? { width: `min(${width}px, 100%)` } : {}),
		...(typeof width === "string" && width.trim() && width !== "page"
			? { width: `min(${width.trim()}, 100%)` }
			: {}),
		...(width === "page"
			? {
					maxWidth: "80rem",
					marginLeft: "auto",
					marginRight: "auto",
					width: "100%",
				}
			: {}),
		...(typeof height === "number" && height > 0
			? { height: `${height}px` }
			: {}),
		...(typeof minHeight === "number" && minHeight > 0
			? { minHeight: `${minHeight}px` }
			: {}),

		...(position !== "static"
			? {
					position,
					top: position === "sticky" ? 0 : undefined,
					left:
						position === "sticky" || position === "absolute" ? 0 : undefined,
					right:
						position === "sticky" || position === "absolute" ? 0 : undefined,
				}
			: {}),
		...(typeof zIndex === "number" ? { zIndex } : {}),
	};

	return style;
}

export function buildContainerClassName(props: ContainerProps): string {
	const {
		sectionType,
		layout,
		columns,
		direction,
		wrap,
		grow,
		gridFill,
		mobileBehavior,
		backgroundMotion,
		htmlTag,
	} = resolveContainerProps(props);

	const isWrap = wrap === true || wrap === "true";
	const isGrid = layout === "grid";
	const isRow = direction === "row" || direction === "row-reverse";

	const sectionClass =
		sectionType && sectionType !== "none" ? "gui-container-document-page" : "";

	if (isGrid) {
		const colNum = typeof columns === "string" ? Number(columns) : columns;
		const colsClass = `puck-container-cols-${Math.min(12, Math.max(1, colNum || 2))}`;
		const fillClass =
			gridFill === "auto-fill"
				? "puck-container-grid-fill"
				: gridFill === "auto-fit"
					? "puck-container-grid-fit"
					: "";
		return [
			"puck-container-grid",
			colsClass,
			fillClass,
			buildColumnWidthsTracks(props) ? "puck-container-custom-widths" : "",
			backgroundMotion && backgroundMotion !== "none"
				? `puck-container-motion puck-container-motion-${backgroundMotion}`
				: "",
			sectionClass,
		]
			.filter(Boolean)
			.join(" ");
	}

	const growNum = typeof grow === "string" ? Number(grow) : grow;
	const growClass = growNum === 0 ? "puck-container-fixed" : "puck-container-grow";

	const mobileClass =
		mobileBehavior === "keep-row"
			? "puck-container-keep-row"
			: mobileBehavior === "scroll"
				? "puck-container-scroll-row"
				: mobileBehavior === "squeeze"
					? "puck-container-squeeze"
					: "";

	const headerScrollClass =
		isRow && htmlTag === "header" && !mobileClass ? "puck-container-header-scroll" : "";

	const motionClass =
		backgroundMotion && backgroundMotion !== "none"
			? `puck-container-motion puck-container-motion-${backgroundMotion}`
			: "";

	return [
		isRow ? "puck-container-row" : "puck-container-col",
		...(isWrap ? ["puck-container-wrap"] : []),
		growClass,
		mobileClass,
		headerScrollClass,
		motionClass,
		sectionClass,
	]
		.filter(Boolean)
		.join(" ");
}

export function Container(props: ContainerProps) {
	const {
		sectionType = "none",
		layout = "flex",
		direction = "column",
		gap = "md",
		wrap = false,
		mobileBehavior = "stack",
		htmlTag = "div",
		anchor,
		content: Content,
		visibleWhenPath,
		dataSource = "none",
	} = props;

	const visibilitySnapshot = useLiveDataSource(dataSource);
	const gatedAway =
		!!visibleWhenPath &&
		visibilitySnapshot != null &&
		(() => {
			const value = getLivePath(visibilitySnapshot, visibleWhenPath);
			return value == null || (typeof value === "string" && !value.trim());
		})();
	if (!Content) return null;
	if (gatedAway) return null;

	const style = buildContainerStyles(props);

	const className = buildContainerClassName(props);

	const tag = htmlTag && htmlTag !== "div" ? htmlTag : undefined;

	const trimmedAnchor = anchor?.trim();

	const container = (
		<Content
			style={style}
			className={className}
			{...(tag ? { as: tag } : {})}
		/>
	);

	if (!trimmedAnchor) return container;
	return (
		<div id={trimmedAnchor} style={{ scrollMarginTop: "4.5rem" }}>
			{container}
		</div>
	);
}

export default Container;
