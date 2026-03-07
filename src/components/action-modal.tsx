
"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle2, AlertTriangle, XCircle, Info, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEffect } from "react"

export type ModalType = 'SUCCESS' | 'ERROR' | 'WARNING' | 'CONFIRMATION';

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: ModalType;
  title: string;
  description?: string;
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  isProcessing?: boolean;
  autoClose?: boolean;
}

export function ActionModal({
  isOpen,
  onClose,
  type,
  title,
  description,
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isProcessing = false,
  autoClose = false
}: ActionModalProps) {
  
  useEffect(() => {
    if (isOpen && autoClose && (type === 'SUCCESS')) {
      const timer = setTimeout(() => {
        onClose();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, type, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'SUCCESS': return <CheckCircle2 className="h-12 w-12 text-emerald-500" />;
      case 'ERROR': return <XCircle className="h-12 w-12 text-destructive" />;
      case 'WARNING': return <AlertTriangle className="h-12 w-12 text-amber-500" />;
      case 'CONFIRMATION': return <Info className="h-12 w-12 text-primary" />;
      default: return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isProcessing && onClose()}>
      <DialogContent className="sm:max-w-[400px] flex flex-col items-center text-center p-8 gap-6 shadow-2xl rounded-2xl border-none">
        <div className="flex flex-col items-center gap-4 w-full">
          {getIcon()}
          <div className="space-y-2">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">{title}</DialogTitle>
            {description && (
              <DialogDescription className="text-sm font-medium text-muted-foreground leading-relaxed">
                {description}
              </DialogDescription>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-row justify-center gap-3 w-full sm:justify-center">
          {type === 'CONFIRMATION' || type === 'WARNING' ? (
            <>
              <Button variant="ghost" onClick={onClose} disabled={isProcessing} className="font-bold">
                {cancelLabel}
              </Button>
              <Button 
                onClick={onConfirm} 
                disabled={isProcessing}
                className={cn(
                  "font-black uppercase tracking-widest min-w-[120px]",
                  type === 'WARNING' || title.toLowerCase().includes('delete') ? "bg-destructive hover:bg-destructive/90" : "bg-primary"
                )}
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmLabel}
              </Button>
            </>
          ) : (
            !autoClose && (
              <Button onClick={onClose} className="font-black uppercase tracking-widest w-full">
                Close
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
