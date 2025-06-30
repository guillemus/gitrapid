import DOMPurify from 'dompurify'
import type { ShikiTransformer } from 'shiki'
import { useShiki } from './shiki'

function createTransformer(props: ShikiCodeBlockProps): ShikiTransformer {
    // Calculate which characters need highlighting
    const highlightChars = new Set<number>()
    for (const match of props.highlightIndices ?? []) {
        for (let i = match.start; i < match.end; i++) {
            highlightChars.add(i)
        }
    }

    let currentCharIndex = 0

    return {
        span(el, line, col, offset) {
            let tokenText: string
            let firstChild = el.children[0]
            if (firstChild.type === 'text') {
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
                    highlightRanges[0].start > 0 ||
                    highlightRanges[0].end < tokenLength)
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
                highlightRanges[0].start === 0 &&
                highlightRanges[0].end === tokenLength
            ) {
                // Highlight entire token
                this.addClassToHast(el, 'bg-yellow-300 bg-opacity-40')
            }

            currentCharIndex += tokenLength
        },
        line(el, line) {
            const displayLineNumber = (props.startLineNumber ?? 1) + line - 1

            // Add line number as data attribute
            el.properties['data-line'] = displayLineNumber

            // Add highlight class for line ranges (if still needed)
            for (let range of props.highlightLines ?? []) {
                if (displayLineNumber >= range.start && displayLineNumber <= range.end) {
                    this.addClassToHast(el, 'bg-blue-200 bg-opacity-20')
                }
            }

            // Add newline character to our tracking (except for last line)
            if (line < props.code.split('\n').length) {
                currentCharIndex += 1 // for \n character
            }
        },
        pre(el) {
            // Reset character index for each render
            currentCharIndex = 0

            // Add CSS for line numbers with counter
            this.addClassToHast(el, 'relative')
            el.properties.style = `
                counter-reset: line-number ${(props.startLineNumber ?? 1) - 1};
                padding-left: 3.5rem;
            `
        },
    }
}

type HighlightRange = {
    start: number
    end: number
}

type ShikiCodeBlockProps = {
    code: string
    language?: string
    highlightIndices?: HighlightRange[]
    highlightLines?: HighlightRange[]
    startLineNumber?: number
}

export function ShikiCodeBlock(props: ShikiCodeBlockProps) {
    const highlighter = useShiki()

    // Skip highlighting for very large files (>100KB or >5000 lines)
    const isLargeFile = props.code.length > 100000 || props.code.split('\n').length > 5000

    if (!highlighter) return null

    if (isLargeFile) {
        return (
            <pre
                className="bg-gray-900 p-4 text-sm text-gray-100"
                style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}
            >
                <code>{props.code}</code>
            </pre>
        )
    }

    try {
        let html = highlighter.codeToHtml(props.code, {
            lang: props.language || 'text',
            theme: 'github-dark',
            transformers: [createTransformer(props)],
        })

        return (
            <div
                className="overflow-x-auto text-sm"
                style={{ whiteSpace: 'pre', fontFamily: 'monospace' }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
            />
        )
    } catch (error) {
        console.error(error)
        // Fallback for unsupported languages
        return (
            <pre
                className="bg-gray-900 p-4 text-sm text-gray-100"
                style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}
            >
                <code>{props.code}</code>
            </pre>
        )
    }
}
