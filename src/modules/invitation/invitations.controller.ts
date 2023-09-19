import { Body, Controller, Get, Request, Post, UseGuards, Param } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateInvitationDTO } from './dtos/createBlog.dto';

@Controller('api/invitations')
export class invitationsController {
  constructor(private readonly invitationsService: InvitationsService) { }

  @Get('/')
  @UseGuards(AuthGuard("jwt"))
  async getAllInvitations(
    @Request() req,
  ) {
    const invitations = await this.invitationsService.getAll(req.user._id);
    return { invitations };
  }

  @Post('/')
  @UseGuards(AuthGuard("jwt"))
  async createBlog(
    @Request() req,
    @Body() body: CreateInvitationDTO,
  ) {
    const res = await this.invitationsService.createOne(body, req.user._id);
    return res;
  }

  @Get('/:id')
  @UseGuards(AuthGuard("jwt"))
  async getInvitation(
    @Request() req,
    @Param() params
  ) {
    const invitationId = params.id;
    const invitation = await this.invitationsService.findOne(invitationId, req.user._id);
    return { invitation };
  }
}
