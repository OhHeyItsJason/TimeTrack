import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
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
import { Play, Square, Clock, CheckCircle, List, Plus, Users, Edit2 } from "lucide-react";

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

  const { data: allSessions = [] } = useQuery({
    queryKey: ['workSessions'],
    queryFn: () => base44.entities.WorkSession.list('-start_time'),
    refetchInterval: 3000,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('name'),
  });

  const todaySessions = allSessions.filter(s => s.date === today);
  const activeSession = todaySessions.find(s => s.is_active);
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
    mutationFn: (sessionData) => base44.entities.WorkSession.create(sessionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workSessions'] });
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WorkSession.update(id, data),
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
    await createSessionMutation.mutateAsync({
      date: today,
      start_time: now.toISOString(),
      duration_minutes: 0,
      is_active: true,
      client_id: selectedClientId,
    });
  };

  const handleSaveClient = async (clientData, clientId) => {
    if (clientId) {
      await base44.entities.Client.update(clientId, clientData);
    } else {
      const newClient = await base44.entities.Client.create(clientData);
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

  const handleSaveStartTime = async () => {
    if (!activeSession || !newStartTime) return;
    
    const [hours, minutes] = newStartTime.split(':').map(Number);
    const startDate = new Date(activeSession.start_time);
    startDate.setHours(hours, minutes, 0, 0);
    
    await updateSessionMutation.mutateAsync({
      id: activeSession.id,
      data: {
        start_time: startDate.toISOString(),
      },
    });
    
    setEditingStartTime(false);
  };

  // Get active session's client name
  const activeClient = activeSession?.client_id 
    ? clients.find(c => c.id === activeSession.client_id) 
    : null;

const handleStop = async () => {
    if (!activeSession) return;
    
    const now = new Date();
    const startTime = new Date(activeSession.start_time);
    const sessionMinutes = (now - startTime) / 1000 / 60;
    
    await updateSessionMutation.mutateAsync({
      id: activeSession.id,
      data: {
        is_active: false,
        end_time: now.toISOString(),
        duration_minutes: Math.round(sessionMinutes * 100) / 100,
      },
    });
  };

  const isLoading = createSessionMutation.isPending || updateSessionMutation.isPending;

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
                      onClick={handleStop}
                      disabled={isLoading}
                      variant="outline"
                      className="w-full h-16 border-2 border-orange-300 text-orange-600 hover:bg-orange-50 text-lg font-semibold rounded-[16px] bg-white"
                    >
                      <Square className="w-5 h-5 mr-2" />
                      Stop Session
                    </Button>
                    <Button
                      onClick={handleStop}
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
<Card className="shadow-lg border-0 bg-white/80 ios-blur rounded-[28px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Clock className="w-5 h-5 text-blue-600" />
                Today's Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-[20px] p-8 text-center border border-blue-100 shadow-sm">
                <p className="text-sm text-blue-600 font-semibold mb-2 uppercase tracking-wide">Hours Worked</p>
                <p className="text-7xl font-bold text-blue-600">
                  {totalHours}
                </p>
                {completedSessions.length > 0 && (
                  <p className="text-sm text-blue-600 mt-3 font-medium">
                    {completedSessions.length} session{completedSessions.length !== 1 ? 's' : ''}
                  </p>
                )}
                {clientTotalsArray.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    {clientTotalsArray.map((ct) => (
                      <span
                        key={ct.clientId}
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium text-white shadow-sm"
                        style={{ backgroundColor: ct.color }}
                      >
                        {ct.name} • {ct.hours}h
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              {totalHours !== "0.00" && (
                <div className="mt-4 text-center text-sm text-gray-500">
                  <p>Keep up the great work! 💪</p>
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
                          </div>
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
      </div>
  );
}