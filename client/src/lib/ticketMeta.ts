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

export const STATUS_VARIANT: Record<
  TicketStatus,
  'default' | 'secondary' | 'outline'
> = {
  [TICKET_STATUS.new]: 'outline',
  [TICKET_STATUS.processing]: 'secondary',
  [TICKET_STATUS.ai_resolved]: 'secondary',
  [TICKET_STATUS.open]: 'default',
  [TICKET_STATUS.resolved]: 'secondary',
  [TICKET_STATUS.closed]: 'outline',
}

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  [TICKET_CATEGORY.general]: 'General Question',
  [TICKET_CATEGORY.technical]: 'Technical Question',
  [TICKET_CATEGORY.refund]: 'Refund Request',
}

export const MESSAGE_TYPE_LABEL: Record<TicketMessageType, string> = {
  [TICKET_MESSAGE_TYPE.inbound]: 'Inbound',
  [TICKET_MESSAGE_TYPE.agent_reply]: 'Agent reply',
  [TICKET_MESSAGE_TYPE.ai_reply]: 'AI reply',
  [TICKET_MESSAGE_TYPE.ai_draft]: 'AI draft',
}
