/**
 * Title-case normalization for book titles and author names.
 *
 * Rules:
 * - First and last word always capitalized.
 * - Stopwords (a, an, the, of, in, on, …) lowercase when in the middle of a clause.
 * - First word after terminal punctuation (`:`, `—`, `-`, `?`, `!`, `.`) is treated as clause-start — always capitalized.
 * - All-uppercase tokens (AI, NFL, VC, IBM, …) are preserved.
 * - Apostrophised words (Liar's, World's) stay lowercase after the apostrophe.
 * - Hyphenated words (Power-Up) capitalize each segment.
 */

const STOPWORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'en', 'for', 'from', 'if',
  'in', 'into', 'nor', 'of', 'on', 'onto', 'or', 'over', 'per',
  'so', 'than', 'the', 'to', 'up', 'upon', 'via', 'vs', 'with', 'yet'
])

// Words that have meaningful mixed-case spelling (ChatGPT, McDonald, eBoys, iPhone, MacBook).
// If the original has an uppercase letter anywhere past position 0, the author spelled it that way on purpose.
const MIXED_CASE_RE = /^[a-z][A-Z]|[A-Z].*[A-Z]/

const CLAUSE_BREAK_RE = /[:—?!.]$/

// Known brand / proper-noun corrections. Open Library often degrades these.
// Matched case-insensitively on word boundaries, replaced with the canonical form.
const BRAND_CORRECTIONS: Array<[RegExp, string]> = [
  [/\bchatgpt\b/gi, 'ChatGPT'],
  [/\bmcdonald\b/gi, 'McDonald'],
  [/\bmcdonnell\b/gi, 'McDonnell'],
  [/\bmackenzie\b/gi, 'MacKenzie'],
  [/\bmacbook\b/gi, 'MacBook'],
  [/\biphone\b/gi, 'iPhone'],
  [/\bipad\b/gi, 'iPad'],
  [/\bipod\b/gi, 'iPod'],
  [/\beboys\b/gi, 'eBoys'],
  [/\bebay\b/gi, 'eBay'],
  [/\bgithub\b/gi, 'GitHub'],
  [/\bopenai\b/gi, 'OpenAI'],
  [/\byoutube\b/gi, 'YouTube'],
  [/\bnetflix\b/gi, 'Netflix'],
  [/\btiktok\b/gi, 'TikTok'],
  [/\bai\b/gi, 'AI'],
  [/\bcia\b/gi, 'CIA'],
  [/\bfbi\b/gi, 'FBI'],
  [/\bnfl\b/gi, 'NFL'],
  [/\bnba\b/gi, 'NBA']
]
const PUNCT_STRIP_RE = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu
const ALL_CAPS_RE = /^[A-Z0-9]{2,}$/
const ROMAN_NUMERAL_RE = /^(?:M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3}))$/

function capitalizeSegment(segment: string): string {
  if (!segment) return segment
  // Preserve all-caps (after stripping edge punctuation)
  const stripped = segment.replace(PUNCT_STRIP_RE, '')
  if (ALL_CAPS_RE.test(stripped) && stripped.length >= 2) return segment
  if (ROMAN_NUMERAL_RE.test(stripped) && stripped.length >= 2) {
    return segment.replace(stripped, stripped.toUpperCase())
  }
  return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
}

/**
 * Capitalize a single word token, handling apostrophes (Liar's) and hyphens (Power-Up).
 * Apostrophe-led fragments keep the case already produced for the rest (typically lowercase).
 */
function capitalizeWord(word: string): string {
  if (!word) return word

  // Split on hyphen first — each segment gets its own capitalization
  const hyphenParts = word.split('-')
  const capsHyphen = hyphenParts.map(segment => {
    // Handle apostrophes inside this hyphen segment
    const apostrophes = ["'", '\u2019']
    const apoIdx = apostrophes
      .map(ch => segment.indexOf(ch))
      .filter(i => i > 0)
      .sort((a, b) => a - b)[0]

    if (apoIdx === undefined) {
      return capitalizeSegment(segment)
    }

    const head = segment.slice(0, apoIdx)
    const tail = segment.slice(apoIdx)
    return capitalizeSegment(head) + tail.toLowerCase()
  })
  return capsHyphen.join('-')
}

function stripToCore(word: string): string {
  return word.replace(PUNCT_STRIP_RE, '')
}

function applyBrandCorrections(text: string): string {
  let result = text
  for (const [pattern, replacement] of BRAND_CORRECTIONS) {
    result = result.replace(pattern, replacement)
  }
  return result
}

export function toTitleCase(raw: string): string {
  if (!raw) return raw
  const input = raw.trim().replace(/\s+/g, ' ')
  if (!input) return input

  const words = input.split(' ')
  let clauseStart = true

  const titled = words
    .map((word, idx) => {
      const core = stripToCore(word)
      const lowerCore = core.toLowerCase()
      const isEdge = idx === 0 || idx === words.length - 1

      // Preserve intentionally-cased acronyms (AI, NFL, VC, IBM) and mixed-case
      // brand names (ChatGPT, McDonald, eBoys, iPhone, MacBook).
      if ((ALL_CAPS_RE.test(core) && core.length >= 2) || MIXED_CASE_RE.test(core)) {
        clauseStart = CLAUSE_BREAK_RE.test(word)
        return word
      }

      let result: string
      if (!clauseStart && !isEdge && STOPWORDS.has(lowerCore)) {
        // Middle-of-clause stopword: lowercase the core but keep punctuation in place
        result = word.replace(core, lowerCore)
      } else {
        result = capitalizeWord(word)
      }

      clauseStart = CLAUSE_BREAK_RE.test(word)
      return result
    })
    .join(' ')

  return applyBrandCorrections(titled)
}

/**
 * Normalize author names — similar rules, but preserves initials like
 * "A. J. Baime" and "J. K. Rowling". Also adds missing dots to single-letter initials.
 */
export function normalizeAuthor(raw: string): string {
  if (!raw) return raw
  const parts = raw
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(word => {
      // Single-letter initials: ensure trailing dot and uppercase
      if (/^[A-Za-z]\.?$/.test(word)) return word.charAt(0).toUpperCase() + '.'
      const core = stripToCore(word)
      if (ALL_CAPS_RE.test(core) && core.length >= 2) return word
      if (MIXED_CASE_RE.test(core)) return word
      return capitalizeWord(word)
    })
    .join(' ')
  return applyBrandCorrections(parts)
}
