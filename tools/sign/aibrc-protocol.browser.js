var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../node_modules/base64-js/index.js
var require_base64_js = __commonJS({
  "../../node_modules/base64-js/index.js"(exports) {
    "use strict";
    exports.byteLength = byteLength;
    exports.toByteArray = toByteArray;
    exports.fromByteArray = fromByteArray;
    var lookup = [];
    var revLookup = [];
    var Arr = typeof Uint8Array !== "undefined" ? Uint8Array : Array;
    var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (i = 0, len = code.length; i < len; ++i) {
      lookup[i] = code[i];
      revLookup[code.charCodeAt(i)] = i;
    }
    var i;
    var len;
    revLookup["-".charCodeAt(0)] = 62;
    revLookup["_".charCodeAt(0)] = 63;
    function getLens(b64) {
      var len2 = b64.length;
      if (len2 % 4 > 0) {
        throw new Error("Invalid string. Length must be a multiple of 4");
      }
      var validLen = b64.indexOf("=");
      if (validLen === -1) validLen = len2;
      var placeHoldersLen = validLen === len2 ? 0 : 4 - validLen % 4;
      return [validLen, placeHoldersLen];
    }
    function byteLength(b64) {
      var lens = getLens(b64);
      var validLen = lens[0];
      var placeHoldersLen = lens[1];
      return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
    }
    function _byteLength(b64, validLen, placeHoldersLen) {
      return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
    }
    function toByteArray(b64) {
      var tmp;
      var lens = getLens(b64);
      var validLen = lens[0];
      var placeHoldersLen = lens[1];
      var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));
      var curByte = 0;
      var len2 = placeHoldersLen > 0 ? validLen - 4 : validLen;
      var i2;
      for (i2 = 0; i2 < len2; i2 += 4) {
        tmp = revLookup[b64.charCodeAt(i2)] << 18 | revLookup[b64.charCodeAt(i2 + 1)] << 12 | revLookup[b64.charCodeAt(i2 + 2)] << 6 | revLookup[b64.charCodeAt(i2 + 3)];
        arr[curByte++] = tmp >> 16 & 255;
        arr[curByte++] = tmp >> 8 & 255;
        arr[curByte++] = tmp & 255;
      }
      if (placeHoldersLen === 2) {
        tmp = revLookup[b64.charCodeAt(i2)] << 2 | revLookup[b64.charCodeAt(i2 + 1)] >> 4;
        arr[curByte++] = tmp & 255;
      }
      if (placeHoldersLen === 1) {
        tmp = revLookup[b64.charCodeAt(i2)] << 10 | revLookup[b64.charCodeAt(i2 + 1)] << 4 | revLookup[b64.charCodeAt(i2 + 2)] >> 2;
        arr[curByte++] = tmp >> 8 & 255;
        arr[curByte++] = tmp & 255;
      }
      return arr;
    }
    function tripletToBase64(num) {
      return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
    }
    function encodeChunk(uint8, start, end) {
      var tmp;
      var output = [];
      for (var i2 = start; i2 < end; i2 += 3) {
        tmp = (uint8[i2] << 16 & 16711680) + (uint8[i2 + 1] << 8 & 65280) + (uint8[i2 + 2] & 255);
        output.push(tripletToBase64(tmp));
      }
      return output.join("");
    }
    function fromByteArray(uint8) {
      var tmp;
      var len2 = uint8.length;
      var extraBytes = len2 % 3;
      var parts = [];
      var maxChunkLength = 16383;
      for (var i2 = 0, len22 = len2 - extraBytes; i2 < len22; i2 += maxChunkLength) {
        parts.push(encodeChunk(uint8, i2, i2 + maxChunkLength > len22 ? len22 : i2 + maxChunkLength));
      }
      if (extraBytes === 1) {
        tmp = uint8[len2 - 1];
        parts.push(
          lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "=="
        );
      } else if (extraBytes === 2) {
        tmp = (uint8[len2 - 2] << 8) + uint8[len2 - 1];
        parts.push(
          lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "="
        );
      }
      return parts.join("");
    }
  }
});

// ../../node_modules/ieee754/index.js
var require_ieee754 = __commonJS({
  "../../node_modules/ieee754/index.js"(exports) {
    exports.read = function(buffer, offset, isLE, mLen, nBytes) {
      var e, m;
      var eLen = nBytes * 8 - mLen - 1;
      var eMax = (1 << eLen) - 1;
      var eBias = eMax >> 1;
      var nBits = -7;
      var i = isLE ? nBytes - 1 : 0;
      var d = isLE ? -1 : 1;
      var s = buffer[offset + i];
      i += d;
      e = s & (1 << -nBits) - 1;
      s >>= -nBits;
      nBits += eLen;
      for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {
      }
      m = e & (1 << -nBits) - 1;
      e >>= -nBits;
      nBits += mLen;
      for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {
      }
      if (e === 0) {
        e = 1 - eBias;
      } else if (e === eMax) {
        return m ? NaN : (s ? -1 : 1) * Infinity;
      } else {
        m = m + Math.pow(2, mLen);
        e = e - eBias;
      }
      return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
    };
    exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
      var e, m, c;
      var eLen = nBytes * 8 - mLen - 1;
      var eMax = (1 << eLen) - 1;
      var eBias = eMax >> 1;
      var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
      var i = isLE ? 0 : nBytes - 1;
      var d = isLE ? 1 : -1;
      var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
      value = Math.abs(value);
      if (isNaN(value) || value === Infinity) {
        m = isNaN(value) ? 1 : 0;
        e = eMax;
      } else {
        e = Math.floor(Math.log(value) / Math.LN2);
        if (value * (c = Math.pow(2, -e)) < 1) {
          e--;
          c *= 2;
        }
        if (e + eBias >= 1) {
          value += rt / c;
        } else {
          value += rt * Math.pow(2, 1 - eBias);
        }
        if (value * c >= 2) {
          e++;
          c /= 2;
        }
        if (e + eBias >= eMax) {
          m = 0;
          e = eMax;
        } else if (e + eBias >= 1) {
          m = (value * c - 1) * Math.pow(2, mLen);
          e = e + eBias;
        } else {
          m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
          e = 0;
        }
      }
      for (; mLen >= 8; buffer[offset + i] = m & 255, i += d, m /= 256, mLen -= 8) {
      }
      e = e << mLen | m;
      eLen += mLen;
      for (; eLen > 0; buffer[offset + i] = e & 255, i += d, e /= 256, eLen -= 8) {
      }
      buffer[offset + i - d] |= s * 128;
    };
  }
});

