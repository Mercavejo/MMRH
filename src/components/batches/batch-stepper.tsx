"use client";

import { Box, Stepper, Step, StepLabel, StepIconProps, Typography, styled, alpha } from "@mui/material";
import ValidatedIcon from "@mui/icons-material/CheckCircle";
import RoutingIcon from "@mui/icons-material/AltRoute";
import PublishedIcon from "@mui/icons-material/FileUpload";
import ErrorIcon from "@mui/icons-material/Error";
import type { BatchRoutingProgress } from "@/lib/rh/batches/batch-progress";

const ColorlibStepIconRoot = styled("div")<{
  ownerState: { active?: boolean; completed?: boolean; error?: boolean };
}>(({ theme, ownerState }) => ({
  backgroundColor: alpha(theme.palette.grey[700], 0.1),
  zIndex: 1,
  color: "#fff",
  width: 40,
  height: 40,
  display: "flex",
  borderRadius: "50%",
  justifyContent: "center",
  alignItems: "center",
  ...(ownerState.active && {
    background: theme.palette.primary.main,
    boxShadow: `0 0 15px ${alpha(theme.palette.primary.main, 0.4)}`,
  }),
  ...(ownerState.completed && {
    background: theme.palette.success.main,
  }),
  ...(ownerState.error && {
    background: theme.palette.error.main,
  }),
}));

function ColorlibStepIcon(props: StepIconProps & { error?: boolean }) {
  const { active, completed, className, icon, error } = props;

  const icons: { [index: string]: React.ReactElement } = {
    1: <ValidatedIcon />,
    2: <RoutingIcon />,
    3: <PublishedIcon />,
  };

  return (
    <ColorlibStepIconRoot ownerState={{ completed, active, error }} className={className}>
      {error ? <ErrorIcon /> : icons[String(icon)]}
    </ColorlibStepIconRoot>
  );
}

interface BatchStepperProps {
  summary: BatchRoutingProgress | null;
}

const steps = ["Validacao", "Roteamento", "Publicacao"];

export function BatchStepper({ summary }: BatchStepperProps) {
  const getActiveStep = () => {
    if (!summary || summary.batch_id.length === 0) return -1;
    
    if (
      summary.routing_status === "pending" ||
      summary.routing_status === "processing" ||
      summary.routing_status === "blocked" ||
      summary.routing_status === "failed"
    ) {
      return 1;
    }

    if (summary.routing_status === "completed") {
      if (summary.publication_status === "published") return 3;
      return 2; // Routing done, waiting for publication
    }
    
    return 0;
  };

  const activeStep = getActiveStep();
  const getStepState = (index: number) => {
    const routingHasIssue = summary?.routing_status === "blocked" || summary?.routing_status === "failed";
    const publicationHasIssue = summary?.publication_status === "failed";

    if (index === 1 && routingHasIssue) return "error";
    if (index === 2 && publicationHasIssue) return "error";
    if (index < activeStep) return "completed";
    if (index === activeStep) return "active";
    return "pending";
  };

  return (
    <Box sx={{ width: "100%", py: 2 }}>
      <Stepper activeStep={activeStep} alternativeLabel>
        {steps.map((label, index) => {
          const stepState = getStepState(index);
          const isError = stepState === "error";
          return (
            <Step key={label} completed={stepState === "completed"}>
              <StepLabel 
                slots={{ stepIcon: (props) => <ColorlibStepIcon {...props} error={isError} /> }}
                error={isError}
              >
                <Typography
                  variant="body2"
                  data-step-state={stepState}
                  sx={{ fontWeight: index === activeStep ? 600 : 400 }}
                >
                  {label}
                </Typography>
              </StepLabel>
            </Step>
          );
        })}
      </Stepper>
    </Box>
  );
}
