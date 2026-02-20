import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock, Eye, EyeOff, Car, FileDown } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import CalendarView from "../components/history/CalendarView";
import DayModal from "../components/history/DayModal";
import MileageExportModal from "../components/history/MileageExportModal";

export default function History() {
  const [showEarnings, setShowEarnings] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMileageExportOpen, setIsMileageExportOpen] = useState(false);
  const [mileageView, setMileageView] = useState('year'); // 'week', 'month', 'year', 'prevYear'
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['workSessions'],
    queryFn: () => base44.entities.WorkSession.list('-date'),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Settings.list(),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('name'),
  });

  const { data: dayMileageRecords = [] } = useQuery({
    queryKey: ['dayMileage'],
    queryFn: () => base44.entities.DayMileage.list(),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-start_date'),
  });

  const hourlyRate = settings[0]?.hourly_rate || 50;

  const updateSessionMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WorkSession.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workSessions'] });
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: (data) => base44.entities.WorkSession.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workSessions'] });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (id) => base44.entities.WorkSession.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workSessions'] });
    },
  });

  const daysByDate = sessions.reduce((acc, session) => {
    if (!session.duration_minutes || session.duration_minutes <= 0) return acc;
    
    const date = session.date;
    if (!acc[date]) {
      acc[date] = {
        date: date,
        totalMinutes: 0,
        sessions: [],
      };
    }
    acc[date].totalMinutes += session.duration_minutes;
    acc[date].sessions.push(session);
    return acc;
  }, {});

  const workDays = Object.values(daysByDate);
  const workDayDates = Object.keys(daysByDate);

  // Build lookup maps for clients
  const clientsById = clients.reduce((acc, client) => {
    acc[client.id] = client;
    return acc;
  }, {});

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
    
    let selectedDates = [];
    try {
      selectedDates = JSON.parse(invoice.selected_dates || '[]');
    } catch {
      selectedDates = [];
    }
    
    if (!statusByDateByClient[client.id]) {
      statusByDateByClient[client.id] = {};
    }
    
    selectedDates.forEach(dateStr => {
      if (invoice.is_paid) {
        statusByDateByClient[client.id][dateStr] = 'paid';
      } else if (statusByDateByClient[client.id][dateStr] !== 'paid') {
        statusByDateByClient[client.id][dateStr] = 'invoiced';
      }
    });
  });

  // Compute clientsByDate from sessions
  const clientsByDate = sessions.reduce((acc, session) => {
    if (!session.duration_minutes || session.duration_minutes <= 0) return acc;
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

  // Compute unassignedWorkByDate
  const unassignedWorkByDate = {};
  sessions.forEach(session => {
    if (!session.duration_minutes || session.duration_minutes <= 0) return;
    if (!session.client_id) {
      unassignedWorkByDate[session.date] = true;
    }
  });

  // Compute fullyPaidByDate
  const fullyPaidByDate = {};
  Object.keys(daysByDate).forEach(date => {
    const daySessions = daysByDate[date].sessions || [];
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

  // Build mileageByDate map for CalendarView mileage indicators
    const mileageByDate = {};
    dayMileageRecords.forEach(record => {
      if (record.daily_miles_driven > 0) {
        mileageByDate[record.date] = true;
      }
    });

    const totalHours = workDays.reduce((sum, day) => sum + (day.totalMinutes / 60), 0).toFixed(2);
    const totalEarnings = (totalHours * hourlyRate).toFixed(2);

    // Calculate mileage date range based on view
    const getMileageDateRange = () => {
      const now = new Date();
      const currentYear = now.getFullYear();

      switch (mileageView) {
        case 'week': {
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          return {
            start: format(startOfWeek, 'yyyy-MM-dd'),
            end: format(endOfWeek, 'yyyy-MM-dd'),
            label: 'This Week'
          };
        }
        case 'month': {
          const start = format(startOfMonth(now), 'yyyy-MM-dd');
          const end = format(endOfMonth(now), 'yyyy-MM-dd');
          return {
            start,
            end,
            label: format(now, 'MMMM yyyy')
          };
        }
        case 'prevYear': {
          return {
            start: `${currentYear - 1}-01-01`,
            end: `${currentYear - 1}-12-31`,
            label: `${currentYear - 1}`
          };
        }
        case 'year':
        default: {
          return {
            start: `${currentYear}-01-01`,
            end: `${currentYear}-12-31`,
            label: `${currentYear}`
          };
        }
      }
    };

    const mileageDateRange = getMileageDateRange();

    // Calculate total mileage from day records only
    const totalMileage = dayMileageRecords
      .filter(d => d.date >= mileageDateRange.start && d.date <= mileageDateRange.end)
      .reduce((sum, d) => {
        const miles = d.daily_miles_driven || 0;
        const multiplier = d.daily_round_trip ? 2 : 1;
        return sum + (miles * multiplier);
      }, 0);

  const handleDayClick = (date) => {
    setSelectedDate(date);
    setIsModalOpen(true);
  };

  const handleSaveHours = async (sessionsData) => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const existingDay = daysByDate[dateStr];
    
    // Delete existing sessions for this day
    if (existingDay && existingDay.sessions && existingDay.sessions.length > 0) {
      const deletePromises = existingDay.sessions.map(async (session) => {
        if (session.id) {
          try {
            await deleteSessionMutation.mutateAsync(session.id);
          } catch (error) {
            console.error(`Failed to delete session ${session.id}:`, error);
          }
        }
      });
      
      await Promise.all(deletePromises);
    }
    
    // Create new sessions if provided
    if (sessionsData && sessionsData.length > 0) {
      const createPromises = sessionsData.map(async (sessionData) => {
        await createSessionMutation.mutateAsync({
          date: dateStr,
          ...sessionData,
        });
      });
      
      await Promise.all(createPromises);
    }
    
    // Refetch to ensure we have the latest data
    await queryClient.invalidateQueries({ queryKey: ['workSessions'] });
    setIsModalOpen(false);
  };

  const getSessionsForDate = (date) => {
    if (!date) return [];
    const dateStr = format(date, 'yyyy-MM-dd');
    const day = daysByDate[dateStr];
    if (!day || !day.sessions || day.sessions.length === 0) return [];
    
    return day.sessions.sort((a, b) => 
      new Date(a.start_time) - new Date(b.start_time)
    );
  };

  const handleUpdateSessionClient = async (sessionId, clientId) => {
    await updateSessionMutation.mutateAsync({
      id: sessionId,
      data: { client_id: clientId },
    });
  };

if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f2f2f7] p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-4">
          <Skeleton className="h-12 w-64 bg-gray-200" />
          <Skeleton className="h-32 w-full bg-gray-200" />
          <Skeleton className="h-96 w-full bg-gray-200" />
        </div>
      </div>
    );
  }

