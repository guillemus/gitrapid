// highlighter is kept in it's own file because of HMR reasons.

import { useEffect } from 'react'
import { createHighlighter, type Highlighter } from 'shiki'
import { useMutable } from './utils'

export const hightlighterP = createHighlighter({
    themes: ['github-light'],
    langs: [
        // 'javascript',
        // 'typescript',
        // 'jsx',
        // 'tsx',
        // 'css',
        // 'html',
        // 'json',
        // 'markdown',
        // 'python',
        // 'java',
        // 'go',
        // 'rust',
        // 'php',
        // 'ruby',
        // 'shell',
        // 'yaml',
        // 'xml',
        // 'sql',
        // 'bash',
    ],
})

import.meta.hot?.dispose(() => {
    console.log('disposing of hightlighter for hmr')

    hightlighterP.then((h) => h.dispose())
})

export function useShiki() {
    const state = useMutable({
        highlighter: undefined as Highlighter | undefined,
    })

    useEffect(() => {
        hightlighterP.then((h) => {
            state.highlighter = h
        })
    }, [])

    return state.highlighter
}
