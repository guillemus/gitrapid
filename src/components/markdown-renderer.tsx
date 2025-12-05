import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function MarkdownRenderer(props: { content: string }) {
    return (
        <div className="max-w-none space-y-4 text-sm leading-relaxed">
            <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ children }) => (
                        <h1 className="text-3xl font-bold mt-8 mb-4 pt-4 border-b pb-2">
                            {children}
                        </h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-2xl font-bold mt-6 mb-3 pt-2 border-b pb-1">
                            {children}
                        </h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-xl font-bold mt-5 mb-3">{children}</h3>
                    ),
                    h4: ({ children }) => (
                        <h4 className="text-lg font-bold mt-4 mb-2">{children}</h4>
                    ),
                    h5: ({ children }) => <h5 className="font-bold mt-3 mb-2">{children}</h5>,
                    h6: ({ children }) => (
                        <h6 className="font-bold text-sm mt-3 mb-2 text-zinc-600 dark:text-zinc-400">
                            {children}
                        </h6>
                    ),
                    p: ({ children }) => <p className="my-3">{children}</p>,
                    ul: ({ children }) => (
                        <ul className="list-disc list-outside ml-6 my-3 space-y-2">{children}</ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal list-outside ml-6 my-3 space-y-2">
                            {children}
                        </ol>
                    ),
                    li: ({ children }) => <li>{children}</li>,
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-zinc-300 dark:border-zinc-600 pl-4 italic text-zinc-600 dark:text-zinc-400 my-4">
                            {children}
                        </blockquote>
                    ),
                    code: (props) => {
                        const { inline, children } = props as any
                        return inline ? (
                            <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-sm font-mono border border-zinc-200 dark:border-zinc-700">
                                {children}
                            </code>
                        ) : null
                    },
                    pre: ({ children }) => (
                        <pre className="bg-zinc-900 dark:bg-black text-zinc-100 p-4 rounded-lg my-4 overflow-x-auto border border-zinc-700">
                            {children}
                        </pre>
                    ),
                    table: ({ children }) => (
                        <div className="overflow-x-auto my-4">
                            <table className="border-collapse border border-zinc-300 dark:border-zinc-600 w-full">
                                {children}
                            </table>
                        </div>
                    ),
                    thead: ({ children }) => (
                        <thead className="bg-zinc-100 dark:bg-zinc-800">{children}</thead>
                    ),
                    th: ({ children }) => (
                        <th className="border border-zinc-300 dark:border-zinc-600 px-4 py-2 font-bold text-left">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="border border-zinc-300 dark:border-zinc-600 px-4 py-2">
                            {children}
                        </td>
                    ),
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {children}
                        </a>
                    ),
                    img: ({ src, alt }) => (
                        <img
                            src={src}
                            alt={alt}
                            className="max-w-full h-auto rounded-lg border border-zinc-200 dark:border-zinc-700 my-4"
                        />
                    ),
                    hr: () => <hr className="border-t border-zinc-300 dark:border-zinc-600 my-4" />,
                    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                }}
            >
                {props.content}
            </Markdown>
        </div>
    )
}
