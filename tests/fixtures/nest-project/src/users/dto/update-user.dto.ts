import { IsString, IsEmail, IsNumber, IsOptional, IsEnum, MinLength, Max } from 'class-validator'
import { UserRole } from './create-user.dto'

export class UpdateUserDto {
  @IsString()
  @MinLength(2)
  @IsOptional()
  name?: string

  @IsEmail()
  @IsOptional()
  email?: string

  @IsNumber()
  @IsOptional()
  @Max(150)
  age?: number

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole
}
