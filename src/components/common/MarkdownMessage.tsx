import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';

interface MarkdownMessageProps {
  content: string;
  isUser?: boolean;
}

export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content, isUser = false }) => {
  if (isUser) {
    return <div className="text-xs leading-relaxed whitespace-pre-wrap">{content}</div>;
  }

  return (
    <div className="text-xs leading-relaxed text-[#46362F] space-y-2 markdown-message">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="font-serif text-base font-medium text-[#46362F] border-b border-[#E7E0D8] pb-1 mt-2 mb-1">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-serif text-sm font-medium text-[#46362F] mt-2 mb-1">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-sans text-xs font-bold text-[#46362F] uppercase tracking-wide mt-2 mb-1">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="font-sans text-xs font-semibold text-[#46362F] mt-1.5 mb-0.5">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="leading-relaxed my-1 text-[#46362F]">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-[#46362F]">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-[#6B625B]">
              {children}
            </em>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-4 space-y-1 my-1.5 text-[#46362F]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside pl-4 space-y-1 my-1.5 text-[#46362F]">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="pl-0.5 leading-relaxed">
              {children}
            </li>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.includes('language-');
            if (isBlock) {
              return (
                <pre className="font-mono text-[11px] bg-[#F8F6F2] text-[#46362F] p-2.5 rounded-lg border border-[#E7E0D8] overflow-x-auto my-2">
                  <code>{children}</code>
                </pre>
              );
            }
            return (
              <code className="font-mono text-[11px] bg-[#E8E2F0]/60 text-[#46362F] px-1.5 py-0.5 rounded border border-[#E7E0D8] font-medium">
                {children}
              </code>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[#D9C6A5] pl-3 py-1 my-2 bg-[#F8F6F2] text-[#6B625B] italic rounded-r">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 rounded-lg border border-[#E7E0D8]">
              <table className="w-full text-left border-collapse text-[11px]">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#F8F6F2] border-b border-[#E7E0D8] font-semibold text-[#46362F]">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-[#E7E0D8] bg-white">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-[#F8F6F2]/50 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="py-1.5 px-2.5 font-semibold text-[#46362F]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="py-1.5 px-2.5 text-[#46362F]">
              {children}
            </td>
          ),
          a: ({ href, children }) => {
            const isInternal = href && (href.startsWith('/') || href.startsWith('#'));
            if (isInternal) {
              return (
                <Link to={href} className="text-[#46362F] font-semibold underline underline-offset-2 hover:text-[#8A9A83]">
                  {children}
                </Link>
              );
            }
            return (
              <a 
                href={href} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-[#46362F] font-semibold underline underline-offset-2 hover:text-[#8A9A83]"
              >
                {children}
              </a>
            );
          },
          hr: () => <hr className="my-2 border-[#E7E0D8]" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
