import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { MailerService } from 'src/sharedServices/mailer.service';
import {
  PickDTO,
  SurpriseDTO,
  SurpriseGiftDTO,
  UnlockDTO,
} from './surprise.dto';
import {
  FAILED_WINDOW_MS,
  MAX_FAILED,
  MIN_GIFTS,
  MIN_PASSWORD,
  Surprise,
  SurpriseDocument,
} from './surprise.schema';

/** The password as people remember it: no case, accents or spaces ("Anh Yêu Em" = "anhyeuem"). */
export function loosePassword(password: string) {
  return String(password ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, '');
}

export function hashPassword(
  password: string,
  salt = randomBytes(16).toString('hex'),
) {
  return {
    salt,
    hash: scryptSync(loosePassword(password), salt, 32).toString('hex'),
  };
}

export function checkPassword(password: string, salt: string, hash: string) {
  const given = scryptSync(loosePassword(password), salt, 32);
  const kept = Buffer.from(hash, 'hex');
  return given.length === kept.length && timingSafeEqual(given, kept);
}

/** Gifts in the owner's order, one line each; a gift keeps its _id (a repeated one gets a new one). */
export function tidyGifts(gifts: SurpriseGiftDTO[]) {
  const line = (value?: string) =>
    value?.replace(/\s+/g, ' ').trim() || undefined;
  const seen = new Set<string>();
  return gifts
    .map((gift) => {
      const keep =
        gift._id && mongoose.isValidObjectId(gift._id) && !seen.has(gift._id);
      if (keep) {
        seen.add(gift._id);
      }
      const note = line(gift.note);
      const emoji = line(gift.emoji);
      return {
        _id: keep
          ? new mongoose.Types.ObjectId(gift._id)
          : new mongoose.Types.ObjectId(),
        title: line(gift.title) ?? '',
        ...(note ? { note } : {}),
        ...(emoji ? { emoji } : {}),
      };
    })
    .filter((gift) => gift.title);
}

function escapeHtml(text: string) {
  return String(text ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        c
      ]),
  );
}

function assertId(id: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new NotFoundException();
  }
}

const OWNER_FIELDS =
  'recipientName fromName message hint mascot opensAt gifts pick createdAt updatedAt';

@Injectable()
export class SurprisesService {
  constructor(
    @InjectModel(Surprise.name)
    private readonly surpriseModel: mongoose.Model<SurpriseDocument>,
    private readonly mailerService: MailerService,
  ) {}

  /** The fields to save from a body; `creating` needs a name, a password and gifts. */
  private fields(body: SurpriseDTO, creating: boolean) {
    const set: Record<string, unknown> = {};
    const unset: Record<string, 1> = {};
    const text = (value?: string) => value?.replace(/\s+/g, ' ').trim();
    if (body.recipientName !== undefined) {
      set.recipientName = text(body.recipientName);
    }
    if (body.fromName !== undefined) {
      set.fromName = text(body.fromName);
    }
    if (body.message !== undefined) {
      set.message = body.message
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }
    if (body.hint !== undefined) {
      set.hint = text(body.hint);
    }
    if (body.mascot !== undefined) {
      set.mascot = body.mascot;
    }
    if (body.opensAt !== undefined) {
      if (body.opensAt) {
        set.opensAt = new Date(body.opensAt);
      } else {
        unset.opensAt = 1;
      }
    }
    if (body.password !== undefined) {
      if (loosePassword(body.password).length < MIN_PASSWORD) {
        throw new BadRequestException(
          `Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự (không tính dấu cách)`,
        );
      }
      const { salt, hash } = hashPassword(body.password);
      set.passwordSalt = salt;
      set.passwordHash = hash;
    }
    if (body.gifts !== undefined) {
      const gifts = tidyGifts(body.gifts);
      if (gifts.length < MIN_GIFTS) {
        throw new BadRequestException(`Cần ít nhất ${MIN_GIFTS} món để chọn`);
      }
      set.gifts = gifts;
    }
    if (creating) {
      if (!set.recipientName) {
        throw new BadRequestException('Vui lòng nhập tên người nhận');
      }
      if (!set.passwordHash) {
        throw new BadRequestException('Vui lòng đặt mật khẩu');
      }
      if (!set.gifts) {
        throw new BadRequestException(`Cần ít nhất ${MIN_GIFTS} món để chọn`);
      }
    } else if (set.recipientName === '') {
      throw new BadRequestException('Vui lòng nhập tên người nhận');
    }
    return { set, unset };
  }

  async create(user: { _id: unknown; email?: string }, body: SurpriseDTO) {
    const { set } = this.fields(body, true);
    const surprise = await this.surpriseModel.create({
      ...set,
      owner: user._id,
      ownerEmail: user.email,
    });
    return { _id: surprise._id };
  }

