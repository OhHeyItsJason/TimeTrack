import React, { useState } from "react";
import { appClient } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { Play, Square, Clock, CheckCircle, List, Plus, Users, Edit2, Trash2 } from "lucide-react";

import { format } from "date-fns";
import { motion } from "framer-motion";
import ClientModal from "../components/invoice/ClientModal";

export default function Timer() {
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

const [selectedClientId, setSelectedClientId] = useState("");
  const [showNoClientDialog, setShowNoClientDialog] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingStartTime, setEditingStartTime] = useState(false);
  const [newStartTime, setNewStartTime] = useState("");
  const [editingCompletedSession, setEditingCompletedSession] = useState(null);
  const [editingCompletedStartTime, setEditingCompletedStartTime] = useState("");
  const [editingCompletedEndTime, setEditingCompletedEndTime] = useState("");
  const [editingCompletedClientId, setEditingCompletedClientId] = useState("");
  const [editingCompletedMilesDriven, setEditingCompletedMilesDriven] = useState("");
  const [editingCompletedRoundTrip, setEditingCompletedRoundTrip] = useState(false);
  const [editingCompletedMileageNotes, setEditingCompletedMileageNotes] = useState("");
  const [endingAction, setEndingAction] = useState(null);
  const [sessionPendingDelete, setSessionPendingDelete] = useState(null);

  const { data: allSessions = [] } = useQuery({
    queryKey: ['workSessions'],
    queryFn: () => appClient.entities.WorkSession.list('-start_time'),
    refetchInterval: 3000,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => appClient.entities.Client.list('name'),
  });

  const todaySessions = allSessions.filter(s => s.date === today);
  const activeSession = allSessions.find(s => s.is_active);
  const isActive = !!activeSession;
  
  const totalMinutes = todaySessions.reduce((sum, session) => {
    return sum + (session.duration_minutes || 0);
  }, 0);
  const totalHours = (totalMinutes / 60).toFixed(2);

  // Group today's sessions by client
  const clientTotals = todaySessions.reduce((acc, session) => {
    if (!session.client_id || !session.duration_minutes) return acc;
    if (!acc[session.client_id]) {
      acc[session.client_id] = 0;
    }
    acc[session.client_id] += session.duration_minutes;
    return acc;
  }, {});

  const clientTotalsArray = Object.entries(clientTotals)
    .filter(([_, minutes]) => minutes > 0)
    .map(([clientId, minutes]) => {
      const client = clients.find(c => c.id === clientId);
      return {
        clientId,
        name: client?.name || "Unknown",
        color: client?.color || "#6366f1",
        hours: (minutes / 60).toFixed(2),
      };
    });

  const createSessionMutation = useMutation({
    mutationFn: (sessionData) => appClient.entities.WorkSession.create(sessionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workSessions'] });
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: ({ id, data }) => appClient.entities.WorkSession.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workSessions'] });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (id) => appClient.entities.WorkSession.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workSessions'] });
    },
  });

  const handleStart = async () => {
    if (!selectedClientId) {
      setShowNoClientDialog(true);
      return;
    }
    const now = new Date();
    try {
      await createSessionMutation.mutateAsync({
        date: today,
        start_time: now.toISOString(),
        duration_minutes: 0,
        is_active: true,
        client_id: selectedClientId,
      });
    } catch (error) {
      toast({
        title: "Unable to start timer",
        description: error?.message || "The timer could not be started.",
        variant: "destructive",
      });
    }
  };

  const handleSaveClient = async (clientData, clientId) => {
    if (clientId) {
      await appClient.entities.Client.update(clientId, clientData);
    } else {
      const newClient = await appClient.entities.Client.create(clientData);
      if (newClient?.id) {
        setSelectedClientId(newClient.id);
      }
    }
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    setIsClientModalOpen(false);
  };

  const handleEditStartTime = () => {
    if (activeSession) {
      const startTime = new Date(activeSession.start_time);
      const timeString = format(startTime, 'HH:mm');
      setNewStartTime(timeString);
      setEditingStartTime(true);
    }
  };

  const calculateSessionMinutes = (startTime, endTime) => {
    if (!startTime || !endTime) return 0;

    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const startTotal = startHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;

    let totalMinutes = endTotal - startTotal;
    if (totalMinutes < 0) {
      totalMinutes += 24 * 60;
    }

    return totalMinutes;
  };

  const handleEditCompletedSession = (session) => {
    setEndingAction(null);
    setEditingCompletedSession(session);
    setEditingCompletedStartTime(format(new Date(session.start_time), 'HH:mm'));
    setEditingCompletedEndTime(format(new Date(session.end_time), 'HH:mm'));
    setEditingCompletedClientId(session.client_id || "");
    setEditingCompletedMilesDriven(
      session.session_miles_driven != null ? String(session.session_miles_driven) : ""
    );
    setEditingCompletedRoundTrip(Boolean(session.session_round_trip));
    setEditingCompletedMileageNotes(session.session_mileage_notes || "");
  };

  const resetSessionEditor = () => {
    setEditingCompletedSession(null);
    setEditingCompletedStartTime("");
    setEditingCompletedEndTime("");
    setEditingCompletedClientId("");
    setEditingCompletedMilesDriven("");
    setEditingCompletedRoundTrip(false);
    setEditingCompletedMileageNotes("");
    setEndingAction(null);
  };

  const handleOpenEndSession = (action) => {
    if (!activeSession) return;

    setEndingAction(action);
    setEditingCompletedSession(activeSession);
    setEditingCompletedStartTime(format(new Date(activeSession.start_time), 'HH:mm'));
    setEditingCompletedEndTime(format(new Date(), 'HH:mm'));
    setEditingCompletedClientId(activeSession.client_id || "");
    setEditingCompletedMilesDriven(
      activeSession.session_miles_driven != null ? String(activeSession.session_miles_driven) : ""
    );
    setEditingCompletedRoundTrip(Boolean(activeSession.session_round_trip));
    setEditingCompletedMileageNotes(activeSession.session_mileage_notes || "");
  };

  const handleSaveCompletedSession = async () => {
    if (!editingCompletedSession || !editingCompletedStartTime || !editingCompletedEndTime) {
      return;
    }

    const sessionDate = editingCompletedSession.date || format(new Date(editingCompletedSession.start_time), 'yyyy-MM-dd');
    const startDate = new Date(`${sessionDate}T${editingCompletedStartTime}:00`);
    const endDate = new Date(`${sessionDate}T${editingCompletedEndTime}:00`);
    const durationMinutes = calculateSessionMinutes(editingCompletedStartTime, editingCompletedEndTime);

    if (endDate < startDate) {
      endDate.setDate(endDate.getDate() + 1);
    }

    try {
      const sessionUpdate = {
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        duration_minutes: durationMinutes,
        client_id: editingCompletedClientId || null,
        session_miles_driven: parseFloat(editingCompletedMilesDriven) || 0,
        session_round_trip: editingCompletedRoundTrip,
        session_mileage_notes: editingCompletedMileageNotes.trim() || null,
      };

      if (endingAction) {
        sessionUpdate.is_active = false;
      }

      await updateSessionMutation.mutateAsync({
        id: editingCompletedSession.id,
        data: sessionUpdate,
      });
      resetSessionEditor();
    } catch (error) {
      toast({
        title: "Unable to update session",
        description: error?.message || "The completed session could not be updated.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCompletedSession = async () => {
    if (!sessionPendingDelete) return;

    try {
      await deleteSessionMutation.mutateAsync(sessionPendingDelete.id);
      setSessionPendingDelete(null);
      if (editingCompletedSession?.id === sessionPendingDelete.id) {
        setEditingCompletedSession(null);
      }
    } catch (error) {
      toast({
        title: "Unable to delete session",
        description: error?.message || "The completed session could not be deleted.",
        variant: "destructive",
      });
    }
  };

  const handleSaveStartTime = async () => {
    if (!activeSession || !newStartTime) return;
    
    const [hours, minutes] = newStartTime.split(':').map(Number);
    const startDate = new Date(activeSession.start_time);
    startDate.setHours(hours, minutes, 0, 0);
    
    try {
      await updateSessionMutation.mutateAsync({
        id: activeSession.id,
        data: {
          start_time: startDate.toISOString(),
        },
      });
      setEditingStartTime(false);
    } catch (error) {
      toast({
        title: "Unable to update start time",
        description: error?.message || "The session start time could not be updated.",
        variant: "destructive",
      });
    }
  };

  // Get active session's client name
  const activeClient = activeSession?.client_id 
    ? clients.find(c => c.id === activeSession.client_id) 
    : null;

  const isLoading =
    createSessionMutation.isPending ||
    updateSessionMutation.isPending ||
    deleteSessionMutation.isPending;

  const completedSessions = todaySessions
    .filter(s => {
      if (s.is_active || !s.end_time || s.duration_minutes <= 0) return false;
      const endDate = new Date(s.end_time);
      return !isNaN(endDate.getTime());
    })
    .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

return (
    <div className="min-h-screen bg-[#f2f2f7] p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-4xl md:text-5xl font-semibold text-gray-900 mb-2">
            Timer
          </h1>
          <p className="text-gray-500 text-lg">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
<Card className="mb-4 border-0 bg-white/78 shadow-md ios-blur rounded-[24px]">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-600">
                    Today's Total
                  </p>
                  <div className="mt-1 flex items-end gap-2">
                    <p className="text-4xl md:text-5xl font-bold leading-none text-gray-900">
                      {totalHours}
                    </p>
                    <p className="pb-1 text-sm font-medium text-gray-500">
                      hours
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    {completedSessions.length} recorded session{completedSessions.length !== 1 ? 's' : ''}
                    {isActive ? ' plus an active timer' : ''}
                  </p>
                </div>

                {clientTotalsArray.length > 0 && (
                  <div className="flex max-w-[52%] flex-wrap justify-end gap-2">
                    {clientTotalsArray.map((ct) => (
                      <span
                        key={ct.clientId}
                        className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                        style={{ backgroundColor: ct.color }}
                      >
                        {ct.name} • {ct.hours}h
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
<Card className="mb-6 shadow-lg border-0 overflow-hidden bg-white/80 ios-blur rounded-[28px]">
            <div className={`p-8 md:p-12 transition-colors duration-500 ${
              isActive 
                ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-b border-green-100' 
                : 'bg-white border-b border-gray-100'
            }`}>
              <div className="text-center">
                <motion.div
                  key={isActive ? 'working' : 'stopped'}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mb-6"
                >
{isActive ? (
                    <div className="inline-flex items-center gap-3 px-6 py-3 bg-green-100 rounded-[18px] border border-green-200 shadow-sm">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-md" />
                      <span className="text-green-600 text-lg font-semibold">WORKING</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-3 px-6 py-3 bg-gray-100 rounded-[18px] border border-gray-200">
                      <Square className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600 text-lg font-semibold">NOT TRACKING</span>
                    </div>
                  )}
                </motion.div>
                
{isActive && activeSession && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-gray-700 text-lg">
                        Session started at {format(new Date(activeSession.start_time), 'h:mm a')}
                      </p>
                      <button
                        onClick={handleEditStartTime}
                        className="p-2 hover:bg-green-200 rounded-[12px] transition-colors"
                        title="Edit start time"
                      >
                        <Edit2 className="w-4 h-4 text-green-600" />
                      </button>
                    </div>
                    {activeClient && (
                      <p className="text-blue-600 font-medium">
                        Working for: {activeClient.name}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

<CardContent className="p-6 bg-white/50">
              {!isActive ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-gray-600 font-medium flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Select Client
                    </label>
                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                      <SelectTrigger className="bg-white border-gray-200 text-gray-900 h-14 rounded-[14px]">
                        <SelectValue placeholder="Choose a client..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200 rounded-[16px]">
                        {clients.filter(c => !c.is_archived).map((client) => (
                          <SelectItem key={client.id} value={client.id} className="text-gray-900 rounded-[12px]">
                            {client.name}
                          </SelectItem>
                        ))}
                        <div
                          className="flex items-center gap-2 px-2 py-2 text-blue-600 cursor-pointer hover:bg-gray-100 rounded-[12px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsClientModalOpen(true);
                          }}
                        >
                          <Plus className="w-4 h-4" />
                          Add New Client
                        </div>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleStart}
                    disabled={isLoading}
                    className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold shadow-lg rounded-[16px] border-0"
                  >
                    <Play className="w-6 h-6 mr-2" />
                    {completedSessions.length === 0 ? "Start Work" : "Start New Session"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                    <Button
                      onClick={() => handleOpenEndSession('End Session')}
                      disabled={isLoading}
                      variant="outline"
                      className="w-full h-16 border-2 border-orange-300 text-orange-600 hover:bg-orange-50 text-lg font-semibold rounded-[16px] bg-white"
                    >
                      <Square className="w-5 h-5 mr-2" />
                      Stop Session
                    </Button>
                    <Button
                      onClick={() => handleOpenEndSession('End Day')}
                      disabled={isLoading}
                      className="w-full h-16 bg-gray-800 hover:bg-gray-900 text-white text-lg font-semibold shadow-lg rounded-[16px]"
                    >
                      <CheckCircle className="w-5 h-5 mr-2" />
                      End Day
                    </Button>
                  </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {completedSessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6"
          >
<Card className="shadow-lg border-0 bg-white/80 ios-blur rounded-[28px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
                  <List className="w-5 h-5 text-purple-600" />
                  Today's Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {completedSessions.map((session, index) => {
                    const hours = (session.duration_minutes / 60).toFixed(2);
                    const startDate = new Date(session.start_time);
                    const endDate = new Date(session.end_time);
                    const sessionClient = session.client_id
                      ? clients.find((client) => client.id === session.client_id)
                      : null;
                    const totalSessionMiles = (session.session_miles_driven || 0) * (session.session_round_trip ? 2 : 1);
                    
                    return (
                      <div 
                        key={session.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-[16px] border border-gray-100 hover:border-purple-200 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-blue-100 rounded-[14px] flex items-center justify-center border border-purple-200">
                            <span className="text-purple-600 font-semibold text-sm">{completedSessions.length - index}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}
                            </p>
                            <p className="text-sm text-gray-500">{hours}h</p>
                            {sessionClient && (
                              <p className="text-sm text-gray-500">{sessionClient.name}</p>
                            )}
                            {totalSessionMiles > 0 && (
                              <p className="text-sm text-amber-600">
                                {totalSessionMiles.toFixed(1)} miles{session.session_round_trip ? " round trip" : ""}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditCompletedSession(session)}
                            className="h-10 w-10 rounded-[14px] text-purple-600 hover:bg-purple-50 hover:text-purple-700"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSessionPendingDelete(session)}
                            className="h-10 w-10 rounded-[14px] text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
<Dialog open={showNoClientDialog} onOpenChange={setShowNoClientDialog}>
        <DialogContent className="bg-white border-0 rounded-[24px] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Select a Client</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">Please select a client before starting work.</p>
          <DialogFooter>
            <Button
              onClick={() => setShowNoClientDialog(false)}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-[14px]"
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

<ClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onSave={handleSaveClient}
        client={null}
      />

      <Dialog open={editingStartTime} onOpenChange={setEditingStartTime}>
        <DialogContent className="bg-white border-0 rounded-[24px] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Edit Start Time</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="startTime" className="text-gray-700">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                className="bg-white border-gray-200 text-gray-900 rounded-[14px] h-12"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingStartTime(false)}
              className="border-gray-200 text-gray-700 hover:bg-gray-100 rounded-[14px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveStartTime}
              disabled={!newStartTime}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-[14px]"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingCompletedSession}
        onOpenChange={(open) => {
          if (!open) {
            resetSessionEditor();
          }
        }}
      >
        <DialogContent className="bg-white border-0 rounded-[24px] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">{endingAction || 'Edit Session'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="completedSessionClient" className="text-gray-700">Client</Label>
              <Select value={editingCompletedClientId} onValueChange={setEditingCompletedClientId}>
                <SelectTrigger id="completedSessionClient" className="bg-white border-gray-200 text-gray-900 h-12 rounded-[14px]">
                  <SelectValue placeholder="No client" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 rounded-[16px]">
                  {clients.filter(c => !c.is_archived).map((client) => (
                    <SelectItem key={client.id} value={client.id} className="text-gray-900 rounded-[12px]">
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="completedStartTime" className="text-gray-700">Start Time</Label>
                <Input
                  id="completedStartTime"
                  type="time"
                  value={editingCompletedStartTime}
                  onChange={(e) => setEditingCompletedStartTime(e.target.value)}
                  className="bg-white border-gray-200 text-gray-900 rounded-[14px] h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="completedEndTime" className="text-gray-700">End Time</Label>
                <Input
                  id="completedEndTime"
                  type="time"
                  value={editingCompletedEndTime}
                  onChange={(e) => setEditingCompletedEndTime(e.target.value)}
                  className="bg-white border-gray-200 text-gray-900 rounded-[14px] h-12"
                />
              </div>
            </div>
            <div className="rounded-[18px] border border-amber-200 bg-amber-50/60 p-4 space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-700">Mileage</p>
                <p className="text-xs text-amber-700/80">Optional mileage for this session only.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="completedSessionMiles" className="text-gray-700">Miles Driven</Label>
                <Input
                  id="completedSessionMiles"
                  type="number"
                  min="0"
                  step="0.1"
                  value={editingCompletedMilesDriven}
                  onChange={(e) => setEditingCompletedMilesDriven(e.target.value)}
                  className="bg-white border-gray-200 text-gray-900 rounded-[14px] h-12"
                  placeholder="0.0"
                />
              </div>
              <div className="flex items-center justify-between rounded-[14px] bg-white px-4 py-3 border border-amber-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">Round trip</p>
                  <p className="text-xs text-gray-500">Double the entered miles for this session.</p>
                </div>
                <Switch
                  checked={editingCompletedRoundTrip}
                  onCheckedChange={setEditingCompletedRoundTrip}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="completedSessionMileageNotes" className="text-gray-700">Mileage Notes</Label>
                <Textarea
                  id="completedSessionMileageNotes"
                  value={editingCompletedMileageNotes}
                  onChange={(e) => setEditingCompletedMileageNotes(e.target.value)}
                  className="bg-white border-gray-200 text-gray-900 rounded-[14px] min-h-24"
                  placeholder="Optional notes about this trip"
                />
              </div>
              <p className="text-sm text-amber-700">
                Session mileage total: {((parseFloat(editingCompletedMilesDriven) || 0) * (editingCompletedRoundTrip ? 2 : 1)).toFixed(1)} miles
              </p>
            </div>
            {editingCompletedStartTime && editingCompletedEndTime && (
              <p className="text-sm text-gray-500">
                Duration: {(calculateSessionMinutes(editingCompletedStartTime, editingCompletedEndTime) / 60).toFixed(2)}h
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={resetSessionEditor}
              className="border-gray-200 text-gray-700 hover:bg-gray-100 rounded-[14px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCompletedSession}
              disabled={!editingCompletedStartTime || !editingCompletedEndTime || isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-[14px]"
            >
              {endingAction || 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!sessionPendingDelete}
        onOpenChange={(open) => {
          if (!open) {
            setSessionPendingDelete(null);
          }
        }}
      >
        <DialogContent className="bg-white border-0 rounded-[24px] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Delete Session?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-gray-600">
              Are you sure you want to delete this session? This action cannot be undone.
            </p>
            {sessionPendingDelete && (
              <div className="rounded-[16px] border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                {format(new Date(sessionPendingDelete.start_time), 'h:mm a')} - {format(new Date(sessionPendingDelete.end_time), 'h:mm a')}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSessionPendingDelete(null)}
              className="border-gray-200 text-gray-700 hover:bg-gray-100 rounded-[14px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteCompletedSession}
              disabled={deleteSessionMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white rounded-[14px]"
            >
              Delete Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
  );
}
