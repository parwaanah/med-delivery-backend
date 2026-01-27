export declare class PharmacyAddressDto {
    line1: string;
    city: string;
    pin: string;
}
export declare class PharmacyBankDetailsDto {
    accountName: string;
    accountNumber: string;
    ifsc: string;
    bankName: string;
}
export declare class PharmacyProfileDto {
    pharmacyName: string;
    ownerName: string;
    address: PharmacyAddressDto;
    gstNumber: string;
    drugLicenseNumber: string;
    openingHours: string;
    bankDetails?: PharmacyBankDetailsDto;
}
