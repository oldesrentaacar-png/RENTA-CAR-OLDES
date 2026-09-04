import { contractPdfHref } from "@/lib/pdf/contract-pdf-meta";
import { cn } from "@/lib/utils";

type ContractPdfLinkProps = {
  contractId: string;
  className?: string;
  children?: React.ReactNode;
  /** Client electronic signature present. */
  clientSigned?: boolean;
};

/**
 * Staff can always open the PDF (admin/operator preview).
 * When the client has not signed, the label warns it is internal-only
 * (do not share with the customer yet).
 */
export function ContractPdfLink({
  contractId,
  className,
  children,
  clientSigned = true,
}: ContractPdfLinkProps) {
  const label =
    children ??
    (clientSigned ? "Ver PDF" : "Ver PDF (vista interna)");

  return (
    <a
      href={contractPdfHref(contractId)}
      target="_blank"
      rel="noopener noreferrer"
      title={
        clientSigned
          ? "Abrir PDF del contrato"
          : "Vista interna: el cliente aún no ha firmado. No compartir hasta firmar."
      }
      className={cn(className)}
    >
      {label}
    </a>
  );
}

export function isDocumentHref(href: string): boolean {
  return href.includes("/pdf") || href.startsWith("/api/");
}
