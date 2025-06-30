import { useEffect, useState } from 'react'
import {
    createHighlighter,
    type BundledLanguage,
    type BundledTheme,
    type HighlighterGeneric,
} from 'shiki'

let hightlighter = createHighlighter({
    themes: ['github-light'],
    langs: [
        'javascript',
        'typescript',
        'jsx',
        'tsx',
        'css',
        'html',
        'json',
        'markdown',
        'python',
        'java',
        'go',
        'rust',
        'php',
        'ruby',
        'shell',
        'yaml',
        'xml',
        'sql',
        'bash',
    ],
})

export function useShiki() {
    const [highlighter, setHighlighter] =
        useState<HighlighterGeneric<BundledLanguage, BundledTheme>>()

    useEffect(() => {
        hightlighter.then((h) => setHighlighter(h))
    }, [])

    return highlighter
}
