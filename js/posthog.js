var PostHogPersistedProperty;
(function (PostHogPersistedProperty) {
    PostHogPersistedProperty["AnonymousId"] = "anonymous_id";
    PostHogPersistedProperty["DistinctId"] = "distinct_id";
    PostHogPersistedProperty["Props"] = "props";
    PostHogPersistedProperty["FeatureFlagDetails"] = "feature_flag_details";
    PostHogPersistedProperty["FeatureFlags"] = "feature_flags";
    PostHogPersistedProperty["FeatureFlagPayloads"] = "feature_flag_payloads";
    PostHogPersistedProperty["BootstrapFeatureFlagDetails"] = "bootstrap_feature_flag_details";
    PostHogPersistedProperty["BootstrapFeatureFlags"] = "bootstrap_feature_flags";
    PostHogPersistedProperty["BootstrapFeatureFlagPayloads"] = "bootstrap_feature_flag_payloads";
    PostHogPersistedProperty["OverrideFeatureFlags"] = "override_feature_flags";
    PostHogPersistedProperty["Queue"] = "queue";
    PostHogPersistedProperty["OptedOut"] = "opted_out";
    PostHogPersistedProperty["SessionId"] = "session_id";
    PostHogPersistedProperty["SessionLastTimestamp"] = "session_timestamp";
    PostHogPersistedProperty["PersonProperties"] = "person_properties";
    PostHogPersistedProperty["GroupProperties"] = "group_properties";
    PostHogPersistedProperty["InstalledAppBuild"] = "installed_app_build";
    PostHogPersistedProperty["InstalledAppVersion"] = "installed_app_version";
    PostHogPersistedProperty["SessionReplay"] = "session_replay";
    PostHogPersistedProperty["DecideEndpointWasHit"] = "decide_endpoint_was_hit";
    PostHogPersistedProperty["SurveyLastSeenDate"] = "survey_last_seen_date";
    PostHogPersistedProperty["SurveysSeen"] = "surveys_seen";
    PostHogPersistedProperty["Surveys"] = "surveys";
    PostHogPersistedProperty["RemoteConfig"] = "remote_config";
})(PostHogPersistedProperty || (PostHogPersistedProperty = {}));

const normalizeDecideResponse = (decideResponse) => {
    if ('flags' in decideResponse) {
        // Convert v4 format to v3 format
        const featureFlags = getFlagValuesFromFlags(decideResponse.flags);
        const featureFlagPayloads = getPayloadsFromFlags(decideResponse.flags);
        return {
            ...decideResponse,
            featureFlags,
            featureFlagPayloads,
        };
    }
    else {
        // Convert v3 format to v4 format
        const featureFlags = decideResponse.featureFlags ?? {};
        const featureFlagPayloads = Object.fromEntries(Object.entries(decideResponse.featureFlagPayloads || {}).map(([k, v]) => [k, parsePayload(v)]));
        const flags = Object.fromEntries(Object.entries(featureFlags).map(([key, value]) => [
            key,
            getFlagDetailFromFlagAndPayload(key, value, featureFlagPayloads[key]),
        ]));
        return {
            ...decideResponse,
            featureFlags,
            featureFlagPayloads,
            flags,
        };
    }
};
function getFlagDetailFromFlagAndPayload(key, value, payload) {
    return {
        key: key,
        enabled: typeof value === 'string' ? true : value,
        variant: typeof value === 'string' ? value : undefined,
        reason: undefined,
        metadata: {
            id: undefined,
            version: undefined,
            payload: payload ? JSON.stringify(payload) : undefined,
            description: undefined,
        },
    };
}
/**
 * Get the flag values from the flags v4 response.
 * @param flags - The flags
 * @returns The flag values
 */
const getFlagValuesFromFlags = (flags) => {
    return Object.fromEntries(Object.entries(flags ?? {})
        .map(([key, detail]) => [key, getFeatureFlagValue(detail)])
        .filter(([, value]) => value !== undefined));
};
/**
 * Get the payloads from the flags v4 response.
 * @param flags - The flags
 * @returns The payloads
 */
const getPayloadsFromFlags = (flags) => {
    const safeFlags = flags ?? {};
    return Object.fromEntries(Object.keys(safeFlags)
        .filter((flag) => {
        const details = safeFlags[flag];
        return details.enabled && details.metadata && details.metadata.payload !== undefined;
    })
        .map((flag) => {
        const payload = safeFlags[flag].metadata?.payload;
        return [flag, payload ? parsePayload(payload) : undefined];
    }));
};
const getFeatureFlagValue = (detail) => {
    return detail === undefined ? undefined : detail.variant ?? detail.enabled;
};
const parsePayload = (response) => {
    if (typeof response !== 'string') {
        return response;
    }
    try {
        return JSON.parse(response);
    }
    catch {
        return response;
    }
};
/**
 * Get the normalized flag details from the flags and payloads.
 * This is used to convert things like boostrap and stored feature flags and payloads to the v4 format.
 * This helps us ensure backwards compatibility.
 * If a key exists in the featureFlagPayloads that is not in the featureFlags, we treat it as a true feature flag.
 *
 * @param featureFlags - The feature flags
 * @param featureFlagPayloads - The feature flag payloads
 * @returns The normalized flag details
 */
const createDecideResponseFromFlagsAndPayloads = (featureFlags, featureFlagPayloads) => {
    // If a feature flag payload key is not in the feature flags, we treat it as true feature flag.
    const allKeys = [...new Set([...Object.keys(featureFlags ?? {}), ...Object.keys(featureFlagPayloads ?? {})])];
    const enabledFlags = allKeys
        .filter((flag) => !!featureFlags[flag] || !!featureFlagPayloads[flag])
        .reduce((res, key) => ((res[key] = featureFlags[key] ?? true), res), {});
    const flagDetails = {
        featureFlags: enabledFlags,
        featureFlagPayloads: featureFlagPayloads ?? {},
    };
    return normalizeDecideResponse(flagDetails);
};
const updateFlagValue = (flag, value) => {
    return {
        ...flag,
        enabled: getEnabledFromValue(value),
        variant: getVariantFromValue(value),
    };
};
function getEnabledFromValue(value) {
    return typeof value === 'string' ? true : value;
}
function getVariantFromValue(value) {
    return typeof value === 'string' ? value : undefined;
}

function assert(truthyValue, message) {
    if (!truthyValue || typeof truthyValue !== 'string' || isEmpty(truthyValue)) {
        throw new Error(message);
    }
}
function isEmpty(truthyValue) {
    if (truthyValue.trim().length === 0) {
        return true;
    }
    return false;
}
function removeTrailingSlash(url) {
    return url?.replace(/\/+$/, '');
}
async function retriable(fn, props) {
    let lastError = null;
    for (let i = 0; i < props.retryCount + 1; i++) {
        if (i > 0) {
            // don't wait when it's the last try
            await new Promise((r) => setTimeout(r, props.retryDelay));
        }
        try {
            const res = await fn();
            return res;
        }
        catch (e) {
            lastError = e;
            if (!props.retryCheck(e)) {
                throw e;
            }
        }
    }
    throw lastError;
}
function currentTimestamp() {
    return new Date().getTime();
}
function currentISOTime() {
    return new Date().toISOString();
}
function safeSetTimeout(fn, timeout) {
    // NOTE: we use this so rarely that it is totally fine to do `safeSetTimeout(fn, 0)``
    // rather than setImmediate.
    const t = setTimeout(fn, timeout);
    // We unref if available to prevent Node.js hanging on exit
    t?.unref && t?.unref();
    return t;
}
const isError = (x) => {
    return x instanceof Error;
};
function getFetch() {
    return typeof fetch !== 'undefined' ? fetch : typeof global.fetch !== 'undefined' ? global.fetch : undefined;
}
// copied from: https://github.com/PostHog/posthog-js/blob/main/react/src/utils/type-utils.ts#L4
const isFunction = function (f) {
    return typeof f === 'function';
};

