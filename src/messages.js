// This file is auto generated by the protocol-buffers compiler

/* eslint-disable quotes */
/* eslint-disable indent */
/* eslint-disable no-redeclare */
/* eslint-disable camelcase */

// Remember to `npm install --save protocol-buffers-encodings`
var encodings = require('protocol-buffers-encodings')
var varint = encodings.varint
var skip = encodings.skip

exports.PacketType = {
  "CONNECTED": 1,
  "DISCONNECTED": 2,
  "BOOTSTRAP_REQUEST": 3,
  "BOOTSTRAP_RESPONSE": 4,
  "STATE": 5,
  "BROADCAST": 6,
  "MESSAGE": 7
}

var Broadcast = exports.Broadcast = {
  buffer: true,
  encodingLength: null,
  encode: null,
  decode: null
}

var PeerState = exports.PeerState = {
  buffer: true,
  encodingLength: null,
  encode: null,
  decode: null
}

var GossipPacket = exports.GossipPacket = {
  buffer: true,
  encodingLength: null,
  encode: null,
  decode: null
}

var Map_string_PeerState = exports.Map_string_PeerState = {
  buffer: true,
  encodingLength: null,
  encode: null,
  decode: null
}

defineBroadcast()
definePeerState()
defineGossipPacket()
defineMap_string_PeerState()

function defineBroadcast () {
  Broadcast.encodingLength = encodingLength
  Broadcast.encode = encode
  Broadcast.decode = decode

  function encodingLength (obj) {
    var length = 0
    if (defined(obj.origin)) {
      var len = encodings.bytes.encodingLength(obj.origin)
      length += 1 + len
    }
    if (defined(obj.seq)) {
      var len = encodings.varint.encodingLength(obj.seq)
      length += 1 + len
    }
    if (defined(obj.ttl)) {
      var len = encodings.varint.encodingLength(obj.ttl)
      length += 1 + len
    }
    if (defined(obj.data)) {
      var len = encodings.bytes.encodingLength(obj.data)
      length += 1 + len
    }
    if (defined(obj.nonce)) {
      var len = encodings.bytes.encodingLength(obj.nonce)
      length += 1 + len
    }
    return length
  }

  function encode (obj, buf, offset) {
    if (!offset) offset = 0
    if (!buf) buf = Buffer.allocUnsafe(encodingLength(obj))
    var oldOffset = offset
    if (defined(obj.origin)) {
      buf[offset++] = 10
      encodings.bytes.encode(obj.origin, buf, offset)
      offset += encodings.bytes.encode.bytes
    }
    if (defined(obj.seq)) {
      buf[offset++] = 16
      encodings.varint.encode(obj.seq, buf, offset)
      offset += encodings.varint.encode.bytes
    }
    if (defined(obj.ttl)) {
      buf[offset++] = 24
      encodings.varint.encode(obj.ttl, buf, offset)
      offset += encodings.varint.encode.bytes
    }
    if (defined(obj.data)) {
      buf[offset++] = 34
      encodings.bytes.encode(obj.data, buf, offset)
      offset += encodings.bytes.encode.bytes
    }
    if (defined(obj.nonce)) {
      buf[offset++] = 42
      encodings.bytes.encode(obj.nonce, buf, offset)
      offset += encodings.bytes.encode.bytes
    }
    encode.bytes = offset - oldOffset
    return buf
  }

  function decode (buf, offset, end) {
    if (!offset) offset = 0
    if (!end) end = buf.length
    if (!(end <= buf.length && offset <= buf.length)) throw new Error("Decoded message is not valid")
    var oldOffset = offset
    var obj = {
      origin: null,
      seq: 0,
      ttl: 0,
      data: null,
      nonce: null
    }
    while (true) {
      if (end <= offset) {
        decode.bytes = offset - oldOffset
        return obj
      }
      var prefix = varint.decode(buf, offset)
      offset += varint.decode.bytes
      var tag = prefix >> 3
      switch (tag) {
        case 1:
        obj.origin = encodings.bytes.decode(buf, offset)
        offset += encodings.bytes.decode.bytes
        break
        case 2:
        obj.seq = encodings.varint.decode(buf, offset)
        offset += encodings.varint.decode.bytes
        break
        case 3:
        obj.ttl = encodings.varint.decode(buf, offset)
        offset += encodings.varint.decode.bytes
        break
        case 4:
        obj.data = encodings.bytes.decode(buf, offset)
        offset += encodings.bytes.decode.bytes
        break
        case 5:
        obj.nonce = encodings.bytes.decode(buf, offset)
        offset += encodings.bytes.decode.bytes
        break
        default:
        offset = skip(prefix & 7, buf, offset)
      }
    }
  }
}

