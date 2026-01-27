export declare class ManualOrderItemPriceDto {
    orderItemId: number;
    price: number;
    note?: string;
}
export declare class PharmacyAcceptDto {
    totalPrice?: number;
    manualItems?: ManualOrderItemPriceDto[];
}
