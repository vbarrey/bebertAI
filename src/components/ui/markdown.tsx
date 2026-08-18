import ReactMarkdown from 'react-markdown'
import remarkGfm from "remark-gfm";

type Props = {
    content: string
}

export function Markdown({ content }: Props) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                // Titres
                h1: ({ children }) => (
                    <h1 className="mt-8 mb-4 text-2xl font-semibold tracking-tight first:mt-0">
                        {children}
                    </h1>
                ),

                h2: ({ children }) => (
                    <h2 className="mt-7 mb-3 text-xl font-semibold tracking-tight first:mt-0">
                        {children}
                    </h2>
                ),

                h3: ({ children }) => (
                    <h3 className="mt-6 mb-2 text-lg font-semibold first:mt-0">
                        {children}
                    </h3>
                ),

                h4: ({ children }) => (
                    <h4 className="mt-5 mb-2 text-base font-semibold first:mt-0">
                        {children}
                    </h4>
                ),

                h5: ({ children }) => (
                    <h5 className="mt-4 mb-2 text-sm font-semibold first:mt-0">
                        {children}
                    </h5>
                ),

                h6: ({ children }) => (
                    <h6 className="mt-4 mb-2 text-sm font-medium text-muted-foreground first:mt-0">
                        {children}
                    </h6>
                ),

                // Texte
                p: ({ children }) => (
                    <p className="mb-4 last:mb-0">
                        {children}
                    </p>
                ),

                strong: ({ children }) => (
                    <strong className="font-semibold">
                        {children}
                    </strong>
                ),

                em: ({ children }) => (
                    <em className="italic">
                        {children}
                    </em>
                ),

                del: ({ children }) => (
                    <del className="text-muted-foreground line-through">
                        {children}
                    </del>
                ),

                // Liens
                a: ({ children, href }) => (
                    <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium underline underline-offset-4 hover:text-primary"
                    >
                        {children}
                    </a>
                ),

                // Listes
                ul: ({ children }) => (
                    <ul className="mb-4 list-disc space-y-1 pl-6">
                        {children}
                    </ul>
                ),

                ol: ({ children }) => (
                    <ol className="mb-4 list-decimal space-y-1 pl-6">
                        {children}
                    </ol>
                ),

                li: ({ children }) => (
                    <li className="pl-1">
                        {children}
                    </li>
                ),

                // Citation
                blockquote: ({ children }) => (
                    <blockquote className="my-5 border-l-2 pl-4 text-muted-foreground">
                        {children}
                    </blockquote>
                ),

                // Séparateur
                hr: () => (
                    <hr className="my-6 border-border" />
                ),

                // Code
                code: ({ children, className }) => {
                    const isCodeBlock = className?.includes("language-");

                    if (isCodeBlock) {
                        return (
                            <code className="font-mono text-sm leading-6">
                                {children}
                            </code>
                        );
                    }

                    return (
                        <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">
                            {children}
                        </code>
                    );
                },

                pre: ({ children }) => (
                    <pre className="my-5 overflow-x-auto rounded-xl border bg-muted/50 p-4">
                        {children}
                    </pre>
                ),

                // Tableaux GFM
                table: ({ children }) => (
                    <div className="my-5 w-full overflow-x-auto rounded-lg border">
                        <table className="w-full border-collapse text-sm">
                            {children}
                        </table>
                    </div>
                ),

                thead: ({ children }) => (
                    <thead className="bg-muted/50">
                        {children}
                    </thead>
                ),

                tbody: ({ children }) => (
                    <tbody className="divide-y divide-border">
                        {children}
                    </tbody>
                ),

                tr: ({ children }) => (
                    <tr>
                        {children}
                    </tr>
                ),

                th: ({ children }) => (
                    <th className="border-b px-4 py-2.5 text-left font-semibold">
                        {children}
                    </th>
                ),

                td: ({ children }) => (
                    <td className="px-4 py-2.5 align-top">
                        {children}
                    </td>
                ),

                // Images
                img: ({ src, alt }) => (
                    <img
                        src={src}
                        alt={alt ?? ""}
                        className="my-5 max-h-[600px] max-w-full rounded-xl border object-contain"
                    />
                ),
            }}>{content}</ReactMarkdown>
    );
}