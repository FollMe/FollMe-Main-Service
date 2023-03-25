import { Controller, Post, UseGuards, HttpCode, Body } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProfileService } from './profile.service';
import { GetProfilesDTO } from './dtos/getProfiles.dto';

@Controller('api/profiles')
export class UserController {
  constructor(
    private readonly profileService: ProfileService,
  ) { }

  @Post('get')
  @HttpCode(200)
  @UseGuards(AuthGuard("jwt"))
  async getUserProfiles(
    @Body() body: GetProfilesDTO,
  ) {
    const profiles = await this.profileService.getProfiles(body.ids);
    return {
      profiles
    }
  }
}
