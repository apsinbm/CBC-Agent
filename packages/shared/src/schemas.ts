import { z } from 'zod';

// Base event envelope
export const EventEnvelopeSchema = z.object({
  app_id: z.literal('CBC-Agent'),
  schema_version: z.string().default('1.0.0'),
  event_type: z.string(),
  ts: z.string().datetime(),
  session_id: z.string(),
  guest_pseudonymous_id: z.string(),
  device: z.object({
    type: z.enum(['desktop', 'mobile', 'tablet']),
    os: z.string(),
    browser: z.string().optional()
  }),
  app_version: z.string(),
  consent_flags: z.object({
    analytics: z.boolean(),
    marketing: z.boolean().optional(),
    functional: z.boolean().default(true)
  }),
  ip_raw: z.string().optional() // Will be processed and discarded
});

// Privacy-safe IP data
export const IPDataSchema = z.object({
  ip_trunc: z.string(), // /24 for IPv4, /48 for IPv6
  ip_hash: z.string(),   // HMAC-SHA256 with rotating salt
  geo_country: z.string().optional(),
  geo_region: z.string().optional(),
  geo_city: z.string().optional()
});

// Entities
export const GuestEntitySchema = z.object({
  pseudonymous_id: z.string(),
  consent_given: z.boolean(),
  consent_purposes: z.array(z.string()),
  created_at: z.string().datetime(),
  locale: z.string().optional(),
  device_type: z.enum(['desktop', 'mobile', 'tablet']),
  app_version: z.string(),
  membership_tier: z.enum(['member', 'guest', 'vip']).nullable(),
  marketing_opt_in: z.boolean().default(false)
});

export const GuestProfileOptionalSchema = z.object({
  guest_id: z.string(),
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  country: z.string().optional(),
  member_id: z.string().nullable(),
  preferred_contact_method: z.enum(['email', 'phone', 'sms', 'whatsapp']).optional(),
  updated_at: z.string().datetime()
});

export const SessionEntitySchema = z.object({
  session_id: z.string(),
  guest_id: z.string(),
  channel: z.enum(['web', 'app', 'whatsapp', 'sms']),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().nullable(),
  duration_ms: z.number().nullable(),
  entry_point: z.string(),
  pages_viewed: z.number().default(0),
  device_type: z.enum(['desktop', 'mobile', 'tablet']),
  os: z.string(),
  app_version: z.string(),
  geo_country: z.string().optional(),
  geo_region: z.string().optional(),
  geo_city: z.string().optional(),
  ip_trunc: z.string(),
  ip_hash: z.string()
});

export const FAQArticleSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  category: z.string(),
  published_at: z.string().datetime(),
  last_updated_at: z.string().datetime()
});

export const ServiceRequestSchema = z.object({
  id: z.string(),
  guest_id: z.string(),
  channel: z.enum(['web', 'app', 'whatsapp', 'sms', 'phone', 'email']),
  category: z.enum(['housekeeping', 'maintenance', 'dining', 'spa', 'tennis', 'transport', 'it', 'other']),
  subcategory: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed', 'cancelled']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  created_at: z.string().datetime(),
  closed_at: z.string().datetime().nullable(),
  sla_breached: z.boolean().default(false),
  tags: z.array(z.string()).default([])
});

export const ChatSessionSchema = z.object({
  id: z.string(),
  guest_id: z.string(),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().nullable(),
  locale: z.string().optional(),
  resolved: z.boolean().default(false),
  handoff_to_agent: z.boolean().default(false),
  csat: z.number().min(1).max(5).nullable()
});

export const ChatMessageSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  sender: z.enum(['guest', 'agent', 'bot']),
  ts: z.string().datetime(),
  text_redacted: z.string(), // PII removed
  intent: z.string().optional(),
  entities: z.array(z.string()).default([]),
  tokens: z.number().optional()
});

// Events
export const PageViewEventSchema = z.object({
  ts: z.string().datetime(),
  session_id: z.string(),
  guest_id: z.string(),
  path: z.string(),
  ms_on_page: z.number(),
  referrer: z.string().optional()
});

