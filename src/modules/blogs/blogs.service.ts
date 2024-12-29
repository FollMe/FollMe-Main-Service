import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CloudinaryService } from 'src/sharedServices/cloudinary.service';
import { Blog, BlogDocument } from './schemas/blog.schema';

@Injectable()
export class BlogsService {
  constructor(
    @InjectModel(Blog.name)
    private blogModel: Model<BlogDocument>,
    private cloudinaryService: CloudinaryService,
  ) { }
  async createOne(data: any, file: Express.Multer.File, userId: string) {
    let thumbnail = null;
    if (file) {
      const uploadRes = await this.cloudinaryService.uploadImage(file, "FollMe/thumbnail");
      thumbnail = {
        link: uploadRes.secure_url,
        public_id: uploadRes.public_id
      }
    }

    const createdRes = await this.blogModel.create({
      ...data,
      thumbnail,
      author: userId
    });

    return {
      _id: createdRes._id,
      slug: createdRes.slug
    }
  }

  async getAll() {
    return await this.blogModel.find({ isDeleted: { $ne: true } })
      .select('-content -isDeleted')
      .populate('author', '_id name slEmail')
  }

  async getBlog(slug: string) {
    const blog = await this.blogModel.findOneAndUpdate(
      { slug, isDeleted: { $ne: true } },
      { $inc: { viewed: 1 } }
    ).setOptions({ timestamps: false })
    .populate('author', '_id name slEmail')

    if (!blog) {
      throw new NotFoundException();
    }

    return blog;
  }

}
