import "dotenv/config";

const role = process.env.BOT_ROLE ?? "gateway";
if (role === "worker") {
  const { startWorker } = await import("./worker");
  await startWorker();
  // No process.exit(): lets pino flush before drain.
  process.exitCode = 0;
} else {
  const { startGateway } = await import("./app");
  await startGateway();
}
