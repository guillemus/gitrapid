import { describe, expect, test } from 'vitest'
import { batchTreeFiles, MAX_FILE_SIZE } from './utils'

// fixme: reenable getRefAndPath tests

// describe('getRefAndPath', () => {
//     const repoRefs = ['main', 'develop', 'feature/auth', 'v1.0.0']

//     test('should detect commit SHA and extract path', () => {
//         const commitSha = 'a1b2c3d4e5f6789012345678901234567890abcd'
//         const result = parseRefAndPath(repoRefs, `${commitSha}/src/components/App.tsx`)

//         expect(result).toEqual({
//             ref: commitSha,
//             path: 'src/components/App.tsx',
//         })
//     })

//     test('should detect commit SHA without path', () => {
//         const commitSha = 'a1b2c3d4e5f6789012345678901234567890abcd'
//         const result = parseRefAndPath(repoRefs, commitSha)

//         expect(result).toEqual({
//             ref: commitSha,
//             path: 'README.md',
//         })
//     })

//     test('should detect branch ref with path', () => {
//         const result = parseRefAndPath(repoRefs, 'main/src/utils.ts')

//         expect(result).toEqual({
//             ref: 'main',
//             path: 'src/utils.ts',
//         })
//     })

//     test('should detect nested ref with path', () => {
//         const result = parseRefAndPath(repoRefs, 'feature/auth/src/auth/login.ts')

//         expect(result).toEqual({
//             ref: 'feature/auth',
//             path: 'src/auth/login.ts',
//         })
//     })

//     test('should detect tag ref with path', () => {
//         const result = parseRefAndPath(repoRefs, 'v1.0.0/README.md')

//         expect(result).toEqual({
//             ref: 'v1.0.0',
//             path: 'README.md',
//         })
//     })

//     test('should return null for invalid ref', () => {
//         const result = parseRefAndPath(repoRefs, 'nonexistent/src/file.ts')

//         expect(result).toBeNull()
//     })

//     test('should return null for invalid commit SHA', () => {
//         const result = parseRefAndPath(repoRefs, 'invalid-sha/src/file.ts')

//         expect(result).toBeNull()
//     })

//     test('should handle uppercase commit SHA', () => {
//         const commitSha = 'A1B2C3D4E5F6789012345678901234567890ABCD'
//         const result = parseRefAndPath(repoRefs, `${commitSha}/src/file.ts`)

//         expect(result).toEqual({
//             ref: commitSha,
//             path: 'src/file.ts',
//         })
//     })

//     test('should handle short commit SHA (7-39 chars)', () => {
//         const shortSha = 'a1b2c3d'
//         const result = parseRefAndPath(repoRefs, `${shortSha}/src/file.ts`)

//         expect(result).toBeNull()
//     })

//     test('should handle commit SHA with invalid characters', () => {
//         const invalidSha = 'g1b2c3d4e5f6789012345678901234567890abcd'
//         const result = parseRefAndPath(repoRefs, `${invalidSha}/src/file.ts`)

//         expect(result).toBeNull()
//     })

//     test('should handle empty string', () => {
//         const result = parseRefAndPath(repoRefs, '')

//         expect(result).toBeNull()
//     })

//     test('should handle single slash', () => {
//         const result = parseRefAndPath(repoRefs, '/')

//         expect(result).toBeNull()
//     })

//     test('should handle ref without path (just ref name)', () => {
//         const result = parseRefAndPath(repoRefs, 'main')

//         expect(result).toEqual({
//             ref: 'main',
//             path: 'README.md',
//         })
//     })

//     test('should handle path with special characters', () => {
//         const result = parseRefAndPath(repoRefs, 'main/src/file-name_v2.component.ts')

//         expect(result).toEqual({
//             ref: 'main',
//             path: 'src/file-name_v2.component.ts',
//         })
//     })

//     test('should prioritize longer matching ref', () => {
//         const refsWithNested = ['feature', 'feature/auth', 'feature/auth/jwt']
//         const result = parseRefAndPath(refsWithNested, 'feature/auth/jwt/src/token.ts')

