import { CloudinaryService } from './cloudinary.service';
export declare class UploadsController {
    private cloud;
    constructor(cloud: CloudinaryService);
    uploadDoc(file: any): Promise<{
        url: any;
        publicId: any;
    }>;
}
