const { ATYP } = require("./constants");

const getPort = buffer => {
  return buffer.readInt16BE(buffer.length - 2);
};

const getAddress = buffer => {
  if (buffer[3] === ATYP.IPV4) {
    return `${buffer[4]}.${buffer[5]}.${buffer[6]}.${buffer[7]}`;
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
