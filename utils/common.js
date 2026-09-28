import { CustomError } from "./errorHandler.js";

export const isStrongPassword = (password) => {
  // const pattern = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  const pattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[A-Za-z\d\W_]{8,}$/;


  return pattern.test(password);
};

export const fetchApi = async (url, options = {}) => {
  const { method = "GET", body, headers = {} } = options;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    let data;
    const contentType = response.headers.get("content-type");

    // If response is JSON, parse normally
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      // fallback: read as text
      const textData = await response.text();
      data = { message: textData || "No response body" };
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new CustomError(
        `Request failed with status ${response.status}: ${errorText}`,
        response.status
      );
    }

    return await response.json();
  } catch (err) {
    if (err instanceof CustomError) throw err;
    console.error("Fetch failed:", err);
    throw new CustomError("External API call failed", 500);
  }
};
