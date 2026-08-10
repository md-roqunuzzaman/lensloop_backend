import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';

function toSafeUser<T extends { password: string }>(user: T) {
  const { password, ...safe } = user;
  return safe;
}

export const userService = {
  async updateProfile(userId: string, data: { name?: string; phone?: string; avatar?: string }) {
    const user = await prisma.user.update({ where: { id: userId }, data });
    return toSafeUser(user);
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound('User not found');
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) throw ApiError.unauthorized('Current password is incorrect');
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
  },
};
