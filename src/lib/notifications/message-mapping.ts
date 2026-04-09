import type { NotificationContextType } from "@/lib/notifications/create-employee-notification";

export function mapNotificationMessage(input: {
  contextType: NotificationContextType;
  eventType: string;
  statusFrom: string;
  statusTo: string;
}): { message: string; recommendedAction: string } {
  if (input.contextType === "document") {
    if (input.statusTo === "published") {
      return {
        message: "Seu documento foi publicado e ja esta disponivel no portal.",
        recommendedAction: "Acesse Meus Documentos e conclua o download.",
      };
    }

    if (input.statusTo === "processing" || input.statusTo === "pending") {
      return {
        message: "Seu documento segue em processamento.",
        recommendedAction:
          "Acompanhe o status no portal e abra contestacao se o prazo esperado for excedido.",
      };
    }

    if (input.statusTo === "unavailable" || input.statusTo === "error") {
      return {
        message: "Seu documento teve atualizacao com necessidade de verificacao.",
        recommendedAction:
          "Abra contestacao contextual para o RH investigar e retornar com orientacao.",
      };
    }
  }

  if (input.contextType === "contestation") {
    if (input.statusTo === "resolved") {
      return {
        message: "Sua contestacao foi resolvida pelo RH.",
        recommendedAction:
          "Revise o resultado no portal e retorne para Meus Documentos se necessario.",
      };
    }

    if (input.statusTo === "in_progress") {
      return {
        message: "Sua contestacao esta em tratamento pelo RH.",
        recommendedAction:
          "Aguarde nova atualizacao no historico de notificacoes.",
      };
    }

    return {
      message: "Sua contestacao recebeu uma atualizacao de status.",
      recommendedAction: "Consulte o historico de notificacoes para acompanhar.",
    };
  }

  return {
    message: "Houve atualizacao em um item do seu portal.",
    recommendedAction: "Verifique seu historico de notificacoes para mais detalhes.",
  };
}
