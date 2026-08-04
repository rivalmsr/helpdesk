// UI presentation for the ticket taxonomy — friendly labels and Badge variants
// for the status/category/message-type enums. Shared by the ticket list and the
// ticket detail page so both render the enums identically. Keys reference the
// `core` constants (the single source of truth) rather than bare strings.
import {
  TICKET_STATUS,
  TICKET_CATEGORY,
  TICKET_MESSAGE_TYPE,
  type TicketStatus,
  type TicketCategory,
  type TicketMessageType,
} from 'core'

export const STATUS_LABEL: Record<TicketStatus, string> = {
  [TICKET_STATUS.new]: 'New',
  [TICKET_STATUS.processing]: 'Processing',
  [TICKET_STATUS.ai_resolved]: 'AI Resolved',
  [TICKET_STATUS.open]: 'Open',
  [TICKET_STATUS.resolved]: 'Resolved',
  [TICKET_STATUS.closed]: 'Closed',
}

// Semantic status colors — the app's status "heartbeat". Each status gets a soft
// tinted pill (`STATUS_BADGE_CLASS`) and a solid leading dot (`STATUS_DOT_CLASS`),
// rendered together by the StatusBadge/CategoryBadge components. Dark mode uses a
// translucent tint + lighter text so contrast holds in both themes. Hues encode
// meaning: slate=new/untouched, amber=AI working, violet=AI-owned, blue=needs a
// human, emerald=solved, zinc=archived.
export const STATUS_BADGE_CLASS: Record<TicketStatus, string> = {
  [TICKET_STATUS.new]:
    'bg-slate-100 text-slate-700 dark:bg-slate-400/10 dark:text-slate-300',
  [TICKET_STATUS.processing]:
    'bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300',
  [TICKET_STATUS.ai_resolved]:
    'bg-violet-100 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300',
  [TICKET_STATUS.open]:
    'bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300',
  [TICKET_STATUS.resolved]:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300',
  [TICKET_STATUS.closed]:
    'bg-zinc-100 text-zinc-600 dark:bg-zinc-400/10 dark:text-zinc-400',
}

export const STATUS_DOT_CLASS: Record<TicketStatus, string> = {
  [TICKET_STATUS.new]: 'bg-slate-500',
  [TICKET_STATUS.processing]: 'bg-amber-500',
  [TICKET_STATUS.ai_resolved]: 'bg-violet-500',
  [TICKET_STATUS.open]: 'bg-blue-600',
  [TICKET_STATUS.resolved]: 'bg-emerald-600',
  [TICKET_STATUS.closed]: 'bg-zinc-400',
}

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  [TICKET_CATEGORY.general]: 'General Question',
  [TICKET_CATEGORY.technical]: 'Technical Question',
  [TICKET_CATEGORY.refund]: 'Refund Request',
}

export const CATEGORY_BADGE_CLASS: Record<TicketCategory, string> = {
  [TICKET_CATEGORY.general]:
    'bg-sky-100 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300',
  [TICKET_CATEGORY.technical]:
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-300',
  [TICKET_CATEGORY.refund]:
    'bg-rose-100 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300',
}

export const CATEGORY_DOT_CLASS: Record<TicketCategory, string> = {
  [TICKET_CATEGORY.general]: 'bg-sky-500',
  [TICKET_CATEGORY.technical]: 'bg-indigo-500',
  [TICKET_CATEGORY.refund]: 'bg-rose-500',
}

export const MESSAGE_TYPE_LABEL: Record<TicketMessageType, string> = {
  [TICKET_MESSAGE_TYPE.inbound]: 'Inbound',
  [TICKET_MESSAGE_TYPE.agent_reply]: 'Agent reply',
  [TICKET_MESSAGE_TYPE.ai_reply]: 'AI reply',
  [TICKET_MESSAGE_TYPE.ai_draft]: 'AI draft',
}

// Left-border accent that color-codes a message by sender, so a thread is
// scannable at a glance: neutral inbound, cobalt for the agent, violet for AI.
export const MESSAGE_ACCENT_CLASS: Record<TicketMessageType, string> = {
  [TICKET_MESSAGE_TYPE.inbound]: 'border-l-slate-300 dark:border-l-slate-600',
  [TICKET_MESSAGE_TYPE.agent_reply]: 'border-l-blue-500',
  [TICKET_MESSAGE_TYPE.ai_reply]: 'border-l-violet-500',
  [TICKET_MESSAGE_TYPE.ai_draft]: 'border-l-violet-300 dark:border-l-violet-700',
}
