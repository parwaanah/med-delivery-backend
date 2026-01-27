import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  Headers,
  HttpCode,
  HttpStatus,
  Get,
  Param,
  BadRequestException,
  NotFoundException,
  UseGuards,
} from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { RazorpayService } from "./razorpay.service";
import { PrismaService } from "../utils/prisma.service";
import { Request, Response } from "express";
import { CreateIntentDto } from "./dto/create-intent.dto";
import { RefundDto } from "./dto/refund.dto";

import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@Controller("payments")
export class PaymentsController {
  constructor(
    private paymentsService: PaymentsService,
    private rzpService: RazorpayService,
    private prisma: PrismaService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @Post("create-intent")
  async createIntent(@Req() req: any, @Body() body: CreateIntentDto) {
    const orderId = Number(body.orderId);
    if (isNaN(orderId)) throw new BadRequestException("Invalid orderId");
    return this.paymentsService.createPaymentForOrder(orderId, Number(req.user?.id));
  }

  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers("x-razorpay-signature") signature: string,
  ) {
    try {
      const raw = (req as any).rawBody as Buffer;
      if (!raw) return res.status(400).send("raw body missing");

      const valid = this.rzpService.verifyWebhookSignature(raw, signature);
      if (!valid) return res.status(400).send("invalid signature");

      const json = JSON.parse(raw.toString("utf8"));
      await this.paymentsService.handleWebhookEvent(json);
      return res.status(200).send("ok");
    } catch {
      return res.status(500).send("error");
    }
  }

  // ADMIN REFUND
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post("refund")
  async refund(@Req() req: any, @Body() dto: RefundDto) {
    return this.paymentsService.refundTransaction(
      dto.transactionId,
      dto.amount,
      req.user?.id,
    );
  }

  // ✅ ADMIN LIST (guarded)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get("admin/list")
  async adminList() {
    return this.paymentsService.listTransactions();
  }

  // ✅ ADMIN: transactions by order (guarded)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get("by-order/:orderId")
  async byOrder(@Param("orderId") orderId: string) {
    const idNum = Number(orderId);
    if (isNaN(idNum)) return [];
    return this.prisma.transaction.findMany({
      where: { orderId: idNum },
      orderBy: { createdAt: "desc" },
    });
  }

  // DEV: customer marks an order as paid (fake payment) for development/testing.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @Post("dev/pay-order")
  async devPayOrder(@Req() req: any, @Body() body: { orderId: number }) {
    const devEnabled =
      String(process.env.PAYMENTS_DEV_MODE || "").toLowerCase() === "true" ||
      String(process.env.NODE_ENV || "").toLowerCase() !== "production";
    if (!devEnabled) {
      throw new NotFoundException();
    }
    const orderId = Number(body?.orderId);
    if (!Number.isFinite(orderId)) throw new BadRequestException("Invalid orderId");
    return this.paymentsService.devCaptureOrder(orderId, Number(req.user?.id));
  }

  // ADMIN: reconcile payment state for an order
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post("admin/reconcile")
  async reconcile(@Req() req: any, @Body() body: { orderId: number }) {
    const orderId = Number(body?.orderId);
    if (!Number.isFinite(orderId)) throw new BadRequestException("Invalid orderId");
    return this.paymentsService.reconcileOrderPayment(orderId, Number(req.user?.id));
  }
}
