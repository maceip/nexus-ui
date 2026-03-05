import { source } from '@/lib/source';
import { notFound } from 'next/navigation';
import { readFile } from 'node:fs/promises';

export const revalidate = false;

export async function GET(_req: Request, { params }: RouteContext<'/raw/docs/[[...slug]]'>) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page || !page.absolutePath) notFound();

  const content = await readFile(page.absolutePath, 'utf-8');

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

export function generateStaticParams() {
  return source.generateParams();
}
