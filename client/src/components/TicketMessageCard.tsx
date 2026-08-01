import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatDateTime } from '@/lib/format'
import { MESSAGE_TYPE_LABEL } from '@/lib/ticketMeta'
import type { TicketMessage } from '@/pages/TicketDetailPage'

// One entry in a ticket's message thread: sender, timestamp, a type badge
// (inbound / agent reply / AI draft), and the body. Rendered as a Card so each
// message reads as a distinct block, set apart from the plain page header above.
export function TicketMessageCard({ message }: { message: TicketMessage }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{message.fromEmail}</CardTitle>
        <CardDescription>{formatDateTime(message.createdAt)}</CardDescription>
        <CardAction>
          <Badge variant="outline">{MESSAGE_TYPE_LABEL[message.type]}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-sm whitespace-pre-wrap">{message.body}</p>
      </CardContent>
    </Card>
  )
}
