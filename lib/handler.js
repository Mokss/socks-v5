const { isIPv4 } = require("net");
const { ATYP } = require("./constants");

const getPort = buffer => {
  const port = buffer.readInt16BE(buffer.length - 2);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return false;
  return port;
};

const getAddress = buffer => {
  if (buffer[3] === ATYP.IPV4) {
    const ip = `${buffer[4]}.${buffer[5]}.${buffer[6]}.${buffer[7]}`;
    if (!isIPv4(ip)) return false;
    return ip;
  }
  if (buffer[3] === ATYP.DOMAINNAME) {
    return buffer.toString("utf8", 5, buffer.length - 2);
  }

  return false;
};

module.exports = {
  getAddress,
  getPort
};