// Copyright (c) 2013 Pieroxy <pieroxy@pieroxy.net>
// This work is free. You can redistribute it and/or modify it
// under the terms of the WTFPL, Version 2
// For more information see LICENSE.txt or http://www.wtfpl.net/
//
// For more information, the home page:
// http://pieroxy.net/blog/pages/lz-string/testing.html
//
// LZ-based compression algorithm, version 1.4.4
// private property
const f = String.fromCharCode;
const keyStrBase64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
const baseReverseDic = {};
function getBaseValue(alphabet, character) {
    if (!baseReverseDic[alphabet]) {
        baseReverseDic[alphabet] = {};
        for (let i = 0; i < alphabet.length; i++) {
            baseReverseDic[alphabet][alphabet.charAt(i)] = i;
        }
    }
    return baseReverseDic[alphabet][character];
}
const LZString = {
    compressToBase64: function (input) {
        if (input == null) {
            return '';
        }
        const res = LZString._compress(input, 6, function (a) {
            return keyStrBase64.charAt(a);
        });
        switch (res.length % 4 // To produce valid Base64
        ) {
            default: // When could this happen ?
            case 0:
                return res;
            case 1:
                return res + '===';
            case 2:
                return res + '==';
            case 3:
                return res + '=';
        }
    },
    decompressFromBase64: function (input) {
        if (input == null) {
            return '';
        }
        if (input == '') {
            return null;
        }
        return LZString._decompress(input.length, 32, function (index) {
            return getBaseValue(keyStrBase64, input.charAt(index));
        });
    },
    compress: function (uncompressed) {
        return LZString._compress(uncompressed, 16, function (a) {
            return f(a);
        });
    },
    _compress: function (uncompressed, bitsPerChar, getCharFromInt) {
        if (uncompressed == null) {
            return '';
        }
        const context_dictionary = {}, context_dictionaryToCreate = {}, context_data = [];
        let i, value, context_c = '', context_wc = '', context_w = '', context_enlargeIn = 2, // Compensate for the first entry which should not count
        context_dictSize = 3, context_numBits = 2, context_data_val = 0, context_data_position = 0, ii;
        for (ii = 0; ii < uncompressed.length; ii += 1) {
            context_c = uncompressed.charAt(ii);
            if (!Object.prototype.hasOwnProperty.call(context_dictionary, context_c)) {
                context_dictionary[context_c] = context_dictSize++;
                context_dictionaryToCreate[context_c] = true;
            }
            context_wc = context_w + context_c;
            if (Object.prototype.hasOwnProperty.call(context_dictionary, context_wc)) {
                context_w = context_wc;
            }
            else {
                if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
                    if (context_w.charCodeAt(0) < 256) {
                        for (i = 0; i < context_numBits; i++) {
                            context_data_val = context_data_val << 1;
                            if (context_data_position == bitsPerChar - 1) {
                                context_data_position = 0;
                                context_data.push(getCharFromInt(context_data_val));
                                context_data_val = 0;
                            }
                            else {
                                context_data_position++;
                            }
                        }
                        value = context_w.charCodeAt(0);
                        for (i = 0; i < 8; i++) {
                            context_data_val = (context_data_val << 1) | (value & 1);
                            if (context_data_position == bitsPerChar - 1) {
                                context_data_position = 0;
                                context_data.push(getCharFromInt(context_data_val));
                                context_data_val = 0;
                            }
                            else {
                                context_data_position++;
                            }
                            value = value >> 1;
                        }
                    }
                    else {
                        value = 1;
                        for (i = 0; i < context_numBits; i++) {
                            context_data_val = (context_data_val << 1) | value;
                            if (context_data_position == bitsPerChar - 1) {
                                context_data_position = 0;
                                context_data.push(getCharFromInt(context_data_val));
                                context_data_val = 0;
                            }
                            else {
                                context_data_position++;
                            }
                            value = 0;
                        }
                        value = context_w.charCodeAt(0);
                        for (i = 0; i < 16; i++) {
                            context_data_val = (context_data_val << 1) | (value & 1);
                            if (context_data_position == bitsPerChar - 1) {
                                context_data_position = 0;
                                context_data.push(getCharFromInt(context_data_val));
                                context_data_val = 0;
                            }
                            else {
                                context_data_position++;
                            }
                            value = value >> 1;
                        }
                    }
                    context_enlargeIn--;
                    if (context_enlargeIn == 0) {
                        context_enlargeIn = Math.pow(2, context_numBits);
                        context_numBits++;
                    }
                    delete context_dictionaryToCreate[context_w];
                }
                else {
                    value = context_dictionary[context_w];
                    for (i = 0; i < context_numBits; i++) {
                        context_data_val = (context_data_val << 1) | (value & 1);
                        if (context_data_position == bitsPerChar - 1) {
                            context_data_position = 0;
                            context_data.push(getCharFromInt(context_data_val));
                            context_data_val = 0;
                        }
                        else {
                            context_data_position++;
                        }
                        value = value >> 1;
                    }
                }
                context_enlargeIn--;
                if (context_enlargeIn == 0) {
                    context_enlargeIn = Math.pow(2, context_numBits);
                    context_numBits++;
                }
                // Add wc to the dictionary.
                context_dictionary[context_wc] = context_dictSize++;
                context_w = String(context_c);
            }
        }
        // Output the code for w.
        if (context_w !== '') {
            if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
                if (context_w.charCodeAt(0) < 256) {
                    for (i = 0; i < context_numBits; i++) {
                        context_data_val = context_data_val << 1;
                        if (context_data_position == bitsPerChar - 1) {
                            context_data_position = 0;
                            context_data.push(getCharFromInt(context_data_val));
                            context_data_val = 0;
                        }
                        else {
                            context_data_position++;
                        }
                    }
                    value = context_w.charCodeAt(0);
                    for (i = 0; i < 8; i++) {
                        context_data_val = (context_data_val << 1) | (value & 1);
                        if (context_data_position == bitsPerChar - 1) {
                            context_data_position = 0;
                            context_data.push(getCharFromInt(context_data_val));
                            context_data_val = 0;
                        }
                        else {
                            context_data_position++;
                        }
                        value = value >> 1;
                    }
                }
                else {
                    value = 1;
                    for (i = 0; i < context_numBits; i++) {
                        context_data_val = (context_data_val << 1) | value;
                        if (context_data_position == bitsPerChar - 1) {
                            context_data_position = 0;
                            context_data.push(getCharFromInt(context_data_val));
                            context_data_val = 0;
                        }
                        else {
                            context_data_position++;
                        }
                        value = 0;
                    }
                    value = context_w.charCodeAt(0);
                    for (i = 0; i < 16; i++) {
                        context_data_val = (context_data_val << 1) | (value & 1);
                        if (context_data_position == bitsPerChar - 1) {
                            context_data_position = 0;
                            context_data.push(getCharFromInt(context_data_val));
                            context_data_val = 0;
                        }
                        else {
                            context_data_position++;
                        }
                        value = value >> 1;
                    }
                }
                context_enlargeIn--;
                if (context_enlargeIn == 0) {
                    context_enlargeIn = Math.pow(2, context_numBits);
                    context_numBits++;
                }
                delete context_dictionaryToCreate[context_w];
            }
            else {
                value = context_dictionary[context_w];
                for (i = 0; i < context_numBits; i++) {
                    context_data_val = (context_data_val << 1) | (value & 1);
                    if (context_data_position == bitsPerChar - 1) {
                        context_data_position = 0;
                        context_data.push(getCharFromInt(context_data_val));
                        context_data_val = 0;
                    }
                    else {
                        context_data_position++;
                    }
                    value = value >> 1;
                }
            }
            context_enlargeIn--;
            if (context_enlargeIn == 0) {
                context_enlargeIn = Math.pow(2, context_numBits);
                context_numBits++;
            }
        }
        // Mark the end of the stream
        value = 2;
        for (i = 0; i < context_numBits; i++) {
            context_data_val = (context_data_val << 1) | (value & 1);
            if (context_data_position == bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
            }
            else {
                context_data_position++;
            }
            value = value >> 1;
        }
        // Flush the last char
        while (true) {
            context_data_val = context_data_val << 1;
            if (context_data_position == bitsPerChar - 1) {
                context_data.push(getCharFromInt(context_data_val));
                break;
            }
            else {
                context_data_position++;
            }
        }
        return context_data.join('');
    },
    decompress: function (compressed) {
        if (compressed == null) {
            return '';
        }
        if (compressed == '') {
            return null;
        }
        return LZString._decompress(compressed.length, 32768, function (index) {
            return compressed.charCodeAt(index);
        });
    },
    _decompress: function (length, resetValue, getNextValue) {
        const dictionary = [], result = [], data = { val: getNextValue(0), position: resetValue, index: 1 };
        let enlargeIn = 4, dictSize = 4, numBits = 3, entry = '', i, w, bits, resb, maxpower, power, c;
        for (i = 0; i < 3; i += 1) {
            dictionary[i] = i;
        }
        bits = 0;
        maxpower = Math.pow(2, 2);
        power = 1;
        while (power != maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
                data.position = resetValue;
                data.val = getNextValue(data.index++);
            }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        switch ((bits)) {
            case 0:
                bits = 0;
                maxpower = Math.pow(2, 8);
                power = 1;
                while (power != maxpower) {
                    resb = data.val & data.position;
                    data.position >>= 1;
                    if (data.position == 0) {
                        data.position = resetValue;
                        data.val = getNextValue(data.index++);
                    }
                    bits |= (resb > 0 ? 1 : 0) * power;
                    power <<= 1;
                }
                c = f(bits);
                break;
            case 1:
                bits = 0;
                maxpower = Math.pow(2, 16);
                power = 1;
                while (power != maxpower) {
                    resb = data.val & data.position;
                    data.position >>= 1;
                    if (data.position == 0) {
                        data.position = resetValue;
                        data.val = getNextValue(data.index++);
                    }
                    bits |= (resb > 0 ? 1 : 0) * power;
                    power <<= 1;
                }
                c = f(bits);
                break;
            case 2:
                return '';
        }
        dictionary[3] = c;
        w = c;
        result.push(c);
        while (true) {
            if (data.index > length) {
                return '';
            }
            bits = 0;
            maxpower = Math.pow(2, numBits);
            power = 1;
            while (power != maxpower) {
                resb = data.val & data.position;
                data.position >>= 1;
                if (data.position == 0) {
                    data.position = resetValue;
                    data.val = getNextValue(data.index++);
                }
                bits |= (resb > 0 ? 1 : 0) * power;
                power <<= 1;
            }
            switch ((c = bits)) {
                case 0:
                    bits = 0;
                    maxpower = Math.pow(2, 8);
                    power = 1;
                    while (power != maxpower) {
                        resb = data.val & data.position;
                        data.position >>= 1;
                        if (data.position == 0) {
                            data.position = resetValue;
                            data.val = getNextValue(data.index++);
                        }
                        bits |= (resb > 0 ? 1 : 0) * power;
                        power <<= 1;
                    }
                    dictionary[dictSize++] = f(bits);
                    c = dictSize - 1;
                    enlargeIn--;
                    break;
                case 1:
                    bits = 0;
                    maxpower = Math.pow(2, 16);
                    power = 1;
                    while (power != maxpower) {
                        resb = data.val & data.position;
                        data.position >>= 1;
                        if (data.position == 0) {
                            data.position = resetValue;
                            data.val = getNextValue(data.index++);
                        }
                        bits |= (resb > 0 ? 1 : 0) * power;
                        power <<= 1;
                    }
                    dictionary[dictSize++] = f(bits);
                    c = dictSize - 1;
                    enlargeIn--;
                    break;
                case 2:
                    return result.join('');
            }
            if (enlargeIn == 0) {
                enlargeIn = Math.pow(2, numBits);
                numBits++;
            }
            if (dictionary[c]) {
                entry = dictionary[c];
            }
            else {
                if (c === dictSize) {
                    entry = w + w.charAt(0);
                }
                else {
                    return null;
                }
            }
            result.push(entry);
            // Add w+entry[0] to the dictionary.
            dictionary[dictSize++] = w + entry.charAt(0);
            enlargeIn--;
            w = entry;
            if (enlargeIn == 0) {
                enlargeIn = Math.pow(2, numBits);
                numBits++;
            }
        }
    },
};

class SimpleEventEmitter {
    constructor() {
        this.events = {};
        this.events = {};
    }
    on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
        return () => {
            this.events[event] = this.events[event].filter((x) => x !== listener);
        };
    }
    emit(event, payload) {
        for (const listener of this.events[event] || []) {
            listener(payload);
        }
        for (const listener of this.events['*'] || []) {
            listener(event, payload);
        }
    }
}

// vendor from: https://github.com/LiosK/uuidv7/blob/f30b7a7faff73afbce0b27a46c638310f96912ba/src/index.ts
// https://github.com/LiosK/uuidv7#license
/**
 * uuidv7: An experimental implementation of the proposed UUID Version 7
 *
 * @license Apache-2.0
 * @copyright 2021-2023 LiosK
 * @packageDocumentation
 */
