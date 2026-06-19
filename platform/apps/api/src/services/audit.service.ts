import { supabaseAdmin } from '../lib/supabase';
import type { AuditActorType } from '@platform/shared-types';

interface AuditParams {
  businessId?: string | null;
  actorUserId?: string | null;
  actorType: AuditActorType;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      business_id: params.businessId ?? null,
      actor_user_id: params.actorUserId ?? null,
      actor_type: params.actorType,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId ?? null,
      metadata: params.metadata ?? {},
      ip_address: params.ipAddress ?? null,
    });
  } catch (err) {
    console.error('[Audit] Failed to write audit log:', err);
  }
}
