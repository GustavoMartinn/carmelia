import { IsString, IsEmail, IsNumber, IsOptional, IsEnum, MinLength, Max } from 'class-validator'

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator',
}

export class AddressDto {
  @IsString()
  street: string

  @IsString()
  city: string

  @IsString()
  @MinLength(5)
  zipCode: string
}

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name: string

  @IsEmail()
  email: string

  @IsNumber()
  @IsOptional()
  @Max(150)
  age?: number

  @IsEnum(UserRole)
  role: UserRole

  address: AddressDto
}
