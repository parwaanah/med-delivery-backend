declare class OrderItemDto {
    medicineId?: number;
    name: string;
    quantity: number;
    price: number;
}
export declare class CreateOrderDto {
    pharmacyId?: number;
    items: OrderItemDto[];
    location?: any;
}
export {};
