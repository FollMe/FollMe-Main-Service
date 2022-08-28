import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt'
import { User, UserDocument } from '../schemas/user.schema';

const SALT_ROUNDS = 10;


@Injectable()
export class UserService {
    constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) { }

    async store(email: string, password: string) {
        const hash = bcrypt.hashSync(password, SALT_ROUNDS);
        const user = new this.userModel({
            email,
            password: hash,
            slEmail: email.substring(0, email.indexOf('@'))
        });
        return await user.save();
    }
}
