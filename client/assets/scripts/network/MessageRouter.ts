/**
 * MessageRouter.ts - 消息路由分发
 * 根据消息类型分发到对应的处理器
 */

type MessageHandler = (payload: any) => void;

export class MessageRouter {
    private static _handlers: Map<number, MessageHandler> = new Map();

    /** 注册消息处理器 */
    static register(msgType: number, handler: MessageHandler): void {
        this._handlers.set(msgType, handler);
    }

    /** 注销消息处理器 */
    static unregister(msgType: number): void {
        this._handlers.delete(msgType);
    }

    /** 分发消息 */
    static dispatch(data: ArrayBuffer): void {
        // TODO: Protobuf 解码 Packet，提取 msg_type 和 payload
        // const packet = Packet.decode(new Uint8Array(data));
        // const handler = this._handlers.get(packet.msgType);
        // if (handler) {
        //     handler(packet.payload);
        // } else {
        //     console.warn(`[MessageRouter] 未注册的消息类型: ${packet.msgType}`);
        // }
    }
}
