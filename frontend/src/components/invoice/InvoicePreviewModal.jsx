import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, AlertTriangle } from "lucide-react";
import { jsPDF } from "jspdf";
import { format } from "date-fns";

export default function InvoicePreviewModal({ isOpen, onClose, invoiceData, onFormatChange }) {
  const [currentFormat, setCurrentFormat] = useState("single");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingFormat, setPendingFormat] = useState(null);

  useEffect(() => {
    if (invoiceData) {
      setCurrentFormat(invoiceData.invoiceFormat || "single");
    }
  }, [invoiceData]);

  if (!invoiceData) return null;

  const {
    invoiceNumber,
    invoiceDate,
    generatedDate,
    clientName,
    clientEmail,
    clientPhone,
    clientAddress,
    companyName,
    companyEmail,
    companyPhone,
    companyAddress,
    startDate,
    endDate,
    selectedDays,
    totalHours,
    hourlyRate,
    totalAmount,
    notes,
    isSubmitted,
    isPaid,
  } = invoiceData;

  const handleFormatToggle = (newFormat) => {
    if (newFormat === currentFormat) return;

    // If submitted or paid, show confirmation dialog
    if (isSubmitted || isPaid) {
      setPendingFormat(newFormat);
      setShowConfirmDialog(true);
    } else {
      // Otherwise update immediately
      setCurrentFormat(newFormat);
      if (onFormatChange) {
        onFormatChange(newFormat);
      }
    }
  };

  const handleConfirmFormatChange = () => {
    if (pendingFormat) {
      setCurrentFormat(pendingFormat);
      if (onFormatChange) {
        onFormatChange(pendingFormat);
      }
    }
    setShowConfirmDialog(false);
    setPendingFormat(null);
  };

  const handleCancelFormatChange = () => {
    setShowConfirmDialog(false);
    setPendingFormat(null);
  };

  const formatGeneratedDate = (isoDate) => {
    if (!isoDate) return null;
    const date = new Date(isoDate);
    return format(date, 'MM/dd/yyyy');
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const useFormat = currentFormat;
    
    // Set colors
    const primaryBlue = [59, 130, 246];
    const darkGray = [30, 41, 59];
    const lightGray = [100, 116, 139];
    
    let yPos = 20;
    
    // Header - INVOICE title
    doc.setFontSize(32);
    doc.setTextColor(...primaryBlue);
    doc.text('INVOICE', 20, yPos);
    
    yPos += 10;

    // Invoice number and date
    doc.setFontSize(11);
    doc.setTextColor(...lightGray);
    doc.text(`Invoice #${invoiceNumber}`, 20, yPos);
    yPos += 6;
    doc.text(`Date: ${invoiceDate}`, 20, yPos);
    if (generatedDate) {
      yPos += 6;
      doc.text(`Generated: ${formatGeneratedDate(generatedDate)}`, 20, yPos);
    }
    
    // Horizontal line
    yPos += 5;
    doc.setDrawColor(...primaryBlue);
    doc.setLineWidth(1);
    doc.line(20, yPos, 190, yPos);
    
    yPos += 15;
    
    // From and Bill To sections (side by side) - equal width columns (85 units each)
    doc.setFontSize(10);
    doc.setTextColor(...lightGray);
    doc.text('FROM', 20, yPos);
    doc.text('BILL TO', 105, yPos);
    
    yPos += 6;
    
    // From details
    doc.setFontSize(11);
    doc.setTextColor(...darkGray);
    doc.setFont(undefined, 'bold');
    const companyNameLines = doc.splitTextToSize(companyName || 'Your Name', 80);
    doc.text(companyNameLines, 20, yPos);
    
    // Bill To details
    const clientNameLines = doc.splitTextToSize(clientName, 80);
    doc.text(clientNameLines, 105, yPos);
    doc.setFont(undefined, 'normal');
    
    yPos += 6;
    
    // Company contact info (left column) - max width 80 units
    let companyYPos = yPos;
    if (companyEmail) {
      const emailLines = doc.splitTextToSize(companyEmail, 80);
      doc.text(emailLines, 20, companyYPos);
      companyYPos += (emailLines.length * 5);
    }
    if (companyPhone) {
      doc.text(companyPhone, 20, companyYPos);
      companyYPos += 5;
    }
    if (companyAddress) {
      const addressLines = doc.splitTextToSize(companyAddress, 80);
      doc.text(addressLines, 20, companyYPos);
      companyYPos += (addressLines.length * 5);
    }
    
    // Client contact info (right column) - max width 80 units
    let clientYPos = yPos;
    if (clientEmail) {
      const emailLines = doc.splitTextToSize(clientEmail, 80);
      doc.text(emailLines, 105, clientYPos);
      clientYPos += (emailLines.length * 5);
    }
    if (clientPhone) {
      doc.text(clientPhone, 105, clientYPos);
      clientYPos += 5;
    }
    if (clientAddress) {
      const addressLines = doc.splitTextToSize(clientAddress, 80);
      doc.text(addressLines, 105, clientYPos);
      clientYPos += (addressLines.length * 5);
    }
    
    // Make sure we're past both columns
    yPos = Math.max(companyYPos, clientYPos);
    yPos += 10;
    
    // Billing period
    doc.setTextColor(...lightGray);
    doc.setFontSize(10);
    doc.text('BILLING PERIOD', 20, yPos);
    yPos += 6;
    doc.setFontSize(11);
    doc.setTextColor(...darkGray);
    doc.text(`${startDate} - ${endDate}`, 20, yPos);
    
    yPos += 15;
    
    if (useFormat === "single") {
      // Single line item format
      doc.setFillColor(241, 245, 249);
      doc.rect(20, yPos - 5, 170, 10, 'F');
      
      doc.setFontSize(10);
      doc.setTextColor(...darkGray);
      doc.setFont(undefined, 'bold');
      doc.text('Description', 25, yPos);
      doc.text('Hours', 100, yPos);
      doc.text('Rate', 130, yPos);
      doc.text('Amount', 165, yPos);
      
      yPos += 8;
      doc.setFont(undefined, 'normal');
      
      doc.setFontSize(10);
      doc.text(`Work: ${startDate} - ${endDate}`, 25, yPos);
      doc.text(totalHours, 100, yPos);
      doc.text(`$${hourlyRate}`, 130, yPos);
      doc.text(`$${totalAmount}`, 165, yPos);
      
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.1);
      doc.line(20, yPos + 2, 190, yPos + 2);
      
      yPos += 10;
    } else {
      // Multiple line items format
      doc.setFillColor(241, 245, 249);
      doc.rect(20, yPos - 5, 170, 10, 'F');
      
      doc.setFontSize(10);
      doc.setTextColor(...darkGray);
      doc.setFont(undefined, 'bold');
      doc.text('Date', 25, yPos);
      doc.text('Hours', 100, yPos);
      doc.text('Rate', 130, yPos);
      doc.text('Amount', 165, yPos);
      
      yPos += 8;
      doc.setFont(undefined, 'normal');
      
      doc.setFontSize(10);
      selectedDays.forEach((day) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.text(day.dateFormatted, 25, yPos);
        doc.text(day.hours, 100, yPos);
        doc.text(`$${day.rate}`, 130, yPos);
        doc.text(`$${day.amount}`, 165, yPos);
        
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.1);
        doc.line(20, yPos + 2, 190, yPos + 2);
        
        yPos += 8;
      });
      
      yPos += 2;
    }
    
    yPos += 10;
    
    // Totals section
    doc.setDrawColor(...lightGray);
    doc.setLineWidth(0.5);
    doc.line(120, yPos, 190, yPos);
    
    yPos += 8;
    
    doc.setFontSize(11);
    doc.text('Total Hours:', 120, yPos);
    doc.text(`${totalHours}h`, 165, yPos);
    
    yPos += 6;
    
    doc.text('Hourly Rate:', 120, yPos);
    doc.text(`$${hourlyRate}`, 165, yPos);
    
    yPos += 10;
    
    // Final total
    doc.setFont(undefined, 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...primaryBlue);
    doc.text('Total Due:', 120, yPos);
    doc.text(`$${totalAmount}`, 165, yPos);
    
    yPos += 15;
    
    // Notes section
    if (notes) {
      doc.setFillColor(248, 250, 252);
      const notesHeight = 30;
      doc.rect(20, yPos, 170, notesHeight, 'F');
      
      yPos += 8;
      
      doc.setFontSize(10);
      doc.setTextColor(...darkGray);
      doc.setFont(undefined, 'bold');
      doc.text('Notes', 25, yPos);
      
      yPos += 6;
      
      doc.setFont(undefined, 'normal');
      doc.setTextColor(...lightGray);
      const notesLines = doc.splitTextToSize(notes, 160);
      doc.text(notesLines, 25, yPos);
      
      yPos += notesHeight;
    }
    
    // Footer
    yPos = 280;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.1);
    doc.line(20, yPos, 190, yPos);
    
    yPos += 5;
    
    doc.setFontSize(9);
    doc.setTextColor(...lightGray);
    doc.text('Thank you for your business!', 105, yPos, { align: 'center' });
    
    // Download the PDF
    doc.save(`Invoice-${invoiceNumber}.pdf`);
  };

  const getStatusText = () => {
    if (isPaid && isSubmitted) return "submitted and paid";
    if (isPaid) return "paid";
    if (isSubmitted) return "submitted";
    return "";
  };

  return (
    <>
      <Dialog open={isOpen && !showConfirmDialog} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Invoice Preview</span>
              <div className="flex gap-2">
                <Button onClick={handleDownloadPDF} className="bg-blue-600 hover:bg-blue-700">
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button onClick={onClose} variant="outline">
                  <X className="w-4 h-4 mr-2" />
                  Close
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Format Toggle */}
          <div className="flex items-center justify-center gap-2 py-2 border-b border-slate-200">
            <span className="text-sm text-slate-600 mr-2">View as:</span>
            <div className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-1">
              <button
                onClick={() => handleFormatToggle("single")}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  currentFormat === "single"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Summary
              </button>
              <button
                onClick={() => handleFormatToggle("multiple")}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  currentFormat === "multiple"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Daily
              </button>
            </div>
          </div>

          {/* Invoice Preview */}
          <div id="invoice-preview" className="bg-white p-8">
          {/* Header */}
          <div className="border-b-4 border-blue-500 pb-5 mb-8">
            <h1 className="text-4xl font-bold text-blue-600 mb-2">INVOICE</h1>
            <p className="text-slate-600">Invoice #{invoiceNumber}</p>
            <p className="text-slate-600">Date: {invoiceDate}</p>
            {generatedDate && (
              <p className="text-slate-600">Generated: {formatGeneratedDate(generatedDate)}</p>
            )}
          </div>

          {/* From and Bill To - Equal width columns */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="w-full">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                From
              </h3>
              <p className="font-bold text-slate-900 break-words">{companyName || 'Your Name'}</p>
              {companyEmail && <p className="text-slate-700 break-words">{companyEmail}</p>}
              {companyPhone && <p className="text-slate-700">{companyPhone}</p>}
              {companyAddress && <p className="text-slate-700 whitespace-pre-line break-words">{companyAddress}</p>}
            </div>
            <div className="w-full">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Bill To
              </h3>
              <p className="font-bold text-slate-900 break-words">{clientName}</p>
              {clientEmail && <p className="text-slate-700 break-words">{clientEmail}</p>}
              {clientPhone && <p className="text-slate-700">{clientPhone}</p>}
              {clientAddress && <p className="text-slate-700 whitespace-pre-line break-words">{clientAddress}</p>}
            </div>
          </div>

          {/* Billing Period */}
          <div className="mb-8">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Billing Period
            </h3>
            <p className="text-slate-900">{startDate} - {endDate}</p>
          </div>

          {/* Table */}
          <table className="w-full mb-8">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-slate-300">
                <th className="text-left py-3 px-4 font-semibold text-slate-700">
                  {currentFormat === "single" ? "Description" : "Date"}
                </th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Hours</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Rate</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Amount</th>
              </tr>
            </thead>
            <tbody>
              {currentFormat === "single" ? (
                <tr className="border-b border-slate-200">
                  <td className="py-3 px-4 text-slate-900">Work: {startDate} - {endDate}</td>
                  <td className="py-3 px-4 text-slate-900">{totalHours}</td>
                  <td className="py-3 px-4 text-slate-900">${hourlyRate}</td>
                  <td className="py-3 px-4 text-slate-900">${totalAmount}</td>
                </tr>
              ) : (
                selectedDays.map((day, index) => (
                  <tr key={index} className="border-b border-slate-200">
                    <td className="py-3 px-4 text-slate-900">{day.dateFormatted}</td>
                    <td className="py-3 px-4 text-slate-900">{day.hours}</td>
                    <td className="py-3 px-4 text-slate-900">${day.rate}</td>
                    <td className="py-3 px-4 text-slate-900">${day.amount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-64">
              <div className="border-t-2 border-slate-300 pt-4 space-y-2">
                <div className="flex justify-between text-slate-700">
                  <span>Total Hours:</span>
                  <span>{totalHours}h</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Hourly Rate:</span>
                  <span>${hourlyRate}</span>
                </div>
                <div className="flex justify-between text-2xl font-bold text-blue-600 mt-4 pt-4 border-t-2 border-slate-300">
                  <span>Total Due:</span>
                  <span>${totalAmount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {notes && (
            <div className="bg-slate-50 p-6 rounded-lg mb-8">
              <h3 className="font-semibold text-slate-900 mb-2">Notes</h3>
              <p className="text-slate-700 whitespace-pre-line">{notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-slate-200 pt-6 text-center">
            <p className="text-slate-500 text-sm">Thank you for your business!</p>
            </div>
            </div>
            </DialogContent>
            </Dialog>

            {/* Confirmation Dialog */}
            <Dialog open={showConfirmDialog} onOpenChange={handleCancelFormatChange}>
            <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
                Edit Invoice Format?
              </DialogTitle>
            </DialogHeader>

            <div className="py-4">
              <p className="text-slate-700">
                Are you sure you want to edit this invoice? It has already been {getStatusText()}.
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={handleCancelFormatChange}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmFormatChange}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Confirm
              </Button>
            </DialogFooter>
            </DialogContent>
            </Dialog>
            </>
            );
            }