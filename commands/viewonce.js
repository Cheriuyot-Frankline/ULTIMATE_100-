
/**
 * ULTIMATE_100
 * View Once Message Detector
 * Compatible with Baileys message structures
 */

function unwrapMessage(message) {
    let current = message;

    while (current) {
        if (current.ephemeralMessage?.message) {
            current = current.ephemeralMessage.message;
            continue;
        }

        if (current.viewOnceMessage?.message) {
            current = current.viewOnceMessage.message;
            continue;
        }

        if (current.viewOnceMessageV2?.message) {
            current = current.viewOnceMessageV2.message;
            continue;
        }

        if (current.viewOnceMessageV2Extension?.message) {
            current = current.viewOnceMessageV2Extension.message;
            continue;
        }

        break;
    }

    return current;
}

function detectViewOnce(message) {
    if (!message) return null;

    const wrappers = [
        "viewOnceMessage",
        "viewOnceMessageV2",
        "viewOnceMessageV2Extension"
    ];

    let current = message;
    let isViewOnce = false;

    while (current) {
        const wrapper = wrappers.find(
            key => current[key]?.message
        );

        if (wrapper) {
            isViewOnce = true;
            current = current[wrapper].message;
            continue;
        }

        if (current.ephemeralMessage?.message) {
            current = current.ephemeralMessage.message;
            continue;
        }

        break;
    }

    if (!isViewOnce) return null;

    if (current.imageMessage) {
        return {
            type: "image",
            caption: current.imageMessage.caption || ""
        };
    }

    if (current.videoMessage) {
        return {
            type: "video",
            caption: current.videoMessage.caption || ""
        };
    }

    return {
        type: "unknown",
        caption: ""
    };
}

module.exports = {
    unwrapMessage,
    detectViewOnce
};
