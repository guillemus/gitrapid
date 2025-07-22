import { describe, test, expect } from 'vitest'
import { getRefAndPath } from './utils'

describe('getRefAndPath', () => {
    const repoRefsSet = new Set(['main', 'develop', 'feature/auth', 'v1.0.0'])

    test('should detect commit SHA and extract path', () => {
        const commitSha = 'a1b2c3d4e5f6789012345678901234567890abcd'
        const result = getRefAndPath(repoRefsSet, `${commitSha}/src/components/App.tsx`)

        expect(result).toEqual({
            ref: commitSha,
            path: 'src/components/App.tsx',
        })
    })

    test('should detect commit SHA without path', () => {
        const commitSha = 'a1b2c3d4e5f6789012345678901234567890abcd'
        const result = getRefAndPath(repoRefsSet, commitSha)

        expect(result).toEqual({
            ref: commitSha,
            path: 'README.md',
        })
    })

    test('should detect branch ref with path', () => {
        const result = getRefAndPath(repoRefsSet, 'main/src/utils.ts')

        expect(result).toEqual({
            ref: 'main',
            path: 'src/utils.ts',
        })
    })

    test('should detect nested ref with path', () => {
        const result = getRefAndPath(repoRefsSet, 'feature/auth/src/auth/login.ts')

        expect(result).toEqual({
            ref: 'feature/auth',
            path: 'src/auth/login.ts',
        })
    })

    test('should detect tag ref with path', () => {
        const result = getRefAndPath(repoRefsSet, 'v1.0.0/README.md')

        expect(result).toEqual({
            ref: 'v1.0.0',
            path: 'README.md',
        })
    })

    test('should return null for invalid ref', () => {
        const result = getRefAndPath(repoRefsSet, 'nonexistent/src/file.ts')

        expect(result).toBeNull()
    })

    test('should return null for invalid commit SHA', () => {
        const result = getRefAndPath(repoRefsSet, 'invalid-sha/src/file.ts')

        expect(result).toBeNull()
    })

    test('should handle uppercase commit SHA', () => {
        const commitSha = 'A1B2C3D4E5F6789012345678901234567890ABCD'
        const result = getRefAndPath(repoRefsSet, `${commitSha}/src/file.ts`)

        expect(result).toEqual({
            ref: commitSha,
            path: 'src/file.ts',
        })
    })

    test('should handle short commit SHA (7-39 chars)', () => {
        const shortSha = 'a1b2c3d'
        const result = getRefAndPath(repoRefsSet, `${shortSha}/src/file.ts`)

        expect(result).toBeNull()
    })

    test('should handle commit SHA with invalid characters', () => {
        const invalidSha = 'g1b2c3d4e5f6789012345678901234567890abcd'
        const result = getRefAndPath(repoRefsSet, `${invalidSha}/src/file.ts`)

        expect(result).toBeNull()
    })

    test('should handle empty string', () => {
        const result = getRefAndPath(repoRefsSet, '')

        expect(result).toBeNull()
    })

    test('should handle single slash', () => {
        const result = getRefAndPath(repoRefsSet, '/')

        expect(result).toBeNull()
    })

    test('should handle ref without path (just ref name)', () => {
        const result = getRefAndPath(repoRefsSet, 'main')

        expect(result).toEqual({
            ref: 'main',
            path: 'README.md',
        })
    })

    test('should handle path with special characters', () => {
        const result = getRefAndPath(repoRefsSet, 'main/src/file-name_v2.component.ts')

        expect(result).toEqual({
            ref: 'main',
            path: 'src/file-name_v2.component.ts',
        })
    })

    test('should prioritize longer matching ref', () => {
        const refsWithNested = new Set(['feature', 'feature/auth', 'feature/auth/jwt'])
        const result = getRefAndPath(refsWithNested, 'feature/auth/jwt/src/token.ts')

        expect(result).toEqual({
            ref: 'feature/auth/jwt',
            path: 'src/token.ts',
        })
    })

    test('should handle ref that looks like commit but is in refs set', () => {
        const refsWithShaLike = new Set(['a1b2c3d4e5f6789012345678901234567890abcd'])
        const result = getRefAndPath(
            refsWithShaLike,
            'a1b2c3d4e5f6789012345678901234567890abcd/src/file.ts',
        )

        expect(result).toEqual({
            ref: 'a1b2c3d4e5f6789012345678901234567890abcd',
            path: 'src/file.ts',
        })
    })

    test('should handle very deep nested path', () => {
        const result = getRefAndPath(
            repoRefsSet,
            'main/src/components/auth/login/forms/LoginForm.tsx',
        )

        expect(result).toEqual({
            ref: 'main',
            path: 'src/components/auth/login/forms/LoginForm.tsx',
        })
    })
})
