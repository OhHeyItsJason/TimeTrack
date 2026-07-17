import React, { useState } from "react";
import { appClient } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import CalendarView from "../components/history/CalendarView";
import DayModal from "../components/history/DayModal";

export default function History() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['workSessions'],
    queryFn: () => appClient.entities.WorkSession.list('-date'),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => appClient.entities.Client.list('name'),
  });

  const { data: dayMileageRecords = [] } = useQuery({
    queryKey: ['dayMileage'],
    queryFn: () => appClient.entities.DayMileage.list(),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => appClient.entities.Invoice.list('-start_date'),
  });
  const updateSessionMutation = useMutation({
    mutationFn: ({ id, data }) => appClient.entities.WorkSession.update(id, data),
  });

  const createSessionMutation = useMutation({
    mutationFn: (data) => appClient.entities.WorkSession.create(data),
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

  const createDayMileageMutation = useMutation({
    mutationFn: (data) => appClient.entities.DayMileage.create(data),
  });

  const updateDayMileageMutation = useMutation({
    mutationFn: ({ id, data }) => appClient.entities.DayMileage.update(id, data),
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

  const handleDayClick = (date) => {
    setSelectedDate(date);
    setIsModalOpen(true);
  };

  const handleSaveDay = async ({ sessions: sessionsData, mileage }) => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const existingDay = daysByDate[dateStr];

    const persistSessions = async () => {
      const existingSessions = existingDay?.sessions || [];
      const existingIds = new Set(existingSessions.map((session) => session.id));
      const savedIds = new Set((sessionsData || []).map((session) => session.id).filter(Boolean));

      await Promise.all(existingSessions
        .filter((session) => !savedIds.has(session.id))
        .map((session) => deleteSessionMutation.mutateAsync(session.id))
      );

      await Promise.all((sessionsData || []).map((sessionData) => {
        const { id, ...data } = sessionData;
        if (id && existingIds.has(id)) {
          return updateSessionMutation.mutateAsync({ id, data });
        }
        return createSessionMutation.mutateAsync({ date: dateStr, ...data });
      }));
    };

    const persistMileage = async () => {
      if (!mileage) return;

      const existingMileage = dayMileageRecords.find((record) => record.date === dateStr);
      const hasMileageData =
        Boolean(existingMileage) ||
        mileage.daily_miles_driven > 0 ||
        mileage.daily_round_trip ||
        Boolean(mileage.daily_mileage_notes?.trim());

      if (!hasMileageData) return;

      const mileageData = { date: dateStr, ...mileage };
      if (existingMileage) {
        await updateDayMileageMutation.mutateAsync({ id: existingMileage.id, data: mileageData });
      } else {
        await createDayMileageMutation.mutateAsync(mileageData);
      }
    };

    await Promise.all([persistSessions(), persistMileage()]);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['workSessions'] }),
      queryClient.invalidateQueries({ queryKey: ['dayMileage'] }),
    ]);
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
              <p className="text-gray-500 text-lg">Review and edit your recorded work days</p>
            </div>
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

<DayModal
          date={selectedDate}
          sessions={getSessionsForDate(selectedDate)}
          onSave={handleSaveDay}
          onClose={() => setIsModalOpen(false)}
          isOpen={isModalOpen}
          clients={clients}
        />
      </div>
    </div>
  );
}
