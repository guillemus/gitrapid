import { computeInlineHighlights, parseDiff, type DiffLine } from '@/lib/diff'
import type { fns } from '@/server/router'

function DiffLineRow(props: { line: DiffLine; idx: number }) {
    let bgColor = 'bg-white'
    if (props.line.type === 'add') {
        bgColor = 'bg-green-100'
    }
    if (props.line.type === 'remove') {
        bgColor = 'bg-red-50'
    }
    if (props.line.type === 'header') {
        bgColor = 'bg-blue-50'
    }

    let lineNumColor = 'text-zinc-400'
    if (props.line.type === 'add') {
        lineNumColor = 'text-green-700'
    }
    if (props.line.type === 'remove') {
        lineNumColor = 'text-red-700'
    }

    let borderColor = 'border-transparent'
    if (props.line.type === 'add') {
        borderColor = 'border-green-400'
    }
    if (props.line.type === 'remove') {
        borderColor = 'border-red-400'
    }

    let contentElement = <>{props.line.content}</>
    if (props.line.type === 'header') {
        contentElement = <span className="text-blue-700">{props.line.content}</span>
    }
    if (props.line.segments) {
        contentElement = (
            <>
                {props.line.segments.map((seg, i) => {
                    let segClass = ''
                    if (seg.changed) {
                        if (props.line.type === 'add') {
                            segClass = 'bg-green-200 box-decoration-clone border '
                        } else {
                            segClass = 'bg-red-200 box-decoration-clone'
                        }
                    }
                    return (
                        <span key={i} className={segClass + ' rounded'}>
                            {seg.text}
                        </span>
                    )
                })}
            </>
        )
    }

    let prefix = ' '
    if (props.line.type === 'add') {
        prefix = '+'
    }
    if (props.line.type === 'remove') {
        prefix = '-'
    }

    return (
        <div key={props.idx} className={`flex ${bgColor} border-l-2 ${borderColor}`}>
            <div className={`${lineNumColor} px-2 text-right select-none min-w-12`}>
                {props.line.oldLineNumber ?? ''}
            </div>
            <div className={`${lineNumColor} px-2 text-right select-none min-w-12`}>
                {props.line.newLineNumber ?? ''}
            </div>
            <div className={`${lineNumColor} px-2 select-none`}>{prefix}</div>
            <div className="px-2 flex-1 whitespace-pre">{contentElement}</div>
        </div>
    )
}

function FileChange(props: { file: fns.PRFile }) {
    let diffLines: DiffLine[] = []
    if (props.file.patch) {
        diffLines = computeInlineHighlights(parseDiff(props.file.patch))
    }

    let diffContent = null
    if (diffLines.length > 0) {
        diffContent = (
            <div className="relative">
                {diffLines.map((line, idx) => (
                    <DiffLineRow key={idx} line={line} idx={idx} />
                ))}
            </div>
        )
    }

    return (
        <div
            id={props.file.filename}
            key={props.file.filename}
            className="border rounded-lg overflow-hidden"
        >
            <div className="bg-zinc-100 p-3 font-mono text-sm border-b">
                <span className="font-semibold">{props.file.filename}</span>
                <span className="text-zinc-500 ml-4">
                    {props.file.additions > 0 && `+${props.file.additions} `}
                    {props.file.deletions > 0 && `-${props.file.deletions}`}
                </span>
            </div>
            {props.file.patch && (
                <div className="overflow-x-auto">
                    <div className="font-mono text-sm">{diffContent}</div>
                </div>
            )}
        </div>
    )
}

export function DiffViewer(props: { files: { data: fns.PRFile[] } }) {
    if (!props.files.data || props.files.data.length === 0) {
        return <div>No file changes</div>
    }

    return (
        <div className="space-y-6">
            {props.files.data.map((file) => (
                <FileChange key={file.filename} file={file} />
            ))}
        </div>
    )
}
