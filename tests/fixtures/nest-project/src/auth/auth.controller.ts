import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common'
import { LoginDto } from './dto/login.dto'

class JwtAuthGuard {}

@Controller('auth')
export class AuthController {
  @Post('login')
  login(@Body() dto: LoginDto) {
    return { accessToken: 'token' }
  }

  @Post('register')
  register(@Body() dto: LoginDto) {
    return {}
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile() {
    return {}
  }
}
