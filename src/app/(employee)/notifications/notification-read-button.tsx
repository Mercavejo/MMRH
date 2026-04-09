"use client";

import { useState } from "react";
import { Button } from "@mui/material";

type NotificationReadButtonProps = {
  notificationId: string;
  initialRead: boolean;
};

export function NotificationReadButton({
  notificationId,
  initialRead,
}: NotificationReadButtonProps) {
  const [isRead, setIsRead] = useState(initialRead);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleMarkRead() {
    if (isRead || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/v1/employee/notifications/${notificationId}/read`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          credentials: "include",
        },
      );

      if (response.ok) {
        setIsRead(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={handleMarkRead}
      variant="outlined"
      size="small"
      disabled={isRead || isSubmitting}
      aria-label={`Marcar notificacao ${notificationId} como lida`}
    >
      {isRead ? "Lida" : isSubmitting ? "Marcando..." : "Marcar como lida"}
    </Button>
  );
}