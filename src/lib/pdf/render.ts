import { renderToBuffer } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";

import {
  ContractPdfDocument,
  type ContractPdfProps,
} from "@/lib/pdf/contract-pdf";
import { getBrandLogoDataUrl } from "@/lib/pdf/brand-assets";
import {
  PaymentReceiptPdfDocument,
  type PaymentReceiptPdfProps,
} from "@/lib/pdf/payment-receipt-pdf";
import {
  CloseActPdfDocument,
  type CloseActPdfProps,
} from "@/lib/pdf/close-act-pdf";
import { QuotePdfDocument, type QuotePdfProps } from "@/lib/pdf/quote-pdf";

export async function renderPdfToBuffer(
  document: ReactElement,
): Promise<Buffer> {
  const buffer = await renderToBuffer(
    document as Parameters<typeof renderToBuffer>[0],
  );
  return Buffer.from(buffer);
}

export async function renderQuotePdf(props: QuotePdfProps): Promise<Buffer> {
  const logoDataUrl = props.logoDataUrl ?? (await getBrandLogoDataUrl());
  return renderPdfToBuffer(
    createElement(QuotePdfDocument, { ...props, logoDataUrl }),
  );
}

export async function renderContractPdf(
  props: ContractPdfProps,
): Promise<Buffer> {
  const logoDataUrl = props.logoDataUrl ?? (await getBrandLogoDataUrl());
  return renderPdfToBuffer(
    createElement(ContractPdfDocument, { ...props, logoDataUrl }),
  );
}

export async function renderPaymentReceiptPdf(
  props: PaymentReceiptPdfProps,
): Promise<Buffer> {
  const logoDataUrl = props.logoDataUrl ?? (await getBrandLogoDataUrl());
  return renderPdfToBuffer(
    createElement(PaymentReceiptPdfDocument, { ...props, logoDataUrl }),
  );
}

export async function renderCloseActPdf(
  props: CloseActPdfProps,
): Promise<Buffer> {
  const logoDataUrl = props.logoDataUrl ?? (await getBrandLogoDataUrl());
  return renderPdfToBuffer(
    createElement(CloseActPdfDocument, { ...props, logoDataUrl }),
  );
}

export type {
  CloseActPdfProps,
  ContractPdfProps,
  PaymentReceiptPdfProps,
  QuotePdfProps,
};
