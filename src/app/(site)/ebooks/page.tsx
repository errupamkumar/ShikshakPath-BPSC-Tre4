import type { Metadata } from "next";
import { EbooksPage } from "@/components/ebooks-page";

export const metadata: Metadata = {
  title: "eBooks: notes, PYQ PDFs & strategy guides",
  description: "PDF notes, previous-year papers, expert strategy guides and more for BPSC TRE and Bihar STET.",
};

export default async function EbooksIndex({ searchParams }: { searchParams: Promise<{ subject?: string | string[] }> }) {
  const { subject } = await searchParams;
  return <EbooksPage subject={typeof subject === "string" ? subject : undefined} />;
}