return (
    <div className="min-h-screen bg-[#f2f2f7] p-4 md:p-8 pb-24">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl md:text-5xl font-semibold text-gray-900 mb-2">
                Work History
              </h1>
              <p className="text-gray-500 text-lg">Review your work hours and earnings</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEarnings(!showEarnings)}
              className="gap-2 border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-blue-600 rounded-[14px]"
            >
              {showEarnings ? (
                <>
                  <EyeOff className="w-4 h-4" />
                  Hide Earnings
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Show Earnings
                </>
              )}
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
<Card className="shadow-lg border-0 bg-white/80 ios-blur rounded-[28px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-gray-900">
                <Calendar className="w-5 h-5 text-blue-600" />
                Calendar View
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CalendarView
                currentDate={currentDate}
                onDateChange={setCurrentDate}
                workDayDates={workDayDates}
                onDayClick={handleDayClick}
                clientsByDate={clientsByDate}
                mileageByDate={mileageByDate}
                statusByDateByClient={statusByDateByClient}
                unassignedWorkByDate={unassignedWorkByDate}
                fullyPaidByDate={fullyPaidByDate}
              />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
<div className={`grid gap-6 ${showEarnings ? 'md:grid-cols-2' : ''}`}>
            <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-[28px]">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <p className="text-sm text-blue-600 font-semibold tracking-wide uppercase">Total Hours</p>
                </div>
                <p className="text-5xl font-bold text-blue-600">
                  {totalHours}
                </p>
                <p className="text-sm text-blue-600 mt-2 font-medium">{workDays.length} work days</p>
              </CardContent>
            </Card>

            <AnimatePresence>
              {showEarnings && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-emerald-50 rounded-[28px]">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-2">
                        <Calendar className="w-5 h-5 text-green-600" />
                        <p className="text-sm text-green-600 font-semibold tracking-wide uppercase">Total Earnings</p>
                      </div>
                      <p className="text-5xl font-bold text-green-600">
                        ${totalEarnings}
                      </p>
                      <p className="text-sm text-green-600 mt-2 font-medium">at ${hourlyRate}/hr</p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

{/* Mileage Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6"
        >
<Card className="shadow-lg border-0 bg-gradient-to-br from-amber-50 to-orange-50 rounded-[28px]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Car className="w-5 h-5 text-amber-600" />
                  <p className="text-sm text-amber-600 font-semibold tracking-wide uppercase">Total Mileage</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMileageExportOpen(true)}
                  className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-100 rounded-[14px]"
                >
                  <FileDown className="w-4 h-4" />
                  Export
                </Button>
              </div>
              <p className="text-5xl font-bold text-amber-600">
                {totalMileage.toFixed(1)}
              </p>
              <p className="text-sm text-amber-600 mt-2 font-medium">{mileageDateRange.label}</p>
              
              <div className="flex gap-2 mt-4">
                <Button
                  variant={mileageView === 'week' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMileageView('week')}
                  className={mileageView === 'week' 
                    ? 'bg-amber-600 hover:bg-amber-700 text-white rounded-[12px] text-xs' 
                    : 'border-amber-200 text-amber-700 hover:bg-amber-100 rounded-[12px] text-xs'}
                >
                  Week
                </Button>
                <Button
                  variant={mileageView === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMileageView('month')}
                  className={mileageView === 'month' 
                    ? 'bg-amber-600 hover:bg-amber-700 text-white rounded-[12px] text-xs' 
                    : 'border-amber-200 text-amber-700 hover:bg-amber-100 rounded-[12px] text-xs'}
                >
                  Month
                </Button>
                <Button
                  variant={mileageView === 'year' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMileageView('year')}
                  className={mileageView === 'year' 
                    ? 'bg-amber-600 hover:bg-amber-700 text-white rounded-[12px] text-xs' 
                    : 'border-amber-200 text-amber-700 hover:bg-amber-100 rounded-[12px] text-xs'}
                >
                  Year
                </Button>
                <Button
                  variant={mileageView === 'prevYear' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMileageView('prevYear')}
                  className={mileageView === 'prevYear' 
                    ? 'bg-amber-600 hover:bg-amber-700 text-white rounded-[12px] text-xs' 
                    : 'border-amber-200 text-amber-700 hover:bg-amber-100 rounded-[12px] text-xs'}
                >
                  Prev Year
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

<DayModal
          date={selectedDate}
          sessions={getSessionsForDate(selectedDate)}
          onSave={handleSaveHours}
          onClose={() => setIsModalOpen(false)}
          isOpen={isModalOpen}
          clients={clients}
          onUpdateSessionClient={handleUpdateSessionClient}
        />

<MileageExportModal
          isOpen={isMileageExportOpen}
          onClose={() => setIsMileageExportOpen(false)}
          dayMileageRecords={dayMileageRecords}
        />
      </div>
    </div>
  );
}