import { diffWords } from 'diff'

export type DiffSegment = {
    text: string
    changed: boolean
}

export type DiffLine = {
    type: 'add' | 'remove' | 'context' | 'header'
    content: string
    oldLineNumber?: number
    newLineNumber?: number
    segments?: DiffSegment[]
}

export function parseDiff(patch: string): DiffLine[] {
    const lines = patch.split('\n')
    const result: DiffLine[] = []
    let oldLine = 0
    let newLine = 0

    for (const line of lines) {
        if (line.startsWith('@@')) {
            const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/)
            if (match) {
                oldLine = parseInt(match[1])
                newLine = parseInt(match[2])
            }
            result.push({ type: 'header', content: line })
        } else if (line.startsWith('+')) {
            result.push({ type: 'add', content: line.slice(1), newLineNumber: newLine++ })
        } else if (line.startsWith('-')) {
            result.push({ type: 'remove', content: line.slice(1), oldLineNumber: oldLine++ })
        } else if (line.startsWith(' ')) {
            result.push({
                type: 'context',
                content: line.slice(1),
                oldLineNumber: oldLine++,
                newLineNumber: newLine++,
            })
        }
    }

    return result
}

export function computeInlineHighlights(lines: DiffLine[]): DiffLine[] {
    const result: DiffLine[] = []
    let i = 0

    while (i < lines.length) {
        const line = lines[i]

        // Look for remove followed by add (a modification)
        if (line?.type === 'remove' && lines[i + 1]?.type === 'add') {
            const oldLine = line
            const newLine = lines[i + 1]

            const changes = diffWords(oldLine.content, newLine.content)

            // Build segments for the removed line
            const oldSegments: DiffSegment[] = []
            const newSegments: DiffSegment[] = []

            for (const part of changes) {
                if (part.removed) {
                    oldSegments.push({ text: part.value, changed: true })
                } else if (part.added) {
                    newSegments.push({ text: part.value, changed: true })
                } else {
                    oldSegments.push({ text: part.value, changed: false })
                    newSegments.push({ text: part.value, changed: false })
                }
            }

            result.push({ ...oldLine, segments: oldSegments })
            result.push({ ...newLine, segments: newSegments })
            i += 2
        } else if (line) {
            result.push(line)
            i++
        }
    }

    return result
}
