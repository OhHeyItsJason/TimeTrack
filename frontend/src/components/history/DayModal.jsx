import React, { useEffect, useState } from "react";
import { appClient } from "@/api/appClient";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar, Car, Clock, Coffee, Plus, Save, Trash2, Users } from "lucide-react";
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

const EMPTY_SESSION = {
  startTime: "09:00",
  endTime: "17:00",
  breakMinutes: 0,
  clientId: null,
  milesDriven: "",
  roundTrip: false,
  mileageNotes: "",
};

function extractTime(isoString, defaultTime) {
  if (!isoString) return defaultTime;

  const parsedDate = new Date(isoString);
  return Number.isNaN(parsedDate.getTime()) ? defaultTime : format(parsedDate, "HH:mm");
}

function calculateSessionHours(startTime, endTime, breakMinutes = 0) {
  if (!startTime || !endTime) return 0;

  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  let totalMinutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);

  if (totalMinutes < 0) totalMinutes += 24 * 60;
  return Math.max(0, totalMinutes - (Number(breakMinutes) || 0)) / 60;
}

export default function DayModal({ date, sessions = [], onSave, onClose, isOpen, clients = [] }) {
  const [editingSessions, setEditingSessions] = useState([]);
  const [dailyMilesDriven, setDailyMilesDriven] = useState("");
  const [dailyRoundTrip, setDailyRoundTrip] = useState(false);
  const [dailyMileageNotes, setDailyMileageNotes] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loadedMileageDate, setLoadedMileageDate] = useState(null);

  const dateStr = date ? format(date, "yyyy-MM-dd") : null;
  const { data: dayMileageRecords = [], isLoading: isLoadingDayMileage } = useQuery({
    queryKey: ["dayMileage", dateStr],
    queryFn: () => appClient.entities.DayMileage.filter({ date: dateStr }),
    enabled: Boolean(dateStr && isOpen),
  });

  useEffect(() => {
    setEditingSessions(
      sessions.length > 0
        ? sessions.map((session) => ({
            id: session.id,
            startTime: extractTime(session.start_time, "09:00"),
            endTime: extractTime(session.end_time, "17:00"),
            breakMinutes: session.break_minutes || 0,
            clientId: session.client_id || null,
            milesDriven: session.session_miles_driven != null ? String(session.session_miles_driven) : "",
            roundTrip: Boolean(session.session_round_trip),
            mileageNotes: session.session_mileage_notes || "",
          }))
        : [{ ...EMPTY_SESSION }]
    );
    setShowDeleteConfirm(false);
    setSaveError("");
  }, [sessions, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setLoadedMileageDate(null);
      return;
    }

    if (isLoadingDayMileage || loadedMileageDate === dateStr) return;

    const record = dayMileageRecords[0];
    setDailyMilesDriven(record?.daily_miles_driven ? String(record.daily_miles_driven) : "");
    setDailyRoundTrip(record?.daily_round_trip || false);
    setDailyMileageNotes(record?.daily_mileage_notes || "");
    setLoadedMileageDate(dateStr);
  }, [dateStr, dayMileageRecords, isLoadingDayMileage, isOpen, loadedMileageDate]);

  if (!date) return null;

  const updateSession = (index, field, value) => {
    setEditingSessions((currentSessions) =>
      currentSessions.map((session, sessionIndex) =>
        sessionIndex === index ? { ...session, [field]: value } : session
      )
    );
  };

  const removeSession = (index) => {
    if (editingSessions.length === 1) return;
    setEditingSessions((currentSessions) => currentSessions.filter((_, sessionIndex) => sessionIndex !== index));
  };

  const editingTotalHours = editingSessions.reduce(
    (total, session) => total + calculateSessionHours(session.startTime, session.endTime, session.breakMinutes),
    0
  );
  const sessionMileageTotal = editingSessions.reduce(
    (total, session) => total + (Number(session.milesDriven) || 0) * (session.roundTrip ? 2 : 1),
    0
  );
  const isMileageReady = loadedMileageDate === dateStr;

  const handleSave = async () => {
    if (editingSessions.some((session) => !session.startTime || !session.endTime)) {
      setSaveError("Enter a start and end time for each session.");
      return;
    }

    const sessionsData = editingSessions.map((session) => ({
      id: session.id,
      date: dateStr,
      start_time: new Date(`${dateStr}T${session.startTime}:00`).toISOString(),
      end_time: new Date(`${dateStr}T${session.endTime}:00`).toISOString(),
      duration_minutes: calculateSessionHours(session.startTime, session.endTime, session.breakMinutes) * 60,
      break_minutes: Number(session.breakMinutes) || 0,
      is_active: false,
      client_id: session.clientId || null,
      session_miles_driven: parseFloat(session.milesDriven) || 0,
      session_round_trip: session.roundTrip,
      session_mileage_notes: session.mileageNotes.trim() || null,
    }));

    setIsSaving(true);
    setSaveError("");

    try {
      await onSave({
        sessions: sessionsData,
        mileage: {
          daily_miles_driven: parseFloat(dailyMilesDriven) || 0,
          daily_round_trip: dailyRoundTrip,
          daily_mileage_notes: dailyMileageNotes,
        },
      });
    } catch (error) {
      setSaveError(error?.message || "Unable to save this day. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDay = async () => {
    setIsSaving(true);
    setSaveError("");

    try {
      await onSave({ sessions: [], mileage: null });
      setShowDeleteConfirm(false);
    } catch (error) {
      setSaveError(error?.message || "Unable to delete this day's work sessions.");
      setShowDeleteConfirm(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen && !showDeleteConfirm} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-0 bg-white p-6 shadow-2xl sm:max-w-2xl sm:rounded-[24px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <Calendar className="h-6 w-6 text-blue-600" />
              {format(date, "EEEE, MMMM d, yyyy")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <section className="rounded-[20px] border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <span className="text-base font-semibold text-blue-600">Work Sessions</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-red-600 hover:bg-red-100 hover:text-red-700"
                  title="Delete all work sessions for this day"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-3">
                {editingSessions.map((session, index) => {
                  const client = session.clientId ? clients.find((item) => item.id === session.clientId) : null;
                  const activeClients = clients.filter((item) => !item.is_archived);

                  return (
                    <div key={session.id || index} className="rounded-[16px] border border-gray-200 bg-white p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-semibold text-blue-600">Session {index + 1}</span>
                        {editingSessions.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSession(index)}
                            className="h-8 w-8 text-red-600 hover:bg-red-100 hover:text-red-700"
                            title="Remove session"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="space-y-1">
                        <Label className="flex items-center gap-1 text-xs font-semibold text-blue-600">
                          <Users className="h-3 w-3" />
                          Client
                        </Label>
                        <Select
                          value={session.clientId || "__unassigned__"}
                          onValueChange={(value) => updateSession(index, "clientId", value === "__unassigned__" ? null : value)}
                        >
                          <SelectTrigger className="h-10 rounded-[12px] border-gray-200 bg-gray-50 text-gray-900">
                            <SelectValue>{client?.name || "Unassigned"}</SelectValue>
                          </SelectTrigger>
                          <SelectContent className="rounded-[16px] border-gray-200 bg-white">
                            <SelectItem value="__unassigned__" className="rounded-[12px] text-gray-500">Unassigned</SelectItem>
                            {activeClients.map((item) => (
                              <SelectItem key={item.id} value={item.id} className="rounded-[12px] text-gray-900">
                                <div className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color || "#6b7280" }} />
                                  {item.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="space-y-1">
                          <Label htmlFor={`startTime-${index}`} className="text-xs font-semibold text-blue-600">Start</Label>
                          <Input id={`startTime-${index}`} type="time" value={session.startTime} onChange={(event) => updateSession(index, "startTime", event.target.value)} className="rounded-[12px] border-gray-200 bg-gray-50 text-gray-900" />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`endTime-${index}`} className="text-xs font-semibold text-blue-600">End</Label>
                          <Input id={`endTime-${index}`} type="time" value={session.endTime} onChange={(event) => updateSession(index, "endTime", event.target.value)} className="rounded-[12px] border-gray-200 bg-gray-50 text-gray-900" />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`breakMinutes-${index}`} className="flex items-center gap-1 text-xs font-semibold text-blue-600"><Coffee className="h-3 w-3" />Break</Label>
                          <Input id={`breakMinutes-${index}`} type="number" min="0" step="1" value={session.breakMinutes} onChange={(event) => updateSession(index, "breakMinutes", Math.max(0, Number(event.target.value) || 0))} className="rounded-[12px] border-gray-200 bg-gray-50 text-gray-900" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold text-blue-600">Total hours</Label>
                          <div className="flex h-10 items-center justify-end rounded-[12px] border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-600">
                            {calculateSessionHours(session.startTime, session.endTime, session.breakMinutes).toFixed(2)}h
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 rounded-[12px] border border-amber-100 bg-amber-50 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <Label className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                            <Car className="h-4 w-4" />
                            Session Mileage
                          </Label>
                          <span className="text-sm font-semibold text-amber-700">
                            {((Number(session.milesDriven) || 0) * (session.roundTrip ? 2 : 1)).toFixed(1)} mi
                          </span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor={`sessionMiles-${index}`} className="text-xs text-amber-700">Miles Driven</Label>
                            <Input
                              id={`sessionMiles-${index}`}
                              type="number"
                              min="0"
                              step="0.1"
                              value={session.milesDriven}
                              onChange={(event) => updateSession(index, "milesDriven", event.target.value)}
                              disabled={isSaving}
                              className="h-10 rounded-[10px] border-amber-100 bg-white text-gray-900"
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-amber-700">Round trip</Label>
                            <div className="flex h-10 items-center gap-3 rounded-[10px] border border-amber-100 bg-white px-3">
                              <Switch checked={session.roundTrip} onCheckedChange={(value) => updateSession(index, "roundTrip", value)} disabled={isSaving} />
                              <span className="text-sm text-gray-700">{session.roundTrip ? "Yes" : "No"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 space-y-1">
                          <Label htmlFor={`sessionMileageNotes-${index}`} className="text-xs text-amber-700">Mileage Notes</Label>
                          <Input
                            id={`sessionMileageNotes-${index}`}
                            value={session.mileageNotes}
                            onChange={(event) => updateSession(index, "mileageNotes", event.target.value)}
                            disabled={isSaving}
                            className="h-10 rounded-[10px] border-amber-100 bg-white text-gray-900"
                            placeholder="Optional note"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button variant="outline" onClick={() => setEditingSessions((currentSessions) => [...currentSessions, { ...EMPTY_SESSION }])} className="mt-3 w-full rounded-[14px] border-blue-200 text-blue-600 hover:bg-blue-50">
                <Plus className="mr-2 h-4 w-4" />
                Add Session
              </Button>

              <div className="mt-3 flex items-center justify-between rounded-[14px] border border-blue-200 bg-blue-100 px-4 py-3">
                <span className="text-sm font-semibold text-blue-700">Total Hours</span>
                <span className="text-2xl font-bold text-blue-700">{editingTotalHours.toFixed(2)}</span>
              </div>
              {sessionMileageTotal > 0 && (
                <p className="mt-3 text-right text-sm font-medium text-amber-700">
                  Session mileage total: {sessionMileageTotal.toFixed(1)} mi
                </p>
              )}
            </section>

            <section className="rounded-[20px] border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5">
              <div className="mb-4 flex items-center gap-3">
                <Car className="h-5 w-5 text-amber-600" />
                <span className="text-base font-semibold text-amber-600">Day Mileage</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="dailyMiles" className="text-xs text-gray-600">Miles Driven</Label>
                  <Input id="dailyMiles" type="number" min="0" step="0.1" value={dailyMilesDriven} onChange={(event) => setDailyMilesDriven(event.target.value)} disabled={!isMileageReady || isSaving} className="h-10 rounded-[12px] border-gray-200 bg-white text-gray-900" placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Round trip</Label>
                  <div className="flex h-10 items-center gap-3 rounded-[12px] border border-gray-200 bg-white px-3">
                    <Switch checked={dailyRoundTrip} onCheckedChange={setDailyRoundTrip} disabled={!isMileageReady || isSaving} />
                    <span className="text-sm text-gray-700">{dailyRoundTrip ? "Yes" : "No"}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-1">
                <Label htmlFor="dailyMileageNotes" className="text-xs text-gray-600">Notes</Label>
                <Textarea id="dailyMileageNotes" value={dailyMileageNotes} onChange={(event) => setDailyMileageNotes(event.target.value)} disabled={!isMileageReady || isSaving} className="min-h-20 rounded-[12px] border-gray-200 bg-white text-sm text-gray-900" placeholder="Add a note..." />
              </div>
              {!isMileageReady && <p className="mt-3 text-sm text-amber-700">Loading saved day mileage...</p>}
            </section>

            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          </div>

          <DialogFooter className="border-t border-gray-100 pt-4 sm:justify-end">
            <Button variant="outline" onClick={onClose} disabled={isSaving} className="rounded-[14px] border-gray-200 text-gray-700 hover:bg-gray-100">Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving || !isMileageReady} className="rounded-[14px] bg-blue-600 text-white hover:bg-blue-700">
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="border-0 bg-white shadow-2xl sm:max-w-md sm:rounded-[24px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="h-5 w-5" />Delete All Work for This Day?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-700">Delete every work session for {format(date, "MMMM d, yyyy")}?</p>
            <p className="mt-2 text-sm text-gray-500">Day mileage will remain unchanged.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={isSaving} className="rounded-[14px] border-gray-200 text-gray-700 hover:bg-gray-100">Cancel</Button>
            <Button onClick={handleDeleteDay} disabled={isSaving} className="rounded-[14px] bg-red-600 text-white hover:bg-red-700">{isSaving ? "Deleting..." : "Delete Day"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
