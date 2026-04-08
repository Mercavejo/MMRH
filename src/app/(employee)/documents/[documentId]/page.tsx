import Link from "next/link";
import { Alert, Button, Container, Paper, Stack, Typography } from "@mui/material";

type DetailPageProps = {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default async function EmployeeDocumentDetailPage({
  params,
  searchParams,
}: DetailPageProps) {
  const { documentId } = await params;
  const { from } = await searchParams;

  const backHref = from ? `/documents?${from}` : "/documents";
  const downloadHref = `/api/v1/employee/documents/${documentId}/download?disposition=attachment`;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h2">Detalhe do Documento</Typography>
          <Typography variant="body1">
            Documento selecionado: <strong>{documentId}</strong>
          </Typography>
          <Alert severity="info" role="status">
            Se o documento nao estiver disponivel para download, verifique o status na lista e use a contestacao guiada quando necessario.
          </Alert>
          <Button
            component={Link}
            href={downloadHref}
            variant="contained"
            aria-label={`Baixar documento ${documentId}`}
          >
            Baixar documento
          </Button>
          <Button component={Link} href={backHref} variant="outlined">
            Voltar para lista
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
