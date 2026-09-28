export const swaggerOptions = {
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Tandem",
        version: "1.0.0",
      },
    },
    apis: ["./route/*.js"], // path to your route files
  };
  