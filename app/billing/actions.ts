// app/billing/actions.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { InvoiceStatus } from '@/types/billing';

export async function deleteInvoice(invoiceId: string) {
  const supabase = await createClient();

  // First check if invoice is in draft status
  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', invoiceId)
    .single();

  if (fetchError || !invoice) {
    return { error: 'Invoice not found' };
  }

  if (invoice.status !== 'draft') {
    return { error: 'Only draft invoices can be deleted' };
  }

  // Delete the invoice (cascade will handle invoice_items)
  const { error: deleteError } = await supabase
    .from('invoices')
    .delete()
    .eq('id', invoiceId);

  if (deleteError) {
    console.error('Error deleting invoice:', deleteError);
    return { error: 'Failed to delete invoice' };
  }

  revalidatePath('/billing');
  redirect('/billing');
}

export async function updateInvoiceStatus(
  invoiceId: string,
  newStatus: InvoiceStatus
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('invoices')
    .update({ status: newStatus })
    .eq('id', invoiceId);

  if (error) {
    console.error('Error updating invoice status:', error);
    return { error: 'Failed to update invoice status' };
  }

  revalidatePath('/billing');
  revalidatePath(`/billing/${invoiceId}`);
  
  return { success: true };
}
