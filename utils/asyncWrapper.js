export const asyncWrapper = (fn) =>
  function wrappedAsyncHandler(req, res, next) {
    Promise
      .resolve(fn(req, res, next)) // execute your async code
      .catch(next);               // forward any error to the error middleware
  };