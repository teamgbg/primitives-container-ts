/**
 * @system container
 * @status handwritten
 */

import { requireConfigObject } from "@teamscala/ui-foundation/configure";
import { createCache } from "@teamscala/cache/create-cache";
import type { ContainerProps } from "./props.ts";

interface ContainerPresetsConfig {
	presetConfigs: Record<string, Partial<ContainerProps>>;
}

const containerPresetsCache = createCache<ContainerPresetsConfig>(
	"generic-ui:container-presets",
	{ ttlMs: Number.POSITIVE_INFINITY, maxSize: 1 },
);

export function containerPresetConfigs(): Record<string, Partial<ContainerProps>> {
	const hit = containerPresetsCache.get("default");
	if (hit) return hit.presetConfigs;
	const config = requireConfigObject<ContainerPresetsConfig>("container-presets");
	containerPresetsCache.set("default", config);
	return config.presetConfigs;
}