function definePeerState () {
  PeerState.encodingLength = encodingLength
  PeerState.encode = encode
  PeerState.decode = decode

  function encodingLength (obj) {
    var length = 0
    if (defined(obj.ephemeral)) {
      var len = encodings.bool.encodingLength(obj.ephemeral)
      length += 1 + len
    }
    if (defined(obj.lookingup)) {
      for (var i = 0; i < obj.lookingup.length; i++) {
        if (!defined(obj.lookingup[i])) continue
        var len = encodings.bytes.encodingLength(obj.lookingup[i])
        length += 1 + len
      }
    }
    if (defined(obj.announcing)) {
      for (var i = 0; i < obj.announcing.length; i++) {
        if (!defined(obj.announcing[i])) continue
        var len = encodings.bytes.encodingLength(obj.announcing[i])
        length += 1 + len
      }
    }
    if (defined(obj.connected)) {
      for (var i = 0; i < obj.connected.length; i++) {
        if (!defined(obj.connected[i])) continue
        var len = encodings.bytes.encodingLength(obj.connected[i])
        length += 1 + len
      }
    }
    if (defined(obj.userData)) {
      var len = encodings.bytes.encodingLength(obj.userData)
      length += 1 + len
    }
    return length
  }

  function encode (obj, buf, offset) {
    if (!offset) offset = 0
    if (!buf) buf = Buffer.allocUnsafe(encodingLength(obj))
    var oldOffset = offset
    if (defined(obj.ephemeral)) {
      buf[offset++] = 8
      encodings.bool.encode(obj.ephemeral, buf, offset)
      offset += encodings.bool.encode.bytes
    }
    if (defined(obj.lookingup)) {
      for (var i = 0; i < obj.lookingup.length; i++) {
        if (!defined(obj.lookingup[i])) continue
        buf[offset++] = 18
        encodings.bytes.encode(obj.lookingup[i], buf, offset)
        offset += encodings.bytes.encode.bytes
      }
    }
    if (defined(obj.announcing)) {
      for (var i = 0; i < obj.announcing.length; i++) {
        if (!defined(obj.announcing[i])) continue
        buf[offset++] = 26
        encodings.bytes.encode(obj.announcing[i], buf, offset)
        offset += encodings.bytes.encode.bytes
      }
    }
    if (defined(obj.connected)) {
      for (var i = 0; i < obj.connected.length; i++) {
        if (!defined(obj.connected[i])) continue
        buf[offset++] = 34
        encodings.bytes.encode(obj.connected[i], buf, offset)
        offset += encodings.bytes.encode.bytes
      }
    }
    if (defined(obj.userData)) {
      buf[offset++] = 42
      encodings.bytes.encode(obj.userData, buf, offset)
      offset += encodings.bytes.encode.bytes
    }
    encode.bytes = offset - oldOffset
    return buf
  }

  function decode (buf, offset, end) {
    if (!offset) offset = 0
    if (!end) end = buf.length
    if (!(end <= buf.length && offset <= buf.length)) throw new Error("Decoded message is not valid")
    var oldOffset = offset
    var obj = {
      ephemeral: false,
      lookingup: [],
      announcing: [],
      connected: [],
      userData: null
    }
    while (true) {
      if (end <= offset) {
        decode.bytes = offset - oldOffset
        return obj
      }
      var prefix = varint.decode(buf, offset)
      offset += varint.decode.bytes
      var tag = prefix >> 3
      switch (tag) {
        case 1:
        obj.ephemeral = encodings.bool.decode(buf, offset)
        offset += encodings.bool.decode.bytes
        break
        case 2:
        obj.lookingup.push(encodings.bytes.decode(buf, offset))
        offset += encodings.bytes.decode.bytes
        break
        case 3:
        obj.announcing.push(encodings.bytes.decode(buf, offset))
        offset += encodings.bytes.decode.bytes
        break
        case 4:
        obj.connected.push(encodings.bytes.decode(buf, offset))
        offset += encodings.bytes.decode.bytes
        break
        case 5:
        obj.userData = encodings.bytes.decode(buf, offset)
        offset += encodings.bytes.decode.bytes
        break
        default:
        offset = skip(prefix & 7, buf, offset)
      }
    }
  }
}

