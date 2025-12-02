import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { AiChatSender } from './ai-chat.entity';

export class CreateAiChatMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsIn(['user', 'ai'])
  sender: AiChatSender;
}
