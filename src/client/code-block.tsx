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

type CodeBlockWithParsingProps = CreateTransformerOptions & { code: string; language: string }

export function CodeBlockWithParsing(props: CodeBlockWithParsingProps) {
    let highlighter = useShiki()
    if (!highlighter) return highlighter

    let parsed = parseCode(props, highlighter, props.code, props.language)
    if (!parsed) return null

    return <CodeBlock code={parsed}></CodeBlock>
}
