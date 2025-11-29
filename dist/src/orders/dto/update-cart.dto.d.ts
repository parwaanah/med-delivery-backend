export declare class UpdateCartItemDto {
    medicineId: number;
    quantity: number;
}
export declare class UpdateCartDto {
    orderId: number;
    items: UpdateCartItemDto[];
}
