import { type ElementType, type HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface ProseProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  className?: string
}

export function Prose({
  as: Component = 'div',
  className,
  ...props
}: ProseProps) {
  return (
    <Component
      className={cn(
        'prose prose-invert max-w-none text-gray-500 font-normal text-sm leading-6',
        // headings
        'prose-headings:scroll-mt-28 lg:prose-headings:scroll-mt-24 prose-headings:text-gray-900 prose-headings:font-medium prose-headings:leading-5.5 prose-headings:tracking-[-0.45px] prose-headings:mb-4 prose-headings:mt-8',
        // heading links
        'prose-headings:[&_a]:no-underline prose-headings:[&_a]:shadow-none prose-headings:[&_a]:text-inherit',
        // body text
        'prose-p:mb-4 prose-p:mt-4',
        // lead
        'prose-lead:text-gray-900',
        // links
        'prose-a:text-gray-900',
        // link underline
        'prose-a:underline prose-a:underline-offset-3',
        // strong
        'prose-strong:text-gray-900',
        // strong links
        '',
        '',
        // lists
        'prose-li:my-[-0.5px]',
        className,
      )}
      {...props}
    />
  )
}
