"use client";

import { useDropzone } from "react-dropzone";
import { Box, Paper, Stack, Typography, alpha } from "@mui/material";
import UploadIcon from "@mui/icons-material/CloudUpload";
import PdfIcon from "@mui/icons-material/PictureAsPdf";
import CsvIcon from "@mui/icons-material/Description";
import JsonIcon from "@mui/icons-material/Code";
import UnknownIcon from "@mui/icons-material/InsertDriveFile";
import { motion, AnimatePresence } from "framer-motion";
import { tokens } from "@/lib/theme/tokens";

interface DropZoneProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  isSubmitting?: boolean;
  accept?: Record<string, string[]>;
}

export function DropZone({ onFileSelect, selectedFile, isSubmitting, accept }: DropZoneProps) {
  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop: (acceptedFiles, rejectedFiles) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      } else if (rejectedFiles.length > 0) {
        onFileSelect(null);
      }
    },
    accept: accept ?? {
      "text/csv": [".csv"],
      "application/json": [".json"],
      "application/pdf": [".pdf"],
    },
    multiple: false,
    disabled: isSubmitting,
  });
  const rejectionMessage =
    fileRejections.length > 0
      ? "Formato nao aceito. Envie um arquivo CSV, JSON ou PDF."
      : null;

  const getFileType = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (file.type === "application/pdf" || ext === "pdf") return "PDF";
    if (file.type === "text/csv" || ext === "csv") return "CSV";
    if (file.type === "application/json" || ext === "json") return "JSON";
    return "ARQUIVO";
  };

  const getFileIcon = (file: File) => {
    switch (getFileType(file)) {
      case "PDF": return <PdfIcon sx={{ fontSize: 40, color: "error.main" }} />;
      case "CSV": return <CsvIcon sx={{ fontSize: 40, color: "success.main" }} />;
      case "JSON": return <JsonIcon sx={{ fontSize: 40, color: "primary.main" }} />;
      default: return <UnknownIcon sx={{ fontSize: 40, color: "text.secondary" }} />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <Box {...getRootProps()} aria-label="Area de upload de arquivo">
      <input {...getInputProps()} />
      <Paper
        component={motion.div}
        animate={{
          borderColor: isDragActive ? "var(--mui-palette-primary-main)" : tokens.colors.surface.border,
          backgroundColor: isDragActive 
            ? "var(--mui-palette-primary-lighter)" 
            : "var(--mui-palette-background-paper)",
          scale: isDragActive ? 1.02 : 1,
          boxShadow: isDragActive
            ? [
                "0 0 0 0 rgba(45, 212, 191, 0)",
                "0 0 0 8px rgba(45, 212, 191, 0.18)",
                "0 0 0 0 rgba(45, 212, 191, 0)",
              ]
            : "0 0 0 0 rgba(45, 212, 191, 0)",
        }}
        whileHover={{ scale: isSubmitting ? 1 : 1.01 }}
        transition={{
          duration: 0.2,
          boxShadow: {
            duration: 1.2,
            repeat: isDragActive ? Infinity : 0,
            ease: "easeInOut",
          },
        }}
        sx={{
          p: 4,
          border: "2px dashed",
          borderRadius: 2,
          cursor: isSubmitting ? "not-allowed" : "pointer",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
          minHeight: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background-color 0.2s, border-color 0.2s",
        }}
      >
        <AnimatePresence mode="wait">
          {!selectedFile ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Stack spacing={2} sx={{ alignItems: "center" }}>
                <Box
                  component={motion.div}
                  animate={isDragActive ? { y: [0, -10, 0] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <UploadIcon sx={{ fontSize: 48, color: "primary.main" }} />
                </Box>
                <Box>
                  <Typography variant="h6">
                    {isDragActive ? "Solte o arquivo aqui" : "Arraste e solte o relatorio"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Ou clique para navegar (CSV, JSON, PDF)
                  </Typography>
                </Box>
              </Stack>
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{ width: "100%" }}
            >
              <Stack spacing={2} sx={{ alignItems: "center", width: "100%" }}>
                <Box>{getFileIcon(selectedFile)}</Box>
                <Box sx={{ maxWidth: "80%" }}>
                  <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600 }}>
                    {selectedFile.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {getFileType(selectedFile)} - {formatFileSize(selectedFile.size)}
                  </Typography>
                </Box>
                <Box
                  component={motion.div}
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  sx={{
                    maxWidth: 200,
                    height: 4,
                    bgcolor: "primary.main",
                    borderRadius: 1,
                    mt: 1,
                    opacity: 0.6
                  }}
                />
                <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600 }}>
                  ARQUIVO PRONTO
                </Typography>
              </Stack>
            </motion.div>
          )}
        </AnimatePresence>

        {rejectionMessage ? (
          <Typography
            variant="caption"
            color="error.main"
            role="alert"
            sx={{ position: "absolute", bottom: 16, left: 16, right: 16, fontWeight: 600 }}
          >
            {rejectionMessage}
          </Typography>
        ) : null}

        {isDragActive && (
          <Box
            component={motion.div}
            layoutId="highlight"
            sx={{
              position: "absolute",
              inset: 0,
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
              pointerEvents: "none",
            }}
          />
        )}
      </Paper>
    </Box>
  );
}
