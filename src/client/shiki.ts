import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { type Highlighter, type ShikiTransformer } from 'shiki'

export function parseMarkdown(unparsed: string) {
    let contents = marked(unparsed) as string
    contents = DOMPurify.sanitize(contents)

    // @ts-ignore
    return contents as TrustedHTML
}

export function parseCode(
    opts: CreateTransformerOptions,
    highlighter: Highlighter,
    code: string,
    language: string,
) {
    try {
        const html = highlighter.codeToHtml(code, {
            lang: language || 'text',
            theme: 'github-light',
            transformers: [createTransformer(opts, code)],
        })

        const sanitized = DOMPurify.sanitize(html)

        // @ts-ignore
        return sanitized as TrustedHTML
    } catch (err) {
        console.error(err)
        return null
    }
}

export type HighlightRange = {
    start: number
    end: number
}

export type CreateTransformerOptions = {
    showLines?: boolean
    highlightRanges?: HighlightRange[]
    startLineNumber?: number
}

function createTransformer(opts: CreateTransformerOptions, code: string): ShikiTransformer {
    // Calculate which characters need highlighting
    const highlightChars = new Set<number>()
    for (const match of opts.highlightRanges ?? []) {
        for (let i = match.start; i < match.end; i++) {
            highlightChars.add(i)
        }
    }

    let totalLines = code.split('\n').length
    let currentCharIndex = 0

    return {
        span(el) {
            let tokenText: string
            const firstChild = el.children[0]
            if (firstChild?.type === 'text') {
                tokenText = firstChild.value
            } else return

            const tokenLength = tokenText.length

            // Find which parts of this token need highlighting
            const highlightRanges: Array<{ start: number; end: number }> = []
            let rangeStart = -1

            for (let i = 0; i < tokenLength; i++) {
                const globalIndex = currentCharIndex + i
                const shouldHighlight = highlightChars.has(globalIndex)

                if (shouldHighlight && rangeStart === -1) {
                    rangeStart = i
                } else if (!shouldHighlight && rangeStart !== -1) {
                    highlightRanges.push({ start: rangeStart, end: i })
                    rangeStart = -1
                }
            }

            // Close any open range at end of token
            if (rangeStart !== -1) {
                highlightRanges.push({ start: rangeStart, end: tokenLength })
            }

            // If we have partial highlights, split the token
            if (
                highlightRanges.length > 0 &&
                (highlightRanges.length > 1 ||
                    highlightRanges[0]!.start > 0 ||
                    highlightRanges[0]!.end < tokenLength)
            ) {
                el.children = []
                let pos = 0

                for (const range of highlightRanges) {
                    // Add unhighlighted part before range
                    if (range.start > pos) {
                        el.children.push({
                            type: 'text',
                            value: tokenText.slice(pos, range.start),
                        })
                    }

                    // Add highlighted part
                    el.children.push({
                        type: 'element',
                        tagName: 'span',
                        properties: {
                            className: ['bg-yellow-300', 'bg-opacity-40'],
                        },
                        children: [
                            {
                                type: 'text',
                                value: tokenText.slice(range.start, range.end),
                            },
                        ],
                    })

                    pos = range.end
                }

                // Add remaining unhighlighted part
                if (pos < tokenLength) {
                    el.children.push({
                        type: 'text',
                        value: tokenText.slice(pos),
                    })
                }
            } else if (
                highlightRanges.length === 1 &&
                highlightRanges[0]!.start === 0 &&
                highlightRanges[0]!.end === tokenLength
            ) {
                // Highlight entire token
                this.addClassToHast(el, 'bg-yellow-300 bg-opacity-40')
            }

            currentCharIndex += tokenLength
        },
        line(el, line) {
            const displayLineNumber = (opts.startLineNumber ?? 1) + line - 1
            // Add line number as data attribute for CSS to use
            el.properties['data-line'] = displayLineNumber

            // Add newline character to our tracking (except for last line)
            if (line < totalLines) {
                currentCharIndex += 1 // for \n character
            }
        },
        pre(el) {
            // Reset character index for each render
            currentCharIndex = 0

            // Add class for line numbers styling if enabled
            if (opts.showLines) {
                this.addClassToHast(el, 'show-line-numbers')
            }
        },
    }
}
