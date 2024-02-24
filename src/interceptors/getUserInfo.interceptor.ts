import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Observable } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { User, UserDocument } from '../modules/auth/schemas/user.schema';

@Injectable()
export class GetUserInfoInterceptor implements NestInterceptor {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly jwtService: JwtService
  ) { }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    try {
      const request = context.switchToHttp().getRequest()
      if (!request.user) {
        const jwt = request.headers['authorization']
        if (jwt) {
          const payload = this.jwtService.decode(jwt.replace('Bearer ', ''))
          if (payload.sub) {
            const user = await this.userModel.findOne({ _id: payload.sub });
            if (user) {
              request.user = user
            }
          }
        }
      }
    } finally {
      return next
        .handle()
        .pipe();
    }
  }
}