// ../../node_modules/buffer/index.js
var require_buffer = __commonJS({
  "../../node_modules/buffer/index.js"(exports) {
    "use strict";
    var base64 = require_base64_js();
    var ieee754 = require_ieee754();
    var customInspectSymbol = typeof Symbol === "function" && typeof Symbol["for"] === "function" ? Symbol["for"]("nodejs.util.inspect.custom") : null;
    exports.Buffer = Buffer6;
    exports.SlowBuffer = SlowBuffer;
    exports.INSPECT_MAX_BYTES = 50;
    var K_MAX_LENGTH = 2147483647;
    exports.kMaxLength = K_MAX_LENGTH;
    Buffer6.TYPED_ARRAY_SUPPORT = typedArraySupport();
    if (!Buffer6.TYPED_ARRAY_SUPPORT && typeof console !== "undefined" && typeof console.error === "function") {
      console.error(
        "This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support."
      );
    }
    function typedArraySupport() {
      try {
        const arr = new Uint8Array(1);
        const proto = { foo: function() {
          return 42;
        } };
        Object.setPrototypeOf(proto, Uint8Array.prototype);
        Object.setPrototypeOf(arr, proto);
        return arr.foo() === 42;
      } catch (e) {
        return false;
      }
    }
    Object.defineProperty(Buffer6.prototype, "parent", {
      enumerable: true,
      get: function() {
        if (!Buffer6.isBuffer(this)) return void 0;
        return this.buffer;
      }
    });
    Object.defineProperty(Buffer6.prototype, "offset", {
      enumerable: true,
      get: function() {
        if (!Buffer6.isBuffer(this)) return void 0;
        return this.byteOffset;
      }
    });
    function createBuffer(length) {
      if (length > K_MAX_LENGTH) {
        throw new RangeError('The value "' + length + '" is invalid for option "size"');
      }
      const buf = new Uint8Array(length);
      Object.setPrototypeOf(buf, Buffer6.prototype);
      return buf;
    }
    function Buffer6(arg, encodingOrOffset, length) {
      if (typeof arg === "number") {
        if (typeof encodingOrOffset === "string") {
          throw new TypeError(
            'The "string" argument must be of type string. Received type number'
          );
        }
        return allocUnsafe(arg);
      }
      return from(arg, encodingOrOffset, length);
    }
    Buffer6.poolSize = 8192;
    function from(value, encodingOrOffset, length) {
      if (typeof value === "string") {
        return fromString(value, encodingOrOffset);
      }
      if (ArrayBuffer.isView(value)) {
        return fromArrayView(value);
      }
      if (value == null) {
        throw new TypeError(
          "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
        );
      }
      if (isInstance(value, ArrayBuffer) || value && isInstance(value.buffer, ArrayBuffer)) {
        return fromArrayBuffer(value, encodingOrOffset, length);
      }
      if (typeof SharedArrayBuffer !== "undefined" && (isInstance(value, SharedArrayBuffer) || value && isInstance(value.buffer, SharedArrayBuffer))) {
        return fromArrayBuffer(value, encodingOrOffset, length);
      }
      if (typeof value === "number") {
        throw new TypeError(
          'The "value" argument must not be of type number. Received type number'
        );
      }
      const valueOf = value.valueOf && value.valueOf();
      if (valueOf != null && valueOf !== value) {
        return Buffer6.from(valueOf, encodingOrOffset, length);
      }
      const b = fromObject(value);
      if (b) return b;
      if (typeof Symbol !== "undefined" && Symbol.toPrimitive != null && typeof value[Symbol.toPrimitive] === "function") {
        return Buffer6.from(value[Symbol.toPrimitive]("string"), encodingOrOffset, length);
      }
      throw new TypeError(
        "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
      );
    }
    Buffer6.from = function(value, encodingOrOffset, length) {
      return from(value, encodingOrOffset, length);
    };
    Object.setPrototypeOf(Buffer6.prototype, Uint8Array.prototype);
    Object.setPrototypeOf(Buffer6, Uint8Array);
    function assertSize(size) {
      if (typeof size !== "number") {
        throw new TypeError('"size" argument must be of type number');
      } else if (size < 0) {
        throw new RangeError('The value "' + size + '" is invalid for option "size"');
      }
    }
    function alloc(size, fill, encoding) {
      assertSize(size);
      if (size <= 0) {
        return createBuffer(size);
      }
      if (fill !== void 0) {
        return typeof encoding === "string" ? createBuffer(size).fill(fill, encoding) : createBuffer(size).fill(fill);
      }
      return createBuffer(size);
    }
    Buffer6.alloc = function(size, fill, encoding) {
      return alloc(size, fill, encoding);
    };
    function allocUnsafe(size) {
      assertSize(size);
      return createBuffer(size < 0 ? 0 : checked(size) | 0);
    }
    Buffer6.allocUnsafe = function(size) {
      return allocUnsafe(size);
    };
    Buffer6.allocUnsafeSlow = function(size) {
      return allocUnsafe(size);
    };
    function fromString(string, encoding) {
      if (typeof encoding !== "string" || encoding === "") {
        encoding = "utf8";
      }
      if (!Buffer6.isEncoding(encoding)) {
        throw new TypeError("Unknown encoding: " + encoding);
      }
      const length = byteLength(string, encoding) | 0;
      let buf = createBuffer(length);
      const actual = buf.write(string, encoding);
      if (actual !== length) {
        buf = buf.slice(0, actual);
      }
      return buf;
    }
    function fromArrayLike(array) {
      const length = array.length < 0 ? 0 : checked(array.length) | 0;
      const buf = createBuffer(length);
      for (let i = 0; i < length; i += 1) {
        buf[i] = array[i] & 255;
      }
      return buf;
    }
    function fromArrayView(arrayView) {
      if (isInstance(arrayView, Uint8Array)) {
        const copy = new Uint8Array(arrayView);
        return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength);
      }
      return fromArrayLike(arrayView);
    }
    function fromArrayBuffer(array, byteOffset, length) {
      if (byteOffset < 0 || array.byteLength < byteOffset) {
        throw new RangeError('"offset" is outside of buffer bounds');
      }
      if (array.byteLength < byteOffset + (length || 0)) {
        throw new RangeError('"length" is outside of buffer bounds');
      }
      let buf;
      if (byteOffset === void 0 && length === void 0) {
        buf = new Uint8Array(array);
      } else if (length === void 0) {
        buf = new Uint8Array(array, byteOffset);
      } else {
        buf = new Uint8Array(array, byteOffset, length);
      }
      Object.setPrototypeOf(buf, Buffer6.prototype);
      return buf;
    }
    function fromObject(obj) {
      if (Buffer6.isBuffer(obj)) {
        const len = checked(obj.length) | 0;
        const buf = createBuffer(len);
        if (buf.length === 0) {
          return buf;
        }
        obj.copy(buf, 0, 0, len);
        return buf;
      }
      if (obj.length !== void 0) {
        if (typeof obj.length !== "number" || numberIsNaN(obj.length)) {
          return createBuffer(0);
        }
        return fromArrayLike(obj);
      }
      if (obj.type === "Buffer" && Array.isArray(obj.data)) {
        return fromArrayLike(obj.data);
      }
    }
    function checked(length) {
      if (length >= K_MAX_LENGTH) {
        throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + K_MAX_LENGTH.toString(16) + " bytes");
      }
      return length | 0;
    }
    function SlowBuffer(length) {
      if (+length != length) {
        length = 0;
      }
      return Buffer6.alloc(+length);
    }
    Buffer6.isBuffer = function isBuffer(b) {
      return b != null && b._isBuffer === true && b !== Buffer6.prototype;
    };
    Buffer6.compare = function compare(a, b) {
      if (isInstance(a, Uint8Array)) a = Buffer6.from(a, a.offset, a.byteLength);
      if (isInstance(b, Uint8Array)) b = Buffer6.from(b, b.offset, b.byteLength);
      if (!Buffer6.isBuffer(a) || !Buffer6.isBuffer(b)) {
        throw new TypeError(
          'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
        );
      }
      if (a === b) return 0;
      let x = a.length;
      let y = b.length;
      for (let i = 0, len = Math.min(x, y); i < len; ++i) {
        if (a[i] !== b[i]) {
          x = a[i];
          y = b[i];
          break;
        }
      }
      if (x < y) return -1;
      if (y < x) return 1;
      return 0;
    };
    Buffer6.isEncoding = function isEncoding(encoding) {
      switch (String(encoding).toLowerCase()) {
        case "hex":
        case "utf8":
        case "utf-8":
        case "ascii":
        case "latin1":
        case "binary":
        case "base64":
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
          return true;
        default:
          return false;
      }
    };
    Buffer6.concat = function concat(list, length) {
      if (!Array.isArray(list)) {
        throw new TypeError('"list" argument must be an Array of Buffers');
      }
      if (list.length === 0) {
        return Buffer6.alloc(0);
      }
      let i;
      if (length === void 0) {
        length = 0;
        for (i = 0; i < list.length; ++i) {
          length += list[i].length;
        }
      }
      const buffer = Buffer6.allocUnsafe(length);
      let pos = 0;
      for (i = 0; i < list.length; ++i) {
        let buf = list[i];
        if (isInstance(buf, Uint8Array)) {
          if (pos + buf.length > buffer.length) {
            if (!Buffer6.isBuffer(buf)) buf = Buffer6.from(buf);
            buf.copy(buffer, pos);
          } else {
            Uint8Array.prototype.set.call(
              buffer,
              buf,
              pos
            );
          }
        } else if (!Buffer6.isBuffer(buf)) {
          throw new TypeError('"list" argument must be an Array of Buffers');
        } else {
          buf.copy(buffer, pos);
        }
        pos += buf.length;
      }
      return buffer;
    };
    function byteLength(string, encoding) {
      if (Buffer6.isBuffer(string)) {
        return string.length;
      }
      if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
        return string.byteLength;
      }
      if (typeof string !== "string") {
        throw new TypeError(
          'The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof string
        );
      }
      const len = string.length;
      const mustMatch = arguments.length > 2 && arguments[2] === true;
      if (!mustMatch && len === 0) return 0;
      let loweredCase = false;
      for (; ; ) {
        switch (encoding) {
          case "ascii":
          case "latin1":
          case "binary":
            return len;
          case "utf8":
          case "utf-8":
            return utf8ToBytes2(string).length;
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return len * 2;
          case "hex":
            return len >>> 1;
          case "base64":
            return base64ToBytes(string).length;
          default:
            if (loweredCase) {
              return mustMatch ? -1 : utf8ToBytes2(string).length;
            }
            encoding = ("" + encoding).toLowerCase();
            loweredCase = true;
        }
      }
    }
    Buffer6.byteLength = byteLength;
    function slowToString(encoding, start, end) {
      let loweredCase = false;
      if (start === void 0 || start < 0) {
        start = 0;
      }
      if (start > this.length) {
        return "";
      }
      if (end === void 0 || end > this.length) {
        end = this.length;
      }
      if (end <= 0) {
        return "";
      }
      end >>>= 0;
      start >>>= 0;
      if (end <= start) {
        return "";
      }
      if (!encoding) encoding = "utf8";
      while (true) {
        switch (encoding) {
          case "hex":
            return hexSlice(this, start, end);
          case "utf8":
          case "utf-8":
            return utf8Slice(this, start, end);
          case "ascii":
            return asciiSlice(this, start, end);
          case "latin1":
          case "binary":
            return latin1Slice(this, start, end);
          case "base64":
            return base64Slice(this, start, end);
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return utf16leSlice(this, start, end);
          default:
            if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
            encoding = (encoding + "").toLowerCase();
            loweredCase = true;
        }
      }
    }
    Buffer6.prototype._isBuffer = true;
    function swap(b, n, m) {
      const i = b[n];
      b[n] = b[m];
      b[m] = i;
    }
    Buffer6.prototype.swap16 = function swap16() {
      const len = this.length;
      if (len % 2 !== 0) {
        throw new RangeError("Buffer size must be a multiple of 16-bits");
      }
      for (let i = 0; i < len; i += 2) {
        swap(this, i, i + 1);
      }
      return this;
    };
    Buffer6.prototype.swap32 = function swap32() {
      const len = this.length;
      if (len % 4 !== 0) {
        throw new RangeError("Buffer size must be a multiple of 32-bits");
      }
      for (let i = 0; i < len; i += 4) {
        swap(this, i, i + 3);
        swap(this, i + 1, i + 2);
      }
      return this;
    };
    Buffer6.prototype.swap64 = function swap64() {
      const len = this.length;
      if (len % 8 !== 0) {
        throw new RangeError("Buffer size must be a multiple of 64-bits");
      }
      for (let i = 0; i < len; i += 8) {
        swap(this, i, i + 7);
        swap(this, i + 1, i + 6);
        swap(this, i + 2, i + 5);
        swap(this, i + 3, i + 4);
      }
      return this;
    };
    Buffer6.prototype.toString = function toString() {
      const length = this.length;
      if (length === 0) return "";
      if (arguments.length === 0) return utf8Slice(this, 0, length);
      return slowToString.apply(this, arguments);
    };
    Buffer6.prototype.toLocaleString = Buffer6.prototype.toString;
    Buffer6.prototype.equals = function equals(b) {
      if (!Buffer6.isBuffer(b)) throw new TypeError("Argument must be a Buffer");
      if (this === b) return true;
      return Buffer6.compare(this, b) === 0;
    };
    Buffer6.prototype.inspect = function inspect() {
      let str = "";
      const max = exports.INSPECT_MAX_BYTES;
      str = this.toString("hex", 0, max).replace(/(.{2})/g, "$1 ").trim();
      if (this.length > max) str += " ... ";
      return "<Buffer " + str + ">";
    };
    if (customInspectSymbol) {
      Buffer6.prototype[customInspectSymbol] = Buffer6.prototype.inspect;
    }
    Buffer6.prototype.compare = function compare(target, start, end, thisStart, thisEnd) {
      if (isInstance(target, Uint8Array)) {
        target = Buffer6.from(target, target.offset, target.byteLength);
      }
      if (!Buffer6.isBuffer(target)) {
        throw new TypeError(
          'The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof target
        );
      }
      if (start === void 0) {
        start = 0;
      }
      if (end === void 0) {
        end = target ? target.length : 0;
      }
      if (thisStart === void 0) {
        thisStart = 0;
      }
      if (thisEnd === void 0) {
        thisEnd = this.length;
      }
      if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
        throw new RangeError("out of range index");
      }
      if (thisStart >= thisEnd && start >= end) {
        return 0;
      }
      if (thisStart >= thisEnd) {
        return -1;
      }
      if (start >= end) {
        return 1;
      }
      start >>>= 0;
      end >>>= 0;
      thisStart >>>= 0;
      thisEnd >>>= 0;
      if (this === target) return 0;
      let x = thisEnd - thisStart;
      let y = end - start;
      const len = Math.min(x, y);
      const thisCopy = this.slice(thisStart, thisEnd);
      const targetCopy = target.slice(start, end);
      for (let i = 0; i < len; ++i) {
        if (thisCopy[i] !== targetCopy[i]) {
          x = thisCopy[i];
          y = targetCopy[i];
          break;
        }
      }
      if (x < y) return -1;
      if (y < x) return 1;
      return 0;
    };
    function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
      if (buffer.length === 0) return -1;
      if (typeof byteOffset === "string") {
        encoding = byteOffset;
        byteOffset = 0;
      } else if (byteOffset > 2147483647) {
        byteOffset = 2147483647;
      } else if (byteOffset < -2147483648) {
        byteOffset = -2147483648;
      }
      byteOffset = +byteOffset;
      if (numberIsNaN(byteOffset)) {
        byteOffset = dir ? 0 : buffer.length - 1;
      }
      if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
      if (byteOffset >= buffer.length) {
        if (dir) return -1;
        else byteOffset = buffer.length - 1;
      } else if (byteOffset < 0) {
        if (dir) byteOffset = 0;
        else return -1;
      }
      if (typeof val === "string") {
        val = Buffer6.from(val, encoding);
      }
      if (Buffer6.isBuffer(val)) {
        if (val.length === 0) {
          return -1;
        }
        return arrayIndexOf(buffer, val, byteOffset, encoding, dir);
      } else if (typeof val === "number") {
        val = val & 255;
        if (typeof Uint8Array.prototype.indexOf === "function") {
          if (dir) {
            return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset);
          } else {
            return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset);
          }
        }
        return arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
      }
      throw new TypeError("val must be string, number or Buffer");
    }
    function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
      let indexSize = 1;
      let arrLength = arr.length;
      let valLength = val.length;
      if (encoding !== void 0) {
        encoding = String(encoding).toLowerCase();
        if (encoding === "ucs2" || encoding === "ucs-2" || encoding === "utf16le" || encoding === "utf-16le") {
          if (arr.length < 2 || val.length < 2) {
            return -1;
          }
          indexSize = 2;
          arrLength /= 2;
          valLength /= 2;
          byteOffset /= 2;
        }
      }
      function read(buf, i2) {
        if (indexSize === 1) {
          return buf[i2];
        } else {
          return buf.readUInt16BE(i2 * indexSize);
        }
      }
      let i;
      if (dir) {
        let foundIndex = -1;
        for (i = byteOffset; i < arrLength; i++) {
          if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
            if (foundIndex === -1) foundIndex = i;
            if (i - foundIndex + 1 === valLength) return foundIndex * indexSize;
          } else {
            if (foundIndex !== -1) i -= i - foundIndex;
            foundIndex = -1;
          }
        }
      } else {
        if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
        for (i = byteOffset; i >= 0; i--) {
          let found = true;
          for (let j = 0; j < valLength; j++) {
            if (read(arr, i + j) !== read(val, j)) {
              found = false;
              break;
            }
          }
          if (found) return i;
        }
      }
      return -1;
    }
    Buffer6.prototype.includes = function includes(val, byteOffset, encoding) {
      return this.indexOf(val, byteOffset, encoding) !== -1;
    };
    Buffer6.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
      return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
    };
    Buffer6.prototype.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
      return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
    };
    function hexWrite(buf, string, offset, length) {
      offset = Number(offset) || 0;
      const remaining = buf.length - offset;
      if (!length) {
        length = remaining;
      } else {
        length = Number(length);
        if (length > remaining) {
          length = remaining;
        }
      }
      const strLen = string.length;
      if (length > strLen / 2) {
        length = strLen / 2;
      }
      let i;
      for (i = 0; i < length; ++i) {
        const parsed = parseInt(string.substr(i * 2, 2), 16);
        if (numberIsNaN(parsed)) return i;
        buf[offset + i] = parsed;
      }
      return i;
    }
    function utf8Write(buf, string, offset, length) {
      return blitBuffer(utf8ToBytes2(string, buf.length - offset), buf, offset, length);
    }
    function asciiWrite(buf, string, offset, length) {
      return blitBuffer(asciiToBytes(string), buf, offset, length);
    }
    function base64Write(buf, string, offset, length) {
      return blitBuffer(base64ToBytes(string), buf, offset, length);
    }
    function ucs2Write(buf, string, offset, length) {
      return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
    }
    Buffer6.prototype.write = function write(string, offset, length, encoding) {
      if (offset === void 0) {
        encoding = "utf8";
        length = this.length;
        offset = 0;
      } else if (length === void 0 && typeof offset === "string") {
        encoding = offset;
        length = this.length;
        offset = 0;
      } else if (isFinite(offset)) {
        offset = offset >>> 0;
        if (isFinite(length)) {
          length = length >>> 0;
          if (encoding === void 0) encoding = "utf8";
        } else {
          encoding = length;
          length = void 0;
        }
      } else {
        throw new Error(
          "Buffer.write(string, encoding, offset[, length]) is no longer supported"
        );
      }
      const remaining = this.length - offset;
      if (length === void 0 || length > remaining) length = remaining;
      if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length) {
        throw new RangeError("Attempt to write outside buffer bounds");
      }
      if (!encoding) encoding = "utf8";
      let loweredCase = false;
      for (; ; ) {
        switch (encoding) {
          case "hex":
            return hexWrite(this, string, offset, length);
          case "utf8":
          case "utf-8":
            return utf8Write(this, string, offset, length);
          case "ascii":
          case "latin1":
          case "binary":
            return asciiWrite(this, string, offset, length);
          case "base64":
            return base64Write(this, string, offset, length);
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return ucs2Write(this, string, offset, length);
          default:
            if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
            encoding = ("" + encoding).toLowerCase();
            loweredCase = true;
        }
      }
    };
    Buffer6.prototype.toJSON = function toJSON() {
      return {
        type: "Buffer",
        data: Array.prototype.slice.call(this._arr || this, 0)
      };
    };
    function base64Slice(buf, start, end) {
      if (start === 0 && end === buf.length) {
        return base64.fromByteArray(buf);
      } else {
        return base64.fromByteArray(buf.slice(start, end));
      }
    }
    function utf8Slice(buf, start, end) {
      end = Math.min(buf.length, end);
      const res = [];
      let i = start;
      while (i < end) {
        const firstByte = buf[i];
        let codePoint = null;
        let bytesPerSequence = firstByte > 239 ? 4 : firstByte > 223 ? 3 : firstByte > 191 ? 2 : 1;
        if (i + bytesPerSequence <= end) {
          let secondByte, thirdByte, fourthByte, tempCodePoint;
          switch (bytesPerSequence) {
            case 1:
              if (firstByte < 128) {
                codePoint = firstByte;
              }
              break;
            case 2:
              secondByte = buf[i + 1];
              if ((secondByte & 192) === 128) {
                tempCodePoint = (firstByte & 31) << 6 | secondByte & 63;
                if (tempCodePoint > 127) {
                  codePoint = tempCodePoint;
                }
              }
              break;
            case 3:
              secondByte = buf[i + 1];
              thirdByte = buf[i + 2];
              if ((secondByte & 192) === 128 && (thirdByte & 192) === 128) {
                tempCodePoint = (firstByte & 15) << 12 | (secondByte & 63) << 6 | thirdByte & 63;
                if (tempCodePoint > 2047 && (tempCodePoint < 55296 || tempCodePoint > 57343)) {
                  codePoint = tempCodePoint;
                }
              }
              break;
            case 4:
              secondByte = buf[i + 1];
              thirdByte = buf[i + 2];
              fourthByte = buf[i + 3];
              if ((secondByte & 192) === 128 && (thirdByte & 192) === 128 && (fourthByte & 192) === 128) {
                tempCodePoint = (firstByte & 15) << 18 | (secondByte & 63) << 12 | (thirdByte & 63) << 6 | fourthByte & 63;
                if (tempCodePoint > 65535 && tempCodePoint < 1114112) {
                  codePoint = tempCodePoint;
                }
              }
          }
        }
        if (codePoint === null) {
          codePoint = 65533;
          bytesPerSequence = 1;
        } else if (codePoint > 65535) {
          codePoint -= 65536;
          res.push(codePoint >>> 10 & 1023 | 55296);
          codePoint = 56320 | codePoint & 1023;
        }
        res.push(codePoint);
        i += bytesPerSequence;
      }
      return decodeCodePointsArray(res);
    }
    var MAX_ARGUMENTS_LENGTH = 4096;
    function decodeCodePointsArray(codePoints) {
      const len = codePoints.length;
      if (len <= MAX_ARGUMENTS_LENGTH) {
        return String.fromCharCode.apply(String, codePoints);
      }
      let res = "";
      let i = 0;
      while (i < len) {
        res += String.fromCharCode.apply(
          String,
          codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
        );
      }
      return res;
    }
    function asciiSlice(buf, start, end) {
      let ret = "";
      end = Math.min(buf.length, end);
      for (let i = start; i < end; ++i) {
        ret += String.fromCharCode(buf[i] & 127);
      }
      return ret;
    }
    function latin1Slice(buf, start, end) {
      let ret = "";
      end = Math.min(buf.length, end);
      for (let i = start; i < end; ++i) {
        ret += String.fromCharCode(buf[i]);
      }
      return ret;
    }
    function hexSlice(buf, start, end) {
      const len = buf.length;
      if (!start || start < 0) start = 0;
      if (!end || end < 0 || end > len) end = len;
      let out = "";
      for (let i = start; i < end; ++i) {
        out += hexSliceLookupTable[buf[i]];
      }
      return out;
    }
    function utf16leSlice(buf, start, end) {
      const bytes = buf.slice(start, end);
      let res = "";
      for (let i = 0; i < bytes.length - 1; i += 2) {
        res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
      }
      return res;
    }
    Buffer6.prototype.slice = function slice(start, end) {
      const len = this.length;
      start = ~~start;
      end = end === void 0 ? len : ~~end;
      if (start < 0) {
        start += len;
        if (start < 0) start = 0;
      } else if (start > len) {
        start = len;
      }
      if (end < 0) {
        end += len;
        if (end < 0) end = 0;
      } else if (end > len) {
        end = len;
      }
      if (end < start) end = start;
      const newBuf = this.subarray(start, end);
      Object.setPrototypeOf(newBuf, Buffer6.prototype);
      return newBuf;
    };
    function checkOffset(offset, ext, length) {
      if (offset % 1 !== 0 || offset < 0) throw new RangeError("offset is not uint");
      if (offset + ext > length) throw new RangeError("Trying to access beyond buffer length");
    }
    Buffer6.prototype.readUintLE = Buffer6.prototype.readUIntLE = function readUIntLE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) checkOffset(offset, byteLength2, this.length);
      let val = this[offset];
      let mul = 1;
      let i = 0;
      while (++i < byteLength2 && (mul *= 256)) {
        val += this[offset + i] * mul;
      }
      return val;
    };
    Buffer6.prototype.readUintBE = Buffer6.prototype.readUIntBE = function readUIntBE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) {
        checkOffset(offset, byteLength2, this.length);
      }
      let val = this[offset + --byteLength2];
      let mul = 1;
      while (byteLength2 > 0 && (mul *= 256)) {
        val += this[offset + --byteLength2] * mul;
      }
      return val;
    };
    Buffer6.prototype.readUint8 = Buffer6.prototype.readUInt8 = function readUInt8(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 1, this.length);
      return this[offset];
    };
    Buffer6.prototype.readUint16LE = Buffer6.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      return this[offset] | this[offset + 1] << 8;
    };
    Buffer6.prototype.readUint16BE = Buffer6.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      return this[offset] << 8 | this[offset + 1];
    };
    Buffer6.prototype.readUint32LE = Buffer6.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 16777216;
    };
    Buffer6.prototype.readUint32BE = Buffer6.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return this[offset] * 16777216 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]);
    };
    Buffer6.prototype.readBigUInt64LE = defineBigIntMethod(function readBigUInt64LE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const lo = first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 24;
      const hi = this[++offset] + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + last * 2 ** 24;
      return BigInt(lo) + (BigInt(hi) << BigInt(32));
    });
    Buffer6.prototype.readBigUInt64BE = defineBigIntMethod(function readBigUInt64BE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const hi = first * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + this[++offset];
      const lo = this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + last;
      return (BigInt(hi) << BigInt(32)) + BigInt(lo);
    });
    Buffer6.prototype.readIntLE = function readIntLE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) checkOffset(offset, byteLength2, this.length);
      let val = this[offset];
      let mul = 1;
      let i = 0;
      while (++i < byteLength2 && (mul *= 256)) {
        val += this[offset + i] * mul;
      }
      mul *= 128;
      if (val >= mul) val -= Math.pow(2, 8 * byteLength2);
      return val;
    };
    Buffer6.prototype.readIntBE = function readIntBE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) checkOffset(offset, byteLength2, this.length);
      let i = byteLength2;
      let mul = 1;
      let val = this[offset + --i];
      while (i > 0 && (mul *= 256)) {
        val += this[offset + --i] * mul;
      }
      mul *= 128;
      if (val >= mul) val -= Math.pow(2, 8 * byteLength2);
      return val;
    };
    Buffer6.prototype.readInt8 = function readInt8(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 1, this.length);
      if (!(this[offset] & 128)) return this[offset];
      return (255 - this[offset] + 1) * -1;
    };
    Buffer6.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      const val = this[offset] | this[offset + 1] << 8;
      return val & 32768 ? val | 4294901760 : val;
    };
    Buffer6.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      const val = this[offset + 1] | this[offset] << 8;
      return val & 32768 ? val | 4294901760 : val;
    };
    Buffer6.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24;
    };
    Buffer6.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3];
    };
    Buffer6.prototype.readBigInt64LE = defineBigIntMethod(function readBigInt64LE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const val = this[offset + 4] + this[offset + 5] * 2 ** 8 + this[offset + 6] * 2 ** 16 + (last << 24);
      return (BigInt(val) << BigInt(32)) + BigInt(first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 24);
    });
    Buffer6.prototype.readBigInt64BE = defineBigIntMethod(function readBigInt64BE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const val = (first << 24) + // Overflow
      this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + this[++offset];
      return (BigInt(val) << BigInt(32)) + BigInt(this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + last);
    });
    Buffer6.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return ieee754.read(this, offset, true, 23, 4);
    };
    Buffer6.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return ieee754.read(this, offset, false, 23, 4);
    };
    Buffer6.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 8, this.length);
      return ieee754.read(this, offset, true, 52, 8);
    };
    Buffer6.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 8, this.length);
      return ieee754.read(this, offset, false, 52, 8);
    };
    function checkInt(buf, value, offset, ext, max, min) {
      if (!Buffer6.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance');
      if (value > max || value < min) throw new RangeError('"value" argument is out of bounds');
      if (offset + ext > buf.length) throw new RangeError("Index out of range");
    }
    Buffer6.prototype.writeUintLE = Buffer6.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) {
        const maxBytes = Math.pow(2, 8 * byteLength2) - 1;
        checkInt(this, value, offset, byteLength2, maxBytes, 0);
      }
      let mul = 1;
      let i = 0;
      this[offset] = value & 255;
      while (++i < byteLength2 && (mul *= 256)) {
        this[offset + i] = value / mul & 255;
      }
      return offset + byteLength2;
    };
    Buffer6.prototype.writeUintBE = Buffer6.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) {
        const maxBytes = Math.pow(2, 8 * byteLength2) - 1;
        checkInt(this, value, offset, byteLength2, maxBytes, 0);
      }
      let i = byteLength2 - 1;
      let mul = 1;
      this[offset + i] = value & 255;
      while (--i >= 0 && (mul *= 256)) {
        this[offset + i] = value / mul & 255;
      }
      return offset + byteLength2;
    };
    Buffer6.prototype.writeUint8 = Buffer6.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 1, 255, 0);
      this[offset] = value & 255;
      return offset + 1;
    };
    Buffer6.prototype.writeUint16LE = Buffer6.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
      this[offset] = value & 255;
      this[offset + 1] = value >>> 8;
      return offset + 2;
    };
    Buffer6.prototype.writeUint16BE = Buffer6.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
      this[offset] = value >>> 8;
      this[offset + 1] = value & 255;
      return offset + 2;
    };
    Buffer6.prototype.writeUint32LE = Buffer6.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
      this[offset + 3] = value >>> 24;
      this[offset + 2] = value >>> 16;
      this[offset + 1] = value >>> 8;
      this[offset] = value & 255;
      return offset + 4;
    };
    Buffer6.prototype.writeUint32BE = Buffer6.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
      this[offset] = value >>> 24;
      this[offset + 1] = value >>> 16;
      this[offset + 2] = value >>> 8;
      this[offset + 3] = value & 255;
      return offset + 4;
    };
    function wrtBigUInt64LE(buf, value, offset, min, max) {
      checkIntBI(value, min, max, buf, offset, 7);
      let lo = Number(value & BigInt(4294967295));
      buf[offset++] = lo;
      lo = lo >> 8;
      buf[offset++] = lo;
      lo = lo >> 8;
      buf[offset++] = lo;
      lo = lo >> 8;
      buf[offset++] = lo;
      let hi = Number(value >> BigInt(32) & BigInt(4294967295));
      buf[offset++] = hi;
      hi = hi >> 8;
      buf[offset++] = hi;
      hi = hi >> 8;
      buf[offset++] = hi;
      hi = hi >> 8;
      buf[offset++] = hi;
      return offset;
    }
    function wrtBigUInt64BE(buf, value, offset, min, max) {
      checkIntBI(value, min, max, buf, offset, 7);
      let lo = Number(value & BigInt(4294967295));
      buf[offset + 7] = lo;
      lo = lo >> 8;
      buf[offset + 6] = lo;
      lo = lo >> 8;
      buf[offset + 5] = lo;
      lo = lo >> 8;
      buf[offset + 4] = lo;
      let hi = Number(value >> BigInt(32) & BigInt(4294967295));
      buf[offset + 3] = hi;
      hi = hi >> 8;
      buf[offset + 2] = hi;
      hi = hi >> 8;
      buf[offset + 1] = hi;
      hi = hi >> 8;
      buf[offset] = hi;
      return offset + 8;
    }
    Buffer6.prototype.writeBigUInt64LE = defineBigIntMethod(function writeBigUInt64LE(value, offset = 0) {
      return wrtBigUInt64LE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
    });
    Buffer6.prototype.writeBigUInt64BE = defineBigIntMethod(function writeBigUInt64BE(value, offset = 0) {
      return wrtBigUInt64BE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
    });
    Buffer6.prototype.writeIntLE = function writeIntLE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        const limit = Math.pow(2, 8 * byteLength2 - 1);
        checkInt(this, value, offset, byteLength2, limit - 1, -limit);
      }
      let i = 0;
      let mul = 1;
      let sub = 0;
      this[offset] = value & 255;
      while (++i < byteLength2 && (mul *= 256)) {
        if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
          sub = 1;
        }
        this[offset + i] = (value / mul >> 0) - sub & 255;
      }
      return offset + byteLength2;
    };
    Buffer6.prototype.writeIntBE = function writeIntBE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        const limit = Math.pow(2, 8 * byteLength2 - 1);
        checkInt(this, value, offset, byteLength2, limit - 1, -limit);
      }
      let i = byteLength2 - 1;
      let mul = 1;
      let sub = 0;
      this[offset + i] = value & 255;
      while (--i >= 0 && (mul *= 256)) {
        if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
          sub = 1;
        }
        this[offset + i] = (value / mul >> 0) - sub & 255;
      }
      return offset + byteLength2;
    };
    Buffer6.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 1, 127, -128);
      if (value < 0) value = 255 + value + 1;
      this[offset] = value & 255;
      return offset + 1;
    };
    Buffer6.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
      this[offset] = value & 255;
      this[offset + 1] = value >>> 8;
      return offset + 2;
    };
    Buffer6.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
      this[offset] = value >>> 8;
      this[offset + 1] = value & 255;
      return offset + 2;
    };
    Buffer6.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
      this[offset] = value & 255;
      this[offset + 1] = value >>> 8;
      this[offset + 2] = value >>> 16;
      this[offset + 3] = value >>> 24;
      return offset + 4;
    };
    Buffer6.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
      if (value < 0) value = 4294967295 + value + 1;
      this[offset] = value >>> 24;
      this[offset + 1] = value >>> 16;
      this[offset + 2] = value >>> 8;
      this[offset + 3] = value & 255;
      return offset + 4;
    };
    Buffer6.prototype.writeBigInt64LE = defineBigIntMethod(function writeBigInt64LE(value, offset = 0) {
      return wrtBigUInt64LE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
    });
    Buffer6.prototype.writeBigInt64BE = defineBigIntMethod(function writeBigInt64BE(value, offset = 0) {
      return wrtBigUInt64BE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
    });
    function checkIEEE754(buf, value, offset, ext, max, min) {
      if (offset + ext > buf.length) throw new RangeError("Index out of range");
      if (offset < 0) throw new RangeError("Index out of range");
    }
    function writeFloat(buf, value, offset, littleEndian, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        checkIEEE754(buf, value, offset, 4, 34028234663852886e22, -34028234663852886e22);
      }
      ieee754.write(buf, value, offset, littleEndian, 23, 4);
      return offset + 4;
    }
    Buffer6.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
      return writeFloat(this, value, offset, true, noAssert);
    };
    Buffer6.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
      return writeFloat(this, value, offset, false, noAssert);
    };
    function writeDouble(buf, value, offset, littleEndian, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        checkIEEE754(buf, value, offset, 8, 17976931348623157e292, -17976931348623157e292);
      }
      ieee754.write(buf, value, offset, littleEndian, 52, 8);
      return offset + 8;
    }
    Buffer6.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
      return writeDouble(this, value, offset, true, noAssert);
    };
    Buffer6.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
      return writeDouble(this, value, offset, false, noAssert);
    };
    Buffer6.prototype.copy = function copy(target, targetStart, start, end) {
      if (!Buffer6.isBuffer(target)) throw new TypeError("argument should be a Buffer");
      if (!start) start = 0;
      if (!end && end !== 0) end = this.length;
      if (targetStart >= target.length) targetStart = target.length;
      if (!targetStart) targetStart = 0;
      if (end > 0 && end < start) end = start;
      if (end === start) return 0;
      if (target.length === 0 || this.length === 0) return 0;
      if (targetStart < 0) {
        throw new RangeError("targetStart out of bounds");
      }
      if (start < 0 || start >= this.length) throw new RangeError("Index out of range");
      if (end < 0) throw new RangeError("sourceEnd out of bounds");
      if (end > this.length) end = this.length;
      if (target.length - targetStart < end - start) {
        end = target.length - targetStart + start;
      }
      const len = end - start;
      if (this === target && typeof Uint8Array.prototype.copyWithin === "function") {
        this.copyWithin(targetStart, start, end);
      } else {
        Uint8Array.prototype.set.call(
          target,
          this.subarray(start, end),
          targetStart
        );
      }
      return len;
    };
    Buffer6.prototype.fill = function fill(val, start, end, encoding) {
      if (typeof val === "string") {
        if (typeof start === "string") {
          encoding = start;
          start = 0;
          end = this.length;
        } else if (typeof end === "string") {
          encoding = end;
          end = this.length;
        }
        if (encoding !== void 0 && typeof encoding !== "string") {
          throw new TypeError("encoding must be a string");
        }
        if (typeof encoding === "string" && !Buffer6.isEncoding(encoding)) {
          throw new TypeError("Unknown encoding: " + encoding);
        }
        if (val.length === 1) {
          const code = val.charCodeAt(0);
          if (encoding === "utf8" && code < 128 || encoding === "latin1") {
            val = code;
          }
        }
      } else if (typeof val === "number") {
        val = val & 255;
      } else if (typeof val === "boolean") {
        val = Number(val);
      }
      if (start < 0 || this.length < start || this.length < end) {
        throw new RangeError("Out of range index");
      }
      if (end <= start) {
        return this;
      }
      start = start >>> 0;
      end = end === void 0 ? this.length : end >>> 0;
      if (!val) val = 0;
      let i;
      if (typeof val === "number") {
        for (i = start; i < end; ++i) {
          this[i] = val;
        }
      } else {
        const bytes = Buffer6.isBuffer(val) ? val : Buffer6.from(val, encoding);
        const len = bytes.length;
        if (len === 0) {
          throw new TypeError('The value "' + val + '" is invalid for argument "value"');
        }
        for (i = 0; i < end - start; ++i) {
          this[i + start] = bytes[i % len];
        }
      }
      return this;
    };
    var errors = {};
    function E(sym, getMessage, Base) {
      errors[sym] = class NodeError extends Base {
        constructor() {
          super();
          Object.defineProperty(this, "message", {
            value: getMessage.apply(this, arguments),
            writable: true,
            configurable: true
          });
          this.name = `${this.name} [${sym}]`;
          this.stack;
          delete this.name;
        }
        get code() {
          return sym;
        }
        set code(value) {
          Object.defineProperty(this, "code", {
            configurable: true,
            enumerable: true,
            value,
            writable: true
          });
        }
        toString() {
          return `${this.name} [${sym}]: ${this.message}`;
        }
      };
    }
    E(
      "ERR_BUFFER_OUT_OF_BOUNDS",
      function(name) {
        if (name) {
          return `${name} is outside of buffer bounds`;
        }
        return "Attempt to access memory outside buffer bounds";
      },
      RangeError
    );
    E(
      "ERR_INVALID_ARG_TYPE",
      function(name, actual) {
        return `The "${name}" argument must be of type number. Received type ${typeof actual}`;
      },
      TypeError
    );
    E(
      "ERR_OUT_OF_RANGE",
      function(str, range, input) {
        let msg = `The value of "${str}" is out of range.`;
        let received = input;
        if (Number.isInteger(input) && Math.abs(input) > 2 ** 32) {
          received = addNumericalSeparator(String(input));
        } else if (typeof input === "bigint") {
          received = String(input);
          if (input > BigInt(2) ** BigInt(32) || input < -(BigInt(2) ** BigInt(32))) {
            received = addNumericalSeparator(received);
          }
          received += "n";
        }
        msg += ` It must be ${range}. Received ${received}`;
        return msg;
      },
      RangeError
    );
    function addNumericalSeparator(val) {
      let res = "";
      let i = val.length;
      const start = val[0] === "-" ? 1 : 0;
      for (; i >= start + 4; i -= 3) {
        res = `_${val.slice(i - 3, i)}${res}`;
      }
      return `${val.slice(0, i)}${res}`;
    }
    function checkBounds(buf, offset, byteLength2) {
      validateNumber(offset, "offset");
      if (buf[offset] === void 0 || buf[offset + byteLength2] === void 0) {
        boundsError(offset, buf.length - (byteLength2 + 1));
      }
    }
    function checkIntBI(value, min, max, buf, offset, byteLength2) {
      if (value > max || value < min) {
        const n = typeof min === "bigint" ? "n" : "";
        let range;
        if (byteLength2 > 3) {
          if (min === 0 || min === BigInt(0)) {
            range = `>= 0${n} and < 2${n} ** ${(byteLength2 + 1) * 8}${n}`;
          } else {
            range = `>= -(2${n} ** ${(byteLength2 + 1) * 8 - 1}${n}) and < 2 ** ${(byteLength2 + 1) * 8 - 1}${n}`;
          }
        } else {
          range = `>= ${min}${n} and <= ${max}${n}`;
        }
        throw new errors.ERR_OUT_OF_RANGE("value", range, value);
      }
      checkBounds(buf, offset, byteLength2);
    }
    function validateNumber(value, name) {
      if (typeof value !== "number") {
        throw new errors.ERR_INVALID_ARG_TYPE(name, "number", value);
      }
    }
    function boundsError(value, length, type) {
      if (Math.floor(value) !== value) {
        validateNumber(value, type);
        throw new errors.ERR_OUT_OF_RANGE(type || "offset", "an integer", value);
      }
      if (length < 0) {
        throw new errors.ERR_BUFFER_OUT_OF_BOUNDS();
      }
      throw new errors.ERR_OUT_OF_RANGE(
        type || "offset",
        `>= ${type ? 1 : 0} and <= ${length}`,
        value
      );
    }
    var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;
    function base64clean(str) {
      str = str.split("=")[0];
      str = str.trim().replace(INVALID_BASE64_RE, "");
      if (str.length < 2) return "";
      while (str.length % 4 !== 0) {
        str = str + "=";
      }
      return str;
    }
    function utf8ToBytes2(string, units) {
      units = units || Infinity;
      let codePoint;
      const length = string.length;
      let leadSurrogate = null;
      const bytes = [];
      for (let i = 0; i < length; ++i) {
        codePoint = string.charCodeAt(i);
        if (codePoint > 55295 && codePoint < 57344) {
          if (!leadSurrogate) {
            if (codePoint > 56319) {
              if ((units -= 3) > -1) bytes.push(239, 191, 189);
              continue;
            } else if (i + 1 === length) {
              if ((units -= 3) > -1) bytes.push(239, 191, 189);
              continue;
            }
            leadSurrogate = codePoint;
            continue;
          }
          if (codePoint < 56320) {
            if ((units -= 3) > -1) bytes.push(239, 191, 189);
            leadSurrogate = codePoint;
            continue;
          }
          codePoint = (leadSurrogate - 55296 << 10 | codePoint - 56320) + 65536;
        } else if (leadSurrogate) {
          if ((units -= 3) > -1) bytes.push(239, 191, 189);
        }
        leadSurrogate = null;
        if (codePoint < 128) {
          if ((units -= 1) < 0) break;
          bytes.push(codePoint);
        } else if (codePoint < 2048) {
          if ((units -= 2) < 0) break;
          bytes.push(
            codePoint >> 6 | 192,
            codePoint & 63 | 128
          );
        } else if (codePoint < 65536) {
          if ((units -= 3) < 0) break;
          bytes.push(
            codePoint >> 12 | 224,
            codePoint >> 6 & 63 | 128,
            codePoint & 63 | 128
          );
        } else if (codePoint < 1114112) {
          if ((units -= 4) < 0) break;
          bytes.push(
            codePoint >> 18 | 240,
            codePoint >> 12 & 63 | 128,
            codePoint >> 6 & 63 | 128,
            codePoint & 63 | 128
          );
        } else {
          throw new Error("Invalid code point");
        }
      }
      return bytes;
    }
    function asciiToBytes(str) {
      const byteArray = [];
      for (let i = 0; i < str.length; ++i) {
        byteArray.push(str.charCodeAt(i) & 255);
      }
      return byteArray;
    }
    function utf16leToBytes(str, units) {
      let c, hi, lo;
      const byteArray = [];
      for (let i = 0; i < str.length; ++i) {
        if ((units -= 2) < 0) break;
        c = str.charCodeAt(i);
        hi = c >> 8;
        lo = c % 256;
        byteArray.push(lo);
        byteArray.push(hi);
      }
      return byteArray;
    }
    function base64ToBytes(str) {
      return base64.toByteArray(base64clean(str));
    }
    function blitBuffer(src, dst, offset, length) {
      let i;
      for (i = 0; i < length; ++i) {
        if (i + offset >= dst.length || i >= src.length) break;
        dst[i + offset] = src[i];
      }
      return i;
    }
    function isInstance(obj, type) {
      return obj instanceof type || obj != null && obj.constructor != null && obj.constructor.name != null && obj.constructor.name === type.name;
    }
    function numberIsNaN(obj) {
      return obj !== obj;
    }
    var hexSliceLookupTable = (function() {
      const alphabet = "0123456789abcdef";
      const table = new Array(256);
      for (let i = 0; i < 16; ++i) {
        const i16 = i * 16;
        for (let j = 0; j < 16; ++j) {
          table[i16 + j] = alphabet[i] + alphabet[j];
        }
      }
      return table;
    })();
    function defineBigIntMethod(fn) {
      return typeof BigInt === "undefined" ? BufferBigIntNotDefined : fn;
    }
    function BufferBigIntNotDefined() {
      throw new Error("BigInt not supported");
    }
  }
});

