import { parseCode, useShiki, type CreateTransformerOptions } from './shiki'

export function CodeBlock(props: { code: TrustedHTML }) {
    return (
        <div
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

type CodeBlockWithParsingProps = CreateTransformerOptions & { code: string; language: string }

export function CodeBlockWithParsing(props: CodeBlockWithParsingProps) {
    let highlighter = useShiki()
    if (!highlighter) return highlighter

    let parsed = parseCode(props, highlighter, props.code, props.language)
    if (!parsed) return null

    return <CodeBlock code={parsed}></CodeBlock>
}
