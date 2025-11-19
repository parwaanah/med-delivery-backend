export declare class CreateRiderDto {
    name: string;
    email: string;
    password: string;
    latitude?: number;
    longitude?: number;
}
export declare class UpdateRiderDto {
    name?: string;
    email?: string;
    latitude?: number;
    longitude?: number;
}
export declare class UpdateStatusDto {
    status: string;
}
export declare class UpdateLocationDto {
    latitude?: number;
    longitude?: number;
    lat?: number;
    lon?: number;
}
