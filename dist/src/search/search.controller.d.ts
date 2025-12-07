import { SearchService } from "./search.service";
export declare class SearchController {
    private readonly searchService;
    constructor(searchService: SearchService);
    search(query: string): Promise<{
        id: number;
        name: string;
        category: import(".prisma/client").$Enums.MedicineCategory;
        rxType: import(".prisma/client").$Enums.PrescriptionType;
        price: number | import("@prisma/client/runtime/library").Decimal;
        stock: number;
        pharmacy: {
            name: string;
            id: number;
            latitude: number | null;
            longitude: number | null;
        } | null;
    }[]>;
}