//         expect(result).toEqual({
//             ref: 'feature/auth/jwt',
//             path: 'src/token.ts',
//         })
//     })

//     test('should handle ref that looks like commit but is in refs set', () => {
//         const refsWithShaLike = ['a1b2c3d4e5f6789012345678901234567890abcd']
//         const result = parseRefAndPath(
//             refsWithShaLike,
//             'a1b2c3d4e5f6789012345678901234567890abcd/src/file.ts',
//         )

//         expect(result).toEqual({
//             ref: 'a1b2c3d4e5f6789012345678901234567890abcd',
//             path: 'src/file.ts',
//         })
//     })

//     test('should handle very deep nested path', () => {
//         const result = parseRefAndPath(
//             repoRefs,
//             'main/src/components/auth/login/forms/LoginForm.tsx',
//         )

//         expect(result).toEqual({
//             ref: 'main',
//             path: 'src/components/auth/login/forms/LoginForm.tsx',
//         })
//     })
// })

describe('batchTreeFiles', () => {
    function makeFile(path: string, size?: number) {
        return { path, mode: '100644', type: 'blob', sha: 'sha', size }
    }

    test('batches files by size and count', () => {
        const files = Array.from({ length: 25 }, (_, i) => makeFile(`file${i}.js`, 100 * 1024))
        const batches = batchTreeFiles(files)
        // Each batch should have at most 8 files (8*100KB=800KB)
        expect(batches.length).toBe(4)
        expect(batches[0]?.length).toBe(8)
        expect(batches[1]?.length).toBe(8)
        expect(batches[2]?.length).toBe(8)
        expect(batches[3]?.length).toBe(1)
    })

    test('no batch exceeds MAX_FILE_SIZE', () => {
        const files = [
            makeFile('a', 400 * 1024),
            makeFile('b', 300 * 1024),
            makeFile('c', 200 * 1024),
        ]
        const batches = batchTreeFiles(files)
        for (const batch of batches) {
            const total = batch.reduce((sum, f) => sum + (f.size ?? 0), 0)
            expect(total).toBeLessThanOrEqual(MAX_FILE_SIZE)
        }
    })

    test('no batch has more than 10 files', () => {
        const files = Array.from({ length: 25 }, (_, i) => makeFile(`file${i}.js`, 10))
        const batches = batchTreeFiles(files)
        for (const batch of batches) {
            expect(batch.length).toBeLessThanOrEqual(10)
        }
    })

    test('file larger than MAX_FILE_SIZE is its own batch', () => {
        const files = [makeFile('big', MAX_FILE_SIZE + 1), makeFile('small', 10)]
        const batches = batchTreeFiles(files)
        expect(batches[0]?.length).toBe(1)
        expect(batches[0]?.[0]?.path).toBe('big')
        expect(batches[1]?.[0]?.path).toBe('small')
    })

    test('files with undefined size are treated as 0', () => {
        const files = [makeFile('a'), makeFile('b'), makeFile('c')]
        const batches = batchTreeFiles(files)
        expect(batches.length).toBe(1)
        expect(batches[0]?.length).toBe(3)
    })

    test('empty input returns empty array', () => {
        expect(batchTreeFiles([])).toEqual([])
    })

    test('all files too large: each in own batch', () => {
        const files = [makeFile('a', MAX_FILE_SIZE + 1), makeFile('b', MAX_FILE_SIZE + 2)]
        const batches = batchTreeFiles(files)
        expect(batches.length).toBe(2)
        expect(batches[0]?.[0]?.path).toBe('a')
        expect(batches[1]?.[0]?.path).toBe('b')
    })

    test('mixed sizes: large, small, large', () => {
        const files = [
            makeFile('big1', MAX_FILE_SIZE + 1),
            makeFile('small', 10),
            makeFile('big2', MAX_FILE_SIZE + 2),
        ]
        const batches = batchTreeFiles(files)
        expect(batches.length).toBe(3)
        expect(batches[0]?.[0]?.path).toBe('big1')
        expect(batches[1]?.[0]?.path).toBe('small')
        expect(batches[2]?.[0]?.path).toBe('big2')
    })
})
