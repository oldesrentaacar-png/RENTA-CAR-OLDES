import { contractPdfHref } from "@/lib/pdf/contract-pdf-meta";
import { cn } from "@/lib/utils";

type ContractPdfLinkProps = {
  contractId: string;
  className?: string;
  children?: React.ReactNode;
  /** When false, PDF cannot be opened/shared yet. */
  clientSigned?: boolean;
};

/** Opens contract PDF in a new tab (never via Next.js client navigation). */
export function ContractPdfLink({
  contractId,
  className,
  children = "Ver PDF",
  clientSigned = true,
}: ContractPdfLinkProps) {
  if (!clientSigned) {
    return (
      <span
        className={cn(
          "inline-flex h-10 cursor-not-allowed items-center rounded-lg border border-border px-4 text-sm font-medium text-muted opacity-70",
          className,
        )}
        title="El cliente debe firmar electrónicamente antes de ver o compartir el PDF."
      >
        {children} (requiere firma)
      </span>
    );
  }

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
