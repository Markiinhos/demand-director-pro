// Re-export the new chat drawer as WhatsAppDialog for backward compatibility
import { WhatsAppChatDrawer } from "./WhatsAppChatDrawer";

interface WhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  phone: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  defaultMessage?: string;
}

export function WhatsAppDialog(props: WhatsAppDialogProps) {
  return <WhatsAppChatDrawer {...props} />;
}