// src/index.ts
var import_buffer3 = __toESM(require_buffer(), 1);

// src/hash.ts
var import_buffer = __toESM(require_buffer(), 1);

// ../../node_modules/@noble/hashes/esm/utils.js
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function abytes(b, ...lengths) {
  if (!isBytes(b))
    throw new Error("Uint8Array expected");
  if (lengths.length > 0 && !lengths.includes(b.length))
    throw new Error("Uint8Array expected of length " + lengths + ", got length=" + b.length);
}
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function aoutput(out, instance) {
  abytes(out);
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error("digestInto() expects output buffer of length at least " + min);
  }
}
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr(word, shift) {
  return word << 32 - shift | word >>> shift;
}
function utf8ToBytes(str) {
  if (typeof str !== "string")
    throw new Error("string expected");
  return new Uint8Array(new TextEncoder().encode(str));
}
function toBytes(data) {
  if (typeof data === "string")
    data = utf8ToBytes(data);
  abytes(data);
  return data;
}
var Hash = class {
};
function createHasher(hashCons) {
  const hashC = (msg) => hashCons().update(toBytes(msg)).digest();
  const tmp = hashCons();
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = () => hashCons();
  return hashC;
}

// ../../node_modules/@noble/hashes/esm/_md.js
function setBigUint64(view, byteOffset, value, isLE) {
  if (typeof view.setBigUint64 === "function")
    return view.setBigUint64(byteOffset, value, isLE);
  const _32n = BigInt(32);
  const _u32_max = BigInt(4294967295);
  const wh = Number(value >> _32n & _u32_max);
  const wl = Number(value & _u32_max);
  const h = isLE ? 4 : 0;
  const l = isLE ? 0 : 4;
  view.setUint32(byteOffset + h, wh, isLE);
  view.setUint32(byteOffset + l, wl, isLE);
}
function Chi(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj(a, b, c) {
  return a & b ^ a & c ^ b & c;
}
var HashMD = class extends Hash {
  constructor(blockLen, outputLen, padOffset, isLE) {
    super();
    this.finished = false;
    this.length = 0;
    this.pos = 0;
    this.destroyed = false;
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView(this.buffer);
  }
  update(data) {
    aexists(this);
    data = toBytes(data);
    abytes(data);
    const { view, buffer, blockLen } = this;
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView(data);
        for (; blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
      }
    }
    this.length += data.length;
    this.roundClean();
    return this;
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    clean(this.buffer.subarray(pos));
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      pos = 0;
    }
    for (let i = pos; i < blockLen; i++)
      buffer[i] = 0;
    setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE);
    this.process(view, 0);
    const oview = createView(out);
    const len = this.outputLen;
    if (len % 4)
      throw new Error("_sha2: outputLen should be aligned to 32bit");
    const outLen = len / 4;
    const state = this.get();
    if (outLen > state.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let i = 0; i < outLen; i++)
      oview.setUint32(4 * i, state[i], isLE);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneInto(to) {
    to || (to = new this.constructor());
    to.set(...this.get());
    const { blockLen, buffer, length, finished, destroyed, pos } = this;
    to.destroyed = destroyed;
    to.finished = finished;
    to.length = length;
    to.pos = pos;
    if (length % blockLen)
      to.buffer.set(buffer);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
};
var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);

