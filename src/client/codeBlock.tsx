import { useEffect, useRef } from 'react'
import { parseCode, type CreateTransformerOptions } from './shiki'
// import { useShiki } from './highlighter'

export function CodeBlock(props: { code: TrustedHTML; highlightedLine?: number }) {
    let ref = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!ref.current || !props.highlightedLine) return

        let line = ref.current.querySelector(`.line[data-line="${props.highlightedLine}"]`)
        if (line) {
            line.classList.remove('bg-red-200')
            line.classList.add('bg-red-200')
        }
    }, [])

    return (
        <div
            ref={ref}
            className="overflow-x-auto overflow-y-hidden text-sm"
            style={{ whiteSpace: 'pre', fontFamily: 'monospace' }}
            dangerouslySetInnerHTML={{ __html: props.code }}
        />
    )
}

export function MarkdownBlock(props: { markdown: TrustedHTML }) {
    return (
        <div
            className="markdown-body max-w-none flex-1 p-8"
            dangerouslySetInnerHTML={{ __html: props.markdown }}
        />
    )
}

// type CodeBlockWithParsingProps = CreateTransformerOptions & { code: string; language: string }

// export function CodeBlockWithParsing(props: CodeBlockWithParsingProps) {
//     let highlighter = useShiki()
//     if (!highlighter) return highlighter

//     let parsed = parseCode(props, highlighter, props.code, props.language)
//     if (!parsed) return null

//     return <CodeBlock code={parsed}></CodeBlock>
// }
