import { serveCloseActPdfResponse } from "@/lib/pdf/serve-close-act-pdf";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return serveCloseActPdfResponse(id);
}
