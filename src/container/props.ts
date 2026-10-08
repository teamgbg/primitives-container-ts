/**
 * @system container
 * @status handwritten
 */

import type { ComponentType, CSSProperties } from "react";

export interface ContainerProps {
	accentColor?: string;
	accentSide?: "all" | "top" | "bottom" | "left" | "right";
	accentWidth?: string;
	align?: "start" | "center" | "end" | "stretch";
	alignContent?: "default" | "start" | "center" | "end" | "between" | "around" | "evenly" | "stretch";
	anchor?: string;
	background?: "none" | "white" | "gray" | "subtle";
	backgroundBlur?: number;
	backgroundColor?: string;
	backgroundMotion?: "none" | "aurora" | "pulse" | "highway";
	border?: "none" | "subtle" | "bold";
	borderRadius?: string;
	columnGap?: "" | "none" | "xs" | "sm" | "md" | "lg" | "xl";
	columns?: number | string;
	columnWidths?: number[];
	dataSource?: string;
	direction?: "column" | "row" | "row-reverse" | "column-reverse";
	emphasis?: "full" | "strong" | "muted" | "subtle" | "faint" | "none";
	gap?: "none" | "xs" | "sm" | "md" | "lg" | "xl";
	gridFill?: "" | "auto-fill" | "auto-fit";
	grow?: number | string;
	height?: number;
	htmlTag?: "div" | "header" | "section" | "nav" | "main" | "footer" | "article" | "aside";
	justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
	layout?: "flex" | "grid";
	minColWidth?: string;
	minHeight?: number;
	mobileBehavior?: "stack" | "keep-row" | "scroll" | "squeeze";
	overflow?: "visible" | "hidden" | "auto";
	padding?: "none" | "xs" | "sm" | "md" | "lg" | "xl";
	position?: "relative" | "sticky" | "absolute" | "static";
	preset?: string;
	rounded?: "none" | "sm" | "md" | "lg";
	rowGap?: "" | "none" | "xs" | "sm" | "md" | "lg" | "xl";
	sectionType?: "none" | "body" | "appendix";
	shadow?: "none" | "sm" | "md" | "lg";
	tone?: "primary" | "accent" | "muted" | "destructive" | "success";
	visibleWhenPath?: string;
	width?: number | string;
	wrap?: boolean | string;
	zIndex?: number;
	content?: ComponentType<{
		style?: CSSProperties;
		className?: string;
		as?: string;
		id?: string;
	}>;
}
