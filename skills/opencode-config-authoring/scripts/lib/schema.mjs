// Published-schema handling: best-effort fetch plus the unknown-top-level-key
// check. Network is the only asynchronous part, kept away from the sync checks.

export const SCHEMA_URL = "https://opencode.ai/config.json"

export async function loadSchema(report, { enabled = true } = {}) {
  if (!enabled) return null
  try {
    const res = await fetch(SCHEMA_URL, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) {
      report.warn(`schema fetch returned HTTP ${res.status}; skipped schema checks`)
      return null
    }
    return await res.json()
  } catch (e) {
    report.warn(`schema fetch failed (${e.message}); ran local checks only`)
    return null
  }
}

function rootProperties(node) {
  if (!node || node.$ref) return null
  return node.properties ?? null
}

export function checkUnknownKeys(cfg, schema, report) {
  if (!schema) return

  // The published root is `{"$ref": "#/$defs/Config", ...}`, so the real property
  // list lives behind the ref rather than at the top level.
  const refName = String(schema.$ref ?? "").split("/").pop()
  const props = rootProperties(refName ? schema.$defs?.[refName] : schema)

  if (!props) {
    report.warn("could not resolve schema root properties; skipped unknown-key check")
    return
  }

  if (refName) {
    console.log(`schema: resolved #/$defs/${refName} (${Object.keys(props).length} top-level keys)`)
  }

  for (const key of Object.keys(cfg)) {
    if (!(key in props)) {
      report.err(`unknown top-level key "${key}" (additionalProperties: false -> ConfigInvalidError)`)
    }
  }
}
