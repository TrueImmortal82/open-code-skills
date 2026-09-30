import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

// Resolves correctly whether opencode loads this package from a cloned
// directory, a file: dependency, or a node_modules install.
const root = dirname(fileURLToPath(import.meta.url))
const skillsDir = join(root, "skills")

// The `config` hook receives the live config object; its return value is
// discarded and thrown errors are swallowed by the host, so this mutates in
// place and must never throw.
function registerSkills(config) {
  if (!config || typeof config !== "object") return

  if (config.skills === undefined) config.skills = {}
  const skills = config.skills
  // Never clobber an unexpected shape (e.g. a legacy array form).
  if (!skills || typeof skills !== "object" || Array.isArray(skills)) return

  if (!Array.isArray(skills.paths)) skills.paths = []
  if (!skills.paths.includes(skillsDir)) skills.paths.push(skillsDir)
}

// Single default export on purpose: the legacy loader treats every named
// export as a plugin and throws on anything that is not a function.
export default {
  id: "open-code-skills",
  server: async () => ({
    config: async (config) => {
      try {
        registerSkills(config)
      } catch {
        // A broken config shape must not take the session down.
      }
    },
  }),
}
