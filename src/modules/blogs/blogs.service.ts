import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CloudinaryService } from 'src/sharedServices/cloudinary.service';
import { Blog, BlogDocument } from './schemas/blog.schema';
import { SearchBlogDTO } from './dtos/searchBlog.dto';
import { CreateBlogDTO } from './dtos/createBlog.dto';
import { UpdateBlogDTO } from './dtos/updateBlog.dto';

@Injectable()
export class BlogsService {
  constructor(
    @InjectModel(Blog.name)
    private blogModel: Model<BlogDocument>,
    private cloudinaryService: CloudinaryService,
  ) { }
  private async uploadThumbnail(file?: Express.Multer.File) {
    if (!file) {
      return null;
    }
    const uploadRes = await this.cloudinaryService.uploadImage(file, "FollMe/thumbnail");
    return {
      link: uploadRes.secure_url,
      public_id: uploadRes.public_id
    }
  }

  async createOne(data: CreateBlogDTO, file: Express.Multer.File, userId: string) {
    const thumbnail = await this.uploadThumbnail(file);

    // Pick fields explicitly: the body must not set slug, views or isDeleted.
    const createdRes = await this.blogModel.create({
      title: data.title,
      content: data.content,
      thumbnail,
      author: userId
    });

    return {
      _id: createdRes._id,
      slug: createdRes.slug
    }
  }

  async getAll(search: SearchBlogDTO) {
    return await this.blogModel.find({ isDeleted: { $ne: true } })
      .sort(search.sort)
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

  /**
   * Returns a live blog of the given author, without counting a view.
   * Throws 404 if it does not exist and 403 if someone else wrote it.
   */
  async getOwnBlog(slug: string, userId: string) {
    const blog = await this.blogModel.findOne({ slug, isDeleted: { $ne: true } })
      .populate('author', '_id name slEmail');
    if (!blog) {
      throw new NotFoundException();
    }
    const authorId = (blog.author as any)?._id ?? blog.author;
    if (String(authorId) !== String(userId)) {
      throw new ForbiddenException('Bạn chỉ có thể chỉnh sửa bài viết của mình');
    }
    return blog;
  }

  async updateOne(slug: string, data: UpdateBlogDTO, file: Express.Multer.File, userId: string) {
    const blog = await this.getOwnBlog(slug, userId);

    const changes: Partial<Blog> = {};
    if (data.title !== undefined) {
      changes.title = data.title.trim();
    }
    if (data.content !== undefined) {
      changes.content = data.content;
    }
    const thumbnail = await this.uploadThumbnail(file);
    if (thumbnail) {
      changes.thumbnail = thumbnail;
    }

    await this.blogModel.updateOne({ _id: (blog as any)._id }, { $set: changes });
    return {
      _id: (blog as any)._id,
      slug: blog.slug
    }
  }

  /** Soft-deletes a blog so comments and reactions are kept. */
  async deleteOne(slug: string, userId: string) {
    const blog = await this.getOwnBlog(slug, userId);
    await this.blogModel.updateOne({ _id: (blog as any)._id }, { $set: { isDeleted: true } });
    return { slug: blog.slug };
  }
}
