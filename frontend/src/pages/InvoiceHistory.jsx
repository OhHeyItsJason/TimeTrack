import React, { useState } from "react";
import { appClient } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FileText, Send, DollarSign, Trash2, Eye, Pencil } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import InvoicePreviewModal from "../components/invoice/InvoicePreviewModal";
import EditInvoiceModal from "../components/invoice/EditInvoiceModal";

export default function InvoiceHistory() {
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState(null);
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => appClient.entities.Invoice.list('-created_date'),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => appClient.entities.Settings.list(),
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: ({ id, data }) => appClient.entities.Invoice.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: (id) => appClient.entities.Invoice.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setIsDeleteConfirmOpen(false);
      setInvoiceToDelete(null);
    },
  });

  const handleToggleSubmitted = async (invoice) => {
    const isSubmitting = !invoice.is_submitted;
    await updateInvoiceMutation.mutateAsync({
      id: invoice.id,
      data: {
        is_submitted: isSubmitting,
        submitted_date: isSubmitting ? new Date().toISOString() : null,
      },
    });
  };

  const handleTogglePaid = async (invoice) => {
    const isPaying = !invoice.is_paid;
    await updateInvoiceMutation.mutateAsync({
      id: invoice.id,
      data: {
        is_paid: isPaying,
        paid_date: isPaying ? new Date().toISOString() : null,
      },
    });
  };

  const handleViewDetails = (invoice) => {
    const parseLocalDate = (dateStr) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    };

    const settingsData = settings[0] || {};
    
    // Parse stored line items if available
    let lineItems = [];
    try {
      lineItems = JSON.parse(invoice.line_items || '[]');
    } catch {
      lineItems = [];
    }

    // Use stored invoice format, defaulting to 'single' for backwards compatibility
    const storedFormat = invoice.invoice_format || 'single';

    // Build selectedDays from stored line items with actual hours
    const selectedDays = lineItems.map(item => ({
      dateFormatted: format(parseLocalDate(item.date), 'EEEE, MMMM d, yyyy'),
      hours: item.hours,
      rate: item.rate,
      amount: item.amount,
    }));

    // Reconstruct invoice data for preview modal
    const invoiceData = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      invoiceDate: format(new Date(invoice.created_date), 'MMMM d, yyyy'),
      generatedDate: invoice.generated_date || '',
      clientName: invoice.client_name,
      clientEmail: invoice.client_email || '',
      clientPhone: invoice.client_phone || '',
      clientAddress: invoice.client_address || '',
      clientAbbreviation: invoice.client_abbreviation || '',
      companyName: settingsData.company_name || 'Your Name',
      companyEmail: settingsData.email || '',
      companyPhone: settingsData.phone || '',
      companyAddress: settingsData.address || '',
      startDate: format(parseLocalDate(invoice.start_date), 'MMMM d, yyyy'),
      endDate: format(parseLocalDate(invoice.end_date), 'MMMM d, yyyy'),
      invoiceFormat: storedFormat,
      selectedDays: selectedDays,
      totalHours: invoice.total_hours.toFixed(2),
      hourlyRate: invoice.hourly_rate.toFixed(2),
      totalAmount: invoice.total_amount.toFixed(2),
      notes: invoice.notes || '',
      isSubmitted: invoice.is_submitted || false,
      isPaid: invoice.is_paid || false,
      submittedDate: invoice.submitted_date || null,
      paidDate: invoice.paid_date || null,
    };

    setSelectedInvoice(invoiceData);
    setIsPreviewOpen(true);
  };

  const handleDeleteClick = (invoice) => {
    setInvoiceToDelete(invoice);
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (invoiceToDelete) {
      await deleteInvoiceMutation.mutateAsync(invoiceToDelete.id);
    }
  };

  const handleEditClick = (invoice) => {
    setInvoiceToEdit(invoice);
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (updatedData) => {
    if (invoiceToEdit) {
      await updateInvoiceMutation.mutateAsync({
        id: invoiceToEdit.id,
        data: updatedData,
      });
      setIsEditOpen(false);
      setInvoiceToEdit(null);
    }
  };

  const parseLocalDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const formatStatusDate = (dateStr) => {
    if (!dateStr) return 'Date not recorded';

    const date = new Date(dateStr);
    return Number.isNaN(date.getTime()) ? 'Date not recorded' : format(date, 'MMM d, yyyy');
  };

  const InvoiceStatusDates = ({ invoice }) => {
    if (!invoice.is_submitted && !invoice.is_paid) return null;

    return (
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
        {invoice.is_submitted && (
          <span>Submitted {formatStatusDate(invoice.submitted_date)}</span>
        )}
        {invoice.is_paid && (
          <span>Paid {formatStatusDate(invoice.paid_date)}</span>
        )}
      </div>
    );
  };

  const openInvoices = invoices.filter(inv => !inv.is_paid);
  const paidInvoices = invoices.filter(inv => inv.is_paid);

if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f2f2f7] p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-4">
          <Skeleton className="h-12 w-64 bg-gray-200" />
          <Skeleton className="h-32 w-full bg-gray-200" />
          <Skeleton className="h-32 w-full bg-gray-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f2f7] p-4 md:p-8 pb-24">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-4xl md:text-5xl font-semibold text-gray-900 mb-2">
            Invoice History
          </h1>
          <p className="text-gray-500 text-lg">Manage and track all your invoices</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid md:grid-cols-3 gap-6 mb-8"
        >
