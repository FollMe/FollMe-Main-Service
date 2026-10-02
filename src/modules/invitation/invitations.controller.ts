import {
  Body, Controller, Get, Request, Post, Put, Delete, UseGuards, Param, Query, UseInterceptors, UploadedFile,
  ParseFilePipe, FileTypeValidator, BadRequestException, Headers,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FileInterceptor } from '@nestjs/platform-express';
import { InvitationsService } from './invitations.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateInvitationDTO } from './dtos/createInvitation.dto';
import { UpdateInvitationDTO } from './dtos/updateInvitation.dto';
import { PublicRsvpDTO, RsvpDTO } from './dtos/rsvp.dto';
import { WishDTO } from './dtos/wish.dto';
import { PhotoOrderDTO } from './dtos/photo.dto';
import { UpdateGuestDTO } from './dtos/updateGuest.dto';
import { MAX_PHOTO_BYTES } from './invitation.constants';

const photoPipe = new ParseFilePipe({
  validators: [new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ })],
  exceptionFactory: (error) => new BadRequestException(
    error === 'File is required' ? 'Vui lòng chọn ảnh' : 'Chỉ nhận ảnh JPG, PNG hoặc WebP',
  ),
});

@Controller('api')
export class invitationsController {
  constructor(
    private readonly invitationsService: InvitationsService,
    private readonly jwtService: JwtService,
  ) { }

  /** The signed-in user on a public route, if any (the token is optional there). */
  private viewerId(authorization?: string): string | undefined {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    if (!token || token === 'null' || token === 'undefined') {
      return undefined;
    }
    try {
      return this.jwtService.verify(token, { secret: process.env.JWT_SECRET })?.sub;
    } catch (err) {
      return undefined;
    }
  }

  // ---------- Host ----------

  @Get('/events')
  @UseGuards(AuthGuard("jwt"))
  async getAllInvitations(
    @Request() req,
    @Query('page') page: number,
  ) {
    page = Number(page) || 1;
    const invitations = await this.invitationsService.getList(req.user._id, page);
    return { invitations };
  }

  @Post('/events')
  @UseGuards(AuthGuard("jwt"))
  async createEvent(
    @Request() req,
    @Body() body: CreateInvitationDTO,
  ) {
    const res = await this.invitationsService.createOne(body, req.user._id, req.user.slEmail);
    return res;
  }

  @Get('events/:id')
  @UseGuards(AuthGuard("jwt"))
  async getEvent(
    @Request() req,
    @Param() params
  ) {
    const invitationId = params.id;
    const invitation = await this.invitationsService.findOne(invitationId, req.user._id);
    return { invitation };
  }

  @Put('events/:id')
  @UseGuards(AuthGuard("jwt"))
  async updateEvent(@Request() req, @Param('id') id: string, @Body() body: UpdateInvitationDTO) {
    return await this.invitationsService.update(id, req.user._id, body, req.user.slEmail);
  }

  @Delete('events/:id')
  @UseGuards(AuthGuard("jwt"))
  async removeEvent(@Request() req, @Param('id') id: string) {
    return await this.invitationsService.remove(id, req.user._id);
  }

  @Put('events/:id/wishes/:wishId/hide')
  @UseGuards(AuthGuard("jwt"))
  async hideWish(@Request() req, @Param('id') id: string, @Param('wishId') wishId: string) {
    return await this.invitationsService.setWishHidden(id, wishId, req.user._id, true);
  }

  @Delete('events/:id/wishes/:wishId/hide')
  @UseGuards(AuthGuard("jwt"))
  async unhideWish(@Request() req, @Param('id') id: string, @Param('wishId') wishId: string) {
    return await this.invitationsService.setWishHidden(id, wishId, req.user._id, false);
  }

  @Put('events/:id/guests/:guestId')
  @UseGuards(AuthGuard("jwt"))
  async updateGuest(@Request() req, @Param('id') id: string, @Param('guestId') guestId: string, @Body() body: UpdateGuestDTO) {
    return await this.invitationsService.updateGuest(id, guestId, req.user._id, body);
  }

  @Delete('events/:id/guests/:guestId')
  @UseGuards(AuthGuard("jwt"))
  async removeGuest(@Request() req, @Param('id') id: string, @Param('guestId') guestId: string) {
    return await this.invitationsService.removeGuest(id, guestId, req.user._id);
  }

  @Post('events/:id/photos')
  @UseGuards(AuthGuard("jwt"))
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } }))
  async addPhoto(@Request() req, @Param('id') id: string, @UploadedFile(photoPipe) file: Express.Multer.File) {
    return await this.invitationsService.addPhoto(id, req.user._id, file);
  }

  @Put('events/:id/photos/order')
  @UseGuards(AuthGuard("jwt"))
  async orderPhotos(@Request() req, @Param('id') id: string, @Body() body: PhotoOrderDTO) {
    return await this.invitationsService.orderPhotos(id, req.user._id, body.order);
  }

  @Delete('events/:id/photos/:photoId')
  @UseGuards(AuthGuard("jwt"))
  async removePhoto(@Request() req, @Param('id') id: string, @Param('photoId') photoId: string) {
    return await this.invitationsService.removePhoto(id, photoId, req.user._id);
  }

  /** The venue screen's secret key; `rotate` replaces it (old link stops working). */
  @Post('events/:id/screen-key')
  @UseGuards(AuthGuard("jwt"))
  async screenKey(@Request() req, @Param('id') id: string, @Body('rotate') rotate?: boolean) {
    return await this.invitationsService.screenKey(id, req.user._id, rotate === true);
  }

  // ---------- Venue screen (secret link) ----------

  @Get('events/:id/screen/:key')
  async screen(@Param('id') id: string, @Param('key') key: string, @Query('since') since?: string) {
    return await this.invitationsService.screen(id, key, since);
  }

  // ---------- Guests (personal link) ----------

  @Get('invitations/:id')
  async getInvitation(@Param('id') id: string, @Headers('authorization') authorization?: string) {
    const invitation = await this.invitationsService.findGuest(id, this.viewerId(authorization));
    return { invitation };
  }

  @Get('invitations/:id/preview')
  async guestPreview(@Param('id') id: string) {
    return await this.invitationsService.preview('guest', id);
  }

  @Put('invitations/:id/rsvp')
  async rsvp(@Param('id') id: string, @Body() body: RsvpDTO) {
    return await this.invitationsService.rsvpGuest(id, body);
  }

  @Post('invitations/:id/wishes')
  async wish(@Param('id') id: string, @Body() body: WishDTO) {
    return await this.invitationsService.wishFromGuest(id, body);
  }

  // ---------- Anyone (public link) ----------

  @Get('events/:id/public')
  async getPublic(@Param('id') id: string, @Headers('authorization') authorization?: string) {
    return await this.invitationsService.findPublic(id, this.viewerId(authorization));
  }

  @Get('events/:id/preview')
  async eventPreview(@Param('id') id: string) {
    return await this.invitationsService.preview('event', id);
  }

  @Post('events/:id/public/rsvp')
  async publicRsvp(@Param('id') id: string, @Body() body: PublicRsvpDTO) {
    return await this.invitationsService.rsvpPublic(id, body);
  }

  @Post('events/:id/public/wishes')
  async publicWish(@Param('id') id: string, @Body() body: WishDTO) {
    return await this.invitationsService.wishFromPublic(id, body);
  }
}
