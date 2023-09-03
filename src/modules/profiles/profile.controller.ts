import { Controller, Post, HttpCode, Body } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { GetProfilesDTO } from './dtos/getProfiles.dto';

@Controller('api/profiles')
export class UserController {
  constructor(
    private readonly profileService: ProfileService,
  ) { }

  @Post('get')
  @HttpCode(200)
  async getUserProfiles(
    @Body() body: GetProfilesDTO,
  ) {
    const profiles = await this.profileService.getProfiles(body.ids);
    return {
      profiles
    }
  }
}
