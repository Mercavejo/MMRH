import { createWorker, PSM } from "tesseract.js";
import { getDocumentProxy, renderPageAsImage } from "unpdf";

type CanvasImportModule = typeof import("@napi-rs/canvas");

export type PdfOcrPageResult = {
  pageIndex: number;
  text: string;
  confidence: number;
};

export type PdfOcrResult = {
  text: string;
  numpages: number;
  pages: PdfOcrPageResult[];
  averageConfidence: number;
};

const OCR_RENDER_SCALE = 2;

const runtimeImport = new Function(
  "specifier",
  'return import(specifier);',
) as (specifier: string) => Promise<unknown>;

async function loadCanvasModule() {
  return runtimeImport("@napi-rs/canvas") as Promise<CanvasImportModule>;
}

export async function extractPdfTextWithOcr(buffer: Buffer): Promise<PdfOcrResult> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const worker = await createWorker("por");

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
    });

    const pages: PdfOcrPageResult[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const pngBuffer = Buffer.from(
        await renderPageAsImage(new Uint8Array(buffer), pageNumber, {
          canvasImport: loadCanvasModule,
          scale: OCR_RENDER_SCALE,
        }),
      );
      const result = await worker.recognize(pngBuffer, { rotateAuto: true });

      pages.push({
        pageIndex: pageNumber,
        text: result.data.text.trim(),
        confidence: result.data.confidence,
      });
    }

    const averageConfidence =
      pages.length > 0
        ? pages.reduce((total, page) => total + page.confidence, 0) / pages.length
        : 0;

    return {
      text: pages.map((page) => page.text).join("\f"),
      numpages: pdf.numPages,
      pages,
      averageConfidence,
    };
  } finally {
    await worker.terminate();
    await pdf.destroy?.();
  }
}