function defineGossipPacket () {
  GossipPacket.encodingLength = encodingLength
  GossipPacket.encode = encode
  GossipPacket.decode = decode

  function encodingLength (obj) {
    var length = 0
    if (!defined(obj.type)) throw new Error("type is required")
    var len = encodings.enum.encodingLength(obj.type)
    length += 1 + len
    if (defined(obj.publicKey)) {
      var len = encodings.bytes.encodingLength(obj.publicKey)
      length += 1 + len
    }
    if (defined(obj.state)) {
      var len = PeerState.encodingLength(obj.state)
      length += varint.encodingLength(len)
      length += 1 + len
    }
    if (defined(obj.bootstrap)) {
      var tmp = Object.keys(obj.bootstrap)
      for (var i = 0; i < tmp.length; i++) {
        tmp[i] = {key: tmp[i], value: obj.bootstrap[tmp[i]]}
      }
      for (var i = 0; i < tmp.length; i++) {
        if (!defined(tmp[i])) continue
        var len = Map_string_PeerState.encodingLength(tmp[i])
        length += varint.encodingLength(len)
        length += 1 + len
      }
    }
    if (defined(obj.userData)) {
      var len = encodings.bytes.encodingLength(obj.userData)
      length += 1 + len
    }
    return length
  }

  function encode (obj, buf, offset) {
    if (!offset) offset = 0
    if (!buf) buf = Buffer.allocUnsafe(encodingLength(obj))
    var oldOffset = offset
    if (!defined(obj.type)) throw new Error("type is required")
    buf[offset++] = 8
    encodings.enum.encode(obj.type, buf, offset)
    offset += encodings.enum.encode.bytes
    if (defined(obj.publicKey)) {
      buf[offset++] = 18
      encodings.bytes.encode(obj.publicKey, buf, offset)
      offset += encodings.bytes.encode.bytes
    }
    if (defined(obj.state)) {
      buf[offset++] = 26
      varint.encode(PeerState.encodingLength(obj.state), buf, offset)
      offset += varint.encode.bytes
      PeerState.encode(obj.state, buf, offset)
      offset += PeerState.encode.bytes
    }
    if (defined(obj.bootstrap)) {
      var tmp = Object.keys(obj.bootstrap)
      for (var i = 0; i < tmp.length; i++) {
        tmp[i] = {key: tmp[i], value: obj.bootstrap[tmp[i]]}
      }
      for (var i = 0; i < tmp.length; i++) {
        if (!defined(tmp[i])) continue
        buf[offset++] = 34
        varint.encode(Map_string_PeerState.encodingLength(tmp[i]), buf, offset)
        offset += varint.encode.bytes
        Map_string_PeerState.encode(tmp[i], buf, offset)
        offset += Map_string_PeerState.encode.bytes
      }
    }
    if (defined(obj.userData)) {
      buf[offset++] = 42
      encodings.bytes.encode(obj.userData, buf, offset)
      offset += encodings.bytes.encode.bytes
    }
    encode.bytes = offset - oldOffset
    return buf
  }

  function decode (buf, offset, end) {
    if (!offset) offset = 0
    if (!end) end = buf.length
    if (!(end <= buf.length && offset <= buf.length)) throw new Error("Decoded message is not valid")
    var oldOffset = offset
    var obj = {
      type: 1,
      publicKey: null,
      state: null,
      bootstrap: {},
      userData: null
    }
    var found0 = false
    while (true) {
      if (end <= offset) {
        if (!found0) throw new Error("Decoded message is not valid")
        decode.bytes = offset - oldOffset
        return obj
      }
      var prefix = varint.decode(buf, offset)
      offset += varint.decode.bytes
      var tag = prefix >> 3
      switch (tag) {
        case 1:
        obj.type = encodings.enum.decode(buf, offset)
        offset += encodings.enum.decode.bytes
        found0 = true
        break
        case 2:
        obj.publicKey = encodings.bytes.decode(buf, offset)
        offset += encodings.bytes.decode.bytes
        break
        case 3:
        var len = varint.decode(buf, offset)
        offset += varint.decode.bytes
        obj.state = PeerState.decode(buf, offset, offset + len)
        offset += PeerState.decode.bytes
        break
        case 4:
        var len = varint.decode(buf, offset)
        offset += varint.decode.bytes
        var tmp = Map_string_PeerState.decode(buf, offset, offset + len)
        obj.bootstrap[tmp.key] = tmp.value
        offset += Map_string_PeerState.decode.bytes
        break
        case 5:
        obj.userData = encodings.bytes.decode(buf, offset)
        offset += encodings.bytes.decode.bytes
        break
        default:
        offset = skip(prefix & 7, buf, offset)
      }
    }
  }
}

