import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import FB from 'fb';
import * as bcrypt from 'bcrypt'
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class AuthService {
    constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) { }

    async checkCredential(email: string, password: string) {
        const user = await this.userModel.findOne({ email }).exec();

        if (!user || !user.password) {
            return null;
        }

        if (!bcrypt.compareSync(password, user.password)) {
            return null;
        }
        return user;
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

    async findOrCreateGGAccount(profile: any) {
        const { email, name, picture } = profile;
        const avatar = { link: picture };
        var user = await this.userModel.findOne({ email }).exec();

        if (!user) {
            user = new this.userModel({ email, name, avatar, slEmail: email.substring(0, email.indexOf('@')) });
            await user.save();
        } else {
            // Update information for user if current user do not has
            var isUpdate = false;
            if (!user.name) {
                user.name = name;
                isUpdate = true;
            }
            if (!user.avatar?.link) {
                user.avatar = avatar;
                isUpdate = true;
            }
            if (isUpdate) {
                await user.save();
            }
        }

        return user;
    }
}
