import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SurprisesService } from './surprises.service';
import { PickDTO, SurpriseDTO, UnlockDTO } from './surprise.dto';

@Controller('api')
export class SurprisesController {
  constructor(private readonly surprisesService: SurprisesService) {}

  // ---------- The owner ----------

  @Post('surprises')
  @UseGuards(AuthGuard('jwt'))
  async create(@Request() req, @Body() body: SurpriseDTO) {
    return await this.surprisesService.create(req.user, body);
  }

  @Get('surprises')
  @UseGuards(AuthGuard('jwt'))
  async list(@Request() req) {
    return await this.surprisesService.list(req.user._id);
  }

  @Get('surprises/:id')
  @UseGuards(AuthGuard('jwt'))
  async get(@Request() req, @Param('id') id: string) {
    return await this.surprisesService.findForOwner(id, req.user._id);
  }

  @Put('surprises/:id')
  @UseGuards(AuthGuard('jwt'))
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() body: SurpriseDTO,
  ) {
    return await this.surprisesService.update(id, req.user._id, body);
  }

  /** Lets them choose again. */
  @Put('surprises/:id/reopen')
  @UseGuards(AuthGuard('jwt'))
  async reopen(@Request() req, @Param('id') id: string) {
    return await this.surprisesService.reopen(id, req.user._id);
  }

  @Delete('surprises/:id')
  @UseGuards(AuthGuard('jwt'))
  async remove(@Request() req, @Param('id') id: string) {
    return await this.surprisesService.remove(id, req.user._id);
  }

  // ---------- Whoever has the link (and the password) ----------

  @Get('surprises/:id/public')
  async publicView(@Param('id') id: string) {
    return await this.surprisesService.publicView(id);
  }

  @Post('surprises/:id/unlock')
  @HttpCode(200)
  async unlock(@Param('id') id: string, @Body() body: UnlockDTO) {
    return await this.surprisesService.unlock(id, body);
  }

  @Post('surprises/:id/pick')
  @HttpCode(200)
  async pick(@Param('id') id: string, @Body() body: PickDTO) {
    return await this.surprisesService.pick(id, body);
  }
}
