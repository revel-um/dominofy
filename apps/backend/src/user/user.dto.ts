// src/user/dto/create-user.dto.ts
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { encryptPassword } from 'src/helper/encryption';


export class CreateUserDto {
    @IsNotEmpty()
    name: string;

    @IsEmail()
    email: string;

    @MinLength(6)
    password: string;

    static async toEncryptedPasswordUser(user: Partial<CreateUserDto>): Promise<Partial<CreateUserDto>> {
        if(!user.password) return user;
        user.password = await encryptPassword(user.password);
        return user;
    }
}