const DIGITS = "0123456789abcdef";
/** Represents a UUID as a 16-byte byte array. */
class UUID {
    /** @param bytes - The 16-byte byte array representation. */
    constructor(bytes) {
        this.bytes = bytes;
    }
    /**
     * Creates an object from the internal representation, a 16-byte byte array
     * containing the binary UUID representation in the big-endian byte order.
     *
     * This method does NOT shallow-copy the argument, and thus the created object
     * holds the reference to the underlying buffer.
     *
     * @throws TypeError if the length of the argument is not 16.
     */
    static ofInner(bytes) {
        if (bytes.length !== 16) {
            throw new TypeError("not 128-bit length");
        }
        else {
            return new UUID(bytes);
        }
    }
    /**
     * Builds a byte array from UUIDv7 field values.
     *
     * @param unixTsMs - A 48-bit `unix_ts_ms` field value.
     * @param randA - A 12-bit `rand_a` field value.
     * @param randBHi - The higher 30 bits of 62-bit `rand_b` field value.
     * @param randBLo - The lower 32 bits of 62-bit `rand_b` field value.
     * @throws RangeError if any field value is out of the specified range.
     */
    static fromFieldsV7(unixTsMs, randA, randBHi, randBLo) {
        if (!Number.isInteger(unixTsMs) ||
            !Number.isInteger(randA) ||
            !Number.isInteger(randBHi) ||
            !Number.isInteger(randBLo) ||
            unixTsMs < 0 ||
            randA < 0 ||
            randBHi < 0 ||
            randBLo < 0 ||
            unixTsMs > 281474976710655 ||
            randA > 0xfff ||
            randBHi > 1073741823 ||
            randBLo > 4294967295) {
            throw new RangeError("invalid field value");
        }
        const bytes = new Uint8Array(16);
        bytes[0] = unixTsMs / 2 ** 40;
        bytes[1] = unixTsMs / 2 ** 32;
        bytes[2] = unixTsMs / 2 ** 24;
        bytes[3] = unixTsMs / 2 ** 16;
        bytes[4] = unixTsMs / 2 ** 8;
        bytes[5] = unixTsMs;
        bytes[6] = 0x70 | (randA >>> 8);
        bytes[7] = randA;
        bytes[8] = 0x80 | (randBHi >>> 24);
        bytes[9] = randBHi >>> 16;
        bytes[10] = randBHi >>> 8;
        bytes[11] = randBHi;
        bytes[12] = randBLo >>> 24;
        bytes[13] = randBLo >>> 16;
        bytes[14] = randBLo >>> 8;
        bytes[15] = randBLo;
        return new UUID(bytes);
    }
    /**
     * Builds a byte array from a string representation.
     *
     * This method accepts the following formats:
     *
     * - 32-digit hexadecimal format without hyphens: `0189dcd553117d408db09496a2eef37b`
     * - 8-4-4-4-12 hyphenated format: `0189dcd5-5311-7d40-8db0-9496a2eef37b`
     * - Hyphenated format with surrounding braces: `{0189dcd5-5311-7d40-8db0-9496a2eef37b}`
     * - RFC 4122 URN format: `urn:uuid:0189dcd5-5311-7d40-8db0-9496a2eef37b`
     *
     * Leading and trailing whitespaces represents an error.
     *
     * @throws SyntaxError if the argument could not parse as a valid UUID string.
     */
    static parse(uuid) {
        let hex = undefined;
        switch (uuid.length) {
            case 32:
                hex = /^[0-9a-f]{32}$/i.exec(uuid)?.[0];
                break;
            case 36:
                hex =
                    /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/i
                        .exec(uuid)
                        ?.slice(1, 6)
                        .join("");
                break;
            case 38:
                hex =
                    /^\{([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\}$/i
                        .exec(uuid)
                        ?.slice(1, 6)
                        .join("");
                break;
            case 45:
                hex =
                    /^urn:uuid:([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/i
                        .exec(uuid)
                        ?.slice(1, 6)
                        .join("");
                break;
        }
        if (hex) {
            const inner = new Uint8Array(16);
            for (let i = 0; i < 16; i += 4) {
                const n = parseInt(hex.substring(2 * i, 2 * i + 8), 16);
                inner[i + 0] = n >>> 24;
                inner[i + 1] = n >>> 16;
                inner[i + 2] = n >>> 8;
                inner[i + 3] = n;
            }
            return new UUID(inner);
        }
        else {
            throw new SyntaxError("could not parse UUID string");
        }
    }
    /**
     * @returns The 8-4-4-4-12 canonical hexadecimal string representation
     * (`0189dcd5-5311-7d40-8db0-9496a2eef37b`).
     */
    toString() {
        let text = "";
        for (let i = 0; i < this.bytes.length; i++) {
            text += DIGITS.charAt(this.bytes[i] >>> 4);
            text += DIGITS.charAt(this.bytes[i] & 0xf);
            if (i === 3 || i === 5 || i === 7 || i === 9) {
                text += "-";
            }
        }
        return text;
    }
    /**
     * @returns The 32-digit hexadecimal representation without hyphens
     * (`0189dcd553117d408db09496a2eef37b`).
     */
    toHex() {
        let text = "";
        for (let i = 0; i < this.bytes.length; i++) {
            text += DIGITS.charAt(this.bytes[i] >>> 4);
            text += DIGITS.charAt(this.bytes[i] & 0xf);
        }
        return text;
    }
    /** @returns The 8-4-4-4-12 canonical hexadecimal string representation. */
    toJSON() {
        return this.toString();
    }
    /**
     * Reports the variant field value of the UUID or, if appropriate, "NIL" or
     * "MAX".
     *
     * For convenience, this method reports "NIL" or "MAX" if `this` represents
     * the Nil or Max UUID, although the Nil and Max UUIDs are technically
     * subsumed under the variants `0b0` and `0b111`, respectively.
     */
    getVariant() {
        const n = this.bytes[8] >>> 4;
        if (n < 0) {
            throw new Error("unreachable");
        }
        else if (n <= 0b0111) {
            return this.bytes.every((e) => e === 0) ? "NIL" : "VAR_0";
        }
        else if (n <= 0b1011) {
            return "VAR_10";
        }
        else if (n <= 0b1101) {
            return "VAR_110";
        }
        else if (n <= 0b1111) {
            return this.bytes.every((e) => e === 0xff) ? "MAX" : "VAR_RESERVED";
        }
        else {
            throw new Error("unreachable");
        }
    }
    /**
     * Returns the version field value of the UUID or `undefined` if the UUID does
     * not have the variant field value of `0b10`.
     */
    getVersion() {
        return this.getVariant() === "VAR_10" ? this.bytes[6] >>> 4 : undefined;
    }
    /** Creates an object from `this`. */
    clone() {
        return new UUID(this.bytes.slice(0));
    }
    /** Returns true if `this` is equivalent to `other`. */
    equals(other) {
        return this.compareTo(other) === 0;
    }
    /**
     * Returns a negative integer, zero, or positive integer if `this` is less
     * than, equal to, or greater than `other`, respectively.
     */
    compareTo(other) {
        for (let i = 0; i < 16; i++) {
            const diff = this.bytes[i] - other.bytes[i];
            if (diff !== 0) {
                return Math.sign(diff);
            }
        }
        return 0;
    }
}
/**
 * Encapsulates the monotonic counter state.
 *
 * This class provides APIs to utilize a separate counter state from that of the
 * global generator used by {@link uuidv7} and {@link uuidv7obj}. In addition to
 * the default {@link generate} method, this class has {@link generateOrAbort}
 * that is useful to absolutely guarantee the monotonically increasing order of
 * generated UUIDs. See their respective documentation for details.
 */
class V7Generator {
    /**
     * Creates a generator object with the default random number generator, or
     * with the specified one if passed as an argument. The specified random
     * number generator should be cryptographically strong and securely seeded.
     */
    constructor(randomNumberGenerator) {
        this.timestamp = 0;
        this.counter = 0;
        this.random = randomNumberGenerator ?? getDefaultRandom();
    }
    /**
     * Generates a new UUIDv7 object from the current timestamp, or resets the
     * generator upon significant timestamp rollback.
     *
     * This method returns a monotonically increasing UUID by reusing the previous
     * timestamp even if the up-to-date timestamp is smaller than the immediately
     * preceding UUID's. However, when such a clock rollback is considered
     * significant (i.e., by more than ten seconds), this method resets the
     * generator and returns a new UUID based on the given timestamp, breaking the
     * increasing order of UUIDs.
     *
     * See {@link generateOrAbort} for the other mode of generation and
     * {@link generateOrResetCore} for the low-level primitive.
     */
    generate() {
        return this.generateOrResetCore(Date.now(), 10000);
    }
    /**
     * Generates a new UUIDv7 object from the current timestamp, or returns
     * `undefined` upon significant timestamp rollback.
     *
     * This method returns a monotonically increasing UUID by reusing the previous
     * timestamp even if the up-to-date timestamp is smaller than the immediately
     * preceding UUID's. However, when such a clock rollback is considered
     * significant (i.e., by more than ten seconds), this method aborts and
     * returns `undefined` immediately.
     *
     * See {@link generate} for the other mode of generation and
     * {@link generateOrAbortCore} for the low-level primitive.
     */
    generateOrAbort() {
        return this.generateOrAbortCore(Date.now(), 10000);
    }
    /**
     * Generates a new UUIDv7 object from the `unixTsMs` passed, or resets the
     * generator upon significant timestamp rollback.
     *
     * This method is equivalent to {@link generate} except that it takes a custom
     * timestamp and clock rollback allowance.
     *
     * @param rollbackAllowance - The amount of `unixTsMs` rollback that is
     * considered significant. A suggested value is `10_000` (milliseconds).
     * @throws RangeError if `unixTsMs` is not a 48-bit positive integer.
     */
    generateOrResetCore(unixTsMs, rollbackAllowance) {
        let value = this.generateOrAbortCore(unixTsMs, rollbackAllowance);
        if (value === undefined) {
            // reset state and resume
            this.timestamp = 0;
            value = this.generateOrAbortCore(unixTsMs, rollbackAllowance);
        }
        return value;
    }
    /**
     * Generates a new UUIDv7 object from the `unixTsMs` passed, or returns
     * `undefined` upon significant timestamp rollback.
     *
     * This method is equivalent to {@link generateOrAbort} except that it takes a
     * custom timestamp and clock rollback allowance.
     *
     * @param rollbackAllowance - The amount of `unixTsMs` rollback that is
     * considered significant. A suggested value is `10_000` (milliseconds).
     * @throws RangeError if `unixTsMs` is not a 48-bit positive integer.
     */
    generateOrAbortCore(unixTsMs, rollbackAllowance) {
        const MAX_COUNTER = 4398046511103;
        if (!Number.isInteger(unixTsMs) ||
            unixTsMs < 1 ||
            unixTsMs > 281474976710655) {
            throw new RangeError("`unixTsMs` must be a 48-bit positive integer");
        }
        else if (rollbackAllowance < 0 || rollbackAllowance > 281474976710655) {
            throw new RangeError("`rollbackAllowance` out of reasonable range");
        }
        if (unixTsMs > this.timestamp) {
            this.timestamp = unixTsMs;
            this.resetCounter();
        }
        else if (unixTsMs + rollbackAllowance >= this.timestamp) {
            // go on with previous timestamp if new one is not much smaller
            this.counter++;
            if (this.counter > MAX_COUNTER) {
                // increment timestamp at counter overflow
                this.timestamp++;
                this.resetCounter();
            }
        }
        else {
            // abort if clock went backwards to unbearable extent
            return undefined;
        }
        return UUID.fromFieldsV7(this.timestamp, Math.trunc(this.counter / 2 ** 30), this.counter & (2 ** 30 - 1), this.random.nextUint32());
    }
    /** Initializes the counter at a 42-bit random integer. */
    resetCounter() {
        this.counter =
            this.random.nextUint32() * 0x400 + (this.random.nextUint32() & 0x3ff);
    }
    /**
     * Generates a new UUIDv4 object utilizing the random number generator inside.
     *
     * @internal
     */
    generateV4() {
        const bytes = new Uint8Array(Uint32Array.of(this.random.nextUint32(), this.random.nextUint32(), this.random.nextUint32(), this.random.nextUint32()).buffer);
        bytes[6] = 0x40 | (bytes[6] >>> 4);
        bytes[8] = 0x80 | (bytes[8] >>> 2);
        return UUID.ofInner(bytes);
    }
}
/** A global flag to force use of cryptographically strong RNG. */
// declare const UUIDV7_DENY_WEAK_RNG: boolean;
/** Returns the default random number generator available in the environment. */
const getDefaultRandom = () => {
    // fix: crypto isn't available in react-native, always use Math.random
    //   // detect Web Crypto API
    //   if (
    //     typeof crypto !== "undefined" &&
    //     typeof crypto.getRandomValues !== "undefined"
    //   ) {
    //     return new BufferedCryptoRandom();
    //   } else {
    //     // fall back on Math.random() unless the flag is set to true
    //     if (typeof UUIDV7_DENY_WEAK_RNG !== "undefined" && UUIDV7_DENY_WEAK_RNG) {
    //       throw new Error("no cryptographically strong RNG available");
    //     }
    //     return {
    //       nextUint32: (): number =>
    //         Math.trunc(Math.random() * 0x1_0000) * 0x1_0000 +
    //         Math.trunc(Math.random() * 0x1_0000),
    //     };
    //   }
    return {
        nextUint32: () => Math.trunc(Math.random() * 65536) * 65536 +
            Math.trunc(Math.random() * 65536),
    };
};
// /**
//  * Wraps `crypto.getRandomValues()` to enable buffering; this uses a small
//  * buffer by default to avoid both unbearable throughput decline in some
//  * environments and the waste of time and space for unused values.
//  */
// class BufferedCryptoRandom {
//   private readonly buffer = new Uint32Array(8);
//   private cursor = 0xffff;
//   nextUint32(): number {
//     if (this.cursor >= this.buffer.length) {
//       crypto.getRandomValues(this.buffer);
//       this.cursor = 0;
//     }
//     return this.buffer[this.cursor++];
//   }
// }
let defaultGenerator;
/**
 * Generates a UUIDv7 string.
 *
 * @returns The 8-4-4-4-12 canonical hexadecimal string representation
 * ("xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx").
 */
const uuidv7 = () => uuidv7obj().toString();
/** Generates a UUIDv7 object. */
const uuidv7obj = () => (defaultGenerator || (defaultGenerator = new V7Generator())).generate();

class PostHogFetchHttpError extends Error {
    constructor(response) {
        super('HTTP error while fetching PostHog: ' + response.status);
        this.response = response;
        this.name = 'PostHogFetchHttpError';
    }
}
class PostHogFetchNetworkError extends Error {
    constructor(error) {
        // TRICKY: "cause" is a newer property but is just ignored otherwise. Cast to any to ignore the type issue.
        // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
        // @ts-ignore
        super('Network error while fetching PostHog', error instanceof Error ? { cause: error } : {});
        this.error = error;
        this.name = 'PostHogFetchNetworkError';
    }
}
function isPostHogFetchError(err) {
    return typeof err === 'object' && (err instanceof PostHogFetchHttpError || err instanceof PostHogFetchNetworkError);
}
var QuotaLimitedFeature;
(function (QuotaLimitedFeature) {
    QuotaLimitedFeature["FeatureFlags"] = "feature_flags";
    QuotaLimitedFeature["Recordings"] = "recordings";
})(QuotaLimitedFeature || (QuotaLimitedFeature = {}));
class PostHogCoreStateless {
    constructor(apiKey, options) {
        this.flushPromise = null;
        this.pendingPromises = {};
        // internal
        this._events = new SimpleEventEmitter();
        this._isInitialized = false;
        assert(apiKey, "You must pass your PostHog project's api key.");
        this.apiKey = apiKey;
        this.host = removeTrailingSlash(options?.host || 'https://us.i.posthog.com');
        this.flushAt = options?.flushAt ? Math.max(options?.flushAt, 1) : 20;
        this.maxBatchSize = Math.max(this.flushAt, options?.maxBatchSize ?? 100);
        this.maxQueueSize = Math.max(this.flushAt, options?.maxQueueSize ?? 1000);
        this.flushInterval = options?.flushInterval ?? 10000;
        this.captureMode = options?.captureMode || 'json';
        this.preloadFeatureFlags = options?.preloadFeatureFlags ?? true;
        // If enable is explicitly set to false we override the optout
        this.defaultOptIn = options?.defaultOptIn ?? true;
        this.disableSurveys = options?.disableSurveys ?? false;
        this._retryOptions = {
            retryCount: options?.fetchRetryCount ?? 3,
            retryDelay: options?.fetchRetryDelay ?? 3000,
            retryCheck: isPostHogFetchError,
        };
        this.requestTimeout = options?.requestTimeout ?? 10000; // 10 seconds
        this.featureFlagsRequestTimeoutMs = options?.featureFlagsRequestTimeoutMs ?? 3000; // 3 seconds
        this.remoteConfigRequestTimeoutMs = options?.remoteConfigRequestTimeoutMs ?? 3000; // 3 seconds
        this.disableGeoip = options?.disableGeoip ?? true;
        this.disabled = options?.disabled ?? false;
        this.historicalMigration = options?.historicalMigration ?? false;
        // Init promise allows the derived class to block calls until it is ready
        this._initPromise = Promise.resolve();
        this._isInitialized = true;
    }
    logMsgIfDebug(fn) {
        if (this.isDebug) {
            fn();
        }
    }
    wrap(fn) {
        if (this.disabled) {
            this.logMsgIfDebug(() => console.warn('[PostHog] The client is disabled'));
            return;
        }
        if (this._isInitialized) {
            // NOTE: We could also check for the "opt in" status here...
            return fn();
        }
        this._initPromise.then(() => fn());
    }
    getCommonEventProperties() {
        return {
            $lib: this.getLibraryId(),
            $lib_version: this.getLibraryVersion(),
        };
    }
    get optedOut() {
        return this.getPersistedProperty(PostHogPersistedProperty.OptedOut) ?? !this.defaultOptIn;
    }
    async optIn() {
        this.wrap(() => {
            this.setPersistedProperty(PostHogPersistedProperty.OptedOut, false);
        });
    }
    async optOut() {
        this.wrap(() => {
            this.setPersistedProperty(PostHogPersistedProperty.OptedOut, true);
        });
    }
    on(event, cb) {
        return this._events.on(event, cb);
    }
    debug(enabled = true) {
        this.removeDebugCallback?.();
        if (enabled) {
            const removeDebugCallback = this.on('*', (event, payload) => console.log('PostHog Debug', event, payload));
            this.removeDebugCallback = () => {
                removeDebugCallback();
                this.removeDebugCallback = undefined;
            };
        }
    }
    get isDebug() {
        return !!this.removeDebugCallback;
    }
    get isDisabled() {
        return this.disabled;
    }
    buildPayload(payload) {
        return {
            distinct_id: payload.distinct_id,
            event: payload.event,
            properties: {
                ...(payload.properties || {}),
                ...this.getCommonEventProperties(), // Common PH props
            },
        };
    }
    addPendingPromise(promise) {
        const promiseUUID = uuidv7();
        this.pendingPromises[promiseUUID] = promise;
        promise
            .catch(() => { })
            .finally(() => {
            delete this.pendingPromises[promiseUUID];
        });
        return promise;
    }
    /***
     *** TRACKING
     ***/
    identifyStateless(distinctId, properties, options) {
        this.wrap(() => {
            // The properties passed to identifyStateless are event properties.
            // To add person properties, pass in all person properties to the `$set` and `$set_once` keys.
            const payload = {
                ...this.buildPayload({
                    distinct_id: distinctId,
                    event: '$identify',
                    properties,
                }),
            };
            this.enqueue('identify', payload, options);
        });
    }
    captureStateless(distinctId, event, properties, options) {
        this.wrap(() => {
            const payload = this.buildPayload({ distinct_id: distinctId, event, properties });
            this.enqueue('capture', payload, options);
        });
    }
    aliasStateless(alias, distinctId, properties, options) {
        this.wrap(() => {
            const payload = this.buildPayload({
                event: '$create_alias',
                distinct_id: distinctId,
                properties: {
                    ...(properties || {}),
                    distinct_id: distinctId,
                    alias,
                },
            });
            this.enqueue('alias', payload, options);
        });
    }
    /***
     *** GROUPS
     ***/
    groupIdentifyStateless(groupType, groupKey, groupProperties, options, distinctId, eventProperties) {
        this.wrap(() => {
            const payload = this.buildPayload({
                distinct_id: distinctId || `$${groupType}_${groupKey}`,
                event: '$groupidentify',
                properties: {
                    $group_type: groupType,
                    $group_key: groupKey,
                    $group_set: groupProperties || {},
                    ...(eventProperties || {}),
                },
            });
            this.enqueue('capture', payload, options);
        });
    }
    async getRemoteConfig() {
        await this._initPromise;
        let host = this.host;
        if (host === 'https://us.i.posthog.com') {
            host = 'https://us-assets.i.posthog.com';
        }
        else if (host === 'https://eu.i.posthog.com') {
            host = 'https://eu-assets.i.posthog.com';
        }
        const url = `${host}/array/${this.apiKey}/config`;
        const fetchOptions = {
            method: 'GET',
            headers: { ...this.getCustomHeaders(), 'Content-Type': 'application/json' },
        };
        // Don't retry remote config API calls
        return this.fetchWithRetry(url, fetchOptions, { retryCount: 0 }, this.remoteConfigRequestTimeoutMs)
            .then((response) => response.json())
            .catch((error) => {
            this.logMsgIfDebug(() => console.error('Remote config could not be loaded', error));
            this._events.emit('error', error);
            return undefined;
        });
    }
    /***
     *** FEATURE FLAGS
     ***/
    async getDecide(distinctId, groups = {}, personProperties = {}, groupProperties = {}, extraPayload = {}) {
        await this._initPromise;
        const url = `${this.host}/decide/?v=4`;
        const fetchOptions = {
            method: 'POST',
            headers: { ...this.getCustomHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: this.apiKey,
                distinct_id: distinctId,
                groups,
                person_properties: personProperties,
                group_properties: groupProperties,
                ...extraPayload,
            }),
        };
        // Don't retry /decide API calls
        return this.fetchWithRetry(url, fetchOptions, { retryCount: 0 }, this.featureFlagsRequestTimeoutMs)
            .then((response) => response.json())
            .then((response) => normalizeDecideResponse(response))
            .catch((error) => {
            this._events.emit('error', error);
            return undefined;
        });
    }
    async getFeatureFlagStateless(key, distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip) {
        await this._initPromise;
        const flagDetailResponse = await this.getFeatureFlagDetailStateless(key, distinctId, groups, personProperties, groupProperties, disableGeoip);
        if (flagDetailResponse === undefined) {
            // If we haven't loaded flags yet, or errored out, we respond with undefined
            return {
                response: undefined,
                requestId: undefined,
            };
        }
        let response = getFeatureFlagValue(flagDetailResponse.response);
        if (response === undefined) {
            // For cases where the flag is unknown, return false
            response = false;
        }
        // If we have flags we either return the value (true or string) or false
        return {
            response,
            requestId: flagDetailResponse.requestId,
        };
    }
    async getFeatureFlagDetailStateless(key, distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip) {
        await this._initPromise;
        const decideResponse = await this.getFeatureFlagDetailsStateless(distinctId, groups, personProperties, groupProperties, disableGeoip, [key]);
        if (decideResponse === undefined) {
            return undefined;
        }
        const featureFlags = decideResponse.flags;
        const flagDetail = featureFlags[key];
        return {
            response: flagDetail,
            requestId: decideResponse.requestId,
        };
    }
    async getFeatureFlagPayloadStateless(key, distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip) {
        await this._initPromise;
        const payloads = await this.getFeatureFlagPayloadsStateless(distinctId, groups, personProperties, groupProperties, disableGeoip, [key]);
        if (!payloads) {
            return undefined;
        }
        const response = payloads[key];
        // Undefined means a loading or missing data issue. Null means evaluation happened and there was no match
        if (response === undefined) {
            return null;
        }
        return response;
    }
    async getFeatureFlagPayloadsStateless(distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip, flagKeysToEvaluate) {
        await this._initPromise;
        const payloads = (await this.getFeatureFlagsAndPayloadsStateless(distinctId, groups, personProperties, groupProperties, disableGeoip, flagKeysToEvaluate)).payloads;
        return payloads;
    }
    async getFeatureFlagsStateless(distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip, flagKeysToEvaluate) {
        await this._initPromise;
        return await this.getFeatureFlagsAndPayloadsStateless(distinctId, groups, personProperties, groupProperties, disableGeoip, flagKeysToEvaluate);
    }
    async getFeatureFlagsAndPayloadsStateless(distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip, flagKeysToEvaluate) {
        await this._initPromise;
        const featureFlagDetails = await this.getFeatureFlagDetailsStateless(distinctId, groups, personProperties, groupProperties, disableGeoip, flagKeysToEvaluate);
        if (!featureFlagDetails) {
            return {
                flags: undefined,
                payloads: undefined,
                requestId: undefined,
            };
        }
        return {
            flags: featureFlagDetails.featureFlags,
            payloads: featureFlagDetails.featureFlagPayloads,
            requestId: featureFlagDetails.requestId,
        };
    }
    async getFeatureFlagDetailsStateless(distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip, flagKeysToEvaluate) {
        await this._initPromise;
        const extraPayload = {};
        if (disableGeoip ?? this.disableGeoip) {
            extraPayload['geoip_disable'] = true;
        }
        if (flagKeysToEvaluate) {
            extraPayload['flag_keys_to_evaluate'] = flagKeysToEvaluate;
        }
        const decideResponse = await this.getDecide(distinctId, groups, personProperties, groupProperties, extraPayload);
        if (decideResponse === undefined) {
            // We probably errored out, so return undefined
            return undefined;
        }
        // if there's an error on the decideResponse, log a console error, but don't throw an error
        if (decideResponse.errorsWhileComputingFlags) {
            console.error('[FEATURE FLAGS] Error while computing feature flags, some flags may be missing or incorrect. Learn more at https://posthog.com/docs/feature-flags/best-practices');
        }
        // Add check for quota limitation on feature flags
        if (decideResponse.quotaLimited?.includes(QuotaLimitedFeature.FeatureFlags)) {
            console.warn('[FEATURE FLAGS] Feature flags quota limit exceeded - feature flags unavailable. Learn more about billing limits at https://posthog.com/docs/billing/limits-alerts');
            return {
                flags: {},
                featureFlags: {},
                featureFlagPayloads: {},
                requestId: decideResponse?.requestId,
            };
        }
        return decideResponse;
    }
    /***
     *** SURVEYS
     ***/
    async getSurveysStateless() {
        await this._initPromise;
        if (this.disableSurveys === true) {
            this.logMsgIfDebug(() => console.log('Loading surveys is disabled.'));
            return [];
        }
        const url = `${this.host}/api/surveys/?token=${this.apiKey}`;
        const fetchOptions = {
            method: 'GET',
            headers: { ...this.getCustomHeaders(), 'Content-Type': 'application/json' },
        };
        const response = await this.fetchWithRetry(url, fetchOptions)
            .then((response) => {
            if (response.status !== 200 || !response.json) {
                const msg = `Surveys API could not be loaded: ${response.status}`;
                const error = new Error(msg);
                this.logMsgIfDebug(() => console.error(error));
                this._events.emit('error', new Error(msg));
                return undefined;
            }
            return response.json();
        })
            .catch((error) => {
            this.logMsgIfDebug(() => console.error('Surveys API could not be loaded', error));
            this._events.emit('error', error);
            return undefined;
        });
        const newSurveys = response?.surveys;
        if (newSurveys) {
            this.logMsgIfDebug(() => console.log('PostHog Debug', 'Surveys fetched from API: ', JSON.stringify(newSurveys)));
        }
        return newSurveys ?? [];
    }
    /***
     *** QUEUEING AND FLUSHING
     ***/
    enqueue(type, _message, options) {
        this.wrap(() => {
            if (this.optedOut) {
                this._events.emit(type, `Library is disabled. Not sending event. To re-enable, call posthog.optIn()`);
                return;
            }
            const message = {
                ..._message,
                type: type,
                library: this.getLibraryId(),
                library_version: this.getLibraryVersion(),
                timestamp: options?.timestamp ? options?.timestamp : currentISOTime(),
                uuid: options?.uuid ? options.uuid : uuidv7(),
            };
            const addGeoipDisableProperty = options?.disableGeoip ?? this.disableGeoip;
            if (addGeoipDisableProperty) {
                if (!message.properties) {
                    message.properties = {};
                }
                message['properties']['$geoip_disable'] = true;
            }
            if (message.distinctId) {
                message.distinct_id = message.distinctId;
                delete message.distinctId;
            }
            const queue = this.getPersistedProperty(PostHogPersistedProperty.Queue) || [];
            if (queue.length >= this.maxQueueSize) {
                queue.shift();
                this.logMsgIfDebug(() => console.info('Queue is full, the oldest event is dropped.'));
            }
            queue.push({ message });
            this.setPersistedProperty(PostHogPersistedProperty.Queue, queue);
            this._events.emit(type, message);
            // Flush queued events if we meet the flushAt length
            if (queue.length >= this.flushAt) {
                this.flushBackground();
            }
            if (this.flushInterval && !this._flushTimer) {
                this._flushTimer = safeSetTimeout(() => this.flushBackground(), this.flushInterval);
            }
        });
    }
    clearFlushTimer() {
        if (this._flushTimer) {
            clearTimeout(this._flushTimer);
            this._flushTimer = undefined;
        }
    }
    /**
     * Helper for flushing the queue in the background
     * Avoids unnecessary promise errors
     */
    flushBackground() {
        void this.flush().catch(() => { });
    }
    async flush() {
        if (!this.flushPromise) {
            this.flushPromise = this._flush().finally(() => {
                this.flushPromise = null;
            });
            this.addPendingPromise(this.flushPromise);
        }
        return this.flushPromise;
    }
    getCustomHeaders() {
        // Don't set the user agent if we're not on a browser. The latest spec allows
        // the User-Agent header (see https://fetch.spec.whatwg.org/#terminology-headers
        // and https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/setRequestHeader),
        // but browsers such as Chrome and Safari have not caught up.
        const customUserAgent = this.getCustomUserAgent();
        const headers = {};
        if (customUserAgent && customUserAgent !== '') {
            headers['User-Agent'] = customUserAgent;
        }
        return headers;
    }
    async _flush() {
        this.clearFlushTimer();
        await this._initPromise;
        const queue = this.getPersistedProperty(PostHogPersistedProperty.Queue) || [];
        if (!queue.length) {
            return [];
        }
        const items = queue.slice(0, this.maxBatchSize);
        const messages = items.map((item) => item.message);
        const persistQueueChange = () => {
            const refreshedQueue = this.getPersistedProperty(PostHogPersistedProperty.Queue) || [];
            this.setPersistedProperty(PostHogPersistedProperty.Queue, refreshedQueue.slice(items.length));
        };
        const data = {
            api_key: this.apiKey,
            batch: messages,
            sent_at: currentISOTime(),
        };
        if (this.historicalMigration) {
            data.historical_migration = true;
        }
        const payload = JSON.stringify(data);
        const url = this.captureMode === 'form'
            ? `${this.host}/e/?ip=1&_=${currentTimestamp()}&v=${this.getLibraryVersion()}`
            : `${this.host}/batch/`;
        const fetchOptions = this.captureMode === 'form'
            ? {
                method: 'POST',
                mode: 'no-cors',
                credentials: 'omit',
                headers: { ...this.getCustomHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `data=${encodeURIComponent(LZString.compressToBase64(payload))}&compression=lz64`,
            }
            : {
                method: 'POST',
                headers: { ...this.getCustomHeaders(), 'Content-Type': 'application/json' },
                body: payload,
            };
        try {
            await this.fetchWithRetry(url, fetchOptions);
        }
        catch (err) {
            // depending on the error type, eg a malformed JSON or broken queue, it'll always return an error
            // and this will be an endless loop, in this case, if the error isn't a network issue, we always remove the items from the queue
            if (!(err instanceof PostHogFetchNetworkError)) {
                persistQueueChange();
            }
            this._events.emit('error', err);
            throw err;
        }
        persistQueueChange();
        this._events.emit('flush', messages);
        return messages;
    }
    async fetchWithRetry(url, options, retryOptions, requestTimeout) {
        var _a;
        (_a = AbortSignal).timeout ?? (_a.timeout = function timeout(ms) {
            const ctrl = new AbortController();
            setTimeout(() => ctrl.abort(), ms);
            return ctrl.signal;
        });
        return await retriable(async () => {
            let res = null;
            try {
                res = await this.fetch(url, {
                    signal: AbortSignal.timeout(requestTimeout ?? this.requestTimeout),
                    ...options,
                });
            }
            catch (e) {
                // fetch will only throw on network errors or on timeouts
                throw new PostHogFetchNetworkError(e);
            }
            // If we're in no-cors mode, we can't access the response status
            // We only throw on HTTP errors if we're not in no-cors mode
            // https://developer.mozilla.org/en-US/docs/Web/API/Request/mode#no-cors
            const isNoCors = options.mode === 'no-cors';
            if (!isNoCors && (res.status < 200 || res.status >= 400)) {
                throw new PostHogFetchHttpError(res);
            }
            return res;
        }, { ...this._retryOptions, ...retryOptions });
    }
    async shutdown(shutdownTimeoutMs = 30000) {
        // A little tricky - we want to have a max shutdown time and enforce it, even if that means we have some
        // dangling promises. We'll keep track of the timeout and resolve/reject based on that.
        await this._initPromise;
        let hasTimedOut = false;
        this.clearFlushTimer();
        const doShutdown = async () => {
            try {
                await Promise.all(Object.values(this.pendingPromises));
                while (true) {
                    const queue = this.getPersistedProperty(PostHogPersistedProperty.Queue) || [];
                    if (queue.length === 0) {
                        break;
                    }
                    // flush again to make sure we send all events, some of which might've been added
                    // while we were waiting for the pending promises to resolve
                    // For example, see sendFeatureFlags in posthog-node/src/posthog-node.ts::capture
                    await this.flush();
                    if (hasTimedOut) {
                        break;
                    }
                }
            }
            catch (e) {
                if (!isPostHogFetchError(e)) {
                    throw e;
                }
                this.logMsgIfDebug(() => console.error('Error while shutting down PostHog', e));
            }
        };
        return Promise.race([
            new Promise((_, reject) => {
                safeSetTimeout(() => {
                    this.logMsgIfDebug(() => console.error('Timed out while shutting down PostHog'));
                    hasTimedOut = true;
                    reject('Timeout while shutting down PostHog. Some events may not have been sent.');
                }, shutdownTimeoutMs);
            }),
            doShutdown(),
        ]);
    }
}
class PostHogCore extends PostHogCoreStateless {
    constructor(apiKey, options) {
        // Default for stateful mode is to not disable geoip. Only override if explicitly set
        const disableGeoipOption = options?.disableGeoip ?? false;
        // Default for stateful mode is to timeout at 10s. Only override if explicitly set
        const featureFlagsRequestTimeoutMs = options?.featureFlagsRequestTimeoutMs ?? 10000; // 10 seconds
        super(apiKey, { ...options, disableGeoip: disableGeoipOption, featureFlagsRequestTimeoutMs });
        this.flagCallReported = {};
        this.sessionProps = {};
        this.sendFeatureFlagEvent = options?.sendFeatureFlagEvent ?? true;
        this._sessionExpirationTimeSeconds = options?.sessionExpirationTimeSeconds ?? 1800; // 30 minutes
    }
    setupBootstrap(options) {
        const bootstrap = options?.bootstrap;
        if (!bootstrap) {
            return;
        }
        // bootstrap options are only set if no persisted values are found
        // this is to prevent overwriting existing values
        if (bootstrap.distinctId) {
            if (bootstrap.isIdentifiedId) {
                const distinctId = this.getPersistedProperty(PostHogPersistedProperty.DistinctId);
                if (!distinctId) {
                    this.setPersistedProperty(PostHogPersistedProperty.DistinctId, bootstrap.distinctId);
                }
            }
            else {
                const anonymousId = this.getPersistedProperty(PostHogPersistedProperty.AnonymousId);
                if (!anonymousId) {
                    this.setPersistedProperty(PostHogPersistedProperty.AnonymousId, bootstrap.distinctId);
                }
            }
        }
        const bootstrapFeatureFlags = bootstrap.featureFlags;
        const bootstrapFeatureFlagPayloads = bootstrap.featureFlagPayloads ?? {};
        if (bootstrapFeatureFlags && Object.keys(bootstrapFeatureFlags).length) {
            const normalizedBootstrapFeatureFlagDetails = createDecideResponseFromFlagsAndPayloads(bootstrapFeatureFlags, bootstrapFeatureFlagPayloads);
            if (Object.keys(normalizedBootstrapFeatureFlagDetails.flags).length > 0) {
                this.setBootstrappedFeatureFlagDetails(normalizedBootstrapFeatureFlagDetails);
                const currentFeatureFlagDetails = this.getKnownFeatureFlagDetails() || { flags: {}, requestId: undefined };
                const newFeatureFlagDetails = {
                    flags: {
                        ...normalizedBootstrapFeatureFlagDetails.flags,
                        ...currentFeatureFlagDetails.flags,
                    },
                    requestId: normalizedBootstrapFeatureFlagDetails.requestId,
                };
                this.setKnownFeatureFlagDetails(newFeatureFlagDetails);
            }
        }
    }
    // NOTE: Props are lazy loaded from localstorage hence the complex getter setter logic
    get props() {
        if (!this._props) {
            this._props = this.getPersistedProperty(PostHogPersistedProperty.Props);
        }
        return this._props || {};
    }
    set props(val) {
        this._props = val;
    }
    clearProps() {
        this.props = undefined;
        this.sessionProps = {};
        this.flagCallReported = {};
    }
    on(event, cb) {
        return this._events.on(event, cb);
    }
    reset(propertiesToKeep) {
        this.wrap(() => {
            const allPropertiesToKeep = [PostHogPersistedProperty.Queue, ...(propertiesToKeep || [])];
            // clean up props
            this.clearProps();
            for (const key of Object.keys(PostHogPersistedProperty)) {
                if (!allPropertiesToKeep.includes(PostHogPersistedProperty[key])) {
                    this.setPersistedProperty(PostHogPersistedProperty[key], null);
                }
            }
            this.reloadFeatureFlags();
        });
    }
    getCommonEventProperties() {
        const featureFlags = this.getFeatureFlags();
        const featureVariantProperties = {};
        if (featureFlags) {
            for (const [feature, variant] of Object.entries(featureFlags)) {
                featureVariantProperties[`$feature/${feature}`] = variant;
            }
        }
        return {
            $active_feature_flags: featureFlags ? Object.keys(featureFlags) : undefined,
            ...featureVariantProperties,
            ...super.getCommonEventProperties(),
        };
    }
    enrichProperties(properties) {
        return {
            ...this.props,
            ...this.sessionProps,
            ...(properties || {}),
            ...this.getCommonEventProperties(),
            $session_id: this.getSessionId(),
        };
    }
    /**
     * * @returns {string} The stored session ID for the current session. This may be an empty string if the client is not yet fully initialized.
     */
    getSessionId() {
        if (!this._isInitialized) {
            return '';
        }
        let sessionId = this.getPersistedProperty(PostHogPersistedProperty.SessionId);
        const sessionTimestamp = this.getPersistedProperty(PostHogPersistedProperty.SessionLastTimestamp) || 0;
        if (!sessionId || Date.now() - sessionTimestamp > this._sessionExpirationTimeSeconds * 1000) {
            sessionId = uuidv7();
            this.setPersistedProperty(PostHogPersistedProperty.SessionId, sessionId);
        }
        this.setPersistedProperty(PostHogPersistedProperty.SessionLastTimestamp, Date.now());
        return sessionId;
    }
    resetSessionId() {
        this.wrap(() => {
            this.setPersistedProperty(PostHogPersistedProperty.SessionId, null);
            this.setPersistedProperty(PostHogPersistedProperty.SessionLastTimestamp, null);
        });
    }
    /**
     * * @returns {string} The stored anonymous ID. This may be an empty string if the client is not yet fully initialized.
     */
    getAnonymousId() {
        if (!this._isInitialized) {
            return '';
        }
        let anonId = this.getPersistedProperty(PostHogPersistedProperty.AnonymousId);
        if (!anonId) {
            anonId = uuidv7();
            this.setPersistedProperty(PostHogPersistedProperty.AnonymousId, anonId);
        }
        return anonId;
    }
    /**
     * * @returns {string} The stored distinct ID. This may be an empty string if the client is not yet fully initialized.
     */
    getDistinctId() {
        if (!this._isInitialized) {
            return '';
        }
        return this.getPersistedProperty(PostHogPersistedProperty.DistinctId) || this.getAnonymousId();
    }
    async unregister(property) {
        this.wrap(() => {
            delete this.props[property];
            this.setPersistedProperty(PostHogPersistedProperty.Props, this.props);
        });
    }
    async register(properties) {
        this.wrap(() => {
            this.props = {
                ...this.props,
                ...properties,
            };
            this.setPersistedProperty(PostHogPersistedProperty.Props, this.props);
        });
    }
    registerForSession(properties) {
        this.sessionProps = {
            ...this.sessionProps,
            ...properties,
        };
    }
    unregisterForSession(property) {
        delete this.sessionProps[property];
    }
    /***
     *** TRACKING
     ***/
    identify(distinctId, properties, options) {
        this.wrap(() => {
            const previousDistinctId = this.getDistinctId();
            distinctId = distinctId || previousDistinctId;
            if (properties?.$groups) {
                this.groups(properties.$groups);
            }
            // promote $set and $set_once to top level
            const userPropsOnce = properties?.$set_once;
            delete properties?.$set_once;
            // if no $set is provided we assume all properties are $set
            const userProps = properties?.$set || properties;
            const allProperties = this.enrichProperties({
                $anon_distinct_id: this.getAnonymousId(),
                $set: userProps,
                $set_once: userPropsOnce,
            });
            if (distinctId !== previousDistinctId) {
                // We keep the AnonymousId to be used by decide calls and identify to link the previousId
                this.setPersistedProperty(PostHogPersistedProperty.AnonymousId, previousDistinctId);
                this.setPersistedProperty(PostHogPersistedProperty.DistinctId, distinctId);
                this.reloadFeatureFlags();
            }
            super.identifyStateless(distinctId, allProperties, options);
        });
    }
    capture(event, properties, options) {
        this.wrap(() => {
            const distinctId = this.getDistinctId();
            if (properties?.$groups) {
                this.groups(properties.$groups);
            }
            const allProperties = this.enrichProperties(properties);
            super.captureStateless(distinctId, event, allProperties, options);
        });
    }
    alias(alias) {
        this.wrap(() => {
            const distinctId = this.getDistinctId();
            const allProperties = this.enrichProperties({});
            super.aliasStateless(alias, distinctId, allProperties);
        });
    }
    autocapture(eventType, elements, properties = {}, options) {
        this.wrap(() => {
            const distinctId = this.getDistinctId();
            const payload = {
                distinct_id: distinctId,
                event: '$autocapture',
                properties: {
                    ...this.enrichProperties(properties),
                    $event_type: eventType,
                    $elements: elements,
                },
            };
            this.enqueue('autocapture', payload, options);
        });
    }
    /***
     *** GROUPS
     ***/
    groups(groups) {
        this.wrap(() => {
            // Get persisted groups
            const existingGroups = this.props.$groups || {};
            this.register({
                $groups: {
                    ...existingGroups,
                    ...groups,
                },
            });
            if (Object.keys(groups).find((type) => existingGroups[type] !== groups[type])) {
                this.reloadFeatureFlags();
            }
        });
    }
    group(groupType, groupKey, groupProperties, options) {
        this.wrap(() => {
            this.groups({
                [groupType]: groupKey,
            });
            if (groupProperties) {
                this.groupIdentify(groupType, groupKey, groupProperties, options);
            }
        });
    }
    groupIdentify(groupType, groupKey, groupProperties, options) {
        this.wrap(() => {
            const distinctId = this.getDistinctId();
            const eventProperties = this.enrichProperties({});
            super.groupIdentifyStateless(groupType, groupKey, groupProperties, options, distinctId, eventProperties);
        });
    }
    /***
     * PROPERTIES
     ***/
    setPersonPropertiesForFlags(properties) {
        this.wrap(() => {
            // Get persisted person properties
            const existingProperties = this.getPersistedProperty(PostHogPersistedProperty.PersonProperties) || {};
            this.setPersistedProperty(PostHogPersistedProperty.PersonProperties, {
                ...existingProperties,
                ...properties,
            });
        });
    }
    resetPersonPropertiesForFlags() {
        this.wrap(() => {
            this.setPersistedProperty(PostHogPersistedProperty.PersonProperties, null);
        });
    }
    /** @deprecated - Renamed to setPersonPropertiesForFlags */
    personProperties(properties) {
        return this.setPersonPropertiesForFlags(properties);
    }
    setGroupPropertiesForFlags(properties) {
        this.wrap(() => {
            // Get persisted group properties
            const existingProperties = this.getPersistedProperty(PostHogPersistedProperty.GroupProperties) ||
                {};
            if (Object.keys(existingProperties).length !== 0) {
                Object.keys(existingProperties).forEach((groupType) => {
                    existingProperties[groupType] = {
                        ...existingProperties[groupType],
                        ...properties[groupType],
                    };
                    delete properties[groupType];
                });
            }
            this.setPersistedProperty(PostHogPersistedProperty.GroupProperties, {
                ...existingProperties,
                ...properties,
            });
        });
    }
    resetGroupPropertiesForFlags() {
        this.wrap(() => {
            this.setPersistedProperty(PostHogPersistedProperty.GroupProperties, null);
        });
    }
    /** @deprecated - Renamed to setGroupPropertiesForFlags */
    groupProperties(properties) {
        this.wrap(() => {
            this.setGroupPropertiesForFlags(properties);
        });
    }
    async remoteConfigAsync() {
        await this._initPromise;
        if (this._remoteConfigResponsePromise) {
            return this._remoteConfigResponsePromise;
        }
        return this._remoteConfigAsync();
    }
    /***
     *** FEATURE FLAGS
     ***/
    async decideAsync(sendAnonDistinctId = true) {
        await this._initPromise;
        if (this._decideResponsePromise) {
            return this._decideResponsePromise;
        }
        return this._decideAsync(sendAnonDistinctId);
    }
    cacheSessionReplay(response) {
        const sessionReplay = response?.sessionRecording;
        if (sessionReplay) {
            this.setPersistedProperty(PostHogPersistedProperty.SessionReplay, sessionReplay);
            this.logMsgIfDebug(() => console.log('PostHog Debug', 'Session replay config: ', JSON.stringify(sessionReplay)));
        }
        else {
            this.logMsgIfDebug(() => console.info('PostHog Debug', 'Session replay config disabled.'));
            this.setPersistedProperty(PostHogPersistedProperty.SessionReplay, null);
        }
    }
    async _remoteConfigAsync() {
        this._remoteConfigResponsePromise = this._initPromise
            .then(() => {
            let remoteConfig = this.getPersistedProperty(PostHogPersistedProperty.RemoteConfig);
            this.logMsgIfDebug(() => console.log('PostHog Debug', 'Cached remote config: ', JSON.stringify(remoteConfig)));
            return super.getRemoteConfig().then((response) => {
                if (response) {
                    const remoteConfigWithoutSurveys = { ...response };
                    delete remoteConfigWithoutSurveys.surveys;
                    this.logMsgIfDebug(() => console.log('PostHog Debug', 'Fetched remote config: ', JSON.stringify(remoteConfigWithoutSurveys)));
                    const surveys = response.surveys;
                    let hasSurveys = true;
                    if (!Array.isArray(surveys)) {
                        // If surveys is not an array, it means there are no surveys (its a boolean instead)
                        this.logMsgIfDebug(() => console.log('PostHog Debug', 'There are no surveys.'));
                        hasSurveys = false;
                    }
                    else {
                        this.logMsgIfDebug(() => console.log('PostHog Debug', 'Surveys fetched from remote config: ', JSON.stringify(surveys)));
                    }
                    if (this.disableSurveys === false && hasSurveys) {
                        this.setPersistedProperty(PostHogPersistedProperty.Surveys, surveys);
                    }
                    else {
                        this.setPersistedProperty(PostHogPersistedProperty.Surveys, null);
                    }
                    // we cache the surveys in its own storage key
                    this.setPersistedProperty(PostHogPersistedProperty.RemoteConfig, remoteConfigWithoutSurveys);
                    this.cacheSessionReplay(response);
                    // we only dont load flags if the remote config has no feature flags
                    if (response.hasFeatureFlags === false) {
                        // resetting flags to empty object
                        this.setKnownFeatureFlagDetails({ flags: {} });
                        this.logMsgIfDebug(() => console.warn('Remote config has no feature flags, will not load feature flags.'));
                    }
                    else if (this.preloadFeatureFlags !== false) {
                        this.reloadFeatureFlags();
                    }
                    remoteConfig = response;
                }
                return remoteConfig;
            });
        })
            .finally(() => {
            this._remoteConfigResponsePromise = undefined;
        });
        return this._remoteConfigResponsePromise;
    }
    async _decideAsync(sendAnonDistinctId = true) {
        this._decideResponsePromise = this._initPromise
            .then(async () => {
            const distinctId = this.getDistinctId();
            const groups = this.props.$groups || {};
            const personProperties = this.getPersistedProperty(PostHogPersistedProperty.PersonProperties) || {};
            const groupProperties = this.getPersistedProperty(PostHogPersistedProperty.GroupProperties) ||
                {};
            const extraProperties = {
                $anon_distinct_id: sendAnonDistinctId ? this.getAnonymousId() : undefined,
            };
            const res = await super.getDecide(distinctId, groups, personProperties, groupProperties, extraProperties);
            // Add check for quota limitation on feature flags
            if (res?.quotaLimited?.includes(QuotaLimitedFeature.FeatureFlags)) {
                // Unset all feature flags by setting to null
                this.setKnownFeatureFlagDetails(null);
                console.warn('[FEATURE FLAGS] Feature flags quota limit exceeded - unsetting all flags. Learn more about billing limits at https://posthog.com/docs/billing/limits-alerts');
                return res;
            }
            if (res?.featureFlags) {
                // clear flag call reported if we have new flags since they might have changed
                if (this.sendFeatureFlagEvent) {
                    this.flagCallReported = {};
                }
                let newFeatureFlagDetails = res;
                if (res.errorsWhileComputingFlags) {
                    // if not all flags were computed, we upsert flags instead of replacing them
                    const currentFlagDetails = this.getKnownFeatureFlagDetails();
                    this.logMsgIfDebug(() => console.log('PostHog Debug', 'Cached feature flags: ', JSON.stringify(currentFlagDetails)));
                    newFeatureFlagDetails = {
                        ...res,
                        flags: { ...currentFlagDetails?.flags, ...res.flags },
                    };
                }
                this.setKnownFeatureFlagDetails(newFeatureFlagDetails);
                // Mark that we hit the /decide endpoint so we can capture this in the $feature_flag_called event
                this.setPersistedProperty(PostHogPersistedProperty.DecideEndpointWasHit, true);
                this.cacheSessionReplay(res);
            }
            return res;
        })
            .finally(() => {
            this._decideResponsePromise = undefined;
        });
        return this._decideResponsePromise;
    }
    // We only store the flags and request id in the feature flag details storage key
    setKnownFeatureFlagDetails(decideResponse) {
        this.wrap(() => {
            this.setPersistedProperty(PostHogPersistedProperty.FeatureFlagDetails, decideResponse);
            this._events.emit('featureflags', getFlagValuesFromFlags(decideResponse?.flags ?? {}));
        });
    }
    getKnownFeatureFlagDetails() {
        const storedDetails = this.getPersistedProperty(PostHogPersistedProperty.FeatureFlagDetails);
        if (!storedDetails) {
            // Rebuild from the stored feature flags and feature flag payloads
            const featureFlags = this.getPersistedProperty(PostHogPersistedProperty.FeatureFlags);
            const featureFlagPayloads = this.getPersistedProperty(PostHogPersistedProperty.FeatureFlagPayloads);
            if (featureFlags === undefined && featureFlagPayloads === undefined) {
                return undefined;
            }
            return createDecideResponseFromFlagsAndPayloads(featureFlags ?? {}, featureFlagPayloads ?? {});
        }
        return normalizeDecideResponse(storedDetails);
    }
    getKnownFeatureFlags() {
        const featureFlagDetails = this.getKnownFeatureFlagDetails();
        if (!featureFlagDetails) {
            return undefined;
        }
        return getFlagValuesFromFlags(featureFlagDetails.flags);
    }
    getKnownFeatureFlagPayloads() {
        const featureFlagDetails = this.getKnownFeatureFlagDetails();
        if (!featureFlagDetails) {
            return undefined;
        }
        return getPayloadsFromFlags(featureFlagDetails.flags);
    }
    getBootstrappedFeatureFlagDetails() {
        const details = this.getPersistedProperty(PostHogPersistedProperty.BootstrapFeatureFlagDetails);
        if (!details) {
            return undefined;
        }
        return details;
    }
    setBootstrappedFeatureFlagDetails(details) {
        this.setPersistedProperty(PostHogPersistedProperty.BootstrapFeatureFlagDetails, details);
    }
    getBootstrappedFeatureFlags() {
        const details = this.getBootstrappedFeatureFlagDetails();
        if (!details) {
            return undefined;
        }
        return getFlagValuesFromFlags(details.flags);
    }
    getBootstrappedFeatureFlagPayloads() {
        const details = this.getBootstrappedFeatureFlagDetails();
        if (!details) {
            return undefined;
        }
        return getPayloadsFromFlags(details.flags);
    }
    getFeatureFlag(key) {
        const details = this.getFeatureFlagDetails();
        if (!details) {
            // If we haven't loaded flags yet, or errored out, we respond with undefined
            return undefined;
        }
        const featureFlag = details.flags[key];
        let response = getFeatureFlagValue(featureFlag);
        if (response === undefined) {
            // For cases where the flag is unknown, return false
            response = false;
        }
        if (this.sendFeatureFlagEvent && !this.flagCallReported[key]) {
            const bootstrappedResponse = this.getBootstrappedFeatureFlags()?.[key];
            const bootstrappedPayload = this.getBootstrappedFeatureFlagPayloads()?.[key];
            this.flagCallReported[key] = true;
            this.capture('$feature_flag_called', {
                $feature_flag: key,
                $feature_flag_response: response,
                $feature_flag_id: featureFlag?.metadata?.id,
                $feature_flag_version: featureFlag?.metadata?.version,
                $feature_flag_reason: featureFlag?.reason?.description ?? featureFlag?.reason?.code,
                $feature_flag_bootstrapped_response: bootstrappedResponse,
                $feature_flag_bootstrapped_payload: bootstrappedPayload,
                // If we haven't yet received a response from the /decide endpoint, we must have used the bootstrapped value
                $used_bootstrap_value: !this.getPersistedProperty(PostHogPersistedProperty.DecideEndpointWasHit),
                $feature_flag_request_id: details.requestId,
            });
        }
        // If we have flags we either return the value (true or string) or false
        return response;
    }
    getFeatureFlagPayload(key) {
        const payloads = this.getFeatureFlagPayloads();
        if (!payloads) {
            return undefined;
        }
        const response = payloads[key];
        // Undefined means a loading or missing data issue. Null means evaluation happened and there was no match
        if (response === undefined) {
            return null;
        }
        return response;
    }
    getFeatureFlagPayloads() {
        return this.getFeatureFlagDetails()?.featureFlagPayloads;
    }
    getFeatureFlags() {
        // NOTE: We don't check for _initPromise here as the function is designed to be
        // callable before the state being loaded anyways
        return this.getFeatureFlagDetails()?.featureFlags;
    }
    getFeatureFlagDetails() {
        // NOTE: We don't check for _initPromise here as the function is designed to be
        // callable before the state being loaded anyways
        let details = this.getKnownFeatureFlagDetails();
        const overriddenFlags = this.getPersistedProperty(PostHogPersistedProperty.OverrideFeatureFlags);
        if (!overriddenFlags) {
            return details;
        }
        details = details ?? { featureFlags: {}, featureFlagPayloads: {}, flags: {} };
        const flags = details.flags ?? {};
        for (const key in overriddenFlags) {
            if (!overriddenFlags[key]) {
                delete flags[key];
            }
            else {
                flags[key] = updateFlagValue(flags[key], overriddenFlags[key]);
            }
        }
        const result = {
            ...details,
            flags,
        };
        return normalizeDecideResponse(result);
    }
    getFeatureFlagsAndPayloads() {
        const flags = this.getFeatureFlags();
        const payloads = this.getFeatureFlagPayloads();
        return {
            flags,
            payloads,
        };
    }
    isFeatureEnabled(key) {
        const response = this.getFeatureFlag(key);
        if (response === undefined) {
            return undefined;
        }
        return !!response;
    }
    // Used when we want to trigger the reload but we don't care about the result
    reloadFeatureFlags(cb) {
        this.decideAsync()
            .then((res) => {
            cb?.(undefined, res?.featureFlags);
        })
            .catch((e) => {
            cb?.(e, undefined);
            if (!cb) {
                this.logMsgIfDebug(() => console.log('[PostHog] Error reloading feature flags', e));
            }
        });
    }
    async reloadRemoteConfigAsync() {
        return await this.remoteConfigAsync();
    }
    async reloadFeatureFlagsAsync(sendAnonDistinctId = true) {
        return (await this.decideAsync(sendAnonDistinctId))?.featureFlags;
    }
    onFeatureFlags(cb) {
        return this.on('featureflags', async () => {
            const flags = this.getFeatureFlags();
            if (flags) {
                cb(flags);
            }
        });
    }
    onFeatureFlag(key, cb) {
        return this.on('featureflags', async () => {
            const flagResponse = this.getFeatureFlag(key);
            if (flagResponse !== undefined) {
                cb(flagResponse);
            }
        });
    }
    async overrideFeatureFlag(flags) {
        this.wrap(() => {
            if (flags === null) {
                return this.setPersistedProperty(PostHogPersistedProperty.OverrideFeatureFlags, null);
            }
            return this.setPersistedProperty(PostHogPersistedProperty.OverrideFeatureFlags, flags);
        });
    }
    /***
     *** ERROR TRACKING
     ***/
    captureException(error, additionalProperties) {
        const properties = {
            $exception_level: 'error',
            $exception_list: [
                {
                    type: isError(error) ? error.name : 'Error',
                    value: isError(error) ? error.message : error,
                    mechanism: {
                        handled: true,
                        synthetic: false,
                    },
                },
            ],
            ...additionalProperties,
        };
        properties.$exception_personURL = new URL(`/project/${this.apiKey}/person/${this.getDistinctId()}`, this.host).toString();
        this.capture('$exception', properties);
    }
    /**
     * Capture written user feedback for a LLM trace. Numeric values are converted to strings.
     * @param traceId The trace ID to capture feedback for.
     * @param userFeedback The feedback to capture.
     */
    captureTraceFeedback(traceId, userFeedback) {
        this.capture('$ai_feedback', {
            $ai_feedback_text: userFeedback,
            $ai_trace_id: String(traceId),
        });
    }
    /**
     * Capture a metric for a LLM trace. Numeric values are converted to strings.
     * @param traceId The trace ID to capture the metric for.
     * @param metricName The name of the metric to capture.
     * @param metricValue The value of the metric to capture.
     */
    captureTraceMetric(traceId, metricName, metricValue) {
        this.capture('$ai_metric', {
            $ai_metric_name: metricName,
            $ai_metric_value: String(metricValue),
            $ai_trace_id: String(traceId),
        });
    }
}

var version = "3.4.2";

function getContext(window) {
  let context = {};
  if (window?.navigator) {
    const userAgent = window.navigator.userAgent;
    const osValue = os(window);
    context = {
      ...context,
      ...(osValue !== undefined && {
        $os: osValue
      }),
      $browser: browser(userAgent, window.navigator.vendor, !!window.opera),
      $referrer: window.document.referrer,
      $referring_domain: referringDomain(window.document.referrer),
      $device: device(userAgent),
      $current_url: window.location.href,
      $host: window.location.host,
      $pathname: window.location.pathname,
      $browser_version: browserVersion(userAgent, window.navigator.vendor, !!window.opera),
      $screen_height: window.screen.height,
      $screen_width: window.screen.width,
      $screen_dpr: window.devicePixelRatio
    };
  }
  context = {
    ...context,
    $lib: 'js',
    $lib_version: version,
    $insert_id: Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10),
    $time: currentTimestamp() / 1000 // epoch time in seconds
  };
  return context; // TODO: strip empty props?
}
function includes(haystack, needle) {
  return haystack.indexOf(needle) >= 0;
}
function browser(userAgent, vendor, opera) {
  vendor = vendor || ''; // vendor is undefined for at least IE9
  if (opera || includes(userAgent, ' OPR/')) {
    if (includes(userAgent, 'Mini')) {
      return 'Opera Mini';
    }
    return 'Opera';
  } else if (/(BlackBerry|PlayBook|BB10)/i.test(userAgent)) {
    return 'BlackBerry';
  } else if (includes(userAgent, 'IEMobile') || includes(userAgent, 'WPDesktop')) {
    return 'Internet Explorer Mobile';
  } else if (includes(userAgent, 'SamsungBrowser/')) {
    // https://developer.samsung.com/internet/user-agent-string-format
    return 'Samsung Internet';
  } else if (includes(userAgent, 'Edge') || includes(userAgent, 'Edg/')) {
    return 'Microsoft Edge';
  } else if (includes(userAgent, 'FBIOS')) {
    return 'Facebook Mobile';
  } else if (includes(userAgent, 'Chrome')) {
    return 'Chrome';
  } else if (includes(userAgent, 'CriOS')) {
    return 'Chrome iOS';
  } else if (includes(userAgent, 'UCWEB') || includes(userAgent, 'UCBrowser')) {
    return 'UC Browser';
  } else if (includes(userAgent, 'FxiOS')) {
    return 'Firefox iOS';
  } else if (includes(vendor, 'Apple')) {
    if (includes(userAgent, 'Mobile')) {
      return 'Mobile Safari';
    }
    return 'Safari';
  } else if (includes(userAgent, 'Android')) {
    return 'Android Mobile';
  } else if (includes(userAgent, 'Konqueror')) {
    return 'Konqueror';
  } else if (includes(userAgent, 'Firefox')) {
    return 'Firefox';
  } else if (includes(userAgent, 'MSIE') || includes(userAgent, 'Trident/')) {
    return 'Internet Explorer';
  } else if (includes(userAgent, 'Gecko')) {
    return 'Mozilla';
  } else {
    return '';
  }
}
function browserVersion(userAgent, vendor, opera) {
  const regexList = {
    'Internet Explorer Mobile': /rv:(\d+(\.\d+)?)/,
    'Microsoft Edge': /Edge?\/(\d+(\.\d+)?)/,
    Chrome: /Chrome\/(\d+(\.\d+)?)/,
    'Chrome iOS': /CriOS\/(\d+(\.\d+)?)/,
    'UC Browser': /(UCBrowser|UCWEB)\/(\d+(\.\d+)?)/,
    Safari: /Version\/(\d+(\.\d+)?)/,
    'Mobile Safari': /Version\/(\d+(\.\d+)?)/,
    Opera: /(Opera|OPR)\/(\d+(\.\d+)?)/,
    Firefox: /Firefox\/(\d+(\.\d+)?)/,
    'Firefox iOS': /FxiOS\/(\d+(\.\d+)?)/,
    Konqueror: /Konqueror:(\d+(\.\d+)?)/,
    BlackBerry: /BlackBerry (\d+(\.\d+)?)/,
    'Android Mobile': /android\s(\d+(\.\d+)?)/,
    'Samsung Internet': /SamsungBrowser\/(\d+(\.\d+)?)/,
    'Internet Explorer': /(rv:|MSIE )(\d+(\.\d+)?)/,
    Mozilla: /rv:(\d+(\.\d+)?)/
  };
  const browserString = browser(userAgent, vendor, opera);
  const regex = regexList[browserString] || undefined;
  if (regex === undefined) {
    return null;
  }
  const matches = userAgent.match(regex);
  if (!matches) {
    return null;
  }
  return parseFloat(matches[matches.length - 2]);
}
function os(window) {
  if (!window?.navigator) {
    return undefined;
  }
  const a = window.navigator.userAgent;
  if (/Windows/i.test(a)) {
    if (/Phone/.test(a) || /WPDesktop/.test(a)) {
      return 'Windows Phone';
    }
    return 'Windows';
  } else if (/(iPhone|iPad|iPod)/.test(a)) {
    return 'iOS';
  } else if (/Android/.test(a)) {
    return 'Android';
  } else if (/(BlackBerry|PlayBook|BB10)/i.test(a)) {
    return 'BlackBerry';
  } else if (/Mac/i.test(a)) {
    return 'Mac OS X';
  } else if (/Linux/.test(a)) {
    return 'Linux';
  } else if (/CrOS/.test(a)) {
    return 'Chrome OS';
  } else {
    return undefined;
  }
}
function device(userAgent) {
  if (/Windows Phone/i.test(userAgent) || /WPDesktop/.test(userAgent)) {
    return 'Windows Phone';
  } else if (/iPad/.test(userAgent)) {
    return 'iPad';
  } else if (/iPod/.test(userAgent)) {
    return 'iPod Touch';
  } else if (/iPhone/.test(userAgent)) {
    return 'iPhone';
  } else if (/(BlackBerry|PlayBook|BB10)/i.test(userAgent)) {
    return 'BlackBerry';
  } else if (/Android/.test(userAgent)) {
    return 'Android';
  } else {
    return '';
  }
}
function referringDomain(referrer) {
  const split = referrer.split('/');
  if (split.length >= 3) {
    return split[2];
  }
  return '';
}

// Methods partially borrowed from quirksmode.org/js/cookies.html
const cookieStore = {
  getItem(key) {
    try {
      const nameEQ = key + '=';
      const ca = document.cookie.split(';');
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') {
          c = c.substring(1, c.length);
        }
        if (c.indexOf(nameEQ) === 0) {
          return decodeURIComponent(c.substring(nameEQ.length, c.length));
        }
      }
    } catch (err) {}
    return null;
  },
  setItem(key, value) {
    try {
      const cdomain = '',
        expires = '',
        secure = '';
      const new_cookie_val = key + '=' + encodeURIComponent(value) + expires + '; path=/' + cdomain + secure;
      document.cookie = new_cookie_val;
    } catch (err) {
      return;
    }
  },
  removeItem(name) {
    try {
      cookieStore.setItem(name, '');
    } catch (err) {
      return;
    }
  },
  clear() {
    document.cookie = '';
  },
  getAllKeys() {
    const ca = document.cookie.split(';');
    const keys = [];
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == ' ') {
        c = c.substring(1, c.length);
      }
      keys.push(c.split('=')[0]);
    }
    return keys;
  }
};
const createStorageLike = store => {
  return {
    getItem(key) {
      return store.getItem(key);
    },
    setItem(key, value) {
      store.setItem(key, value);
    },
    removeItem(key) {
      store.removeItem(key);
    },
    clear() {
      store.clear();
    },
    getAllKeys() {
      const keys = [];
      for (const key in localStorage) {
        keys.push(key);
      }
      return keys;
    }
  };
};
const checkStoreIsSupported = (storage, key = '__mplssupport__') => {
  try {
    const val = 'xyz';
    storage.setItem(key, val);
    if (storage.getItem(key) !== val) {
      return false;
    }
    storage.removeItem(key);
    return true;
  } catch (err) {
    return false;
  }
};
let localStore = undefined;
let sessionStore = undefined;
const createMemoryStorage = () => {
  const _cache = {};
  const store = {
    getItem(key) {
      return _cache[key];
    },
    setItem(key, value) {
      _cache[key] = value !== null ? value : undefined;
    },
    removeItem(key) {
      delete _cache[key];
    },
    clear() {
      for (const key in _cache) {
        delete _cache[key];
      }
    },
    getAllKeys() {
      const keys = [];
      for (const key in _cache) {
        keys.push(key);
      }
      return keys;
    }
  };
  return store;
};
const getStorage = (type, window) => {
  if (window) {
    if (!localStore) {
      const _localStore = createStorageLike(window.localStorage);
      localStore = checkStoreIsSupported(_localStore) ? _localStore : undefined;
    }
    if (!sessionStore) {
      const _sessionStore = createStorageLike(window.sessionStorage);
      sessionStore = checkStoreIsSupported(_sessionStore) ? _sessionStore : undefined;
    }
  }
  switch (type) {
    case 'cookie':
      return cookieStore || localStore || sessionStore || createMemoryStorage();
    case 'localStorage':
      return localStore || sessionStore || createMemoryStorage();
    case 'sessionStorage':
      return sessionStore || createMemoryStorage();
    case 'memory':
      return createMemoryStorage();
    default:
      return createMemoryStorage();
  }
};

