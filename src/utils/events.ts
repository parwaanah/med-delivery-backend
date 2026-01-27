// Centralized WS/notification event contract (Phase 1 freeze)
export const WS_EVENTS = {
  // User lifecycle
  USER_APPROVED: 'user.approved',
  USER_REJECTED: 'user.rejected',
  USER_STATUS: 'user.status',

  // Rider
  RIDER_AVAILABILITY: 'rider.availability',
  ORDER_OFFER: 'order.offer',

  // Orders
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_CANCELED: 'order.canceled',
  ORDER_ASSIGNED: 'order.assigned',
  ORDER_STATUS_UPDATE: 'order_status_update',
  ORDER_NEEDS_CONFIRMATION: 'order_needs_confirmation',
  ORDER_READY: 'order_ready',

  // Rider stage
  RIDER_ARRIVED: 'rider.arrived',

  // Payments
  PAYMENT_REQUESTED: 'payment.requested',
  PAYMENT_CAPTURED: 'payment.captured',
  PAYMENT_REFUNDED: 'payment.refunded',

  // Support
  SUPPORT_TICKET_CREATED: 'support.ticket.created',
  SUPPORT_TICKET_UPDATED: 'support.ticket.updated',
  SUPPORT_MESSAGE_NEW: 'support.message.new',

  // Refunds
  REFUND_APPROVED: 'refund.approved',
  REFUND_REJECTED: 'refund.rejected',

  // Notifications
  NOTIFICATION_NEW: 'notification.new',
} as const;

export type WsEventName = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

