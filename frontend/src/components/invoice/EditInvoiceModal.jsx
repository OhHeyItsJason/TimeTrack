import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FileText, Save, AlertTriangle, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";

export default function EditInvoiceModal({ isOpen, onClose, invoice, onSave, isSaving }) {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState([]);
  const [invoiceFormat, setInvoiceFormat] = useState("single");

  useEffect(() => {
    if (invoice) {
      setInvoiceNumber(invoice.invoice_number || "");
      setClientName(invoice.client_name || "");
      setClientEmail(invoice.client_email || "");
      setClientPhone(invoice.client_phone || "");
      setClientAddress(invoice.client_address || "");
      setNotes(invoice.notes || "");
      setInvoiceFormat(invoice.invoice_format || "single");
      
      // Parse line items
      let items = [];
      try {
        items = JSON.parse(invoice.line_items || '[]');
      } catch {
        items = [];
      }
      setLineItems(items.length > 0 ? items : [{ date: "", hours: "", rate: invoice.hourly_rate?.toFixed(2) || "50.00", amount: "" }]);
    }
  }, [invoice]);

  const updateLineItem = (index, field, value) => {
    const updated = [...lineItems];
    updated[index][field] = value;
    
    // Auto-calculate amount when hours or rate changes
    if (field === 'hours' || field === 'rate') {
      const hours = parseFloat(updated[index].hours) || 0;
      const rate = parseFloat(updated[index].rate) || 0;
      updated[index].amount = (hours * rate).toFixed(2);
    }
    
    setLineItems(updated);
  };

  const addLineItem = () => {
    const defaultRate = lineItems.length > 0 ? lineItems[0].rate : (invoice?.hourly_rate?.toFixed(2) || "50.00");
    setLineItems([...lineItems, { date: "", hours: "", rate: defaultRate, amount: "" }]);
  };

  const removeLineItem = (index) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const totalHours = lineItems.reduce((sum, item) => sum + (parseFloat(item.hours) || 0), 0);
    const totalAmount = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    return { totalHours: totalHours.toFixed(2), totalAmount: totalAmount.toFixed(2) };
  };

  const { totalHours, totalAmount } = calculateTotals();

  const handleSave = () => {
    // Get date range from line items
    const validDates = lineItems
      .filter(item => item.date)
      .map(item => item.date)
      .sort();
    
    const startDate = validDates[0] || invoice?.start_date || "";
    const endDate = validDates[validDates.length - 1] || invoice?.end_date || "";
    const hourlyRate = parseFloat(lineItems[0]?.rate) || invoice?.hourly_rate || 50;

    onSave({
      invoice_number: invoiceNumber,
      client_name: clientName,
      client_email: clientEmail,
      client_phone: clientPhone,
      client_address: clientAddress,
      notes: notes,
      line_items: JSON.stringify(lineItems),
      invoice_format: invoiceFormat,
      selected_dates: JSON.stringify(validDates),
      start_date: startDate,
      end_date: endDate,
      total_hours: parseFloat(totalHours),
      hourly_rate: hourlyRate,
      total_amount: parseFloat(totalAmount),
    });
  };

  // Show warning if invoice is submitted
  if (invoice?.is_submitted) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-gray-900 border-gray-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              Cannot Edit Invoice
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-gray-300">
              This invoice has been marked as sent to client, you cannot edit it at this time.
            </p>
          </div>

          <DialogFooter>
            <Button
              onClick={onClose}
              className="bg-gray-700 hover:bg-gray-600 text-white rounded-xl"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <FileText className="w-5 h-5 text-cyan-400" />
            Edit Invoice
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-gray-300">Invoice Number</Label>
            <Input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="bg-gray-800/50 border-gray-700 text-gray-200"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Client Name</Label>
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="bg-gray-800/50 border-gray-700 text-gray-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Client Email</Label>
              <Input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="bg-gray-800/50 border-gray-700 text-gray-200"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Client Phone</Label>
              <Input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="bg-gray-800/50 border-gray-700 text-gray-200"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Client Address</Label>
            <Textarea
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
              rows={2}
              className="bg-gray-800/50 border-gray-700 text-gray-200"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="bg-gray-800/50 border-gray-700 text-gray-200"
            />
          </div>

          {/* Line Items Section */}
          <div className="space-y-3 pt-4 border-t border-gray-700">
            <div className="flex items-center justify-between">
              <Label className="text-gray-300 text-base font-semibold">Line Items</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLineItem}
                className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-cyan-400 rounded-lg"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Day
              </Button>
            </div>

            {lineItems.map((item, index) => (
              <div key={index} className="bg-gray-800/50 rounded-xl p-3 border border-gray-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-cyan-400 font-semibold">Day {index + 1}</span>
                  {lineItems.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLineItem(index)}
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <Label className="text-gray-400 text-xs">Date</Label>
                    <Input
                      type="date"
                      value={item.date}
                      onChange={(e) => updateLineItem(index, 'date', e.target.value)}
                      className="bg-gray-700 border-gray-600 text-gray-200 h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-gray-400 text-xs">Hours</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.hours}
                      onChange={(e) => updateLineItem(index, 'hours', e.target.value)}
                      className="bg-gray-700 border-gray-600 text-gray-200 h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-gray-400 text-xs">Rate</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.rate}
                      onChange={(e) => updateLineItem(index, 'rate', e.target.value)}
                      className="bg-gray-700 border-gray-600 text-gray-200 h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-gray-400 text-xs">Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.amount}
                      readOnly
                      className="bg-gray-700/50 border-gray-600 text-gray-400 h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Totals */}
            <div className="bg-cyan-500/10 rounded-xl p-3 border border-cyan-500/30">
              <div className="flex justify-between items-center">
                <span className="text-gray-300 font-medium">Total</span>
                <div className="text-right">
                  <span className="text-cyan-400 font-bold">{totalHours}h</span>
                  <span className="text-gray-500 mx-2">•</span>
                  <span className="text-emerald-400 font-bold">${totalAmount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-gray-700 text-gray-300 hover:bg-gray-800 rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !clientName.trim()}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white rounded-xl"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}