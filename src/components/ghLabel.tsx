import type { Doc } from '@convex/_generated/dataModel'
import { Badge } from './ui/badge'

export type GhLabel = Doc<'labels'>

function normalizeHex(hex: string): string {
    let h = hex.trim()
    if (h.startsWith('#')) {
        h = h.slice(1)
    }
    if (h.length === 3) {
        let r = h[0]
        let g = h[1]
        let b = h[2]
        h = `${r}${r}${g}${g}${b}${b}`
    }
    return h.toLowerCase()
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    let h = normalizeHex(hex)
    let r = parseInt(h.slice(0, 2), 16)
    let g = parseInt(h.slice(2, 4), 16)
    let b = parseInt(h.slice(4, 6), 16)
    return { r, g, b }
}

function backgroundFromLabelColor(hex: string): string {
    let { r, g, b } = hexToRgb(hex)
    let a = 0.18
    return `rgba(${r}, ${g}, ${b}, ${a})`
}

function isDark(hex: string): boolean {
    let { r, g, b } = hexToRgb(hex)
    // Perceived brightness formula (ITU-R BT.601)
    let brightness = (r * 299 + g * 587 + b * 114) / 1000
    return brightness < 128
}

export function GhLabel(props: { label: GhLabel; isDarkMode?: boolean }) {
    let hex = normalizeHex(props.label.color)
    let textColor = props.isDarkMode ? `#${hex}` : isDark(hex) ? '#ffffff' : '#000000'
    let bgColor = props.isDarkMode ? backgroundFromLabelColor(hex) : `#${hex}`
    let borderColor = props.isDarkMode ? `#${hex}` : `#${hex}`
    return (
        <Badge
            key={props.label._id}
            variant="outline"
            className={`text-xs`}
            style={{ backgroundColor: bgColor, color: textColor, borderColor: borderColor }}
        >
            {props.label.name}
        </Badge>
    )
}
