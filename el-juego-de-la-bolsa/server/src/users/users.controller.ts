import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get(':id')
  async getUser(@Param('id', ParseIntPipe) id: number) {
    const u = await this.users.findById(id);
    return { id: u?.id, name: u?.name, email: u?.email, role: u?.role };
  }
}
