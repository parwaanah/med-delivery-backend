import Razorpay from "razorpay";
import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { RedisService } from "../utils/redis.service";

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly client?: Razorpay;
  private readonly enabled: boolean;

  constructor(private readonly redis: RedisService) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const enabledFlag = String(process.env.RAZORPAY_ENABLED ?? "").toLowerCase();

    // Razorpay enabled only if keys are present and not explicitly disabled.
    this.enabled = Boolean(keyId && keySecret) && enabledFlag !== "false";

    if (this.enabled) {
      this.client = new Razorpay({
        key_id: keyId!,
        key_secret: keySecret!,
      });
      this.logger.log("Razorpay client initialized");
    } else {
      this.logger.warn("Razorpay disabled - missing keys or RAZORPAY_ENABLED=false");
    }
  }

  isEnabled() {
    return this.enabled && Boolean(this.client);
  }

  async createOrder(amountInPaise: number, currency = "INR", receipt?: string) {
    // Never call Razorpay without keys.
    if (!this.enabled || !this.client) {
      this.logger.warn("Razorpay createOrder skipped (disabled)");
      throw new BadRequestException("Payment gateway not configured");
    }

    try {
      await this.beforeCall("razorpay", 5, 30_000);
      const opts = {
        amount: amountInPaise,
        currency,
        receipt: receipt ?? `receipt_${Date.now()}`,
        payment_capture: 1,
      };

      const order = await this.client.orders.create(opts as any);
      await this.onSuccess("razorpay");
      this.logger.log(`Razorpay order created ${order?.id}`);
      return order as any;
    } catch (err: any) {
      await this.onFailure("razorpay");
      this.logger.error("Razorpay createOrder failed", err?.message || err);
      throw new BadRequestException("Razorpay authentication failed");
    }
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string, secret?: string) {
    const webhookSecret = secret ?? process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      this.logger.warn("Razorpay webhook secret not set");
      return false;
    }

    const crypto = require("crypto");
    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    return expected === signature;
  }

  async refundPayment(paymentId: string, amountInPaise?: number) {
    if (!this.enabled || !this.client) {
      this.logger.warn("Razorpay refund skipped (disabled)");
      return { mock: true, refunded: true };
    }

    try {
      await this.beforeCall("razorpay", 5, 30_000);
      const payload: any = amountInPaise ? { amount: amountInPaise } : {};
      const res = await this.client.payments.refund(paymentId, payload);
      await this.onSuccess("razorpay");
      return res;
    } catch (e) {
      await this.onFailure("razorpay");
      throw e;
    }
  }

  private key(name: string) {
    return `cb:${name}`;
  }

  private async beforeCall(name: string, failThreshold: number, openMs: number) {
    const raw = await this.redis.client.get(this.key(name));
    if (!raw) return;
    try {
      const st = JSON.parse(raw);
      if (st?.state === "OPEN" && typeof st?.openUntil === "number") {
        if (Date.now() < st.openUntil) {
          throw new BadRequestException("Payment gateway temporarily unavailable");
        }
      }
      // allow call (half-open) after openUntil expires
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      // ignore malformed
    }
  }

  private async onSuccess(name: string) {
    try {
      await this.redis.client.del(this.key(name));
    } catch {}
  }

  private async onFailure(name: string) {
    const k = this.key(name);
    const failThreshold = Number(process.env.CB_RAZORPAY_FAILS ?? 5);
    const openMs = Number(process.env.CB_RAZORPAY_OPEN_MS ?? 30_000);
    try {
      const raw = await this.redis.client.get(k);
      const cur = raw ? JSON.parse(raw) : {};
      const fails = Number(cur?.fails ?? 0) + 1;
      const state = fails >= failThreshold ? "OPEN" : String(cur?.state || "CLOSED");
      const openUntil = state === "OPEN" ? Date.now() + Math.max(1000, openMs) : undefined;
      await this.redis.client.set(
        k,
        JSON.stringify({ state, fails, openUntil }),
        { PX: Math.max(1000, openMs) },
      );
    } catch {}
  }
}
