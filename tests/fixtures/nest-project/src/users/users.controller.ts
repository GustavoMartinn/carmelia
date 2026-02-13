import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards } from '@nestjs/common'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'

@Controller('users')
export class UsersController {
  @Get()
  listUsers(@Query('page') page: number, @Query('limit') limit: number) {
    return []
  }

  @Get(':id')
  getUser(@Param('id') id: string) {
    return {}
  }

  @Post()
  createUser(@Body() dto: CreateUserDto) {
    return {}
  }

  @Put(':id')
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return {}
  }

  @Delete(':id')
  deleteUser(@Param('id') id: string) {
    return {}
  }
}
