import React, { useState, useEffect } from "react";
import { appClient } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Save, Settings as SettingsIcon, Users, Edit2, Archive, ArchiveRestore, Plus, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import ClientModal from "../components/invoice/ClientModal";

export default function Settings() {
  const queryClient = useQueryClient();

  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => appClient.entities.Settings.list(),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => appClient.entities.Client.list('name'),
  });

  const { data: allSessions = [] } = useQuery({
    queryKey: ['workSessions'],
    queryFn: () => appClient.entities.WorkSession.list(),
  });

  const existingSettings = settings[0] || {};

  const [hourlyRate, setHourlyRate] = useState(50);
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [clientToArchive, setClientToArchive] = useState(null);
  const [archiveBlocked, setArchiveBlocked] = useState(false);

  useEffect(() => {
    if (existingSettings.id) {
      setHourlyRate(existingSettings.hourly_rate || 50);
      setCompanyName(existingSettings.company_name || '');
      setEmail(existingSettings.email || '');
      setPhone(existingSettings.phone || '');
      setAddress(existingSettings.address || '');
      setInvoiceNotes(existingSettings.invoice_notes || '');
    }
  }, [existingSettings.id]);

  const createSettingsMutation = useMutation({
    mutationFn: (data) => appClient.entities.Settings.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      alert('Settings saved successfully!');
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: ({ id, data }) => appClient.entities.Settings.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      alert('Settings updated successfully!');
    },
  });

  const createClientMutation = useMutation({
    mutationFn: (data) => appClient.entities.Client.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: ({ id, data }) => appClient.entities.Client.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const archiveClientMutation = useMutation({
    mutationFn: ({ id, is_archived }) => appClient.entities.Client.update(id, { is_archived }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setIsArchiveConfirmOpen(false);
      setClientToArchive(null);
    },
  });

  const handleSave = async () => {
    const settingsData = {
      hourly_rate: parseFloat(hourlyRate) || 50,
      company_name: companyName,
      email: email,
      phone: phone,
      address: address,
      invoice_notes: invoiceNotes,
    };

    if (existingSettings.id) {
      await updateSettingsMutation.mutateAsync({
        id: existingSettings.id,
        data: settingsData,
      });
    } else {
      await createSettingsMutation.mutateAsync(settingsData);
    }
  };

  const handleSaveClient = async (clientData, clientId) => {
    if (clientId) {
      await updateClientMutation.mutateAsync({ id: clientId, data: clientData });
    } else {
      await createClientMutation.mutateAsync(clientData);
    }
    setIsClientModalOpen(false);
    setEditingClient(null);
  };

  const handleEditClient = (client) => {
    setEditingClient(client);
    setIsClientModalOpen(true);
  };

  const handleArchiveClick = (client) => {
    // Check if client has an active running session
    const hasActiveSession = allSessions.some(s => s.client_id === client.id && s.is_active);
    setArchiveBlocked(hasActiveSession);
    setClientToArchive(client);
    setIsArchiveConfirmOpen(true);
  };

  const handleConfirmArchive = async () => {
    if (clientToArchive && !archiveBlocked) {
      await archiveClientMutation.mutateAsync({ id: clientToArchive.id, is_archived: true });
    }
  };

  const handleUnarchive = async (client) => {
    await archiveClientMutation.mutateAsync({ id: client.id, is_archived: false });
  };

  const activeClients = clients.filter(c => !c.is_archived);
  const archivedClients = clients.filter(c => c.is_archived);

  const isSaving = createSettingsMutation.isPending || updateSettingsMutation.isPending;

return (
    <div className="min-h-screen bg-[#f2f2f7] p-4 md:p-8 pb-24">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-semibold text-gray-900 mb-2">
            Settings
          </h1>
          <p className="text-gray-500 text-lg">Configure your billing defaults, invoice details, and client records.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] xl:items-start"
        >
<Card className="shadow-lg border-0 bg-white/80 ios-blur rounded-[28px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-gray-900">
                <SettingsIcon className="w-5 h-5 text-blue-600" />
                Billing & Invoice Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
                <div className="space-y-2 rounded-[20px] border border-blue-100 bg-blue-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
                    Default Rate
                  </p>
                  <Label htmlFor="hourlyRate" className="text-gray-700 font-semibold">
                    Hourly Rate ($/hr)
                  </Label>
                  <Input
                    id="hourlyRate"
                    type="number"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    placeholder="50"
                    className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 text-lg font-semibold rounded-[14px]"
                  />
                  <p className="text-xs text-gray-500">Used when a client doesn&apos;t have a specific rate set.</p>
                </div>

                <div className="rounded-[20px] border border-gray-100 bg-white/70 p-4 md:p-5">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Invoice Information</h3>
                    <p className="mt-1 text-sm text-gray-500">Shown by default on generated invoices.</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="companyName" className="text-gray-700 font-medium">
                        Your Name / Company Name
                      </Label>
                      <Input
                        id="companyName"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Your Name"
                        className="h-12 bg-white border-gray-200 text-base text-gray-900 placeholder:text-gray-400 rounded-[14px]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-gray-700 font-medium">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="h-12 bg-white border-gray-200 text-base text-gray-900 placeholder:text-gray-400 rounded-[14px]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-gray-700 font-medium">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 123-4567"
                        className="h-12 bg-white border-gray-200 text-base text-gray-900 placeholder:text-gray-400 rounded-[14px]"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="address" className="text-gray-700 font-medium">Address</Label>
                      <Textarea
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="123 Main St, City, State 12345"
                        rows={5}
                        className="min-h-32 resize-y bg-white border-gray-200 text-base text-gray-900 placeholder:text-gray-400 rounded-[14px]"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="invoiceNotes" className="text-gray-700 font-medium">
                        Default Invoice Notes
                      </Label>
                      <Textarea
                        id="invoiceNotes"
                        value={invoiceNotes}
                        onChange={(e) => setInvoiceNotes(e.target.value)}
                        placeholder="Payment terms, thank you message, etc."
                        rows={6}
                        className="min-h-40 resize-y bg-white border-gray-200 text-base text-gray-900 placeholder:text-gray-400 rounded-[14px]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg rounded-[16px]"
              >
                <Save className="w-5 h-5 mr-2" />
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>

<Card className="shadow-lg border-0 bg-white/80 ios-blur rounded-[28px] xl:sticky xl:top-6">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl text-gray-900">
                    <Users className="w-5 h-5 text-purple-600" />
                    Client Management
                  </CardTitle>
                  <p className="mt-1 text-sm text-gray-500">Manage active and archived client records.</p>
                </div>
                <Button
                  onClick={() => {
                    setEditingClient(null);
                    setIsClientModalOpen(true);
                  }}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-[14px]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Client
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {activeClients.length === 0 && archivedClients.length === 0 ? (
                <div className="py-8 text-center">
                  <Users className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                  <p className="text-gray-600">No clients yet</p>
                  <p className="text-sm text-gray-500">Add your first client to get started</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {activeClients.length > 0 && (
                    <div className="space-y-3">
                      {activeClients.map((client) => (
<div
                          key={client.id}
                          className="rounded-[16px] border border-gray-100 bg-gray-50 p-4 transition-all hover:border-purple-200"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                {client.color && (
                                  <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: client.color }} />
                                )}
                                <h4 className="truncate font-semibold text-gray-900">{client.name}</h4>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                                {client.abbreviation && (
                                  <span className="font-semibold uppercase text-purple-600">{client.abbreviation}</span>
                                )}
                                {client.email && <span>{client.email}</span>}
                                {client.phone && <span>{client.phone}</span>}
                                {client.hourly_rate != null && (
                                  <span className="font-semibold text-blue-600">${client.hourly_rate}/hr</span>
                                )}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditClient(client)}
                                className="border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-blue-600 rounded-[14px]"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleArchiveClick(client)}
                                className="border-gray-200 text-orange-600 hover:bg-orange-50 rounded-[14px]"
                              >
                                <Archive className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {archivedClients.length > 0 && (
                    <div>
                      <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Archived</h4>
                      <div className="space-y-3">
                        {archivedClients.map((client) => (
<div
                            key={client.id}
                            className="rounded-[16px] border border-gray-200 bg-gray-100 p-4 opacity-60"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  {client.color && (
                                    <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: client.color }} />
                                  )}
                                  <h4 className="truncate font-semibold text-gray-500">{client.name}</h4>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                                  {client.abbreviation && (
                                    <span className="font-semibold uppercase text-purple-400">{client.abbreviation}</span>
                                  )}
                                  {client.email && <span>{client.email}</span>}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUnarchive(client)}
                                  className="border-gray-200 text-green-600 hover:bg-green-50 rounded-[14px]"
                                >
                                  <ArchiveRestore className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => {
          setIsClientModalOpen(false);
          setEditingClient(null);
        }}
        onSave={handleSaveClient}
        client={editingClient}
      />

<Dialog open={isArchiveConfirmOpen} onOpenChange={setIsArchiveConfirmOpen}>
        <DialogContent className="bg-white border-0 rounded-[24px] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              {archiveBlocked ? <AlertTriangle className="w-5 h-5" /> : <Archive className="w-5 h-5" />}
              {archiveBlocked ? 'Cannot Archive Client' : 'Archive Client?'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            {archiveBlocked ? (
              <>
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">{clientToArchive?.name}</span> has an active running session.
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Stop the session before archiving this client.
                </p>
              </>
            ) : (
              <>
                <p className="text-gray-700">
                  Archive{' '}
                  <span className="font-semibold text-gray-900">{clientToArchive?.name}</span>?
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Archived clients won't appear in dropdowns. You can unarchive anytime.
                </p>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsArchiveConfirmOpen(false)}
              className="border-gray-200 text-gray-700 hover:bg-gray-100 rounded-[14px]"
            >
              {archiveBlocked ? 'OK' : 'Cancel'}
            </Button>
            {!archiveBlocked && (
              <Button
                onClick={handleConfirmArchive}
                disabled={archiveClientMutation.isPending}
                className="bg-orange-600 hover:bg-orange-700 rounded-[14px]"
              >
                {archiveClientMutation.isPending ? 'Archiving...' : 'Archive'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