<Card className="shadow-lg border-0 bg-white/80 ios-blur rounded-[28px]">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <p className="text-sm text-blue-600 font-semibold tracking-wide uppercase">Total Invoices</p>
              </div>
              <p className="text-5xl font-bold text-gray-900">{invoices.length}</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-gradient-to-br from-orange-50 to-amber-50 rounded-[28px]">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Send className="w-5 h-5 text-orange-600" />
                <p className="text-sm text-orange-600 font-semibold tracking-wide uppercase">Open Invoices</p>
              </div>
              <p className="text-5xl font-bold text-orange-600">
                {openInvoices.length}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-emerald-50 rounded-[28px]">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <p className="text-sm text-green-600 font-semibold tracking-wide uppercase">Paid Invoices</p>
              </div>
              <p className="text-5xl font-bold text-green-600">
                {paidInvoices.length}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {openInvoices.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
<Card className="shadow-lg border-0 bg-white/80 ios-blur rounded-[28px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl text-gray-900">
                  <Send className="w-5 h-5 text-orange-600" />
                  Open Invoices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <AnimatePresence>
                    {openInvoices.map((invoice) => (
                      <motion.div
                        key={invoice.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="bg-gray-50 border border-gray-100 rounded-[16px] p-4 hover:border-orange-200 transition-all"
                      >
<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-[16px] flex items-center justify-center flex-shrink-0 border border-blue-200">
                                <FileText className="w-6 h-6 text-blue-600" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold text-gray-900">{invoice.invoice_number}</h3>
                                  {!invoice.is_submitted && (
                                    <Badge variant="outline" className="text-xs border-gray-300 text-gray-600">Not Submitted</Badge>
                                  )}
                                  {invoice.is_submitted && (
                                    <Badge className="bg-blue-100 text-blue-700 text-xs border-0">Submitted</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-700 font-medium">{invoice.client_name}</p>
                                <p className="text-xs text-gray-500">
                                  {format(parseLocalDate(invoice.start_date), 'MMM d')} - {format(parseLocalDate(invoice.end_date), 'MMM d, yyyy')}
                                </p>
                                <InvoiceStatusDates invoice={invoice} />
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="text-right mr-4">
                              <p className="text-sm text-gray-600">{invoice.total_hours}h</p>
                              <p className="text-lg font-semibold text-green-600">${invoice.total_amount.toFixed(2)}</p>
                            </div>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(invoice)}
                              className="border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-blue-600 rounded-[14px]"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            
                            {!invoice.is_submitted && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditClick(invoice)}
                                className="border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-purple-600 rounded-[14px]"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            )}
                            
                            <Button
                              variant={invoice.is_submitted ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleToggleSubmitted(invoice)}
                              className={invoice.is_submitted ? "bg-blue-600 hover:bg-blue-700 text-white rounded-[14px]" : "border-gray-200 text-gray-700 hover:bg-gray-100 rounded-[14px]"}
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTogglePaid(invoice)}
                              className="text-green-600 hover:bg-green-50 border-gray-200 rounded-[14px]"
                            >
                              <DollarSign className="w-4 h-4" />
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteClick(invoice)}
                              className="text-red-600 hover:bg-red-50 border-gray-200 rounded-[14px]"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {paidInvoices.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
<Card className="shadow-lg border-0 bg-white/80 ios-blur rounded-[28px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl text-gray-900">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  Paid Invoices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <AnimatePresence>
                    {paidInvoices.map((invoice) => (
                      <motion.div
                        key={invoice.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-[16px] p-4"
                      >
<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 bg-green-100 rounded-[16px] flex items-center justify-center flex-shrink-0 border border-green-200">
                                <DollarSign className="w-6 h-6 text-green-600" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold text-gray-900">{invoice.invoice_number}</h3>
                                  <Badge className="bg-green-600 text-white text-xs border-0">Paid</Badge>
                                </div>
                                <p className="text-sm text-gray-700 font-medium">{invoice.client_name}</p>
                                <p className="text-xs text-gray-500">
                                  {format(parseLocalDate(invoice.start_date), 'MMM d')} - {format(parseLocalDate(invoice.end_date), 'MMM d, yyyy')}
                                </p>
                                <InvoiceStatusDates invoice={invoice} />
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="text-right mr-4">
                              <p className="text-sm text-gray-600">{invoice.total_hours}h</p>
                              <p className="text-lg font-semibold text-green-600">${invoice.total_amount.toFixed(2)}</p>
                            </div>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(invoice)}
                              className="border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-blue-600 rounded-[14px]"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTogglePaid(invoice)}
                              className="text-orange-600 hover:bg-orange-50 border-gray-200 rounded-[14px]"
                            >
                              Mark Unpaid
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteClick(invoice)}
                              className="text-red-600 hover:bg-red-50 border-gray-200 rounded-[14px]"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {invoices.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
<Card className="shadow-lg border-0 bg-white/80 ios-blur rounded-[28px]">
              <CardContent className="p-12 text-center">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No invoices yet</h3>
                <p className="text-gray-500">Generate your first invoice to get started</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <InvoicePreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          invoiceData={selectedInvoice}
          onFormatChange={(newFormat) => {
            if (selectedInvoice?.invoiceId) {
              updateInvoiceMutation.mutate({
                id: selectedInvoice.invoiceId,
                data: { invoice_format: newFormat },
              });
            }
          }}
        />

        <EditInvoiceModal
          isOpen={isEditOpen}
          onClose={() => {
            setIsEditOpen(false);
            setInvoiceToEdit(null);
          }}
          invoice={invoiceToEdit}
          onSave={handleSaveEdit}
          isSaving={updateInvoiceMutation.isPending}
        />

<Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <DialogContent className="bg-white border-0 rounded-[24px] shadow-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" />
                Delete Invoice?
              </DialogTitle>
            </DialogHeader>
            
            <div className="py-4">
              <p className="text-gray-700">
                Are you sure you want to permanently delete invoice{' '}
                <span className="font-semibold text-gray-900">{invoiceToDelete?.invoice_number}</span>?
              </p>
              <p className="text-sm text-gray-500 mt-2">
                This action cannot be undone.
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="border-gray-200 text-gray-700 hover:bg-gray-100 rounded-[14px]"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={deleteInvoiceMutation.isPending}
                className="bg-red-600 hover:bg-red-700 rounded-[14px]"
              >
                {deleteInvoiceMutation.isPending ? 'Deleting...' : 'Delete Invoice'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
