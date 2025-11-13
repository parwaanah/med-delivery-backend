export declare class OrderItemDto {
    medicineId?: number;
    name: string;
    quantity: number;
    price: number;
}
export declare class CreateOrderDto {
    items: OrderItemDto[];
    pharmacyId?: number;
    pickupLat?: number;
    pickupLon?: number;
}
