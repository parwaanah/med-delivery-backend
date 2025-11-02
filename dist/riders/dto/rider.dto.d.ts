export declare class CreateRiderDto {
    name: string;
    email: string;
    password: string;
}
export declare class UpdateRiderDto {
    name?: string;
    email?: string;
}
export declare class UpdateStatusDto {
    status: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
}
