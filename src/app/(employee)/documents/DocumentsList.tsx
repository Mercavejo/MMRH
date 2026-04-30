'use client';

import React from 'react';
import Link from 'next/link';
import {
  Alert,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
  Box,
  InputAdornment,
} from "@mui/material";
import { 
  FilterList as FilterIcon, 
  Search as SearchIcon,
  RestartAlt as ResetIcon
} from '@mui/icons-material';
import { tokens } from "@/lib/theme/tokens";
import { type EmployeeDocumentListItem } from "@/lib/documents/list-documents";
import { DocumentTile } from "@/components/documents/DocumentTile";
import type { DocumentStatus } from "@/lib/documents/status-mapping";

type Filters = {
  periodRef?: string;
  documentType?: string;
};

export function serializeDocumentFilters(filters: Filters): string {
  const params = new URLSearchParams();

  if (filters.periodRef) {
    params.set("period_ref", filters.periodRef);
  }

  if (filters.documentType) {
    params.set("document_type", filters.documentType);
  }

  return params.toString();
}

export function getContestationGuidanceByStatus(status: DocumentStatus): string {
  if (status === "pending" || status === "processing") {
    return "Documento ainda em processamento. Abra uma contestacao se o prazo operacional ja tiver vencido.";
  }

  if (status === "unavailable") {
    return "Documento indisponivel para download. Abra uma contestacao para o RH verificar a publicacao.";
  }

  if (status === "error") {
    return "Documento com falha de processamento. Abra uma contestacao para solicitar correcao.";
  }

  return "Documento disponivel para consulta e download.";
}

export function EmployeeDocumentsPageView({
  items,
  activeFilters,
  errorMessage,
}: {
  items: EmployeeDocumentListItem[];
  activeFilters: Filters;
  errorMessage?: string;
}) {
  return (
    <Box>
      <Stack spacing={4}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h2" sx={{ fontWeight: 800, mb: 1 }}>
              Meus Documentos
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Acesse e gerencie seus holerites e cartões de ponto com segurança.
            </Typography>
          </Box>
        </Box>

        <Box
          component="form" 
          method="get" 
          sx={{ 
            p: 3, 
            bgcolor: 'white', 
            borderRadius: 4, 
            border: `1px solid ${tokens.colors.surface.border}`,
            boxShadow: tokens.effects.shadow.sm
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            sx={{ alignItems: "center" }}
          >
            <TextField
              name="period_ref"
              placeholder="Período (AAAA-MM)"
              size="small"
              defaultValue={activeFilters.periodRef ?? ""}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" style={{ color: tokens.colors.text.muted }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ flex: 1 }}
            />

            <TextField
              select
              name="document_type"
              size="small"
              defaultValue={activeFilters.documentType ?? ""}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">Todos os tipos</MenuItem>
              <MenuItem value="holerite">Holerite</MenuItem>
              <MenuItem value="cartao_ponto">Cartão de Ponto</MenuItem>
            </TextField>

            <Button 
              type="submit" 
              variant="contained" 
              startIcon={<FilterIcon />}
              sx={{ px: 4 }}
            >
              Filtrar
            </Button>

            <Button 
              component={Link} 
              href="/documents" 
              variant="outlined"
              startIcon={<ResetIcon />}
            >
              Limpar
            </Button>

            <Button
              component={Link}
              href="/notifications"
              variant="text"
            >
              Historico de notificacoes
            </Button>
          </Stack>
        </Box>

        {errorMessage ? (
          <Alert severity="error" variant="filled" sx={{ borderRadius: 3 }}>
            {errorMessage}
          </Alert>
        ) : null}

        <Box>
          {!errorMessage && items.length === 0 ? (
            <Box sx={{ py: 10, textAlign: 'center' }}>
              <Typography variant="h3" color="text.muted" sx={{ mb: 1 }}>
                Nenhum documento encontrado
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Nenhum documento encontrado para os filtros informados. Tente ajustar os filtros ou aguarde a publicação pelo RH.
              </Typography>
            </Box>
          ) : (
            <Box>
              {items.map((item) => {
                const filterQuery = serializeDocumentFilters(activeFilters);
                const detailsQuery = new URLSearchParams({ status: item.status });
                const contestationQuery = new URLSearchParams({
                  document_id: item.document_id,
                  period_ref: item.period_ref,
                  document_type: item.document_type,
                  status: item.status,
                });

                if (filterQuery) {
                  detailsQuery.set("from", filterQuery);
                  contestationQuery.set("from", filterQuery);
                }

                return (
                  <DocumentTile
                    key={item.document_id}
                    type={item.document_type}
                    period={item.period_ref}
                    status={item.status}
                    downloadHref={`/api/v1/employee/documents/${item.document_id}/download?disposition=attachment`}
                    detailsHref={`/documents/${item.document_id}?${detailsQuery.toString()}`}
                    contestationHref={
                      ['pending', 'processing', 'unavailable', 'error'].includes(item.status)
                        ? `/documents/contestacao?${contestationQuery.toString()}`
                        : undefined
                    }
                  />
                );
              })}
            </Box>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
