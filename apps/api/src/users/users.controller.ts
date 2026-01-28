import {
  Controller,
  Get,
  NotFoundException,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

interface RequestWithUser {
  user: {
    id: string;
  };
}

@Controller('profile')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getProfile(@Request() req: RequestWithUser) {
    // req.user is populated by JwtStrategy
    const userId = req.user.id;
    const user = await this.usersService.findOneById(userId);
    if (user) {
      if (user.avatar) {
        user.avatar =
          (await this.usersService.getSignedUrl(user.avatar)) || user.avatar;
      }
      return user;
    }
    throw new NotFoundException(`User with ID ${userId} not found`);
  }
}
