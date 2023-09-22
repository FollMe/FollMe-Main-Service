import { Body, Controller, Get, Request, Post, UseGuards, Param } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateInvitationDTO } from './dtos/createBlog.dto';

@Controller('api')
export class invitationsController {
  constructor(private readonly invitationsService: InvitationsService) { }

  @Get('/events')
  @UseGuards(AuthGuard("jwt"))
  async getAllInvitations(
    @Request() req,
  ) {
    const invitations = await this.invitationsService.getAll(req.user._id);
    return { invitations };
  }

  @Post('/events')
  @UseGuards(AuthGuard("jwt"))
  async createEvent(
    @Request() req,
    @Body() body: CreateInvitationDTO,
  ) {
    const res = await this.invitationsService.createOne(body, req.user._id);
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

  @Get('invitations/:id')
  async getInvitation(
    @Param() params
  ) {
    const invitationId = params.id;
    const invitation = await this.invitationsService.findGuest(invitationId);
    return { invitation };
  }
}
