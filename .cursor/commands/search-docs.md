# Web Documentation Lookup

## Overview
Template for a command that prioritizes web-based documentation lookup for technologies, APIs, libraries, or concepts. Uses codebase context as reinforcement to validate or illustrate findings, but primary source is external official docs. Avoids limiting searches to local codebase only.

## Usage
- Input: Query with context (e.g., "Node.js fs module docs, based on my use in src/utils.js").
- Output: Web-sourced docs summary, code examples, official links; reinforced with relevant codebase snippets for comparison.
- Tools: Web search engine for docs; local codebase scanner for verification (secondary).

## Steps
1. **Extract Query and Context**
   - Identify core topic (e.g., "fs module in Node.js").
   - Note codebase details as optional reinforcement (e.g., "Compare to local usage in project").

2. **Web-Centric Search**
   - Formulate 1-2 precise queries (e.g., "Node.js 20 fs module official documentation").
   - Target official sources: Use operators like "site:nodejs.org" or "official docs".
   - Fetch from web: Prioritize recent versions; ignore local files unless reinforcing.

3. **Reinforce with Codebase**
   - Scan local codebase post-web search for matching patterns or usage.
   - Use as validation: Highlight alignments/mismatches (e.g., "Your code uses deprecated method; web docs recommend async alternative").
   - Do not rely on codebase as primary source.

4. **Synthesize Results**
   - Summarize web docs: Key concepts, APIs, examples.
   - Integrate reinforcement: "Based on your codebase file X, this aligns with Y but consider Z update."
   - Provide actionables: Migration tips if needed.

## Lookup Checklist
- [ ] Primary source is web docs (official domains prioritized)
- [ ] Query specifies version/latest for recency
- [ ] Codebase scan used only for context/reinforcement
- [ ] Results include direct links and excerpts
- [ ] Any local-web discrepancies noted
- [ ] No exclusive reliance on local files