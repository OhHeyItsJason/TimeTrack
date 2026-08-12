import React, { useEffect, useState } from "react";
import { AlertTriangle, CalendarDays, DollarSign, Save, Send, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function toDateInputValue(value) {
  if (!value) return "";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function toIsoDate(value) {
  return value ? new Date(`${value}T12:00:00`).toISOString() : null;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function InvoiceStatusModal({ isOpen, invoice, onClose, onSave, onCancelInvoice, isSaving, error }) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [submittedDate, setSubmittedDate] = useState("");
  const [paidDate, setPaidDate] = useState("");

  useEffect(() => {
    if (!invoice) return;

    setIsSubmitted(Boolean(invoice.is_submitted));
    setIsPaid(Boolean(invoice.is_paid));
    setSubmittedDate(toDateInputValue(invoice.submitted_date));
    setPaidDate(toDateInputValue(invoice.paid_date));
  }, [invoice]);

  if (!invoice) return null;

  const handleSubmittedChange = (checked) => {
    setIsSubmitted(checked);
    if (checked && !submittedDate) setSubmittedDate(today());
    if (!checked) {
      setSubmittedDate("");
      setIsPaid(false);
      setPaidDate("");
    }
  };

  const handlePaidChange = (checked) => {
    setIsPaid(checked);
    if (checked) {
      setIsSubmitted(true);
      if (!submittedDate) setSubmittedDate(today());
      if (!paidDate) setPaidDate(today());
    } else {
      setPaidDate("");
    }
  };

  const handleSave = () => {
    onSave({
      is_submitted: isSubmitted,
      submitted_date: isSubmitted ? toIsoDate(submittedDate) : null,
      is_paid: isPaid,
      paid_date: isPaid ? toIsoDate(paidDate) : null,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-0 bg-white shadow-2xl sm:max-w-md sm:rounded-[24px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <CalendarDays className="h-5 w-5 text-blue-600" />
            Manage Invoice Status
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-900">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Invoice status was not updated</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="rounded-[16px] border border-gray-200 bg-gray-50 p-4">
            <p className="font-semibold text-gray-900">{invoice.invoice_number}</p>
            <p className="mt-1 text-sm text-gray-600">{invoice.client_name}</p>
          </div>

          <section className="rounded-[16px] border border-blue-100 bg-blue-50/60 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-blue-600" />
                <Label htmlFor="invoice-submitted" className="font-semibold text-blue-900">Submitted to client</Label>
              </div>
              <Switch id="invoice-submitted" checked={isSubmitted} onCheckedChange={handleSubmittedChange} disabled={isSaving} />
            </div>
            {isSubmitted && (
              <div className="mt-3 space-y-1">
                <Label htmlFor="submitted-date" className="text-xs font-medium text-blue-800">Submitted date</Label>
                <Input id="submitted-date" type="date" value={submittedDate} onChange={(event) => setSubmittedDate(event.target.value)} disabled={isSaving} className="border-blue-100 bg-white text-gray-900" />
              </div>
            )}
          </section>

          <section className="rounded-[16px] border border-green-100 bg-green-50/60 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <Label htmlFor="invoice-paid" className="font-semibold text-green-900">Paid</Label>
              </div>
              <Switch id="invoice-paid" checked={isPaid} onCheckedChange={handlePaidChange} disabled={isSaving} />
            </div>
            {isPaid && (
              <div className="mt-3 space-y-1">
                <Label htmlFor="paid-date" className="text-xs font-medium text-green-800">Paid date</Label>
                <Input id="paid-date" type="date" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} disabled={isSaving} className="border-green-100 bg-white text-gray-900" />
              </div>
            )}
          </section>

          <section className="rounded-[16px] border border-red-100 bg-red-50/70 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-red-600" />
              <div>
                <p className="font-semibold text-red-900">Cancel this invoice</p>
                <p className="mt-1 text-sm leading-5 text-red-800">Cancellation keeps {invoice.invoice_number} on record and reserved. The number will be skipped and cannot be reused.</p>
                <Button type="button" variant="outline" onClick={() => onCancelInvoice(invoice)} disabled={isSaving} className="mt-3 border-red-200 bg-white text-red-700 hover:bg-red-100 hover:text-red-800">
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Invoice
                </Button>
              </div>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving} className="rounded-[14px] border-gray-200 text-gray-700 hover:bg-gray-100">Close</Button>
          <Button onClick={handleSave} disabled={isSaving} className="rounded-[14px] bg-blue-600 text-white hover:bg-blue-700">
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
