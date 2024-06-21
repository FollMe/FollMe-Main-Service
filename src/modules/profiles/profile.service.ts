import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserDocument, User } from '../auth/schemas/user.schema';
import { removeAccent } from 'src/utils/removeAccent';
import { CacheService } from 'src/sharedServices/cache.service';

const CACHED_PROFILE_DURATION = 30 * 60;

@Injectable()
export class ProfileService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private cachedService: CacheService,
  ) { }

  async getProfilesById(userIds: string[]) {
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

  async getProfilesByPartName(partName: string) {
    const searchString = partName.toLowerCase();
    let allProfiles = <UserDocument[]><any>await this.cachedService.getJSON("profiles");

    if (!allProfiles) {
      allProfiles = await this.userModel.find({ isDeleted: { $ne: true } })
        .select('_id name slEmail avatar')
        .lean();

      allProfiles.forEach(profile =>
        profile.slug = removeAccent(profile.name ?? profile.slEmail)
      );

      this.cachedService.setJSON("profiles", allProfiles, CACHED_PROFILE_DURATION);
    }

    const matchedProfiles = [];
    for (const profile of allProfiles) {
      if (profile.slug.includes(searchString)) {
        matchedProfiles.push({
          ...profile,
          slug: undefined,
        })
        if (matchedProfiles.length >= 4) {
          break;
        }
      }
    }

    return matchedProfiles;
  }

}
