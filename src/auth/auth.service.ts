import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import FB from 'fb';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class AuthService {
    constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) { }
    getHello(): string {
        return 'Oauth with Facebook';
    }

    async getUserFBInfo(fbAccessToken: string) {
        const profile = await FB.api('me', { fields: ['id', 'name', 'picture.type(large)'], access_token: fbAccessToken });
        return profile;
    }

    async findAll(): Promise<User[]> {
        return this.userModel.find().exec();
    }

    async findOrCreateFbAccount(profile: any) {
        const { id, name, picture } = profile;
        var user = await this.userModel.findOne({ fbId: id }).exec();
        const avatar = { link: picture?.data?.url };

        if (!user) {
            user = new this.userModel({ fbId: id, name, avatar, slEmail: name })
            await user.save();
        } else {
            // Update picture link (because it's expiry so short)
            await user.updateOne({ avatar }).exec();
        }
        
        return user;
    }
}
