import "dotenv/config";
import { loadConfig } from "./core/config";

const config = loadConfig();
if (config.botRole === "worker") {
  const { startWorker } = await import("./worker");
  await startWorker(config);
  // No process.exit(): lets pino flush before drain.
  process.exitCode = 0;
} else {
  const { startGateway } = await import("./app");
  await startGateway(config);
}
