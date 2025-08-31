import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { gfmHeadingId } from 'marked-gfm-heading-id'

// Configure marked once for speed and predictable output
marked.use(gfmHeadingId())
marked.setOptions({ gfm: true })

export function renderMarkdownToHtml(markdown: string): string {
    let input = typeof markdown === 'string' ? markdown : ''
    let parsed = marked.parse(input, {
        breaks: true,
    })
    let html = typeof parsed === 'string' ? parsed : ''
    let sanitized = DOMPurify.sanitize(html)
    return sanitized
}
