import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { slugify } from '../../utils/helpers';

export const categoryService = {
  async getAll() {
    return prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { gearItems: true } } },
    });
  },

  async getById(id: string) {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) throw ApiError.notFound('Category not found');
    return category;
  },

  async create(data: { name: string; description?: string; image?: string }) {
    const slug = slugify(data.name);
    const existing = await prisma.category.findFirst({
      where: { OR: [{ name: data.name }, { slug }] },
    });
    if (existing) throw ApiError.conflict('A category with this name already exists');
    return prisma.category.create({ data: { ...data, slug } });
  },

  async update(id: string, data: { name?: string; description?: string; image?: string }) {
    await this.getById(id);
    const payload: Record<string, unknown> = { ...data };
    if (data.name) payload.slug = slugify(data.name);
    return prisma.category.update({ where: { id }, data: payload });
  },

  async remove(id: string) {
    await this.getById(id);
    const inUse = await prisma.gearItem.count({ where: { categoryId: id } });
    if (inUse > 0) {
      throw ApiError.badRequest('Cannot delete a category that still has gear items assigned to it');
    }
    await prisma.category.delete({ where: { id } });
  },
};
