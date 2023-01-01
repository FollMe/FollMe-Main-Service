import { Injectable } from '@nestjs/common';
import { UploadApiErrorResponse, UploadApiResponse, v2 } from 'cloudinary';
import { Readable } from 'stream';
@Injectable()

export class CloudinaryService {
    private v2 = v2;
    constructor() {
        this.v2.config({
            cloud_name: process.env.CLOUD_NAME,
            api_key: process.env.CLOUD_API_KEY,
            api_secret: process.env.CLOUD_API_SECRET,
        });
    }
    async uploadImage(
        file: Express.Multer.File,
        folder: string
    ): Promise<UploadApiResponse | UploadApiErrorResponse> {

        return new Promise((resolve, reject) => {
            const upload = this.v2.uploader.upload_stream({
                folder
            }, (error, result) => {
                if (error) return reject(error);
                resolve(result);
            });

            Readable.from(file.buffer).pipe(upload);
        });
    }
}
