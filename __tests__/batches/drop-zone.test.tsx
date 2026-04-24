import { renderToStaticMarkup } from "react-dom/server";
import type { HTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DropZone } from "@/components/batches/drop-zone";

const dropzoneMock = vi.hoisted(() => ({
  options: null as null | {
    onDrop: (acceptedFiles: File[], rejectedFiles: Array<{ file: File }>) => void;
  },
  isDragActive: false,
  fileRejections: [] as Array<{ file: File }>,
}));

type MockMotionDivProps = HTMLAttributes<HTMLDivElement> & {
  alignItems?: unknown;
  animate?: unknown;
  exit?: unknown;
  initial?: unknown;
  layoutId?: unknown;
  transition?: unknown;
  whileHover?: unknown;
};

function MockMotionDiv({ children, ...props }: MockMotionDivProps) {
  delete props.alignItems;
  delete props.animate;
  delete props.exit;
  delete props.initial;
  delete props.layoutId;
  delete props.transition;
  delete props.whileHover;

  return <div {...props}>{children}</div>;
}

vi.mock("framer-motion", () => ({
  motion: {
    div: MockMotionDiv,
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock("react-dropzone", () => ({
  useDropzone: (options: { onDrop: (acceptedFiles: File[], rejectedFiles: Array<{ file: File }>) => void }) => {
    dropzoneMock.options = options;
    return {
    getRootProps: () => ({}),
    getInputProps: () => ({}),
      isDragActive: dropzoneMock.isDragActive,
      fileRejections: dropzoneMock.fileRejections,
    };
  },
}));

describe("DropZone", () => {
  beforeEach(() => {
    dropzoneMock.options = null;
    dropzoneMock.isDragActive = false;
    dropzoneMock.fileRejections = [];
  });

  it("renders empty state correctly", () => {
    const html = renderToStaticMarkup(
      <DropZone onFileSelect={() => {}} selectedFile={null} />
    );

    expect(html).toContain("Arraste e solte o relatorio");
    expect(html).toContain("Ou clique para navegar");
  });

  it("renders drag highlight copy when a file is over the drop zone", () => {
    dropzoneMock.isDragActive = true;
    const html = renderToStaticMarkup(
      <DropZone onFileSelect={() => {}} selectedFile={null} />
    );

    expect(html).toContain("Solte o arquivo aqui");
  });

  it("renders selected file preview for PDF", () => {
    const file = new File(["dummy content"], "test.pdf", { type: "application/pdf" });
    const html = renderToStaticMarkup(
      <DropZone onFileSelect={() => {}} selectedFile={file} />
    );

    expect(html).toContain("test.pdf");
    expect(html).toContain("PDF - 13 Bytes");
    expect(html).toContain("ARQUIVO PRONTO");
  });

  it("renders selected file preview for CSV", () => {
    const file = new File(["id,name\n1,test"], "data.csv", { type: "text/csv" });
    const html = renderToStaticMarkup(
      <DropZone onFileSelect={() => {}} selectedFile={file} />
    );

    expect(html).toContain("data.csv");
    expect(html).toContain("CSV");
  });

  it("renders selected file preview for JSON", () => {
    const file = new File(["{}"], "data.json", { type: "application/json" });
    const html = renderToStaticMarkup(
      <DropZone onFileSelect={() => {}} selectedFile={file} />
    );

    expect(html).toContain("data.json");
    expect(html).toContain("JSON");
  });

  it("calls onFileSelect with the accepted dropped file", () => {
    const onFileSelect = vi.fn();
    const file = new File(["id"], "batch.csv", { type: "text/csv" });
    renderToStaticMarkup(<DropZone onFileSelect={onFileSelect} selectedFile={null} />);

    dropzoneMock.options?.onDrop([file], []);

    expect(onFileSelect).toHaveBeenCalledWith(file);
  });

  it("clears the current file when a rejected drop has no accepted files", () => {
    const onFileSelect = vi.fn();
    const currentFile = new File(["id"], "current.csv", { type: "text/csv" });
    const rejectedFile = new File(["bad"], "image.png", { type: "image/png" });
    renderToStaticMarkup(<DropZone onFileSelect={onFileSelect} selectedFile={currentFile} />);

    dropzoneMock.options?.onDrop([], [{ file: rejectedFile }]);

    expect(onFileSelect).toHaveBeenCalledWith(null);
  });

  it("shows feedback for rejected file types", () => {
    dropzoneMock.fileRejections = [
      { file: new File(["bad"], "image.png", { type: "image/png" }) },
    ];
    const html = renderToStaticMarkup(
      <DropZone onFileSelect={() => {}} selectedFile={null} />
    );

    expect(html).toContain("Formato nao aceito");
  });
});
