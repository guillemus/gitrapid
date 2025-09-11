import { describe, expect, it } from 'vitest'
import { parseGithubUrl } from './github'

describe('parseGithubUrl', () => {
    describe('valid URLs', () => {
        const validUrlTests = [
            {
                input: 'https://github.com/owner/repo',
                expected: { owner: 'owner', repo: 'repo' },
            },
            {
                input: 'https://github.com/owner/repo/tree/main/src',
                expected: { owner: 'owner', repo: 'repo' },
            },
            {
                input: 'https://github.com/owner/repo?tab=readme-ov-file',
                expected: { owner: 'owner', repo: 'repo' },
            },
            {
                input: 'https://github.com/owner/repo#readme',
                expected: { owner: 'owner', repo: 'repo' },
            },
            {
                input: 'https://github.com/owner/repo/blob/main/src/index.ts?tab=readme-ov-file#L1',
                expected: { owner: 'owner', repo: 'repo' },
            },
            // URLs without protocol (starting with github.com)
            {
                input: 'github.com/owner/repo',
                expected: { owner: 'owner', repo: 'repo' },
            },
            {
                input: 'github.com/owner/repo/tree/main/src',
                expected: { owner: 'owner', repo: 'repo' },
            },
            {
                input: 'github.com/owner/repo?tab=readme-ov-file',
                expected: { owner: 'owner', repo: 'repo' },
            },
            {
                input: 'github.com/owner/repo#readme',
                expected: { owner: 'owner', repo: 'repo' },
            },
            {
                input: 'github.com/owner/repo/blob/main/src/index.ts?tab=readme-ov-file#L1',
                expected: { owner: 'owner', repo: 'repo' },
            },
            // HTTP URLs
            {
                input: 'http://github.com/owner/repo',
                expected: { owner: 'owner', repo: 'repo' },
            },
            // Edge cases
            {
                input: 'https://github.com/a/b',
                expected: { owner: 'a', repo: 'b' },
            },
            {
                input: 'https://github.com/my-org/my_repo',
                expected: { owner: 'my-org', repo: 'my_repo' },
            },
            {
                input: 'https://github.com/org123/repo456',
                expected: { owner: 'org123', repo: 'repo456' },
            },
            {
                input: 'https://github.com/MyOrg/MyRepo',
                expected: { owner: 'MyOrg', repo: 'MyRepo' },
            },
        ]

        it.each(validUrlTests)('should parse', ({ input, expected }) => {
            const result = parseGithubUrl(input)
            expect(result.isErr).toBe(false)
            if (!result.isErr) {
                expect(result.val).toEqual(expected)
            }
        })
    })

    describe('invalid URLs', () => {
        const invalidUrlTests = [
            {
                input: 'https://gitlab.com/owner/repo',
                expectedError: 'invalid github url',
            },
            {
                input: 'https://github.com/',
                expectedError: 'invalid github url',
            },
            {
                input: 'https://github.com/owner',
                expectedError: 'invalid github url',
            },
            {
                input: 'https://github.com//repo',
                expectedError: 'invalid github url',
            },
            {
                input: 'https://github.com/owner/',
                expectedError: 'invalid github url',
            },
            {
                input: 'not-a-url',
                expectedError: 'invalid github url',
            },
            {
                input: '',
                expectedError: 'invalid github url',
            },
            {
                input: 'https://www.github.com/owner/repo',
                expectedError: 'invalid github url',
            },
            {
                input: 'github.com',
                expectedError: 'invalid github url',
            },
            {
                input: 'github.com/owner',
                expectedError: 'invalid github url',
            },
        ]

        it.each(invalidUrlTests)('should reject', ({ input, expectedError }) => {
            const result = parseGithubUrl(input)
            expect(result.isErr).toBe(true)
            if (result.isErr) {
                expect(result.err).toBe(expectedError)
            }
        })
    })
})
