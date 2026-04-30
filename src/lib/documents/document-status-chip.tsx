import { Chip } from "@mui/material";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import {
  getDocumentStatusPresentation,
  type DocumentStatus,
} from "@/lib/documents/status-mapping";
import { tokens } from "@/lib/theme/tokens";

const TONE_COLOR_MAP = {
  success: tokens.colors.success,
  warning: tokens.colors.warning,
  info: tokens.colors.processing,
  neutral: tokens.colors.pending,
  error: tokens.colors.error,
} as const;

const STATUS_ICON_MAP = {
  success: CheckCircleRoundedIcon,
  warning: ScheduleRoundedIcon,
  info: SyncRoundedIcon,
  neutral: BlockRoundedIcon,
  error: ErrorRoundedIcon,
} as const;

type Props = {
  status: DocumentStatus;
};

export function DocumentStatusChip({ status }: Props) {
  const presentation = getDocumentStatusPresentation(status);
  const bg = TONE_COLOR_MAP[presentation.tone];
  const StatusIcon = STATUS_ICON_MAP[presentation.tone];
  const textColor =
    presentation.tone === "warning"
      ? tokens.colors.text.primary
      : tokens.colors.text.inverse;

  return (
    <Chip
      icon={<StatusIcon aria-hidden="true" />}
      label={presentation.label}
      aria-label={presentation.a11yText}
      sx={{
        bgcolor: bg,
        color: textColor,
        fontWeight: 600,
        "& .MuiChip-icon": {
          color: textColor,
        },
      }}
    />
  );
}
