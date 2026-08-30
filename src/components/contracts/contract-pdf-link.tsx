import { contractPdfHref } from "@/lib/pdf/contract-pdf-meta";
import { cn } from "@/lib/utils";

type ContractPdfLinkProps = {
  contractId: string;
  className?: string;
  children?: React.ReactNode;
};

/** Opens contract PDF in a new tab (never via Next.js client navigation). */
export function ContractPdfLink({
  contractId,
  className,
  children = "Ver PDF",
}: ContractPdfLinkProps) {
  return (
    <a
      href={contractPdfHref(contractId)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(className)}
    >
      {children}
    </a>
  );
}

export function isDocumentHref(href: string): boolean {
  return href.includes("/pdf") || href.startsWith("/api/");
}
