/**
 * @status generated — ts_function_contract_runner template (scala-test-suites
 * templates/ts_function_contract_runner.pkl @1.14.0) over @teamscala/container's
 * test_vector rows: one `it` per function_call row (args -> value or
 * expect_error) and one per fs_flow row (ordered steps in a temp
 * workspace). This runner carries NO facts: every case is the registry
 * row projected into ./container-contract-rows.json. Regenerate through the consumer's
 * test-vector-rows projection row (scala-tools codegen run --repo
 * <consumer>); hand edits are overwritten.
 */
function arithmetic(source: string, value: unknown, slug: string): number {
	let pos = 0;
	const text = source;
	const fail: (why: string) => never = (why) => { throw new Error("row " + slug + " is malformed: member_equals_expression " + JSON.stringify(source) + " — " + why); };
	const skip = (): void => { while (pos < text.length && text[pos] === " ") pos++; };
	const eat = (ch: string): void => { skip(); if (text[pos] !== ch) fail("expected " + JSON.stringify(ch) + " at offset " + pos); pos++; };
	const number = (): number => {
		skip();
		const start = pos;
		while (pos < text.length && /[0-9.]/.test(text[pos])) pos++;
		if (start === pos) fail("expected a number at offset " + start);
		const got = Number(text.slice(start, pos));
		if (Number.isNaN(got)) fail(JSON.stringify(text.slice(start, pos)) + " is not a number");
		return got;
	};
	const identifier = (): string => {
		skip();
		const start = pos;
		while (pos < text.length && /[A-Za-z0-9_@.]/.test(text[pos])) pos++;
		if (start === pos) fail("expected a name at offset " + start);
		return text.slice(start, pos);
	};
	const primary = (): number => {
		skip();
		if (text[pos] === "(") { pos++; const inner = expression(); eat(")"); return inner; }
		if (text[pos] === "-") { pos++; return -primary(); }
		if (text[pos] === "+") { pos++; return primary(); }
		if (/[0-9.]/.test(text[pos] ?? "")) return number();
		const name = identifier();
		if (name === "round" || name === "abs") {
			eat("(");
			const first = expression();
			let digits = 0;
			skip();
			if (text[pos] === ",") { pos++; digits = number(); }
			eat(")");
			if (name === "abs") return Math.abs(first);
			const factor = Math.pow(10, digits);
			return Math.round(first * factor) / factor;
		}
		if (name.startsWith("@")) {
			const got = memberAt(value, name.slice(1));
			if (typeof got !== "number") fail("@" + name.slice(1) + " is " + (got === undefined ? "absent from what the call returned" : typeof got) + ", and the formula reads it as a number");
			return got;
		}
		return fail(name + " is not @member, a number, round or abs — the formula grammar is arithmetic over the returned members, nothing else");
	};
	const factor = (): number => {
		let left = primary();
		for (;;) {
			skip();
			const op = text[pos];
			if (op !== "*" && op !== "/") return left;
			pos++;
			const right = primary();
			if (op === "/" && right === 0) fail("divides by zero — a formula that cannot be evaluated is not a relation");
			left = op === "*" ? left * right : left / right;
		}
	};
	const term = (): number => {
		let left = factor();
		for (;;) {
			skip();
			const op = text[pos];
			if (op !== "+" && op !== "-") return left;
			pos++;
			left = op === "+" ? left + factor() : left - factor();
		}
	};
	function expression(): number { return term(); }
	const answer = expression();
	skip();
	if (pos !== text.length) fail("trailing input at offset " + pos);
	return answer;
}
import { describe, expect, it, mock } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import projected from "./container-contract-rows.json";

const ROWS = (projected.rows ?? projected) as Vector[];

const SELF = import.meta.path;
const SELECTED = process.env.SCALA_CONTRACT_ROW;

if (!Array.isArray(ROWS)) {
	throw new Error("./container-contract-rows.json must project an array of rows — the runner executes registry rows, never a hand-written case list");
}

const PKG: string = "@teamscala/container";

const ROOT = (() => {
	let dir = import.meta.dir;
	for (let depth = 0; depth < 8; depth++) {
		if (existsSync(join(dir, "package.json"))) return dir;
		dir = join(dir, "..");
	}
	throw new Error("no package.json above " + import.meta.dir + " — a contract suite renders inside a package");
})();

type Vector = Record<string, unknown> & { suite_type: string; slug: string };

let ACTIVE_RECORDERS: Record<string, { args: unknown[] }[]> = {};
function declareRecorder(name: string): void {
	(ACTIVE_RECORDERS[name] ??= []);
}
function recordCall(name: string, args: unknown[]): void {
		(ACTIVE_RECORDERS[name] ??= []).push({ args });
}
let ACTIVE_HOOK: { value: unknown } | null = null;

async function decodeValue(value: unknown): Promise<unknown> {
	if (value === null) return undefined;
	if (typeof value === "object" && value !== null && "$null" in (value as object)) {
		return null;
	}
	if (value !== null && typeof value === "object" && "$error" in (value as object)) {
		const spec = (value as { $error: { class: string; module?: string; args?: unknown[] } }).$error;
		const ctor = spec.module
			? ((await import(spec.module)) as Record<string, unknown>)[spec.class]
			: (globalThis as Record<string, unknown>)[spec.class];
		if (typeof ctor !== "function") throw new Error("unconstructible error class: " + spec.class);
		return new ctor(...(spec.args ?? []));
	}
	if (value !== null && typeof value === "object" && "$abort" in (value as object)) {
		const spec = (value as { $abort: { afterMs?: unknown } }).$abort;
		if (spec === null || typeof spec !== "object" || typeof spec.afterMs !== "number" || !(spec.afterMs >= 0)) throw new Error("$abort needs {afterMs} — a non-negative number of milliseconds before the signal fires");
		const controller = new AbortController();
		setTimeout(() => controller.abort(), spec.afterMs);
		return controller.signal;
	}
	if (typeof value === "object" && "$date" in (value as object)) {
		const instant = new Date(String((value as { $date: unknown }).$date));
		if (Number.isNaN(instant.getTime())) throw new Error("$date " + JSON.stringify((value as { $date: unknown }).$date) + " is not an instant this runtime can read");
		return instant;
	}
	if (typeof value === "object" && value !== null && "$import" in (value as object)) {
		const spec = (value as { $import: { module?: string; export?: string } }).$import;
		if (spec === null || typeof spec !== "object" || typeof spec.module !== "string" || typeof spec.export !== "string") throw new Error("$import needs {module, export} — a value a row can only NAME is named by the module it lives in and the export it is called");
		const mod = (await import(spec.module.includes("/") ? join(ROOT, spec.module) : spec.module)) as Record<string, unknown>;
		if (!(spec.export in mod)) throw new Error("no export " + spec.export + " in " + spec.module + " — $import named a value that module does not carry");
		return mod[spec.export];
	}
		if (typeof value === "object" && value !== null && "$map" in (value as object)) {
			const spec = (value as { $map: { entries?: unknown[] } }).$map;
			if (spec === null || typeof spec !== "object" || (spec.entries !== undefined && !Array.isArray(spec.entries))) throw new Error("$map needs {entries?} — an array of [key, value] pairs, or nothing for the empty map a subject is handed when it has nothing to say");
			const pairs: unknown[][] = [];
			for (const [i, entry] of ((spec.entries ?? []) as unknown[]).entries()) {
				if (!Array.isArray(entry) || entry.length !== 2) throw new Error("$map entry " + i + " is " + JSON.stringify(entry) + " — a map entry is a [key, value] pair, and a pair of another length is a typo, not a value");
				pairs.push([await decodeValue(entry[0]), await decodeValue(entry[1])]);
			}
			return new Map(pairs);
		}
		if (typeof value === "object" && value !== null && "$set" in (value as object)) {
			const spec = (value as { $set: { members?: unknown[] } }).$set;
			if (spec === null || typeof spec !== "object" || (spec.members !== undefined && !Array.isArray(spec.members))) throw new Error("$set needs {members?} — the values a subject's Set already holds, or nothing for the Set it is handed when it has seen nothing");
			return new Set(await Promise.all(((spec.members ?? []) as unknown[]).map(decodeValue)));
		}
		if (typeof value === "object" && value !== null && "$call" in (value as object)) {
			const spec = (value as { $call: { module?: string; export?: string; args?: unknown[] } }).$call;
			if (spec === null || typeof spec !== "object" || typeof spec.module !== "string" || typeof spec.export !== "string" || (spec.args !== undefined && !Array.isArray(spec.args))) throw new Error("$call needs {module, export, args?} — the value an export returns when the row calls it with the row's own args");
			const mod = (await import(spec.module.includes("/") ? join(ROOT, spec.module) : spec.module)) as Record<string, unknown>;
			const callee = mod[spec.export];
			if (typeof callee !== "function") throw new Error("$call names " + spec.export + " in " + spec.module + ", which that module does not export as a callable — a derived value is what calling it RETURNS");
			const callArgs = await Promise.all(((spec.args ?? []) as unknown[]).map(decodeValue));
			return await (callee as (...a: unknown[]) => unknown)(...callArgs);
		}
	if (typeof value === "object" && "$proxy" in (value as object)) {
		const pspec = (value as { $proxy: { records?: string; terminals?: Record<string, unknown> } }).$proxy;
		if (pspec === null || typeof pspec !== "object") throw new Error("$proxy needs {records?, terminals?} — a chain fake without terminals never returns data, and one without records cannot be asserted");
		if (pspec.records !== undefined) declareRecorder(String(pspec.records));
		const terminals: Record<string, unknown> = {};
		for (const [name, payload] of Object.entries(pspec.terminals ?? {})) {
			terminals[name] = decodeStubReturn(payload);
		}
		const self: unknown = new Proxy(function () { return self; } as (...args: unknown[]) => unknown, {
			get(_target, prop) {
				if (typeof prop === "symbol") return undefined;
				if (prop in terminals) {
						const terminal = terminals[prop];
						return (...callArgs: unknown[]) => {
							if (pspec.records !== undefined) recordCall(String(pspec.records), [{ field: String(prop), args: callArgs }]);
							return terminal;
						};
				}
				return (...callArgs: unknown[]) => {
						if (pspec.records !== undefined) recordCall(String(pspec.records), [{ field: String(prop), args: callArgs }]);
						return self;
				};
			},
		});
		return self;
	}
	if (typeof value === "object" && "$fn" in (value as object)) {
		const spec = (value as { $fn: { returns?: unknown; throws?: unknown; returns_by_call?: unknown[]; records?: string; respond?: Vector[]; calls_arg?: boolean; calls_hook?: unknown; hook_args?: unknown[]; arg?: unknown; record_return?: boolean } }).$fn;
		if (spec.calls_hook !== undefined) {
			if (typeof spec.calls_hook !== "string" || spec.calls_hook.length === 0) throw new Error("$fn calls_hook needs the name of the callback the subject returns — a callback that reaches back into the subject is driven by naming the member it calls");
			const member = String(spec.calls_hook);
			const driven = ((spec.hook_args ?? []) as unknown[]).map((entry) => decodeValue(entry));
			return async (...callArgs: unknown[]) => {
				if (spec.records !== undefined) recordCall(String(spec.records), callArgs);
				const held = ACTIVE_HOOK;
				if (held === null || held.value === null || typeof held.value !== "object") throw new Error("$fn calls_hook names " + member + " but the row drives no hook — a callback that reaches back into the subject only exists while the subject is mounted");
				const fn = (held.value as Record<string, unknown>)[member];
				if (typeof fn !== "function") throw new Error("$fn calls_hook names " + member + ", which the subject does not return as a callable — a member the return does not carry cannot be driven");
				return (fn as (...a: unknown[]) => unknown)(...(await Promise.all(driven)));
			};
		}
		if (spec.calls_arg === true) {
			const handed = spec.arg === undefined ? undefined : await decodeValue(spec.arg);
			return async (...callArgs: unknown[]) => {
				if (spec.records !== undefined) recordCall(String(spec.records), callArgs);
				const callback = callArgs[0];
				if (typeof callback !== "function") throw new Error("$fn declares calls_arg but was handed " + (callback === undefined ? "nothing" : typeof callback) + " where the callback goes — a transaction that runs no callback runs no work");
				const answer = await (callback as (unit: unknown) => unknown)(handed);
				if (spec.records !== undefined && spec.record_return === true) recordCall(String(spec.records), [{ args: callArgs, returned: answer }]);
				return answer;
			};
		}
		if (spec.records !== undefined) declareRecorder(String(spec.records));
		const arms = Array.isArray(spec.respond) ? (spec.respond as Vector[]) : [];
		if (Array.isArray(spec.returns_by_call)) {
			const sequence = (spec.returns_by_call as unknown[]).map((entry) => decodeStubReturn(entry));
			if (sequence.length === 0) throw new Error("$fn declares an empty returns_by_call — a sequence with no answers is a collaborator that can never be called");
			let seen = 0;
			return async (...callArgs: unknown[]) => {
				if (spec.records !== undefined) recordCall(String(spec.records), callArgs);
				const index = Math.min(seen, (sequence as unknown[]).length - 1);
				seen++;
				const answer = (sequence as unknown[])[index] as { $throws?: unknown };
				if (answer !== null && typeof answer === "object" && "$throws" in answer) throw new Error(String(answer.$throws));
				return await answer;
			};
		}
		if (arms.length > 0 && spec.returns === undefined) {
			throw new Error("$fn declares a respond list with no fallback returns — every call no arm shapes is a call the row never answered for");
		}
		if (spec.returns !== undefined) {
			const answer = decodeStubReturn(spec.returns);
			const raisedSpec = spec.throws === undefined ? undefined : await decodeValue(spec.throws);
			return (...callArgs: unknown[]) => {
				if (spec.records !== undefined) recordCall(String(spec.records), callArgs);
				for (const arm of arms) {
					const needle = arm.args_contains === undefined ? undefined : String(arm.args_contains);
					if (needle === undefined || JSON.stringify(callArgs).includes(needle)) {
						if (arm.throws !== undefined) throw arm.throws;
						return arm.returns;
					}
				}
				if (arms.length > 0) {
					throw new Error("$fn recorded arm no answer matches the call " + JSON.stringify(callArgs).slice(0, 120) + " — declared shapes: " + arms.map((arm) => JSON.stringify(arm.args_contains)).join(", "));
				}
				if (raisedSpec !== undefined) throw raisedSpec;
				return answer;
			};
		}
		if (spec.throws !== undefined) {
			const raised = await decodeValue(spec.throws);
			return (...callArgs: unknown[]) => {
				if (spec.records !== undefined) recordCall(String(spec.records), callArgs);
				throw raised;
				};
		}
		throw new Error("$fn declares neither returns nor throws — a function whose behaviour is undeclared is a case the runner cannot run");
	}
	if (Array.isArray(value)) return "raw" in (value as object) ? value : await Promise.all(value.map(decodeValue));
	if (typeof value === "object") {
		if (Array.isArray(value)) return value;
		const walked: Record<string, unknown> = {};
		for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
			walked[key] = await decodeValue(inner);
		}
		return walked;
	}
	return value;
}

