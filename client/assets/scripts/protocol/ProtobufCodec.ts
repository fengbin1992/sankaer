/**
 * ProtobufCodec.ts - JSON Packet 编解码
 * MVP 阶段使用 JSON 编码，后续可迁移到二进制 Protobuf
 */

export interface Packet {
    msg_type: number;
    seq: number;
    payload: any;
}

let _seq = 0;

/** 获取下一个序列号 */
function nextSeq(): number {
    return ++_seq;
}

/** 编码：JS 对象 → ArrayBuffer */
export function encode(msgType: number, payload?: any): ArrayBuffer {
    const pkt: Packet = {
        msg_type: msgType,
        seq: nextSeq(),
        payload: payload || {},
    };
    const json = JSON.stringify(pkt);
    const encoder = new TextEncoder();
    return encoder.encode(json).buffer;
}

/** 解码：ArrayBuffer → Packet */
export function decode(data: ArrayBuffer): Packet | null {
    try {
        const decoder = new TextDecoder();
        const json = decoder.decode(data);
        return JSON.parse(json) as Packet;
    } catch (e) {
        console.error('[Codec] 解码失败:', e);
        return null;
    }
}
