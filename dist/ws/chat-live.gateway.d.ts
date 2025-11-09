import { Server, Socket } from 'socket.io';
import { ChatService } from '../chat/chat.service';
export declare class ChatLiveGateway {
    private chatService;
    server: Server;
    private readonly logger;
    constructor(chatService: ChatService);
    handleMessage(msg: {
        from: number;
        to: number;
        text: string;
    }, client: Socket): Promise<void>;
}
