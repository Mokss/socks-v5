const { createServer } = require("./index");

const server = createServer();

server.listen(1080);

server.on("error", err => {
  console.error(`server ERROR ---> ${err}`);
});

const memory = Array(20);
const bytesToMb = bytes => Math.round(bytes / 1000, 2) / 1000;

setInterval(() => {
  console.clear();
  const usage = process.memoryUsage();
  const row = {
    rss: bytesToMb(usage.rss),
    heapTotal: bytesToMb(usage.heapTotal),
    heapUsed: bytesToMb(usage.heapUsed),
    external: bytesToMb(usage.external),
    stack: bytesToMb(usage.rss - usage.heapTotal)
  };
  let b = 0;
  for (let i = 0; i < 19; i++) {
    b = memory[i + 1];
    memory[i] = b || row;
  }
  memory[19] = row;
  console.table(memory);
}, 1000);
