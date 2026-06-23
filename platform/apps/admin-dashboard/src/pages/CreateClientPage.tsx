import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function CreateClientPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showTwilioToken, setShowTwilioToken] = useState(false);

  const [form, setForm] = useState({
    name: '',
    business_type: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
    owner_phone: '',
    planSlug: 'professional',
    locationName: 'Main Location',
    vapi_phone_number_id: '',
    vapi_phone_number_display: '',
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_sms_from: '',
    calendar_id: '',
  });

  const mutation = useMutation({
    mutationFn: () =>
      adminApi.createClient({
        name: form.name,
        business_type: form.business_type || undefined,
        ownerName: form.ownerName,
        ownerEmail: form.ownerEmail,
        ownerPassword: form.ownerPassword,
        owner_phone: form.owner_phone || undefined,
        planSlug: form.planSlug,
        location: {
          name: form.locationName,
          vapi_phone_number_id: form.vapi_phone_number_id || undefined,
          vapi_phone_number_display: form.vapi_phone_number_display || undefined,
          twilio_account_sid: form.twilio_account_sid || undefined,
          twilio_auth_token: form.twilio_auth_token || undefined,
          twilio_sms_from: form.twilio_sms_from || undefined,
          calendar_id: form.calendar_id || undefined,
        },
      }),
    onSuccess: (data) => {
      setCredentials(data.ownerLogin);
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to create client'),
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  if (credentials) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Client Created</CardTitle>
            <CardDescription>Share these login credentials with the business owner</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-muted p-4 font-mono text-sm">
              <p>Email: {credentials.email}</p>
              <p>Password: {credentials.password}</p>
            </div>
            <Button onClick={() => navigate('/clients')}>Go to Clients</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/clients">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Onboard New Client</h1>
          <p className="text-muted-foreground">Create business account, login, and trial subscription</p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          mutation.mutate();
        }}
        className="space-y-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>Business Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Business Name *</Label>
              <Input value={form.name} onChange={(e) => update('name', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Business Type</Label>
              <Input
                value={form.business_type}
                onChange={(e) => update('business_type', e.target.value)}
                placeholder="Salon, Dental, etc."
              />
            </div>
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={form.planSlug} onValueChange={(v) => update('planSlug', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter — $99/mo</SelectItem>
                  <SelectItem value="professional">Professional — $199/mo</SelectItem>
                  <SelectItem value="enterprise">Enterprise — $499/mo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Owner Login</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Owner Name</Label>
              <Input value={form.ownerName} onChange={(e) => update('ownerName', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Owner Phone</Label>
              <Input value={form.owner_phone} onChange={(e) => update('owner_phone', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.ownerEmail}
                onChange={(e) => update('ownerEmail', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Temporary Password *</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={form.ownerPassword}
                  onChange={(e) => update('ownerPassword', e.target.value)}
                  minLength={8}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Location & Integrations</CardTitle>
            <CardDescription>Phone, Vapi, Twilio, and calendar configuration</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Location Name</Label>
              <Input value={form.locationName} onChange={(e) => update('locationName', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Vapi Phone Number ID</Label>
              <Input
                value={form.vapi_phone_number_id}
                onChange={(e) => update('vapi_phone_number_id', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Display Phone</Label>
              <Input
                value={form.vapi_phone_number_display}
                onChange={(e) => update('vapi_phone_number_display', e.target.value)}
                placeholder="+1 424 555 0100"
              />
            </div>
            <div className="space-y-2">
              <Label>Twilio Account SID</Label>
              <Input
                value={form.twilio_account_sid}
                onChange={(e) => update('twilio_account_sid', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Twilio Auth Token</Label>
              <div className="relative">
                <Input
                  type={showTwilioToken ? 'text' : 'password'}
                  value={form.twilio_auth_token}
                  onChange={(e) => update('twilio_auth_token', e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowTwilioToken(!showTwilioToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showTwilioToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Twilio SMS From</Label>
              <Input value={form.twilio_sms_from} onChange={(e) => update('twilio_sms_from', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Google Calendar ID</Label>
              <Input value={form.calendar_id} onChange={(e) => update('calendar_id', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={mutation.isPending} className="w-full sm:w-auto">
          {mutation.isPending ? 'Creating…' : 'Create Client'}
        </Button>
      </form>
    </div>
  );
}
