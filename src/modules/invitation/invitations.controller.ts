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
import { ArrivalDTO, WalkInDTO } from './dtos/desk.dto';
import { GiftClaimDTO, GiftGiverDTO } from './dtos/receivedGift.dto';
import { SeatingDTO } from './dtos/seating.dto';
import { ExpenseDTO, UpdateExpenseDTO } from './dtos/expense.dto';
import { ChecklistDTO, UpdateTaskDTO } from './dtos/task.dto';
import { DuplicateEventDTO } from './dtos/duplicate.dto';
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

  /** The seating plan: many guests seated (or unseated) at once. */
  @Put('events/:id/tables')
  @UseGuards(AuthGuard("jwt"))
  async seatGuests(@Request() req, @Param('id') id: string, @Body() body: SeatingDTO) {
    return await this.invitationsService.seatGuests(id, req.user._id, body.seats);
  }

  /** The gift ledger: someone not on the list gave a gift. */
  @Post('events/:id/gift-givers')
  @UseGuards(AuthGuard("jwt"))
  async addGiftGiver(@Request() req, @Param('id') id: string, @Body() body: GiftGiverDTO) {
    return await this.invitationsService.addGiftGiver(id, req.user._id, body);
  }

  @Delete('events/:id/guests/:guestId')
  @UseGuards(AuthGuard("jwt"))
  async removeGuest(@Request() req, @Param('id') id: string, @Param('guestId') guestId: string) {
    return await this.invitationsService.removeGuest(id, guestId, req.user._id);
  }

  // ---------- Budget (thu chi) ----------

  @Post('events/:id/expenses')
  @UseGuards(AuthGuard("jwt"))
  async addExpense(@Request() req, @Param('id') id: string, @Body() body: ExpenseDTO) {
    return await this.invitationsService.addExpense(id, req.user._id, body);
  }

  @Put('events/:id/expenses/:expenseId')
  @UseGuards(AuthGuard("jwt"))
  async updateExpense(@Request() req, @Param('id') id: string, @Param('expenseId') expenseId: string, @Body() body: UpdateExpenseDTO) {
    return await this.invitationsService.updateExpense(id, expenseId, req.user._id, body);
  }

  @Delete('events/:id/expenses/:expenseId')
  @UseGuards(AuthGuard("jwt"))
  async removeExpense(@Request() req, @Param('id') id: string, @Param('expenseId') expenseId: string) {
    return await this.invitationsService.removeExpense(id, expenseId, req.user._id);
  }

  /** The host's link for someone to manage the event with them; `rotate` replaces it. */
  @Post('events/:id/cohost-key')
  @UseGuards(AuthGuard("jwt"))
  async cohostKey(@Request() req, @Param('id') id: string, @Body('rotate') rotate?: boolean) {
    return await this.invitationsService.cohostKey(id, req.user._id, rotate === true);
  }

  /** What the host's link is for, shown before signing in and accepting. */
  @Get('events/:id/cohost-invite/:key')
  async cohostInvite(@Param('id') id: string, @Param('key') key: string) {
    return await this.invitationsService.cohostInvite(id, key);
  }

  /** Opening the host's link, signed in: manage the event with them. */
  @Post('events/:id/cohosts')
  @UseGuards(AuthGuard("jwt"))
  async joinAsCohost(@Request() req, @Param('id') id: string, @Body('key') key: string) {
    return await this.invitationsService.joinAsCohost(id, key, req.user._id);
  }

  /** The host takes someone off, or a co-host leaves. */
  @Delete('events/:id/cohosts/:userId')
  @UseGuards(AuthGuard("jwt"))
  async removeCohost(@Request() req, @Param('id') id: string, @Param('userId') userId: string) {
    return await this.invitationsService.removeCohost(id, userId, req.user._id);
  }

  /** A copy of the event for another ceremony (lễ vu quy, tiệc báo hỷ). */
  @Post('events/:id/duplicate')
  @UseGuards(AuthGuard("jwt"))
  async duplicate(@Request() req, @Param('id') id: string, @Body() body: DuplicateEventDTO) {
    return await this.invitationsService.duplicate(id, req.user._id, body);
  }

  // ---------- Checklist (việc cần làm) ----------

  @Post('events/:id/checklist')
  @UseGuards(AuthGuard("jwt"))
  async addTasks(@Request() req, @Param('id') id: string, @Body() body: ChecklistDTO) {
    return await this.invitationsService.addTasks(id, req.user._id, body.items);
  }

  @Put('events/:id/checklist/:taskId')
  @UseGuards(AuthGuard("jwt"))
  async updateTask(@Request() req, @Param('id') id: string, @Param('taskId') taskId: string, @Body() body: UpdateTaskDTO) {
    return await this.invitationsService.updateTask(id, taskId, req.user._id, body);
  }

  @Delete('events/:id/checklist/:taskId')
  @UseGuards(AuthGuard("jwt"))
  async removeTask(@Request() req, @Param('id') id: string, @Param('taskId') taskId: string) {
    return await this.invitationsService.removeTask(id, taskId, req.user._id);
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

  /** The reception desk's secret key; `rotate` replaces it (old link stops working). */
  @Post('events/:id/desk-key')
  @UseGuards(AuthGuard("jwt"))
  async deskKey(@Request() req, @Param('id') id: string, @Body('rotate') rotate?: boolean) {
    return await this.invitationsService.deskKey(id, req.user._id, rotate === true);
  }

  // ---------- Reception desk (secret link) ----------

  @Get('events/:id/desk/:key')
  async desk(@Param('id') id: string, @Param('key') key: string) {
    return await this.invitationsService.desk(id, key);
  }

  @Put('events/:id/desk/:key/guests/:guestId')
  async setArrival(@Param('id') id: string, @Param('key') key: string, @Param('guestId') guestId: string, @Body() body: ArrivalDTO) {
    return await this.invitationsService.setArrival(id, key, guestId, body);
  }

  @Post('events/:id/desk/:key/guests')
  async addWalkIn(@Param('id') id: string, @Param('key') key: string, @Body() body: WalkInDTO) {
    return await this.invitationsService.addWalkIn(id, key, body);
  }

  @Delete('events/:id/desk/:key/guests/:guestId')
  async removeWalkIn(@Param('id') id: string, @Param('key') key: string, @Param('guestId') guestId: string) {
    return await this.invitationsService.removeWalkIn(id, key, guestId);
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

  /** "I sent a gift" by bank transfer, from the guest's card; DELETE takes it back. */
  @Put('invitations/:id/gift')
  async claimGift(@Param('id') id: string, @Body() body: GiftClaimDTO) {
    return await this.invitationsService.claimGift(id, body);
  }

  @Delete('invitations/:id/gift')
  async withdrawGiftClaim(@Param('id') id: string) {
    return await this.invitationsService.withdrawGiftClaim(id);
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

  /** "Bạn ngồi bàn nào?": name and table only, on the day (?q=name). */
  @Get('events/:id/public/seat')
  async findSeat(@Param('id') id: string, @Query('q') q?: string) {
    return await this.invitationsService.findSeat(id, q ?? '');
  }

  @Post('events/:id/public/wishes')
  async publicWish(@Param('id') id: string, @Body() body: WishDTO) {
    return await this.invitationsService.wishFromPublic(id, body);
  }
}
