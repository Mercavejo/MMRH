import { 
  Box, 
  Container, 
  Paper, 
  Stack, 
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid
} from "@mui/material";
import { tokens } from "@/lib/theme/tokens";
import { SkeletonCard } from "@/components/ui/SkeletonCard";

export default function RhAuditLoading() {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={4}>
        <Box>
          <Skeleton animation="wave" variant="text" width={300} height={60} sx={{ mb: 1 }} />
          <Skeleton animation="wave" variant="text" width="60%" height={24} />
        </Box>

        <Paper elevation={0} sx={{ p: 4, borderRadius: 6, border: `1px solid ${tokens.colors.surface.border}` }}>
          <Stack spacing={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Skeleton animation="wave" variant="circular" width={24} height={24} />
              <Skeleton animation="wave" variant="text" width={150} height={32} />
            </Box>
            
            <Grid container spacing={3}>
              {Array.from({ length: 8 }).map((_, i) => (
                <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
                  <Skeleton animation="wave" variant="rectangular" height={56} sx={{ borderRadius: 2 }} />
                </Grid>
              ))}
            </Grid>
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ p: 4, borderRadius: 6, border: `1px solid ${tokens.colors.surface.border}` }}>
          <Stack spacing={3}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton animation="wave" variant="text" width={200} height={32} />
              <Skeleton animation="wave" variant="text" width={150} height={24} />
            </Box>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><Skeleton animation="wave" variant="text" /></TableCell>
                    <TableCell><Skeleton animation="wave" variant="text" /></TableCell>
                    <TableCell><Skeleton animation="wave" variant="text" /></TableCell>
                    <TableCell><Skeleton animation="wave" variant="text" /></TableCell>
                    <TableCell><Skeleton animation="wave" variant="text" /></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton animation="wave" variant="text" width="100%" />
                        <Skeleton animation="wave" variant="text" width="60%" sx={{ mt: 0.5 }} />
                      </TableCell>
                      <TableCell><Skeleton animation="wave" variant="rectangular" width={80} height={24} sx={{ borderRadius: 1 }} /></TableCell>
                      <TableCell>
                        <Skeleton animation="wave" variant="text" width="80%" />
                        <Skeleton animation="wave" variant="text" width="40%" sx={{ mt: 0.5 }} />
                      </TableCell>
                      <TableCell><Skeleton animation="wave" variant="text" width="60%" /></TableCell>
                      <TableCell><Skeleton animation="wave" variant="text" width="80%" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </Paper>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '400px 1fr' }, gap: 4 }}>
          <SkeletonCard variant="detail" />
          <SkeletonCard variant="detail" />
        </Box>
      </Stack>
    </Container>
  );
}
