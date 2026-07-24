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
        <div className="grid grid-cols-7 gap-1 mb-0.5 md:mb-0">
            {['S', 'M', 'T', 'W', 'Tr', 'F', 'S'].map((day, index) => (
              <div key={index} className="py-0.5 text-center text-[11px] font-semibold text-gray-500 md:py-0 md:text-[10px]">
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
            
            const isClickable =
              mode === "view" ||
              (mode === "select" && hasWorkToday && !(isPaidForClient || isInvoicedForClient));

            // Determine work day styling (even for selected days to show status)
            let workDayClass = '';
            if (hasWorkToday) {
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
                  relative aspect-square rounded-lg p-0.5 text-sm font-semibold transition-all md:rounded-[12px] md:p-0 md:text-[13px]
                  ${!isCurrentMonth
                    ? isClickable
                      ? 'cursor-pointer text-gray-400 hover:bg-blue-50'
                      : 'cursor-default text-gray-400'
                    : isClickable
                      ? 'cursor-pointer text-gray-900 hover:bg-blue-50'
                      : mode === "select" && (isPaidForClient || isInvoicedForClient)
                        ? 'cursor-not-allowed text-gray-600'
                        : 'cursor-default text-gray-500'}
                  ${!isCurrentMonth && !isSelectedDay ? 'opacity-75' : ''}
                  ${isSelectedDay ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/20 border-2 border-green-400 opacity-100' : workDayClass || 'border border-gray-200'}
                `}
              >
                {/* Mileage indicator - top right */}
                {hasMileageToday && !isSelectedDay && (
                  <div className="absolute right-1 top-1 h-2 w-2 rounded-sm bg-amber-400 shadow-sm shadow-amber-400/50 md:right-0.5 md:top-0.5 md:h-1.5 md:w-1.5"></div>
                )}
                <div className="flex flex-col items-center justify-center h-full">
                  <span>{format(day, 'd')}</span>
                  {/* Client and unassigned dots */}
                  {hasWorkToday && !isSelectedDay && (() => {
                        const dayClients = clientsByDate[dateStr] || [];
                        const hasUnassigned = !!unassignedWorkByDate[dateStr];

                        if (!hasUnassigned && dayClients.length === 0) {
                          return null;
                        }

                        return (
                          <div className="mt-0.5 flex items-center justify-center gap-0.5 md:mt-0">
                            {/* Unassigned work dot - black outline only */}
                            {hasUnassigned && (
                              <div className="h-3 w-3 rounded-full border-2 border-gray-400 bg-transparent md:h-2.5 md:w-2.5" />
                            )}
                            {/* Client dots based on status */}
                            {dayClients.slice(0, 3).map((client, idx) => {
                              const status = statusByDateByClient[client.id]?.[dateStr] || 'workOnly';
                              
                              if (status === 'workOnly') {
                                // Outline only
                                return (
                                  <div
                                    key={idx}
                                    className="h-3 w-3 rounded-full border-2 bg-transparent md:h-2.5 md:w-2.5"
                                    style={{ borderColor: client.color }}
                                  />
                                );
                              } else if (status === 'invoiced') {
                                // Filled circle
                                return (
                                  <div
                                    key={idx}
                                    className="h-3 w-3 rounded-full md:h-2.5 md:w-2.5"
                                    style={{ backgroundColor: client.color }}
                                  />
                                );
                              } else {
                                // Paid - filled with white check
                                return (
                                  <div
                                    key={idx}
                                    className="flex h-3 w-3 items-center justify-center rounded-full md:h-2.5 md:w-2.5"
                                    style={{ backgroundColor: client.color }}
                                  >
                                    <Check className="h-2 w-2 text-white md:h-1.5 md:w-1.5" strokeWidth={4} />
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
                  <div className="mb-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-gray-600 md:mb-1 md:gap-x-2.5 md:text-[11px]">
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
                      <div className="flex items-center justify-between gap-3 md:gap-2.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDateChange(subMonths(currentDate, 1))}
                          className="h-9 flex-shrink-0 rounded-[12px] border-gray-200 px-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 md:h-8 md:px-2.5"
                        >
                          <ChevronLeft className="mr-1 h-4 w-4" />
                          Previous
                        </Button>

                        <div className="text-center">
                          <p className="text-lg font-semibold text-gray-900 md:text-base">
                            {format(displayMonth, 'MMMM yyyy')}
                          </p>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDateChange(addMonths(currentDate, 1))}
                          className="h-9 flex-shrink-0 rounded-[12px] border-gray-200 px-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 md:h-8 md:px-2.5"
                        >
                          Next
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </div>

      {/* Calendar Grid */}
      <div className="mx-auto w-full max-w-[46rem] md:max-w-[42rem]">
        {renderMonth(displayMonth)}
      </div>
    </div>
  );
}