// import { patch } from 'rrweb/typings/utils'
function patch(source, name, replacement) {
    try {
        if (!(name in source)) {
            return () => {
                //
            };
        }
        const original = source[name];
        const wrapped = replacement(original);
        // Make sure it's a function first, as we need to attach an empty prototype for `defineProperties` to work
        // otherwise it'll throw "TypeError: Object.defineProperties called on non-object"
        if (isFunction(wrapped)) {
            wrapped.prototype = wrapped.prototype || {};
            Object.defineProperties(wrapped, {
                __posthog_wrapped__: {
                    enumerable: false,
                    value: true,
                },
            });
        }
        source[name] = wrapped;
        return () => {
            source[name] = original;
        };
    }
    catch {
        return () => {
            //
        };
        // This can throw if multiple fill happens on a global object like XMLHttpRequest
        // Fixes https://github.com/getsentry/sentry-javascript/issues/2043
    }
}

class PostHog extends PostHogCore {
  constructor(apiKey, options) {
    super(apiKey, options);
    // posthog-js stores options in one object on
    this._storageKey = options?.persistence_name ? `ph_${options.persistence_name}` : `ph_${apiKey}_posthog`;
    this._storage = getStorage(options?.persistence || 'localStorage', this.getWindow());
    this.setupBootstrap(options);
    if (options?.preloadFeatureFlags !== false) {
      this.reloadFeatureFlags();
    }
    if (options?.captureHistoryEvents && typeof window !== 'undefined') {
      this.setupHistoryEventTracking();
    }
  }
  getWindow() {
    return typeof window !== 'undefined' ? window : undefined;
  }
  getPersistedProperty(key) {
    if (!this._storageCache) {
      this._storageCache = JSON.parse(this._storage.getItem(this._storageKey) || '{}') || {};
    }
    return this._storageCache[key];
  }
  setPersistedProperty(key, value) {
    if (!this._storageCache) {
      this._storageCache = JSON.parse(this._storage.getItem(this._storageKey) || '{}') || {};
    }
    if (value === null) {
      delete this._storageCache[key];
    } else {
      this._storageCache[key] = value;
    }
    this._storage.setItem(this._storageKey, JSON.stringify(this._storageCache));
  }
  fetch(url, options) {
    const fetchFn = getFetch();
    if (!fetchFn) {
      // error will be handled by the caller (fetchWithRetry)
      return Promise.reject(new Error('Fetch API is not available in this environment.'));
    }
    return fetchFn(url, options);
  }
  getLibraryId() {
    return 'posthog-js-lite';
  }
  getLibraryVersion() {
    return version;
  }
  getCustomUserAgent() {
    return;
  }
  getCommonEventProperties() {
    return {
      ...super.getCommonEventProperties(),
      ...getContext(this.getWindow())
    };
  }
  // Setup tracking for the three SPA navigation types: pushState, replaceState, and popstate
  setupHistoryEventTracking() {
    const window = this.getWindow();
    if (!window) {
      return;
    }
    // Old fashioned, we could also use arrow functions but I think relying on the closure for a patch is more reliable
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    // Use patch with proper History method types
    patch(window.history, 'pushState', originalPushState => {
      return function patchedPushState(history, state, title, url) {
        originalPushState.call(history, state, title, url);
        self.captureNavigationEvent('pushState');
      };
    });
    patch(window.history, 'replaceState', originalReplaceState => {
      return function patchedReplaceState(history, state, title, url) {
        originalReplaceState.call(history, state, title, url);
        self.captureNavigationEvent('replaceState');
      };
    });
    // For popstate we need to listen to the event instead of overriding a method
    window.addEventListener('popstate', () => {
      this.captureNavigationEvent('popstate');
    });
  }
  // Capture navigation as pageview with only navigation_type
  // URL and pathname come from getCommonEventProperties()
  captureNavigationEvent(navigationType) {
    const window = this.getWindow();
    if (!window) {
      return;
    }
    this.capture('$pageview', {
      navigation_type: navigationType
    });
  }
}

export { PostHog, PostHog as default };
//# sourceMappingURL=index.esm.js.map
