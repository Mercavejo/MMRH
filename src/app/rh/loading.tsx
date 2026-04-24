import { 
  Box, 
  Grid, 
  Paper, 
  Stack, 
  Skeleton 
} from '@mui/material';
import { SkeletonCard } from '@/components/ui/SkeletonCard';

export default function RHDashboardLoading() {
  return (
    <Box>
      <Stack spacing={4}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Skeleton animation="wave" width={300} height={60} />
            <Skeleton animation="wave" width={500} height={24} />
          </Box>
          <Skeleton animation="wave" variant="rectangular" width={200} height={48} sx={{ borderRadius: 1 }} />
        </Box>

        <Grid container spacing={3}>
          {[1, 2, 3, 4].map((i) => (
            <Grid size={{ xs: 12, md: 3 }} key={i}>
              <SkeletonCard variant="summary" />
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper sx={{ p: 4, borderRadius: 6 }}>
              <Stack spacing={3}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Skeleton animation="wave" width={200} height={40} />
                  <Skeleton animation="wave" width={150} />
                </Box>
                <Stack spacing={2}>
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} animation="wave" variant="rectangular" height={80} sx={{ borderRadius: 2 }} />
                  ))}
                </Stack>
              </Stack>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <SkeletonCard variant="detail" />
            <Box sx={{ mt: 3 }}>
              <SkeletonCard variant="detail" />
            </Box>
          </Grid>
        </Grid>
      </Stack>
    </Box>
  );
}
