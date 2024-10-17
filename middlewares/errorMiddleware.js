const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
  };
  
  const errorHandler = (err, req, res, next) => {
    let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    let message = err.message;
    let errors = {};
  
    // If Mongoose not found error, set to 404 and change message
    if (err.name === "CastError" && err.kind === "ObjectId") {
      statusCode = 404;
      message = "Resource not found";
    }
    // Handle Validation error
    if (err.name == "ValidationError") {
      statusCode = 400;
      message = Object.keys(err.errors).map((key) => err.errors[key].message);
  
      Object.keys(err.errors).forEach((key) => {
        errors[key] = err.errors[key].message;
      });
    }
  
    // Handle duplicate key error
    if (err.code === 11000) {
      statusCode = 400;
      // Extract the duplicate key value from the error message
      message = `Duplicate ${Object.keys(err.keyValue)} error`;
    }
    res.status(statusCode).json({
      success: false,
      message: message,
      error: Object.keys(errors).length ? errors : err,
      stack: process.env.NODE_ENV === "production" ? null : err.stack,
    });
  };
  
  export { notFound, errorHandler };