// ../../node_modules/@noble/hashes/esm/sha2.js
var SHA256_K = /* @__PURE__ */ Uint32Array.from([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
var SHA256 = class extends HashMD {
  constructor(outputLen = 32) {
    super(64, outputLen, 8, false);
    this.A = SHA256_IV[0] | 0;
    this.B = SHA256_IV[1] | 0;
    this.C = SHA256_IV[2] | 0;
    this.D = SHA256_IV[3] | 0;
    this.E = SHA256_IV[4] | 0;
    this.F = SHA256_IV[5] | 0;
    this.G = SHA256_IV[6] | 0;
    this.H = SHA256_IV[7] | 0;
  }
  get() {
    const { A, B, C, D, E, F, G, H } = this;
    return [A, B, C, D, E, F, G, H];
  }
  // prettier-ignore
  set(A, B, C, D, E, F, G, H) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4)
      SHA256_W[i] = view.getUint32(offset, false);
    for (let i = 16; i < 64; i++) {
      const W15 = SHA256_W[i - 15];
      const W2 = SHA256_W[i - 2];
      const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
      const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
      SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
    }
    let { A, B, C, D, E, F, G, H } = this;
    for (let i = 0; i < 64; i++) {
      const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
      const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
      const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
      const T2 = sigma0 + Maj(A, B, C) | 0;
      H = G;
      G = F;
      F = E;
      E = D + T1 | 0;
      D = C;
      C = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    F = F + this.F | 0;
    G = G + this.G | 0;
    H = H + this.H | 0;
    this.set(A, B, C, D, E, F, G, H);
  }
  roundClean() {
    clean(SHA256_W);
  }
  destroy() {
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    clean(this.buffer);
  }
};
var sha256 = /* @__PURE__ */ createHasher(() => new SHA256());

// ../../node_modules/@noble/hashes/esm/sha256.js
var sha2562 = sha256;

// src/hash.ts
function sha256Bytes(...parts) {
  const hash = sha2562.create();
  for (const part of parts) hash.update(part);
  return import_buffer.Buffer.from(hash.digest());
}

// src/index.ts
var import_buffer4 = __toESM(require_buffer(), 1);

// src/op-return.ts
var import_buffer2 = __toESM(require_buffer(), 1);
function startsWithMagic(bytes) {
  return bytes.length >= MAGIC.length && bytes.subarray(0, MAGIC.length).equals(MAGIC);
}
function extractAibrcPayloadFromScript(scriptPubKeyHex) {
  if (!/^[0-9a-fA-F]+$/.test(scriptPubKeyHex) || scriptPubKeyHex.length % 2 !== 0) return { status: "NOT_AIBRC" };
  const script = import_buffer2.Buffer.from(scriptPubKeyHex, "hex");
  if (script[0] !== 106 || script.length < 2) return { status: "NOT_AIBRC" };
  const opcode = script[1];
  let declaredLength;
  let payloadOffset;
  let minimal = true;
  if (opcode <= 75) {
    declaredLength = opcode;
    payloadOffset = 2;
  } else if (opcode === 76) {
    if (script.length < 3) return { status: "NOT_AIBRC" };
    declaredLength = script[2];
    payloadOffset = 3;
    minimal = declaredLength > 75;
  } else if (opcode === 77) {
    if (script.length < 4) return { status: "NOT_AIBRC" };
    declaredLength = script.readUInt16LE(2);
    payloadOffset = 4;
    minimal = declaredLength > 255;
  } else if (opcode === 78) {
    if (script.length < 6) return { status: "NOT_AIBRC" };
    declaredLength = script.readUInt32LE(2);
    payloadOffset = 6;
    minimal = false;
  } else {
    return { status: "NOT_AIBRC" };
  }
  const available = script.subarray(payloadOffset);
  const markerVisible = declaredLength >= MAGIC.length && startsWithMagic(available);
  if (!markerVisible) return { status: "NOT_AIBRC" };
  if (!minimal) return { status: "MALFORMED_AIBRC_MARKER", reason: "NON_MINIMAL_PUSH" };
  if (available.length < declaredLength) return { status: "MALFORMED_AIBRC_MARKER", reason: "PUSH_LENGTH_MISMATCH" };
  if (available.length > declaredLength) return { status: "MALFORMED_AIBRC_MARKER", reason: "TRAILING_SCRIPT_OPERATION" };
  return { status: "VALID_AIBRC_PAYLOAD", payload: import_buffer2.Buffer.from(available.subarray(0, declaredLength)) };
}
function extractAibrcPayloadsFromOutputs(outputs) {
  const discoveries = outputs.map((output, outputIndex) => ({
    outputIndex,
    result: extractAibrcPayloadFromScript(output.scriptPubKeyHex)
  }));
  const payloads = discoveries.flatMap(({ result }) => result.status === "VALID_AIBRC_PAYLOAD" ? [result.payload] : []);
  const malformedMarkerCount = discoveries.filter(({ result }) => result.status === "MALFORMED_AIBRC_MARKER").length;
  return {
    outputs: discoveries,
    payloads,
    validMarkerCount: payloads.length,
    malformedMarkerCount,
    recognizedMarkerCount: payloads.length + malformedMarkerCount
  };
}
function classifyExtractedAibrcTransaction(extraction, context) {
  const counts = {
    validMarkerCount: extraction.validMarkerCount,
    malformedMarkerCount: extraction.malformedMarkerCount,
    recognizedMarkerCount: extraction.recognizedMarkerCount
  };
  if (counts.recognizedMarkerCount >= 2) {
    return { status: "NO_OP", reason: "DUPLICATE_STATE_INSTRUCTION", ...counts };
  }
  if (counts.recognizedMarkerCount === 0) {
    return { status: "NO_OP", reason: "NOT_AIBRC", ...counts };
  }
  if (counts.malformedMarkerCount === 1) {
    const malformed = extraction.outputs.find(({ result }) => result.status === "MALFORMED_AIBRC_MARKER");
    if (!malformed || malformed.result.status !== "MALFORMED_AIBRC_MARKER") {
      throw new Error("MALFORMED_MARKER_COUNT_MISMATCH");
    }
    return { status: "NO_OP", reason: malformed.result.reason, ...counts };
  }
  return { ...classifyProtocolPayload(extraction.payloads[0], context), ...counts };
}

// src/index.ts
var MAGIC = import_buffer3.Buffer.from("41494252", "hex");
var WIRE_VERSION = 1;
var HEADER_LENGTH = 9;
var MAX_AIBRC_PAYLOAD_BYTES = 480;
var MAX_PROTOCOL_PAYLOAD_BYTES = MAX_AIBRC_PAYLOAD_BYTES;
var COMPAT_PAYLOAD_BYTES = 80;
var MAX_ALLOCATIONS = 25;
var MAX_U128 = (1n << 128n) - 1n;
var NetworkId = /* @__PURE__ */ ((NetworkId2) => {
  NetworkId2[NetworkId2["MAINNET"] = 0] = "MAINNET";
  NetworkId2[NetworkId2["TESTNET"] = 1] = "TESTNET";
  NetworkId2[NetworkId2["SIGNET"] = 2] = "SIGNET";
  NetworkId2[NetworkId2["REGTEST"] = 3] = "REGTEST";
  return NetworkId2;
})(NetworkId || {});
var Opcode = /* @__PURE__ */ ((Opcode2) => {
  Opcode2[Opcode2["DEPLOY"] = 1] = "DEPLOY";
  Opcode2[Opcode2["TRANSFER"] = 2] = "TRANSFER";
  return Opcode2;
})(Opcode || {});
var ProtocolError = class extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
    this.name = "ProtocolError";
  }
  reason;
};
var NAME_POLICY_V1_SCHEDULE = Object.freeze({
  manifestNamePolicyVersion: 1,
  activationHeight: null
});
function createProtocolState() {
  return {
    assetsById: /* @__PURE__ */ new Map(),
    assetIdByName: /* @__PURE__ */ new Map(),
    assetIdByLocator: /* @__PURE__ */ new Map(),
    balances: /* @__PURE__ */ new Map()
  };
}
function assertUInt(value, max, reason) {
  if (!Number.isInteger(value) || value < 0 || value > max) throw new ProtocolError(reason);
}
function encodeU128(value) {
  if (value < 0n || value > MAX_U128) throw new ProtocolError("U128_OVERFLOW");
  return import_buffer3.Buffer.from(value.toString(16).padStart(32, "0"), "hex");
}
function decodeU128(buffer, offset) {
  if (offset + 16 > buffer.length) throw new ProtocolError("TRUNCATED_PAYLOAD");
  return BigInt(`0x${buffer.subarray(offset, offset + 16).toString("hex")}`);
}
function encodeVarUint(value, max, overflowReason = "U128_OVERFLOW") {
  if (value < 0n || value > max) throw new ProtocolError(overflowReason);
  const bytes = [];
  let remaining = value;
  do {
    let byte = Number(remaining & 0x7fn);
    remaining >>= 7n;
    if (remaining !== 0n) byte |= 128;
    bytes.push(byte);
  } while (remaining !== 0n);
  return import_buffer3.Buffer.from(bytes);
}
function decodeVarUint(buffer, offset, max, overflowReason = "U128_OVERFLOW") {
  let value = 0n;
  let shift = 0n;
  let cursor = offset;
  for (; ; ) {
    if (cursor >= buffer.length) throw new ProtocolError("TRUNCATED_PAYLOAD");
    const byte = buffer[cursor];
    const low = BigInt(byte & 127);
    if (shift >= 128n && low !== 0n) throw new ProtocolError(overflowReason);
    value |= low << shift;
    cursor += 1;
    if ((byte & 128) === 0) {
      if (cursor - offset > 1 && low === 0n) throw new ProtocolError("NON_CANONICAL_INTEGER");
      if (value > max) throw new ProtocolError(overflowReason);
      return { value, nextOffset: cursor };
    }
    shift += 7n;
    if (shift > 133n) throw new ProtocolError(overflowReason);
  }
}
function envelope(network, opcode, body) {
  if (!Object.values(NetworkId).includes(network)) throw new ProtocolError("UNKNOWN_NETWORK");
  const totalLength = HEADER_LENGTH + body.length;
  if (totalLength > MAX_PROTOCOL_PAYLOAD_BYTES) throw new ProtocolError("PAYLOAD_TOO_LARGE");
  const header = import_buffer3.Buffer.alloc(HEADER_LENGTH);
  MAGIC.copy(header, 0);
  header.writeUInt8(WIRE_VERSION, 4);
  header.writeUInt8(network, 5);
  header.writeUInt8(opcode, 6);
  header.writeUInt16BE(body.length, 7);
  return import_buffer3.Buffer.concat([header, body]);
}
function parseEnvelopeHeader(payload) {
  if (payload.length < 4 || !payload.subarray(0, 4).equals(MAGIC)) throw new ProtocolError("NOT_AIBRC");
  if (payload.length < HEADER_LENGTH) throw new ProtocolError("TRUNCATED_PAYLOAD");
  if (payload.length > MAX_PROTOCOL_PAYLOAD_BYTES) throw new ProtocolError("PAYLOAD_TOO_LARGE");
  const version = payload.readUInt8(4);
  const network = payload.readUInt8(5);
  const opcode = payload.readUInt8(6);
  if (network > 3 /* REGTEST */) throw new ProtocolError("UNKNOWN_NETWORK");
  return {
    version,
    network,
    opcode,
    declaredBodyLength: payload.readUInt16BE(7),
    body: payload.subarray(HEADER_LENGTH)
  };
}
function assertBodyLength(parsed) {
  if (parsed.declaredBodyLength !== parsed.body.length) throw new ProtocolError("LENGTH_MISMATCH");
}
function isCanonicalNameByte(byte) {
  return byte >= 48 && byte <= 57 || byte >= 65 && byte <= 90 || byte === 95;
}
function assertNameByteLength(bytes) {
  if (bytes.length < 1 || bytes.length > 16) throw new ProtocolError("INVALID_NAME");
}
function validateNamePolicyV1(bytes) {
  assertNameByteLength(bytes);
  for (const byte of bytes) {
    if (!isCanonicalNameByte(byte)) throw new ProtocolError("INVALID_NAME");
  }
}
function validateNamePolicyV2(bytes) {
  assertNameByteLength(bytes);
  let offset = 0;
  while (offset < bytes.length) {
    const first = bytes[offset];
    if (first <= 127) {
      if (!isCanonicalNameByte(first)) throw new ProtocolError("INVALID_NAME");
      offset += 1;
      continue;
    }
    if (first < 224 || first > 239 || offset + 2 >= bytes.length) throw new ProtocolError("INVALID_NAME");
    const second = bytes[offset + 1];
    const third = bytes[offset + 2];
    if (second < 128 || second > 191 || third < 128 || third > 191) throw new ProtocolError("INVALID_NAME");
    if (first === 224 && second < 160) throw new ProtocolError("INVALID_NAME");
    if (first === 237 && second > 159) throw new ProtocolError("INVALID_NAME");
    const codePoint = (first & 15) << 12 | (second & 63) << 6 | third & 63;
    if (!(codePoint >= 19968 && codePoint <= 40959 || codePoint >= 44032 && codePoint <= 55203)) {
      throw new ProtocolError("INVALID_NAME");
    }
    offset += 3;
  }
}
function namePolicyContextForBlock(schedule, blockHeight) {
  if (!schedule || !Number.isSafeInteger(blockHeight) || blockHeight < 0) {
    throw new ProtocolError("NAME_POLICY_CONTEXT_REQUIRED");
  }
  if (schedule.manifestNamePolicyVersion === 1) {
    if (schedule.activationHeight !== null) throw new ProtocolError("INVALID_NAME_POLICY");
  } else if (schedule.manifestNamePolicyVersion === 2) {
    if (!Number.isSafeInteger(schedule.activationHeight) || schedule.activationHeight === null || schedule.activationHeight < 0) {
      throw new ProtocolError("INVALID_NAME_POLICY");
    }
  } else {
    throw new ProtocolError("INVALID_NAME_POLICY");
  }
  return Object.freeze({
    manifestNamePolicyVersion: schedule.manifestNamePolicyVersion,
    activationHeight: schedule.activationHeight,
    blockHeight
  });
}
function activeNamePolicyVersion(context) {
  const verified = namePolicyContextForBlock(context, context?.blockHeight);
  return verified.manifestNamePolicyVersion === 2 && verified.blockHeight >= verified.activationHeight ? 2 : 1;
}
function validateCanonicalNameBytes(bytes, context) {
  if (!context) throw new ProtocolError("NAME_POLICY_CONTEXT_REQUIRED");
  if (activeNamePolicyVersion(context) === 1) validateNamePolicyV1(bytes);
  else validateNamePolicyV2(bytes);
}
function encodeDeploy(input, namePolicy) {
  assertUInt(input.deployAuthInputIndex, 65535, "INVALID_AUTH_INPUT");
  assertUInt(input.ownerOutputIndex, 65535, "INVALID_OWNER_OUTPUT");
  const name = import_buffer3.Buffer.from(input.name, "utf8");
  validateCanonicalNameBytes(name, namePolicy);
  if (input.totalSupply === 0n) throw new ProtocolError("ZERO_SUPPLY");
  const prefix = import_buffer3.Buffer.alloc(5);
  prefix.writeUInt16BE(input.deployAuthInputIndex, 0);
  prefix.writeUInt16BE(input.ownerOutputIndex, 2);
  prefix.writeUInt8(name.length, 4);
  return envelope(input.network, 1 /* DEPLOY */, import_buffer3.Buffer.concat([prefix, name, encodeU128(input.totalSupply)]));
}
function decodeDeployStructure(payload) {
  const parsed = parseEnvelopeHeader(payload);
  if (parsed.version !== WIRE_VERSION) throw new ProtocolError("UNKNOWN_VERSION");
  if (parsed.opcode !== 1 /* DEPLOY */) throw new ProtocolError("UNKNOWN_OPCODE");
  assertBodyLength(parsed);
  if (parsed.body.length < 21) throw new ProtocolError("TRUNCATED_PAYLOAD");
  const nameLength = parsed.body.readUInt8(4);
  if (nameLength < 1 || nameLength > 16) throw new ProtocolError("INVALID_NAME");
  const expectedLength = 5 + nameLength + 16;
  if (parsed.body.length !== expectedLength) throw new ProtocolError("LENGTH_MISMATCH");
  const canonicalNameBytes = import_buffer3.Buffer.from(parsed.body.subarray(5, 5 + nameLength));
  return {
    kind: "DEPLOY",
    version: parsed.version,
    network: parsed.network,
    deployAuthInputIndex: parsed.body.readUInt16BE(0),
    ownerOutputIndex: parsed.body.readUInt16BE(2),
    canonicalNameBytes,
    totalSupply: decodeU128(parsed.body, 5 + nameLength)
  };
}
function decodeDeploy(payload, namePolicy) {
  if (!namePolicy) throw new ProtocolError("NAME_POLICY_CONTEXT_REQUIRED");
  const decoded = decodeDeployStructure(payload);
  validateCanonicalNameBytes(decoded.canonicalNameBytes, namePolicy);
  return { ...decoded, name: decoded.canonicalNameBytes.toString("utf8") };
}
function encodeAssetLocator(locator) {
  assertUInt(locator.blockHeight, 4294967295, "UNKNOWN_ASSET");
  assertUInt(locator.txIndex, 65535, "UNKNOWN_ASSET");
  const result = import_buffer3.Buffer.alloc(6);
  result.writeUInt32BE(locator.blockHeight, 0);
  result.writeUInt16BE(locator.txIndex, 4);
  return result;
}
function decodeAssetLocator(buffer) {
  if (buffer.length !== 6) throw new ProtocolError("TRUNCATED_PAYLOAD");
  return { blockHeight: buffer.readUInt32BE(0), txIndex: buffer.readUInt16BE(4) };
}
function encodeTransfer(input) {
  assertUInt(input.authInputIndex, 65535, "INVALID_AUTH_INPUT");
  if (input.allocations.length === 0) throw new ProtocolError("EMPTY_ALLOCATIONS");
  if (input.allocations.length > MAX_ALLOCATIONS) throw new ProtocolError("TOO_MANY_ALLOCATIONS");
  const prefix = import_buffer3.Buffer.alloc(3);
  prefix.writeUInt16BE(input.authInputIndex, 0);
  prefix.writeUInt8(input.allocations.length, 2);
  const allocations = input.allocations.map((allocation) => {
    assertUInt(allocation.receiverOutputIndex, 65535, "RECEIVER_OUTPUT_INDEX_OUT_OF_RANGE");
    if (allocation.amount === 0n) throw new ProtocolError("ZERO_AMOUNT");
    return import_buffer3.Buffer.concat([
      encodeVarUint(BigInt(allocation.receiverOutputIndex), 0xffffn, "RECEIVER_OUTPUT_INDEX_OUT_OF_RANGE"),
      encodeVarUint(allocation.amount, MAX_U128)
    ]);
  });
  return envelope(
    input.network,
    2 /* TRANSFER */,
    import_buffer3.Buffer.concat([prefix, encodeAssetLocator(input.assetLocator), ...allocations])
  );
}
function decodeTransfer(payload) {
  const parsed = parseEnvelopeHeader(payload);
  if (parsed.version !== WIRE_VERSION) throw new ProtocolError("UNKNOWN_VERSION");
  if (parsed.opcode !== 2 /* TRANSFER */) throw new ProtocolError("UNKNOWN_OPCODE");
  assertBodyLength(parsed);
  if (parsed.body.length < 9) throw new ProtocolError("TRUNCATED_PAYLOAD");
  const count = parsed.body.readUInt8(2);
  if (count === 0) throw new ProtocolError("EMPTY_ALLOCATIONS");
  if (count > MAX_ALLOCATIONS) throw new ProtocolError("TOO_MANY_ALLOCATIONS");
  const allocations = [];
  let offset = 9;
  for (let i = 0; i < count; i += 1) {
    const receiver = decodeVarUint(
      parsed.body,
      offset,
      0xffffn,
      "RECEIVER_OUTPUT_INDEX_OUT_OF_RANGE"
    );
    const amount = decodeVarUint(parsed.body, receiver.nextOffset, MAX_U128);
    allocations.push({
      receiverOutputIndex: Number(receiver.value),
      amount: amount.value
    });
    offset = amount.nextOffset;
  }
  if (offset !== parsed.body.length) throw new ProtocolError("LENGTH_MISMATCH");
  return {
    kind: "TRANSFER",
    version: parsed.version,
    network: parsed.network,
    authInputIndex: parsed.body.readUInt16BE(0),
    assetLocator: decodeAssetLocator(parsed.body.subarray(3, 9)),
    allocations
  };
}
function classifyProtocolPayload(payload, context) {
  if (!context || !Number.isInteger(context.expectedNetwork) || context.expectedNetwork < 0 /* MAINNET */ || context.expectedNetwork > 3 /* REGTEST */) {
    throw new Error("EXPECTED_NETWORK_REQUIRED");
  }
  const activatedVersions = context.activatedVersions ?? /* @__PURE__ */ new Set([WIRE_VERSION]);
  try {
    const envelopeData = parseEnvelopeHeader(payload);
    if (envelopeData.network !== context.expectedNetwork) {
      return { status: "NO_OP", reason: "UNKNOWN_NETWORK" };
    }
    if (envelopeData.version !== WIRE_VERSION) {
      return activatedVersions.has(envelopeData.version) ? { status: "NEEDS_UPGRADE", reason: "UNKNOWN_VERSION" } : { status: "NO_OP", reason: "UNKNOWN_VERSION" };
    }
    if (envelopeData.opcode !== 1 /* DEPLOY */ && envelopeData.opcode !== 2 /* TRANSFER */) {
      return { status: "NO_OP", reason: "UNKNOWN_OPCODE" };
    }
    const instruction = envelopeData.opcode === 1 /* DEPLOY */ ? decodeDeploy(payload, context.namePolicy) : decodeTransfer(payload);
    return { status: "VALID", reason: "VALID", instruction };
  } catch (error) {
    const reason = error instanceof ProtocolError ? error.reason : "TRUNCATED_PAYLOAD";
    return { status: "NO_OP", reason };
  }
}
function taggedHash(tag, message) {
  const tagHash = sha256Bytes(import_buffer3.Buffer.from(tag, "utf8"));
  return sha256Bytes(tagHash, tagHash, message).toString("hex");
}
function normalizedHex(hex, bytes) {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0 || bytes !== void 0 && hex.length !== bytes * 2) {
    throw new ProtocolError("TRUNCATED_PAYLOAD");
  }
  return import_buffer3.Buffer.from(hex, "hex");
}
function decodeTxidDisplayBytes(txid) {
  return normalizedHex(txid, 32);
}
function encodeTxidDisplayBytes(bytes) {
  if (bytes.length !== 32) throw new ProtocolError("TRUNCATED_PAYLOAD");
  return bytes.toString("hex");
}
function classifyPayloadProfile(payload) {
  if (payload.length > MAX_PROTOCOL_PAYLOAD_BYTES) throw new ProtocolError("PAYLOAD_TOO_LARGE");
  return payload.length <= COMPAT_PAYLOAD_BYTES ? "COMPATIBILITY" : "EXTENDED";
}
function isCanonicalHex(hex) {
  return /^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0;
}
function deriveAssetId(input, namePolicy) {
  const owner = import_buffer3.Buffer.alloc(2);
  assertUInt(input.ownerOutputIndex, 65535, "INVALID_OWNER_OUTPUT");
  validateCanonicalNameBytes(input.canonicalNameBytes, namePolicy);
  owner.writeUInt16BE(input.ownerOutputIndex);
  return taggedHash(
    "AIBRC/asset/v1",
    import_buffer3.Buffer.concat([
      import_buffer3.Buffer.from([input.network]),
      decodeTxidDisplayBytes(input.deployTxid),
      owner,
      input.canonicalNameBytes
    ])
  );
}
function deriveAccountKey(scriptPubKeyHex) {
  return taggedHash("AIBRC/account/v1", normalizedHex(scriptPubKeyHex));
}
function locatorKey(locator) {
  return `${locator.blockHeight}:${locator.txIndex}`;
}
function balanceKey(assetId, accountKey) {
  return `${assetId}:${accountKey}`;
}
function classifyScriptPubKey(scriptPubKeyHex) {
  if (!isCanonicalHex(scriptPubKeyHex)) return "UNSUPPORTED";
  const script = import_buffer3.Buffer.from(scriptPubKeyHex, "hex");
  if (script.length === 34 && script[0] === 81 && script[1] === 32) return "P2TR";
  if (script.length === 22 && script[0] === 0 && script[1] === 20) return "P2WPKH";
  return "UNSUPPORTED";
}
var INPUT_AUTHORIZATION_RULE_ID = "aibrc-input-authorization/bip341-keypath-v1";
var UNSUPPORTED_INPUT_SIGHASH = 255;
function deriveInputSighashType(witnessHex, prevoutScriptHex) {
  if (typeof prevoutScriptHex !== "string" || !/^(?:[0-9a-fA-F]{2})*$/.test(prevoutScriptHex)) {
    throw new Error("INVALID_INPUT_PREVOUT_CONTEXT");
  }
  if (!Array.isArray(witnessHex) || witnessHex.some((item) => typeof item !== "string" || !/^(?:[0-9a-fA-F]{2})*$/.test(item))) {
    throw new Error("INVALID_INPUT_WITNESS_CONTEXT");
  }
  const scriptType = classifyScriptPubKey(prevoutScriptHex);
  if (scriptType === "UNSUPPORTED") return UNSUPPORTED_INPUT_SIGHASH;
  if (scriptType === "P2TR") {
    const annexPresent = witnessHex.length >= 2 && witnessHex.at(-1).slice(0, 2).toLowerCase() === "50";
    if (witnessHex.length - Number(annexPresent) !== 1) return UNSUPPORTED_INPUT_SIGHASH;
    const signature2 = import_buffer3.Buffer.from(witnessHex[0], "hex");
    if (signature2.length === 64) return 0;
    if (signature2.length === 65 && signature2[64] !== 0) return signature2[64];
    return UNSUPPORTED_INPUT_SIGHASH;
  }
  const signature = import_buffer3.Buffer.from(witnessHex[0] ?? "", "hex");
  return signature.length >= 2 ? signature[signature.length - 1] : UNSUPPORTED_INPUT_SIGHASH;
}
function isOpReturnScript(scriptPubKeyHex) {
  return isCanonicalHex(scriptPubKeyHex) && import_buffer3.Buffer.from(scriptPubKeyHex, "hex")[0] === 106;
}
function validateAuthorization(input) {
  if (!input) return "INVALID_AUTH_INPUT";
  const scriptType = classifyScriptPubKey(input.prevoutScriptPubKeyHex);
  if (scriptType === "UNSUPPORTED") return "UNSUPPORTED_SCRIPT";
  if (scriptType === "P2TR" && (input.sighashType === 0 || input.sighashType === 1)) return "VALID";
  if (scriptType === "P2WPKH" && input.sighashType === 1) return "VALID";
  return "UNSUPPORTED_SIGHASH";
}
function instructionHasCanonicalName(instruction, namePolicy) {
  try {
    validateCanonicalNameBytes(instruction.canonicalNameBytes, namePolicy);
    return instruction.name === instruction.canonicalNameBytes.toString("utf8");
  } catch {
    return false;
  }
}
function validateDeploy(instruction, tx, state, namePolicy) {
  if (!namePolicy) return "NAME_POLICY_CONTEXT_REQUIRED";
  if (!instructionHasCanonicalName(instruction, namePolicy)) return "INVALID_NAME";
  if (instruction.totalSupply <= 0n) return "ZERO_SUPPLY";
  if (instruction.totalSupply > MAX_U128) return "U128_OVERFLOW";
  const auth = validateAuthorization(tx.inputs[instruction.deployAuthInputIndex]);
  if (auth !== "VALID") return auth;
  const owner = tx.outputs[instruction.ownerOutputIndex];
  if (!owner) return "INVALID_OWNER_OUTPUT";
  if (classifyScriptPubKey(owner.scriptPubKeyHex) === "UNSUPPORTED") {
    return isOpReturnScript(owner.scriptPubKeyHex) ? "INVALID_OWNER_OUTPUT" : "UNSUPPORTED_SCRIPT";
  }
  if (state?.assetIdByName.has(instruction.name)) return "DUPLICATE_NAME";
  return "VALID";
}
function validateTransfer(instruction, tx, state) {
  const auth = validateAuthorization(tx.inputs[instruction.authInputIndex]);
  if (auth !== "VALID") return auth;
  if (instruction.allocations.length === 0) return "EMPTY_ALLOCATIONS";
  if (instruction.allocations.length > MAX_ALLOCATIONS) return "TOO_MANY_ALLOCATIONS";
  const assetId = state.assetIdByLocator.get(locatorKey(instruction.assetLocator));
  if (!assetId) return "UNKNOWN_ASSET";
  let total = 0n;
  for (const allocation of instruction.allocations) {
    if (!Number.isInteger(allocation.receiverOutputIndex) || allocation.receiverOutputIndex < 0 || allocation.receiverOutputIndex > 65535) {
      return "RECEIVER_OUTPUT_INDEX_OUT_OF_RANGE";
    }
    if (allocation.amount <= 0n) return "ZERO_AMOUNT";
    if (allocation.amount > MAX_U128) return "U128_OVERFLOW";
    const receiver = tx.outputs[allocation.receiverOutputIndex];
    if (!receiver) return "INVALID_RECEIVER_OUTPUT";
    if (classifyScriptPubKey(receiver.scriptPubKeyHex) === "UNSUPPORTED") {
      return isOpReturnScript(receiver.scriptPubKeyHex) ? "INVALID_RECEIVER_OUTPUT" : "UNSUPPORTED_SCRIPT";
    }
    total += allocation.amount;
    if (total > MAX_U128) return "U128_OVERFLOW";
  }
  const sender = tx.inputs[instruction.authInputIndex];
  const senderBalance = state.balances.get(balanceKey(assetId, deriveAccountKey(sender.prevoutScriptPubKeyHex))) ?? 0n;
  return senderBalance >= total ? "VALID" : "INSUFFICIENT_BALANCE";
}
function applyDeploy(instruction, tx, state, namePolicy) {
  const reason = validateDeploy(instruction, tx, state, namePolicy);
  if (reason !== "VALID") return { status: "NO_OP", reason };
  const owner = tx.outputs[instruction.ownerOutputIndex];
  const deployTxid = encodeTxidDisplayBytes(decodeTxidDisplayBytes(tx.txid));
  const assetId = deriveAssetId({
    network: instruction.network,
    deployTxid,
    ownerOutputIndex: instruction.ownerOutputIndex,
    canonicalNameBytes: instruction.canonicalNameBytes
  }, namePolicy);
  const locator = { blockHeight: tx.blockHeight, txIndex: tx.txIndex };
  const asset = {
    assetId,
    name: instruction.name,
    network: instruction.network,
    totalSupply: instruction.totalSupply,
    deployTxid,
    ownerOutputIndex: instruction.ownerOutputIndex,
    locator
  };
  state.assetsById.set(assetId, asset);
  state.assetIdByName.set(instruction.name, assetId);
  state.assetIdByLocator.set(locatorKey(locator), assetId);
  state.balances.set(balanceKey(assetId, deriveAccountKey(owner.scriptPubKeyHex)), instruction.totalSupply);
  return { status: "APPLIED", reason: "VALID", assetId };
}
function applyTransfer(instruction, tx, state) {
  const reason = validateTransfer(instruction, tx, state);
  if (reason !== "VALID") return { status: "NO_OP", reason };
  const assetId = state.assetIdByLocator.get(locatorKey(instruction.assetLocator));
  const senderAccount = deriveAccountKey(tx.inputs[instruction.authInputIndex].prevoutScriptPubKeyHex);
  const senderKey = balanceKey(assetId, senderAccount);
  const total = instruction.allocations.reduce((sum, allocation) => sum + allocation.amount, 0n);
  const deltas = /* @__PURE__ */ new Map([[senderKey, -total]]);
  for (const allocation of instruction.allocations) {
    const account = deriveAccountKey(tx.outputs[allocation.receiverOutputIndex].scriptPubKeyHex);
    const key = balanceKey(assetId, account);
    deltas.set(key, (deltas.get(key) ?? 0n) + allocation.amount);
  }
  for (const [key, delta] of deltas) {
    const next = (state.balances.get(key) ?? 0n) + delta;
    if (next === 0n) state.balances.delete(key);
    else state.balances.set(key, next);
  }
  return { status: "APPLIED", reason: "VALID", assetId };
}
function serializeCanonicalState(state) {
  const compareStrings = (left, right) => left < right ? -1 : left > right ? 1 : 0;
  const compareCanonicalNames = (left, right) => import_buffer3.Buffer.compare(import_buffer3.Buffer.from(left, "utf8"), import_buffer3.Buffer.from(right, "utf8"));
  const compareLocators = ([left], [right]) => {
    const [leftHeight, leftIndex] = left.split(":").map(Number);
    const [rightHeight, rightIndex] = right.split(":").map(Number);
    return leftHeight - rightHeight || leftIndex - rightIndex;
  };
  const canonical = {
    assets: [...state.assetsById.values()].sort((left, right) => compareStrings(left.assetId, right.assetId)).map((asset) => ({
      assetId: asset.assetId,
      name: asset.name,
      network: asset.network,
      totalSupply: asset.totalSupply.toString(),
      deployTxid: asset.deployTxid,
      ownerOutputIndex: asset.ownerOutputIndex,
      locator: [asset.locator.blockHeight, asset.locator.txIndex]
    })),
    names: [...state.assetIdByName.entries()].sort(([left], [right]) => compareCanonicalNames(left, right)),
    locators: [...state.assetIdByLocator.entries()].sort(compareLocators),
    balances: [...state.balances.entries()].filter(([, balance]) => balance > 0n).sort(([left], [right]) => compareStrings(left, right)).map(([key, balance]) => [key, balance.toString()])
  };
  return import_buffer3.Buffer.from(JSON.stringify(canonical), "utf8");
}
function deriveStateHash(state) {
  return sha256Bytes(serializeCanonicalState(state)).toString("hex");
}
var export_Buffer = import_buffer4.Buffer;
export {
  export_Buffer as Buffer,
  COMPAT_PAYLOAD_BYTES,
  HEADER_LENGTH,
  INPUT_AUTHORIZATION_RULE_ID,
  MAGIC,
  MAX_AIBRC_PAYLOAD_BYTES,
  MAX_ALLOCATIONS,
  MAX_PROTOCOL_PAYLOAD_BYTES,
  MAX_U128,
  NAME_POLICY_V1_SCHEDULE,
  NetworkId,
  Opcode,
  ProtocolError,
  UNSUPPORTED_INPUT_SIGHASH,
  WIRE_VERSION,
  activeNamePolicyVersion,
  applyDeploy,
  applyTransfer,
  classifyExtractedAibrcTransaction,
  classifyPayloadProfile,
  classifyProtocolPayload,
  classifyScriptPubKey,
  createProtocolState,
  decodeAssetLocator,
  decodeDeploy,
  decodeDeployStructure,
  decodeTransfer,
  decodeTxidDisplayBytes,
  deriveAccountKey,
  deriveAssetId,
  deriveInputSighashType,
  deriveStateHash,
  encodeAssetLocator,
  encodeDeploy,
  encodeTransfer,
  encodeTxidDisplayBytes,
  extractAibrcPayloadFromScript,
  extractAibrcPayloadsFromOutputs,
  isCanonicalNameByte,
  namePolicyContextForBlock,
  serializeCanonicalState,
  validateCanonicalNameBytes,
  validateDeploy,
  validateTransfer
};
/*! Bundled license information:

ieee754/index.js:
  (*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> *)

buffer/index.js:
  (*!
   * The buffer module from node.js, for the browser.
   *
   * @author   Feross Aboukhadijeh <https://feross.org>
   * @license  MIT
   *)

@noble/hashes/esm/utils.js:
  (*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
