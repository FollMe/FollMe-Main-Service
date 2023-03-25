import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserDocument, User } from '../auth/schemas/user.schema';

@Injectable()
export class ProfileService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) { }

  async getProfiles(userIds: string[]) {
    const uniqueUserIds = [...userIds]
    const users = await this.userModel.find({
      _id: { $in: uniqueUserIds },
      isDeleted: { $ne: true },
    }).select('_id name slEmail avatar')
    const profiles = {}
    users.forEach(user => {
      profiles[user._id.toString()] = user
    })
    return profiles
  }
}
