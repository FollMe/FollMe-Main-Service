import { Body, Controller, Get, Request, Post, Put, Delete, UseGuards, Param, Query } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateInvitationDTO } from './dtos/createInvitation.dto';
import { UpdateInvitationDTO } from './dtos/updateInvitation.dto';
import { PublicRsvpDTO, RsvpDTO } from './dtos/rsvp.dto';
import { WishDTO } from './dtos/wish.dto';

@Controller('api')
export class invitationsController {
  constructor(private readonly invitationsService: InvitationsService) { }

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

  // ---------- Guests (personal link) ----------

  @Get('invitations/:id')
  async getInvitation(
    @Param() params
  ) {
    const invitationId = params.id;
    const invitation = await this.invitationsService.findGuest(invitationId);
    return { invitation };
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
  async getPublic(@Param('id') id: string) {
    return await this.invitationsService.findPublic(id);
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
