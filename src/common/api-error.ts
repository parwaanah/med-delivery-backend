import { BadRequestException } from '@nestjs/common';

export type ApiErrorCode =
  | 'COUPON_INVALID'
  | 'COUPON_NOT_STARTED'
  | 'COUPON_EXPIRED'
  | 'COUPON_MIN_ORDER'
  | 'COUPON_USAGE_LIMIT'
  | 'COUPON_PER_USER_LIMIT'
  | 'STOCK_OUT'
  | 'STOCK_INSUFFICIENT'
  | 'CART_MAX_QTY'
  | 'PAYMENT_NOT_REQUESTED'
  | 'PAYMENT_REQUEST_EXPIRED'
  | 'TERMS_REQUIRED'
  | 'ORDER_STATUS_INVALID';

export function badRequest(code: ApiErrorCode, message: string, meta?: Record<string, any>): never {
  throw new BadRequestException({ code, message, meta: meta || {} });
}
