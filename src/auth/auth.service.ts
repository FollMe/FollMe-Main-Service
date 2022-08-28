import * as path from 'path';
import * as fs from 'fs';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import FB from 'fb';
import * as bcrypt from 'bcrypt'
import Handlebars from 'handlebars';
import { User, UserDocument } from './schemas/user.schema';
import { CertifyCode, CertifyCodeDocument } from './schemas/certifyCode.schema';
import { UserService } from './services/user.service';
import { CertifyCodeService } from './services/certifyCode.service';
import { MailerService } from 'src/sharedServices/mailer.service';

const templateStr = fs.readFileSync(path.resolve(process.cwd(), 'src/templates/sendCodeEmail.template.hbs')).toString('utf8')
const template = Handlebars.compile(templateStr);

@Injectable()
export class AuthService {
    constructor(
        @InjectModel(User.name)
        private userModel: Model<UserDocument>,
        @InjectModel(CertifyCode.name)
        private certifyCodeModel: Model<CertifyCodeDocument>,
        private userService: UserService,
        private certifyCodeService: CertifyCodeService,
        private mailerService: MailerService
    ) { }

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

    async generateCertifyCode(email: string) {

        // Check whether exist account with this email
        const isExistUserWithEmail = await this.userModel.exists({ email }).exec();
        if (isExistUserWithEmail) {
            throw new HttpException("Email này đã được sử dụng", HttpStatus.BAD_REQUEST);
        }

        // Generate new code & save to DB
        const code = Math.floor(100000 + Math.random() * 900000);
        await this.certifyCodeModel.deleteOne({ email }).exec();
        const certifyCode = await this.certifyCodeService.store(email, code);

        await this.mailerService.sendMail({
            from: '"FollMe " <follme.noreply@gmail.com>',
            to: email,
            subject: 'Mã xác thực cho FollMe',
            html: template({ code: certifyCode.code })
        })
    }

    async signUp(credentials) {
        const { email, code, password } = credentials;
        const isValid = await this.certifyCodeModel.exists({ email, code, expiredTime: {$gt: Date.now()} });

        if (!isValid) {
            throw new HttpException("Mã xác thực không chính xác", HttpStatus.BAD_REQUEST);
        }

        await this.userService.store(email, password);
        await this.certifyCodeModel.deleteOne({ email });
    }
}
