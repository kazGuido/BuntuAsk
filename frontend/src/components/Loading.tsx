import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "./ui/button";
import { Card } from "./ui/card";

export function Loading({ label }: { label: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <Loader2 className="animate-spin text-[#1cb0f6]" size={42} />
      <p className="text-sm font-black uppercase tracking-wider text-gray-400">{label}</p>
    </div>
  );
}

export function EmptyState({ title, message, onDone }: { title: string; message: string; onDone: () => void }) {
  return (
    <Card className="mx-auto max-w-lg text-center">
      <CheckCircle2 className="mx-auto mb-3 text-[#58cc02]" size={52} />
      <h2 className="text-2xl font-black">{title}</h2>
      <p className="my-3 text-sm font-bold text-gray-500">{message}</p>
      <Button onClick={onDone} className="border-[#1899d6] bg-[#1cb0f6] text-white">
        Return
      </Button>
    </Card>
  );
}
