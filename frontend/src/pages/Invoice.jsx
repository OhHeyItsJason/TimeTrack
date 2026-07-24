import React, { useState, useEffect } from "react";
import { appClient } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileText, Calendar, Save, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CalendarView from "../components/history/CalendarView";
import InvoicePreviewModal from "../components/invoice/InvoicePreviewModal";

export default function Invoice() {
  const [selectedDates, setSelectedDates] = useState(new Set());
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [invoiceFormat, setInvoiceFormat] = useState("single");
  const [invoiceNumberWarning, setInvoiceNumberWarning] = useState(false);

  const queryClient = useQueryClient();

  const { data: sessions = [] } = useQuery({
    queryKey: ['workSessions'],
    queryFn: () => appClient.entities.WorkSession.list('-date'),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => appClient.entities.Settings.list(),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => appClient.entities.Client.list('name'),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => appClient.entities.Invoice.list(),
  });

  const { data: invoiceCounters = [] } = useQuery({
    queryKey: ['invoiceCounters'],
    queryFn: () => appClient.entities.InvoiceCounter.list(),
  });

  const createClientMutation = useMutation({
    mutationFn: (data) => appClient.entities.Client.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (data) => appClient.entities.Invoice.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  const createCounterMutation = useMutation({
    mutationFn: (data) => appClient.entities.InvoiceCounter.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoiceCounters'] });
    },
  });

  const updateCounterMutation = useMutation({
    mutationFn: ({ id, data }) => appClient.entities.InvoiceCounter.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoiceCounters'] });
    },
  });

  const settingsData = settings[0] || {};
  const defaultHourlyRate = settingsData.hourly_rate || 50;
  const activeClients = clients.filter((client) => !client.is_archived);

  // Get the selected client's hourly rate, falling back to default
  const selectedClient = activeClients.find(c => c.id === selectedClientId);
  const hourlyRate = selectedClient?.hourly_rate ?? defaultHourlyRate;

  // Build client lookup by abbreviation
  const clientsByAbbreviation = clients.reduce((acc, client) => {
    if (client.abbreviation) {
      acc[client.abbreviation.toUpperCase()] = client;
    }
    return acc;
  }, {});

  // Compute statusByDateByClient from invoices
  const statusByDateByClient = {};
  invoices.forEach(invoice => {
    if (!invoice.is_submitted && !invoice.is_paid) return;
    
    const abbr = invoice.client_abbreviation?.toUpperCase();
    if (!abbr) return;
    
    const client = clientsByAbbreviation[abbr];
    if (!client) return;
    
    let selectedInvoiceDates = [];
    try {
      selectedInvoiceDates = JSON.parse(invoice.selected_dates || '[]');
    } catch {
      selectedInvoiceDates = [];
    }
    
    if (!statusByDateByClient[client.id]) {
      statusByDateByClient[client.id] = {};
    }
    
    selectedInvoiceDates.forEach(dateStr => {
      if (invoice.is_paid) {
        statusByDateByClient[client.id][dateStr] = 'paid';
      } else if (statusByDateByClient[client.id][dateStr] !== 'paid') {
        statusByDateByClient[client.id][dateStr] = 'invoiced';
      }
    });
  });

  // Compute work dates for selected client
  const workDatesForSelectedClient = new Set(
    sessions
      .filter(s => s.client_id === selectedClientId && s.duration_minutes > 0)
      .map(s => s.date)
  );

  // Build daysByDate only for selected client's work
  const daysByDate = sessions.reduce((acc, session) => {
    if (!session.duration_minutes || session.duration_minutes <= 0) return acc;
    if (selectedClientId && session.client_id !== selectedClientId) return acc;
    
    const date = session.date;
    if (!acc[date]) {
      acc[date] = {
        date: date,
        totalMinutes: 0,
      };
    }
    acc[date].totalMinutes += session.duration_minutes;
    return acc;
  }, {});

  // Build clientsById lookup for easy access
  const clientsById = clients.reduce((acc, client) => {
    acc[client.id] = client;
    return acc;
  }, {});

  // Build clientsByDate for CalendarView dots (only for selected client's work sessions)
  const clientsByDateForCalendar = sessions.reduce((acc, session) => {
    if (!session.duration_minutes || session.duration_minutes <= 0) return acc;
    if (selectedClientId && session.client_id !== selectedClientId) return acc;

    const date = session.date;
    if (!acc[date]) acc[date] = [];
    if (session.client_id) {
      const client = clientsById[session.client_id];
      if (client && !acc[date].some(c => c.id === client.id)) {
        acc[date].push({ id: client.id, color: client.color || '#06b6d4' });
      }
    }
    return acc;
  }, {});

  // Compute unassignedWorkByDate (for selected client filter)
  const unassignedWorkByDate = {};
  sessions.forEach(session => {
    if (!session.duration_minutes || session.duration_minutes <= 0) return;
    if (selectedClientId && session.client_id !== selectedClientId) return;
    if (!session.client_id) {
      unassignedWorkByDate[session.date] = true;
    }
  });

  // Compute fullyPaidByDate (for selected client filter)
  const fullyPaidByDate = {};
  Object.keys(daysByDate).forEach(date => {
    const daySessions = sessions.filter(s => 
      s.date === date && 
      s.duration_minutes > 0 &&
      (!selectedClientId || s.client_id === selectedClientId)
    );
    
    const clientIdsWithWork = [...new Set(
      daySessions
        .filter(s => s.client_id)
        .map(s => s.client_id)
    )];
    
    if (clientIdsWithWork.length === 0) {
      fullyPaidByDate[date] = false;
    } else {
      const allPaid = clientIdsWithWork.every(clientId => 
        statusByDateByClient[clientId]?.[date] === 'paid'
      );
      fullyPaidByDate[date] = allPaid;
    }
  });

  const workDays = Object.values(daysByDate).sort((a, b) => b.date.localeCompare(a.date));
  const workDayDates = Object.keys(daysByDate);

  // Generate invoice number when client is selected
  const generateInvoiceNumber = (clientId, abbreviation) => {
    if (!clientId || !abbreviation) {
      setInvoiceNumber("");
      return;
    }

    // Find existing counter for this client
    const counter = invoiceCounters.find(c => c.client_id === clientId);
    const lastUsed = counter?.last_number_used || 0;

    // Find highest invoice number for this client from existing invoices
    const clientInvoices = invoices.filter(inv => inv.client_abbreviation === abbreviation);
    let highestNumber = 0;
    
    clientInvoices.forEach(inv => {
      const match = inv.invoice_number?.match(/INV-[A-Za-z]+(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > highestNumber) highestNumber = num;
      }
    });

    // Determine next number
    let next;
    if (clientInvoices.length === 0) {
      next = 1;
    } else if (highestNumber >= lastUsed) {
      next = highestNumber + 1;
    } else {
      next = lastUsed + 1;
    }

    const newInvoiceNumber = `INV-${abbreviation}${String(next).padStart(2, '0')}`;
    setInvoiceNumber(newInvoiceNumber);
    validateInvoiceNumber(newInvoiceNumber, abbreviation);
  };

  const validateInvoiceNumber = (number, abbreviation) => {
    if (!abbreviation) {
      setInvoiceNumberWarning(false);
      return;
    }
    const pattern = new RegExp(`^INV-${abbreviation}\\d+$`, 'i');
    setInvoiceNumberWarning(!pattern.test(number));
  };

  const handleInvoiceNumberChange = (value) => {
    setInvoiceNumber(value);
    const client = activeClients.find(c => c.id === selectedClientId);
    validateInvoiceNumber(value, client?.abbreviation || "");
  };

  const handleClientSelect = (clientId) => {
    const client = activeClients.find((item) => item.id === clientId);
    if (clientId && !client) return;

    setSelectedClientId(clientId);
    setSelectedDates(new Set()); // Clear selected dates when client changes
    
    if (clientId) {
      setClientName(client.name || "");
      setClientEmail(client.email || "");
      setClientPhone(client.phone || "");
      setClientAddress(client.address || "");
      generateInvoiceNumber(clientId, client.abbreviation || "");
    } else {
      setClientName("");
      setClientEmail("");
      setClientPhone("");
      setClientAddress("");
      setInvoiceNumber("");
      setInvoiceNumberWarning(false);
    }
  };

  // Re-generate invoice number when invoices or counters change (for selected client)
  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find(c => c.id === selectedClientId && !c.is_archived);
      if (client?.abbreviation && !invoiceNumber) {
        generateInvoiceNumber(selectedClientId, client.abbreviation);
      }
    }
  }, [invoices, invoiceCounters, selectedClientId, clients]);

  const handleSaveClient = async () => {
    if (!clientName.trim()) {
      alert("Please enter a client name");
      return;
    }

    const existingClient = clients.find(c => 
      c.name === clientName && 
      c.email === clientEmail &&
      c.phone === clientPhone &&
      c.address === clientAddress
    );

    if (existingClient) {
      alert("This client already exists in your list.");
      handleClientSelect(existingClient.id);
      return;
    }

    try {
      const newClient = await createClientMutation.mutateAsync({
        name: clientName,
        email: clientEmail || '',
        phone: clientPhone || '',
        address: clientAddress || '',
      });
      
      if (newClient && newClient.id) {
        handleClientSelect(newClient.id);
        alert("Client saved successfully!");
      } else {
        await queryClient.invalidateQueries({ queryKey: ['clients'] });
        const updatedClients = queryClient.getQueryData(['clients']);
        const foundClient = updatedClients?.find(c => c.name === clientName && c.email === clientEmail);
        if (foundClient) {
          handleClientSelect(foundClient.id);
        }
        alert("Client saved successfully!");
      }
    } catch (error) {
      console.error("Error creating client:", error);
      alert("Failed to save client. Please try again.");
    }
  };

  const handleDayClick = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    if (!workDayDates.includes(dateStr)) return;
    
    const newSelected = new Set(selectedDates);
    if (newSelected.has(dateStr)) {
      newSelected.delete(dateStr);
    } else {
      newSelected.add(dateStr);
    }
    setSelectedDates(newSelected);
  };

  const toggleAll = () => {
    if (selectedDates.size === workDays.length) {
      setSelectedDates(new Set());
    } else {
      setSelectedDates(new Set(workDays.map(d => d.date)));
    }
  };

  const calculateTotals = () => {
    let totalMinutes = 0;
    workDays.forEach(day => {
      if (selectedDates.has(day.date)) {
        totalMinutes += day.totalMinutes || 0;
      }
    });
    const hours = (totalMinutes / 60).toFixed(2);
    const amount = (hours * hourlyRate).toFixed(2);
    return { hours, amount };
  };

  const { hours: totalHours, amount: totalAmount } = calculateTotals();

  const generateInvoice = async () => {
    if (selectedDates.size === 0 || !clientName) {
      alert("Please select at least one date and enter client name");
      return;
    }

    if (selectedClientId && !selectedClient) {
      alert("This client is archived and cannot be used for a new invoice.");
      return;
    }

    setIsGenerating(true);

    try {
      const client = selectedClient;
      const clientAbbreviation = client?.abbreviation || "";
      const generatedDate = new Date().toISOString();

      if (!selectedClientId && clientName.trim()) {
        const existingClient = clients.find(c => 
          c.name === clientName && 
          c.email === clientEmail &&
          c.phone === clientPhone &&
          c.address === clientAddress
        );

        if (!existingClient) {
          await createClientMutation.mutateAsync({
            name: clientName,
            email: clientEmail,
            phone: clientPhone,
            address: clientAddress,
          });
        }
      }

      // Update invoice counter for this client
      if (selectedClientId && clientAbbreviation) {
        const counter = invoiceCounters.find(c => c.client_id === selectedClientId);
        
        // Extract the number from the invoice number
        const match = invoiceNumber.match(/INV-[A-Za-z]+(\d+)/);
        const invoiceNum = match ? parseInt(match[1], 10) : 1;
        
        if (counter) {
          await updateCounterMutation.mutateAsync({
            id: counter.id,
            data: { last_number_used: invoiceNum }
          });
        } else {
          await createCounterMutation.mutateAsync({
            client_id: selectedClientId,
            last_number_used: invoiceNum
          });
        }
      }

      const selectedDays = workDays
        .filter(d => selectedDates.has(d.date))
        .sort((a, b) => a.date.localeCompare(b.date));
      
      const startDate = selectedDays[0].date;
      const endDate = selectedDays[selectedDays.length - 1].date;

      const parseLocalDate = (dateStr) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
      };

      const invoiceData = {
        invoiceNumber: invoiceNumber,
        invoiceDate: format(new Date(), 'MMMM d, yyyy'),
        generatedDate: generatedDate,
        clientName: clientName,
        clientEmail: clientEmail || '',
        clientPhone: clientPhone || '',
        clientAddress: clientAddress || '',
        clientAbbreviation: clientAbbreviation,
        companyName: settingsData.company_name || 'Your Name',
        companyEmail: settingsData.email || '',
        companyPhone: settingsData.phone || '',
        companyAddress: settingsData.address || '',
        startDate: format(parseLocalDate(startDate), 'MMMM d, yyyy'),
        endDate: format(parseLocalDate(endDate), 'MMMM d, yyyy'),
        invoiceFormat: invoiceFormat,
        selectedDays: invoiceFormat === "multiple" ? selectedDays.map(day => {
          const hours = (day.totalMinutes / 60).toFixed(2);
          const amount = (hours * hourlyRate).toFixed(2);
          return {
            dateFormatted: format(parseLocalDate(day.date), 'EEEE, MMMM d, yyyy'),
            hours: hours,
            rate: hourlyRate.toFixed(2),
            amount: amount,
          };
        }) : [],
        totalHours: totalHours,
        hourlyRate: hourlyRate.toFixed(2),
        totalAmount: totalAmount,
        notes: additionalNotes || settingsData.invoice_notes || '',
      };

      // Build line items for storage
      const lineItems = selectedDays.map(day => {
        const hours = (day.totalMinutes / 60).toFixed(2);
        const amount = (parseFloat(hours) * hourlyRate).toFixed(2);
        return {
          date: day.date,
          hours: hours,
          rate: hourlyRate.toFixed(2),
          amount: amount,
        };
      });

      await createInvoiceMutation.mutateAsync({
        invoice_number: invoiceNumber,
        client_name: clientName,
        client_email: clientEmail || '',
        client_phone: clientPhone || '',
        client_address: clientAddress || '',
        start_date: startDate,
        end_date: endDate,
        selected_dates: JSON.stringify(Array.from(selectedDates)),
        line_items: JSON.stringify(lineItems),
        invoice_format: invoiceFormat,
        total_hours: parseFloat(totalHours),
        hourly_rate: hourlyRate,
        total_amount: parseFloat(totalAmount),
        notes: additionalNotes || '',
        is_submitted: false,
        is_paid: false,
        generated_date: generatedDate,
        client_abbreviation: clientAbbreviation,
      });

      setPreviewData(invoiceData);
      setIsPreviewOpen(true);
      
      setSelectedDates(new Set());
      setAdditionalNotes('');
      
      // Regenerate next invoice number for client
      if (selectedClientId && clientAbbreviation) {
        setTimeout(() => {
          generateInvoiceNumber(selectedClientId, clientAbbreviation);
        }, 500);
      } else {
        setInvoiceNumber("");
      }
    } catch (error) {
      console.error('Error generating invoice:', error);
      alert('Error generating invoice. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

return (
    <div className="min-h-screen bg-[#f2f2f7] p-4 md:p-8 pb-24">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-4xl md:text-5xl font-semibold text-gray-900 mb-2">
            Generate Invoice
          </h1>
          <p className="text-gray-500 text-lg">Fill in client details, then select dates to include in your invoice</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
<Card className="shadow-lg border-0 bg-white/80 ios-blur rounded-[28px]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl text-gray-900">
                    <FileText className="w-5 h-5 text-blue-600" />
                    Invoice Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-gray-700 font-medium">Client</Label>
                    <Select value={selectedClientId} onValueChange={handleClientSelect}>
                      <SelectTrigger className="bg-white border-gray-200 text-gray-900 rounded-[14px]">
                        <SelectValue placeholder="Choose" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200 rounded-[16px]">
{activeClients.length === 0 ? (
                          <div className="p-2 text-sm text-gray-500 text-center">
                            No active clients
                          </div>
                        ) : (
                          activeClients.map((client) => (
                            <SelectItem key={client.id} value={client.id} className="text-gray-900 rounded-[12px]">
                              {client.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

<div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="clientName" className="text-gray-700 font-medium">Client Name *</Label>
                      <Input
                        id="clientName"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Company or Individual"
                        className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-[14px]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="clientEmail" className="text-gray-700 font-medium">Client Email</Label>
                      <Input
                        id="clientEmail"
                        type="email"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="client@example.com"
                        className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-[14px]"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="clientPhone" className="text-gray-700 font-medium">Client Phone</Label>
                      <Input
                        id="clientPhone"
                        type="tel"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="+1 (555) 123-4567"
                        className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-[14px]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="invoiceNumber" className="text-gray-700 font-medium">Invoice #</Label>
                      <Input
                        id="invoiceNumber"
                        value={invoiceNumber}
                        onChange={(e) => handleInvoiceNumberChange(e.target.value)}
                        placeholder={selectedClientId ? "Select a client first" : "INV-XXX00"}
                        className="bg-white border-gray-200 text-gray-900 rounded-[14px]"
                      />
                      {invoiceNumberWarning && (
                        <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                          <AlertTriangle className="w-3 h-3" />
                          This invoice number does not match the recommended pattern.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clientAddress" className="text-gray-700 font-medium">Client Address</Label>
                    <Textarea
                      id="clientAddress"
                      value={clientAddress}
                      onChange={(e) => setClientAddress(e.target.value)}
                      placeholder="123 Main St, City, State 12345"
                      rows={2}
                      className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-[14px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-gray-700 font-medium">Notes</Label>
                    <Textarea
                      id="notes"
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      placeholder="Additional notes..."
                      rows={3}
                      className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-[14px]"
                    />
                  </div>

                  <Button
                    onClick={handleSaveClient}
                    disabled={!clientName.trim() || createClientMutation.isPending}
                    variant="outline"
                    className="w-full border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-blue-600 rounded-[14px]"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {createClientMutation.isPending ? 'Saving...' : 'Save Client'}
                  </Button>
                </CardContent>
              </Card>
            </div>

<div>
              <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-[28px]">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4 text-lg">Invoice Total</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Days Selected</span>
                      <span className="font-semibold text-blue-600">{selectedDates.size}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total Hours</span>
                      <span className="font-semibold text-blue-600">{totalHours}h</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-600">Rate</span>
                        <span className="font-semibold text-blue-600">${hourlyRate}/hr</span>
                      </div>
                      {selectedClient?.hourly_rate != null && (
                        <p className="text-xs text-gray-500 text-right">Client rate</p>
                      )}
                    <div className="pt-3 border-t border-blue-200">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold text-gray-900">Total</span>
                        <span className="text-3xl font-bold text-green-600">
                          ${totalAmount}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={generateInvoice}
                    disabled={selectedDates.size === 0 || !clientName || isGenerating}
                    className="w-full mt-6 h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg rounded-[16px]"
                  >
                    {isGenerating ? (
                      'Generating...'
                    ) : (
                      <>
                        <FileText className="w-5 h-5 mr-2" />
                        Generate Invoice
                      </>
                    )}
                  </Button>

                  <div className="mt-4 space-y-2">
                    <Label className="text-gray-700 text-sm font-medium">Invoice Format</Label>
                    <RadioGroup value={invoiceFormat} onValueChange={setInvoiceFormat}>
                      <div className="flex items-center space-x-2 bg-white p-3 rounded-[14px] border border-gray-200">
                        <RadioGroupItem value="single" id="single" className="border-blue-600 text-blue-600" />
                        <Label htmlFor="single" className="text-gray-700 cursor-pointer flex-1 text-sm">
                          Single line item (date range)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 bg-white p-3 rounded-[14px] border border-gray-200">
                        <RadioGroupItem value="multiple" id="multiple" className="border-blue-600 text-blue-600" />
                        <Label htmlFor="multiple" className="text-gray-700 cursor-pointer flex-1 text-sm">
                          Multiple line items (one per day)
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
<Card className="shadow-lg border-0 bg-white/80 ios-blur rounded-[28px]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-xl text-gray-900">
                  <Calendar className="w-5 h-5 text-purple-600" />
                  Select Dates
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAll}
                  className="border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-purple-600 rounded-[14px]"
                >
                  {selectedDates.size === workDays.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Days with work are marked with a cyan dot. Selected days appear in green.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Note: This calendar only shows days where you logged work for the selected client.
              </p>
            </CardHeader>
            <CardContent>
              {workDays.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No work days recorded yet</p>
              ) : (
                <CalendarView
                  currentDate={currentDate}
                  onDateChange={setCurrentDate}
                  workDayDates={workDayDates}
                  onDayClick={handleDayClick}
                  selectedDates={selectedDates}
                  mode="select"
                  statusByDateByClient={statusByDateByClient}
                  selectedClientId={selectedClientId}
                  clientsByDate={clientsByDateForCalendar}
                  fullyPaidByDate={fullyPaidByDate}
                  unassignedWorkByDate={unassignedWorkByDate}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <InvoicePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        invoiceData={previewData}
      />
    </div>
  );
}