async function loadExport(modulePath: string, exportName: string): Promise<unknown> {
	const specifier = modulePath.includes("/") ? join(ROOT, modulePath) : modulePath;
	const mod = (await import(specifier)) as Record<string, unknown>;
	if (!(exportName in mod)) throw new Error("no export " + exportName + " in " + modulePath);
	return mod[exportName];
}

async function callExport(modulePath: string, exportName: string, decodedArgs: unknown[]): Promise<unknown> {
	const fn = await loadExport(modulePath, exportName);
	if (typeof fn !== "function") throw new Error("export " + exportName + " in " + modulePath + " is not a function — a row that wants its shape declares expect.export_shape");
	return await fn(...decodedArgs);
}

const TEMPLATE_SPELLING = "template";
function isTemplate(spec: unknown): boolean {
	return spec !== null && typeof spec === "object" && TEMPLATE_SPELLING in (spec as object);
}
function templateStrings(parts: string[]): TemplateStringsArray {
	const out = parts.slice() as string[] & { raw: readonly string[] };
	Object.defineProperty(out, "raw", { value: parts, enumerable: false, writable: false });
	return Object.freeze(out) as unknown as TemplateStringsArray;
}
function decodeTemplate(slug: string, spec: Record<string, unknown>): unknown[] {
	const parts = spec[TEMPLATE_SPELLING];
	if (!Array.isArray(parts) || parts.some((part) => typeof part !== "string")) throw new Error("row " + slug + " is malformed: template is the ordered array of STATIC string parts between the interpolations — a tagged template's literals, never the statement with the value spliced in");
	const values = spec.values === undefined || spec.values === null ? [] : spec.values;
	if (!Array.isArray(values)) throw new Error("row " + slug + " is malformed: template values is the positional array of interpolated values, got " + typeof values);
	if (values.length !== parts.length - 1) throw new Error("row " + slug + " is malformed: template declares " + values.length + " values for " + parts.length + " string parts — a tagged template has exactly one interpolation per gap, so values.length must be parts.length - 1");
	return [templateStrings(parts as string[]), ...(values as unknown[])];
}

