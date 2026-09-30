// Strip JSONC comments and trailing commas so that JSON.parse accepts the
// result. Pure text transform with no filesystem or network dependency.

export function stripJsonc(input) {
  let text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
  let out = ""
  let i = 0
  const n = text.length
  let inStr = false

  while (i < n) {
    const c = text[i]

    if (inStr) {
      out += c
      if (c === "\\") {
        out += text[i + 1] ?? ""
        i += 2
        continue
      }
      if (c === '"') inStr = false
      i++
      continue
    }

    if (c === '"') {
      inStr = true
      out += c
      i++
      continue
    }

    if (c === "/" && text[i + 1] === "/") {
      while (i < n && text[i] !== "\n") i++
      continue
    }

    if (c === "/" && text[i + 1] === "*") {
      i += 2
      while (i < n && !(text[i] === "*" && text[i + 1] === "/")) i++
      i += 2
      continue
    }

    out += c
    i++
  }

  return out.replace(/,(\s*[}\]])/g, "$1")
}
