import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { jsPDF } from 'npm:jspdf@2.5.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const invoiceData = await req.json();
        const {
            invoiceNumber,
            invoiceDate,
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
            notes
        } = invoiceData;

        // Create PDF document
        const doc = new jsPDF();
        
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
        
        // Horizontal line
        yPos += 5;
        doc.setDrawColor(...primaryBlue);
        doc.setLineWidth(1);
        doc.line(20, yPos, 190, yPos);
        
        yPos += 15;
        
        // From and Bill To sections (side by side)
        doc.setFontSize(10);
        doc.setTextColor(...lightGray);
        doc.text('FROM', 20, yPos);
        doc.text('BILL TO', 110, yPos);
        
        yPos += 6;
        
        // From details
        doc.setFontSize(11);
        doc.setTextColor(...darkGray);
        doc.setFont(undefined, 'bold');
        doc.text(companyName || 'Your Name', 20, yPos);
        
        // Bill To details
        doc.text(clientName, 110, yPos);
        doc.setFont(undefined, 'normal');
        
        yPos += 6;
        
        // Company contact info (left)
        if (companyEmail) {
            doc.text(companyEmail, 20, yPos);
            yPos += 5;
        }
        
        let clientYPos = yPos - 6;
        
        // Client contact info (right)
        if (clientEmail) {
            doc.text(clientEmail, 110, clientYPos);
            clientYPos += 5;
        }
        if (clientPhone) {
            doc.text(clientPhone, 110, clientYPos);
            clientYPos += 5;
        }
        if (clientAddress) {
            const addressLines = doc.splitTextToSize(clientAddress, 80);
            doc.text(addressLines, 110, clientYPos);
            clientYPos += (addressLines.length * 5);
        }
        
        // Continue with company info
        if (companyPhone) {
            doc.text(companyPhone, 20, yPos);
            yPos += 5;
        }
        if (companyAddress) {
            const addressLines = doc.splitTextToSize(companyAddress, 80);
            doc.text(addressLines, 20, yPos);
            yPos += (addressLines.length * 5);
        }
        
        // Make sure we're past both columns
        yPos = Math.max(yPos, clientYPos);
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
        
        // Table header
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
        
        // Table rows
        doc.setFontSize(10);
        selectedDays.forEach((day, index) => {
            // Add new page if needed
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.text(day.dateFormatted, 25, yPos);
            doc.text(day.hours, 100, yPos);
            doc.text(`$${day.rate}`, 130, yPos);
            doc.text(`$${day.amount}`, 165, yPos);
            
            // Light separator line
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.1);
            doc.line(20, yPos + 2, 190, yPos + 2);
            
            yPos += 8;
        });
        
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
        
        // Generate PDF as buffer
        const pdfBuffer = doc.output('arraybuffer');

        return new Response(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=Invoice-${invoiceNumber}.pdf`,
            },
        });

    } catch (error) {
        console.error("Error generating invoice PDF:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});