function applyEnv(env?: Record<string, string>): () => void {
	const before: Record<string, string | undefined> = {};
	for (const [key, value] of Object.entries(env ?? {})) {
		before[key] = process.env[key];
		process.env[key] = value;
	}
	return () => {
		for (const [key, value] of Object.entries(before)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	};
}

function assertWellFormed(row: Vector): void {
	const bad: (msg: string) => never = (msg) => {
		throw new Error("row " + row.slug + " is malformed: " + msg);
	};
	if (PKG !== "*" && row.package !== PKG) bad("package " + JSON.stringify(row.package) + " — expected " + JSON.stringify(PKG));
	if (row.suite_type === "function_call") {
		if (typeof row.export !== "string" || row.export.length === 0) bad("export must be a non-empty string");
		if (row.args === null || row.env === null) bad("args and env must be arrays/objects, never null — null and an absent key are different states");
		if (row.args !== undefined && !Array.isArray(row.args)) bad("args must be a positional array (ruling 18:02 #1)");
		if (row.args === undefined && row.template === undefined) bad("declares neither args nor template — a call needs its arguments, and an absent args and an empty one are different states");
		if (row.expect !== undefined && row.expect_error !== undefined) bad("declares both expect and expect_error — the arms are XOR");
		if (row.expect_throw !== undefined && (row.expect !== undefined || row.expect_error !== undefined)) bad("declares expect_throw beside expect or expect_error — the arms are XOR: a throw is either synchronous (expect_throw) or awaited (expect_error), and one call cannot be both");
		if (row.expect_void !== undefined) {
			if (row.expect_void !== true) bad("expect_void must be true — it is the VOID claim (the call returns nothing), and false would assert a value the row never spells");
			if (row.expect !== undefined || row.expect_error !== undefined) bad("declares expect_void beside expect or expect_error — the arms are XOR: a void subject returns nothing, so there is no value to compare and no error to match");
		} else if (row.expect === undefined && row.expect_error === undefined && row.expect_throw === undefined && !hasThen(row) && !hasCallEach(row) && row.then_return === undefined) bad("declares neither expect nor expect_error nor expect_void nor expect_throw, and no then, then_call_each or then_return steps — a row that asserts nothing asserts nothing");
		if (row.args === null || row.env === null) bad("args and env must be arrays/objects, never null");
		assertOneAxis("row " + row.slug, row.expect, row.args as unknown[] | undefined, row.expect_error);
	} else if (row.suite_type === "fs_flow") {
		if (!Array.isArray(row.steps) || (row.steps as unknown[]).length === 0) bad("fs_flow needs non-empty ordered steps");
		for (let i = 0; i < (row.steps as unknown[]).length; i++) {
			const step = (row.steps as Record<string, unknown>[])[i];
			if (typeof step.call !== "string" || step.call.length === 0) bad("steps[" + i + "].call must be a non-empty string");
			if (step.args === null) bad("steps[" + i + "].args must be a positional array, never null — null and an absent key are different states");
			if (step.args !== undefined && !Array.isArray(step.args)) bad("steps[" + i + "].args must be a positional array");
			if (step.expect === undefined && step.expect_error === undefined && step.expect_void === undefined) bad("steps[" + i + "] asserts nothing");
			if (step.expect_void !== undefined) {
				if (step.expect_void !== true) bad("steps[" + i + "].expect_void must be true — it is the VOID claim, and false would assert a value the row never spells");
				if (step.expect !== undefined || step.expect_error !== undefined) bad("steps[" + i + "] declares expect_void beside a value arm — the arms are XOR");
			}
			assertOneAxis("steps[" + i + "] of row " + row.slug, step.expect, step.args as unknown[] | undefined, step.expect_error);
		}
	} else {
		bad("unknown suite_type " + JSON.stringify(row.suite_type));
	}
}

async function runThen(slug: string, returned: unknown, steps: Vector[]): Promise<void> {
	if (!Array.isArray(steps)) throw new Error("row " + slug + " is malformed: then is an ordered array of {call, args?, expect?, expect_error?} steps");
	for (const step of steps) {
		if (step === null || typeof step !== "object" || typeof step.call !== "string" || step.call.length === 0) throw new Error("row " + slug + " is malformed: a then step names no call");
		const parts = String(step.call).split(".");
		let target: unknown = returned;
		for (const part of parts) {
			if (target === null || target === undefined) throw new Error("row " + slug + " calls " + step.call + " but the value it walks is " + String(target));
			target = (target as Record<string, unknown>)[part];
		}
		if (typeof target !== "function") throw new Error("row " + slug + " calls " + step.call + " and it is " + (target === undefined ? "absent from what the call returned" : typeof target) + " — a member the return does not carry cannot be a contract");
		const stepArgs = step.args === undefined || step.args === null ? [] : step.args;
		if (!Array.isArray(stepArgs)) throw new Error("row " + slug + " is malformed: then step " + step.call + " args is a positional array");
		if (step.args !== undefined && step.template !== undefined) throw new Error("row " + slug + " then step " + step.call + " declares both args and template — two ways to say the same call is a row whose intent is unreadable");
		if (step.args === undefined && step.template === undefined) throw new Error("row " + slug + " then step " + step.call + " declares neither args nor template — a member call needs its arguments");
		const effectiveArgs = step.template !== undefined && step.template !== null ? decodeTemplate(slug, step.template as Record<string, unknown>) : (stepArgs as unknown[]);
		const called = target(...(await Promise.all(effectiveArgs.map(decodeValue))));
		if (step.expect_error !== undefined) {
			await expect(Promise.resolve(called)).rejects.toThrow(String(step.expect_error));
			continue;
		}
		const answer = await called;
		if (step.expect === undefined) continue;
		if (isStructural(step.expect)) assertStructural(slug, answer, step.expect as Record<string, unknown>);
		else if (isStructural(step.expect) && (step.expect as Record<string, unknown>)[UNDEFINED_SPELLING] === true) expect(answer).toBeUndefined();
		else expect(answer).toEqual(step.expect);
	}
}

async function expectCall(row: Vector, exportName: string, args: unknown[]): Promise<void> {
	const restore = applyEnv(row.env);
	try {
		await withStubs(row, async () => {
			if (row.hoist !== undefined && row.hoist !== null) {
				if (!Array.isArray(row.hoist)) throw new Error("row " + row.slug + " is malformed: hoist is an ordered array of call steps, got " + typeof row.hoist);
				for (const step of row.hoist as Vector[]) {
					if (step === null || typeof step !== "object" || typeof step.export !== "string" || step.export.length === 0) throw new Error("row " + row.slug + " is malformed: a hoist step names no export — each step is {export, args?, module?}");
					const stepArgs = step.args === undefined || step.args === null ? [] : step.args;
					if (!Array.isArray(stepArgs)) throw new Error("row " + row.slug + " is malformed: hoist step " + step.export + " args is a positional array, got " + typeof stepArgs);
					await callExport(String(step.module ?? row.module), String(step.export), await Promise.all((stepArgs as unknown[]).map(decodeValue)));
				}
			}
			if (row.expect_void === true) {
				expect(await callExport(row.module, exportName, await Promise.all(args.map(decodeValue)))).toBeUndefined();
			} else if (isExportShape(row.expect)) {
				assertStructural(row.slug, await loadExport(row.module, exportName), (row.expect as Record<string, unknown>)[EXPORT_SHAPE] as Record<string, unknown>);
			} else if (row.expect_error === undefined && row.expect_throw === undefined) {
				const decoded = await Promise.all(args.map(decodeValue));
				if (isStructural(row.expect) && (row.expect as Record<string, unknown>)[ARG_SHAPE] !== undefined) argTarget(row.slug, row.expect as Record<string, unknown>, decoded);
				const value = await callExport(row.module, exportName, decoded);
				if (row.then !== undefined && row.then !== null) await runThen(row.slug, value, row.then as Vector[]);
				if (row.then_call_each !== undefined && row.then_call_each !== null) await callEach(row.slug, value, row.then_call_each as Vector[]);
				if (row.then_return !== undefined && row.then_return !== null) await callReturned(row.slug, value, row.then_return as Vector);
				if (isStructural(row.expect) && UNDEFINED_SPELLING in (row.expect as Record<string, unknown>)) {
					if ((row.expect as Record<string, unknown>)[UNDEFINED_SPELLING] !== true) throw new Error("row " + row.slug + " is malformed: " + UNDEFINED_SPELLING + " is the claim that the call returned nothing — it takes true, and any other value is a row asserting a truthiness nobody declared");
					expect(value).toBeUndefined();
				}
				else if (isStructural(row.expect)) {
					if ((row.expect as Record<string, unknown>)[ARG_SHAPE] !== undefined) assertArgShape(row.slug, row.expect as Record<string, unknown>, decoded);
					else assertStructural(row.slug, value, row.expect as Record<string, unknown>, decoded);
				}
				else if (isTextSpec(row.expect)) assertText(row.slug, value, row.expect as Record<string, unknown>);
				else expect(value).toEqual(row.expect);
			} else if (row.expect_throw !== undefined) {
				const throwArgs = await Promise.all(args.map(decodeValue));
				const syncExport = await loadExport(row.module, exportName);
				if (typeof syncExport !== "function") throw new Error("export " + exportName + " in " + row.module + " is not a function — expect_throw needs a callable to throw from");
				expect(() => (syncExport as (...a: unknown[]) => unknown)(...throwArgs)).toThrow(String(row.expect_throw));
			} else {
				const raised = callExport(row.module, exportName, await Promise.all(args.map(decodeValue)));
			if (Array.isArray(row.expect_error)) {
				for (const needle of row.expect_error as unknown[]) {
					if (typeof needle !== "string") throw new Error("row " + row.slug + " is malformed: an expect_error array is a list of literal substrings, and one entry is " + typeof needle);
					await expect(raised).rejects.toThrow(needle);
				}
			} else {
				const wanted = row.expect_error !== null && typeof row.expect_error === "object" && "matches" in (row.expect_error as object)
					? new RegExp(String((row.expect_error as { matches: unknown }).matches), (row.expect_error as { flags?: unknown }).flags === undefined ? "" : String((row.expect_error as { flags?: unknown }).flags))
					: row.expect_error;
				await expect(raised).rejects.toThrow(wanted as string | RegExp);
			}
			}
		});
	} finally {
		restore();
	}
}

function stepTarget(row: Vector, step: Record<string, unknown>): [string, string] {
	if (row.module !== undefined && row.module !== null && row.module !== "") return [String(row.module), String(step.call)];
	const spelled = String(step.call);
	const colon = spelled.lastIndexOf(":");
	if (colon <= 0 || colon === spelled.length - 1) {
		throw new Error("row " + row.slug + " is malformed: a step with no row module spells call as <module>:<export>, got " + JSON.stringify(spelled));
	}
	return [spelled.slice(0, colon), spelled.slice(colon + 1)];
}

const STRUCTURAL_VERBS = ["has_members", "member_is", "member_equals", "reads_resolve", "member_throws", "member_equals_expression", "includes", "excludes", "is_undefined", "is_null", "is_defined", "instance_of", "same_ref", "compare", "set_has", "map_get"] as const;
const EXPORT_SHAPE = "export_shape";
const ARG_SHAPE = "arg_shape";
const UNDEFINED_SPELLING = "$undefined";
const TEXT_VERBS = ["contains_text", "absent", "in_order", "repeated", "matches", "length", "max_length"] as const;
function containsIn(slug: string, value: unknown, spec: { path?: string; needles?: string[] }): void {
	if (spec === null || typeof spec !== "object" || typeof spec.path !== "string" || !Array.isArray(spec.needles)) throw new Error("row " + slug + " is malformed: contains_in needs {path, needles}");
	const found = memberAt(value, spec.path);
	if (typeof found !== "string") throw new Error("row " + slug + " is malformed: contains_in reads " + spec.path + " and it is " + (found === undefined ? "absent from what the call returned" : typeof found) + ", not a string to read");
	for (const needle of spec.needles as string[]) {
		if (!(found as string).includes(needle)) throw new Error("row " + slug + " text expect did not hold: " + spec.path + " has no " + JSON.stringify(needle));
	}
}

function isTextSpec(spec: unknown): boolean {
	return (
		spec !== null &&
		typeof spec === "object" &&
		!Array.isArray(spec) &&
		Object.keys(spec as object).some((key) => (TEXT_VERBS as readonly string[]).includes(key) || key === "contains_in")
	);
}

function assertText(slug: string, value: unknown, spec: Record<string, unknown>): void {
	const bad: (msg: string) => never = (msg) => {
		throw new Error("row " + slug + " text expect did not hold: " + msg);
	};
	if (spec.contains_in !== undefined) {
		containsIn(slug, value, spec.contains_in as { path?: string; needles?: string[] });
		return;
	}
	if (typeof value !== "string") {
		throw new Error("row " + slug + " is malformed: a text expect asserts a returned string, got " + (value === null ? "null" : typeof value));
	}
	const text = value as string;
	for (const verb of Object.keys(spec)) {
		if (!(TEXT_VERBS as readonly string[]).includes(verb)) {
			throw new Error("row " + slug + " is malformed: text expect " + verb + " is not a declared verb " + JSON.stringify(TEXT_VERBS) + " — a predicate this runner does not understand is a case it stopped asserting");
		}
		const needles = spec[verb];
		if (verb === "contains_text") {
			for (const needle of needles as string[]) if (!text.includes(needle)) bad("the text has no " + JSON.stringify(needle));
		} else if (verb === "absent") {
			for (const needle of needles as string[]) if (text.includes(needle)) bad("the text carries " + JSON.stringify(needle));
		} else if (verb === "in_order") {
			let after = -1;
			let previous = "the start";
			for (const marker of needles as string[]) {
				const at = text.indexOf(marker);
				if (at === -1) bad(JSON.stringify(marker) + " is not in the text at all");
				if (at <= after) bad(JSON.stringify(marker) + " is not after " + previous);
				after = at;
				previous = JSON.stringify(marker);
			}
		} else if (verb === "length") {
			if (typeof needles !== "number" || !Number.isInteger(needles) || needles < 0) throw new Error("row " + slug + " is malformed: length needs a non-negative integer — the exact character count the text carries");
			if (text.length !== needles) bad("the text is " + text.length + " characters, not the declared " + needles);
		} else if (verb === "max_length") {
			if (typeof needles !== "number" || !Number.isInteger(needles) || needles < 0) throw new Error("row " + slug + " is malformed: max_length needs a non-negative integer — the bound the text must not pass");
			if (text.length > needles) bad("the text is " + text.length + " characters, past the declared bound of " + needles);
		} else if (verb === "matches") {
			if (typeof needles !== "string") throw new Error("row " + slug + " is malformed: matches needs a regex source string");
			let matched: boolean;
			try {
				matched = new RegExp(needles).test(text);
			} catch (err) {
				throw new Error("row " + slug + " is malformed: matches is not a usable regex — " + String(err));
			}
			if (!matched) bad("the text does not match " + JSON.stringify(needles));
		} else {
			const rep = needles as { pattern?: unknown; count?: unknown; group?: unknown };
			if (typeof rep.pattern !== "string" || typeof rep.count !== "number") {
				throw new Error("row " + slug + " is malformed: repeated needs {pattern, count} and an optional group — how many times the pattern matches, and which capture must not drift between the matches");
			}
			let matches: RegExpMatchArray[];
			try {
				matches = [...text.matchAll(new RegExp(rep.pattern, "g"))];
			} catch (err) {
				throw new Error("row " + slug + " is malformed: repeated.pattern is not a usable regex — " + String(err));
			}
			if (matches.length !== rep.count) bad("the pattern matched " + matches.length + " times, not the declared " + rep.count);
			if (rep.group !== undefined) {
				const group = rep.group as number;
				const first = matches[0]?.[group];
				if (first === undefined) bad("capture group " + group + " took no part in the first match");
				for (const match of matches) {
					if (match[group] !== first) bad("capture group " + group + " differs between matches: " + JSON.stringify(first) + " vs " + JSON.stringify(match[group]) + " — the two copies of this text must be the same set");
				}
			}
		}
	}
}


function isExportShape(spec: unknown): boolean {
	return (
		spec !== null &&
		typeof spec === "object" &&
		!Array.isArray(spec) &&
		(spec as Record<string, unknown>)[EXPORT_SHAPE] !== undefined
	);
}

function assertOneAxis(where: string, spec: unknown, args: unknown[] | undefined, expectError: unknown): void {
	const bad: (msg: string) => never = (msg) => {
		throw new Error(where + " is malformed: " + msg);
	};
	if (isExportShape(spec)) {
		const declared = (spec as Record<string, unknown>)[EXPORT_SHAPE];
		if (declared === null || typeof declared !== "object" || Array.isArray(declared)) bad(EXPORT_SHAPE + " must be a structural spec object");
		if (expectError !== undefined) bad(EXPORT_SHAPE + " with expect_error — no call is made, so nothing is raised to match");
		if (args !== undefined && args.length > 0) bad(EXPORT_SHAPE + " declares args — the export is not called, so nothing receives them");
		for (const verb of Object.keys(spec as object)) {
			if (verb !== EXPORT_SHAPE) bad("expect declares " + verb + " alongside " + EXPORT_SHAPE + " — one row states one axis; a row that wants both is two rows");
		}
		return;
	}
	if (isRenderRow(spec, args)) {
		if (args !== undefined && args.length > 1) bad("a render row takes at most one arg — the props object, not a positional list");
		if (spec === null || spec === undefined || typeof spec !== "object" || Array.isArray(spec)) return;
		for (const verb of Object.keys(spec as object)) {
			if (verb !== "render") bad("expect declares " + verb + " alongside render — one row states one axis; a row that wants both is two rows");
		}
		const renderSpec = (spec as Record<string, unknown>).render;
		if (renderSpec === null || typeof renderSpec !== "object" || Array.isArray(renderSpec)) bad("render must be a spec object");
		for (const verb of Object.keys(renderSpec as object)) {
			if (!(RENDER_VERBS as readonly string[]).includes(verb)) bad("render " + verb + " is not a declared verb " + JSON.stringify(RENDER_VERBS) + " — a predicate this runner does not understand is a case it stopped asserting");
		}
		const clickSelectors = (renderSpec as Record<string, unknown>).click;
		if (clickSelectors !== undefined) {
			if ((spec as Record<string, unknown>).expect_error !== undefined) bad("click beside expect_error — a row that expects the render to throw has nothing to click");
			const selectors = (Array.isArray(clickSelectors) ? clickSelectors : [clickSelectors]) as unknown[];
			if (selectors.length === 0) bad("click needs at least one selector");
			for (const selector of selectors) {
				if (typeof selector !== "string" || selector.length === 0) bad("click selectors must be non-empty strings, got " + JSON.stringify(selector));
			}
		}
		return;
	}
	if (spec === null || spec === undefined || typeof spec !== "object" || Array.isArray(spec)) return;
	if (isHook(spec)) {
		if ((spec as Record<string, unknown>).expect_error !== undefined) bad("hook beside expect_error — a hook row's failure is the mount or the act, and the runner rethrows it; there is no separate error claim to match");
		for (const verb of Object.keys(spec as object)) {
			if (verb !== "hook") bad("expect declares " + verb + " alongside hook — one row states one axis; a row that wants both is two rows");
		}
		const hookSpec = (spec as Record<string, unknown>).hook;
		if (hookSpec === null || typeof hookSpec !== "object" || Array.isArray(hookSpec)) bad("hook must be a spec object");
		for (const verb of Object.keys(hookSpec as object)) {
			if (!(HOOK_VERBS as readonly string[]).includes(verb) && !(HOOK_MOUNT_KEYS as readonly string[]).includes(verb)) bad("hook " + verb + " is not a declared verb " + JSON.stringify([...HOOK_VERBS, ...HOOK_MOUNT_KEYS]) + " — a verb this runner does not read is a claim the row never makes");
		}
		const resultSpec = (hookSpec as Record<string, unknown>).result;
		if (resultSpec === null || typeof resultSpec !== "object" || Array.isArray(resultSpec)) bad("hook needs a result — a hook row that asserts nothing asserts nothing");
		for (const verb of Object.keys(resultSpec as object)) {
			if (!(HOOK_RESULT_VERBS as readonly string[]).includes(verb)) bad("hook.result " + verb + " is not a declared verb " + JSON.stringify(HOOK_RESULT_VERBS) + " — a verb this runner does not read is a claim the row never makes");
		}
		if (Object.keys(resultSpec as object).length === 0) bad("hook.result declares no verb — a result spec with no verb asserts nothing");
		const fields = (resultSpec as Record<string, unknown>).field_equals;
		if (fields !== undefined) {
			if (fields === null || typeof fields !== "object" || Array.isArray(fields)) bad("hook.result.field_equals must be an object of field: value");
			if (Object.keys(fields as object).length === 0) bad("hook.result.field_equals declares no field — a field_equals with no field equals nothing");
		}
		const acts = (hookSpec as Record<string, unknown>).act;
		if (acts !== undefined) {
			if (!Array.isArray(acts)) bad("hook.act must be an ordered array — the acts run in the order the row declares them, because each sees the state the one before left");
			for (const [j, entry] of (acts as unknown[]).entries()) {
				if (entry === null || typeof entry !== "object" || Array.isArray(entry)) bad("hook.act[" + j + "] must be an object {call, args}");
				const step = entry as Record<string, unknown>;
				for (const k of Object.keys(step)) {
					if (k !== "call" && k !== "args" && k !== "expect_error") bad("hook.act[" + j + "] declares " + k + " — an act names the returned callback to call, the arguments to call it with, and the failure it is expected to raise");
				}
				if (typeof step.call !== "string" || step.call.length === 0) bad("hook.act[" + j + "] must name the callback it calls — the hook's own return is what a row drives");
				if (step.args !== undefined && !Array.isArray(step.args)) bad("hook.act[" + j + "].args must be an array — a callback takes positional arguments");
				if (step.expect_error !== undefined && (typeof step.expect_error !== "string" || step.expect_error.length === 0)) bad("hook.act[" + j + "].expect_error must name text the rejection carries — an error claim with no text matches everything");
			}
		}
		const providerName = (hookSpec as Record<string, unknown>).provider;
		if (providerName !== undefined) {
			if (typeof providerName !== "string" || providerName.length === 0) bad("hook.provider must name the export the hook is mounted inside — a context consumer resolves to null without its provider, so the row has to say which wrapper supplies the value");
			const providerArgs = (hookSpec as Record<string, unknown>).provider_args;
			if (providerArgs !== undefined && !Array.isArray(providerArgs)) bad("hook.provider_args must be an array of positional props for the provider");
		}
		if ((hookSpec as Record<string, unknown>).provider_args !== undefined && providerName === undefined) bad("hook.provider_args without hook.provider — props for a wrapper the row never declares reach nothing");
		return;
	}
	if ((spec as Record<string, unknown>)[ARG_SHAPE] === undefined) return;
	const argSpec = (spec as Record<string, unknown>)[ARG_SHAPE];
	if (argSpec === null || typeof argSpec !== "object" || Array.isArray(argSpec)) bad(ARG_SHAPE + " must be a spec object");
	if (typeof (argSpec as { arg?: unknown }).arg !== "number") bad(ARG_SHAPE + ".arg must be declared — the positional index of the argument the subject mutates");
	for (const verb of Object.keys(spec as object)) {
		if (verb !== ARG_SHAPE) bad("expect declares " + verb + " alongside " + ARG_SHAPE + " — one row states one axis; a row that wants both is two rows");
	}
}

function isStructural(spec: unknown): boolean {
	return (
		isExportShape(spec) ||
		(spec !== null &&
		typeof spec === "object" &&
		!Array.isArray(spec) &&
		Object.keys(spec as object).some((key) =>
			(STRUCTURAL_VERBS as readonly string[]).includes(key) || key === ARG_SHAPE || key === UNDEFINED_SPELLING
		)
	)
	);
}

function argTarget(slug: string, spec: Record<string, unknown>, decoded: unknown[]): number {
	const target = (spec[ARG_SHAPE] as { arg?: unknown }).arg;
	if (typeof target !== "number" || !Number.isInteger(target) || target < 0 || target >= decoded.length) {
		throw new Error("row " + slug + " is malformed: " + ARG_SHAPE + ".arg must be an argument position this row declares (0.." + (decoded.length - 1) + "), got " + JSON.stringify(target));
	}
	return target;
}

function assertArgShape(slug: string, spec: Record<string, unknown>, decoded: unknown[]): void {
	assertStructural(slug, decoded[argTarget(slug, spec, decoded)], spec[ARG_SHAPE] as Record<string, unknown>, decoded, "arg");
}

function memberAt(value: unknown, path: string): unknown {
	let at: unknown = value;
	for (const key of path.split(".")) {
		if (at === null || at === undefined) return undefined;
		if (key === "json") {
			const payload = typeof at === "string" ? at : ((at as { body?: unknown } | null)?.body);
			if (typeof payload !== "string") throw new Error("the json path step reads a wire body — the string at .body, or the string the path landed on — and found " + typeof payload + ", so nothing there is a parsable payload");
			at = JSON.parse(payload);
			continue;
		}
		at = (at as Record<string, unknown>)[key];
	}
	return at;
}

function assertStructural(slug: string, value: unknown, spec: Record<string, unknown>, refs?: unknown[], declaration?: string): void {
	for (const verb of Object.keys(spec)) {
		if (verb === declaration) continue;
		if (verb === UNDEFINED_SPELLING) continue;
		if (!(STRUCTURAL_VERBS as readonly string[]).includes(verb)) {
			throw new Error(
			"row " + slug + " is malformed: structural expect " + verb +
			" is not a declared verb " + JSON.stringify(STRUCTURAL_VERBS) +
			" — a predicate this runner does not understand is a case it stopped asserting");
		}
	}
	const bad: (verb: string, detail: string) => never = (verb, detail) => {
		throw new Error("row " + slug + " outcome " + verb + " did not hold: " + detail);
	};
	if (spec.has_members !== undefined) {
		for (const path of spec.has_members as string[]) {
			if (memberAt(value, path) === undefined) bad("has_members", path + " is not declared");
		}
	}
	if (spec.includes !== undefined) {
		if (!Array.isArray(value)) bad("includes", "the call returned " + (value === undefined ? "nothing" : typeof value) + ", not an array to read");
		for (const needle of spec.includes as unknown[]) {
			if (!(value as unknown[]).some((entry) => JSON.stringify(entry) === JSON.stringify(needle))) bad("includes", JSON.stringify(needle) + " is not among the " + (value as unknown[]).length + " returned");
		}
	}
	if (spec.excludes !== undefined) {
		if (!Array.isArray(value)) bad("excludes", "the call returned " + (value === undefined ? "nothing" : typeof value) + ", not an array to read");
		for (const needle of spec.excludes as unknown[]) {
			if ((value as unknown[]).some((entry) => JSON.stringify(entry) === JSON.stringify(needle))) bad("excludes", JSON.stringify(needle) + " is among the returned, the row declares it absent");
		}
	}
	if (spec.member_is !== undefined) {
		for (const [path, kind] of Object.entries(spec.member_is as Record<string, string>)) {
			const got = memberAt(value, path);
			if (got === undefined) bad("member_is", path + " is not declared");
			if (typeof got !== kind) bad("member_is", path + " is " + typeof got + ", the row declares " + kind);
		}
	}
	if (spec.member_equals !== undefined) {
		for (const [path, want] of Object.entries(spec.member_equals as Record<string, unknown>)) {
			expect(memberAt(value, path)).toEqual(want);
		}
	}
	if (spec.reads_resolve !== undefined) {
		for (const path of spec.reads_resolve as string[]) {
			try {
				memberAt(value, path);
			} catch (err) {
				bad("reads_resolve", "reading " + path + " threw " + String(err));
			}
		}
	}
	if (spec.member_throws !== undefined) {
		for (const rel of spec.member_throws as { path?: string; contains?: string[] }[]) {
			if (rel === null || typeof rel !== "object" || typeof rel.path !== "string" || (rel.path as string).length === 0) bad("member_throws", "needs {path, contains?} — the member whose read must throw, and the needles the message must carry");
			let raised: unknown;
			try {
				memberAt(value, rel.path as string);
			} catch (err) {
				raised = err;
			}
			if (raised === undefined) bad("member_throws", "reading " + rel.path + " returned without throwing — the wrapper admits what the row refuses");
			const message = raised instanceof Error ? raised.message : String(raised);
			for (const needle of rel.contains ?? []) {
				if (!message.includes(needle)) bad("member_throws", "the throw reads " + JSON.stringify(message) + ", which does not carry " + JSON.stringify(needle));
			}
		}
	}
	if (spec.member_equals_expression !== undefined) {
		const rel = spec.member_equals_expression as { path?: string; equals?: string; within?: number };
		if (rel === null || typeof rel !== "object" || typeof rel.path !== "string" || typeof rel.equals !== "string") bad("member_equals_expression", "needs {path, equals}");
		const got = memberAt(value, rel.path);
		if (typeof got !== "number") bad("member_equals_expression", rel.path + " is " + (got === undefined ? "absent from what the call returned" : typeof got) + ", the row states an arithmetic relation over a number");
		const want = arithmetic(rel.equals, value, slug);
		const within = rel.within === undefined ? 1e-9 : rel.within;
		if (!(Math.abs(got - want) <= within)) bad("member_equals_expression", rel.path + " is " + got + ", the row states it equals " + rel.equals + " over the returned members, which is " + want + " (within " + within + ")");
	}
	if (spec.is_undefined !== undefined) {
		if (spec.is_undefined !== true) throw new Error("row " + slug + " is malformed: is_undefined is the claim that the call returned nothing — it takes true, and any other value is a row asserting a truthiness nobody declared");
		if (value !== undefined) bad("is_undefined", "the call returned a value (" + typeof value + "), not nothing");
	}
	if (spec.is_null !== undefined) {
		if (spec.is_null !== true) throw new Error("row " + slug + " is malformed: is_null takes true — comparing against null as a value is equals");
		if (value !== null) bad("is_null", "the call returned " + (value === undefined ? "nothing" : JSON.stringify(value)) + ", not null");
	}
	if (spec.is_defined !== undefined) {
		if (spec.is_defined !== true) throw new Error("row " + slug + " is malformed: is_defined takes true — the claim is that the call returned something usable, not null and not nothing");
		if (value === undefined || value === null) bad("is_defined", "the call returned " + (value === undefined ? "nothing" : "null"));
	}
	if (spec.instance_of !== undefined) {
		if (typeof spec.instance_of !== "string" || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(spec.instance_of)) throw new Error("row " + slug + " is malformed: instance_of names a constructor (an identifier), got " + JSON.stringify(spec.instance_of));
		const ctor = (globalThis as Record<string, unknown>)[spec.instance_of];
		if (typeof ctor !== "function") throw new Error("row " + slug + " is malformed: instance_of names " + spec.instance_of + ", which this runtime does not bind");
		if (!(value instanceof ctor)) bad("instance_of", "the call returned a value that is not an instance of " + spec.instance_of);
	}
	if (spec.same_ref !== undefined) {
		const rel = spec.same_ref as { arg?: unknown; is?: boolean };
		if (rel === null || typeof rel !== "object" || typeof rel.arg !== "number" || !Number.isInteger(rel.arg) || rel.arg < 0 || rel.arg >= (refs?.length ?? 0)) throw new Error("row " + slug + " is malformed: same_ref is {arg, is?} naming an argument position this row declares, got " + JSON.stringify(rel) + " against " + (refs?.length ?? 0) + " decoded args");
		const same = value === refs?.[rel.arg];
		if (rel.is === false ? same : !same) bad("same_ref", "the call returned " + (same ? "the same reference as" : "a different reference from") + " arg " + rel.arg + ", the row declares the opposite");
	}
	if (spec.compare !== undefined) {
		const cmp = spec.compare as Record<string, unknown>;
		const ops = cmp === null || typeof cmp !== "object" ? [] : Object.keys(cmp).filter((k) => ["gt", "gte", "lt", "lte"].includes(k));
		if (ops.length !== 1) throw new Error("row " + slug + " is malformed: compare states exactly one of gt, gte, lt, lte, got " + JSON.stringify(cmp));
		const op = ops[0] as string;
		const bound = cmp[op];
		if (typeof bound !== "number") throw new Error("row " + slug + " is malformed: compare." + op + " takes a number, got " + JSON.stringify(bound));
		if (typeof value !== "number") bad("compare", "the call returned " + (value === undefined ? "nothing" : typeof value) + ", the row compares a number");
		const held = op === "gt" ? (value as number) > bound : op === "gte" ? (value as number) >= bound : op === "lt" ? (value as number) < bound : (value as number) <= bound;
		if (!held) bad("compare", "the call returned " + value + ", which is not " + op + " " + bound);
	}
	if (spec.set_has !== undefined) {
		const rel = spec.set_has as { items?: unknown; size?: unknown };
		if (rel === null || typeof rel !== "object" || !Array.isArray(rel.items) || rel.items.length === 0) throw new Error("row " + slug + " is malformed: set_has is {items, size?} — membership over nothing asserts nothing");
		if (!(value instanceof Set)) bad("set_has", "the call returned " + (value === undefined ? "nothing" : typeof value) + ", not a Set");
		for (const item of rel.items as unknown[]) {
			if (!(value as Set<unknown>).has(item)) bad("set_has", JSON.stringify(item) + " is not a member of the returned Set");
		}
		if (rel.size !== undefined) {
			if (typeof rel.size !== "number") throw new Error("row " + slug + " is malformed: set_has.size takes a number, got " + JSON.stringify(rel.size));
			if ((value as Set<unknown>).size !== rel.size) bad("set_has", "the Set holds " + (value as Set<unknown>).size + " members, the row declares " + rel.size);
		}
	}
	if (spec.map_get !== undefined) {
		const rel = spec.map_get as { key?: unknown; equals?: unknown; has?: boolean };
		if (rel === null || typeof rel !== "object" || !("key" in rel) || (rel.equals === undefined && rel.has === undefined)) throw new Error("row " + slug + " is malformed: map_get is {key, equals} or {key, has} — a key with neither a value nor a presence claim says nothing");
		if (!(value instanceof Map)) bad("map_get", "the call returned " + (value === undefined ? "nothing" : typeof value) + ", not a Map");
		const key = rel.key;
		if (rel.has !== undefined) {
			if (typeof rel.has !== "boolean") throw new Error("row " + slug + " is malformed: map_get.has takes a boolean, got " + JSON.stringify(rel.has));
			if ((value as Map<unknown, unknown>).has(key) !== rel.has) bad("map_get", "the map " + ((value as Map<unknown, unknown>).has(key) ? "holds" : "does not hold") + " " + JSON.stringify(key) + ", the row declares " + rel.has);
		}
		if (rel.equals !== undefined) {
			const got = (value as Map<unknown, unknown>).get(key);
			const want = rel.equals;
			if (JSON.stringify(got) !== JSON.stringify(want)) bad("map_get", "the map holds " + JSON.stringify(got) + " at " + JSON.stringify(key) + ", the row declares " + JSON.stringify(want));
		}
	}
}

const RENDER_VERBS = ["contains", "absent", "selector_present", "selector_absent", "attr_equals", "attr_contains", "click"] as const;
const HOOK_VERBS = ["act", "result"] as const;
const HOOK_RESULT_VERBS = ["field_equals", "contains", "absent"] as const;
const HOOK_MOUNT_KEYS = ["provider", "provider_args"] as const;
function isHook(spec: unknown): boolean {
	return spec !== null && typeof spec === "object" && !Array.isArray(spec) && (spec as Record<string, unknown>).hook !== undefined;
}

function assertHookResult(slug: string, latest: unknown, spec: Record<string, unknown>): void {
	if (latest === null || typeof latest !== "object") throw new Error("row " + slug + " outcome hook did not hold: the hook returned " + JSON.stringify(latest) + ", which carries no field to read");
	const value = latest as Record<string, unknown>;
	for (const [field, want] of Object.entries((spec.field_equals ?? {}) as Record<string, unknown>)) {
		if (!(field in value)) throw new Error("row " + slug + " outcome hook did not hold: the hook returned no field " + field + ", so a claim over it asserts nothing");
		expect(value[field]).toEqual(want);
	}
	const text = JSON.stringify(value) ?? "";
	for (const needle of (spec.contains ?? []) as string[]) {
		if (!text.includes(needle)) throw new Error("row " + slug + " outcome hook did not hold: the hook's result does not contain " + JSON.stringify(needle));
	}
	for (const needle of (spec.absent ?? []) as string[]) {
		if (text.includes(needle)) throw new Error("row " + slug + " outcome hook did not hold: the hook's result still carries " + JSON.stringify(needle));
	}
}

const ELEMENT_MARKER = "$throw_on_render";

function isRender(spec: unknown): boolean {
	return (
		spec !== null &&
		typeof spec === "object" &&
		!Array.isArray(spec) &&
		(spec as Record<string, unknown>).render !== undefined
	);
}

function hasMarker(value: unknown): boolean {
	if (Array.isArray(value)) return value.some(hasMarker);
	if (value !== null && typeof value === "object") {
		if (Object.keys(value as object).includes(ELEMENT_MARKER)) return true;
		for (const key of Object.keys(value as object)) {
			if (hasMarker((value as Record<string, unknown>)[key])) return true;
		}
	}
	return false;
}

function isRenderRow(spec: unknown, args: unknown[] | undefined): boolean {
	return isRender(spec) || (args !== undefined && args.some(hasMarker));
}

function buildElements(React: typeof import("react"), value: unknown, slug: string): unknown {
	if (Array.isArray(value)) return value.map((item, index) => {
		const builtItem = buildElements(React, item, slug);
		if (builtItem !== null && typeof builtItem === "object" && (builtItem as Record<string, unknown>).$$typeof !== undefined) return React.cloneElement(builtItem, { key: String(index) });
		return builtItem;
	});
	if (value !== null && typeof value === "object") {
		const record = value as Record<string, unknown>;
		if (Object.keys(record).includes(ELEMENT_MARKER)) {
			if (typeof record[ELEMENT_MARKER] !== "string") throw new Error("row " + slug + " is malformed: " + ELEMENT_MARKER + " takes the error message string, got " + JSON.stringify(record[ELEMENT_MARKER]));
			const message = record[ELEMENT_MARKER] as string;
			return React.createElement(function Thrower(): never {
				throw new Error(message);
			});
		}
		const built: Record<string, unknown> = {};
		for (const key of Object.keys(record)) {
			if (key.startsWith("$")) throw new Error("row " + slug + " is malformed: element marker " + key + " is not declared — a marker this runner does not know is a child that would render as inert data");
			built[key] = buildElements(React, record[key], slug);
		}
		return built;
	}
	return value;
}

function assertRenderSpec(slug: string, container: HTMLElement, spec: Record<string, unknown>): void {
	const text = container.textContent ?? "";
	const bad: (verb: string, detail: string) => never = (verb, detail) => {
		throw new Error("row " + slug + " outcome " + verb + " did not hold: " + detail);
	};
	for (const needle of (spec.contains ?? []) as string[]) {
		if (!text.includes(needle)) bad("contains", "the rendered text has no " + JSON.stringify(needle));
	}
	for (const needle of (spec.absent ?? []) as string[]) {
		if (text.includes(needle)) bad("absent", "the rendered text still carries " + JSON.stringify(needle));
	}
	for (const selector of (spec.selector_present ?? []) as string[]) {
		if (container.querySelector(selector) === null) bad("selector_present", "no element matches " + selector);
	}
	for (const selector of (spec.selector_absent ?? []) as string[]) {
		if (container.querySelector(selector) !== null) bad("selector_absent", selector + " is present");
	}
	for (const [selector, claims] of Object.entries((spec.attr_equals ?? {}) as Record<string, Record<string, string>>)) {
		const el = container.querySelector(selector);
		if (el === null) bad("attr_equals", selector + " matches no element, so an attribute claim over it asserts nothing");
		for (const [attr, want] of Object.entries(claims)) {
			const got = el.getAttribute(attr);
			if (got !== String(want)) bad("attr_equals", selector + " carries " + attr + "=" + JSON.stringify(got) + ", the row declares " + JSON.stringify(String(want)));
		}
	}
	for (const [selector, claims] of Object.entries((spec.attr_contains ?? {}) as Record<string, Record<string, string[]>>)) {
		const el = container.querySelector(selector);
		if (el === null) bad("attr_contains", selector + " matches no element, so an attribute claim over it asserts nothing");
		for (const [attr, needles] of Object.entries(claims)) {
			const got = el.getAttribute(attr) ?? "";
			for (const needle of needles) {
				if (!got.includes(needle)) bad("attr_contains", selector + " carries " + attr + "=" + JSON.stringify(got) + ", which does not carry " + JSON.stringify(needle));
			}
		}
	}
}

async function renderRow(row: Vector): Promise<void> {
	const restore = applyEnv(row.env);
	try {
		await withStubs(row, async () => {
			if (!globalThis.document) {
				const { GlobalRegistrator } = await import("@happy-dom/global-registrator");
				await GlobalRegistrator.register({ url: "http://localhost" });
			}
			(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
			const React = await import("react");
			const { createRoot } = await import("react-dom/client");
			const act = (React as unknown as { act: (run: () => Promise<void>) => Promise<void> }).act;
			const Component = await loadExport(row.module, row.export);
			if (typeof Component !== "function") throw new Error("export " + row.export + " in " + row.module + " is not a component — a render row needs a callable component export");
			const decoded = await Promise.all(((row.args ?? []) as unknown[]).map(decodeValue));
			const props = decoded.length === 0 ? {} : buildElements(React, decoded[0], row.slug);
			const host = document.createElement("div");
			document.body.appendChild(host);
			const root = createRoot(host);
			let caught: unknown;
			try {
				await act(async () => {
					root.render(React.createElement(Component as never, props as Record<string, unknown>));
				});
			} catch (err) {
				caught = err;
			}
			if (row.expect_error !== undefined) {
				if (caught === undefined) throw new Error("row " + row.slug + " expected the render to throw " + JSON.stringify(row.expect_error) + ", and it returned a tree");
				const message = caught instanceof Error ? caught.message : String(caught);
				if (!message.includes(String(row.expect_error))) throw new Error("row " + row.slug + " outcome expect_error did not hold: the render threw " + JSON.stringify(message));
				await act(async () => { root.unmount(); });
				host.remove();
				return;
			}
			if (caught !== undefined) throw caught instanceof Error ? caught : new Error(String(caught));
			const clickSelectors = ((row.expect as Record<string, unknown>).render as Record<string, unknown>).click;
			if (clickSelectors !== undefined) {
				for (const selector of (Array.isArray(clickSelectors) ? clickSelectors : [clickSelectors]) as string[]) {
					const target = host.querySelector(selector);
					if (target === null) throw new Error("row " + row.slug + " outcome click did not hold: no element matches " + selector);
					await act(async () => {
						target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
					});
				}
			}
			assertRenderSpec(row.slug, host, (row.expect as Record<string, unknown>).render as Record<string, unknown>);
			await act(async () => { root.unmount(); });
			host.remove();
		});

	} finally {
		restore();
	}
}
async function hookRow(row: Vector): Promise<void> {
	const restore = applyEnv(row.env);
	try {
		await withStubs(row, async () => {
			if (!globalThis.document) {
				const { GlobalRegistrator } = await import("@happy-dom/global-registrator");
				await GlobalRegistrator.register({ url: "http://localhost" });
			}
			(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
			const React = await import("react");
			const { createRoot } = await import("react-dom/client");
			const act = (React as unknown as { act: (run: () => Promise<void>) => Promise<void> }).act;
			const hook = await loadExport(row.module, row.export);
			if (typeof hook !== "function") throw new Error("export " + row.export + " in " + row.module + " is not a hook — a hook row mounts the export and drives what it returns");
			const decoded = await Promise.all(((row.args ?? []) as unknown[]).map(decodeValue));
			if (decoded.length > 1) throw new Error("a hook row takes at most one arg — the options object the hook is mounted with");
			const options = decoded.length === 0 ? {} : decoded[0];
			let latest: unknown = undefined;
			const held: { value: unknown } = { value: undefined };
			ACTIVE_HOOK = held;
			function Probe(): null {
				latest = (hook as (o: unknown) => unknown)(options);
				held.value = latest;
				return null;
			}
			const spec = ((row.expect as Record<string, unknown>).hook) as Record<string, unknown>;
			const providerName = spec.provider as string | undefined;
			let wrapped: unknown = React.createElement(Probe);
			if (providerName !== undefined) {
				const provider = await loadExport(row.module, providerName);
				if (typeof provider !== "function") throw new Error("row " + row.slug + " names hook.provider " + providerName + ", which " + row.module + " does not export as a component — a wrapper the module does not export leaves the hook mounted in nothing");
				const providerProps = await Promise.all(((spec.provider_args ?? []) as unknown[]).map(decodeValue));
				wrapped = React.createElement(provider as (props: unknown) => unknown, (providerProps.length === 0 ? null : providerProps[0]) as never, React.createElement(Probe));
			}
			const root = createRoot(document.createElement("div"));
			await act(async () => { root.render(wrapped); });
			for (const [j, entry] of ((spec.act ?? []) as Record<string, unknown>[]).entries()) {
				const returned = latest as Record<string, unknown> | null | undefined;
				const fn = returned === null || returned === undefined ? undefined : returned[entry.call as string];
				if (typeof fn !== "function") throw new Error("row " + row.slug + " outcome hook did not hold: the hook returned no callable " + entry.call + " at act[" + j + "] — a callback the row drives is one the hook itself returns");
				const actArgs = await Promise.all(((entry.args ?? []) as unknown[]).map(decodeValue));
				let raised: unknown;
				let failed = false;
				try {
					await act(async () => { await (fn as (...a: unknown[]) => unknown)(...actArgs); });
				} catch (err) {
					raised = err;
					failed = true;
				}
				if (entry.expect_error === undefined) {
					if (failed) throw raised;
				} else {
					if (!failed) throw new Error("row " + row.slug + " declares expect_error " + JSON.stringify(String(entry.expect_error)) + " on act[" + j + "] and " + entry.call + " RESOLVED — an act whose failure is the claim must be answered by a rejection");
					const message = String((raised as Error)?.message ?? raised);
					if (!message.includes(String(entry.expect_error))) throw new Error("row " + row.slug + " act[" + j + "] " + entry.call + " rejected with " + JSON.stringify(message) + ", which does not carry " + JSON.stringify(String(entry.expect_error)));
				}
			}
			assertHookResult(row.slug, latest, spec.result as Record<string, unknown>);
			await act(async () => { root.unmount(); });
			ACTIVE_HOOK = null;
		});
	} finally {
		ACTIVE_HOOK = null;
		restore();
	}
}
function runFsFlow(row: Vector): Promise<void> {
	return (async () => {
		const workspace = await mkdtemp(join(tmpdir(), "contract-"));
		const before = process.env.SCALA_WORKSPACE_ROOT;
		process.env.SCALA_WORKSPACE_ROOT = workspace;
		try {
			await withStubs(row, async () => {
				for (const step of row.steps as Vector[]) {
					const [modPath, stepExport] = stepTarget(row, step);
					const args = await Promise.all((step.args ?? []).map(decodeValue));
					if (isExportShape(step.expect)) {
						assertStructural(row.slug, await loadExport(modPath, stepExport), (step.expect as Record<string, unknown>)[EXPORT_SHAPE] as Record<string, unknown>);
					} else if (step.expect_error !== undefined) {
						await expect(callExport(modPath, stepExport, args)).rejects.toThrow(step.expect_error);
					} else {
						if (isStructural(step.expect) && (step.expect as Record<string, unknown>)[ARG_SHAPE] !== undefined) argTarget(row.slug, step.expect as Record<string, unknown>, args);
						const value = await callExport(modPath, stepExport, args);
						if (isStructural(step.expect)) {
							if ((step.expect as Record<string, unknown>)[ARG_SHAPE] !== undefined) assertArgShape(row.slug, step.expect as Record<string, unknown>, args);
							else assertStructural(row.slug, value, step.expect as Record<string, unknown>, args);
						}
						else if (isTextSpec(step.expect)) assertText(row.slug, value, step.expect as Record<string, unknown>);
						else if (step.expect_void === true) expect(value).toBeUndefined();
					else expect(value).toEqual(step.expect);
					}
				}
			});
	} finally {
			if (before === undefined) delete process.env.SCALA_WORKSPACE_ROOT;
			else process.env.SCALA_WORKSPACE_ROOT = before;
			await rm(workspace, { recursive: true, force: true });
	}
	})();
}


const OUTCOME_VERBS = ["count", "equals", "contains", "absent", "sql_contains", "sql_absent", "binds"] as const;

type Stub = Vector & { module?: string; export?: string; global?: string; hang?: boolean; record?: string; returns?: unknown; error?: unknown; when_sql_contains?: string; when_body_contains?: string; element?: unknown; value?: unknown };
type Call = { args: unknown[] };

function stubPath(row: Vector, stub: Stub): string {
	const spec = String(stub.module);
	if (!spec.startsWith(".") && !spec.startsWith("/")) return spec;
	return resolve(dirname(resolve(ROOT, String(row.module))), spec);
}

function decodeStubReturn(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(decodeStubReturn);
	if (value instanceof Promise) return value;
	if (typeof value === "object" && value !== null && "$date" in value) {
		const stubbed = new Date(String((value as { $date: unknown }).$date));
		if (Number.isNaN(stubbed.getTime())) throw new Error("$date " + JSON.stringify((value as { $date: unknown }).$date) + " is not an instant this runtime can read");
		return stubbed;
	}
	if (typeof value === "object" && value !== null) {
		if ("$fn" in value) {
			const spec = (value as { $fn: { returns?: unknown; throws?: unknown; returns_by_call?: unknown[] } }).$fn;
			if (Array.isArray(spec.returns_by_call)) {
				const answers = (spec.returns_by_call as unknown[]).map(decodeStubReturn);
				let served = 0;
				return () => {
					if (served >= answers.length) throw new Error("a stubbed member was called " + (served + 1) + " times but declares " + answers.length + " answers — the next one is a value no row declared");
					return answers[served++];
				};
			}
			if (spec.returns !== undefined) {
				const answer = decodeStubReturn(spec.returns);
				if (spec.records === undefined) return () => answer;
				declareRecorder(String(spec.records));
				return (...callArgs: unknown[]) => {
					recordCall(String(spec.records), callArgs);
					return answer;
				};
			}
			if (spec.throws !== undefined) {
				const raised = decodeStubReturn(spec.throws);
				return () => {
					throw raised;
				};
			}
			throw new Error("a fixture stub return declares $fn with neither returns nor throws — a function whose behaviour is undeclared is a case the runner cannot run");
		}
		if ("$error" in value) {
			throw new Error("a fixture stub return declares $error — a stub's failure is the stub-level error key; a return is what the call answers with");
		}
		const walked: Record<string, unknown> = {};
		for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
			walked[key] = decodeStubReturn(inner);
		}
		return walked;
	}
	return value;
}

function hangForever(slug: string, call: Call): Promise<never> {
	return new Promise((_resolve, reject) => {
		const raw = typeof call.args[1] === "object" && call.args[1] !== null && "signal" in (call.args[1] as object) ? (call.args[1] as { signal?: unknown }).signal : undefined;
		if (raw !== undefined && !(raw instanceof AbortSignal)) throw new Error(`row ${slug} is malformed: a hanging stub's call carries a signal that is not an AbortSignal`);
		if (raw instanceof AbortSignal) {
			if (raw.aborted) {
				reject(raw.reason instanceof Error ? raw.reason : new Error(String(raw.reason ?? "aborted")));
				return;
			}
			raw.addEventListener("abort", () => reject(raw.reason instanceof Error ? raw.reason : new Error(String(raw.reason ?? "aborted"))), { once: true });
		}
	});
}

function stubReturn(slug: string, group: Stub[], call: Call): unknown {
	const sql = typeof call.args[0] === "string" ? (call.args[0] as string) : "";
	const body = typeof call.args[1] === "object" && call.args[1] !== null && "body" in (call.args[1] as object) ? String((call.args[1] as { body?: unknown }).body ?? "") : "";
	for (const stub of group) {
		if (stub.when_sql_contains !== undefined && !sql.includes(String(stub.when_sql_contains))) continue;
		if (stub.when_body_contains !== undefined && !body.includes(String(stub.when_body_contains))) continue;
		if (stub.hang === true) return hangForever(slug, call);
		if (stub.error !== undefined) throw stub.error;
		return stub.returns;
	}
	if (group.every((stub) => stub.when_sql_contains !== undefined || stub.when_body_contains !== undefined)) {
		throw new Error(
			`row ${slug} is malformed: no fixture stub matches the request ` +
			JSON.stringify({ sql: sql.slice(0, 120), body: body.slice(0, 120) }) + " — " +
			"declared shapes: " + group.map((stub) => JSON.stringify(stub.when_sql_contains ?? stub.when_body_contains)).join(", "));
	}
	return group[0].returns;
}

async function reactCreateElement(): Promise<(tag: string, attrs: Record<string, unknown>) => unknown> {
	const react = (await import("react")) as { createElement?: unknown };
	if (typeof react.createElement !== "function") throw new Error("a fixture element stub needs react.createElement, and this package does not resolve react — the arm mocks a COMPONENT, so the runtime that draws one is part of the stub");
	return react.createElement as (tag: string, attrs: Record<string, unknown>) => unknown;
}

function propsAt(props: unknown, path: string): unknown {
	let at: unknown = props;
	for (const key of path.split(".")) {
		if (at === null || at === undefined) return undefined;
		at = (at as Record<string, unknown>)[key];
	}
	return at;
}

function buildElement(slug: string, name: string, shape: unknown, create: (tag: string, attrs: Record<string, unknown>) => unknown): (props: unknown) => unknown {
	const spec = shape as { tag?: unknown; attrs?: unknown; from_props?: unknown };
	if (spec === null || typeof spec !== "object" || typeof spec.tag !== "string" || spec.tag.length === 0) throw new Error("row " + slug + " is malformed: stub " + name + " element is {tag, attrs?, from_props?} — a component stub draws ONE declared element, and a stub with no tag is a shape no row declared");
	const attrs = (spec.attrs ?? {}) as Record<string, string>;
	const fromProps = (spec.from_props ?? {}) as Record<string, string>;
	for (const [attr, path] of Object.entries(fromProps)) {
		if (typeof attr !== "string" || attr.length === 0 || typeof path !== "string" || path.length === 0) throw new Error("row " + slug + " is malformed: stub " + name + " element.from_props maps an attribute name to a dot path into the props it is handed, got " + JSON.stringify({ attr, path }));
	}
	return (props: unknown) => {
		const merged: Record<string, unknown> = { ...attrs };
		for (const [attr, path] of Object.entries(fromProps)) {
			const value = propsAt(props, path);
			if (value !== undefined) merged[attr] = JSON.stringify(value);
		}
		return create(spec.tag as string, merged);
	};
}

async function withStubs<T>(row: Vector, fn: () => Promise<T>): Promise<T> {
	const stubs = (row.fixtures?.stubs ?? []) as Stub[];
	if (stubs.length === 0) {
		const result = await fn();
		returnOutcome(row.slug, ACTIVE_RECORDERS, row.outcomes as Record<string, Vector[]> | undefined);
		return result;
	}
	const slug = row.slug;
	for (const stub of stubs) {
		if (stub.module === undefined && stub.global === undefined) throw new Error("row " + slug + " is malformed: a fixture stub names neither module nor global — a stub answers a module export or the bare global");
		if (stub.record !== undefined) declareRecorder(String(stub.record));
		if (stub.value !== undefined && stub.global === undefined) throw new Error("row " + slug + " is malformed: a fixture stub declares value without global — value INSTALLS an object over a bare global; on a module export the thing to state is the value that export returns");
		if (stub.element !== undefined && (stub.module === undefined || stub.export === undefined)) throw new Error("row " + slug + " is malformed: a fixture stub declares element without module and export — an element stub draws a component another module exports, and names nothing without those two");
	}
	const moduleStubs = stubs.filter((stub) => stub.module !== undefined);
	const globalStubs = stubs.filter((stub) => stub.global !== undefined);
	const paths = [...new Set(moduleStubs.map((stub) => stubPath(row, stub)))];
	const needsElement = moduleStubs.some((stub) => stub.element !== undefined);
	const createElement = needsElement ? await reactCreateElement() : undefined;
	for (const path of paths) {
		const group = moduleStubs.filter((stub) => stubPath(row, stub) === path);
		const exported: Record<string, unknown> = {};
		for (const name of new Set(group.map((stub) => String(stub.export)))) {
			const arms = group.filter((stub) => String(stub.export) === name);
			const elementArm = arms.find((stub) => stub.element !== undefined);
			if (elementArm !== undefined) {
				if (arms.length > 1) throw new Error("row " + slug + " is malformed: stub " + name + " declares both element and " + (arms.length - 1) + " answering arm(s) — an element stub draws a component, and an answering arm returns data; one export is one or the other");
				exported[name] = buildElement(slug, name, elementArm.element, createElement as (tag: string, attrs: Record<string, unknown>) => unknown);
				continue;
			}
			exported[name] = (...args: unknown[]) => {
				const call: Call = { args };
				for (const recorder of new Set(arms.map((arm) => arm.record))) {
					if (recorder !== undefined) (ACTIVE_RECORDERS[recorder] ??= []).push(call);
				}
				return decodeStubReturn(stubReturn(slug, arms, call));
			};
		}
		mock.module(path, () => exported);
	}
	const target = globalThis as Record<string, unknown>;
	const savedGlobals: [string, unknown][] = [];
	for (const name of new Set(globalStubs.map((stub) => String(stub.global)))) {
		const arms = globalStubs.filter((stub) => String(stub.global) === name);
		savedGlobals.push([name, target[name]]);
		const valueArm = arms.find((stub) => stub.value !== undefined);
		if (valueArm !== undefined) {
			if (arms.length > 1) throw new Error("row " + slug + " is malformed: stub " + name + " declares both value and " + (arms.length - 1) + " answering arm(s) — an object install replaces the global, an answering arm stands in for it being called; one global is one or the other");
			target[name] = valueArm.value;
			continue;
		}
		target[name] = (...callArgs: unknown[]) => {
			const call: Call = { args: callArgs };
			for (const recorder of new Set(arms.map((arm) => arm.record))) {
				if (recorder !== undefined) (ACTIVE_RECORDERS[recorder] ??= []).push(call);
			}
			return decodeStubReturn(stubReturn(slug, arms, call));
		};
	}
	try {
		const result = await fn();
		returnOutcome(slug, ACTIVE_RECORDERS, row.outcomes as Record<string, Vector[]> | undefined);
		return result;
	} finally {
		for (const [name, original] of savedGlobals) target[name] = original;
	}
}

function hasFixtures(row: Vector): boolean {
	return Array.isArray(row.fixtures?.stubs) && (row.fixtures!.stubs as Stub[]).length > 0;
}

function hasHoist(row: Vector): boolean {
	return Array.isArray(row.hoist) && (row.hoist as unknown[]).length > 0;
}
function hasThen(row: Vector): boolean {
	return Array.isArray(row.then) && (row.then as unknown[]).length > 0;
}
function hasCallEach(row: Vector): boolean {
	return Array.isArray(row.then_call_each) && (row.then_call_each as unknown[]).length > 0;
}
interface Recorded { field: string; method: string; args: unknown[] }
function recordingAccessor(sink: Recorded[]): unknown {
	return new Proxy({}, {
		get(_target, field) {
			return new Proxy({}, {
				get(_t2, method) {
					return (...args: unknown[]) => {
						const recorded: Recorded = { field: String(field), method: String(method), args };
						sink.push(recorded);
						return recorded;
						};
				},
			});
		},
	});
}
async function callReturned(slug: string, returned: unknown, spec: Vector): Promise<void> {
	if (typeof returned !== "function") throw new Error("row " + slug + " declares then_return but the call returned " + (returned === null ? "null" : typeof returned) + ", not a callable to invoke — a factory is the only subject this arm reaches");
	const args = await Promise.all(((spec.args ?? []) as unknown[]).map((a) => decodeValue(a)));
	try {
		const answer = await (returned as (...a: unknown[]) => unknown)(...args);
		if (spec.expect_error !== undefined) throw new Error("row " + slug + " declares expect_error but the returned callable RESOLVED with " + JSON.stringify(answer) + " — an error row must be answered by a rejection");
		expect(answer).toEqual(spec.expect);
	} catch (err) {
		if (spec.expect_error === undefined) throw err;
		if (!String((err as Error).message).includes(String(spec.expect_error))) throw new Error("row " + slug + " then_return rejected with " + JSON.stringify(String((err as Error).message)) + ", which does not carry " + JSON.stringify(String(spec.expect_error)));
	}
}
async function callEach(slug: string, returned: unknown, want: unknown): Promise<void> {
	if (!Array.isArray(returned)) throw new Error("row " + slug + " declares then_call_each but the call returned " + (returned === null ? "null" : typeof returned) + ", not a list of predicates to call");
	const declared = want as Recorded[];
	const recorded: Recorded[] = [];
	const accessor = recordingAccessor(recorded);
	for (const [index, predicate] of (returned as unknown[]).entries()) {
		if (typeof predicate !== "function") throw new Error("row " + slug + " then_call_each element " + index + " is " + (predicate === null ? "null" : typeof predicate) + " — a list element nobody can call is not a predicate");
		await (predicate as (acc: unknown) => unknown)(accessor);
	}
	const shape = (calls: Recorded[]): unknown => calls.map((call) => ({ field: call.field, method: call.method, args: call.args }));
	if (JSON.stringify(shape(recorded)) !== JSON.stringify(declared.map((call) => ({ field: String((call as Recorded).field), method: String((call as Recorded).method), args: (call as Recorded).args })))) {
		throw new Error("row " + slug + " then_call_each did not hold:\n  the subject emitted " + JSON.stringify(shape(recorded)) + "\n  the row declared  " + JSON.stringify(declared));
	}
}

function runIsolated(row: Vector): void {
	const child = Bun.spawnSync(["bun", "test", SELF, "--test-name-pattern", row.slug], {
		cwd: ROOT,
		env: { ...process.env, SCALA_CONTRACT_ROW: row.slug },
		stdout: "pipe",
		stderr: "pipe",
	});
	if (child.exitCode !== 0) {
		const evidence = (child.stderr.toString() || child.stdout.toString()).trimEnd().split("\n").slice(-14).join("\n");
		throw new Error(`row ${row.slug} failed in its isolated run:\n${evidence}`);
	}
}

function returnOutcome(slug: string, recorders: Record<string, Call[]>, outcomes?: Record<string, Vector[]>): void {
	if (outcomes === undefined) return;
	for (const [recorder, predicates] of Object.entries(outcomes)) {
		const calls = recorders[recorder] ?? [];
		for (const predicate of predicates) {
			if (predicate.nth !== undefined) {
				for (const key of Object.keys(predicate)) {
					if (key !== "nth" && key !== "member_equals") throw new Error(`row ${slug} is malformed: outcome ${recorder}.${key} beside nth — the recorded-call predicate is {nth, member_equals} and nothing else`);
				}
				const at = calls[Number(predicate.nth)];
				if (at === undefined) throw new Error(`row ${slug} outcome ${recorder} asserts call #${predicate.nth} and only ${calls.length} were recorded`);
				if (predicate.member_equals !== undefined) {
					for (const [path, want] of Object.entries(predicate.member_equals as Record<string, unknown>)) {
						expect(memberAt({ args: at.args }, path)).toEqual(want);
					}
				}
				continue;
			}
			if (predicate.member_equals !== undefined) throw new Error(`row ${slug} is malformed: outcome ${recorder}.member_equals without nth — member_equals on an outcome asserts a recorded CALL; spell {nth, member_equals}`);
			for (const verb of Object.keys(predicate)) {
				if (!(OUTCOME_VERBS as readonly string[]).includes(verb)) {
					throw new Error(
						`row ${slug} is malformed: outcome ${recorder}.${verb} is not a declared verb ` +
						JSON.stringify(OUTCOME_VERBS) + " — a predicate this runner does not understand is a case it stopped asserting");
				}
			}
			const say: (verb: string) => never = (verb) => {
				throw new Error(`row ${slug} outcome ${recorder}.${verb} did not hold`);
			};
			if (predicate.count !== undefined && calls.length !== Number(predicate.count)) say("count");
			if (predicate.sql_absent !== undefined) {
				for (const call of calls) {
					if (typeof call.args[0] === "string" && (call.args[0] as string).includes(String(predicate.sql_absent))) say("sql_absent");
				}
			}
			const text = JSON.stringify(calls);
			if (predicate.contains !== undefined && !text.includes(String(predicate.contains))) say("contains");
			if (predicate.absent !== undefined && text.includes(String(predicate.absent))) say("absent");
			if (predicate.equals !== undefined && text !== JSON.stringify(predicate.equals)) say("equals");
			if (predicate.sql_contains !== undefined && !calls.some((call) => typeof call.args[0] === "string" && (call.args[0] as string).includes(String(predicate.sql_contains)))) say("sql_contains");
			if (predicate.binds !== undefined) {
				const selected = predicate.sql_contains === undefined
					? calls[0]
					: calls.find((call) => typeof call.args[0] === "string" && (call.args[0] as string).includes(String(predicate.sql_contains)));
				if (selected === undefined) say("binds");
				const templateStringsAt = selected.args.findIndex((arg) => Array.isArray(arg) && "raw" in (arg as object));
				const binds = templateStringsAt >= 0 ? selected.args.slice(templateStringsAt + 1) : selected.args.find((arg) => Array.isArray(arg));
				if (JSON.stringify(binds) !== JSON.stringify(predicate.binds)) say("binds");
			}
		}
	}
}
function runRow(row: Vector): Promise<void> | void {
	assertWellFormed(row);
	ACTIVE_RECORDERS = {};
	if (SELECTED === undefined && (hasFixtures(row) || hasHoist(row))) return runIsolated(row);
	if (isRenderRow(row.expect, row.args as unknown[] | undefined)) return renderRow(row);
	if (isHook(row.expect)) return hookRow(row);
	if (row.suite_type === "fs_flow") return runFsFlow(row);
	if (row.template !== undefined && row.template !== null) {
		if (row.args !== undefined && row.args !== null) throw new Error("row " + row.slug + " declares both args and template — a tagged-template subject takes its statement as template, and two ways to say the same call is a row whose intent is unreadable");
		return expectCall(row, row.export, decodeTemplate(row.slug, row.template as Record<string, unknown>));
	}
	return expectCall(row, row.export, row.args ?? []);
}

describe("@teamscala/container function_call contracts", () => {
	for (const row of ROWS) {
		if (SELECTED !== undefined && row.slug !== SELECTED) continue;
		it(row.slug, async () => {
			await runRow(row);
		});
	}
});
