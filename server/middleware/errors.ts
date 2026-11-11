import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { config } from "../config.js";
import { HttpError } from "../utils/http.js";

export const apiNotFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "That API route does not exist." });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: "Please check the submitted details.",
      details: error.flatten().fieldErrors,
    });
    return;
  }

  const parserError = error as {
    type?: string;
    status?: number;
    statusCode?: number;
  };

  if (parserError.type === "entity.parse.failed") {
    res.status(400).json({ error: "Invalid JSON body." });
    return;
  }

  if (parserError.type === "entity.too.large" || parserError.status === 413) {
    res.status(413).json({ error: "The request body is too large." });
    return;
  }

  if (parserError.status === 400 || parserError.statusCode === 400) {
    res.status(400).json({ error: "The request could not be processed." });
    return;
  }

  console.error("[api] unhandled error", error);
  res.status(500).json({
    error: config.isProduction
      ? "Something went wrong. Please try again."
      : "Something went wrong. Check the server logs.",
  });
};
