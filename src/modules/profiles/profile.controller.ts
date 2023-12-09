import { Controller, Get, Post, HttpCode, Body, Query } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { GetProfilesDTO } from './dtos/getProfiles.dto';

@Controller('api/profiles')
export class UserController {
  constructor(
    private readonly profileService: ProfileService,
  ) { }

  @Post('get')
  @HttpCode(200)
  async getUserProfilesById(
    @Body() body: GetProfilesDTO,
  ) {
    const profiles = await this.profileService.getProfilesById(body.ids);
    return {
      profiles
    }
  }

  @Get('/')
  async getUserProfileByPartName(@Query('q') q) {
    if (!q) {
      return {
        profiles: []
      }
    }

    const profiles = await this.profileService.getProfilesByPartName(q);
    return {
      profiles
    }
  }
}