export const SearchEventSchema = z.object({
  ts: z.string().datetime(),
  guest_id: z.string(),
  query_redacted: z.string(),
  results_count: z.number(),
  clicked_faq_id: z.string().nullable(),
  zero_result: z.boolean()
});

export const FAQViewEventSchema = z.object({
  ts: z.string().datetime(),
  guest_id: z.string(),
  faq_id: z.string(),
  dwell_ms: z.number(),
  from_search: z.boolean(),
  helpful_vote: z.boolean().nullable()
});

export const ChatStartEventSchema = z.object({
  ts: z.string().datetime(),
  chat_session_id: z.string(),
  guest_id: z.string(),
  entrypoint: z.string(),
  intent_initial: z.string().optional()
});

export const ChatEndEventSchema = z.object({
  ts: z.string().datetime(),
  chat_session_id: z.string(),
  resolved: z.boolean(),
  handoff_to_agent: z.boolean(),
  csat: z.number().min(1).max(5).nullable()
});

export const ServiceRequestCreatedEventSchema = z.object({
  ts: z.string().datetime(),
  request_id: z.string(),
  guest_id: z.string(),
  category: z.enum(['housekeeping', 'maintenance', 'dining', 'spa', 'tennis', 'transport', 'it', 'other']),
  subcategory: z.string().optional(),
  source: z.string()
});

export const ServiceRequestStatusChangeEventSchema = z.object({
  ts: z.string().datetime(),
  request_id: z.string(),
  old_status: z.string(),
  new_status: z.string(),
  ts_change: z.string().datetime()
});

export const PreferenceSignalEventSchema = z.object({
  ts: z.string().datetime(),
  guest_id: z.string(),
  key: z.string(),
  value: z.string(),
  weight: z.number().min(0).max(1),
  source: z.enum(['choice', 'search', 'click'])
});

export const SelectionEventSchema = z.object({
  ts: z.string().datetime(),
  guest_id: z.string(),
  selection_type: z.enum(['dining', 'spa', 'tennis', 'transport', 'activity', 'faq']),
  selection_value: z.string(),
  context: z.string().optional(),
  path: z.string()
});

export const ConsentChangeEventSchema = z.object({
  ts: z.string().datetime(),
  guest_id: z.string(),
  consent_given: z.boolean(),
  purposes: z.array(z.string())
});

// Combined event type
export const AnalyticsEventSchema = z.discriminatedUnion('event_type', [
  PageViewEventSchema.extend({ event_type: z.literal('page_view') }),
  SearchEventSchema.extend({ event_type: z.literal('search') }),
  FAQViewEventSchema.extend({ event_type: z.literal('faq_view') }),
  ChatStartEventSchema.extend({ event_type: z.literal('chat_start') }),
  ChatEndEventSchema.extend({ event_type: z.literal('chat_end') }),
  ServiceRequestCreatedEventSchema.extend({ event_type: z.literal('service_request_created') }),
  ServiceRequestStatusChangeEventSchema.extend({ event_type: z.literal('service_request_status_change') }),
  PreferenceSignalEventSchema.extend({ event_type: z.literal('preference_signal') }),
  SelectionEventSchema.extend({ event_type: z.literal('selection') }),
  ConsentChangeEventSchema.extend({ event_type: z.literal('consent_change') })
]);

// Webhook payload with HMAC
export const WebhookPayloadSchema = z.object({
  timestamp: z.string().datetime(),
  signature: z.string(),
  payload: z.any()
});

// Types
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
export type IPData = z.infer<typeof IPDataSchema>;
export type GuestEntity = z.infer<typeof GuestEntitySchema>;
export type GuestProfileOptional = z.infer<typeof GuestProfileOptionalSchema>;
export type SessionEntity = z.infer<typeof SessionEntitySchema>;
export type FAQArticle = z.infer<typeof FAQArticleSchema>;
export type ServiceRequest = z.infer<typeof ServiceRequestSchema>;
export type ChatSession = z.infer<typeof ChatSessionSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;