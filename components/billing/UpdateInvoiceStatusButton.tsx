// components/billing/UpdateInvoiceStatusButton.tsx
'use client';

import { Button } from '@/components/ui/Button';
import { useState } from 'react';
import { updateInvoiceStatus } from '@/app/billing/actions';
import { useToast } from '@/components/ui/toast';
import type { InvoiceStatus } from '@/types/billing';

interface UpdateInvoiceStatusButtonProps {
  invoiceId: string;
  newStatus: InvoiceStatus;
}

export function UpdateInvoiceStatusButton({
  invoiceId,
  newStatus,
}: UpdateInvoiceStatusButtonProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      const result = await updateInvoiceStatus(invoiceId, newStatus);
      
      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: `Invoice marked as ${newStatus}`,
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update invoice status',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getButtonText = () => {
    if (isUpdating) return 'Updating...';
    return `Mark as ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`;
  };

  return (
    <Button onClick={handleUpdate} disabled={isUpdating}>
      {getButtonText()}
    </Button>
  );
}
