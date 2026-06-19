import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventDropArg } from '@fullcalendar/core';
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
        })),
    [appointments],
  );

  function handleDrop(info: EventDropArg) {
    if (!info.event.start) return;
    reschedule.mutate({ id: info.event.id, start_time: info.event.start.toISOString() });
  }

  if (isLoading) return <Skeleton className="h-[600px]" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Calendar</h1>
        <p className="text-muted-foreground">Drag and drop to reschedule appointments</p>
      </div>
      <div className="rounded-xl border border-border/50 bg-card p-4 [&_.fc]:text-foreground [&_.fc-button]:bg-secondary [&_.fc-button]:border-border [&_.fc-button-active]:bg-primary">
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
        />
      </div>
    </div>
  );
}
