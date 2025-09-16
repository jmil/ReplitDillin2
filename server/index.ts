import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // Only log response body in development and exclude sensitive routes
      const isDevelopment = process.env.NODE_ENV === "development";
      const isSensitiveRoute = path.startsWith("/api/auth") || path.includes("login") || path.includes("password");
      
      if (isDevelopment && !isSensitiveRoute && capturedJsonResponse) {
        // Sanitize sensitive fields from response body
        const sanitizedResponse = sanitizeResponseBody(capturedJsonResponse);
        logLine += ` :: ${JSON.stringify(sanitizedResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Helper function to sanitize sensitive data from response bodies
function sanitizeResponseBody(responseBody: any): any {
  if (!responseBody || typeof responseBody !== 'object') return responseBody;
  
  const sanitized = { ...responseBody };
  const sensitiveFields = ['password', 'token', 'accessToken', 'refreshToken', 'jwt', 'email', 'phone'];
  
  function sanitizeObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitizedObj = { ...obj };
      for (const key in sanitizedObj) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          sanitizedObj[key] = '[REDACTED]';
        } else {
          sanitizedObj[key] = sanitizeObject(sanitizedObj[key]);
        }
      }
      return sanitizedObj;
    }
    
    return obj;
  }
  
  return sanitizeObject(sanitized);
}

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log error details without exposing sensitive information
    const isDevelopment = process.env.NODE_ENV === "development";
    if (isDevelopment) {
      log(`Error ${status} on ${req.method} ${req.path}: ${message}`);
      console.error(err.stack);
    } else {
      // In production, log minimal error information
      log(`Error ${status} on ${req.method} ${req.path}`);
    }

    // Send error response without rethrowing (prevents server crash)
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
