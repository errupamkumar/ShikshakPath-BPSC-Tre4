import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EbooksPage } from "@/components/ebooks-page";
import { EBOOK_TYPES, isEbookType } from "@/lib/ebook-types";

type Props = { params: Promise<{ type: string }>; searchParams: Promise<{ subject?: string | string[] }> };

const TITLES: Record<string, string> = { notes: "Notes", pyq: "PYQ PDFs", strategy: "Strategy guides", others: "More eBooks" };

export const dynamicParams = false;
export function generateStaticParams() {
  return EBOOK_TYPES.map((type) => ({ type }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type } = await params;
  return { title: `eBooks: ${TITLES[type] ?? "PDFs"}` };
}

export default async function EbooksTypePage({ params, searchParams }: Props) {
  const [{ type }, { subject }] = await Promise.all([params, searchParams]);
  if (!isEbookType(type)) notFound();
  return <EbooksPage type={type} subject={typeof subject === "string" ? subject : undefined} />;
}
