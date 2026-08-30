import { serveContractPdfResponse } from "@/lib/pdf/serve-contract-pdf";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return serveContractPdfResponse(id);
}
