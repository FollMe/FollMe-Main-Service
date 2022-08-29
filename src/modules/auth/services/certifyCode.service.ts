import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CertifyCode, CertifyCodeDocument } from '../schemas/certifyCode.schema';

const CODE_DURATION = 5*60*1000;

@Injectable()
export class CertifyCodeService {
    constructor(@InjectModel(CertifyCode.name) private certifyCodeModel: Model<CertifyCodeDocument>) { }

    async store(email: string, code: number) {
        // Lifetime of the code: 5 minutes
        const certifyCode = new this.certifyCodeModel({
            email,
            code,
            expiredTime: Date.now() + CODE_DURATION
        });
        return await certifyCode.save();
    }
}
