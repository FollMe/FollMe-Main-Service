import * as path from 'path';
import * as fs from 'fs';
import { randomInt } from 'crypto';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import FB from 'fb';
import * as bcrypt from 'bcrypt'
import Handlebars from 'handlebars';
import { User, UserDocument } from './schemas/user.schema';
import { UserService } from './services/user.service';
import { MailerService } from 'src/sharedServices/mailer.service';
import { CacheService } from 'src/sharedServices/cache.service';

const CODE_DURATION = 5 * 60;
// One code per email per minute: the endpoint is public and sends mail.
const CODE_RESEND_COOLDOWN = 60;
// Wrong guesses allowed before the code is thrown away.
const MAX_CODE_ATTEMPTS = 5;

/** Emails are compared case-insensitively and without stray spaces. */
export function normalizeEmail(email: string) {
    return String(email ?? '').trim().toLowerCase();
}
const templateStr = fs.readFileSync(path.resolve(process.cwd(), 'src/templates/sendCodeEmail.template.hbs')).toString('utf8')
const template = Handlebars.compile(templateStr);

@Injectable()
export class AuthService {
    constructor(
        @InjectModel(User.name)
        private userModel: Model<UserDocument>,
        private userService: UserService,
        private mailerService: MailerService,
        private cacheService: CacheService,
    ) { }

    async checkCredential(email: string, password: string) {
        // Older accounts kept the email as typed; newer ones are lowercase.
        const user = await this.userModel.findOne({ email: { $in: [email, normalizeEmail(email)] } }).exec();

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

    async generateCertifyCode(rawEmail: string) {
        const email = normalizeEmail(rawEmail);

        // Check whether exist account with this email
        const isExistUserWithEmail = await this.userModel.exists({ email }).exec();
        if (isExistUserWithEmail) {
            throw new HttpException("Email này đã được sử dụng", HttpStatus.BAD_REQUEST);
        }

        const canSend = await this.cacheService.setIfAbsent(`certifyCodeSent:${email}`, 1, CODE_RESEND_COOLDOWN);
        if (!canSend) {
            throw new HttpException("Mã vừa được gửi, vui lòng kiểm tra email hoặc thử lại sau 1 phút", HttpStatus.TOO_MANY_REQUESTS);
        }

        // Generate new code & save to redis
        const code = randomInt(100000, 1000000);
        await this.cacheService.set(`certifyCodes:${email}`, code, CODE_DURATION);
        await this.cacheService.del(false, `certifyCodeAttempts:${email}`);

        await this.mailerService.sendMail({
            from: '"FollMe " <follme.noreply@gmail.com>',
            to: email,
            subject: 'Mã xác thực cho FollMe',
            html: template({ code })
        })
    }

    async signUp(credentials: { email: string, code: string | number, password: string }) {
        const email = normalizeEmail(credentials.email);
        const code = String(credentials.code ?? '').trim();
        const cachedCode = await this.cacheService.get(`certifyCodes:${email}`);
        if (!cachedCode || cachedCode !== code) {
            if (cachedCode) {
                const attempts = await this.cacheService.incr(`certifyCodeAttempts:${email}`, CODE_DURATION);
                if (attempts >= MAX_CODE_ATTEMPTS) {
                    await this.cacheService.del(false, `certifyCodes:${email}`);
                    throw new HttpException("Nhập sai quá nhiều lần, vui lòng lấy mã mới", HttpStatus.BAD_REQUEST);
                }
            }
            throw new HttpException("Mã xác thực không chính xác", HttpStatus.BAD_REQUEST);
        }

        // The email may have been taken (e.g. by Google sign-in) since the code was sent.
        if (await this.userModel.exists({ email }).exec()) {
            throw new HttpException("Email này đã được sử dụng", HttpStatus.BAD_REQUEST);
        }

        await this.userService.store(email, credentials.password);
        await this.cacheService.del(true, `certifyCodes:${email}`);
    }
}
