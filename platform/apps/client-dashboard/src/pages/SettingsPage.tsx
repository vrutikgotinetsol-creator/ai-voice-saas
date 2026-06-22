import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { clientApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

export function SettingsPage() {
  const { business, refreshBusiness } = useAuth();
  const queryClient = useQueryClient();
  const [bizForm, setBizForm] = useState({
    name: business?.name ?? '',
    business_type: business?.business_type ?? '',
    address: business?.address ?? '',
    agent_name: business?.agent_name ?? '',
    extra_info: business?.extra_info ?? '',
  });

  const location = business?.locations?.[0];
  const [hoursForm, setHoursForm] = useState({
    hours_text: location?.hours_text ?? '',
    open_time: location?.open_time ?? '09:00',
    close_time: location?.close_time ?? '18:00',
  });

  const servicesQ = useQuery({ queryKey: ['services'], queryFn: clientApi.getServices });
  const faqsQ = useQuery({ queryKey: ['faqs'], queryFn: clientApi.getFaqs });

  const updateBiz = useMutation({
    mutationFn: () => clientApi.updateBusiness(bizForm),
    onSuccess: () => refreshBusiness(),
  });

  const updateHours = useMutation({
    mutationFn: () => clientApi.updateLocation(location!.id, hoursForm),
    onSuccess: () => refreshBusiness(),
  });

  const [newService, setNewService] = useState({ name: '', price_label: '' });
  const addService = useMutation({
    mutationFn: () => clientApi.createService(newService),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['services'] }); setNewService({ name: '', price_label: '' }); },
  });

  const [newFaq, setNewFaq] = useState({ question: '', answer: '' });
  const addFaq = useMutation({
    mutationFn: () => clientApi.createFaq(newFaq),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['faqs'] }); setNewFaq({ question: '', answer: '' }); },
  });

  const deleteService = useMutation({
    mutationFn: (id: string) => clientApi.deleteService(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }),
  });

  const deleteFaq = useMutation({
    mutationFn: (id: string) => clientApi.deleteFaq(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['faqs'] }),
  });

  if (!business) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your business info, services, and FAQs — keeps your AI accurate
        </p>
      </div>

      <Tabs defaultValue="business">
        <TabsList>
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="hours">Hours</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="faqs">FAQs</TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
              <CardDescription>Basic details your AI uses when answering calls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Business Name</Label>
                  <Input value={bizForm.name} onChange={(e) => setBizForm({ ...bizForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Business Type</Label>
                  <Input value={bizForm.business_type} onChange={(e) => setBizForm({ ...bizForm, business_type: e.target.value })} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Address</Label>
                  <Input value={bizForm.address} onChange={(e) => setBizForm({ ...bizForm, address: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>AI Agent Name</Label>
                  <Input value={bizForm.agent_name} onChange={(e) => setBizForm({ ...bizForm, agent_name: e.target.value })} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Extra Info</Label>
                  <Input value={bizForm.extra_info} onChange={(e) => setBizForm({ ...bizForm, extra_info: e.target.value })} placeholder="Parking, policies, etc." />
                </div>
              </div>
              <Button onClick={() => updateBiz.mutate()} disabled={updateBiz.isPending}>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hours" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Business Hours</CardTitle>
              <CardDescription>When your AI can book appointments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {location ? (
                <>
                  <div className="space-y-2">
                    <Label>Hours Description</Label>
                    <Input value={hoursForm.hours_text} onChange={(e) => setHoursForm({ ...hoursForm, hours_text: e.target.value })} placeholder="Mon-Fri 9am-6pm, Sat 10am-4pm" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Open Time</Label>
                      <Input type="time" value={hoursForm.open_time} onChange={(e) => setHoursForm({ ...hoursForm, open_time: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Close Time</Label>
                      <Input type="time" value={hoursForm.close_time} onChange={(e) => setHoursForm({ ...hoursForm, close_time: e.target.value })} />
                    </div>
                  </div>
                  <Button onClick={() => updateHours.mutate()} disabled={updateHours.isPending}>Save Hours</Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No location configured. Contact your administrator.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Services & Pricing</CardTitle>
              <CardDescription>Your AI only offers services listed here — never invented ones</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(servicesQ.data ?? []).map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                  <div><p className="font-medium">{s.name}</p><p className="text-sm text-muted-foreground">{s.price_label}</p></div>
                  <Button variant="ghost" size="icon" onClick={() => deleteService.mutate(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input placeholder="Service name" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} />
                <Input placeholder="Price e.g. $40" value={newService.price_label} onChange={(e) => setNewService({ ...newService, price_label: e.target.value })} className="max-w-[140px]" />
                <Button onClick={() => addService.mutate()} disabled={!newService.name}><Plus className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faqs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>FAQs</CardTitle>
              <CardDescription>Common questions your AI can answer on calls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(faqsQ.data ?? []).map((f) => (
                <div key={f.id} className="flex items-start justify-between rounded-lg border border-border/50 p-3">
                  <div><p className="font-medium">{f.question}</p><p className="text-sm text-muted-foreground mt-1">{f.answer}</p></div>
                  <Button variant="ghost" size="icon" onClick={() => deleteFaq.mutate(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
              <div className="space-y-2">
                <Input placeholder="Question" value={newFaq.question} onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })} />
                <Input placeholder="Answer" value={newFaq.answer} onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })} />
                <Button onClick={() => addFaq.mutate()} disabled={!newFaq.question || !newFaq.answer}><Plus className="h-4 w-4" /> Add FAQ</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
