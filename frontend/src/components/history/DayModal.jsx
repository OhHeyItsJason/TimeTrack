import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar, Clock, Edit2, Save, X, Plus, Trash2, Coffee, Users, Car } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

export default function DayModal({ date, sessions = [], onSave, onClose, isOpen, clients = [], onUpdateSessionClient, onUpdateSessionMileage }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingMileage, setIsEditingMileage] = useState(false);
  const [editingSessions, setEditingSessions] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dailyMilesDriven, setDailyMilesDriven] = useState("");
  const [dailyRoundTrip, setDailyRoundTrip] = useState(false);
  const [dailyMileageNotes, setDailyMileageNotes] = useState("");
  const [dayMileageId, setDayMileageId] = useState(null);
  const [isDailyMileageDirty, setIsDailyMileageDirty] = useState(false);

  const queryClient = useQueryClient();
  const dateStr = date ? format(date, 'yyyy-MM-dd') : null;

  const { data: dayMileageRecords = [] } = useQuery({
    queryKey: ['dayMileage', dateStr],
    queryFn: () => base44.entities.DayMileage.filter({ date: dateStr }),
    enabled: !!dateStr && isOpen,
  });

  const createDayMileageMutation = useMutation({
    mutationFn: (data) => base44.entities.DayMileage.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dayMileage'] }),
  });

  const updateDayMileageMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DayMileage.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dayMileage'] }),
  });

  useEffect(() => {
    if (dayMileageRecords.length > 0) {
      const record = dayMileageRecords[0];
      setDayMileageId(record.id);
      setDailyMilesDriven(record.daily_miles_driven || "");
      setDailyRoundTrip(record.daily_round_trip || false);
      setDailyMileageNotes(record.daily_mileage_notes || "");
    } else {
      setDayMileageId(null);
      setDailyMilesDriven("");
      setDailyRoundTrip(false);
      setDailyMileageNotes("");
    }
    setIsDailyMileageDirty(false);
  }, [dayMileageRecords, isOpen]);

const handleSaveDailyMileage = async () => {
    if (!dateStr) return;
    const data = {
      date: dateStr,
      daily_miles_driven: parseFloat(dailyMilesDriven) || 0,
      daily_round_trip: dailyRoundTrip,
      daily_mileage_notes: dailyMileageNotes,
    };
    if (dayMileageId) {
      await updateDayMileageMutation.mutateAsync({ id: dayMileageId, data });
    } else {
      await createDayMileageMutation.mutateAsync(data);
    }
    setIsDailyMileageDirty(false);
    setIsEditingMileage(false);
  };

  const handleCancelMileageEdit = () => {
    if (dayMileageRecords.length > 0) {
      const record = dayMileageRecords[0];
      setDailyMilesDriven(record.daily_miles_driven || "");
      setDailyRoundTrip(record.daily_round_trip || false);
      setDailyMileageNotes(record.daily_mileage_notes || "");
    } else {
      setDailyMilesDriven("");
      setDailyRoundTrip(false);
      setDailyMileageNotes("");
    }
    setIsDailyMileageDirty(false);
    setIsEditingMileage(false);
  };

  const extractTime = (isoString, defaultTime) => {
    if (!isoString) return defaultTime;
    try {
      const parsedDate = new Date(isoString);
      if (isNaN(parsedDate.getTime())) return defaultTime;
      return format(parsedDate, 'HH:mm');
    } catch {
      return defaultTime;
    }
  };

