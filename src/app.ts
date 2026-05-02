import express, { Application, Request, Response } from "express";
import taxLookupRoute from "./routes/taxLookup.route";

export function createApp(): Application {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ success: true, status: "ok" });
  });

  app.use("/api", taxLookupRoute);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: "NOT_FOUND",
      message: "Route not found",
    });
  });

  return app;
}
