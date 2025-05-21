// src/user/dto/create-user.dto.ts
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { encryptPassword } from 'src/helper/encryption';


export class CreateUserDto {
    @IsNotEmpty()
    name: string;

    @IsEmail()
    @IsNotEmpty()
    email: string;

    @MinLength(6)
    @IsNotEmpty()
    password: string;

    static async toEncryptedPasswordUser(user: CreateUserDto) {
        if (!user.password) return user;
        user.password = await encryptPassword(user.password);
        return user;
    }
}

export class SigninUserDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @MinLength(6)
    @IsNotEmpty()
    password: string;
}


