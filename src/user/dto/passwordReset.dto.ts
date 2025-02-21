import { IsNotEmpty, IsString } from 'class-validator';

export class SendPasswordResetLinkDto {
    @IsString()
    @IsNotEmpty()
    username: string;
}

export class ResetUserPasswordDto {
    userName: string;

    @IsString()
    @IsNotEmpty()
    newPassword: string;
}


export class ForgotPasswordDto {

    @IsString()
    @IsNotEmpty()
    newPassword: string;

    @IsString()
    @IsNotEmpty()
    token: string;
}

export class learnerForgotPasswordDto {

    @IsString()
    @IsNotEmpty()
    newPassword: string;

    @IsString()
    @IsNotEmpty()
    userName: string;
}