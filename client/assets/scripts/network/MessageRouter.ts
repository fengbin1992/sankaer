/**
 * MessageRouter.ts - 消息路由分发
 * 根据消息类型分发到对应的处理器
 */

import { decode, Packet } from '../protocol/ProtobufCodec';

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

    /** 分发二进制消息 */
    static dispatch(data: ArrayBuffer): void {
        const pkt = decode(data);
        if (!pkt) return;
        this._dispatchPacket(pkt);
    }

    /** 分发 JSON 文本消息 */
    static dispatchJSON(jsonStr: string): void {
        try {
            const pkt = JSON.parse(jsonStr) as Packet;
            this._dispatchPacket(pkt);
        } catch (e) {
            console.error('[MessageRouter] JSON 解析失败:', e);
        }
    }

    /** 内部分发 */
    private static _dispatchPacket(pkt: Packet): void {
        const handler = this._handlers.get(pkt.msg_type);
        if (handler) {
            handler(pkt.payload);
        } else {
            console.warn(`[MessageRouter] 未注册的消息类型: ${pkt.msg_type}`);
        }
    }
}
