import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BlogsService } from './blogs.service';

const AUTHOR = '64b000000000000000000001';
const STRANGER = '64b000000000000000000002';

function fakeQuery(result: any) {
  return { populate: () => Promise.resolve(result) };
}

function setup(blog: any) {
  const model = {
    findOne: jest.fn(() => fakeQuery(blog)),
    updateOne: jest.fn(() => Promise.resolve({})),
    create: jest.fn((doc) => Promise.resolve({ _id: 'new', slug: 'new-slug', ...doc })),
  };
  const cloudinary = {
    uploadImage: jest.fn(() => Promise.resolve({ secure_url: 'https://img/new.png', public_id: 'new' })),
  };
  const service = new BlogsService(model as any, cloudinary as any);
  return { model, cloudinary, service };
}

const blog = () => ({ _id: 'b1', slug: 'hello', title: 'Hello', author: { _id: AUTHOR } });

describe('BlogsService', () => {
  describe('updateOne', () => {
    it('updates only the given fields and keeps the slug', async () => {
      const { model, service } = setup(blog());
      const res = await service.updateOne('hello', { title: '  New title ' }, undefined, AUTHOR);

      expect(res).toEqual({ _id: 'b1', slug: 'hello' });
      expect(model.updateOne).toHaveBeenCalledWith({ _id: 'b1' }, { $set: { title: 'New title' } });
    });

    it('uploads a new thumbnail when given', async () => {
      const { model, cloudinary, service } = setup(blog());
      await service.updateOne('hello', {}, { buffer: Buffer.from('') } as any, AUTHOR);

      expect(cloudinary.uploadImage).toHaveBeenCalled();
      expect(model.updateOne).toHaveBeenCalledWith(
        { _id: 'b1' },
        { $set: { thumbnail: { link: 'https://img/new.png', public_id: 'new' } } },
      );
    });

    it('rejects other users', async () => {
      const { model, service } = setup(blog());
      await expect(service.updateOne('hello', { title: 'Hacked' }, undefined, STRANGER))
        .rejects.toBeInstanceOf(ForbiddenException);
      expect(model.updateOne).not.toHaveBeenCalled();
    });

    it('404s for a missing or deleted blog', async () => {
      const { service } = setup(null);
      await expect(service.updateOne('nope', {}, undefined, AUTHOR)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deleteOne', () => {
    it('soft-deletes the author\'s blog', async () => {
      const { model, service } = setup(blog());
      await service.deleteOne('hello', AUTHOR);
      expect(model.updateOne).toHaveBeenCalledWith({ _id: 'b1' }, { $set: { isDeleted: true } });
    });

    it('rejects other users', async () => {
      const { model, service } = setup(blog());
      await expect(service.deleteOne('hello', STRANGER)).rejects.toBeInstanceOf(ForbiddenException);
      expect(model.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('createOne', () => {
    it('ignores fields the client must not set', async () => {
      const { model, service } = setup(null);
      const body = { title: 'T', content: 'C', viewed: 9999, isDeleted: true, slug: 'x' } as any;
      await service.createOne(body, undefined, AUTHOR);
      expect(model.create).toHaveBeenCalledWith({ title: 'T', content: 'C', thumbnail: null, author: AUTHOR });
    });
  });
});