useEffect(() => {
    if (sessions && sessions.length > 0) {
      setEditingSessions(sessions.map(s => ({
        id: s.id,
        startTime: extractTime(s.start_time, "09:00"),
        endTime: extractTime(s.end_time, "17:00"),
        breakMinutes: s.break_minutes || 0,
        clientId: s.client_id || null,
      })));
    } else {
      setEditingSessions([
        { startTime: "09:00", endTime: "17:00", breakMinutes: 0, clientId: null }
      ]);
    }
    setIsEditing(false);
    setShowDeleteConfirm(false);
  }, [sessions, isOpen]);

  const convertTo12Hour = (time24) => {
    if (!time24) return "";
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const calculateSessionHours = (startTime, endTime, breakMinutes = 0) => {
    if (!startTime || !endTime) return 0;
    
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    let totalMinutes = endMinutes - startMinutes;
    if (totalMinutes < 0) {
      totalMinutes += 24 * 60;
    }
    
    totalMinutes -= (breakMinutes || 0);
    
    return Math.max(0, totalMinutes / 60);
  };

  const calculateTotalHours = (sessionsToCalculate) => {
    return sessionsToCalculate.reduce((total, session) => {
      return total + calculateSessionHours(session.startTime, session.endTime, session.breakMinutes);
    }, 0);
  };

const addSession = () => {
    setEditingSessions([
      ...editingSessions,
      { startTime: "09:00", endTime: "17:00", breakMinutes: 0, clientId: null }
    ]);
  };

  const removeSession = (index) => {
    if (editingSessions.length === 1) return;
    setEditingSessions(editingSessions.filter((_, i) => i !== index));
  };

  const updateSession = (index, field, value) => {
    const updated = [...editingSessions];
    updated[index][field] = value;
    setEditingSessions(updated);
  };

  const hasSessions = sessions && sessions.length > 0;
  const totalHours = hasSessions 
    ? sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / 60
    : 0;
  const editingTotalHours = calculateTotalHours(editingSessions);

  const handleSave = () => {
    for (const session of editingSessions) {
      if (!session.startTime || !session.endTime) {
        alert("Please enter both start and end times for all sessions");
        return;
      }
    }
    
    if (!date) return;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    
    const sessionsData = editingSessions.map(session => {
      const hours = calculateSessionHours(session.startTime, session.endTime, session.breakMinutes);
      const minutes = hours * 60;
      
return {
                  id: session.id,
                  date: dateStr,
                  start_time: new Date(`${dateStr}T${session.startTime}:00`).toISOString(),
                  end_time: new Date(`${dateStr}T${session.endTime}:00`).toISOString(),
                  duration_minutes: minutes,
                  break_minutes: session.breakMinutes || 0,
                  is_active: false,
                  client_id: session.clientId || null,
                };
    });
    
    onSave(sessionsData);
    setIsEditing(false);
  };

const handleCancel = () => {
    if (sessions && sessions.length > 0) {
            setEditingSessions(sessions.map(s => ({
              id: s.id,
              startTime: extractTime(s.start_time, "09:00"),
              endTime: extractTime(s.end_time, "17:00"),
              breakMinutes: s.break_minutes || 0,
              clientId: s.client_id || null,
            })));
          } else {
            setEditingSessions([{ startTime: "09:00", endTime: "17:00", breakMinutes: 0, clientId: null }]);
          }
          setIsEditing(false);
  };

  const handleDeleteDay = () => {
    onSave([]);
    setShowDeleteConfirm(false);
    onClose();
  };

  if (!date) return null;

  return (
    <>
<Dialog open={isOpen && !showDeleteConfirm} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto bg-white border-0 rounded-[24px] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <Calendar className="w-5 h-5 text-blue-600" />
              {format(date, 'EEEE, MMMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-6 space-y-4">
            {/* Total Hours Section - Now at top */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-[20px] p-6 border border-blue-200">
<div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-blue-600 font-semibold">
                    {isEditing ? 'Edit Sessions' : 'Total Hours Worked'}
                  </span>
                </div>
                {!isEditing && hasSessions && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsEditing(true)}
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-[12px]"
                    >
                      <Edit2 className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-100 rounded-[12px]"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                )}
              </div>
              
{!isEditing ? (
                <div>
                  <p className="text-6xl font-bold text-blue-600 mb-4">
                    {totalHours.toFixed(2)}
                  </p>
                  
                  {hasSessions && (() => {
                    // Group sessions by client
                    const grouped = sessions.reduce((acc, session) => {
                      const clientId = session.client_id || '__unassigned__';
                      if (!acc[clientId]) acc[clientId] = [];
                      acc[clientId].push(session);
                      return acc;
                    }, {});

                    const sortedClientIds = Object.keys(grouped).sort((a, b) => {
                      if (a === '__unassigned__') return 1;
                      if (b === '__unassigned__') return -1;
                      const clientA = clients.find(c => c.id === a);
                      const clientB = clients.find(c => c.id === b);
                      return (clientA?.name || '').localeCompare(clientB?.name || '');
                    });

                    return (
                      <div className="space-y-4">
                        {sortedClientIds.map((clientId) => {
                          const clientSessions = grouped[clientId];
                          const client = clientId === '__unassigned__' ? null : clients.find(c => c.id === clientId);
                          const clientName = client?.name || 'Unassigned';
                          const clientColor = client?.color || '#6b7280';

                          return (
<div key={clientId}>
                              <div className="flex items-center gap-2 mb-2">
                                <div
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: clientColor }}
                                />
                                <span className="text-sm font-semibold text-gray-700">{clientName}</span>
                              </div>
                              <div className="space-y-2 ml-4">
                                {clientSessions.map((session, index) => {
                                  const startTime = extractTime(session.start_time, "09:00");
                                  const endTime = extractTime(session.end_time, "17:00");
                                  const hours = (session.duration_minutes / 60).toFixed(2);
                                  const breakMins = session.break_minutes || 0;

                                  return (
                                    <div key={session.id || index} className="bg-white rounded-[16px] p-3 border border-gray-200">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <p className="text-gray-900 font-semibold">
                                            {convertTo12Hour(startTime)} - {convertTo12Hour(endTime)}
                                          </p>
                                          {breakMins > 0 && (
                                            <p className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                                              <Coffee className="w-3 h-3" />
                                              {breakMins} min break
                                            </p>
                                          )}
                                        </div>
                                        <p className="text-lg font-semibold text-blue-600">{hours}h</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
) : (
                <div className="space-y-4">
                  {editingSessions.map((session, index) => (
                    <div key={index} className="bg-white rounded-[16px] p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-blue-600">Session {index + 1}</span>
                        {editingSessions.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSession(index)}
                            className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-[12px]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      {/* Client indicator and selector */}
                      {(() => {
                        const currentClientId = session.clientId;
                        const currentClient = currentClientId ? clients.find(c => c.id === currentClientId) : null;
                        const clientName = currentClient?.name || 'Unassigned';
                        const clientColor = currentClient?.color || '#6b7280';
                        const activeClients = clients.filter(c => !c.is_archived);

                        return (
<div className="mb-3">
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: clientColor }}
                              />
                              <span className="text-xs text-gray-600">{clientName}</span>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-blue-600 text-xs font-semibold flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                Client
                              </Label>
                              <Select
                                value={currentClientId || "__unassigned__"}
                                onValueChange={(value) => {
                                  const newClientId = value === "__unassigned__" ? null : value;
                                  updateSession(index, 'clientId', newClientId);
                                }}
                              >
                                <SelectTrigger className="bg-gray-50 border-gray-200 text-gray-900 h-9 rounded-[12px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-gray-200 rounded-[16px]">
                                  <SelectItem value="__unassigned__" className="text-gray-500 rounded-[12px]">
                                    Unassigned
                                  </SelectItem>
                                  {activeClients.map((client) => (
                                    <SelectItem key={client.id} value={client.id} className="text-gray-900 rounded-[12px]">
                                      <div className="flex items-center gap-2">
                                        <div
                                          className="w-2 h-2 rounded-full"
                                          style={{ backgroundColor: client.color || '#6b7280' }}
                                        />
                                        {client.name}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })()}
                      
<div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="space-y-2">
                          <Label htmlFor={`startTime-${index}`} className="text-blue-600 text-xs font-semibold">Start</Label>
                          <Input
                            id={`startTime-${index}`}
                            type="time"
                            value={session.startTime}
                            onChange={(e) => updateSession(index, 'startTime', e.target.value)}
                            className="bg-gray-50 border-gray-200 text-gray-900 rounded-[12px]"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`endTime-${index}`} className="text-blue-600 text-xs font-semibold">End</Label>
                          <Input
                            id={`endTime-${index}`}
                            type="time"
                            value={session.endTime}
                            onChange={(e) => updateSession(index, 'endTime', e.target.value)}
                            className="bg-gray-50 border-gray-200 text-gray-900 rounded-[12px]"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2 mb-2">
                        <Label htmlFor={`breakMinutes-${index}`} className="text-blue-600 text-xs font-semibold flex items-center gap-1">
                          <Coffee className="w-3 h-3" />
                          Break Time (minutes)
                        </Label>
                        <Input
                          id={`breakMinutes-${index}`}
                          type="number"
                          min="0"
                          step="1"
                          value={session.breakMinutes}
                          onChange={(e) => updateSession(index, 'breakMinutes', parseInt(e.target.value) || 0)}
                          className="bg-gray-50 border-gray-200 text-gray-900 rounded-[12px]"
                          placeholder="0"
                        />
                      </div>

                      <div className="text-right">
                        <span className="text-sm text-blue-600 font-semibold">
                          {calculateSessionHours(session.startTime, session.endTime, session.breakMinutes).toFixed(2)}h
                        </span>
                      </div>
                      </div>
                      ))}

    <Button
                    variant="outline"
                    onClick={addSession}
                    className="w-full border-blue-200 text-blue-600 hover:bg-blue-50 rounded-[14px]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Session
                  </Button>
                  
                  <div className="bg-blue-100 rounded-[16px] p-3 border border-blue-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-blue-700 font-semibold">Total Hours:</span>
                      <span className="text-2xl font-bold text-blue-700">{editingTotalHours.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSave}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-[14px]"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                    <Button
                      onClick={handleCancel}
                      variant="outline"
                      className="flex-1 border-gray-200 text-gray-700 hover:bg-gray-100 rounded-[14px]"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            {!hasSessions && !isEditing && (
              <div className="text-center mt-4">
                <p className="text-gray-500 text-sm mb-3">No hours recorded for this day</p>
                <Button
                  onClick={() => setIsEditing(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-[14px]"
                >
                  Add Hours
                </Button>
              </div>
            )}

            {/* Day Mileage Section - Now at bottom */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-[20px] p-4 border border-amber-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Car className="w-5 h-5 text-amber-600" />
                  <span className="text-sm text-amber-600 font-semibold">Day Mileage</span>
                </div>
                {!isEditingMileage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsEditingMileage(true)}
                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-100 rounded-[12px]"
                  >
                    <Edit2 className="w-5 h-5" />
                  </Button>
                )}
              </div>

              {!isEditingMileage ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Miles Driven:</span>
                    <span className="text-lg font-semibold text-amber-600">
                      {dailyMilesDriven ? `${parseFloat(dailyMilesDriven).toFixed(1)} mi` : '0 mi'}
                      {dailyRoundTrip && dailyMilesDriven && parseFloat(dailyMilesDriven) > 0 && (
                        <span className="text-sm ml-1">(RT: {(parseFloat(dailyMilesDriven) * 2).toFixed(1)} mi)</span>
                      )}
                    </span>
                  </div>
                  {dailyMileageNotes && (
                    <div className="pt-2 border-t border-amber-200">
                      <p className="text-xs text-gray-600">Notes:</p>
                      <p className="text-sm text-gray-700 mt-1">{dailyMileageNotes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-gray-600 text-xs">Miles (one-way)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={dailyMilesDriven}
                        onChange={(e) => { setDailyMilesDriven(e.target.value); setIsDailyMileageDirty(true); }}
                        className="bg-white border-gray-200 text-gray-900 h-9 rounded-[12px]"
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-gray-600 text-xs">Round trip</Label>
                      <div className="flex items-center h-9">
                        <Switch
                          checked={dailyRoundTrip}
                          onCheckedChange={(checked) => { setDailyRoundTrip(checked); setIsDailyMileageDirty(true); }}
                        />
                        {dailyRoundTrip && dailyMilesDriven && parseFloat(dailyMilesDriven) > 0 && (
                          <span className="ml-2 text-xs text-amber-600">
                            Total: {(parseFloat(dailyMilesDriven) * 2).toFixed(1)} mi
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-gray-600 text-xs">Notes</Label>
                    <Textarea
                      value={dailyMileageNotes}
                      onChange={(e) => { setDailyMileageNotes(e.target.value); setIsDailyMileageDirty(true); }}
                      className="bg-white border-gray-200 text-gray-900 h-16 text-sm rounded-[12px]"
                      placeholder="e.g., Commute to office"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveDailyMileage}
                      disabled={createDayMileageMutation.isPending || updateDayMileageMutation.isPending}
                      className="flex-1 bg-amber-600 hover:bg-amber-700 text-white rounded-[14px] h-9 text-sm font-semibold"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                    <Button
                      onClick={handleCancelMileageEdit}
                      variant="outline"
                      className="flex-1 border-gray-200 text-gray-700 hover:bg-gray-100 rounded-[14px] h-9 text-sm"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md bg-white border-0 rounded-[24px] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Delete All Work for This Day?
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-gray-700 mb-2">
              Are you sure you want to delete all work sessions for {format(date, 'MMMM d, yyyy')}?
            </p>
            <p className="text-sm text-gray-500">
              This action cannot be undone.
            </p>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              className="border-gray-200 text-gray-700 hover:bg-gray-100 rounded-[14px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteDay}
              className="bg-red-600 hover:bg-red-700 text-white rounded-[14px]"
            >
              Delete Day
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}