import React from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  format, 
  isSameMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
} from "date-fns";

export default function CalendarView({ 
  currentDate, 
  onDateChange, 
  workDayDates, 
  onDayClick,
  selectedDates = null,
  mode = "view",
  clientsByDate = {},
  mileageByDate = {},
  statusByDateByClient = {},
  unassignedWorkByDate = {},
  fullyPaidByDate = {},
  selectedClientId = null,
}) {
  const displayMonth = currentDate;

  const renderMonth = (monthDate) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    
    const hasWork = (date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return workDayDates.includes(dateStr);
    };

    const isSelected = (date) => {
      if (!selectedDates) return false;
      const dateStr = format(date, 'yyyy-MM-dd');
      return selectedDates.has(dateStr);
    };

    const hasMileage = (date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return !!mileageByDate[dateStr];
    };

    return (
      <div>
        <div className="grid grid-cols-7 gap-1 mb-0.5">
            {['S', 'M', 'T', 'W', 'Tr', 'F', 'S'].map((day, index) => (
              <div key={index} className="text-center text-xs font-semibold text-gray-500 py-0.5">
                {day}
              </div>
            ))}
          </div>
        
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => {
            const isCurrentMonth = isSameMonth(day, monthDate);
            const hasWorkToday = hasWork(day);
            const isSelectedDay = isSelected(day);
            const hasMileageToday = hasMileage(day);
            const dateStr = format(day, 'yyyy-MM-dd');
            const isFullyPaidDay = !!fullyPaidByDate[dateStr];
            
            // For select mode with a selected client, check if this date has work for that client
            const clientStatus = selectedClientId ? statusByDateByClient[selectedClientId]?.[dateStr] : null;
            const isPaidForClient = clientStatus === 'paid';
            const isInvoicedForClient = clientStatus === 'invoiced';
            
            const isClickable = isCurrentMonth && (
              mode === "view" || 
              (mode === "select" && hasWorkToday && !(isPaidForClient || isInvoicedForClient))
            );

            // Determine work day styling (even for selected days to show status)
            let workDayClass = '';
            if (hasWorkToday && isCurrentMonth) {
              // When selectedClientId exists (Invoice page), use that client's status
              if (selectedClientId) {
                if (isPaidForClient) {
                  workDayClass = 'bg-green-50 border-2 border-green-400 shadow-sm';
                } else if (isInvoicedForClient) {
                  workDayClass = 'bg-amber-50 border-2 border-amber-400 shadow-sm';
                } else {
                  workDayClass = 'bg-blue-100 border-2 border-blue-400 shadow-sm';
                }
              } else if (isFullyPaidDay) {
                // History page - all clients for this day are paid
                workDayClass = 'bg-green-50 border-2 border-green-400 shadow-sm';
              } else {
                // History page - check if any sessions are invoiced
                const dayClients = clientsByDate[dateStr] || [];
                const hasInvoiced = dayClients.some(client => {
                  const status = statusByDateByClient[client.id]?.[dateStr];
                  return status === 'invoiced';
                });

                if (hasInvoiced) {
                  workDayClass = 'bg-amber-50 border-2 border-amber-400 shadow-sm';
                } else {
                  workDayClass = 'bg-blue-100 border-2 border-blue-400 shadow-sm';
                }
              }
            }
            
            return (
              <button
                key={index}
                onClick={() => isClickable && onDayClick(day)}
                                      disabled={!isClickable}
                                      className={`
                                        aspect-square p-0.5 rounded-lg text-sm font-semibold transition-all relative
                                        ${!isCurrentMonth 
                                            ? 'text-gray-400 cursor-default' 
                                            : isClickable 
                                              ? 'text-gray-900 hover:bg-blue-50 cursor-pointer' 
                                              : mode === "select" && (isPaidForClient || isInvoicedForClient)
                                                ? 'text-gray-600 cursor-not-allowed'
                                                : 'text-gray-500 cursor-default'}
                                        ${isSelectedDay ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/20 border-2 border-green-400' : workDayClass || 'border border-gray-200'}
                                      `}
              >
                {/* Mileage indicator - top right */}
                {hasMileageToday && isCurrentMonth && !isSelectedDay && (
                  <div className="absolute top-1 right-1 w-2 h-2 bg-amber-400 rounded-sm shadow-sm shadow-amber-400/50"></div>
                )}
                <div className="flex flex-col items-center justify-center h-full">
                  <span>{format(day, 'd')}</span>
                  {/* Client and unassigned dots */}
                  {hasWorkToday && isCurrentMonth && !isSelectedDay && (() => {
                        const dayClients = clientsByDate[dateStr] || [];
                        const hasUnassigned = !!unassignedWorkByDate[dateStr];

                        if (!hasUnassigned && dayClients.length === 0) {
                          return null;
                        }

                        return (
                          <div className="flex items-center justify-center gap-0.5 mt-0.5">
                            {/* Unassigned work dot - black outline only */}
                            {hasUnassigned && (
                              <div className="w-3 h-3 rounded-full border-2 border-gray-400 bg-transparent" />
                            )}
                            {/* Client dots based on status */}
                            {dayClients.slice(0, 3).map((client, idx) => {
                              const status = statusByDateByClient[client.id]?.[dateStr] || 'workOnly';
                              
                              if (status === 'workOnly') {
                                // Outline only
                                return (
                                  <div
                                    key={idx}
                                    className="w-3 h-3 rounded-full border-2 bg-transparent"
                                    style={{ borderColor: client.color }}
                                  />
                                );
                              } else if (status === 'invoiced') {
                                // Filled circle
                                return (
                                  <div
                                    key={idx}
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: client.color }}
                                  />
                                );
                              } else {
                                // Paid - filled with white check
                                return (
                                  <div
                                    key={idx}
                                    className="w-3 h-3 rounded-full flex items-center justify-center"
                                    style={{ backgroundColor: client.color }}
                                  >
                                    <Check className="w-2 h-2 text-white" strokeWidth={4} />
                                  </div>
                                );
                              }
                            })}
                          </div>
                        );
                      })()}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-1">
      {/* Legend */}
                  <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-gray-600 mb-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded bg-blue-100 border-2 border-blue-400" />
                        <span>Unpaid Work</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded bg-amber-50 border-2 border-amber-400" />
                        <span>Invoiced</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded bg-green-50 border-2 border-green-400" />
                        <span>Fully Paid</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 bg-amber-400 rounded-sm" />
                        <span>Mileage</span>
                      </div>
                    </div>

        {/* Month Navigation */}
                      <div className="flex items-center justify-between gap-4">
                        <Button
                          variant="outline"
                          size="default"
                          onClick={() => onDateChange(subMonths(currentDate, 1))}
                          className="hover:bg-blue-50 border-gray-200 text-gray-700 hover:text-blue-600 rounded-[14px] flex-shrink-0"
                        >
                          <ChevronLeft className="w-5 h-5 mr-1" />
                          Previous
                        </Button>

                        <div className="text-center">
                          <p className="text-xl font-semibold text-gray-900">
                            {format(displayMonth, 'MMMM yyyy')}
                          </p>
                        </div>

                        <Button
                          variant="outline"
                          size="default"
                          onClick={() => onDateChange(addMonths(currentDate, 1))}
                          className="hover:bg-blue-50 border-gray-200 text-gray-700 hover:text-blue-600 rounded-[14px] flex-shrink-0"
                        >
                          Next
                          <ChevronRight className="w-5 h-5 ml-1" />
                        </Button>
                      </div>

      {/* Calendar Grid */}
      <div className="max-w-3xl mx-auto w-full">
        {renderMonth(displayMonth)}
      </div>
    </div>
  );
}