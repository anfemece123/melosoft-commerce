import { AlertCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

interface FormErrorAlertProps {
  message: string | null | undefined;
  className?: string;
}

export function FormErrorAlert({ message, className }: FormErrorAlertProps) {
  if (!message) return null;
  return (
    <div className={cn(
      'flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5',
      className
    )}>
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
