import { NextRequest } from "next/server";
import { handleEmployeeDocumentDownload } from "@/lib/documents/employee-download-handler";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;
  return handleEmployeeDocumentDownload(request, { documentId });
}
