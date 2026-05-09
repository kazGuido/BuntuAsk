import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

const fieldClass = "w-full rounded-2xl border-2 border-gray-200 px-4 py-3 font-bold outline-none focus:border-[#1cb0f6]";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => {
  return <input ref={ref} {...props} className={cn(fieldClass, className)} />;
});
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => {
  return <textarea ref={ref} {...props} className={cn(fieldClass, "resize-none", className)} />;
});
Textarea.displayName = "Textarea";
