export class CustomError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; /* -- newline -- */
    Error.captureStackTrace(this, this.constructor);
  }
}
  
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[Error] ${err.name || 'Error'}: ${err.message}`);
    if (err.stack) console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  });
};


  export const notFoundError = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl} `);
    res.status(404);
    next(error);
  };
