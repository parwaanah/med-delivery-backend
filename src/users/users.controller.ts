// users/users.controller.ts
import { 
  Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, ForbiddenException 
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Admin-only: list all users
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Request() req: any) {
    if (req.user.role !== 'admin') throw new ForbiddenException('Admins only');
    return this.usersService.findAll();
  }

  // Admin-only: get a specific user
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    if (req.user.role !== 'admin') throw new ForbiddenException('Admins only');
    return this.usersService.findOne(Number(id));
  }

  // Signup route (no auth needed)
  @Post()
  create(@Body() body: { name: string; email: string; password: string }) {
    return this.usersService.create(body.name, body.email, body.password);
  }

  // Admin-only: update a user
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string; email?: string; password?: string },
  ) {
    if (req.user.role !== 'admin') throw new ForbiddenException('Admins only');
    return this.usersService.update(Number(id), body);
  }

  // Admin-only: delete a user
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    if (req.user.role !== 'admin') throw new ForbiddenException('Admins only');
    return this.usersService.remove(Number(id));
  }
}