function defineMap_string_PeerState () {
  Map_string_PeerState.encodingLength = encodingLength
  Map_string_PeerState.encode = encode
  Map_string_PeerState.decode = decode

  function encodingLength (obj) {
    var length = 0
    if (!defined(obj.key)) throw new Error("key is required")
    var len = encodings.string.encodingLength(obj.key)
    length += 1 + len
    if (defined(obj.value)) {
      var len = PeerState.encodingLength(obj.value)
      length += varint.encodingLength(len)
      length += 1 + len
    }
    return length
  }

  function encode (obj, buf, offset) {
    if (!offset) offset = 0
    if (!buf) buf = Buffer.allocUnsafe(encodingLength(obj))
    var oldOffset = offset
    if (!defined(obj.key)) throw new Error("key is required")
    buf[offset++] = 10
    encodings.string.encode(obj.key, buf, offset)
    offset += encodings.string.encode.bytes
    if (defined(obj.value)) {
      buf[offset++] = 18
      varint.encode(PeerState.encodingLength(obj.value), buf, offset)
      offset += varint.encode.bytes
      PeerState.encode(obj.value, buf, offset)
      offset += PeerState.encode.bytes
    }
    encode.bytes = offset - oldOffset
    return buf
  }

  function decode (buf, offset, end) {
    if (!offset) offset = 0
    if (!end) end = buf.length
    if (!(end <= buf.length && offset <= buf.length)) throw new Error("Decoded message is not valid")
    var oldOffset = offset
    var obj = {
      key: "",
      value: null
    }
    var found0 = false
    while (true) {
      if (end <= offset) {
        if (!found0) throw new Error("Decoded message is not valid")
        decode.bytes = offset - oldOffset
        return obj
      }
      var prefix = varint.decode(buf, offset)
      offset += varint.decode.bytes
      var tag = prefix >> 3
      switch (tag) {
        case 1:
        obj.key = encodings.string.decode(buf, offset)
        offset += encodings.string.decode.bytes
        found0 = true
        break
        case 2:
        var len = varint.decode(buf, offset)
        offset += varint.decode.bytes
        obj.value = PeerState.decode(buf, offset, offset + len)
        offset += PeerState.decode.bytes
        break
        default:
        offset = skip(prefix & 7, buf, offset)
      }
    }
  }
}

function defined (val) {
  return val !== null && val !== undefined && (typeof val !== 'number' || !isNaN(val))
}
