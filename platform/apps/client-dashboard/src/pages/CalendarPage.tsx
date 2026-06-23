import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventDropArg } from '@fullcalendar/core';
import { Calendar as CalendarIcon } from 'lucide-react';
import { clientApi } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

export function CalendarPage() {
  const queryClient = useQueryClient();
  const { data: appointments, isLoading } = useQuery({
    queryKey: ['appointments-calendar'],
    queryFn: () => clientApi.getAppointments(),
  });

  const reschedule = useMutation({
    mutationFn: ({ id, start_time }: { id: string; start_time: string }) =>
      clientApi.updateAppointment(id, { start_time }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const events = useMemo(
    () =>
      (appointments ?? [])
        .filter((a) => a.status !== 'cancelled')
        .map((a) => ({
          id: a.id,
          title: `${a.customer_name} — ${a.service_name ?? 'Appt'}`,
          start: a.start_time,
          end: new Date(new Date(a.start_time).getTime() + a.duration_minutes * 60000).toISOString(),
          backgroundColor:
            a.status === 'completed' ? '#059669' : a.status === 'no_show' ? '#dc2626' : '#10b981',
          borderColor: 'transparent',
          className: 'shadow-sm rounded-md',
        })),
    [appointments],
  );

  function handleDrop(info: EventDropArg) {
    if (!info.event.start) return;
    reschedule.mutate({ id: info.event.id, start_time: info.event.start.toISOString() });
  }

  if (isLoading) return <Skeleton className="h-[700px] w-full rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-2 border-b border-white/40 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarIcon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground mt-1">Manage and reschedule your upcoming appointments</p>
        </div>
      </div>
      
      <div className="rounded-3xl border border-white/60 bg-white/40 backdrop-blur-2xl p-6 shadow-xl shadow-black/5 [&_.fc]:text-foreground [&_.fc-button]:bg-white/50 [&_.fc-button]:border-white/50 [&_.fc-button-active]:bg-primary [&_.fc-button-active]:text-primary-foreground [&_.fc-button-active]:border-primary transition-all duration-500 hover:shadow-2xl hover:bg-white/50 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 fill-mode-both">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
          events={events}
          editable
          droppable
          eventDrop={handleDrop}
          height="auto"
          slotMinTime="07:00:00"
          slotMaxTime="21:00:00"
          allDaySlot={false}
          dayMaxEvents={true}
          nowIndicator={true}
          expandRows={true}
          stickyHeaderDates={true}
        />
      </div>
    </div>
  );
}
