import React from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, FileText, DollarSign, MessageSquare } from "lucide-react";

interface AIActionCardProps {
  title: string;
  description: string;
  type: 'finance' | 'content' | 'contract' | 'general';
  actionLabel?: string;
  onApprove?: () => void;
  onReject?: () => void;
}

export default function AIActionCard({ title, description, type, actionLabel = "Aprovar", onApprove, onReject }: AIActionCardProps) {
  const getIcon = () => {
    switch (type) {
      case 'finance': return <DollarSign className="w-5 h-5 text-amber-500" />;
      case 'content': return <MessageSquare className="w-5 h-5 text-blue-500" />;
      case 'contract': return <FileText className="w-5 h-5 text-purple-500" />;
      default: return <Check className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow group flex flex-col">
      <CardContent className="pt-6 flex-1">
        <div className="flex gap-4">
          <div className="bg-muted p-2 rounded-lg h-fit shrink-0">
            {getIcon()}
          </div>
          <div>
            <h4 className="font-semibold text-[15px] mb-1 group-hover:text-primary transition-colors">{title}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-0 justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onReject} className="hover:bg-destructive/10 hover:text-destructive">
          <X className="w-4 h-4 mr-1.5" /> Ignorar
        </Button>
        <Button size="sm" onClick={onApprove} className="shadow-sm">
          <Check className="w-4 h-4 mr-1.5" /> {actionLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}
