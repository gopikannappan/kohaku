import initWasm, { initLogging, type LogLevel } from "../pkg";
import { setTsLogLevel } from "./logger.js";
export * from '../pkg/index';
export type { RailgunPlugin, RailgunPluginConfig, BundlerConfig, RGInstance, RGNote } from "./plugin.js";
export { createRailgunPlugin } from "./plugin.js";

let initPromise: Promise<void> | null = null;
// initLogging installs a process-global tracing dispatcher via
// tracing_wasm::set_as_global_default, which PANICS if called twice ("a global
// default trace dispatcher has already been set"). ensureInitialized is called
// once per plugin instance, so guard the logger init to run exactly once;
// otherwise a second instance (e.g. a network switch or a POI-mode flip) traps
// the WASM and corrupts the shared module for the rest of the session.
let loggingInitialized = false;

export async function ensureInitialized(wasmInput?: BufferSource | Response, logLevel?: LogLevel): Promise<void> {
    if (!initPromise) initPromise = _init(wasmInput);
    await initPromise;
    const level = logLevel ?? "Off";
    if (!loggingInitialized) {
        try { initLogging(level); } catch { /* global dispatcher already set */ }
        loggingInitialized = true;
    }
    setTsLogLevel(level);
}

async function _init(wasmInput?: BufferSource | Response): Promise<void> {
    if (!wasmInput && typeof process !== 'undefined') {
        const { readFile } = await import('node:fs/promises');
        const { fileURLToPath } = await import('node:url');
        const { dirname, join } = await import('node:path');
        const dir = dirname(fileURLToPath(import.meta.url));
        wasmInput = new Uint8Array(await readFile(join(dir, '../pkg/index_bg.wasm')));
    }
    await initWasm(wasmInput !== undefined ? { module_or_path: wasmInput } : undefined);
}
