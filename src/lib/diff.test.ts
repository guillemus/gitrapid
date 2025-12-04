import { describe, expect, it } from 'vitest'
import { computeInlineHighlights, type DiffLine } from './diff'

describe('computeInlineHighlights', () => {
    it('highlights word changes between remove/add pairs - server.preset to vite.config.ts example', () => {
        const oldContent =
            '* You need to make sure the `server.preset` value in the `app.config.ts` is set to `aws-lambda`.'
        const newContent =
            '* You need to make sure the `vite.config.ts` file is configured to use Nitro for deployments on aws-lambda by adding the `nitro` property and setting the `preset` to `aws-lambda`.'

        const lines: DiffLine[] = [
            { type: 'remove', content: oldContent, oldLineNumber: 279 },
            { type: 'add', content: newContent, newLineNumber: 279 },
        ]

        const result = computeInlineHighlights(lines)

        expect(result).toHaveLength(2)

        // Old line should have segments
        expect(result[0].segments).toBeDefined()
        expect(result[0].type).toBe('remove')

        // New line should have segments
        expect(result[1].segments).toBeDefined()
        expect(result[1].type).toBe('add')

        // Reconstructed old line should match original
        const oldReconstructed = result[0].segments?.map((s) => s.text).join('') || ''
        expect(oldReconstructed).toBe(oldContent)

        // Reconstructed new line should match original
        const newReconstructed = result[1].segments?.map((s) => s.text).join('') || ''
        expect(newReconstructed).toBe(newContent)

        // Check that there are changed segments in old line
        const oldChangedCount = result[0].segments?.filter((s) => s.changed).length || 0
        expect(oldChangedCount).toBeGreaterThan(0)

        // Check that there are changed segments in new line
        const newChangedCount = result[1].segments?.filter((s) => s.changed).length || 0
        expect(newChangedCount).toBeGreaterThan(0)
    })

    it('handles single word change', () => {
        const lines: DiffLine[] = [
            { type: 'remove', content: 'const foo = 1', oldLineNumber: 1 },
            { type: 'add', content: 'const bar = 1', newLineNumber: 1 },
        ]

        const result = computeInlineHighlights(lines)

        expect(result).toHaveLength(2)
        expect(result[0].segments?.map((s) => s.text).join('')).toBe('const foo = 1')
        expect(result[1].segments?.map((s) => s.text).join('')).toBe('const bar = 1')

        // foo should be marked as changed
        const fooSegment = result[0].segments?.find((s) => s.text === 'foo')
        expect(fooSegment?.changed).toBe(true)

        // bar should be marked as changed
        const barSegment = result[1].segments?.find((s) => s.text === 'bar')
        expect(barSegment?.changed).toBe(true)
    })

    it('leaves context lines unchanged', () => {
        const lines: DiffLine[] = [
            { type: 'context', content: 'some context line', oldLineNumber: 1, newLineNumber: 1 },
        ]

        const result = computeInlineHighlights(lines)

        expect(result).toHaveLength(1)
        expect(result[0].segments).toBeUndefined()
        expect(result[0].content).toBe('some context line')
    })

    it('leaves header lines unchanged', () => {
        const lines: DiffLine[] = [{ type: 'header', content: '@@ -1,5 +1,6 @@' }]

        const result = computeInlineHighlights(lines)

        expect(result).toHaveLength(1)
        expect(result[0].segments).toBeUndefined()
        expect(result[0].content).toBe('@@ -1,5 +1,6 @@')
    })

    it('handles remove-only line (no following add)', () => {
        const lines: DiffLine[] = [
            { type: 'remove', content: 'deleted line', oldLineNumber: 1 },
            { type: 'context', content: 'next context line', oldLineNumber: 2, newLineNumber: 1 },
        ]

        const result = computeInlineHighlights(lines)

        expect(result).toHaveLength(2)
        expect(result[0].segments).toBeUndefined()
        expect(result[0].type).toBe('remove')
    })

    it('handles add-only line (no preceding remove)', () => {
        const lines: DiffLine[] = [
            { type: 'context', content: 'previous context', oldLineNumber: 1, newLineNumber: 1 },
            { type: 'add', content: 'new added line', newLineNumber: 2 },
        ]

        const result = computeInlineHighlights(lines)

        expect(result).toHaveLength(2)
        expect(result[1].segments).toBeUndefined()
        expect(result[1].type).toBe('add')
    })

    it('handles multiple consecutive removes then adds (does not pair them)', () => {
        const lines: DiffLine[] = [
            { type: 'remove', content: 'removed line 1', oldLineNumber: 1 },
            { type: 'remove', content: 'removed line 2', oldLineNumber: 2 },
            { type: 'add', content: 'added line 1', newLineNumber: 1 },
            { type: 'add', content: 'added line 2', newLineNumber: 2 },
        ]

        const result = computeInlineHighlights(lines)

        // First remove should NOT have segments (followed by another remove, not an add)
        expect(result[0].segments).toBeUndefined()
        // Second remove should have segments (followed by add)
        expect(result[1].segments).toBeDefined()
        // First add should have segments (preceded by remove)
        expect(result[2].segments).toBeDefined()
        // Second add should NOT have segments (not preceded by a direct remove)
        expect(result[3].segments).toBeUndefined()
    })

    it('preserves line numbers through transformation', () => {
        const lines: DiffLine[] = [
            { type: 'remove', content: 'old content', oldLineNumber: 42 },
            { type: 'add', content: 'new content', newLineNumber: 42 },
        ]

        const result = computeInlineHighlights(lines)

        expect(result[0].oldLineNumber).toBe(42)
        expect(result[1].newLineNumber).toBe(42)
    })
})
