import { OrderItemDto } from './order-item.dto';
export declare class CreateOrderDto {
    items: OrderItemDto[];
    address: string;
    pharmacyId?: number;
    prescriptionId?: number;
    pickupLat?: number;
    pickupLon?: number;
    customerLat?: number;
    customerLng?: number;
}
