import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ReactNode } from "react";

import { Card } from "./card";

export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  headerAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  headerAction?: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2">
          <Card>
            <div className="mb-4 flex items-start justify-between gap-3">
              <DialogPrimitive.Title className="text-2xl font-black">{title}</DialogPrimitive.Title>
              {headerAction}
            </div>
            {children}
          </Card>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
