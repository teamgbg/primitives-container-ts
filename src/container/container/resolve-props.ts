// @system container
// @status generated
// @edit change the block_schema Container row, then regenerate

import type { ContainerProps } from "./props.ts";
import { containerPresetConfigs } from "./container-presets-config.ts";

export const CONTAINER_DEFAULTS: ContainerProps = {
	align: "stretch",
	alignContent: "default",
	background: "none",
	backgroundBlur: 0,
	backgroundMotion: "none",
	border: "none",
	columns: 2,
	direction: "column",
	gap: "md",
	height: 0,
	htmlTag: "div",
	justify: "start",
	layout: "flex",
	minColWidth: "280px",
	minHeight: 0,
	mobileBehavior: "stack",
	overflow: "visible",
	padding: "md",
	position: "static",
	rounded: "none",
	sectionType: "none",
	shadow: "none",
	wrap: false,
};

export function resolveContainerProps(props: ContainerProps): ContainerProps {
	const presetValues = props.preset
		? containerPresetConfigs()[props.preset]
		: undefined;
	return { ...CONTAINER_DEFAULTS, ...props, ...presetValues };
}