  async list(ownerId: string) {
    const surprises: any[] = await this.surpriseModel
      .find({ owner: ownerId, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .select('recipientName mascot opensAt pick gifts createdAt');
    return surprises.map((s) => ({
      _id: s._id,
      recipientName: s.recipientName,
      mascot: s.mascot,
      opensAt: s.opensAt,
      pick: s.pick,
      gifts: s.gifts.length,
      createdAt: s.createdAt,
    }));
  }

  async findForOwner(id: string, ownerId: string) {
    assertId(id);
    const surprise = await this.surpriseModel
      .findOne({ _id: id, owner: ownerId, isDeleted: { $ne: true } })
      .select(OWNER_FIELDS);
    if (!surprise) {
      throw new NotFoundException();
    }
    return surprise;
  }

  async update(id: string, ownerId: string, body: SurpriseDTO) {
    assertId(id);
    const { set, unset } = this.fields(body, false);
    const update: Record<string, unknown> = {};
    if (Object.keys(set).length) {
      update.$set = set;
    }
    if (Object.keys(unset).length) {
      update.$unset = unset;
    }
    if (!Object.keys(update).length) {
      throw new BadRequestException('Không có gì để cập nhật');
    }
    const surprise = await this.surpriseModel
      .findOneAndUpdate(
        { _id: id, owner: ownerId, isDeleted: { $ne: true } },
        update,
        { new: true },
      )
      .select(OWNER_FIELDS);
    if (!surprise) {
      throw new NotFoundException();
    }
    return surprise;
  }

  /** Lets them choose again. */
  async reopen(id: string, ownerId: string) {
    assertId(id);
    const res = await this.surpriseModel.updateOne(
      { _id: id, owner: ownerId, isDeleted: { $ne: true } },
      { $unset: { pick: 1 } },
    );
    if (!res.matchedCount) {
      throw new NotFoundException();
    }
    return { _id: id };
  }

  async remove(id: string, ownerId: string) {
    assertId(id);
    const res = await this.surpriseModel.updateOne(
      { _id: id, owner: ownerId, isDeleted: { $ne: true } },
      { $set: { isDeleted: true } },
    );
    if (!res.matchedCount) {
      throw new NotFoundException();
    }
    return { _id: id };
  }

  /** What the link shows before the password: who it is for, the hint, the mascot, when it opens. */
  async publicView(id: string, now = Date.now()) {
    assertId(id);
    const s: any = await this.surpriseModel
      .findOne({ _id: id, isDeleted: { $ne: true } })
      .select('recipientName hint mascot opensAt pick');
    if (!s) {
      throw new NotFoundException();
    }
    return {
      _id: s._id,
      recipientName: s.recipientName,
      hint: s.hint,
      mascot: s.mascot,
      opensAt: s.opensAt,
      isOpen: !s.opensAt || new Date(s.opensAt).getTime() <= now,
      picked: Boolean(s.pick),
    };
  }

  /**
   * The surprise once the password is right. Not before its day; after
   * MAX_FAILED wrong tries in a row, a short wait.
   */
  private async open(id: string, password: string, now: number) {
    assertId(id);
    const s: any = await this.surpriseModel
      .findOne({ _id: id, isDeleted: { $ne: true } })
      .select(
        `${OWNER_FIELDS} +passwordHash +passwordSalt +failedCount +failedAt ownerEmail`,
      );
    if (!s) {
      throw new NotFoundException();
    }
    if (s.opensAt && new Date(s.opensAt).getTime() > now) {
      throw new ForbiddenException('Chưa tới ngày mở quà nha');
    }
    const recentFail =
      s.failedAt && now - new Date(s.failedAt).getTime() < FAILED_WINDOW_MS;
    if (recentFail && (s.failedCount ?? 0) >= MAX_FAILED) {
      throw new HttpException(
        'Thử nhiều quá rồi, đợi vài phút rồi thử lại nha',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (!checkPassword(password, s.passwordSalt, s.passwordHash)) {
      await this.surpriseModel.updateOne(
        { _id: s._id },
        recentFail
          ? { $inc: { failedCount: 1 }, $set: { failedAt: new Date(now) } }
          : { $set: { failedCount: 1, failedAt: new Date(now) } },
      );
      throw new BadRequestException('Sai mật khẩu rồi');
    }
    if (s.failedCount) {
      await this.surpriseModel.updateOne(
        { _id: s._id },
        { $unset: { failedCount: 1, failedAt: 1 } },
      );
    }
    return s;
  }

  private reveal(s: any) {
    return {
      _id: s._id,
      recipientName: s.recipientName,
      fromName: s.fromName,
      message: s.message,
      mascot: s.mascot,
      gifts: (s.gifts ?? []).map((g) => ({
        _id: g._id,
        title: g.title,
        note: g.note,
        emoji: g.emoji,
      })),
      pick: s.pick ?? null,
    };
  }

  async unlock(id: string, body: UnlockDTO, now = Date.now()) {
    return this.reveal(await this.open(id, body.password, now));
  }

  /** They pick one gift, once (the owner can let them choose again); the owner gets an email. */
  async pick(id: string, body: PickDTO, now = Date.now()) {
    const s = await this.open(id, body.password, now);
    const gift = (s.gifts ?? []).find((g) => String(g._id) === body.giftId);
    if (!gift) {
      throw new BadRequestException('Không thấy món quà này');
    }
    const note = body.note?.replace(/\s+/g, ' ').trim();
    const pick = {
      gift: gift._id,
      title: gift.title,
      ...(gift.emoji ? { emoji: gift.emoji } : {}),
      ...(note ? { note } : {}),
      at: new Date(now),
    };
    const saved = await this.surpriseModel
      .findOneAndUpdate(
        { _id: s._id, pick: { $exists: false } },
        { $set: { pick } },
        { new: true },
      )
      .select('pick');
    if (!saved) {
      throw new ConflictException('Bạn đã chọn quà rồi');
    }
    if (s.ownerEmail) {
      const name = escapeHtml(s.recipientName);
      this.mailerService.sendInBackground({
        from: '"FollMe " <follme.noreply@gmail.com>',
        to: s.ownerEmail,
        subject: `🎁 ${s.recipientName} đã chọn quà: ${gift.title}`,
        html:
          `<p><strong>${name}</strong> đã mở hộp quà và chọn: <strong>${escapeHtml(
            gift.emoji ?? '',
          )} ${escapeHtml(gift.title)}</strong>.</p>` +
          (note ? `<p>Lời nhắn: “${escapeHtml(note)}”</p>` : '') +
          `<p><a href="${process.env.FE_URL}/qua-bi-mat/${s._id}">Xem hộp quà</a></p>`,
      });
    }
    return { pick: (saved as any).pick };
  }
}
