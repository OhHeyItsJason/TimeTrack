import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, FileDown } from "lucide-react";
import { jsPDF } from "jspdf";

export default function MileageExportModal({ 
  isOpen, 
  onClose, 
  dayMileageRecords = [] 
}) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

const exportMileage = () => {
    // Filter data for the selected year
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // Collect day mileage only
    const allMileage = dayMileageRecords
      .filter(d => d.date >= startDate && d.date <= endDate && (d.daily_miles_driven > 0))
      .map(d => ({
        date: d.date,
        miles: d.daily_miles_driven,
        roundTrip: d.daily_round_trip,
        totalMiles: d.daily_miles_driven * (d.daily_round_trip ? 2 : 1),
        notes: d.daily_mileage_notes || '',
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate total
    const totalMiles = allMileage.reduce((sum, m) => sum + m.totalMiles, 0);

    // Generate PDF
    const doc = new jsPDF();

    // Title
    doc.setFontSize(20);
    doc.text(`Mileage Report - ${year}`, 20, 20);

    // Summary
    doc.setFontSize(12);
    doc.text(`Total Miles: ${totalMiles.toFixed(1)}`, 20, 35);
    doc.text(`Total Entries: ${allMileage.length}`, 20, 42);

// Table headers
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    let y = 55;
    doc.text('Date', 20, y);
    doc.text('Miles', 60, y);
    doc.text('Round Trip', 90, y);
    doc.text('Total', 130, y);
    doc.text('Notes', 160, y);

    // Table content
    doc.setFont(undefined, 'normal');
    y += 7;

    allMileage.forEach((m) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
        doc.setFont(undefined, 'bold');
        doc.text('Date', 20, y);
        doc.text('Miles', 60, y);
        doc.text('Round Trip', 90, y);
        doc.text('Total', 130, y);
        doc.text('Notes', 160, y);
        doc.setFont(undefined, 'normal');
        y += 7;
      }

      doc.text(m.date, 20, y);
      doc.text(m.miles.toFixed(1), 60, y);
      doc.text(m.roundTrip ? 'Yes' : 'No', 90, y);
      doc.text(m.totalMiles.toFixed(1), 130, y);
      const notes = m.notes.substring(0, 35);
      doc.text(notes, 160, y);
      y += 6;
    });

    // Total line
    y += 5;
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.setFont(undefined, 'bold');
    doc.text(`TOTAL: ${totalMiles.toFixed(1)} miles`, 20, y);

    // Download PDF
    const pdfBytes = doc.output('arraybuffer');
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mileage_${year}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white border-0 rounded-[24px] shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <FileDown className="w-5 h-5 text-amber-600" />
            Export Mileage for Tax Year
          </DialogTitle>
        </DialogHeader>

        <div className="py-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="taxYear" className="text-gray-700 font-medium">
              Tax Year
            </Label>
            <Input
              id="taxYear"
              type="number"
              min="2020"
              max={currentYear + 1}
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value) || currentYear)}
              className="bg-white border-gray-200 text-gray-900 rounded-[14px]"
            />
          </div>

<div className="bg-amber-50 border border-amber-200 rounded-[16px] p-4">
            <p className="text-sm text-gray-700">
              This will export all mileage entries from <span className="font-semibold">January 1, {year}</span> to{' '}
              <span className="font-semibold">December 31, {year}</span> as a PDF file.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              The file includes dates, miles driven, round trip status, and notes for easy entry into tax software.
            </p>
          </div>

          <Button
            onClick={exportMileage}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-[14px] h-11"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Mileage PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}